'use client';

import { PROFILE_AVATAR_MAX_BYTES } from '@nuvora/shared';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

const VIEW = 280; // crop window, px
const OUT = 512; // exported square, px

/** Encodes the canvas, lowering quality until it fits the 1 MB limit; WebP when the browser can, else JPEG. */
async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  for (const q of [0.92, 0.85, 0.75, 0.6]) {
    const webp = await toBlob('image/webp', q);
    const blob = webp && webp.type === 'image/webp' ? webp : await toBlob('image/jpeg', q);
    if (blob && blob.size <= PROFILE_AVATAR_MAX_BYTES) return blob;
  }
  throw new Error('too large');
}

/**
 * Square photo crop in a dialog: drag (mouse, touch or arrow keys) and zoom (slider, wheel,
 * +/- buttons) inside a round mask; exports 512×512. No library: canvas only.
 */
export function AvatarCropper({ file, busy, onCancel, onDone }: { file: File; busy: boolean; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const t = useTranslations('Profile');
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      // Start centred: the shorter side fills the window.
      const fit = VIEW / Math.min(image.naturalWidth, image.naturalHeight);
      setOffset({ x: (VIEW - image.naturalWidth * fit) / 2, y: (VIEW - image.naturalHeight * fit) / 2 });
      setImg(image);
      setUrl(objectUrl);
    };
    image.onerror = () => setFailed(true);
    image.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // The image covers the window at zoom 1; offsets are clamped so no empty edge shows.
  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const w = img ? img.naturalWidth * base * zoom : VIEW;
  const h = img ? img.naturalHeight * base * zoom : VIEW;
  const clamp = useCallback(
    (o: { x: number; y: number }, ww = w, hh = h) => ({ x: Math.min(0, Math.max(VIEW - ww, o.x)), y: Math.min(0, Math.max(VIEW - hh, o.y)) }),
    [w, h],
  );
  const pos = clamp(offset);

  const setZoomAround = (next: number) => {
    const z = Math.min(4, Math.max(1, next));
    if (!img) return setZoom(z);
    // Keep the window's centre on the same point of the photo.
    const nw = img.naturalWidth * base * z;
    const nh = img.naturalHeight * base * z;
    const cx = (VIEW / 2 - pos.x) / w;
    const cy = (VIEW / 2 - pos.y) / h;
    setZoom(z);
    setOffset(clamp({ x: VIEW / 2 - cx * nw, y: VIEW / 2 - cy * nh }, nw, nh));
  };

  const exportCrop = async () => {
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    const scale = OUT / VIEW;
    ctx.drawImage(img, pos.x * scale, pos.y * scale, w * scale, h * scale);
    try {
      onDone(await encode(canvas));
    } catch {
      setFailed(true);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      onClose={onCancel}
      className="m-auto w-[min(92vw,26rem)] rounded-[24px] border border-(--line2) bg-(--panel) p-0 text-left text-(--text) backdrop:bg-(--bg)/75"
    >
      <div className="grid gap-4 p-6">
        <h2 id={`${id}-t`} className="m-0 text-xl font-bold">
          {t('cropTitle')}
        </h2>
        <p id={`${id}-d`} className="m-0 text-sm text-(--muted)">
          {t('cropHint')}
        </p>
        <div
          role="application"
          aria-label={t('cropTitle')}
          tabIndex={0}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 6;
            const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
            if (moves[e.key]) {
              e.preventDefault();
              setOffset(clamp({ x: pos.x + moves[e.key][0], y: pos.y + moves[e.key][1] }));
            } else if (e.key === '+' || e.key === '=') setZoomAround(zoom + 0.1);
            else if (e.key === '-') setZoomAround(zoom - 0.1);
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOffset(clamp({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y }));
          }}
          onPointerUp={() => {
            drag.current = null;
            setDragging(false);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDragging(false);
          }}
          onWheel={(e) => setZoomAround(zoom - e.deltaY * 0.0015)}
          className="relative mx-auto touch-none overflow-hidden rounded-2xl bg-(--bg) select-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--sel)"
          style={{ width: VIEW, height: VIEW, cursor: dragging ? 'grabbing' : 'grab' }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL being cropped
            <img src={url} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ left: pos.x, top: pos.y, width: w, height: h }} />
          ) : null}
          {/* Round mask: outside the circle is dimmed, the ring shows the result's edge. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl [background:radial-gradient(circle_at_center,transparent_139px,color-mix(in_srgb,var(--bg)_70%,transparent)_140px)]" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 m-auto size-[280px] rounded-full border-2 border-(--hud-text)/70" />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setZoomAround(zoom - 0.2)} aria-label={`${t('zoom')} −`} className="grid size-9 place-items-center rounded-lg border border-(--line2) hover:bg-(--panel2)">
            <MinusIcon aria-hidden="true" className="size-4" />
          </button>
          <label className="flex-1">
            <span className="sr-only">{t('zoom')}</span>
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoomAround(Number(e.target.value))} className="w-full accent-(--mint)" />
          </label>
          <button type="button" onClick={() => setZoomAround(zoom + 0.2)} aria-label={`${t('zoom')} +`} className="grid size-9 place-items-center rounded-lg border border-(--line2) hover:bg-(--panel2)">
            <PlusIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
        {failed ? (
          <p role="alert" className="m-0 text-sm text-(--mag-ink)">
            {t('photoError')}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="fz-btn fz-btn-ghost" onClick={() => ref.current?.close()}>
            {t('cancel')}
          </button>
          <button type="button" className="fz-btn fz-btn-primary" disabled={!img || busy} onClick={() => void exportCrop()}>
            {busy ? t('saving') : t('usePhoto')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
