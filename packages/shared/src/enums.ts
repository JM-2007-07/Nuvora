/**
 * Domain enums shared by the API, the web app, and the seed content.
 * They must match the Prisma enums in apps/api/prisma/schema.prisma
 * (a test in apps/api checks this).
 */
export const USER_KINDS = ['DEMO', 'GUEST'] as const;
export type UserKind = (typeof USER_KINDS)[number];

export const QUIZ_KINDS = ['TOPIC', 'CHECKPOINT'] as const;
export type QuizKind = (typeof QUIZ_KINDS)[number];

/** MVP supports single-choice only (multi-select etc. are Later). */
export const QUESTION_TYPES = ['SINGLE_CHOICE'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const RESOURCE_TYPES = ['BOOK', 'ARTICLE', 'VIDEO', 'EXERCISE'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** ADR-0004: NOT_STARTED, WEAK (< 60%), DEVELOPING (60–79%), MASTERED (≥ 80%). */
export const MASTERY_STATUSES = ['NOT_STARTED', 'WEAK', 'DEVELOPING', 'MASTERED'] as const;
export type MasteryStatus = (typeof MASTERY_STATUSES)[number];
