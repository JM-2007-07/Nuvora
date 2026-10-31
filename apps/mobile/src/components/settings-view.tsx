import { SessionListSchema } from '@nuvora/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Fingerprint, HardDrive, KeyRound, LogOut, Server, ShieldOff, Smartphone } from 'lucide-react-native';
import { Switch, View } from 'react-native';
import type { AppLocale } from '@/i18n/messages';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLock } from '@/lib/lock';
import { type ThemeChoice, usePrefs } from '@/lib/prefs';
import { Button, Card, IconBadge, Pill, Row, Screen, Section, Segmented, T } from './ui';

/** Appearance, language, app lock (biometrics and passcode), devices and sign-out. */
export function SettingsView() {
  const { t, theme, setTheme, locale, setLocale, colors } = usePrefs();
  const { signOut, signOutEverywhere } = useAuth();
  const lock = useLock();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api('/auth/sessions', SessionListSchema) });

  const leave = async (everywhere: boolean) => {
    await lock.forget();
    await (everywhere ? signOutEverywhere() : signOut());
    router.replace('/sign-in');
  };

  return (
    <Screen title={t('settings.title')}>
      <Section title={t('settings.appearance')}>
        <Card>
          <T variant="caption" ink="muted">
            {t('settings.theme')}
          </T>
          <Segmented<ThemeChoice> label={t('settings.theme')} value={theme} onChange={setTheme} options={[{ key: 'system', label: t('settings.system') }, { key: 'light', label: t('settings.light') }, { key: 'dark', label: t('settings.dark') }]} />
          <T variant="caption" ink="muted">
            {t('settings.language')}
          </T>
          <Segmented<AppLocale> label={t('settings.language')} value={locale} onChange={setLocale} options={[{ key: 'ru', label: 'Русский' }, { key: 'tg', label: 'Тоҷикӣ' }, { key: 'en', label: 'English' }]} />
        </Card>
      </Section>

      <Section title={t('settings.security')}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBadge icon={Fingerprint} tone="mint" />
            <T variant="strong" style={{ flex: 1 }}>
              {t('settings.lock')}
            </T>
            <Switch accessibilityLabel={t('settings.lock')} value={lock.biometricsEnabled} disabled={!lock.biometricsAvailable} onValueChange={(on) => void lock.setBiometrics(on)} trackColor={{ true: colors.mint, false: colors.track }} />
          </View>
          <T variant="caption" ink="muted">
            {lock.biometricsAvailable ? t('settings.lockHint') : t('settings.lockUnavailable')}
          </T>
        </Card>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBadge icon={KeyRound} tone="blue" />
            <T variant="strong" style={{ flex: 1 }}>
              {t('settings.pin')}
            </T>
            <Pill text={lock.pinEnabled ? t('settings.pinOn') : t('settings.pinOff')} tone={lock.pinEnabled ? 'mint' : 'neutral'} />
          </View>
          <T variant="caption" ink="muted">
            {t('settings.pinHint')}
          </T>
          {lock.pinEnabled ? (
            <Button kind="ghost" compact icon={ShieldOff} label={t('settings.pinRemove')} onPress={() => void lock.removePin()} />
          ) : (
            <Button kind="soft" compact icon={KeyRound} label={t('settings.pinSet')} onPress={() => router.push('/pin-setup')} />
          )}
        </Card>
      </Section>

      <Section title={t('settings.devices')}>
        {sessions.data?.items.map((s, i) => (
          <Row key={s.id} index={i} icon={Smartphone} tone={s.current ? 'mint' : 'neutral'} title={s.device} subtitle={s.current ? t('settings.thisDevice') : s.channel} chevron={false} />
        ))}
        <Button kind="ghost" icon={LogOut} label={t('settings.signOut')} onPress={() => void leave(false)} />
        <Button kind="danger" icon={LogOut} label={t('settings.signOutAll')} onPress={() => void leave(true)} />
      </Section>

      <Section title={t('settings.offline')}>
        <Row icon={HardDrive} tone="gold" title={t('settings.offline')} subtitle={t('settings.offlineHint')} chevron={false} />
        <Row icon={Server} tone="neutral" title={t('settings.server', { url: API_URL })} chevron={false} />
      </Section>
    </Screen>
  );
}
