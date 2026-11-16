// The hash router: every screen has its own URL, so a bounty, a leaderboard or a profile can be
// linked to, bookmarked and reloaded.
//
//   #/                                  the board        (#/?category=Code&status=open)
//   #/bounty/<slug>                     one bounty
//   #/bounty/<slug>/leaderboard         its leaderboard  (?phase=dev|final&view=overall|…)
//   #/u/<handle>                        an account's public profile

/** Only a hash that starts with `#/` is a route; `#screen` and the like are in-page anchors. */
export const isRoute = (hash) => hash === '' || hash === '#' || hash.startsWith('#/');

/** A hash split into its path segments and its query. */
export function readHash(hash = location.hash) {
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?');
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { segments, query: new URLSearchParams(search) };
}

/**
 * The first route whose pattern fits the hash, with the `:name` segments it captured.
 * A pattern is a path with `:name` for a segment to capture, `''` for the board.
 */
export function matchRoute(routes, { segments }) {
  for (const route of routes) {
    const pattern = route.path.split('/').filter(Boolean);
    if (pattern.length !== segments.length) continue;
    const params = {};
    const fits = pattern.every((part, i) =>
      part.startsWith(':') ? ((params[part.slice(1)] = segments[i]), true) : part === segments[i],
    );
    if (fits) return { route, params };
  }
  return null;
}

/** A hash for a path and a query: `href('bounty/x/leaderboard', { view: 'cost' })`. */
export function href(path = '', query = {}) {
  const search = new URLSearchParams(
    Object.entries(query).filter(([, value]) => value != null && value !== ''),
  ).toString();
  const encoded = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `#/${encoded}${search ? `?${search}` : ''}`;
}

/** The current hash's query, with `name` set to `value` (or dropped when it is null). */
export function withQuery(name, value) {
  const { segments, query } = readHash();
  const next = Object.fromEntries(query);
  if (value == null) delete next[name];
  else next[name] = value;
  return href(segments.join('/'), next);
}

/** Calls back on every hash change that is a route, and once for the hash the page opened on. */
export function onRoute(handler) {
  addEventListener('hashchange', () => {
    if (isRoute(location.hash)) handler(readHash());
  });
  handler(readHash(isRoute(location.hash) ? location.hash : '#/'));
}
