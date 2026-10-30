'use client';

/*
 * Notifications for messages and calls (no package):
 * - the page is hidden (another tab or app): a system notification through the browser, if the
 *   person allowed it; clicking it brings Faroz to the front and opens the chat;
 * - the page is visible: the in-app toast (chat-dock.tsx) and a short soft ping.
 * They work while Faroz is open in a tab. Notifications with the browser fully closed would need
 * Web Push (a service worker and a push service), which this local demo does not use.
 */

const DISMISSED = 'faroz-notify-dismissed';

export type NotifyPermission = NotificationPermission | 'unsupported';

export function notifyPermission(): NotifyPermission {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}

/** The "turn on notifications?" banner was dismissed on this device. */
export function notifyDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === '1';
  } catch {
    return false;
  }
}

export function dismissNotify(): void {
  try {
    localStorage.setItem(DISMISSED, '1');
  } catch {
    // storage blocked: the banner just shows again next time
  }
}

/** Asks the browser (must run in a click handler). */
export async function requestNotify(): Promise<NotifyPermission> {
  if (notifyPermission() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return notifyPermission();
  }
}

/** A system notification; `tag` replaces an older one for the same chat instead of stacking. */
export function systemNotify(opts: { title: string; body: string; icon?: string | null; tag: string; onClick: () => void; sticky?: boolean }): boolean {
  if (notifyPermission() !== 'granted') return false;
  try {
    const n = new Notification(opts.title, { body: opts.body, icon: opts.icon ?? '/brand/faroz-app-icon.svg', tag: opts.tag, requireInteraction: opts.sticky ?? false });
    n.onclick = () => {
      window.focus();
      opts.onClick();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

let audio: AudioContext | null = null;

/** A short, quiet two-note ping (Web Audio; no sound file). */
export function ping(): void {
  try {
    audio ??= new AudioContext();
    const now = audio.currentTime;
    for (const [i, f] of [880, 1320].entries()) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, now + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.05, now + i * 0.09 + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.09 + 0.16);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.18);
    }
  } catch {
    // audio unavailable or not yet allowed by the browser: stay silent
  }
}
