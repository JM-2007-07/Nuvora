import { androidBuild } from '@/lib/android-build';

/**
 * https://<site>/faroz.apk — one stable address for the Android app (download button, QR codes,
 * slides). It redirects to the current APK file, so a new build only changes ANDROID_APK_URL.
 * The path has a file extension, so the locale proxy leaves it alone.
 */
export function GET(request: Request): Response {
  const build = androidBuild();
  if (!build) return Response.redirect(new URL('/ru/download', request.url), 307);
  return new Response(null, { status: 307, headers: { Location: build.url, 'Cache-Control': 'no-store' } });
}
