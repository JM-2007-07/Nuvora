import type { DemoTokenRequest } from '@nuvora/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Body, Button, Card, Field, Screen, Title } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePrefs } from '@/lib/prefs';

/** Email and password (with the two-factor code when the account has it on), or a demo identity. */
export default function SignIn() {
  const { t, colors } = usePrefs();
  const { signIn, signInDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needCode, setNeedCode] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const explain = (e: unknown) => {
    if (!(e instanceof ApiError)) return t('auth.offline');
    if (e.code === 'MFA_REQUIRED' || e.code === 'MFA_INVALID') {
      setNeedCode(true);
      return t('auth.mfa');
    }
    if (e.status === 429) return t('auth.limited');
    return t('auth.wrong');
  };

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      router.replace('/');
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(null);
    }
  };

  const demo = (key: string, request: DemoTokenRequest) => run(key, () => signInDemo(request));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={styles.brand}>
          <Image source={require('../../assets/mark.png')} style={styles.mark} accessibilityIgnoresInvertColors />
          <Title>{t('auth.title')}</Title>
          <Body muted>{t('auth.subtitle')}</Body>
        </View>
        <Card>
          <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
          <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
          {needCode ? <Field label={t('auth.code')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" /> : null}
          {error ? (
            <Body accessibilityRole="alert" style={{ color: colors.magInk }}>
              {error}
            </Body>
          ) : null}
          <Button label={t('auth.signIn')} busy={busy === 'password'} disabled={!!busy || !email || !password} onPress={() => void run('password', () => signIn(email.trim(), password, needCode ? code : undefined))} />
        </Card>
        <Card index={1}>
          <Body muted>{t('auth.demo')}</Body>
          <Button kind="ghost" label={t('auth.demoLearner')} busy={busy === 'amina'} disabled={!!busy} onPress={() => void demo('amina', { profile: 'amina-rahimova' })} />
          <Button kind="ghost" label={t('auth.demoGuest')} busy={busy === 'guest'} disabled={!!busy} onPress={() => void demo('guest', { guest: true })} />
          <Button kind="ghost" label={t('auth.demoTeacher')} busy={busy === 'dilshod'} disabled={!!busy} onPress={() => void demo('dilshod', { staff: 'dilshod-karimov' })} />
          <Button kind="ghost" label={t('auth.demoCenter')} busy={busy === 'farhod'} disabled={!!busy} onPress={() => void demo('farhod', { staff: 'farhod-jalilov' })} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: { gap: 8, marginTop: 24, marginBottom: 4 },
  mark: { width: 56, height: 56, marginBottom: 8 },
});
