'use client';

import { RouteError } from '@/features/app/route-error';

/** Error boundary for the admin workspace. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} home="/admin" />;
}
