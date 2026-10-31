import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Unbounded_600SemiBold } from '@expo-google-fonts/unbounded/600SemiBold';
import { Unbounded_700Bold } from '@expo-google-fonts/unbounded/700Bold';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { useNetworkState } from 'expo-network';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockScreen } from '@/components/lock-screen';
import { ApiError } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LockProvider, useLock } from '@/lib/lock';
import { flushQueue } from '@/lib/offline';
import { PrefsProvider, usePrefs } from '@/lib/prefs';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Sends offline practice whenever the device is (back) online and a learner is signed in. */
function OfflineSync() {
  const network = useNetworkState();
  const { kind } = useAuth();
  const { locale } = usePrefs();
  const queryClient = useQueryClient();
  const online = network.isInternetReachable ?? network.isConnected ?? false;
  useEffect(() => {
    if (!online || kind !== 'learner') return;
    void flushQueue(locale).then((sent) => {
      if (sent) void queryClient.invalidateQueries();
    });
  }, [online, kind, locale, queryClient]);
  return null;
}

function Shell() {
  const { colors, dark, fonts } = usePrefs();
  const { locked } = useLock();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);
  }, [colors.bg]);
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <OfflineSync />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
          headerTitleStyle: { fontFamily: fonts.heading },
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        <Stack.Screen name="(learner)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(staff)" options={{ animation: 'fade' }} />
        <Stack.Screen name="exam/[id]" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="pin-setup" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      {locked ? <LockScreen /> : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Unbounded_600SemiBold, Unbounded_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // 4xx answers are final (no session, no access); network problems are retried.
            retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
          },
        },
      }),
  );
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PrefsProvider>
            <AuthProvider>
              <LockProvider>
                <Shell />
              </LockProvider>
            </AuthProvider>
          </PrefsProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
