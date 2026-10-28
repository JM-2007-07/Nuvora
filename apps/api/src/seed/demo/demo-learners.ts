/**
 * Scripted demo learners (ADR-0006, mvp-scope.md#demo-storyline). Each quiz entry
 * lists, per question in quiz order, whether the scripted answer is correct.
 * The history is replayed through recordAttempt(), the same code path as real
 * submissions, so mastery always follows ADR-0004.
 */
export interface DemoLearnerScript {
  demoSlug: string;
  displayName: string;
  /** Lessons completed before the demo starts. */
  completedLessons: string[];
  /** Attempts in chronological order; daysAgo spreads them over time. */
  attempts: { quiz: string; correct: boolean[]; daysAgo: number }[];
}

export const DEMO_LEARNERS: DemoLearnerScript[] = [
  {
    // Storyline: Variables mastered, Conditions weak (50%), everything else not started.
    demoSlug: 'farzona',
    displayName: 'Farzona',
    completedLessons: ['variables-and-data-types', 'conditions-if-elif-else'],
    attempts: [
      { quiz: 'variables-quiz', correct: [true, true, true, true], daysAgo: 3 },
      { quiz: 'conditions-quiz', correct: [true, false, true, false], daysAgo: 1 },
    ],
  },
  {
    // An advanced learner: most topics mastered, Functions and Lists still developing.
    demoSlug: 'rustam',
    displayName: 'Rustam',
    completedLessons: ['variables-and-data-types', 'conditions-if-elif-else', 'functions-def-and-return', 'loops-for-and-while', 'lists-index-and-loop'],
    attempts: [
      { quiz: 'variables-quiz', correct: [true, true, true, true], daysAgo: 9 },
      { quiz: 'conditions-quiz', correct: [true, true, true, true], daysAgo: 7 },
      { quiz: 'functions-quiz', correct: [true, true, false, true], daysAgo: 5 },
      { quiz: 'loops-quiz', correct: [true, true, true, true], daysAgo: 3 },
      { quiz: 'lists-quiz', correct: [true, false, true, true], daysAgo: 2 },
    ],
  },
];
