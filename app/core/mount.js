// What happens between a URL and a painted screen.
//
// A screen module is loaded on demand with its stylesheet, asked for markup, and mounted in one
// paint. A navigation that starts while another is still loading aborts it, so a fast click
// never paints stale data. window.__shotReady is false while a screen loads and true once its
// data is on the page, which is what the screenshot step waits on.

import { fill, html, sheet } from './dom.js';

/** How long a screen may take before its skeleton is shown, so a quick answer never flashes one. */
const PATIENCE_MS = 140;

let generation = 0;
let inFlight = null;

/**
 * Loads a route's screen module and mounts it.
 * `route` is `{ name, path, stylesheet, view: () => import(...) }`; `context` is what the view
 * is asked with: `{ params, query, signal }`.
 */
export async function mountScreen(target, route, context) {
  const mine = ++generation;
  inFlight?.abort();
  const control = new AbortController();
  inFlight = control;

  window.__shotReady = false;
  target.setAttribute('aria-busy', 'true');
  const waiting = setTimeout(() => {
    if (mine === generation) fill(target, skeleton(route.name));
  }, PATIENCE_MS);

  try {
    const [module] = await Promise.all([route.view(), route.stylesheet ? sheet(route.stylesheet) : null]);
    const screen = await module.render({ ...context, signal: control.signal });
    if (mine !== generation) return;
    clearTimeout(waiting);
    document.title = screen.title ? `${screen.title} · make.fun` : 'make.fun · live bounty board';
    fill(target, screen.body);
    target.removeAttribute('aria-busy');
    if (context.fresh) scrollTo({ top: 0 });
    screen.mounted?.(target);
    import('./clock.js').then((clock) => clock.refreshDeadlines(target));
  } catch (error) {
    if (control.signal.aborted || mine !== generation) return;
    clearTimeout(waiting);
    const { failure } = await import('../screens/failure.js');
    document.title = 'Nothing to show · make.fun';
    fill(target, failure(error));
    target.removeAttribute('aria-busy');
    target.querySelector('[data-reload]')?.addEventListener('click', () => location.reload());
  } finally {
    if (mine === generation) {
      clearTimeout(waiting);
      window.__shotReady = true;
    }
  }
}

/** The shape of the screen being loaded, so the wait looks like the thing that is coming. */
function skeleton(name) {
  const lines = name === 'board' ? 6 : name === 'leaderboard' ? 9 : 3;
  return html`
    <div class="boot">
      <div class="skel skel--line" style="width:11rem;height:2rem"></div>
      <div class="boot__grid">
        ${Array.from({ length: lines }, () => html`<div class="skel skel--card"></div>`)}
      </div>
    </div>`;
}
