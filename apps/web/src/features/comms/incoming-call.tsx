'use client';

import { MicIcon, PhoneIcon, PhoneOffIcon, VideoIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Avatar } from './avatar';
import type { Incoming } from './comms-provider';

/** A soft two-tone ring (Web Audio, no sound file), repeated until answered or dismissed. */
function useRingtone() {
  useEffect(() => {
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    const ring = () => {
      if (!ctx) return;
      const now = ctx.currentTime;
      for (const [i, f] of [660, 880].entries()) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, now + i * 0.22);
        gain.gain.linearRampToValueAtTime(0.08, now + i * 0.22 + 0.03);
        gain.gain.linearRampToValueAtTime(0, now + i * 0.22 + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.22);
        osc.stop(now + i * 0.22 + 0.22);
      }
    };
    ring();
    const id = setInterval(ring, 1800);
    return () => {
      clearInterval(id);
      void ctx?.close();
    };
  }, []);
}

/** Incoming call card: who calls, audio or video; accept (with video or audio only) or decline. */
export function IncomingCall({ incoming, onAccept, onDecline }: { incoming: Incoming; onAccept: (media: 'audio' | 'video') => void; onDecline: () => void }) {
  const t = useTranslations('Comms');
  useRingtone();
  const video = incoming.call.media === 'video';
  const label = incoming.kind === 'GROUP' ? t('incomingGroup', { name: incoming.from.name }) : video ? t('incomingVideo') : t('incomingAudio');
  return (
    <div role="alertdialog" aria-labelledby="fz-incoming-title" aria-describedby="fz-incoming-what" className="fz-call-in fixed top-4 right-4 left-4 z-[70] mx-auto flex max-w-[400px] flex-col gap-4 rounded-[24px] border border-(--hud-border) p-5 text-(--hud-text) shadow-(--card-glow-hover) [background:var(--hud)] sm:left-auto">
      <div className="flex items-center gap-4">
        <span className="fz-call-ring rounded-full p-1">
          <Avatar name={incoming.kind === 'GROUP' ? incoming.title : incoming.from.name} size={56} />
        </span>
        <div className="min-w-0">
          <p id="fz-incoming-title" className="m-0 truncate font-brand text-lg font-bold">
            {incoming.title}
          </p>
          <p id="fz-incoming-what" className="m-0 text-sm text-(--hud-muted)">
            {label}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onDecline} className="fz-btn min-h-12 flex-1 bg-(--mag) text-(--on-blue) hover:brightness-110">
          <PhoneOffIcon aria-hidden="true" className="size-4" />
          {t('decline')}
        </button>
        {video ? (
          <button type="button" onClick={() => onAccept('audio')} aria-label={t('acceptAudio')} title={t('acceptAudio')} className="fz-btn fz-btn-hud-ghost min-h-12 px-4">
            <MicIcon aria-hidden="true" className="size-4" />
          </button>
        ) : null}
        <button type="button" onClick={() => onAccept(incoming.call.media)} autoFocus className="fz-btn fz-btn-hud min-h-12 flex-1">
          {video ? <VideoIcon aria-hidden="true" className="size-4" /> : <PhoneIcon aria-hidden="true" className="size-4" />}
          {t('accept')}
        </button>
      </div>
    </div>
  );
}
