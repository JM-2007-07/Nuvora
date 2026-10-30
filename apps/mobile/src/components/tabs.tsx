import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '@/lib/auth';
import { usePrefs } from '@/lib/prefs';
import type { MessageKey } from '@/i18n/messages';

/** Bottom tabs for one area; anyone without the right identity is sent back to sign-in. */
export function AreaTabs({ area, tabs }: { area: 'learner' | 'staff'; tabs: { name: string; title: MessageKey; glyph: string }[] }) {
  const { colors, t } = usePrefs();
  const { kind } = useAuth();
  if (kind === 'none') return <Redirect href="/sign-in" />;
  if (kind && kind !== area) return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.mintInk,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { backgroundColor: colors.sideBg, borderTopColor: colors.line, minHeight: 60 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }} accessibilityElementsHidden importantForAccessibility="no">{tab.glyph}</Text>,
          }}
        />
      ))}
    </Tabs>
  );
}
