import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

const LOCK_KEY = 'faroz.lock';
/** Coming back after this long in the background asks for biometrics again. */
const RELOCK_AFTER_MS = 60_000;

interface Lock {
  enabled: boolean;
  available: boolean;
  locked: boolean;
  setEnabled: (on: boolean) => Promise<boolean>;
  unlock: () => Promise<boolean>;
}

const LockContext = createContext<Lock | null>(null);

/**
 * Optional app lock with device biometrics. The check is done by the operating system
 * (expo-local-authentication); Faroz only learns "passed" or "not passed" and never sees or
 * stores fingerprints or face data. It is a convenience on top of the server session, not a
 * replacement for it.
 */
export function LockProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      const [hardware, enrolled, stored] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(), SecureStore.getItemAsync(LOCK_KEY)]);
      const ok = hardware && enrolled;
      setAvailable(ok);
      const on = ok && stored === '1';
      setEnabledState(on);
      setLocked(on);
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && enabled && backgroundAt.current && Date.now() - backgroundAt.current > RELOCK_AFTER_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Faroz', disableDeviceFallback: false });
    if (result.success) setLocked(false);
    return result.success;
  }, []);

  const setEnabled = useCallback(async (on: boolean) => {
    if (on) {
      // Confirm with biometrics once before turning it on.
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Faroz' });
      if (!result.success) return false;
    }
    await SecureStore.setItemAsync(LOCK_KEY, on ? '1' : '0');
    setEnabledState(on);
    return true;
  }, []);

  const value = useMemo(() => ({ enabled, available, locked, setEnabled, unlock }), [enabled, available, locked, setEnabled, unlock]);
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock(): Lock {
  const lock = useContext(LockContext);
  if (!lock) throw new Error('useLock outside LockProvider');
  return lock;
}
