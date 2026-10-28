import type { SubjectContentInput, TopicContentInput } from '@nuvora/shared';
import { variables } from './informatics/01-variables.js';
import { conditions } from './informatics/02-conditions.js';
import { functions } from './informatics/03-functions.js';
import { loops } from './informatics/04-loops.js';
import { lists } from './informatics/05-lists.js';
import { algorithms } from './informatics/06-algorithms.js';
import { informatics } from './informatics/subject.js';

/** All seed content. Add each new topic file here. */
export interface ContentSet {
  subjects: SubjectContentInput[];
  topics: TopicContentInput[];
}

export const content: ContentSet = {
  subjects: [informatics],
  topics: [variables, conditions, functions, loops, lists, algorithms],
};
