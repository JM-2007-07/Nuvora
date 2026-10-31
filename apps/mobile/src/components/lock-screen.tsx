import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Fingerprint } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useLock } from '@/lib/lock';
import { usePrefs } from '@/lib/prefs';
import { PinPad } from './pin-pad';
import { Button, T } from './ui';

/** Covers the app until the owner unlocks it with biometrics (checked by the OS) or the passcode. */
export function LockScreen() {
  const { gradients, t } = usePrefs();
  const lock = useLock();
  const { signOut } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const bio = useCallback(() => void lock.unlockWithBiometrics(), [lock]);
  useEffect(() => {
    if (lock.biometricsEnabled) bio();
  }, [lock.biometricsEnabled, bio]);

  const leave = async () => {
    await lock.forget();
    await signOut();
    router.replace('/sign-in');
  };

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <LinearGradient colors={gradients.hud} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.wrap}>
        <Image source={require('../../assets/mark.png')} style={styles.mark} accessibilityIgnoresInvertColors />
        {lock.pinEnabled ? (
          <PinPad
            onHud
            title={t('pin.enter')}
            message={message}
            error={error}
            onBiometrics={lock.biometricsEnabled ? bio : undefined}
            onComplete={async (pin) => {
              const result = await lock.unlockWithPin(pin);
              if (result === 'ok') return;
              if (result === 'locked-out') {
                setMessage(t('pin.locked'));
                await leave();
                return;
              }
              setError(false);
              requestAnimationFrame(() => {
                setMessage(t('pin.wrong', { n: result }));
                setError(true);
              });
            }}
          />
        ) : (
          <View style={{ alignItems: 'center', gap: 16 }}>
            <T variant="title" ink="onHud">
              {t('lock.title')}
            </T>
            <T ink="onHudMuted" style={{ textAlign: 'center' }}>
              {t('settings.lockHint')}
            </T>
            <Button kind="hud" icon={Fingerprint} label={t('lock.unlock')} onPress={bio} style={{ minWidth: 240 }} />
          </View>
        )}
        <Button kind="hudGhost" label={t('lock.signOut')} onPress={() => void leave()} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly', padding: 24 },
  mark: { width: 64, height: 64 },
});
