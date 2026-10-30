'use client';

import { RouteError } from '@/features/app/route-error';

/** Error boundary for the teacher workspace: a failed render shows a Faroz error state with retry. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} home="/teach" />;
}
