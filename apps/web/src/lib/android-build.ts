/**
 * The Android build offered on the site. Set on the server (Render: faroz-web environment):
 * ANDROID_APK_URL — an https link to the APK file (an EAS artifact or a GitHub release asset);
 * ANDROID_APP_VERSION — optional, shown next to the button.
 * Read on each request, so changing the variables needs no rebuild.
 */
export const APK_PATH = '/faroz.apk';

export function androidBuild(): { url: string; version: string | null } | null {
  const url = process.env.ANDROID_APK_URL;
  if (!url) return null;
  try {
    if (new URL(url).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  const version = process.env.ANDROID_APP_VERSION?.trim();
  return { url, version: version && /^[\w.+-]{1,32}$/.test(version) ? version : null };
}
