import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useLock } from '@/lib/lock';
import { usePrefs } from '@/lib/prefs';
import { Body, Button, Title } from './ui';

/** Covers the app until the system confirms the owner's fingerprint or face. */
export function LockScreen() {
  const { colors, t } = usePrefs();
  const { unlock } = useLock();
  const { signOut } = useAuth();
  useEffect(() => {
    void unlock();
  }, [unlock]);
  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: colors.bg }]} accessibilityViewIsModal>
      <Image source={require('../../assets/mark.png')} style={styles.mark} accessibilityIgnoresInvertColors />
      <Title>{t('lock.title')}</Title>
      <Body muted style={{ textAlign: 'center' }}>{t('settings.lockHint')}</Body>
      <View style={styles.actions}>
        <Button label={t('lock.unlock')} onPress={() => void unlock()} />
        <Button kind="ghost" label={t('lock.signOut')} onPress={() => void signOut()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  mark: { width: 72, height: 72, marginBottom: 8 },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 12 },
});
