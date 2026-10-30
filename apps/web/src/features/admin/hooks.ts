'use client';

import { AdminAccountListSchema, AdminAuditListSchema, AdminOrganizationListSchema, AdminOverviewSchema } from '@nuvora/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { z } from 'zod';
import { ApiRequestError, clientFetch } from '@/lib/client-api';

/** Admin routes answer 401/403 for everyone else: no retries for those. */
const retry = (count: number, error: unknown) => !(error instanceof ApiRequestError && error.status < 500) && count < 2;

export function useAdminOverview() {
  const locale = useLocale();
  return useQuery({ queryKey: ['admin', 'overview'], queryFn: () => clientFetch('/admin/overview', AdminOverviewSchema, { locale }), retry });
}

export function useAdminAccounts(q: string, role: string) {
  const locale = useLocale();
  const params = new URLSearchParams({ take: '50' });
  if (q.trim()) params.set('q', q.trim());
  if (role !== 'all') params.set('role', role);
  return useQuery({ queryKey: ['admin', 'accounts', q.trim(), role], queryFn: () => clientFetch(`/admin/accounts?${params}`, AdminAccountListSchema, { locale }), retry, placeholderData: keepPreviousData });
}

export function useAdminOrganizations() {
  const locale = useLocale();
  return useQuery({ queryKey: ['admin', 'organizations'], queryFn: () => clientFetch('/admin/organizations', AdminOrganizationListSchema, { locale }), retry });
}

export function useAdminAudit(action: string) {
  const locale = useLocale();
  const params = new URLSearchParams({ take: '100' });
  if (action) params.set('action', action);
  return useQuery({ queryKey: ['admin', 'audit', action], queryFn: () => clientFetch(`/admin/audit?${params}`, AdminAuditListSchema, { locale }), retry, placeholderData: keepPreviousData });
}

export function useRevokeAccountSessions() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientFetch(`/admin/accounts/${encodeURIComponent(id)}/revoke-sessions`, z.strictObject({ ended: z.number() }), { locale, method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useChangeAccountRole() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'TEACHER' | 'CENTER_ADMIN' }) => clientFetch(`/admin/accounts/${encodeURIComponent(id)}/role`, z.strictObject({ from: z.string(), to: z.string() }), { locale, method: 'PUT', body: { role } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}
