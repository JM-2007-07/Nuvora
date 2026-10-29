'use client';

import { VOICE_MAX_MS } from '@nuvora/shared';
import { PauseIcon, PlayIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clock } from './avatar';

const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export type RecorderState = { status: 'idle' } | { status: 'recording'; startedAt: number; level: number } | { status: 'denied' };

/**
 * Voice message recording (MediaRecorder; opus in webm, or AAC in mp4 on Safari).
 * Stops by itself at the 3-minute limit. `level` (0–1) drives the live meter.
 */
export function useVoiceRecorder(onDone: (blob: Blob, ms: number) => void) {
  const [state, setState] = useState<RecorderState>({ status: 'idle' });
  const rec = useRef<{ recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; startedAt: number; send: boolean; ctx: AudioContext; raf: number; limit: ReturnType<typeof setTimeout> } | null>(null);

  const stopAll = useCallback((send: boolean) => {
    const r = rec.current;
    if (!r) return;
    r.send = send;
    cancelAnimationFrame(r.raf);
    clearTimeout(r.limit);
    if (r.recorder.state !== 'inactive') r.recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (rec.current || typeof MediaRecorder === 'undefined') return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setState({ status: 'denied' });
      return;
    }
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 48_000 } : undefined);
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const startedAt = Date.now();
    const r = { recorder, stream, chunks: [] as Blob[], startedAt, send: false, ctx, raf: 0, limit: setTimeout(() => stopAll(true), VOICE_MAX_MS) };
    rec.current = r;
    recorder.ondataavailable = (e) => {
      if (e.data.size) r.chunks.push(e.data);
    };
    recorder.onstop = () => {
      const ms = Date.now() - r.startedAt;
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      rec.current = null;
      setState({ status: 'idle' });
      if (r.send && ms >= 400 && r.chunks.length) onDone(new Blob(r.chunks, { type: recorder.mimeType || 'audio/webm' }), ms);
    };
    const meter = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
      setState({ status: 'recording', startedAt, level: Math.min(1, peak * 2.2) });
      r.raf = requestAnimationFrame(meter);
    };
    recorder.start(250);
    meter();
  }, [onDone, stopAll]);

  useEffect(() => () => stopAll(false), [stopAll]);

  return { state, start, send: () => stopAll(true), cancel: () => stopAll(false), reset: () => setState({ status: 'idle' }) };
}

/** Voice message in a bubble: play/pause, progress, time. Loads only when played. */
export function VoiceBubble({ url, durationMs, mine }: { url: string; durationMs: number; mine: boolean }) {
  const t = useTranslations('Comms');
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const total = durationMs / 1000;

  useEffect(() => () => audio.current?.pause(), []);

  const toggle = () => {
    if (!audio.current) {
      const a = new Audio(url);
      a.ontimeupdate = () => setPosition(a.currentTime);
      a.onended = () => {
        setPlaying(false);
        setPosition(0);
      };
      a.onpause = () => setPlaying(false);
      a.onplay = () => setPlaying(true);
      audio.current = a;
    }
    if (audio.current.paused) void audio.current.play();
    else audio.current.pause();
  };
  const progress = Math.min(1, position / Math.max(total, 0.1));
  // A fixed bar pattern (one per 4 % of the clip) that fills as it plays.
  const bars = Array.from({ length: 26 }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + durationMs / 997)));

  return (
    <div className="flex min-w-[220px] items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('pause') : t('play')}
        className={`grid size-10 shrink-0 place-items-center rounded-full transition-transform active:scale-95 motion-reduce:transition-none ${mine ? 'bg-(--btn-ink) text-(--btn)' : 'bg-(--btn) text-(--btn-ink)'}`}
      >
        {playing ? <PauseIcon aria-hidden="true" className="size-4" /> : <PlayIcon aria-hidden="true" className="ml-0.5 size-4" />}
      </button>
      <div aria-hidden="true" className="flex h-8 flex-1 items-center gap-[3px]">
        {bars.map((h, i) => (
          <span key={i} className={`w-[3px] rounded-full transition-opacity ${i / bars.length <= progress ? 'opacity-100' : 'opacity-35'} ${mine ? 'bg-(--btn-ink)' : 'bg-(--text)'}`} style={{ height: `${Math.round(h * 100)}%` }} />
        ))}
      </div>
      <span className="text-xs tabular-nums opacity-80">{clock(playing || position ? position : total)}</span>
    </div>
  );
}
