import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { deleteItem, getItem, setItem } from './storage';

const BIO_KEY = 'faroz.lock';
const PIN_KEY = 'faroz.pin';
const FAILS_KEY = 'faroz.pin.fails';
/** Coming back after this long in the background locks the app again. */
const RELOCK_AFTER_MS = 60_000;
export const PIN_ATTEMPTS = 5;

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

interface Lock {
  biometricsEnabled: boolean;
  biometricsAvailable: boolean;
  pinEnabled: boolean;
  locked: boolean;
  setBiometrics: (on: boolean) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  /** 'ok', the attempts left, or 'locked-out' (the caller signs out). */
  unlockWithPin: (pin: string) => Promise<'ok' | 'locked-out' | number>;
  forget: () => Promise<void>;
}

const LockContext = createContext<Lock | null>(null);

/**
 * Optional app lock: device biometrics (checked by the operating system; Faroz only learns
 * "passed" or "not") and/or a four-digit passcode stored as a salted SHA-256 in secure storage.
 * After five wrong passcodes the session on this phone ends. Both are conveniences on top of the
 * server session, never a replacement for it.
 */
export function LockProvider({ children }: { children: React.ReactNode }) {
  const [biometricsEnabled, setBioEnabled] = useState(false);
  const [biometricsAvailable, setBioAvailable] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      let available = false;
      if (Platform.OS !== 'web') {
        try {
          available = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
        } catch {
          available = false;
        }
      }
      const [bio, pin] = await Promise.all([getItem(BIO_KEY), getItem(PIN_KEY)]);
      const bioOn = available && bio === '1';
      setBioAvailable(available);
      setBioEnabled(bioOn);
      setPinEnabled(!!pin);
      setLocked(bioOn || !!pin);
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && (biometricsEnabled || pinEnabled) && backgroundAt.current && Date.now() - backgroundAt.current > RELOCK_AFTER_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [biometricsEnabled, pinEnabled]);

  const unlockWithBiometrics = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Faroz', disableDeviceFallback: false });
      if (result.success) {
        setLocked(false);
        await setItem(FAILS_KEY, '0');
      }
      return result.success;
    } catch {
      return false;
    }
  }, []);

  const setBiometrics = useCallback(async (on: boolean) => {
    if (on) {
      try {
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Faroz' });
        if (!result.success) return false;
      } catch {
        return false;
      }
    }
    await setItem(BIO_KEY, on ? '1' : '0');
    setBioEnabled(on);
    return true;
  }, []);

  const setPin = useCallback(async (pin: string) => {
    const salt = Crypto.randomUUID();
    await setItem(PIN_KEY, `${salt}:${await hashPin(pin, salt)}`);
    await setItem(FAILS_KEY, '0');
    setPinEnabled(true);
  }, []);

  const removePin = useCallback(async () => {
    await deleteItem(PIN_KEY);
    await deleteItem(FAILS_KEY);
    setPinEnabled(false);
  }, []);

  const forget = useCallback(async () => {
    await Promise.all([deleteItem(PIN_KEY), deleteItem(FAILS_KEY), setItem(BIO_KEY, '0')]);
    setPinEnabled(false);
    setBioEnabled(false);
    setLocked(false);
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const stored = await getItem(PIN_KEY);
    if (!stored) {
      setLocked(false);
      return 'ok' as const;
    }
    const [salt, hash] = stored.split(':');
    if (salt && hash && (await hashPin(pin, salt)) === hash) {
      await setItem(FAILS_KEY, '0');
      setLocked(false);
      return 'ok' as const;
    }
    const fails = Number((await getItem(FAILS_KEY)) ?? '0') + 1;
    await setItem(FAILS_KEY, String(fails));
    if (fails >= PIN_ATTEMPTS) return 'locked-out' as const;
    return PIN_ATTEMPTS - fails;
  }, []);

  const value = useMemo(
    () => ({ biometricsEnabled, biometricsAvailable, pinEnabled, locked, setBiometrics, unlockWithBiometrics, setPin, removePin, unlockWithPin, forget }),
    [biometricsEnabled, biometricsAvailable, pinEnabled, locked, setBiometrics, unlockWithBiometrics, setPin, removePin, unlockWithPin, forget],
  );
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock(): Lock {
  const lock = useContext(LockContext);
  if (!lock) throw new Error('useLock outside LockProvider');
  return lock;
}
