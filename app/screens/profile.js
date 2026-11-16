// An account's public profile: what they have entered, where they placed and what they were paid.
//
// One request (1 KB) carries the lot, but a busy account has forty-odd entries, so the list of
// them is streamed in twelve at a time by the same helper the leaderboard uses.

import { getProfile } from '../core/api.js';
import { html } from '../core/dom.js';
import { count, day, measure, plural, since, stamp, usd } from '../core/format.js';
import { href } from '../core/router.js';
import { avatar, sameOrigin } from '../ui/avatar.js';
import { money, stat } from '../ui/figures.js';
import { streamRows } from '../ui/progressive.js';

/** How many entries of the record are shown before the rest are streamed. */
const FIRST_SOLUTIONS = 12;

export async function render({ params, signal }) {
  const profile = await getProfile(params.handle, { signal });
  const record = profile.record ?? {};
  const solutions = profile.solutions ?? [];

  return {
    title: profile.display_name ?? `@${profile.handle}`,
    body: html`
      <nav class="crumbs">
        <a href="${href('')}">Board</a>
        <span class="crumbs__sep">/</span>
        <span>@${profile.handle}</span>
      </nav>

      <header class="phead card">
        ${avatar({ image: profile.image ?? profile.avatar, handle: profile.handle, name: profile.display_name, size: 76 })}
        <div class="phead__who">
          <h1>${profile.display_name ?? profile.handle}</h1>
          <p class="phead__handle">
            @${profile.handle}
            ${profile.house ? html`<span class="pill">house</span>` : ''}
            ${profile.joined_at ? html`<span class="phead__joined">joined ${day(profile.joined_at)}</span>` : ''}
          </p>
          ${profile.bio ? html`<p class="phead__bio">${profile.bio}</p>` : ''}
          <p class="phead__links">${links(profile)}</p>
        </div>
        <div class="phead__record">
          ${stat({ label: 'Prize money', value: money(record.prize_usd ?? 0), note: plural(record.competitions_won ?? 0, 'bounty won', 'bounties won'), tone: 'money', size: 'xl' })}
        </div>
      </header>

      <section class="tiles">
        ${stat({ label: 'Entered', value: count(record.competitions_entered ?? 0), note: 'bounties' })}
        ${stat({ label: 'Placed', value: count(record.competitions_placed ?? 0), note: 'in the money or ranked' })}
        ${stat({ label: 'Won', value: count(record.competitions_won ?? 0), note: 'first places' })}
        ${stat({ label: 'Podiums', value: count(record.podium_finishes ?? 0), note: 'top three finishes' })}
        ${stat({ label: 'Best place', value: record.best_placement ? `#${count(record.best_placement)}` : '—', note: 'of any entry' })}
        ${stat({ label: 'Payouts', value: count(profile.payouts?.length ?? 0), note: 'paid on chain' })}
      </section>

      ${profile.payouts?.length ? payouts(profile.payouts) : ''}

      <section class="block">
        <h2 class="block__title">
          Entries
          <span class="panel__hint" id="streamed">${count(Math.min(FIRST_SOLUTIONS, solutions.length))} of ${count(solutions.length)} shown</span>
        </h2>
        ${solutions.length
          ? html`<ol class="solutions" id="solutions"></ol>
            <div class="sentinel" id="sentinel"><span class="skel skel--line" style="width:8rem"></span></div>`
          : html`<p class="empty">No public entries yet.</p>`}
      </section>`,
    mounted: (root) => {
      if (!solutions.length) return;
      const counter = root.querySelector('#streamed');
      streamRows({
        rows: solutions,
        into: root.querySelector('#solutions'),
        sentinel: root.querySelector('#sentinel'),
        chunk: FIRST_SOLUTIONS,
        render: solution,
        onCount: (shown, total) => {
          if (counter) counter.textContent = `${count(shown)} of ${count(total)} shown`;
        },
      });
    },
  };
}

/** Where else this account is, as links alone — nothing is loaded from any of them. */
function links(profile) {
  const out = [];
  if (profile.github_login) out.push(['GitHub', `https://github.com/${encodeURIComponent(profile.github_login)}`]);
  if (profile.x) out.push([`X @${profile.x}`, `https://x.com/${encodeURIComponent(profile.x)}`]);
  if (profile.discord?.url) out.push([`Discord ${profile.discord.username ?? profile.discord.global_name ?? ''}`.trim(), profile.discord.url]);
  if (profile.wallet?.explorer_url) out.push([`Wallet ${profile.wallet.address.slice(0, 4)}…${profile.wallet.address.slice(-4)}`, profile.wallet.explorer_url]);
  if (profile.profile_url) out.push(['On make.fun', `https://make.fun${profile.profile_url}`]);
  return html`${out.map(([title, url]) => html`<a class="chip" href="${url}">${title}</a>`)}`;
}

/** What has actually been paid, and the transaction that paid it. */
const payouts = (rows) => html`
  <section class="panel card">
    <h2 class="panel__title">Payouts <span class="panel__hint">${plural(rows.length, 'payment', 'payments')}</span></h2>
    <div class="scroller scroller--short">
      <table class="table">
        <thead><tr><th>Paid</th><th class="left">Bounty</th><th>Place</th><th>Amount</th><th>Receipt</th></tr></thead>
        <tbody>
          ${rows.map(
            (row) => html`<tr>
              <td class="num quiet">${day(row.paid_at)}</td>
              <td class="left"><a href="${href(`bounty/${row.competition.slug}`)}">${row.competition.title}</a></td>
              <td class="num">${row.place ? `#${row.place}` : '—'}</td>
              <td class="num fig--money">${usd(row.amount_usd)}</td>
              <td>${row.explorer_url ? html`<a href="${row.explorer_url}">on chain ↗</a>` : '—'}</td>
            </tr>`,
          )}
        </tbody>
      </table>
    </div>
  </section>`;

/** One entry: the bounty it went into, how it scored and what it was paid. */
function solution(entry) {
  const competition = entry.competition ?? {};
  const thumb = sameOrigin(entry.artifact?.preview_url ?? entry.artifact?.url);
  const score = entry.score
    ? measure({ source: entry.score.column?.source, value: entry.score.value, display: entry.score.display })
    : null;
  return html`
    <li class="solution">
      ${thumb
        ? html`<img class="solution__shot" src="${thumb}" alt="" loading="lazy" decoding="async" crossorigin="anonymous" width="88" height="56">`
        : html`<span class="solution__shot solution__shot--none" aria-hidden="true">${(competition.category ?? '·').slice(0, 2)}</span>`}
      <div class="solution__what">
        <a class="solution__comp" href="${href(`bounty/${competition.slug}`)}">${competition.title ?? competition.slug}</a>
        <p class="solution__title">${entry.title}</p>
        <p class="solution__meta">
          ${competition.category ? html`<span class="pill pill--cat">${competition.category}</span>` : ''}
          <span>${competition.status}</span>
          <span>entered ${since(entry.entered_at)}</span>
          <span title="${stamp(competition.deadline)}">closes ${day(competition.deadline)}</span>
        </p>
      </div>
      <div class="solution__figures">
        ${score ? stat({ label: entry.score.column?.title ?? 'Score', value: score }) : ''}
        ${stat({
          label: 'Placement',
          value: entry.placement ? `#${count(entry.placement)}` : 'ranking',
          note: competition.reward_usd ? `pot ${usd(competition.reward_usd)}` : '',
        })}
        ${entry.prize_usd ? stat({ label: 'Prize', value: money(entry.prize_usd), tone: 'money' }) : ''}
      </div>
    </li>`;
}
