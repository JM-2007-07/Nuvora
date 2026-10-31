import { Redirect, Tabs } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MessageKey } from '@/i18n/messages';
import { useAuth } from '@/lib/auth';
import { usePrefs } from '@/lib/prefs';
import { tap } from './ui';

/** Bottom tabs for one area; anyone without the right identity is sent back to sign-in. */
export function AreaTabs({ area, tabs }: { area: 'learner' | 'staff'; tabs: { name: string; title: MessageKey; icon: LucideIcon; hidden?: boolean }[] }) {
  const { colors, fonts, t } = usePrefs();
  const { kind } = useAuth();
  const insets = useSafeAreaInsets();
  if (kind === 'none') return <Redirect href="/sign-in" />;
  // Straight to the right area: "/" can resolve back to this group's index and loop.
  if (kind && kind !== area) return <Redirect href={kind === 'staff' ? '/(staff)' : '/(learner)'} />;
  return (
    <Tabs
      screenListeners={{ tabPress: () => tap() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.mintInk,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.sideBg,
          borderTopColor: colors.line,
          height: 64 + Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 0),
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}
    >
      {tabs.map(({ name, title, icon: Icon, hidden }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(title),
            ...(hidden ? { href: null } : {}),
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 52, height: 30, borderRadius: 15, backgroundColor: focused ? colors.mintTint : 'transparent' }}>
                <Icon color={color} size={21} strokeWidth={focused ? 2.4 : 2} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
