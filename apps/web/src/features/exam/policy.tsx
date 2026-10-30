'use client';

import type { ExamPolicy } from '@nuvora/shared';
import { useTranslations } from 'next-intl';

/** The violation policy as one plain sentence (shown to the teacher and, shortened, to the learner). */
export function usePolicySentence() {
  const t = useTranslations('Exam.policy');
  return (policy: ExamPolicy) =>
    t('sentence', {
      warn: policy.warnAfter,
      notify: policy.notifyAfter,
      act: policy.actionAfter,
      action: t(`action.${policy.action}`),
      reentry: t(policy.allowReentry ? 'reentryYes' : 'reentryNo'),
    });
}
