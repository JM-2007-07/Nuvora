import type { CheckpointContentInput, SubjectContentInput, TopicContentInput } from '@nuvora/shared';
import { variables } from './informatics/01-variables.js';
import { conditions } from './informatics/02-conditions.js';
import { functions } from './informatics/03-functions.js';
import { loops } from './informatics/04-loops.js';
import { lists } from './informatics/05-lists.js';
import { algorithms } from './informatics/06-algorithms.js';
import { informatics } from './informatics/subject.js';
import { jsVariables } from './javascript/01-variables.js';
import { jsConditions } from './javascript/02-conditions.js';
import { jsFunctions } from './javascript/03-functions.js';
import { jsArrays } from './javascript/04-arrays.js';
import { jsObjects } from './javascript/05-objects.js';
import { javascriptDiagnostic } from './javascript/diagnostic.js';
import { javascript } from './javascript/subject.js';

/** All seed content. Add each new topic file here. */
export interface ContentSet {
  subjects: SubjectContentInput[];
  topics: TopicContentInput[];
  /** Subject-level CHECKPOINT quizzes (diagnostics) covering several topics. */
  checkpoints?: CheckpointContentInput[];
}

export const content: ContentSet = {
  subjects: [javascript, informatics],
  topics: [variables, conditions, functions, loops, lists, algorithms, jsVariables, jsConditions, jsFunctions, jsArrays, jsObjects],
  checkpoints: [javascriptDiagnostic],
};
