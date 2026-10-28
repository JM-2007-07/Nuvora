import type messages from '../messages/en.json';
import type { routing } from './i18n/routing';

// Type-safe locales and message keys for next-intl (missing keys fail typecheck).
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
