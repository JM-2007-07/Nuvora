import { z } from 'zod';
import { BADGE_CODES } from './account-api.js';
import { LocaleSchema } from './content.js';

/**
 * Profiles (Faroz, 2026-10-30, D-25): everyone edits their own profile; others see its public part,
 * block by block, as the owner allowed. Visibility is applied on the server for each viewer.
 * The name comes from the account (no impersonation); learning results never show to centers.
 */

export const PROFILE_VISIBILITY = ['everyone', 'groups', 'me'] as const;
export const VisibilitySchema = z.enum(PROFILE_VISIBILITY);
export type Visibility = z.infer<typeof VisibilitySchema>;

/** Cover gradients and accent colours (Faroz palette presets; CSS classes fz-cover-* / fz-accent-*). */
export const PROFILE_COVERS = ['aurora', 'orbit', 'dusk', 'meadow', 'ember'] as const;
export const PROFILE_ACCENTS = ['mint', 'blue', 'violet', 'gold', 'magenta'] as const;

export const ProfileRoleSchema = z.enum(['LEARNER', 'TEACHER', 'COORDINATOR', 'ADMIN']);
export type ProfileRole = z.infer<typeof ProfileRoleSchema>;

/** 3–24 characters: a-z, 0-9, "." and "_", starting and ending with a letter or digit. */
export const HandleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/, 'Use 3–24 letters, digits, dots or underscores');

export const ProfileLinkSchema = z.strictObject({
  label: z.string().trim().min(1).max(30),
  url: z.url({ protocol: /^https?$/ }).max(200),
});
export type ProfileLink = z.infer<typeof ProfileLinkSchema>;

export const ProfileVisibilitySchema = z.strictObject({
  /** Bio, city, languages, interests */
  about: VisibilitySchema,
  links: VisibilitySchema,
  /** Learners: level, XP, streak, badges (never shown to center staff) */
  learning: VisibilitySchema,
  /** Teachers: subject, experience, office hours */
  teaching: VisibilitySchema,
  /** Group codes */
  groups: VisibilitySchema,
});
export type ProfileVisibility = z.infer<typeof ProfileVisibilitySchema>;

export const DEFAULT_VISIBILITY: ProfileVisibility = { about: 'everyone', links: 'everyone', learning: 'groups', teaching: 'everyone', groups: 'groups' };

/** What the owner edits (PUT /me/profile). */
export const ProfileSettingsSchema = z.strictObject({
  handle: HandleSchema,
  headline: z.string().trim().max(80),
  bio: z.string().trim().max(600),
  city: z.string().trim().max(60),
  languages: z.array(LocaleSchema).max(3),
  interests: z.array(z.string().trim().min(1).max(24)).max(8),
  links: z.array(ProfileLinkSchema).max(4),
  subject: z.string().trim().max(60),
  experienceYears: z.number().int().min(0).max(60).nullable(),
  officeHours: z.string().trim().max(80),
  cover: z.enum(PROFILE_COVERS),
  accent: z.enum(PROFILE_ACCENTS),
  visibility: ProfileVisibilitySchema,
  showOnline: z.boolean(),
});
export type ProfileSettings = z.infer<typeof ProfileSettingsSchema>;

/** GET /me/profile: my settings plus who I am. `saved: false` until the first save (the handle is a suggestion). */
export const MyProfileSchema = ProfileSettingsSchema.extend({
  key: z.string(),
  name: z.string(),
  role: ProfileRoleSchema,
  avatarUrl: z.string().nullable(),
  saved: z.boolean(),
});
export type MyProfile = z.infer<typeof MyProfileSchema>;

export const LearningSummarySchema = z.strictObject({
  level: z.number().int(),
  xp: z.number().int(),
  levelStart: z.number().int(),
  levelEnd: z.number().int(),
  streakDays: z.number().int(),
  badges: z.array(z.enum(BADGE_CODES)),
});

/** GET /profiles/:ref (handle or participant key): only the blocks this viewer may see; others are null. */
export const PublicProfileSchema = z.strictObject({
  key: z.string(),
  handle: z.string().nullable(),
  name: z.string(),
  role: ProfileRoleSchema,
  avatarUrl: z.string().nullable(),
  cover: z.enum(PROFILE_COVERS),
  accent: z.enum(PROFILE_ACCENTS),
  headline: z.string(),
  about: z.strictObject({ bio: z.string(), city: z.string(), languages: z.array(LocaleSchema), interests: z.array(z.string()) }).nullable(),
  links: z.array(ProfileLinkSchema).nullable(),
  learning: LearningSummarySchema.nullable(),
  teaching: z.strictObject({ subject: z.string(), experienceYears: z.number().int().nullable(), officeHours: z.string() }).nullable(),
  groups: z.array(z.string()).nullable(),
  /** null when the owner hides it */
  online: z.boolean().nullable(),
  /** How the viewer relates to the owner */
  relation: z.enum(['me', 'group', 'other']),
  /** The viewer may open a direct chat (teacher ↔ learner of their groups) */
  canMessage: z.boolean(),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

export const PROFILE_AVATAR_MAX_BYTES = 1024 * 1024;

/** How a viewer relates to a profile owner. */
export type ProfileRelation = 'me' | 'group' | 'other';

/**
 * May this viewer see a block with this visibility? (One rule for the API and the editor's preview.)
 * The owner sees everything; "everyone" = anyone signed in; "groups" = people who share a class group.
 */
export function canSeeBlock(level: Visibility, relation: ProfileRelation): boolean {
  if (relation === 'me') return true;
  if (level === 'everyone') return true;
  return level === 'groups' && relation === 'group';
}
