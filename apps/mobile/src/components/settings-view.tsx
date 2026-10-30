import { SessionListSchema } from '@nuvora/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { AppLocale } from '@/i18n/messages';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLock } from '@/lib/lock';
import { type ThemeChoice, usePrefs } from '@/lib/prefs';
import { Body, Button, Card, Screen, Title } from './ui';

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const { colors } = usePrefs();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segment, { backgroundColor: colors.panel2, borderColor: colors.line }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.key)} style={[styles.segmentItem, on && { backgroundColor: colors.sel }]}>
            <Text style={{ color: on ? colors.selInk : colors.text, fontWeight: '700' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Theme, language, biometric lock, signed-in devices and sign-out (learners and staff). */
export function SettingsView() {
  const { t, theme, setTheme, locale, setLocale, colors } = usePrefs();
  const { signOut, signOutEverywhere } = useAuth();
  const lock = useLock();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api('/auth/sessions', SessionListSchema) });

  const leave = async (everywhere: boolean) => {
    await (everywhere ? signOutEverywhere() : signOut());
    router.replace('/sign-in');
  };

  return (
    <Screen>
      <Title>{t('tabs.settings')}</Title>
      <Card>
        <Body style={styles.h}>{t('settings.theme')}</Body>
        <Segmented<ThemeChoice> label={t('settings.theme')} value={theme} onChange={setTheme} options={[{ key: 'system', label: t('settings.system') }, { key: 'light', label: t('settings.light') }, { key: 'dark', label: t('settings.dark') }]} />
        <Body style={styles.h}>{t('settings.language')}</Body>
        <Segmented<AppLocale> label={t('settings.language')} value={locale} onChange={setLocale} options={[{ key: 'ru', label: 'Русский' }, { key: 'tg', label: 'Тоҷикӣ' }, { key: 'en', label: 'English' }]} />
      </Card>
      <Card index={1}>
        <View style={styles.row}>
          <Body style={[styles.h, { flex: 1 }]}>{t('settings.lock')}</Body>
          <Switch accessibilityLabel={t('settings.lock')} value={lock.enabled} disabled={!lock.available} onValueChange={(on) => void lock.setEnabled(on)} trackColor={{ true: colors.mint, false: colors.track }} />
        </View>
        <Body muted style={styles.small}>{lock.available ? t('settings.lockHint') : t('settings.lockUnavailable')}</Body>
      </Card>
      <Card index={2}>
        <Body style={styles.h}>{t('settings.devices')}</Body>
        {sessions.data?.items.map((s) => (
          <Body key={s.id} muted style={styles.small}>
            {s.device}
            {s.current ? ` · ${t('settings.thisDevice')}` : ''}
          </Body>
        ))}
        <Button kind="ghost" label={t('settings.signOut')} onPress={() => void leave(false)} />
        <Button kind="danger" label={t('settings.signOutAll')} onPress={() => void leave(true)} />
      </Card>
      <Body muted style={styles.small}>{t('settings.server', { url: API_URL })}</Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { fontWeight: '700' },
  small: { fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
