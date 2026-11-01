'use client';

import { useEffect } from 'react';

// The API stays awake for ~15 min after any request, so one ping per 10 min of browsing is enough.
const EVERY_MS = 10 * 60 * 1000;
let lastSent = 0;

/**
 * On the free Render plan the API sleeps after ~15 minutes without traffic and the first request
 * then takes up to a minute (docs/engineering/DEPLOYMENT.md). Public pages ping the health endpoint
 * as soon as they open, so the API is usually awake by the time someone signs in or opens the demo.
 * Fire and forget: nothing is shown, and a failure is retried on the next page.
 */
export function WakeApi() {
  useEffect(() => {
    if (Date.now() - lastSent < EVERY_MS) return;
    lastSent = Date.now();
    fetch('/api/v1/health', { cache: 'no-store', credentials: 'omit' }).catch(() => {
      lastSent = 0;
    });
  }, []);
  return null;
}
