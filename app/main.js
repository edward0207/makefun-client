// The make.fun client: four surfaces, four hash routes, one module each, loaded the first time
// the route is asked for. A first load is this file, the router, the screen mounter, the markup
// helpers and styles/core.css — everything else arrives with the screen that needs it.
//
// Nothing is loaded from any origin but make.fun's: no font, no script, no stylesheet, no image.

import { matchRoute, onRoute } from './core/router.js';
import { mountScreen } from './core/mount.js';

/** `#/` — the live board: every open bounty's pot, entry fee, clock and entries. */
const BOARD = { name: 'board', path: '', view: () => import('./screens/board.js'), stylesheet: 'board' };

/** `#/bounty/<slug>` — one bounty: its rewards table, its rules, its dates, its state. */
const BOUNTY = { name: 'bounty', path: 'bounty/:slug', view: () => import('./screens/bounty.js'), stylesheet: 'bounty' };

/** `#/bounty/<slug>/leaderboard` — its leaderboard: the ranked entries, thousands of them. */
const LEADERBOARD = { name: 'leaderboard', path: 'bounty/:slug/leaderboard', view: () => import('./screens/leaderboard.js'), stylesheet: 'leaderboard' };

/** `#/u/<handle>` — an account's public profile: its record, its entries, its payouts. */
const PROFILE = { name: 'profile', path: 'u/:handle', view: () => import('./screens/profile.js'), stylesheet: 'profile' };

/** The routes, tried in order; a hash matching none of them falls through to screens/failure.js. */
const ROUTES = [BOARD, BOUNTY, LEADERBOARD, PROFILE];

const MISSING = { name: 'missing', path: '*', view: () => import('./screens/failure.js') };

const target = document.getElementById('screen');
let shown = null;

onRoute((hash) => {
  const found = matchRoute(ROUTES, hash);
  const route = found?.route ?? MISSING;
  const params = found?.params ?? { hash: location.hash };
  // A filter or a view switch stays where it is on the page; a new screen starts at the top.
  const here = route.name + JSON.stringify(params);
  const fresh = shown !== here;
  shown = here;
  mountScreen(target, route, { params, query: hash.query, fresh });
});

// The one thing that keeps running after a screen is mounted: the header's UTC clock and every
// deadline on the page, refreshed in place each second (core/clock.js).
import('./core/clock.js').then((clock) => clock.startClock());
