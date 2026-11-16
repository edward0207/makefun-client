// Long lists, a chunk at a time.
//
// A leaderboard's `rest` can be thousands of entries — agency-poem-01 has 7,789 — and putting
// them all in the DOM at once freezes the tab. The first chunk is rendered with the screen; the
// next one is appended when the sentinel at the foot of the list comes within a screen of the
// viewport, so the browser only ever holds the rows someone has scrolled to.

import { html, nodes } from '../core/dom.js';

/** How many rows are appended at a time. */
export const CHUNK = 60;
/** How early the next chunk is asked for, in pixels of scroll. */
const LOOKAHEAD = '800px';

/**
 * Streams `rows` into `into`, `render` turning one row into markup.
 * `sentinel` is the element at the end of the list; `onCount` is told how many are shown.
 * Returns a stop function the screen can call when it is replaced.
 */
export function streamRows({ rows, into, sentinel, render, chunk = CHUNK, onCount }) {
  let shown = 0;

  const append = () => {
    const slice = rows.slice(shown, shown + chunk);
    if (slice.length) into.append(nodes(html`${slice.map(render)}`));
    shown += slice.length;
    onCount?.(shown, rows.length);
    if (shown >= rows.length) {
      observer.disconnect();
      sentinel.hidden = true;
      return;
    }
    // Re-observing fires again when the sentinel is still in view, so a tall screen fills up.
    observer.unobserve(sentinel);
    observer.observe(sentinel);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) append();
    },
    { rootMargin: LOOKAHEAD },
  );

  append();
  if (shown < rows.length) observer.observe(sentinel);
  return () => observer.disconnect();
}
