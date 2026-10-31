import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinPad } from '@/components/pin-pad';
import { Button, tap } from '@/components/ui';
import { useLock } from '@/lib/lock';
import { usePrefs } from '@/lib/prefs';

/** Choose the app passcode: enter it twice; it is stored as a salted hash in secure storage. */
export default function PinSetup() {
  const { t, colors } = usePrefs();
  const { setPin } = useLock();
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'space-evenly', padding: 24 }}>
      <PinPad
        key={first ? 'repeat' : 'create'}
        title={first ? t('pin.repeat') : t('pin.create')}
        message={message}
        error={error}
        onComplete={async (pin) => {
          if (!first) {
            setFirst(pin);
            setMessage(null);
            setError(false);
            return;
          }
          if (pin !== first) {
            setFirst(null);
            setMessage(t('pin.mismatch'));
            setError(true);
            return;
          }
          await setPin(pin);
          tap('success');
          router.back();
        }}
      />
      <View style={{ alignItems: 'center' }}>
        <Button kind="ghost" label={t('common.cancel')} onPress={() => router.back()} style={{ minWidth: 200 }} />
      </View>
    </SafeAreaView>
  );
}
