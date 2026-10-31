import type { DemoTokenRequest } from '@nuvora/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Building2, GraduationCap, LogIn, Presentation, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Button, Card, Field, Row, Screen, Segmented, T } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePrefs } from '@/lib/prefs';

/** Sign-in: email and password (with the two-factor code when it is on) or a demo identity. */
export default function SignIn() {
  const { t, colors, gradients } = usePrefs();
  const { signIn, signInDemo } = useAuth();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<'account' | 'demo'>('demo');
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
      if (__DEV__) console.warn('[sign-in]', e);
      setError(explain(e));
    } finally {
      setBusy(null);
    }
  };
  const demo = (key: string, request: DemoTokenRequest) => run(key, () => signInDemo(request));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Animated.View entering={reduced ? undefined : FadeInDown.duration(380)} style={[styles.hero, { borderColor: colors.hudBorder }]}>
          <LinearGradient colors={gradients.hud} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroInner}>
            <View style={[styles.orbit, { borderColor: colors.hudMuted }]} />
            <View style={[styles.orbit2, { borderColor: colors.blue }]} />
            <Image source={require('../../assets/mark.png')} style={styles.mark} accessibilityIgnoresInvertColors />
            <T variant="display" ink="onHud">
              {t('app.name')}
            </T>
            <T ink="onHudMuted">{t('app.tagline')}</T>
          </LinearGradient>
        </Animated.View>

        <View style={{ gap: 6 }}>
          <T variant="title">{t('auth.title')}</T>
          <T ink="muted">{t('auth.subtitle')}</T>
        </View>

        <Segmented label={t('auth.title')} value={tab} onChange={setTab} options={[{ key: 'demo', label: t('auth.tabDemo') }, { key: 'account', label: t('auth.tabAccount') }]} />

        {error ? (
          <Card style={{ backgroundColor: colors.magTint, borderColor: colors.mag }}>
            <T accessibilityRole="alert">{error}</T>
          </Card>
        ) : null}

        {tab === 'account' ? (
          <Card>
            <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
            <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
            {needCode ? <Field label={t('auth.code')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" /> : null}
            <Button icon={LogIn} label={t('auth.signIn')} busy={busy === 'password'} disabled={!!busy || !email || !password} onPress={() => void run('password', () => signIn(email.trim(), password, needCode ? code : undefined))} />
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            <T variant="caption" ink="muted">
              {t('auth.demoHint')}
            </T>
            <Row index={0} icon={GraduationCap} tone="mint" title={t('auth.demoLearner')} subtitle={t('auth.demoLearnerSub')} onPress={busy ? undefined : () => void demo('amina', { profile: 'amina-rahimova' })} />
            <Row index={1} icon={UserRound} tone="neutral" title={t('auth.demoGuest')} subtitle={t('auth.demoGuestSub')} onPress={busy ? undefined : () => void demo('guest', { guest: true })} />
            <Row index={2} icon={Presentation} tone="blue" title={t('auth.demoTeacher')} subtitle={t('auth.demoTeacherSub')} onPress={busy ? undefined : () => void demo('dilshod', { staff: 'dilshod-karimov' })} />
            <Row index={3} icon={Building2} tone="gold" title={t('auth.demoCenter')} subtitle={t('auth.demoCenterSub')} onPress={busy ? undefined : () => void demo('farhod', { staff: 'farhod-jalilov' })} />
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, borderWidth: 1, overflow: 'hidden', marginTop: 8 },
  heroInner: { padding: 24, gap: 6, minHeight: 210, justifyContent: 'flex-end' },
  mark: { width: 64, height: 64, marginBottom: 10 },
  orbit: { position: 'absolute', right: -40, top: -30, width: 200, height: 200, borderRadius: 100, borderWidth: 1, opacity: 0.35 },
  orbit2: { position: 'absolute', right: 10, top: 20, width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, opacity: 0.5 },
});
