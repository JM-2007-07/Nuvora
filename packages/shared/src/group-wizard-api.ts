import { z } from 'zod';
import { SlugSchema } from './content-api.js';
import { LocaleSchema } from './content.js';

/**
 * Center group wizard (Faroz CGroupCreate, 2026-10-29): details → teacher → students →
 * review. The center admin (or a coordinator allowed to manage groups) creates a group
 * in their own center; the server checks the code, teacher, students and seats.
 */

/** The center's group code, as in the design ("B-18"). */
export const CenterGroupCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]-\d{2}$/, 'Use a letter, a hyphen and two digits, e.g. B-18');

export const GROUP_CAPACITY = { min: 4, max: 40 } as const;

/** GET /center/group-wizard: what the wizard can offer. */
export const GroupWizardOptionsSchema = z.strictObject({
  subjects: z.array(z.strictObject({ slug: z.string(), title: z.string() })),
  /** `available: false` for reference teachers without a workspace (shown, not selectable). */
  teachers: z.array(z.strictObject({ key: z.string(), name: z.string(), subject: z.string(), available: z.boolean(), synthetic: z.boolean() })),
  /** Students of the center who are not in any group yet. */
  students: z.array(z.strictObject({ id: z.string(), name: z.string(), joinedOn: z.string().nullable(), wants: z.string().nullable() })),
  /** Codes already used in this center. */
  takenCodes: z.array(z.string()),
});
export type GroupWizardOptions = z.infer<typeof GroupWizardOptionsSchema>;

/** POST /center/groups */
export const CreateCenterGroupRequestSchema = z
  .strictObject({
    code: CenterGroupCodeSchema,
    subjectSlug: SlugSchema,
    schedule: z.string().trim().min(1).max(80),
    startsOn: z.iso.date(),
    capacity: z.number().int().min(GROUP_CAPACITY.min).max(GROUP_CAPACITY.max),
    languages: z.array(LocaleSchema).min(1).max(3),
    /** Teacher key from the options, or null to assign later. */
    teacherKey: z.string().min(1).max(80).nullable(),
    studentIds: z.array(z.string().min(1).max(40)).max(GROUP_CAPACITY.max),
  })
  .superRefine((r, ctx) => {
    if (new Set(r.studentIds).size !== r.studentIds.length) ctx.addIssue({ code: 'custom', path: ['studentIds'], message: 'A student is listed twice' });
    if (r.studentIds.length > r.capacity) ctx.addIssue({ code: 'custom', path: ['studentIds'], message: 'More students than seats' });
    if (new Set(r.languages).size !== r.languages.length) ctx.addIssue({ code: 'custom', path: ['languages'], message: 'A language is listed twice' });
  });
export type CreateCenterGroupRequest = z.input<typeof CreateCenterGroupRequestSchema>;
