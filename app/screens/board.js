// The board: every live bounty, with the three things that decide whether to enter — the live
// pot, the entry fee and the time left — and the entries already in.
//
// One request a page (`status=open&activity=times&limit=12`, 187 KB instead of the whole board's
// 1.0 MB), the next page fetched on demand with the API's cursor and appended to the grid in
// place, so paging never rebuilds the screen.

import { BOARD_PAGE, getBoard } from '../core/api.js';
import { fill, html, nodes } from '../core/dom.js';
import { count, plural, stamp, timeLeft, usd } from '../core/format.js';
import { href, withQuery } from '../core/router.js';
import { money, stat } from '../ui/figures.js';
import { categoryPill, deadlineBar, deadlinePill } from '../ui/pills.js';
import { plainStart } from '../ui/markdown.js';

/** The categories the API sorts bounties into. */
const CATEGORIES = ['Trading', 'Forecasting', 'Security', 'Automation', 'Growth', 'Games', 'Code'];

/** The states a bounty passes through, as the board offers them. */
const STATES = [
  ['open', 'Open'],
  ['closed', 'Judging'],
  ['resolved', 'Resolved'],
];

/** How the board can be ordered, all of it on the page already — no extra request to re-sort. */
const SORTS = {
  closing: ['Closing first', (a, b) => clock(a) - clock(b)],
  pot: ['Biggest pot', (a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount)],
  entries: ['Most entries', (a, b) => b.submissionCount - a.submissionCount],
  newest: ['Newest', (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)],
};

/** Bounties still running sort by how long they have left; the ones past their deadline go last. */
const clock = (bounty) => {
  const { ms } = timeLeft(bounty.deadline);
  return ms > 0 ? ms : Infinity;
};

export async function render({ query, signal }) {
  const filters = {
    status: query.get('status') ?? 'open',
    category: query.get('category') ?? undefined,
    sort: SORTS[query.get('sort')] ? query.get('sort') : 'closing',
  };
  const page = await getBoard({ status: filters.status, category: filters.category }, { signal });
  const items = [...page.items].sort(SORTS[filters.sort][1]);

  return {
    title: 'Live bounties',
    body: html`
      ${summary(items, filters)}
      ${controls(filters)}
      <div class="grid" id="bounties">${items.map(card)}</div>
      ${page.next_cursor
        ? html`<div class="more">
            <button class="btn" type="button" id="more" data-cursor="${page.next_cursor}">
              Load ${BOARD_PAGE} more
            </button>
            <span class="more__count" id="shown">${plural(items.length, 'bounty', 'bounties')} shown</span>
          </div>`
        : ''}`,
    mounted: (root) => wireMore(root, filters),
  };
}

/** The money and the clock across the whole board, before any one bounty. */
function summary(items, filters) {
  const live = items.filter((bounty) => timeLeft(bounty.deadline).ms > 0);
  const pot = items.reduce((total, bounty) => total + Number(bounty.potUsd ?? bounty.rewardAmount ?? 0), 0);
  const next = live.slice().sort((a, b) => clock(a) - clock(b))[0];
  return html`
    <section class="hero">
      <div class="hero__head">
        <h1>Live bounties</h1>
        <p class="hero__note">
          make.fun pays for the best program, agent or picture. ${plural(items.length, 'bounty', 'bounties')}
          on this page${filters.category ? html` in <strong>${filters.category}</strong>` : ''}, read straight
          from the public API.
        </p>
      </div>
      <div class="hero__figures">
        ${stat({ label: 'In live pots', value: money(pot), note: `across ${count(items.length)} on this page`, tone: 'money', size: 'xl' })}
        ${stat({
          label: 'Next to close',
          value: next
            ? html`<span data-until="${next.deadline}" data-until-class="fig">${timeLeft(next.deadline).label}</span>`
            : '—',
          note: next ? next.title : 'nothing open',
          size: 'xl',
        })}
        ${stat({ label: 'Entries in', value: count(items.reduce((n, b) => n + (b.submissionCount ?? 0), 0)), note: 'submissions on this page' })}
      </div>
    </section>`;
}

/** Category, state and order, each one a link, so any board view can be shared as a URL. */
function controls(filters) {
  return html`
    <section class="controls" aria-label="Filters">
      <nav class="chips chips--filter" aria-label="Category">
        <a class="chip ${filters.category ? '' : 'chip--on'}" href="${withQuery('category', null)}">All</a>
        ${CATEGORIES.map(
          (category) => html`<a class="chip ${filters.category === category ? 'chip--on' : ''}"
            href="${withQuery('category', category)}">${category}</a>`,
        )}
      </nav>
      <div class="controls__right">
        <div class="switch" role="group" aria-label="State">
          ${STATES.map(
            ([value, title]) => html`<a href="${withQuery('status', value)}"
              aria-current="${filters.status === value}">${title}</a>`,
          )}
        </div>
        <div class="switch" role="group" aria-label="Order">
          ${Object.entries(SORTS).map(
            ([value, [title]]) => html`<a href="${withQuery('sort', value)}"
              aria-current="${filters.sort === value}">${title}</a>`,
          )}
        </div>
      </div>
    </section>`;
}

/** One bounty. The pot is the loudest thing on it, then the clock. */
function card(bounty) {
  const pot = Number(bounty.potUsd ?? bounty.rewardAmount ?? 0);
  const fees = Number(bounty.entryFeesUsd ?? 0);
  const left = timeLeft(bounty.deadline);
  return html`
    <a class="bounty card" href="${href(`bounty/${bounty.slug}`)}">
      <header class="bounty__head">
        ${categoryPill(bounty.category)}
        ${deadlinePill(bounty.deadline)}
      </header>
      <h2 class="bounty__title">${bounty.title}</h2>
      <p class="bounty__summary">${plainStart(bounty.summary ?? bounty.description, 150)}</p>
      <div class="bounty__money">
        ${stat({
          label: 'Live pot',
          value: money(pot),
          note: fees > 0 ? `${usd(bounty.rewardAmount)} + ${usd(fees)} in fees` : `${usd(bounty.rewardAmount)} put up`,
          tone: 'money',
          size: 'lg',
        })}
        ${stat({
          label: 'Entry fee',
          value: bounty.entryFeeUsd ? usd(bounty.entryFeeUsd) : 'Free',
          note: bounty.entryFeePayers ? plural(bounty.entryFeePayers, 'payer', 'payers') : 'no fee to enter',
        })}
        ${stat({ label: 'Entries', value: count(bounty.submissionCount), note: left.urgency === 'ended' ? 'final' : 'and counting' })}
      </div>
      <footer class="bounty__foot">
        ${deadlineBar(bounty.publishedAt, bounty.deadline)}
        <span class="bounty__when">${left.urgency === 'ended' ? 'closed' : 'closes'} ${stamp(bounty.deadline)}</span>
      </footer>
    </a>`;
}

/** The next page: fetched with the API's cursor and appended, leaving the screen as it stands. */
function wireMore(root, filters) {
  const button = root.querySelector('#more');
  const grid = root.querySelector('#bounties');
  const shown = root.querySelector('#shown');
  if (!button || !grid) return;

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Loading…';
    try {
      const page = await getBoard({ status: filters.status, category: filters.category, cursor: button.dataset.cursor });
      const items = [...page.items].sort(SORTS[filters.sort][1]);
      grid.append(nodes(html`${items.map(card)}`));
      const total = grid.children.length;
      if (shown) shown.textContent = `${plural(total, 'bounty', 'bounties')} shown`;
      if (page.next_cursor) {
        button.dataset.cursor = page.next_cursor;
        button.disabled = false;
        button.textContent = `Load ${BOARD_PAGE} more`;
      } else {
        fill(button.parentElement, html`<span class="more__count">That is every bounty here</span>`);
      }
      const clock = await import('../core/clock.js');
      clock.refreshDeadlines(grid);
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Try again';
    }
  });
}
