import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { type AppLocale, type MessageKey, messages } from '@/i18n/messages';
import { darkTokens, lightTokens, type Tokens } from '@/theme/tokens';

export type ThemeChoice = 'system' | 'light' | 'dark';

interface Prefs {
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
  colors: Tokens;
  dark: boolean;
  locale: AppLocale;
  setLocale: (l: AppLocale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  ready: boolean;
}

const PrefsContext = createContext<Prefs | null>(null);
const THEME_KEY = 'faroz.theme';
const LOCALE_KEY = 'faroz.locale';

/** Russian unless the device or the user picked Tajik or English (same default as the website). */
function deviceLocale(): AppLocale {
  const code = getLocales()[0]?.languageCode;
  return code === 'tg' || code === 'en' ? code : 'ru';
}

/** Theme (system / light / dark) and language, remembered on the device. */
export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeChoice>('system');
  const [locale, setLocaleState] = useState<AppLocale>(deviceLocale());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [t, l] = await Promise.all([SecureStore.getItemAsync(THEME_KEY), SecureStore.getItemAsync(LOCALE_KEY)]);
        if (t === 'system' || t === 'light' || t === 'dark') setThemeState(t);
        if (l === 'ru' || l === 'tg' || l === 'en') setLocaleState(l);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t);
    void SecureStore.setItemAsync(THEME_KEY, t).catch(() => undefined);
  }, []);
  const setLocale = useCallback((l: AppLocale) => {
    setLocaleState(l);
    void SecureStore.setItemAsync(LOCALE_KEY, l).catch(() => undefined);
  }, []);

  const dark = theme === 'dark' || (theme === 'system' && scheme !== 'light');
  const value = useMemo<Prefs>(
    () => ({
      theme,
      setTheme,
      colors: dark ? darkTokens : lightTokens,
      dark,
      locale,
      setLocale,
      ready,
      t: (key, vars) => {
        let text: string = messages[locale][key] ?? messages.ru[key];
        for (const [k, v] of Object.entries(vars ?? {})) text = text.replace(`{${k}}`, String(v));
        return text;
      },
    }),
    [theme, setTheme, dark, locale, setLocale, ready],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const prefs = useContext(PrefsContext);
  if (!prefs) throw new Error('usePrefs outside PrefsProvider');
  return prefs;
}
