import { Delete, Fingerprint } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { usePrefs } from '@/lib/prefs';
import { T, tap } from './ui';

/**
 * Four-digit passcode pad: dots fill as you type; a wrong code shakes the dots (no shake with
 * "reduce motion"). Calls onComplete with the four digits; the parent decides what happens.
 */
export function PinPad({ title, message, error, onComplete, onBiometrics, onHud = false }: { title: string; message?: string | null; error?: boolean; onComplete: (pin: string) => void; onBiometrics?: () => void; onHud?: boolean }) {
  const { colors, fonts, t } = usePrefs();
  const [digits, setDigits] = useState('');
  const reduced = useReducedMotion();
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const ink = onHud ? colors.hudText : colors.text;

  useEffect(() => {
    if (!error) return;
    tap('warning');
    setDigits('');
    if (!reduced) shake.value = withSequence(withTiming(-12, { duration: 50 }), withTiming(12, { duration: 70 }), withTiming(-8, { duration: 60 }), withTiming(0, { duration: 60 }));
  }, [error, message, reduced, shake]);

  const press = (d: string) => {
    tap();
    const next = (digits + d).slice(0, 4);
    setDigits(next);
    if (next.length === 4) setTimeout(() => onComplete(next), 120);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];
  return (
    <View style={styles.wrap}>
      <T variant="title" style={{ color: ink, textAlign: 'center' }}>
        {title}
      </T>
      <Animated.View style={[styles.dots, shakeStyle]} accessible accessibilityLabel={`${digits.length} / 4`}>
        {[0, 1, 2, 3].map((i) => (
          <Dot key={i} filled={i < digits.length} color={error ? colors.mag : colors.mint} empty={onHud ? colors.hudMuted : colors.line2} />
        ))}
      </Animated.View>
      <Text style={{ minHeight: 22, textAlign: 'center', color: error ? colors.magInk : onHud ? colors.hudMuted : colors.muted, fontFamily: fonts.medium, fontSize: 14 }}>{message ?? ' '}</Text>
      <View style={styles.grid}>
        {keys.map((k) =>
          k === 'bio' ? (
            onBiometrics ? (
              <Pressable key={k} accessibilityRole="button" accessibilityLabel={t('lock.useBiometrics')} onPress={onBiometrics} style={styles.key}>
                <Fingerprint color={colors.mintInk} size={30} />
              </Pressable>
            ) : (
              <View key={k} style={styles.key} />
            )
          ) : k === 'del' ? (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={t('pin.delete')} onPress={() => setDigits((d) => d.slice(0, -1))} style={styles.key}>
              <Delete color={ink} size={26} />
            </Pressable>
          ) : (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={k} onPress={() => press(k)} style={({ pressed }) => [styles.key, styles.digit, { backgroundColor: pressed ? colors.blueTint : onHud ? 'rgba(255,255,255,0.08)' : colors.panel2 }]}>
              <Text style={{ color: ink, fontFamily: fonts.heading, fontSize: 26 }}>{k}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

function Dot({ filled, color, empty }: { filled: boolean; color: string; empty: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (filled) scale.value = withSequence(withSpring(1.3, { damping: 8 }), withSpring(1));
  }, [filled, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.dot, { borderColor: filled ? color : empty, backgroundColor: filled ? color : 'transparent' }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 18, width: '100%', maxWidth: 340, alignSelf: 'center' },
  dots: { flexDirection: 'row', gap: 18, marginTop: 6 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, width: 300 },
  key: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  digit: { borderRadius: 38 },
});
