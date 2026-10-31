import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, CircleAlert, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  RefreshControl,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { usePrefs } from '@/lib/prefs';
import type { Tokens } from '@/theme/tokens';

/**
 * Faroz native design system: the brand tokens and fonts with native layout and touch behaviour,
 * not copies of the web components. Targets are at least 48 dp; motion is short, springy and
 * switched off with the system's "reduce motion".
 */

export type Tone = 'mint' | 'blue' | 'mag' | 'gold' | 'neutral';

export function toneColors(colors: Tokens, tone: Tone): { bg: string; fg: string; solid: string } {
  switch (tone) {
    case 'mint':
      return { bg: colors.mintTint, fg: colors.mintInk, solid: colors.mint };
    case 'blue':
      return { bg: colors.blueTint, fg: colors.blueInk, solid: colors.blue };
    case 'mag':
      return { bg: colors.magTint, fg: colors.magInk, solid: colors.mag };
    case 'gold':
      return { bg: colors.goldTint, fg: colors.goldInk, solid: colors.gold };
    default:
      return { bg: colors.panel2, fg: colors.muted, solid: colors.line2 };
  }
}

export function tap(kind: 'light' | 'medium' | 'success' | 'warning' = 'light'): void {
  if (Platform.OS === 'web') return;
  if (kind === 'success' || kind === 'warning') void Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  else void Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

// ---------- typography ----------

type Variant = 'display' | 'title' | 'heading' | 'body' | 'strong' | 'caption' | 'label' | 'mono' | 'number';
type Ink = 'text' | 'muted' | 'faint' | Tone | 'onHud' | 'onHudMuted' | 'onBtn';

export function T({ variant = 'body', ink = 'text', style, children, ...rest }: TextProps & { variant?: Variant; ink?: Ink }) {
  const { colors, fonts } = usePrefs();
  const color =
    ink === 'text' ? colors.text : ink === 'muted' ? colors.muted : ink === 'faint' ? colors.faint : ink === 'onHud' ? colors.hudText : ink === 'onHudMuted' ? colors.hudMuted : ink === 'onBtn' ? colors.btnInk : toneColors(colors, ink).fg;
  const v: Record<Variant, TextStyle> = {
    display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
    title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
    heading: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 23 },
    body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
    strong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
    caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
    label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
    mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 14, lineHeight: 20 },
    number: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, fontVariant: ['tabular-nums'] },
  };
  return (
    <Text accessibilityRole={variant === 'display' || variant === 'title' ? 'header' : undefined} style={[v[variant], { color }, style]} {...rest}>
      {children}
    </Text>
  );
}

// ---------- layout ----------

export function Screen({
  title,
  subtitle,
  back,
  right,
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
}) {
  const { colors, t } = usePrefs();
  const header =
    title || back ? (
      <View style={styles.header}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[styles.backBtn, { backgroundColor: colors.panel, borderColor: colors.line }]}>
            <ChevronLeft color={colors.text} size={22} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, gap: 4 }}>
          {title ? <T variant={back ? 'title' : 'display'}>{title}</T> : null}
          {subtitle ? <T ink="muted">{subtitle}</T> : null}
        </View>
        {right}
      </View>
    ) : null;
  const inner = (
    <View style={[styles.inner, !padded && { paddingHorizontal: 0 }]}>
      {header}
      {children}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.mint} colors={[colors.mint]} /> : undefined}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Section({ title, action, children, style }: { title: string; action?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 10 }, style]}>
      <View style={styles.sectionHead}>
        <T variant="heading" style={{ flex: 1 }}>
          {title}
        </T>
        {action}
      </View>
      {children}
    </View>
  );
}

// ---------- surfaces ----------

export function Card({ children, index = 0, style, onPress, accessibilityLabel, ...rest }: ViewProps & { index?: number; onPress?: () => void }) {
  const { colors } = usePrefs();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // The entrance animation and the press spring live on separate views (Reanimated would otherwise fight over
  // transform); layout keys (flex, width, margins) go to the outer view so the card still sizes as asked.
  const { outer, inner } = splitLayout(style);
  const body = (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(Math.min(index, 8) * 45).duration(280)} style={outer}>
      <Animated.View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.line }, pressStyle, inner]} {...rest}>
        {children}
      </Animated.View>
    </Animated.View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        tap();
        onPress();
      }}
      onPressIn={() => {
        if (!reduced) scale.value = withSpring(0.98, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 16, stiffness: 260 });
      }}
    >
      {body}
    </Pressable>
  );
}

const LAYOUT_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'minWidth', 'maxWidth', 'alignSelf', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical'] as const;

function splitLayout(style: StyleProp<ViewStyle>): { outer: ViewStyle; inner: ViewStyle } {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) ((LAYOUT_KEYS as readonly string[]).includes(k) ? outer : inner)[k] = v;
  if (outer.flex !== undefined) inner.flex = 1;
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

/** The Faroz HUD card: brand gradient, blue border, light text. */
export function Hud({ children, style, index = 0 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; index?: number }) {
  const { colors, gradients } = usePrefs();
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(index * 45).duration(320)} style={[styles.hudWrap, { borderColor: colors.hudBorder, shadowColor: colors.hudBorder }, style]}>
      <LinearGradient colors={gradients.hud} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.hud}>
        {children}
      </LinearGradient>
    </Animated.View>
  );
}

// ---------- controls ----------

export function Button({
  label,
  kind = 'primary',
  icon: Icon,
  busy,
  compact,
  style,
  onPress,
  ...rest
}: Omit<PressableProps, 'style'> & { label: string; kind?: 'primary' | 'ghost' | 'danger' | 'hud' | 'hudGhost' | 'soft'; icon?: LucideIcon; busy?: boolean; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors, fonts } = usePrefs();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const palette = {
    primary: { bg: colors.btn, fg: colors.btnInk, border: colors.btn },
    hud: { bg: colors.hudBtn, fg: colors.hudBtnInk, border: colors.hudBtn },
    danger: { bg: colors.danger, fg: colors.dangerInk, border: colors.danger },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.line2 },
    soft: { bg: colors.panel2, fg: colors.text, border: colors.panel2 },
    hudGhost: { bg: 'transparent', fg: colors.hudText, border: colors.hudMuted },
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: !!rest.disabled }}
      onPressIn={() => {
        if (!reduced) scale.value = withSpring(0.96, { damping: 18, stiffness: 340 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
      onPress={(e) => {
        tap(kind === 'danger' ? 'medium' : 'light');
        onPress?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[styles.button, compact && styles.buttonCompact, { backgroundColor: palette.bg, borderColor: palette.border, opacity: rest.disabled ? 0.5 : 1 }, animated, style]}>
        {busy ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <>
            {Icon ? <Icon color={palette.fg} size={compact ? 16 : 18} strokeWidth={2.2} /> : null}
            <Text style={{ color: palette.fg, fontFamily: fonts.semibold, fontSize: compact ? 14 : 16 }}>{label}</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function IconBadge({ icon: Icon, tone = 'neutral', size = 40 }: { icon: LucideIcon; tone?: Tone; size?: number }) {
  const { colors } = usePrefs();
  const c = toneColors(colors, tone);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon color={c.fg} size={size * 0.48} strokeWidth={2.2} />
    </View>
  );
}

export function Pill({ text, tone = 'neutral', icon: Icon, center }: { text: string; tone?: Tone; icon?: LucideIcon; center?: boolean }) {
  const { colors, fonts } = usePrefs();
  const c = toneColors(colors, tone);
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }, center && { alignSelf: 'center' }]}>
      {Icon ? <Icon color={c.fg} size={13} strokeWidth={2.4} /> : null}
      <Text style={{ color: c.fg, fontFamily: fonts.semibold, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

/** A list row. `badge` sits under the text (status pills on narrow screens); `right` sits beside it. */
export function Row({ icon, tone, title, subtitle, badge, right, onPress, index = 0, chevron = true }: { icon?: LucideIcon; tone?: Tone; title: string; subtitle?: string; badge?: React.ReactNode; right?: React.ReactNode; onPress?: () => void; index?: number; chevron?: boolean }) {
  const { colors } = usePrefs();
  return (
    <Card index={index} onPress={onPress} accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title} style={styles.row}>
      {icon ? <IconBadge icon={icon} tone={tone} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="strong" numberOfLines={2}>
          {title}
        </T>
        {subtitle ? (
          <T variant="caption" ink="muted" numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
        {badge ? <View style={{ flexDirection: 'row', marginTop: 4 }}>{badge}</View> : null}
      </View>
      {right}
      {onPress && chevron ? <ChevronRight color={colors.faint} size={20} /> : null}
    </Card>
  );
}

export function Segmented<K extends string>({ value, options, onChange, label }: { value: K; options: { key: K; label: string }[]; onChange: (k: K) => void; label: string }) {
  const { colors, fonts } = usePrefs();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segment, { backgroundColor: colors.panel2, borderColor: colors.line }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              tap();
              onChange(o.key);
            }}
            style={[styles.segmentItem, on && { backgroundColor: colors.sel }]}
          >
            <Text numberOfLines={1} style={{ color: on ? colors.selInk : colors.text, fontFamily: fonts.semibold, fontSize: 14 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, ...rest }: TextInputProps & { label: string }) {
  const { colors, fonts } = usePrefs();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T variant="caption" ink="muted" style={{ fontFamily: fonts.semibold }}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.faint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, { color: colors.text, backgroundColor: colors.panel2, borderColor: focused ? colors.blue : colors.line2, fontFamily: fonts.body }]}
        {...rest}
      />
    </View>
  );
}

// ---------- data ----------

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Progress ring drawn with SVG; fills from zero once (no motion with "reduce motion"). */
export function Ring({ percent, size = 76, stroke = 8, tone = 'mint', children, label }: { percent: number; size?: number; stroke?: number; tone?: Tone; children?: React.ReactNode; label?: string }) {
  const { colors } = usePrefs();
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(reduced ? percent : 0);
  useEffect(() => {
    progress.value = reduced ? percent : withTiming(percent, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [percent, reduced, progress]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - Math.max(0, Math.min(100, progress.value)) / 100) }));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={toneColors(colors, tone).solid}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function Bar({ percent, tone = 'mint', height = 8 }: { percent: number; tone?: Tone; height?: number }) {
  const { colors } = usePrefs();
  const reduced = useReducedMotion();
  const width = useSharedValue(reduced ? percent : 0);
  useEffect(() => {
    width.value = reduced ? percent : withTiming(percent, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [percent, reduced, width]);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(100, width.value))}%` }));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ height, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.track }}>
      <Animated.View style={[{ height, borderRadius: 999, backgroundColor: toneColors(colors, tone).solid }, style]} />
    </View>
  );
}

// ---------- states ----------

export function Skeleton({ height = 96, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = usePrefs();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    if (!reduced) opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [reduced, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ height, borderRadius: 22, backgroundColor: colors.panel2 }, animated, style]} />;
}

export function Loading({ rows = 3 }: { rows?: number }) {
  const { t } = usePrefs();
  return (
    <View accessible accessibilityLabel={t('common.loading')} style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={i === 0 ? 140 : 84} />
      ))}
    </View>
  );
}

export function Empty({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: React.ReactNode }) {
  const { colors } = usePrefs();
  return (
    <View style={[styles.empty, { borderColor: colors.line2 }]}>
      <IconBadge icon={Icon} tone="blue" size={52} />
      <T variant="strong" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {body ? (
        <T ink="muted" style={{ textAlign: 'center' }}>
          {body}
        </T>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorBox({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const { colors, t } = usePrefs();
  return (
    <View accessibilityRole="alert" style={[styles.card, { backgroundColor: colors.magTint, borderColor: colors.mag, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
      <CircleAlert color={colors.magInk} size={22} />
      <T style={{ flex: 1 }}>{message ?? t('common.error')}</T>
      <Button kind="ghost" compact label={t('common.retry')} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 18, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  backBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 10 },
  hudWrap: { borderRadius: 26, borderWidth: 1, overflow: 'hidden', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  hud: { padding: 20, gap: 12 },
  button: { minHeight: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 18 },
  buttonCompact: { minHeight: 44, borderRadius: 14, paddingHorizontal: 14 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  input: { minHeight: 52, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, fontSize: 16 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 22, padding: 24, alignItems: 'center', gap: 10 },
});
