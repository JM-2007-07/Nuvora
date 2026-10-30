import { isLocale } from '@nuvora/shared';
import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { LOCALE_COOKIE, routing } from './i18n/routing';

const intlProxy = createMiddleware(routing);

/**
 * Next.js 16 Proxy (formerly middleware).
 * "/" goes to the learner's saved language if there is one, otherwise to the default locale (/ru).
 * Browser language is deliberately ignored (D-06).
 */
export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    const saved = request.cookies.get(LOCALE_COOKIE)?.value;
    if (isLocale(saved)) {
      return NextResponse.redirect(new URL(`/${saved}`, request.url));
    }
  }
  return intlProxy(request);
}

export const config = {
  // Skip the /api/v1 rewrite to the API, Next.js internals, static brand assets, and any file with an extension.
  // Profile addresses may contain dots (/ru/u/amina.rahimova), so they are matched explicitly:
  // without this the locale would not be set and the page would render in the default language.
  matcher: ['/((?!api|_next|_vercel|brand|.*\\..*).*)', '/:locale(ru|tg|en)/u/:path*'],
};
