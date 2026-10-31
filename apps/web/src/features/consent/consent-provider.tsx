'use client';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ALL_OPTIONAL,
  type ConsentCategories,
  type ConsentRecord,
  cookieAssignment,
  createRecord,
  NO_OPTIONAL,
  type OptionalCategory,
  parseRecord,
  readCookieValue,
  serializeRecord,
} from './consent-model';

/*
 * Consent state lives in the first-party cookie `faroz-consent`, so the server could read it later.
 * The cookie string is the external store: useSyncExternalStore returns null on the server and
 * during hydration ("not known yet"), so the banner never flashes for people who already chose.
 */

const listeners = new Set<() => void>();
// Fallback when the browser refuses the cookie: the choice still holds until the tab closes.
let memoryRaw: string | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string {
  try {
    return readCookieValue(document.cookie) ?? memoryRaw ?? '';
  } catch {
    return memoryRaw ?? '';
  }
}

function getServerSnapshot(): null {
  return null;
}

function store(record: ConsentRecord) {
  memoryRaw = serializeRecord(record);
  try {
    document.cookie = cookieAssignment(record);
  } catch {
    // cookies blocked: the in-memory copy above is used
  }
  listeners.forEach((listener) => listener());
}

type ConsentContextValue = {
  /** False until the browser has been read (server render and hydration). */
  ready: boolean;
  /** The valid stored choice, or null when none was made (or the version changed). */
  record: ConsentRecord | null;
  settingsOpen: boolean;
  acceptAll: () => void;
  rejectOptional: () => void;
  save: (categories: ConsentCategories) => void;
  openSettings: () => void;
  closeSettings: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const record = useMemo(() => (raw ? parseRecord(raw) : null), [raw]);

  const save = useCallback((categories: ConsentCategories) => {
    store(createRecord(categories));
    setSettingsOpen(false);
  }, []);
  const acceptAll = useCallback(() => save(ALL_OPTIONAL), [save]);
  const rejectOptional = useCallback(() => save(NO_OPTIONAL), [save]);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const value = useMemo<ConsentContextValue>(
    () => ({ ready: raw !== null, record, settingsOpen, acceptAll, rejectOptional, save, openSettings, closeSettings }),
    [raw, record, settingsOpen, acceptAll, rejectOptional, save, openSettings, closeSettings],
  );
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext);
  if (!value) throw new Error('useConsent must be used inside <ConsentProvider>');
  return value;
}

/**
 * Renders children only after the visitor granted `category`. Wrap any future analytics or marketing
 * script in it. Faroz has none today, so nothing uses it yet.
 */
export function ConsentGate({ category, children }: { category: OptionalCategory; children: ReactNode }) {
  const { record } = useConsent();
  return record?.categories[category] ? <>{children}</> : null;
}
