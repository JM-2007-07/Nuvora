import type { CompleteLocalizedText, Locale, QuestionType, QuizKind, ResourceType } from '@nuvora/shared';

/**
 * Seed loader types (G3.1). The loader reads a snapshot of the content tables,
 * plans create/update operations against it (pure), then applies them through a
 * SeedWriter inside one transaction. The writer has NO delete operations: the
 * loader never deletes content (deletion policy, data-model.md).
 */

// ---------- Data written per entity (scalar fields only; ids resolved separately) ----------

export interface SubjectData { title: CompleteLocalizedText; description: CompleteLocalizedText; order: number }
export interface TopicData { title: CompleteLocalizedText; summary: CompleteLocalizedText; order: number; mapX: number; mapY: number }
export interface LessonData { title: CompleteLocalizedText; body: CompleteLocalizedText; estimatedMinutes: number; order: number }
export interface ResourceData {
  type: ResourceType;
  title: CompleteLocalizedText;
  author: string;
  url: string | null;
  languages: Locale[];
  whyUseful: CompleteLocalizedText;
  order: number;
}
export interface QuizData { title: CompleteLocalizedText; kind: QuizKind }
export interface QuestionData { type: QuestionType; prompt: CompleteLocalizedText; explanation: CompleteLocalizedText; order: number }
export interface OptionData { text: CompleteLocalizedText; isCorrect: boolean; order: number }

// ---------- Snapshot of what is already in the database ----------

/** Json columns are read back as unknown and compared structurally. */
type Stored<T> = { [K in keyof T]: T[K] extends CompleteLocalizedText ? unknown : T[K] };

export type SnapshotSubject = { id: string; slug: string } & Stored<SubjectData>;
export type SnapshotTopic = { id: string; slug: string; subjectId: string } & Stored<TopicData>;
export interface SnapshotPrerequisite { topicId: string; prerequisiteId: string }
export type SnapshotLesson = { id: string; slug: string; topicId: string } & Stored<LessonData>;
export type SnapshotResource = { id: string; topicId: string; key: string } & Stored<ResourceData>;
export type SnapshotQuiz = { id: string; slug: string; subjectId: string; topicId: string | null } & Stored<QuizData>;
/** `answerCount` = recorded learner answers; > 0 means the question's meaning is frozen. */
export type SnapshotQuestion = { id: string; quizId: string; topicId: string; key: string; answerCount: number } & Stored<QuestionData>;
/** `selectedCount` = recorded answers that chose this option. */
export type SnapshotOption = { id: string; questionId: string; key: string; selectedCount: number } & Stored<OptionData>;

export interface ContentSnapshot {
  subjects: SnapshotSubject[];
  topics: SnapshotTopic[];
  prerequisites: SnapshotPrerequisite[];
  lessons: SnapshotLesson[];
  resources: SnapshotResource[];
  quizzes: SnapshotQuiz[];
  questions: SnapshotQuestion[];
  options: SnapshotOption[];
}

export function emptySnapshot(): ContentSnapshot {
  return { subjects: [], topics: [], prerequisites: [], lessons: [], resources: [], quizzes: [], questions: [], options: [] };
}

// ---------- Storage ports ----------

/** Create/update only. There is deliberately no delete. */
export interface SeedWriter {
  createSubject(input: { slug: string } & SubjectData): Promise<string>;
  updateSubject(id: string, data: SubjectData): Promise<void>;
  createTopic(input: { slug: string; subjectId: string } & TopicData): Promise<string>;
  updateTopic(id: string, data: TopicData): Promise<void>;
  createPrerequisite(input: SnapshotPrerequisite): Promise<void>;
  createLesson(input: { slug: string; topicId: string } & LessonData): Promise<string>;
  updateLesson(id: string, data: LessonData): Promise<void>;
  createResource(input: { key: string; topicId: string } & ResourceData): Promise<string>;
  updateResource(id: string, data: ResourceData): Promise<void>;
  createQuiz(input: { slug: string; subjectId: string; topicId: string } & QuizData): Promise<string>;
  updateQuiz(id: string, data: QuizData): Promise<void>;
  createQuestion(input: { key: string; quizId: string; topicId: string } & QuestionData): Promise<string>;
  updateQuestion(id: string, data: QuestionData): Promise<void>;
  createOption(input: { key: string; questionId: string } & OptionData): Promise<string>;
  updateOption(id: string, data: OptionData): Promise<void>;
}

export interface SeedTransaction extends SeedWriter {
  readSnapshot(): Promise<ContentSnapshot>;
}

/** All reads and writes of one seed run happen in one transaction (all or nothing). */
export interface SeedStore {
  transaction<T>(work: (tx: SeedTransaction) => Promise<T>): Promise<T>;
}
