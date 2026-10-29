'use client';

import { useRouter } from '@/i18n/navigation';
import { FocusFrame } from './focus-frame';
import { ErrorState } from './states';

/** The quiz could not be loaded on the server (API or database down). */
export function QuestUnavailable() {
  const router = useRouter();
  return (
    <FocusFrame>
      <ErrorState error={new Error('API_UNAVAILABLE')} onRetry={() => router.refresh()} />
    </FocusFrame>
  );
}
