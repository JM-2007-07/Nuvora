import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { type AppLocale, type MessageKey, messages } from '@/i18n/messages';
import { darkGradients, darkTokens, type Gradients, lightGradients, lightTokens, type Tokens } from '@/theme/tokens';
import { getItem, setItem } from './storage';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** Font families (loaded in the root layout). Tajik headings use Inter: Unbounded lacks ҳ ҷ ӣ ғ қ ӯ. */
export interface Fonts {
  display: string;
  heading: string;
  body: string;
  medium: string;
  semibold: string;
  bold: string;
}

const UNBOUNDED: Pick<Fonts, 'display' | 'heading'> = { display: 'Unbounded_700Bold', heading: 'Unbounded_600SemiBold' };
const INTER_HEADINGS: Pick<Fonts, 'display' | 'heading'> = { display: 'Inter_700Bold', heading: 'Inter_700Bold' };
const INTER_TEXT = { body: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' };

interface Prefs {
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
  colors: Tokens;
  gradients: Gradients;
  fonts: Fonts;
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

/** Theme (system / light / dark), language and the derived colours and fonts, remembered on the device. */
export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeChoice>('system');
  const [locale, setLocaleState] = useState<AppLocale>(deviceLocale());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [t, l] = await Promise.all([getItem(THEME_KEY), getItem(LOCALE_KEY)]);
        if (t === 'system' || t === 'light' || t === 'dark') setThemeState(t);
        if (l === 'ru' || l === 'tg' || l === 'en') setLocaleState(l);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t);
    void setItem(THEME_KEY, t).catch(() => undefined);
  }, []);
  const setLocale = useCallback((l: AppLocale) => {
    setLocaleState(l);
    void setItem(LOCALE_KEY, l).catch(() => undefined);
  }, []);

  // Faroz is dark by default (D-23): "system" follows the device, anything but light stays dark.
  const dark = theme === 'dark' || (theme === 'system' && scheme !== 'light');
  const value = useMemo<Prefs>(
    () => ({
      theme,
      setTheme,
      colors: dark ? darkTokens : lightTokens,
      gradients: (dark ? darkGradients : lightGradients) as Gradients,
      fonts: { ...(locale === 'tg' ? INTER_HEADINGS : UNBOUNDED), ...INTER_TEXT },
      dark,
      locale,
      setLocale,
      ready,
      t: (key, vars) => {
        let text: string = messages[locale][key] ?? messages.ru[key];
        for (const [k, v] of Object.entries(vars ?? {})) text = text.replaceAll(`{${k}}`, String(v));
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
