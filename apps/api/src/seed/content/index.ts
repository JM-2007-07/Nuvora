import type { SubjectContentInput, TopicContentInput } from '@nuvora/shared';
import { variables } from './informatics/01-variables.js';
import { informatics } from './informatics/subject.js';

/** All seed content. Add each new topic file here. */
export interface ContentSet {
  subjects: SubjectContentInput[];
  topics: TopicContentInput[];
}

export const content: ContentSet = {
  subjects: [informatics],
  topics: [variables],
};
