'use client';

import {
  type AccountView,
  AccountViewSchema,
  AuthStateSchema,
  type LoginRequest,
  PlanListSchema,
  type RegisterRequest,
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
