import { ActivityIndicator, Pressable, type PressableProps, ScrollView, StyleSheet, Text, type TextProps, TextInput, type TextInputProps, View, type ViewProps } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePrefs } from '@/lib/prefs';

/**
 * Faroz native components: the brand tokens with native layout, not copies of the web components.
 * Touch targets are at least 48 dp; motion is a short fade-in that respects "reduce motion".
 */

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const { colors } = usePrefs();
  const body = <View style={styles.screenInner}>{children}</View>;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

export function Title({ children, style, ...rest }: TextProps) {
  const { colors } = usePrefs();
  return <Text accessibilityRole="header" style={[styles.title, { color: colors.text }, style]} {...rest}>{children}</Text>;
}

export function Body({ children, muted, style, ...rest }: TextProps & { muted?: boolean }) {
  const { colors } = usePrefs();
  return <Text style={[styles.body, { color: muted ? colors.muted : colors.text }, style]} {...rest}>{children}</Text>;
}

export function Card({ children, index = 0, style, ...rest }: ViewProps & { index?: number }) {
  const { colors } = usePrefs();
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(Math.min(index, 6) * 50).duration(260)} style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.line }, style]} {...rest}>
      {children}
    </Animated.View>
  );
}

export function Button({ label, kind = 'primary', busy, ...rest }: PressableProps & { label: string; kind?: 'primary' | 'ghost' | 'danger'; busy?: boolean }) {
  const { colors } = usePrefs();
  const bg = kind === 'primary' ? colors.btn : kind === 'danger' ? colors.danger : 'transparent';
  const fg = kind === 'primary' ? colors.btnInk : kind === 'danger' ? colors.dangerInk : colors.text;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ busy: !!busy, disabled: !!rest.disabled }} style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: kind === 'ghost' ? colors.line2 : bg, opacity: pressed || rest.disabled ? 0.7 : 1 }]} {...rest}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...rest }: TextInputProps & { label: string }) {
  const { colors } = usePrefs();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.faint} style={[styles.input, { color: colors.text, backgroundColor: colors.panel2, borderColor: colors.line2 }]} {...rest} />
    </View>
  );
}

export function Pill({ text, tone }: { text: string; tone: 'mint' | 'blue' | 'mag' | 'gold' | 'neutral' }) {
  const { colors } = usePrefs();
  const map = { mint: [colors.mintTint, colors.mintInk], blue: [colors.blueTint, colors.blueInk], mag: [colors.magTint, colors.magInk], gold: [colors.goldTint, colors.goldInk], neutral: [colors.panel2, colors.muted] } as const;
  const [bg, fg] = map[tone];
  return <Text style={[styles.pill, { backgroundColor: bg, color: fg }]}>{text}</Text>;
}

export function Bar({ percent, tone = 'mint' }: { percent: number; tone?: 'mint' | 'blue' | 'mag' }) {
  const { colors } = usePrefs();
  const fill = tone === 'mint' ? colors.mint : tone === 'blue' ? colors.blue : colors.mag;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={[styles.track, { backgroundColor: colors.track }]}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: fill }]} />
    </View>
  );
}

export function Loading() {
  const { colors, t } = usePrefs();
  return (
    <View style={styles.center} accessibilityLabel={t('common.loading')}>
      <ActivityIndicator color={colors.mint} size="large" />
    </View>
  );
}

export function ErrorBox({ onRetry }: { onRetry: () => void }) {
  const { colors, t } = usePrefs();
  return (
    <View accessibilityRole="alert" style={[styles.card, { backgroundColor: colors.magTint, borderColor: colors.mag }]}>
      <Body>{t('common.error')}</Body>
      <View style={{ height: 12 }} />
      <Button kind="ghost" label={t('common.retry')} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  screenInner: { flex: 1, padding: 20, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 23 },
  card: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 10 },
  button: { minHeight: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 16 },
  pill: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontSize: 12, fontWeight: '700' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
});
