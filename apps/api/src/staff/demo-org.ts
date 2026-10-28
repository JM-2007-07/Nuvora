import type { StaffRole } from '@nuvora/shared';
import { B12_DIAGNOSTIC_QUIZ, B12_STUDENTS } from '../seed/demo/b12-cohort.js';

/**
 * Faroz Demo Center: staff and groups, defined in code (owner decision 2026-10-28:
 * no migration for teacher/center data). Names, groups and reference figures come
 * from the handoff (design/data/demo-center.json and HANDOFF.md §6); nothing is invented.
 *
 * Only B-12 has a roster of real demo learners whose attempts are stored in the
 * database (seed/demo/b12-cohort.ts). Its numbers are always computed from those
 * attempts. The other groups have no student records here: their figures are the
 * handoff's reference values and the UI labels them that way.
 */

export interface DemoStaff {
  slug: string;
  name: string;
  role: StaffRole;
  title: string;
  /** Group codes this teacher teaches (teachers only). */
  groups: string[];
}

export interface DemoGroup {
  code: string;
  name: string;
  teacher: string;
  status: 'active' | 'upcoming' | 'archived';
  schedule: string;
  /** Learner demoSlugs of the roster when it exists in the database, else null. */
  roster: string[] | null;
  diagnosticQuiz: string | null;
  /** Seats (handoff `cap`). */
  capacity: number;
  /** Handoff reference values for groups without stored attempts (`answers`: correct of total on the diagnostic). */
  reference: { students: number; submitted: number; topics: number[] | null; answers?: { ok: number; of: number } } | null;
  /** The handoff marks this record as synthetic. */
  synthetic: boolean;
}

export const DEMO_STAFF: DemoStaff[] = [
  { slug: 'dilshod-karimov', name: 'Dilshod Karimov', role: 'TEACHER', title: 'JavaScript', groups: ['B-12', 'B-14', 'B-16'] },
  { slug: 'komila-rasulova', name: 'Komila Rasulova', role: 'COORDINATOR', title: 'All subjects', groups: [] },
  { slug: 'farhod-jalilov', name: 'Farhod Jalilov', role: 'ADMIN', title: 'Faroz Demo Center', groups: [] },
];

/** demo-center.json topics order: Variables, Conditions, Functions, Arrays, Objects. */
export const REFERENCE_TOPIC_TITLES = ['Variables', 'Conditions', 'Functions', 'Arrays', 'Objects'];

export const DEMO_GROUPS: DemoGroup[] = [
  {
    code: 'B-12',
    capacity: 28,
    name: 'JavaScript Fundamentals',
    teacher: 'dilshod-karimov',
    status: 'active',
    schedule: 'Mon, Wed, Fri · 16:00',
    roster: B12_STUDENTS.map((s) => s.slug),
    diagnosticQuiz: B12_DIAGNOSTIC_QUIZ,
    reference: null,
    synthetic: false,
  },
  {
    code: 'B-14',
    capacity: 24,
    name: 'JavaScript Fundamentals',
    teacher: 'dilshod-karimov',
    status: 'active',
    schedule: 'Tue, Thu · 18:00',
    roster: null,
    diagnosticQuiz: null,
    reference: { students: 22, submitted: 21, topics: [88, 76, 64, 52, 70], answers: { ok: 296, of: 420 } },
    synthetic: false,
  },
  {
    code: 'C-02',
    capacity: 22,
    name: 'JavaScript Fundamentals',
    teacher: 'mavluda-sharifova',
    status: 'active',
    schedule: 'Mon, Thu · 10:00',
    roster: null,
    diagnosticQuiz: null,
    reference: { students: 20, submitted: 19, topics: [95, 85, 72, 49, 68], answers: { ok: 284, of: 380 } },
    synthetic: true,
  },
  {
    code: 'A-05',
    capacity: 20,
    name: 'Algebra I',
    teacher: 'nodira-alieva',
    status: 'active',
    schedule: 'Tue, Sat · 14:00',
    roster: null,
    diagnosticQuiz: null,
    reference: { students: 18, submitted: 18, topics: null },
    synthetic: true,
  },
  {
    code: 'B-16',
    capacity: 20,
    name: 'Web Basics',
    teacher: 'dilshod-karimov',
    status: 'upcoming',
    schedule: 'Mon, Wed · 14:00',
    roster: [],
    diagnosticQuiz: null,
    reference: null,
    synthetic: false,
  },
  {
    code: 'B-09',
    capacity: 24,
    name: 'JavaScript Fundamentals',
    teacher: 'dilshod-karimov',
    status: 'archived',
    schedule: 'Feb 2 – May 29, 2026',
    roster: null,
    diagnosticQuiz: null,
    reference: { students: 19, submitted: 19, topics: null },
    synthetic: false,
  },
];

export const findStaff = (slug: string) => DEMO_STAFF.find((s) => s.slug === slug);
export const findGroup = (code: string) => DEMO_GROUPS.find((g) => g.code === code);

/** Center staff directory (handoff demo-center.json `teachers`), shown to center staff. */
export const STAFF_DIRECTORY = [
  { name: 'Dilshod Karimov', role: 'TEACHER', subject: 'JavaScript', status: 'active', note: 'Last active Oct 14', synthetic: false },
  { name: 'Mavluda Sharifova', role: 'TEACHER', subject: 'JavaScript', status: 'active', note: 'Last active Oct 13', synthetic: true },
  { name: 'Nodira Alieva', role: 'TEACHER', subject: 'Algebra', status: 'active', note: 'Last active Oct 12', synthetic: true },
  { name: 'Komila Rasulova', role: 'COORDINATOR', subject: 'All subjects', status: 'active', note: 'Last active Oct 14', synthetic: true },
  { name: 'Bakhtiyor Nazriev', role: 'TEACHER', subject: 'Python', status: 'pending', note: 'Invited Oct 12 · expires Oct 19', synthetic: true },
  { name: 'Shirin Ahmedova', role: 'TEACHER', subject: 'Web basics', status: 'expired', note: 'Invited Sep 28 · expired Oct 5', synthetic: true },
] as const;

/** Teacher names by staff slug, incl. teachers who only exist in the directory. */
export const TEACHER_NAMES: Record<string, string> = {
  'dilshod-karimov': 'Dilshod Karimov',
  'mavluda-sharifova': 'Mavluda Sharifova',
  'nodira-alieva': 'Nodira Alieva',
};

/** Coordinator permissions set by the admin (handoff permissionDefaults). Not editable in this demo (no storage). */
export const PERMISSION_DEFAULTS = { coordGroups: true, coordStaff: true, teachCreate: true, teachShare: false } as const;
