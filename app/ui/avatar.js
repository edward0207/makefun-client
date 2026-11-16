// Faces, and the rule about them: this client may load an image from make.fun and from nowhere
// else. The API hands back two kinds of picture — one it hosts itself ('/api/avatars/<sha>.webp')
// and, for an account that signed in with GitHub, a link to that account's picture on
// avatars.githubusercontent.com. The second is another origin, so it is never requested: those
// accounts get a monogram drawn from their own initials instead.

import { html } from '../core/dom.js';

const ORIGIN = 'https://make.fun';

/** The URL to load, or null when the picture lives somewhere this client will not fetch from. */
export function sameOrigin(url) {
  if (!url) return null;
  if (url.startsWith('/')) return ORIGIN + url;
  return url.startsWith(`${ORIGIN}/`) ? url : null;
}

/** Up to two initials from a name or a handle. */
export function initials(name = '') {
  const words = String(name).split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/**
 * A square face: make.fun's own picture when there is one, else a monogram tinted from the
 * handle, so a leaderboard of thousands still reads as people.
 */
export function avatar({ image, handle, name, size = 36 }) {
  const source = sameOrigin(image);
  const label = name || handle || 'anonymous';
  if (source) {
    // make.fun's avatars answer with `Cross-Origin-Resource-Policy: same-origin`, so the request
    // has to be a CORS one: `crossorigin` is set before `src` for that reason.
    return html`<img class="face" crossorigin="anonymous" src="${source}" alt="" loading="lazy"
      decoding="async" width="${size}" height="${size}" style="--face:${size}px">`;
  }
  const hue = [...String(handle ?? label)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return html`<span class="face face--mono" aria-hidden="true" style="--face:${size}px;--hue:${hue}"
    >${initials(label)}</span>`;
}
