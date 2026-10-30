import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_VISIBILITY,
  type Locale,
  type MyProfile,
  PROFILE_AVATAR_MAX_BYTES,
  type ProfileLink,
  ProfileLinkSchema,
  type ProfileRole,
  type ProfileSettings,
  type ProfileVisibility,
  ProfileVisibilitySchema,
  type PublicProfile,
} from '@nuvora/shared';
import { z } from 'zod';
import { CommsDirectory, type CommsParticipant } from '../comms/directory.js';
import { RealtimeHub } from '../comms/realtime-hub.js';
import type { Prisma } from '../generated/prisma/client.js';
import { IdentityService } from '../identity/identity.service.js';
import { readCookie, SESSION_COOKIE } from '../identity/session-cookie.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { findStaff } from '../staff/demo-org.js';
import { STAFF_COOKIE, staffFromAccount, staffFromCookie } from '../staff/staff.guard.js';
import { avatarUrl } from './avatar-url.js';
import { canSee, firstFree, type Relation, suggestHandle } from './profile-rules.js';

/** The demo subject whose level and XP the learning block shows (the learner app's subject). */
const PROFILE_SUBJECT = 'javascript';
const IMAGE_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);

/** A signed-in person: who owns or views a profile. */
export interface ProfilePerson {
  key: string;
  name: string;
  role: ProfileRole;
  /** Learners: their user id (for stats); guests cannot own a profile */
  userId: string | null;
  guest: boolean;
}

const profileSelect = {
  participantKey: true,
  handle: true,
  headline: true,
  bio: true,
  city: true,
  languages: true,
  interests: true,
  links: true,
  subject: true,
  experienceYears: true,
  officeHours: true,
  cover: true,
  accent: true,
  visibility: true,
  showOnline: true,
  avatar: { select: { updatedAt: true } },
} as const;
type ProfileRow = Prisma.ProfileGetPayload<{ select: typeof profileSelect }>;


/** Stored JSON read defensively: anything malformed falls back to the defaults. */
function readVisibility(value: unknown): ProfileVisibility {
  const parsed = ProfileVisibilitySchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_VISIBILITY;
}
function readLinks(value: unknown): ProfileLink[] {
  const parsed = z.array(ProfileLinkSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/**
 * Profiles: my settings, my photo, and the public view of anyone's profile for a given viewer.
 * Identity (name, role) comes from the account; the profile only adds what the owner wrote.
 */
@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(CommsDirectory) private readonly directory: CommsDirectory,
    @Inject(RealtimeHub) private readonly hub: RealtimeHub,
    @Inject(ProgressService) private readonly progress: ProgressService,
  ) {}

  // ---------- who ----------

  /** The signed-in person (staff of any role, or a learner) from the Cookie header. */
  async fromCookieHeader(header: string | undefined): Promise<ProfilePerson | null> {
    const staff = await staffFromCookie(this.identity, this.prisma, readCookie(header, STAFF_COOKIE));
    if (staff) return { key: `staff:${staff.slug}`, name: staff.name, role: staff.role, userId: null, guest: false };
    const learner = await this.identity.learnerFromCookie(readCookie(header, SESSION_COOKIE));
    return learner ? { key: `user:${learner.id}`, name: learner.displayName, role: 'LEARNER', userId: learner.id, guest: learner.kind === 'GUEST' } : null;
  }

  /** Anyone by participant key (null for unknown keys and for guests, who have no public profile). */
  async person(key: string): Promise<ProfilePerson | null> {
    if (key.startsWith('user:')) {
      const user = await this.prisma.user.findUnique({ where: { id: key.slice(5) }, select: { id: true, kind: true, displayName: true } });
      return user && user.kind !== 'GUEST' ? { key, name: user.displayName, role: 'LEARNER', userId: user.id, guest: false } : null;
    }
    if (key.startsWith('staff:acct:')) {
      const staff = await staffFromAccount(this.prisma, key.slice('staff:acct:'.length));
      return staff ? { key, name: staff.name, role: staff.role, userId: null, guest: false } : null;
    }
    if (key.startsWith('staff:')) {
      const staff = findStaff(key.slice(6));
      return staff ? { key, name: staff.name, role: staff.role, userId: null, guest: false } : null;
    }
    return null;
  }

  // ---------- my profile ----------

  async mine(me: ProfilePerson): Promise<MyProfile> {
    this.assertOwner(me);
    const row = await this.prisma.profile.findUnique({ where: { participantKey: me.key }, select: profileSelect });
    if (row) return this.toMine(me, row, true);
    const handle = await this.freeHandle(suggestHandle(me.name), me.key);
    return {
      key: me.key,
      name: me.name,
      role: me.role,
      avatarUrl: null,
      saved: false,
      handle,
      headline: '',
      bio: '',
      city: '',
      languages: [],
      interests: [],
      links: [],
      subject: me.role === 'TEACHER' ? (findStaff(me.key.slice(6))?.title ?? '') : '',
      experienceYears: null,
      officeHours: '',
      cover: 'aurora',
      accent: 'mint',
      visibility: DEFAULT_VISIBILITY,
      showOnline: true,
    };
  }

  async save(me: ProfilePerson, settings: ProfileSettings): Promise<MyProfile> {
    this.assertOwner(me);
    const owner = await this.prisma.profile.findUnique({ where: { handle: settings.handle }, select: { participantKey: true } });
    if (owner && owner.participantKey !== me.key) throw new ConflictException({ code: 'HANDLE_TAKEN', message: 'This handle is taken' });
    // Fields that do not apply to the role are stored empty.
    const teacher = me.role === 'TEACHER';
    const data = {
      handle: settings.handle,
      headline: settings.headline,
      bio: settings.bio,
      city: settings.city,
      languages: [...new Set(settings.languages)],
      interests: [...new Set(settings.interests)],
      links: settings.links,
      subject: teacher ? settings.subject : '',
      experienceYears: teacher ? settings.experienceYears : null,
      officeHours: teacher ? settings.officeHours : '',
      cover: settings.cover,
      accent: settings.accent,
      visibility: settings.visibility,
      showOnline: settings.showOnline,
    };
    const row = await this.prisma.profile.upsert({ where: { participantKey: me.key }, create: { participantKey: me.key, ...data }, update: data, select: profileSelect });
    return this.toMine(me, row, true);
  }

  async handleAvailable(me: ProfilePerson, handle: string): Promise<boolean> {
    const owner = await this.prisma.profile.findUnique({ where: { handle }, select: { participantKey: true } });
    return !owner || owner.participantKey === me.key;
  }

  /** Saves the cropped photo; the profile is created with defaults if it does not exist yet. */
  async setAvatar(me: ProfilePerson, file: { buffer: Buffer; mimetype: string; size: number } | undefined): Promise<MyProfile> {
    this.assertOwner(me);
    if (!file || file.size === 0) throw new BadRequestException({ code: 'AVATAR_MISSING', message: 'Attach the photo as "image"' });
    if (file.size > PROFILE_AVATAR_MAX_BYTES) throw new BadRequestException({ code: 'AVATAR_TOO_LARGE', message: 'Photos are at most 1 MB' });
    if (!IMAGE_TYPES.has(file.mimetype) || !looksLikeImage(file.buffer)) throw new BadRequestException({ code: 'AVATAR_FORMAT', message: 'Use a WebP, JPEG or PNG image' });
    await this.ensureProfile(me);
    const data = Uint8Array.from(file.buffer);
    await this.prisma.profileAvatar.upsert({
      where: { participantKey: me.key },
      create: { participantKey: me.key, mimeType: file.mimetype, data },
      update: { mimeType: file.mimetype, data },
    });
    return this.mine(me);
  }

  async removeAvatar(me: ProfilePerson): Promise<MyProfile> {
    this.assertOwner(me);
    await this.prisma.profileAvatar.deleteMany({ where: { participantKey: me.key } });
    return this.mine(me);
  }

  /** Photos are part of identity: any signed-in person may load them. */
  async avatar(key: string): Promise<{ mimeType: string; data: Uint8Array }> {
    const row = await this.prisma.profileAvatar.findUnique({ where: { participantKey: key }, select: { mimeType: true, data: true } });
    if (!row) throw new NotFoundException({ code: 'AVATAR_NOT_FOUND', message: 'No photo' });
    return row;
  }

  // ---------- public view ----------

  /** Someone's profile as `viewer` may see it. `ref` is a handle or a participant key. */
  async view(viewer: ProfilePerson, ref: string): Promise<PublicProfile> {
    const byHandle = ref.includes(':') ? null : await this.prisma.profile.findUnique({ where: { handle: ref.toLowerCase() }, select: profileSelect });
    const key = byHandle?.participantKey ?? (ref.includes(':') ? ref : null);
    const owner = key ? await this.person(key) : null;
    if (!owner) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Profile not found' });
    const row = byHandle ?? (await this.prisma.profile.findUnique({ where: { participantKey: owner.key }, select: profileSelect }));

    const relation = await this.relation(viewer, owner);
    const visibility = row ? readVisibility(row.visibility) : DEFAULT_VISIBILITY;
    const show = (block: keyof ProfileVisibility) => canSee(visibility[block], relation);
    // Privacy: centers see group totals and participation only, never a learner's results.
    const centerViewer = viewer.role === 'ADMIN' || viewer.role === 'COORDINATOR';
    const groups = owner.role === 'LEARNER' || owner.role === 'TEACHER' ? await this.directory.rosterGroupsOf(asParticipant(owner)) : [];

    return {
      key: owner.key,
      handle: row?.handle ?? null,
      name: owner.name,
      role: owner.role,
      avatarUrl: row?.avatar ? avatarUrl(owner.key, row.avatar.updatedAt) : null,
      cover: (row?.cover as PublicProfile['cover']) ?? 'aurora',
      accent: (row?.accent as PublicProfile['accent']) ?? 'mint',
      headline: row?.headline ?? '',
      about: row && show('about') ? { bio: row.bio, city: row.city, languages: row.languages as Locale[], interests: row.interests } : null,
      links: row && show('links') ? readLinks(row.links) : null,
      learning: owner.role === 'LEARNER' && owner.userId && show('learning') && (!centerViewer || relation === 'me') ? await this.learning(owner) : null,
      teaching: owner.role === 'TEACHER' && show('teaching') ? { subject: row?.subject || (findStaff(owner.key.slice(6))?.title ?? ''), experienceYears: row?.experienceYears ?? null, officeHours: row?.officeHours ?? '' } : null,
      groups: groups.length && show('groups') ? groups.map((g) => g.code) : null,
      online: (row?.showOnline ?? true) || relation === 'me' ? this.hub.isOnline(owner.key) : null,
      relation,
      canMessage: relation !== 'me' && (viewer.role === 'LEARNER' || viewer.role === 'TEACHER') && !viewer.guest && (await this.directory.contactsOf(asParticipant(viewer))).has(owner.key),
    };
  }

  /** "group" when viewer and owner share a class group (as teacher or learner). */
  private async relation(viewer: ProfilePerson, owner: ProfilePerson): Promise<Relation> {
    if (viewer.key === owner.key) return 'me';
    if (owner.role !== 'LEARNER' && owner.role !== 'TEACHER') return 'other';
    const groups = await this.directory.rosterGroupsOf(asParticipant(owner));
    return groups.some((g) => g.teacher?.key === viewer.key || g.learners.some((l) => l.key === viewer.key)) ? 'group' : 'other';
  }

  private async learning(owner: ProfilePerson): Promise<PublicProfile['learning']> {
    try {
      const stats = await this.progress.stats({ id: owner.userId!, kind: 'DEMO', displayName: owner.name, demoSlug: null }, PROFILE_SUBJECT);
      return { level: stats.level, xp: stats.xp, levelStart: stats.levelStart, levelEnd: stats.levelEnd, streakDays: stats.streakDays, badges: stats.badges.filter((b) => b.earned).map((b) => b.code) };
    } catch {
      return null; // subject not published: no learning block
    }
  }

  // ---------- helpers ----------

  private assertOwner(me: ProfilePerson) {
    if (me.guest) throw new ForbiddenException({ code: 'PROFILE_NOT_AVAILABLE', message: 'Guests have no profile; choose a demo learner or create an account' });
  }

  private async ensureProfile(me: ProfilePerson) {
    const exists = await this.prisma.profile.findUnique({ where: { participantKey: me.key }, select: { participantKey: true } });
    if (exists) return;
    const handle = await this.freeHandle(suggestHandle(me.name), me.key);
    await this.prisma.profile.create({ data: { participantKey: me.key, handle, languages: [], interests: [], visibility: DEFAULT_VISIBILITY } });
  }

  private async freeHandle(base: string, key: string): Promise<string> {
    const taken = await this.prisma.profile.findMany({ where: { handle: { startsWith: base.slice(0, 18) }, participantKey: { not: key } }, select: { handle: true } });
    return firstFree(base, new Set(taken.map((t) => t.handle)));
  }

  private toMine(me: ProfilePerson, row: ProfileRow, saved: boolean): MyProfile {
    return {
      key: me.key,
      name: me.name,
      role: me.role,
      avatarUrl: row.avatar ? avatarUrl(me.key, row.avatar.updatedAt) : null,
      saved,
      handle: row.handle,
      headline: row.headline,
      bio: row.bio,
      city: row.city,
      languages: row.languages as Locale[],
      interests: row.interests,
      links: readLinks(row.links),
      subject: row.subject,
      experienceYears: row.experienceYears,
      officeHours: row.officeHours,
      cover: row.cover as MyProfile['cover'],
      accent: row.accent as MyProfile['accent'],
      visibility: readVisibility(row.visibility),
      showOnline: row.showOnline,
    };
  }
}

function asParticipant(p: ProfilePerson): CommsParticipant {
  return { key: p.key, name: p.name, role: p.role === 'LEARNER' ? 'LEARNER' : 'TEACHER' };
}

/** Checks the file's magic bytes, so a renamed file of another type is refused. */
export function looksLikeImage(buffer: Buffer): boolean {
  const b = buffer;
  const png = b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const jpeg = b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const webp = b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  return png || jpeg || webp;
}
