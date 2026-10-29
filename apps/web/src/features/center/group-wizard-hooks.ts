'use client';

import { type CreateCenterGroupRequest, GroupWizardOptionsSchema, StudyGroupViewSchema } from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { retry } from '@/features/teach/hooks';
import { clientFetch } from '@/lib/client-api';

export function useGroupWizard() {
  const locale = useLocale();
  return useQuery({ queryKey: ['center', 'group-wizard', locale], queryFn: () => clientFetch('/center/group-wizard', GroupWizardOptionsSchema, { locale }), retry });
}

/** Creating a group changes the center's lists and the teacher's classes: refresh both. */
export function useCreateCenterGroup() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCenterGroupRequest) => clientFetch('/center/groups', StudyGroupViewSchema, { locale, method: 'POST', body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['center'] });
      await queryClient.invalidateQueries({ queryKey: ['teach'] });
    },
  });
}
