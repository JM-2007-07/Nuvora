import type { MetadataRoute } from 'next';

/**
 * Web app manifest (Faroz handoff §9: favicon/manifest from brand/public), served at
 * /manifest.webmanifest. Installable only: there is deliberately no service worker, so no
 * learner, teacher or center data is ever cached offline. Colours must be literal values
 * here; they are the dark-theme `--bg` from faroz-tokens.css (the default theme).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Faroz',
    short_name: 'Faroz',
    description: 'Diagnostic → quests → retest. Learners see their gaps, teachers see their groups, centers see group totals.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0B14',
    theme_color: '#0A0B14',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
