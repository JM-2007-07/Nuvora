'use client';

import {
  type CenterPermissions,
  CenterSettingsSchema,
  InvitationLinkSchema,
  InvitationSchema,
  type InviteRequest,
  PublicInvitationSchema,
} from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { retry } from '@/features/teach/hooks';
import { clientFetch } from '@/lib/client-api';

/** Center side: every change refreshes the staff list and the overview counts. */
function useCenterMutation<A, R>(run: (args: A, locale: ReturnType<typeof useLocale>) => Promise<R>) {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => run(args, locale),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['center'] });
    },
  });
}

export const useInvite = () =>
  useCenterMutation((body: InviteRequest, locale) => clientFetch('/center/invitations', InvitationLinkSchema, { locale, method: 'POST', body }));

export const useResendInvitation = () =>
  useCenterMutation((id: string, locale) => clientFetch(`/center/invitations/${encodeURIComponent(id)}/resend`, InvitationLinkSchema, { locale, method: 'POST' }));

export const useRevokeInvitation = () =>
  useCenterMutation((id: string, locale) => clientFetch(`/center/invitations/${encodeURIComponent(id)}/revoke`, InvitationSchema, { locale, method: 'POST' }));

export const useSavePermissions = () =>
  useCenterMutation((body: CenterPermissions, locale) => clientFetch('/center/settings/permissions', CenterSettingsSchema, { locale, method: 'PUT', body }));

// ---------- invitee (public page) ----------

export function usePublicInvitation(token: string) {
  const locale = useLocale();
  return useQuery({ queryKey: ['invitation', token], queryFn: () => clientFetch(`/invitations/${encodeURIComponent(token)}`, PublicInvitationSchema, { locale }), retry });
}

export function useInvitationAnswer(token: string, answer: 'accept' | 'decline') {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clientFetch(`/invitations/${encodeURIComponent(token)}/${answer}`, PublicInvitationSchema, { locale, method: 'POST' }),
    onSuccess: (view) => queryClient.setQueryData(['invitation', token], view),
  });
}

/** The full link to share: it opens in the invitation's language. */
export function inviteUrl(token: string, locale: string): string {
  return `${window.location.origin}/${locale}/invite/${token}`;
}
