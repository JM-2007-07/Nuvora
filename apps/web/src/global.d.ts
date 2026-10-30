import type messages from '../messages/en.json';
import type assess from '../messages/parts/assess/en.json';
import type account from '../messages/parts/account/en.json';
import type admin from '../messages/parts/admin/en.json';
import type consent from '../messages/parts/consent/en.json';
import type learn from '../messages/parts/learn/en.json';
import type site from '../messages/parts/site/en.json';
import type work from '../messages/parts/work/en.json';
import type { routing } from './i18n/routing';

// Type-safe locales and message keys for next-intl (missing keys fail typecheck).
// Parts (messages/parts/<part>/en.json) add their own namespaces; see src/i18n/request.ts.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages & typeof site & typeof learn & typeof work & typeof assess & typeof consent & typeof account & typeof admin;
  }
}
