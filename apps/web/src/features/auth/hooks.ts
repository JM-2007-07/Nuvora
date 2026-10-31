'use client';

import {
  type AccountView,
  AccountViewSchema,
  AuthStateSchema,
  type ChangePasswordRequest,
  type ForgotPasswordRequest,
  type LoginRequest,
  MfaSetupSchema,
  MfaStatusSchema,
  PlanListSchema,
  type RegisterRequest,
  type ResetPasswordRequest,
  SessionListSchema,
} from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { z } from 'zod';
import { clientFetch } from '@/lib/client-api';

/** Signing in or out changes whose data every query shows (demo-profile lists are public). */
function useResetAll() {
  const queryClient = useQueryClient();
  return () => queryClient.resetQueries({ predicate: (q) => q.queryKey[0] !== 'demo-profiles' && q.queryKey[0] !== 'staff-profiles' && q.queryKey[0] !== 'plans' });
}

/** The signed-in password account, or null (GET /auth/me answers 200 either way). */
export function useAccount() {
  const locale = useLocale();
  return useQuery({ queryKey: ['auth', 'me'], queryFn: async () => (await clientFetch('/auth/me', AuthStateSchema, { locale })).account });
}

export function useLogin() {
  const locale = useLocale();
  const reset = useResetAll();
  return useMutation({ mutationFn: (body: LoginRequest) => clientFetch('/auth/login', AccountViewSchema, { locale, method: 'POST', body }), onSuccess: reset });
}

export function useRegister() {
  const locale = useLocale();
  const reset = useResetAll();
  return useMutation({ mutationFn: (body: RegisterRequest) => clientFetch('/auth/register', AccountViewSchema, { locale, method: 'POST', body }), onSuccess: reset });
}

/** POST /auth/logout clears both the learner and the staff cookie. */
export function useLogout() {
  const locale = useLocale();
  const reset = useResetAll();
  return useMutation({ mutationFn: () => clientFetch('/auth/logout', z.undefined(), { locale, method: 'POST' }), onSuccess: reset });
}

export function usePlans() {
  const locale = useLocale();
  return useQuery({ queryKey: ['plans'], queryFn: () => clientFetch('/plans', PlanListSchema, { locale }), retry: false });
}

/** Where each account role lands after signing in. */
export function homeFor(role: AccountView['role']): '/app' | '/teach' | '/center' {
  return role === 'TEACHER' ? '/teach' : role === 'CENTER_ADMIN' ? '/center' : '/app';
}

/** Signed-in devices of the current identity (accounts, demo profiles and staff). */
export function useSessions() {
  const locale = useLocale();
  return useQuery({ queryKey: ['auth', 'sessions'], queryFn: () => clientFetch('/auth/sessions', SessionListSchema, { locale }), retry: false });
}

export function useRevokeSession() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientFetch(`/auth/sessions/${encodeURIComponent(id)}`, z.undefined(), { locale, method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
}

/** Signs out every device, this one included. */
export function useLogoutAll() {
  const locale = useLocale();
  const reset = useResetAll();
  return useMutation({ mutationFn: () => clientFetch('/auth/logout-all', z.undefined(), { locale, method: 'POST' }), onSuccess: reset });
}

export function useForgotPassword() {
  const locale = useLocale();
  return useMutation({ mutationFn: (body: ForgotPasswordRequest) => clientFetch('/auth/password/forgot', z.undefined(), { locale, method: 'POST', body }) });
}

export function useResetPassword() {
  const locale = useLocale();
  const reset = useResetAll();
  return useMutation({ mutationFn: (body: ResetPasswordRequest) => clientFetch('/auth/password/reset', z.undefined(), { locale, method: 'POST', body }), onSuccess: reset });
}

export function useChangePassword() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => clientFetch('/auth/password/change', z.undefined(), { locale, method: 'POST', body }),
    // Other devices are signed out; this one stays.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
}

/** Two-factor status; answers 401 ACCOUNT_REQUIRED for demo profiles. */
export function useMfaStatus() {
  const locale = useLocale();
  return useQuery({ queryKey: ['auth', 'mfa'], queryFn: () => clientFetch('/auth/mfa', MfaStatusSchema, { locale }), retry: false });
}

export function useMfaSetup() {
  const locale = useLocale();
  return useMutation({ mutationFn: () => clientFetch('/auth/mfa/setup', MfaSetupSchema, { locale, method: 'POST' }) });
}

export function useMfaEnable() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => clientFetch('/auth/mfa/enable', z.undefined(), { locale, method: 'POST', body: { code } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'mfa'] }),
  });
}

export function useMfaDisable() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { code: string; password: string }) => clientFetch('/auth/mfa/disable', z.undefined(), { locale, method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'mfa'] }),
  });
}
