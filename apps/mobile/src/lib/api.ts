import { ApiErrorSchema, type TokenPair, TokenPairSchema } from '@nuvora/shared';
import Constants from 'expo-constants';
import { deleteItem, getItem, setItem } from './storage';
import { Platform } from 'react-native';
import type { z } from 'zod';

/**
 * The Faroz API for the app: the same NestJS backend as the website, with bearer tokens.
 * Address: EXPO_PUBLIC_API_URL, else app.json extra.apiUrl, else the local development API
 * (the Android emulator reaches the computer at 10.0.2.2). A real phone needs the computer's
 * LAN address or an HTTPS host.
 */
const fromEnv: unknown = process.env.EXPO_PUBLIC_API_URL;
const fromConfig: unknown = (Constants.expoConfig?.extra as { apiUrl?: unknown } | undefined)?.apiUrl;
const isUrl = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//.test(v);
export const API_URL: string = isUrl(fromEnv)
  ? fromEnv.replace(/\/$/, '')
  : isUrl(fromConfig)
    ? fromConfig.replace(/\/$/, '')
    : Platform.OS === 'android'
      ? 'http://10.0.2.2:4000/api/v1'
      : 'http://localhost:4000/api/v1';

/** Secure storage keys (Keychain on iOS, Keystore-backed on Android). Tokens never go to plain storage. */
const ACCESS = 'faroz.access';
const REFRESH = 'faroz.refresh';
const KIND = 'faroz.kind';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export type SessionKind = 'learner' | 'staff';
let memory: { access: string | null; refresh: string | null; kind: SessionKind | null } = { access: null, refresh: null, kind: null };
let onSignedOut: (() => void) | null = null;

/**
 * Reads the saved tokens once. Every request waits for it, so a screen that renders before the
 * session is restored (a cold start or a deep link) never goes out without its token.
 */
let loading: Promise<void> | null = null;
function ensureLoaded(): Promise<void> {
  loading ??= Promise.all([getItem(ACCESS), getItem(REFRESH), getItem(KIND)]).then(([access, refresh, kind]) => {
    memory = { access, refresh, kind: kind === 'learner' || kind === 'staff' ? kind : null };
  });
  return loading;
}

export async function loadTokens(): Promise<SessionKind | null> {
  await ensureLoaded();
  return memory.refresh ? memory.kind : null;
}

export async function saveTokens(pair: TokenPair): Promise<void> {
  loading ??= Promise.resolve();
  memory = { access: pair.accessToken, refresh: pair.refreshToken, kind: pair.kind };
  await Promise.all([setItem(ACCESS, pair.accessToken), setItem(REFRESH, pair.refreshToken), setItem(KIND, pair.kind)]);
}

export async function clearTokens(): Promise<void> {
  loading ??= Promise.resolve();
  memory = { access: null, refresh: null, kind: null };
  await Promise.all([deleteItem(ACCESS), deleteItem(REFRESH), deleteItem(KIND)]);
}

export function setSignedOutHandler(handler: (() => void) | null): void {
  onSignedOut = handler;
}

export function currentAccessToken(): string | null {
  return memory.access;
}

async function raw(path: string, init: { method?: string; body?: unknown; token?: string | null; locale?: string; headers?: Record<string, string> }): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(init.locale ? { 'Accept-Language': init.locale } : {}),
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

/** One refresh at a time: parallel 401s wait for the same rotation (a refresh token works once). */
let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  if (!memory.refresh) return false;
  refreshing ??= (async () => {
    try {
      const res = await raw('/auth/token/refresh', { method: 'POST', body: { refreshToken: memory.refresh } });
      if (!res.ok) {
        await clearTokens();
        onSignedOut?.();
        return false;
      }
      await saveTokens(TokenPairSchema.parse(await res.json()));
      return true;
    } catch {
      return false; // offline: keep the tokens, try again later
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function fail(res: Response): Promise<never> {
  const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => null));
  throw new ApiError(res.status, parsed.success ? parsed.data.error.code : 'REQUEST_FAILED');
}

/** Authenticated request, validated with the shared Zod schema; renews the access token once on 401. */
export async function api<T>(path: string, schema: z.ZodType<T>, init: { method?: string; body?: unknown; locale?: string; headers?: Record<string, string> } = {}): Promise<T> {
  await ensureLoaded();
  let res = await raw(path, { ...init, token: memory.access });
  if (res.status === 401 && (await refresh())) res = await raw(path, { ...init, token: memory.access });
  if (!res.ok) return fail(res);
  return res.status === 204 ? (undefined as T) : schema.parse(await res.json());
}

/** Requests that need no session (sign-in). */
export async function publicApi<T>(path: string, schema: z.ZodType<T>, init: { method?: string; body?: unknown; locale?: string } = {}): Promise<T> {
  const res = await raw(path, init);
  if (!res.ok) return fail(res);
  return schema.parse(await res.json());
}
