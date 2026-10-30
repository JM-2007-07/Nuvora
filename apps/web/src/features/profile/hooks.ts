'use client';

import { type Locale, type MyProfile, MyProfileSchema, type ProfileSettings, PublicProfileSchema } from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { z } from 'zod';
import { ApiRequestError, clientFetch } from '@/lib/client-api';

export const myProfileKey = ['profile', 'me'] as const;

/** My profile (settings and identity). */
export function useMyProfile(enabled = true) {
  const locale = useLocale() as Locale;
  return useQuery({ queryKey: myProfileKey, queryFn: () => clientFetch('/me/profile', MyProfileSchema, { locale }), enabled, retry: false, staleTime: 60_000 });
}

/** Someone's public profile; `ref` is a handle or a participant key. */
export function usePublicProfile(ref: string) {
  const locale = useLocale() as Locale;
  return useQuery({
    queryKey: ['profile', 'public', ref],
    queryFn: () => clientFetch(`/profiles/${encodeURIComponent(ref)}`, PublicProfileSchema, { locale }),
    retry: false,
  });
}

function useAfterChange() {
  const queryClient = useQueryClient();
  return (profile: MyProfile) => {
    queryClient.setQueryData(myProfileKey, profile);
    // Photos and names show in chats and on public pages.
    void queryClient.invalidateQueries({ queryKey: ['profile', 'public'] });
    void queryClient.invalidateQueries({ queryKey: ['comms'] });
  };
}

export function useSaveProfile() {
  const locale = useLocale() as Locale;
  const after = useAfterChange();
  return useMutation({
    mutationFn: (settings: ProfileSettings) => clientFetch('/me/profile', MyProfileSchema, { locale, method: 'PUT', body: settings }),
    onSuccess: after,
  });
}

export function useAvatar() {
  const locale = useLocale() as Locale;
  const after = useAfterChange();
  const upload = useMutation({
    mutationFn: async (image: Blob) => {
      const form = new FormData();
      form.append('image', image, image.type === 'image/webp' ? 'photo.webp' : 'photo.jpg');
      const response = await fetch('/api/v1/me/profile/avatar', { method: 'PUT', body: form, credentials: 'same-origin' });
      if (!response.ok) throw new ApiRequestError(response.status, 'AVATAR_FAILED');
      return MyProfileSchema.parse(await response.json());
    },
    onSuccess: after,
  });
  const remove = useMutation({
    mutationFn: () => clientFetch('/me/profile/avatar', MyProfileSchema, { locale, method: 'DELETE' }),
    onSuccess: after,
  });
  return { upload, remove };
}

/** Is this handle free for me? (null while unknown) */
export async function handleAvailable(locale: Locale, handle: string): Promise<boolean> {
  const res = await clientFetch(`/me/profile/handle-available?handle=${encodeURIComponent(handle)}`, z.object({ available: z.boolean() }), { locale });
  return res.available;
}
