'use client';

import { Maximize2Icon, MicIcon, MicOffIcon, Minimize2Icon, MonitorUpIcon, MonitorXIcon, PhoneOffIcon, VideoIcon, VideoOffIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Avatar, clock } from './avatar';
import type { CallEngine, RemotePeer } from './call-engine';
import { useCallSnapshot } from './comms-provider';

/** Plays a stream in a <video>; muted (audio plays from the separate <audio> elements). */
function StreamVideo({ stream, mirror = false, contain = false }: { stream: MediaStream; mirror?: boolean; contain?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={`size-full ${contain ? 'object-contain' : 'object-cover'} ${mirror ? '-scale-x-100' : ''}`} />;
}

/** Remote audio, mounted for the whole call so it keeps playing when the call is minimized. */
function StreamAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
      void ref.current.play().catch(() => undefined);
    }
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

/** The current time, refreshed every second while `active` (for the call timer). */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function hasVideo(peer: RemotePeer) {
  return (peer.camera || peer.screen) && !!peer.stream?.getVideoTracks().length;
}

function PeerTile({ peer, screenLabel }: { peer: RemotePeer; screenLabel: string }) {
  const video = hasVideo(peer);
  return (
    <figure className="relative m-0 grid min-h-0 place-items-center overflow-hidden rounded-[22px] border border-(--hud-border) bg-(--hud-btn-ink)/30">
      {video && peer.stream ? (
        <StreamVideo stream={peer.stream} contain={peer.screen} />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <span className={`rounded-full p-1 ${peer.state === 'connected' ? 'fz-call-ring' : ''}`}>
            <Avatar name={peer.name} size={88} />
          </span>
        </div>
      )}
      <figcaption className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-(--hud-btn-ink)/60 px-3 py-1.5 text-xs font-semibold text-(--hud-text)">
        {!peer.mic ? <MicOffIcon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
        <span className="truncate">{peer.screen ? screenLabel : peer.name}</span>
      </figcaption>
    </figure>
  );
}

/**
 * The call screen (HUD style, over the whole workspace) and its minimized pill.
 * Keyboard: every control is a button with a label; Escape minimizes.
 */
export function CallOverlay({ engine }: { engine: CallEngine }) {
  const t = useTranslations('Comms');
  const snap = useCallSnapshot(engine);
  // Minimized belongs to one call: the next call opens full screen again.
  const [minimizedCall, setMinimizedCall] = useState<string | null>(null);
  const status = snap?.status ?? 'idle';
  const callId = snap?.callId ?? null;
  const minimized = !!callId && minimizedCall === callId;
  const now = useNow(status === 'active');

  useEffect(() => {
    if ((status !== 'active' && status !== 'outgoing') || !callId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMinimizedCall(callId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, callId]);
  const setMinimized = (on: boolean) => setMinimizedCall(on ? callId : null);

  if (!snap || status === 'idle') return null;

  const audio = snap.peers.filter((p) => p.stream).map((p) => <StreamAudio key={p.peerId} stream={p.stream!} />);
  const seconds = snap.connectedAt ? Math.max(0, now - snap.connectedAt) / 1000 : 0;
  const statusText =
    status === 'ended'
      ? snap.error === 'mediaDenied'
        ? t('mediaDenied')
        : snap.error === 'unsupported'
          ? t('unsupported')
          : snap.error
            ? t('sendError')
            : t('callEnded')
      : status === 'outgoing'
        ? snap.peers.length === 0
          ? t('calling')
          : t('connecting')
        : clock(seconds);

  if (minimized && status !== 'ended') {
    return (
      <div className="fixed right-4 bottom-4 z-[60] flex items-center gap-3 rounded-full border border-(--hud-border) py-2 pr-2 pl-3 text-(--hud-text) shadow-(--card-glow-hover) [background:var(--hud)]">
        {audio}
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--hud-btn) opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-(--hud-btn)" />
        </span>
        <span className="max-w-40 truncate text-sm font-semibold">{snap.title}</span>
        <span className="font-brand text-sm tabular-nums">{statusText}</span>
        <button type="button" onClick={() => setMinimized(false)} aria-label={t('expand')} title={t('expand')} className="grid size-10 place-items-center rounded-full bg-(--hud-text)/10 hover:bg-(--hud-text)/20">
          <Maximize2Icon aria-hidden="true" className="size-4" />
        </button>
        <button type="button" onClick={() => engine.hangUp()} aria-label={t('hangUp')} title={t('hangUp')} className="grid size-10 place-items-center rounded-full bg-(--mag) text-(--on-blue) hover:brightness-110">
          <PhoneOffIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
    );
  }

  const n = snap.peers.length;
  const grid = n <= 1 ? 'grid-cols-1' : n <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 lg:grid-cols-3';
  const control = 'grid size-14 place-items-center rounded-full transition-[background-color,transform] duration-150 active:scale-95 motion-reduce:transition-none';

  return (
    <div role="dialog" aria-modal="true" aria-label={snap.title} className="fz-call-in fixed inset-0 z-[60] flex flex-col text-(--hud-text) [background:var(--hud)]">
      {audio}
      <div aria-hidden="true" className="fz-dots pointer-events-none absolute inset-0 opacity-40" />
      <header className="relative flex items-center gap-3 px-5 py-4 sm:px-8">
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate font-brand text-lg font-bold">{snap.title}</p>
          <p className="m-0 text-sm text-(--hud-muted) tabular-nums" aria-live="polite">
            {statusText}
          </p>
        </div>
        {status === 'ended' ? (
          <button type="button" onClick={() => engine.dismiss()} aria-label={t('cancel')} className="grid size-11 place-items-center rounded-full bg-(--hud-text)/10 hover:bg-(--hud-text)/20">
            <XIcon aria-hidden="true" className="size-5" />
          </button>
        ) : (
          <button type="button" onClick={() => setMinimized(true)} aria-label={t('minimize')} title={t('minimize')} className="grid size-11 place-items-center rounded-full bg-(--hud-text)/10 hover:bg-(--hud-text)/20">
            <Minimize2Icon aria-hidden="true" className="size-5" />
          </button>
        )}
      </header>

      <div className="relative grid min-h-0 flex-1 px-4 pb-4 sm:px-8">
        {n > 0 ? (
          <div className={`grid min-h-0 auto-rows-fr gap-3 ${grid}`}>
            {snap.peers.map((p) => (
              <PeerTile key={p.peerId} peer={p} screenLabel={t('screen', { name: p.name })} />
            ))}
          </div>
        ) : (
          <div className="grid place-items-center">
            <div className="flex flex-col items-center gap-5">
              <span className="fz-call-ring rounded-full p-2">
                <Avatar name={snap.title} size={120} />
              </span>
              <p className="m-0 text-(--hud-muted)">{status === 'ended' ? statusText : t('waiting')}</p>
            </div>
          </div>
        )}
        {snap.preview && status !== 'ended' ? (
          <div className="absolute right-6 bottom-6 h-28 w-44 overflow-hidden rounded-2xl border-2 border-(--hud-border) bg-(--hud-btn-ink) shadow-lg sm:right-10 sm:h-36 sm:w-56">
            <StreamVideo stream={snap.preview} mirror={!snap.screen} contain={snap.screen} />
          </div>
        ) : null}
      </div>

      {status !== 'ended' ? (
        <footer className="relative flex items-center justify-center gap-3 px-4 pt-2 pb-7">
          <button type="button" onClick={() => engine.toggleMic()} aria-pressed={!snap.mic} aria-label={snap.mic ? t('mute') : t('unmute')} title={snap.mic ? t('mute') : t('unmute')} className={`${control} ${snap.mic ? 'bg-(--hud-text)/12 hover:bg-(--hud-text)/20' : 'bg-(--hud-text) text-(--hud-btn-ink)'}`}>
            {snap.mic ? <MicIcon aria-hidden="true" className="size-6" /> : <MicOffIcon aria-hidden="true" className="size-6" />}
          </button>
          <button type="button" onClick={() => void engine.toggleCamera()} aria-pressed={snap.camera} aria-label={snap.camera ? t('cameraOff') : t('cameraOn')} title={snap.camera ? t('cameraOff') : t('cameraOn')} className={`${control} ${snap.camera ? 'bg-(--hud-text)/12 hover:bg-(--hud-text)/20' : 'bg-(--hud-text) text-(--hud-btn-ink)'}`}>
            {snap.camera ? <VideoIcon aria-hidden="true" className="size-6" /> : <VideoOffIcon aria-hidden="true" className="size-6" />}
          </button>
          {typeof navigator !== 'undefined' && 'getDisplayMedia' in (navigator.mediaDevices ?? {}) ? (
            <button type="button" onClick={() => void engine.toggleScreen()} aria-pressed={snap.screen} aria-label={snap.screen ? t('stopShare') : t('share')} title={snap.screen ? t('stopShare') : t('share')} className={`${control} max-[640px]:hidden ${snap.screen ? 'bg-(--hud-btn) text-(--hud-btn-ink)' : 'bg-(--hud-text)/12 hover:bg-(--hud-text)/20'}`}>
              {snap.screen ? <MonitorXIcon aria-hidden="true" className="size-6" /> : <MonitorUpIcon aria-hidden="true" className="size-6" />}
            </button>
          ) : null}
          <button type="button" onClick={() => engine.hangUp()} aria-label={t('hangUp')} title={t('hangUp')} className={`${control} w-20 bg-(--mag) text-(--on-blue) hover:brightness-110`}>
            <PhoneOffIcon aria-hidden="true" className="size-6" />
          </button>
        </footer>
      ) : null}
    </div>
  );
}
