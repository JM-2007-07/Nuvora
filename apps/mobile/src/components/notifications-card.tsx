import type { NotificationCategory } from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, BellRing, Settings2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Switch, View } from 'react-native';
import type { MessageKey } from '@/i18n/messages';
import { useAuth } from '@/lib/auth';
import { usePrefs } from '@/lib/prefs';
import { disablePush, dismissPushOffer, enablePush, getPreferences, type PushStatus, pushStatus, shouldOfferPush, updatePreferences } from '@/lib/push';
import { Button, Card, IconBadge, Pill, T } from './ui';

const STATUS_TEXT: Partial<Record<PushStatus, MessageKey>> = {
  unsupported: 'push.unsupported',
  emulator: 'push.emulator',
  'not-configured': 'push.notConfigured',
  denied: 'push.denied',
};

function usePushStatus() {
  return useQuery({ queryKey: ['push-status'], queryFn: pushStatus, staleTime: 0 });
}

function useEnable() {
  const { locale, t } = usePrefs();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => enablePush(locale, t('push.channel')),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['push-status'] }),
  });
}

/** Settings: what Faroz sends, the switch for this phone, and the categories for this role. */
export function NotificationsCard() {
  const { t, colors } = usePrefs();
  const { kind } = useAuth();
  const queryClient = useQueryClient();
  const status = usePushStatus();
  const enable = useEnable();
  const prefs = useQuery({ queryKey: ['notification-prefs'], queryFn: getPreferences, enabled: kind === 'learner' || kind === 'staff' });
  const toggle = useMutation({
    mutationFn: (c: { category: NotificationCategory; enabled: boolean }) => updatePreferences({ categories: [c] }),
    onSuccess: (data) => queryClient.setQueryData(['notification-prefs'], data),
  });
  const off = useMutation({ mutationFn: disablePush, onSettled: () => void queryClient.invalidateQueries({ queryKey: ['push-status'] }) });
  const s = status.data;
  const note = s ? STATUS_TEXT[s] : undefined;

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge icon={s === 'on' ? BellRing : s === 'denied' ? BellOff : Bell} tone={s === 'on' ? 'mint' : 'neutral'} />
          <T variant="strong" style={{ flex: 1 }}>
            {t('push.title')}
          </T>
          {s === 'on' || s === 'off' ? <Pill text={s === 'on' ? t('push.on') : t('push.off')} tone={s === 'on' ? 'mint' : 'neutral'} /> : null}
        </View>
        <T variant="caption" ink="muted">
          {t('push.explain')}
        </T>
        {note ? <T variant="caption" ink={s === 'denied' ? 'gold' : 'faint'}>{t(note)}</T> : null}
        {enable.isError ? <T variant="caption" ink="mag">{t('push.failed')}</T> : null}
        {s === 'undetermined' || s === 'off' ? <Button kind="soft" compact icon={BellRing} label={t('push.enable')} busy={enable.isPending} onPress={() => enable.mutate()} /> : null}
        {s === 'on' ? <Button kind="ghost" compact icon={BellOff} label={t('push.disable')} busy={off.isPending} onPress={() => off.mutate()} /> : null}
        {s === 'denied' ? <Button kind="ghost" compact icon={Settings2} label={t('push.openSettings')} onPress={() => void Linking.openSettings()} /> : null}
      </Card>
      {prefs.data ? (
        <Card>
          <T variant="caption" ink="muted">
            {t('push.categories')}
          </T>
          {prefs.data.categories.map((c) => (
            <View key={c.category} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
              <T style={{ flex: 1 }}>{t(`push.cat.${c.category}` as MessageKey)}</T>
              <Switch
                accessibilityLabel={t(`push.cat.${c.category}` as MessageKey)}
                value={c.enabled}
                disabled={toggle.isPending}
                onValueChange={(enabled) => toggle.mutate({ category: c.category, enabled })}
                trackColor={{ true: colors.mint, false: colors.track }}
              />
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

/** One-time card on the home screens: explains first, asks the OS only after "Turn on". */
export function PushOffer() {
  const { t } = usePrefs();
  const queryClient = useQueryClient();
  const enable = useEnable();
  const [show, setShow] = useState(false);
  useEffect(() => {
    void shouldOfferPush().then(setShow).catch(() => setShow(false));
  }, []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    void dismissPushOffer().then(() => queryClient.invalidateQueries({ queryKey: ['push-status'] }));
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBadge icon={BellRing} tone="blue" />
        <T variant="strong" style={{ flex: 1 }}>
          {t('push.offerTitle')}
        </T>
      </View>
      <T variant="caption" ink="muted">
        {t('push.explain')}
      </T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button compact kind="ghost" label={t('push.notNow')} onPress={close} style={{ flex: 1 }} />
        <Button compact kind="soft" icon={BellRing} label={t('push.enable')} busy={enable.isPending} onPress={() => enable.mutate(undefined, { onSettled: close })} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}
