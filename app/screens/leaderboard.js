// A bounty's leaderboard, which is where make.fun gets big: 5,000 ranked entries is ordinary and
// agency-poem-01 has 7,789.
//
// The API's `rows=first` form answers with the top ten in full and the rest in a light row each,
// a third of the bytes of the whole thing. The top ten are drawn with every column; the rest are
// streamed into the page 60 at a time as they are scrolled to (ui/progressive.js), so the DOM
// holds what someone is actually looking at and nothing more. Two requests: the leaderboard, and
// the leader's public profile for the spotlight.

import { getLeaderboard, getProfile } from '../core/api.js';
import { html } from '../core/dom.js';
import { count, measure, metric, since, stamp, usd } from '../core/format.js';
import { href, withQuery } from '../core/router.js';
import { avatar } from '../ui/avatar.js';
import { stat } from '../ui/figures.js';
import { streamRows } from '../ui/progressive.js';

/** The phases a leaderboard can be read in, as the API names them. */
const PHASES = [
  ['dev', 'Development'],
  ['final', 'Final'],
];

/** What each view ranks by, for the switch's title. */
const VIEW_TITLES = { overall: 'Overall', performance: 'Performance', cost: 'Cost', efficiency: 'Efficiency' };

export async function render({ params, query, signal }) {
  const board = await getLeaderboard(params.slug, { phase: query.get('phase'), view: query.get('view') }, { signal });
  const columns = (board.columns ?? []).filter((column) => !column.hidden);
  const top = board.entries ?? [];
  const rest = board.rest ?? [];
  const leader = top[0];
  // One small extra request (1 KB), and only when there is a leader to spotlight.
  const profile = leader ? await getProfile(leader.handle, { signal }).catch(() => null) : null;

  return {
    title: `${board.title ?? 'Leaderboard'} · ${board.competition?.title ?? params.slug}`,
    body: html`
      <nav class="crumbs">
        <a href="${href('')}">Board</a>
        <span class="crumbs__sep">/</span>
        <a href="${href(`bounty/${params.slug}`)}">${board.competition?.title ?? params.slug}</a>
        <span class="crumbs__sep">/</span>
        <span>${board.title ?? 'Leaderboard'}</span>
      </nav>

      <header class="lhead">
        <div>
          <h1>${board.title ?? 'Leaderboard'}</h1>
          <p class="lhead__note">
            ${board.phase?.title ?? 'Phase'} · ranked by <strong
              >${columns.find((column) => column.key === board.rank_key)?.title ?? board.rank_key}</strong
            >${board.tie_break ? html`, ties to the ${board.tie_break.better} <strong>${board.tie_break.title}</strong>` : ''} ·
            ${count(top.length + rest.length)} ranked ${top.length + rest.length === 1 ? 'entry' : 'entries'}${board.phase?.ends_at
              ? html` · phase ends ${stamp(board.phase.ends_at)}`
              : ''}
          </p>
        </div>
        <div class="lhead__switches">
          <div class="switch" role="group" aria-label="Phase">
            ${PHASES.map(([key, title]) => html`<a href="${withQuery('phase', key)}"
              aria-current="${(board.phase?.key ?? 'dev') === key}">${title}</a>`)}
          </div>
          ${(board.views ?? []).length > 1
            ? html`<div class="switch" role="group" aria-label="View">
                ${board.views.map((view) => html`<a href="${withQuery('view', view)}"
                  aria-current="${board.view === view}">${VIEW_TITLES[view] ?? view}</a>`)}
              </div>`
            : ''}
        </div>
      </header>

      ${board.metrics_withheld
        ? html`<p class="notice">Metrics are withheld while the bounty runs: the figures below are the live
            practice scores, and placements are held until the final phase is settled.</p>`
        : ''}

      ${leader
        ? html`<section class="spotlight">
            ${leaderCard(leader, board, columns, profile)}
            <div class="chasers">${top.slice(1, 3).map((entry) => chaserCard(entry, board, columns))}</div>
          </section>`
        : html`<p class="empty">No entry has been scored yet. The leaderboard fills as entries arrive
            — the bounty's page has the rules and the clock.</p>`}

      ${top.length
        ? html`<section class="block">
            <h2 class="block__title">The top ${count(top.length)} <span class="panel__hint">every column</span></h2>
            <div class="scroller">
              <table class="table table--top">
                <thead>
                  <tr>
                    <th>#</th><th>Entrant</th><th>Entry</th>
                    ${columns.map((column) => html`<th class="${column.key === board.rank_key ? 'is-rank' : ''}">${column.title}</th>`)}
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>${top.map((entry) => topRow(entry, board, columns))}</tbody>
              </table>
            </div>
          </section>`
        : ''}

      ${rest.length
        ? html`<section class="block">
            <h2 class="block__title">
              Every other entry
              <span class="panel__hint" id="streamed">${count(Math.min(60, rest.length))} of ${count(rest.length)} shown</span>
            </h2>
            <div class="scroller">
              <table class="table table--rest">
                <thead>
                  <tr><th>#</th><th>Entrant</th><th>Entry</th>
                    <th class="is-rank">${columns.find((column) => column.key === board.rank_key)?.title ?? 'Score'}</th>
                    <th>Received</th></tr>
                </thead>
                <tbody id="restRows"></tbody>
              </table>
            </div>
            <div class="sentinel" id="sentinel"><span class="skel skel--line" style="width:8rem"></span></div>
          </section>`
        : ''}`,
    mounted: (root) => {
      if (!rest.length) return;
      const counter = root.querySelector('#streamed');
      streamRows({
        rows: rest,
        into: root.querySelector('#restRows'),
        sentinel: root.querySelector('#sentinel'),
        render: (entry) => restRow(entry, board),
        onCount: (shown, total) => {
          if (counter) counter.textContent = `${count(shown)} of ${count(total)} shown`;
        },
      });
    },
  };
}

/** Rank 1, in full, with the account behind it. */
function leaderCard(entry, board, columns, profile) {
  const rankColumn = columns.find((column) => column.key === board.rank_key) ?? columns[0];
  const record = profile?.record;
  return html`
    <article class="leader card">
      <div class="leader__top">
        <span class="pill pill--money">Rank 1</span>
        ${entry.prize_eligible ? html`<span class="pill">in the money</span>` : html`<span class="pill">not prize eligible</span>`}
        <span class="pill pill--rank">${since(entry.received_at)}</span>
      </div>
      <a class="leader__who" href="${href(`u/${entry.handle}`)}">
        ${avatar({ image: entry.image ?? profile?.image, handle: entry.handle, name: profile?.display_name, size: 44 })}
        <span class="leader__names">
          <strong>${profile?.display_name ?? entry.handle}</strong>
          <span class="leader__handle">@${entry.handle}${profile?.joined_at ? ` · joined ${stamp(profile.joined_at).slice(0, 11)}` : ''}</span>
        </span>
      </a>
      <p class="leader__entry">${entry.title}</p>
      <div class="leader__figures">
        ${rankColumn ? stat({ label: rankColumn.title, value: metric(rankColumn, entry.values, entry.display), tone: 'money', size: 'xl' }) : ''}
        ${record
          ? html`
            ${stat({ label: 'Prize so far', value: usd(record.prize_usd), note: `${count(record.competitions_won)} won`, tone: 'money' })}
            ${stat({ label: 'Entered', value: count(record.competitions_entered), note: `${count(record.competitions_placed)} placed` })}
            ${stat({ label: 'Best place', value: record.best_placement ? `#${count(record.best_placement)}` : '—', note: `${count(record.podium_finishes)} on a podium` })}`
          : ''}
      </div>
      <a class="leader__link" href="${href(`u/${entry.handle}`)}">See ${entry.handle}'s profile →</a>
    </article>`;
}

/** Ranks 2 and 3, the ones within reach of the leader. */
function chaserCard(entry, board, columns) {
  const rankColumn = columns.find((column) => column.key === board.rank_key) ?? columns[0];
  return html`
    <article class="chaser card">
      <span class="pill pill--rank">Rank ${entry.rank}</span>
      <a class="chaser__who" href="${href(`u/${entry.handle}`)}">
        ${avatar({ image: entry.image, handle: entry.handle, size: 32 })}
        <strong>${entry.handle}</strong>
      </a>
      <p class="chaser__entry">${entry.title}</p>
      ${rankColumn ? stat({ label: rankColumn.title, value: metric(rankColumn, entry.values, entry.display), tone: 'money', size: 'lg' }) : ''}
    </article>`;
}

/** One of the top ten: every column the API returned. */
function topRow(entry, board, columns) {
  return html`
    <tr class="${entry.rank <= 3 ? 'is-podium' : ''}">
      <td class="num rank">${entry.rank}</td>
      <td><a class="who" href="${href(`u/${entry.handle}`)}">
        ${avatar({ image: entry.image, handle: entry.handle, size: 24 })}<span>${entry.handle}</span>
      </a>${entry.house || entry.baseline ? html` <span class="pill">house</span>` : ''}</td>
      <td class="entry">${entry.title}</td>
      ${columns.map(
        (column) => html`<td class="num ${column.key === board.rank_key ? 'is-rank' : ''}"
          >${metric(column, entry.values, entry.display)}</td>`,
      )}
      <td class="num quiet">${since(entry.received_at)}</td>
    </tr>`;
}

/** One of the thousands: the light row the API sends, which is rank, entrant and the one score. */
function restRow(entry, board) {
  return html`
    <tr>
      <td class="num rank">${entry.rank}</td>
      <td><a class="who" href="${href(`u/${entry.handle}`)}"><span>${entry.handle}</span></a></td>
      <td class="entry">${entry.title}</td>
      <td class="num is-rank">${measure({ source: sourceOf(board), value: entry.value, display: entry.display })}</td>
      <td class="num quiet">${since(entry.received_at)}</td>
    </tr>`;
}

/** A light row carries one value, so it is read with the ranking column's own unit. */
const sourceOf = (board) => board.columns?.find((column) => column.key === board.rank_key)?.source ?? null;
