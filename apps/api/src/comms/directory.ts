import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CommsRole } from '@nuvora/shared';
import { IdentityService } from '../identity/identity.service.js';
import { readCookie, SESSION_COOKIE } from '../identity/session-cookie.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEMO_GROUPS, type DemoStaff, findStaff } from '../staff/demo-org.js';
import { STAFF_COOKIE, staffFromCookie } from '../staff/staff.guard.js';

/** Who is talking: a learner ("user:<id>") or a teacher ("staff:<slug>"). */
export interface CommsParticipant {
  key: string;
  name: string;
  role: CommsRole;
}

/** A group as the comms module sees it: who teaches it and who is in it. */
export interface CommsGroup {
  /** Conversation key: "group:demo:<code>" or "group:db:<id>" */
  key: string;
  code: string;
  name: string;
  teacher: CommsParticipant | null;
  learners: CommsParticipant[];
}

export const userKey = (id: string) => `user:${id}`;
export const staffKey = (slug: string) => `staff:${slug}`;

/** Direct conversation key: both participant keys, sorted, so either side finds the same one. */
export function directKey(a: string, b: string): string {
  return `dm:${[a, b].sort().join('|')}`;
}

/** The two participant keys of a direct conversation key, or null for other keys. */
export function directMembers(key: string): [string, string] | null {
  if (!key.startsWith('dm:')) return null;
  const parts = key.slice(3).split('|');
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

/** People I may contact: a teacher reaches the learners of their groups; a learner reaches their teachers. */
export function contactsFrom(me: CommsParticipant, groups: CommsGroup[]): Map<string, CommsParticipant & { groups: string[] }> {
  const out = new Map<string, CommsParticipant & { groups: string[] }>();
  for (const g of groups) {
    const people = me.role === 'TEACHER' ? g.learners : g.teacher ? [g.teacher] : [];
    for (const p of people) {
      if (p.key === me.key) continue;
      const known = out.get(p.key);
      if (known) known.groups.push(g.code);
      else out.set(p.key, { ...p, groups: [g.code] });
    }
  }
  return out;
}

/**
 * Comms directory: resolves the participant from the session (cookie on the web, token on mobile)
 * and derives groups and contacts from the live rosters (demo groups in code and groups in the
 * database). Nothing about who may talk to whom is stored.
 */
@Injectable()
export class CommsDirectory {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** From a Cookie header (web). Staff wins if both cookies are present, like the rest of the API. */
  async fromCookieHeader(header: string | undefined): Promise<CommsParticipant | null> {
    const staff = await staffFromCookie(this.identity, this.prisma, readCookie(header, STAFF_COOKIE));
    if (staff) return this.fromStaff(staff);
    return this.fromLearnerValue(readCookie(header, SESSION_COOKIE));
  }

  /** From a signed session value sent as a token (mobile app): the same value the cookie holds. */
  async fromToken(token: string | undefined): Promise<CommsParticipant | null> {
    const staff = await staffFromCookie(this.identity, this.prisma, token);
    if (staff) return this.fromStaff(staff);
    return this.fromLearnerValue(token);
  }

  private async fromLearnerValue(value: string | undefined): Promise<CommsParticipant | null> {
    const learner = await this.identity.learnerFromCookie(value);
    return learner ? { key: userKey(learner.id), name: learner.displayName, role: 'LEARNER' } : null;
  }

  private fromStaff(staff: DemoStaff): CommsParticipant {
    // Privacy: centers (admins, coordinators) never read teacher–learner conversations.
    if (staff.role !== 'TEACHER') throw new ForbiddenException({ code: 'COMMS_NOT_AVAILABLE', message: 'Communications are for teachers and learners' });
    return { key: staffKey(staff.slug), name: staff.name, role: 'TEACHER' };
  }

  /** People I may contact directly (from my class rosters, not from chat membership changes). */
  async contactsOf(me: CommsParticipant) {
    return contactsFrom(me, await this.rosterGroupsOf(me));
  }

  /**
   * My group chats: my class groups with the teacher's membership changes applied (people added,
   * roster members taken out), plus custom group chats I was added to or created.
   */
  async groupsOf(me: CommsParticipant): Promise<CommsGroup[]> {
    const roster = await this.rosterGroupsOf(me);
    const mine = await this.prisma.conversationMember.findMany({ where: { participantKey: me.key }, select: { removed: true, conversation: { select: { key: true } } } });
    const removed = new Set(mine.filter((m) => m.removed).map((m) => m.conversation.key));
    const created = me.role === 'TEACHER' ? await this.prisma.conversation.findMany({ where: { createdByKey: me.key, key: { startsWith: 'group:custom:' } }, select: { key: true } }) : [];
    const extraKeys = [...new Set([...mine.filter((m) => !m.removed).map((m) => m.conversation.key), ...created.map((c) => c.key)])].filter((k) => !roster.some((g) => g.key === k));
    const extra = (await Promise.all(extraKeys.map((k) => this.baseGroup(k)))).filter((g): g is CommsGroup => !!g);
    // A teacher is never taken out of their own group.
    const visible = roster.filter((g) => !removed.has(g.key) || g.teacher?.key === me.key);
    return this.withChanges([...visible, ...extra]);
  }

  /** Applies a group chat's membership changes (conversation_members) to its base roster. */
  private async withChanges(groups: CommsGroup[]): Promise<CommsGroup[]> {
    if (!groups.length) return groups;
    const rows = await this.prisma.conversation.findMany({ where: { key: { in: groups.map((g) => g.key) } }, select: { key: true, members: { select: { participantKey: true, removed: true } } } });
    const changes = new Map(rows.map((r) => [r.key, r.members]));
    const addedKeys = [...new Set(rows.flatMap((r) => r.members.filter((m) => !m.removed).map((m) => m.participantKey)))];
    const people = new Map((await Promise.all(addedKeys.map((k) => this.describe(k)))).filter((p): p is CommsParticipant => !!p).map((p) => [p.key, p]));
    return groups.map((g) => {
      const list = changes.get(g.key) ?? [];
      const out = new Set(list.filter((m) => m.removed).map((m) => m.participantKey));
      const present = new Set(g.learners.map((l) => l.key));
      const added = list
        .filter((m) => !m.removed && !present.has(m.participantKey) && m.participantKey !== g.teacher?.key)
        .map((m) => people.get(m.participantKey))
        .filter((p): p is CommsParticipant => !!p && p.role === 'LEARNER');
      return { ...g, learners: [...g.learners.filter((l) => !out.has(l.key)), ...added] };
    });
  }

  /** My class groups as rosters say (demo groups in code, study groups in the database). */
  async rosterGroupsOf(me: CommsParticipant): Promise<CommsGroup[]> {
    if (me.role === 'TEACHER') {
      const slug = me.key.slice('staff:'.length);
      const accountId = slug.startsWith('acct:') ? slug.slice(5) : null;
      const demo = DEMO_GROUPS.filter((g) => g.teacher === slug && g.roster);
      const db = await this.prisma.studyGroup.findMany({
        where: { OR: [{ teacherKey: slug }, ...(accountId ? [{ teacherAccountId: accountId }] : [])] },
        select: dbGroupSelect,
        orderBy: { createdAt: 'asc' },
      });
      return [...(await this.demoGroups(demo)), ...db.map(toGroup)];
    }
    const userId = me.key.slice('user:'.length);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { demoSlug: true } });
    const demo = user?.demoSlug ? DEMO_GROUPS.filter((g) => g.roster?.includes(user.demoSlug!)) : [];
    const db = await this.prisma.studyGroup.findMany({ where: { members: { some: { userId } } }, select: dbGroupSelect, orderBy: { createdAt: 'asc' } });
    return [...(await this.demoGroups(demo)), ...db.map(toGroup)];
  }

  private async demoGroups(groups: typeof DEMO_GROUPS): Promise<CommsGroup[]> {
    const slugs = groups.flatMap((g) => g.roster ?? []);
    const users = slugs.length ? await this.prisma.user.findMany({ where: { demoSlug: { in: slugs } }, select: { id: true, displayName: true, demoSlug: true } }) : [];
    return groups.map((g) => {
      const teacher = findStaff(g.teacher);
      return {
        key: `group:demo:${g.code}`,
        code: g.code,
        name: g.name,
        teacher: teacher ? { key: staffKey(teacher.slug), name: teacher.name, role: 'TEACHER' as const } : null,
        learners: users.filter((u) => g.roster?.includes(u.demoSlug ?? '')).map((u) => ({ key: userKey(u.id), name: u.displayName, role: 'LEARNER' as const })),
      };
    });
  }

  /** Everyone who belongs to a conversation key (for delivery), or null when the key is unknown. */
  async membersOf(key: string): Promise<CommsParticipant[] | null> {
    const pair = directMembers(key);
    if (pair) {
      const people = await Promise.all(pair.map((k) => this.describe(k)));
      return people.every(Boolean) ? (people as CommsParticipant[]) : null;
    }
    const group = await this.groupByKey(key);
    return group ? [...(group.teacher ? [group.teacher] : []), ...group.learners] : null;
  }

  /** A group chat by key, with its membership changes applied. */
  async groupByKey(key: string): Promise<CommsGroup | null> {
    const base = await this.baseGroup(key);
    return base ? (await this.withChanges([base]))[0] : null;
  }

  /** A group as its roster says; a custom group chat has only its creator here (members come from changes). */
  private async baseGroup(key: string): Promise<CommsGroup | null> {
    if (key.startsWith('group:custom:')) {
      const row = await this.prisma.conversation.findUnique({ where: { key }, select: { title: true, createdByKey: true } });
      const teacher = row?.createdByKey ? await this.describe(row.createdByKey) : null;
      if (!row || !teacher) return null;
      const name = row.title ?? '';
      return { key, code: initials(name), name, teacher, learners: [] };
    }
    if (key.startsWith('group:demo:')) {
      const g = DEMO_GROUPS.find((d) => d.code === key.slice('group:demo:'.length) && d.roster);
      return g ? (await this.demoGroups([g]))[0] : null;
    }
    if (key.startsWith('group:db:')) {
      const row = await this.prisma.studyGroup.findUnique({ where: { id: key.slice('group:db:'.length) }, select: dbGroupSelect });
      return row ? toGroup(row) : null;
    }
    return null;
  }

  /** Name and role for a participant key. */
  async describe(key: string): Promise<CommsParticipant | null> {
    if (key.startsWith('user:')) {
      const user = await this.prisma.user.findUnique({ where: { id: key.slice(5) }, select: { displayName: true } });
      return user ? { key, name: user.displayName, role: 'LEARNER' } : null;
    }
    if (key.startsWith('staff:acct:')) {
      const account = await this.prisma.account.findUnique({ where: { id: key.slice('staff:acct:'.length) }, select: { name: true, role: true } });
      return account?.role === 'TEACHER' ? { key, name: account.name, role: 'TEACHER' } : null;
    }
    if (key.startsWith('staff:')) {
      const staff = findStaff(key.slice(6));
      return staff?.role === 'TEACHER' ? { key, name: staff.name, role: 'TEACHER' } : null;
    }
    return null;
  }

  /** May `me` read and write the conversation with this key? */
  async canAccess(me: CommsParticipant, key: string): Promise<boolean> {
    const pair = directMembers(key);
    if (pair) {
      if (!pair.includes(me.key)) return false;
      const other = pair[0] === me.key ? pair[1] : pair[0];
      return (await this.contactsOf(me)).has(other);
    }
    return (await this.groupsOf(me)).some((g) => g.key === key);
  }
}

/** Badge text for a custom group chat ("JS Club" → "JC"). */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '#'
  );
}

const dbGroupSelect = {
  id: true,
  name: true,
  displayCode: true,
  joinCode: true,
  teacherKey: true,
  teacherName: true,
  teacherAccountId: true,
  teacher: { select: { name: true } },
  members: { select: { user: { select: { id: true, displayName: true } } }, orderBy: { joinedAt: 'asc' as const } },
} as const;

type DbGroup = {
  id: string;
  name: string;
  displayCode: string | null;
  joinCode: string;
  teacherKey: string | null;
  teacherName: string | null;
  teacherAccountId: string | null;
  teacher: { name: string } | null;
  members: { user: { id: string; displayName: string } }[];
};

function toGroup(row: DbGroup): CommsGroup {
  const slug = row.teacherKey ?? (row.teacherAccountId ? `acct:${row.teacherAccountId}` : null);
  const teacherName = row.teacher?.name ?? row.teacherName ?? (slug ? findStaff(slug)?.name : null) ?? null;
  return {
    key: `group:db:${row.id}`,
    code: row.displayCode ?? row.joinCode,
    name: row.name,
    teacher: slug && teacherName ? { key: staffKey(slug), name: teacherName, role: 'TEACHER' } : null,
    learners: row.members.map((m) => ({ key: userKey(m.user.id), name: m.user.displayName, role: 'LEARNER' as const })),
  };
}
