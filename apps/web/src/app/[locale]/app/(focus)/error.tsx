'use client';

import { RouteError } from '@/features/app/route-error';

/** Error boundary for the test player: a failed render shows a Faroz error state with retry. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} home="/app/quests" />;
}
