import type { CenterGroup } from '@nuvora/shared';
import { percent } from '../quizzes/scoring.js';
import { type DemoGroup, REFERENCE_TOPIC_TITLES, TEACHER_NAMES } from '../staff/demo-org.js';

/**
 * Center views (handoff §7 privacy): only group totals and participation leave this file.
 * Input aggregates are computed elsewhere from stored attempts; nothing per student is
 * accepted here, so nothing per student can be returned.
 */
/**
 * Privacy threshold: below this many submitted learners a group's percentages could reveal
 * one person's result (with one submitter the "group average" is that learner's score), so the
 * center gets participation only. Teachers still see everything for their own groups.
 */
export const MIN_SUBMITTED_FOR_TOTALS = 5;

/** Center-safe totals: null percentages when too few learners submitted. */
export function centerSafeTotals<T extends { submitted: number; diagnosticPercent: number | null }>(view: T): T {
  return view.submitted < MIN_SUBMITTED_FOR_TOTALS ? { ...view, diagnosticPercent: null } : view;
}

export interface GroupAggregate {
  students: number;
  submitted: number;
  answers: { ok: number; of: number };
  topics: { title: string; percent: number }[];
}

/**
 * @param topicTitles localized topic titles in subject order, used to name reference figures so
 *   they line up with recorded groups (the handoff stores them in the same order)
 */
export function toCenterGroup(group: DemoGroup, recorded: GroupAggregate | null, topicTitles: string[] = REFERENCE_TOPIC_TITLES): CenterGroup {
  const reference = group.reference;
  const students = recorded?.students ?? reference?.students ?? group.roster?.length ?? 0;
  const submitted = recorded?.submitted ?? reference?.submitted ?? 0;
  const answers = recorded?.answers ?? reference?.answers ?? null;
  const topics = recorded?.topics ?? (reference?.topics ? reference.topics.map((p, i) => ({ title: topicTitles[i] ?? REFERENCE_TOPIC_TITLES[i], percent: p })) : null);
  // Recorded groups with too few submissions keep their counts but lose percentages (privacy threshold).
  const tooFew = recorded !== null && submitted < MIN_SUBMITTED_FOR_TOTALS;
  const shownTopics = tooFew ? null : topics;
  const shownAnswers = tooFew ? null : answers;
  const active = group.status === 'active';
  const participationPercent = active && students > 0 ? percent(submitted, students) : null;

  const flags: CenterGroup['flags'] = [];
  if (active && shownTopics?.some((t) => t.percent < 60)) flags.push('TOPIC_UNDER_60');
  if (active && participationPercent !== null && participationPercent < 95) flags.push('PARTICIPATION_UNDER_95');
  if (group.status === 'upcoming' && students === 0) flags.push('SETUP_INCOMPLETE');

  return {
    code: group.code,
    name: group.name,
    teacher: TEACHER_NAMES[group.teacher] ?? group.teacher,
    status: group.status,
    schedule: group.schedule,
    capacity: group.capacity,
    students,
    submitted,
    participationPercent,
    diagnosticPercent: shownAnswers ? percent(shownAnswers.ok, shownAnswers.of) : null,
    topics: shownTopics,
    flags,
    recorded: recorded !== null,
    synthetic: group.synthetic,
  };
}
