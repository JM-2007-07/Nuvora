import {
  LOCALES,
  MASTERY_STATUSES,
  QUESTION_TYPES,
  QUIZ_KINDS,
  RESOURCE_TYPES,
  USER_KINDS,
} from '@nuvora/shared';
import {
  Locale,
  MasteryStatus,
  QuestionType,
  QuizKind,
  ResourceType,
  UserKind,
} from '../generated/prisma/enums.js';

// The Prisma schema and packages/shared must never drift apart.
describe('Prisma enums match the shared enums', () => {
  it.each([
    ['Locale', Locale, LOCALES],
    ['UserKind', UserKind, USER_KINDS],
    ['QuizKind', QuizKind, QUIZ_KINDS],
    ['QuestionType', QuestionType, QUESTION_TYPES],
    ['ResourceType', ResourceType, RESOURCE_TYPES],
    ['MasteryStatus', MasteryStatus, MASTERY_STATUSES],
  ] as const)('%s', (_name, prismaEnum, sharedValues) => {
    expect(Object.values(prismaEnum).sort()).toEqual([...sharedValues].sort());
  });
});
