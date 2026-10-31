import { type DemoTokenRequest, TokenPairSchema } from '@nuvora/shared';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { z } from 'zod';
import { api, clearTokens, loadTokens, publicApi, saveTokens, type SessionKind, setSignedOutHandler } from './api';
import { forgetAccountQueue } from './offline';

interface Auth {
  /** null while loading from secure storage */
  kind: SessionKind | 'none' | null;
  signIn: (email: string, password: string, code?: string) => Promise<void>;
  signInDemo: (request: DemoTokenRequest) => Promise<void>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

/** A short label for "Signed-in devices" on the website. */
function deviceLabel(): string {
  const name = Constants.deviceName;
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web preview';
  return `${name ?? 'Faroz app'} · ${os}`.slice(0, 80);
}

/**
 * Account state for the app. Tokens live in secure storage; the server can revoke them at any time
 * (sign out everywhere on the website ends this session too, at the next refresh).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [kind, setKind] = useState<Auth['kind']>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setSignedOutHandler(() => {
      void forgetAccountQueue();
      queryClient.clear();
      setKind('none');
    });
    void loadTokens().then((k) => setKind(k ?? 'none'));
    return () => setSignedOutHandler(null);
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string, code?: string) => {
    const pair = await publicApi('/auth/token', TokenPairSchema, { method: 'POST', body: { email, password, deviceLabel: deviceLabel(), ...(code ? { code } : {}) } });
    await saveTokens(pair);
    queryClient.clear();
    setKind(pair.kind);
  }, [queryClient]);

  const signInDemo = useCallback(async (request: DemoTokenRequest) => {
    const pair = await publicApi('/auth/token/demo', TokenPairSchema, { method: 'POST', body: { ...request, deviceLabel: deviceLabel() } });
    await saveTokens(pair);
    queryClient.clear();
    setKind(pair.kind);
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await api('/auth/token/revoke', z.undefined(), { method: 'POST' }).catch(() => undefined);
    await Promise.all([clearTokens(), forgetAccountQueue()]);
    queryClient.clear();
    setKind('none');
  }, [queryClient]);

  const signOutEverywhere = useCallback(async () => {
    await api('/auth/logout-all', z.undefined(), { method: 'POST' }).catch(() => undefined);
    await Promise.all([clearTokens(), forgetAccountQueue()]);
    queryClient.clear();
    setKind('none');
  }, [queryClient]);

  const value = useMemo(() => ({ kind, signIn, signInDemo, signOut, signOutEverywhere }), [kind, signIn, signInDemo, signOut, signOutEverywhere]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth outside AuthProvider');
  return auth;
}
