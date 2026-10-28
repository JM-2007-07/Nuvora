'use client';

import { useRouter } from '@/i18n/navigation';
import { ErrorState } from './states';

/** The quiz could not be loaded on the server (API or database down). */
export function QuestUnavailable() {
  const router = useRouter();
  return <ErrorState error={new Error('API_UNAVAILABLE')} onRetry={() => router.refresh()} />;
}
