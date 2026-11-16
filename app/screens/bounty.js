// A bounty's page: what it pays, when it closes, how it is judged and the rules it is judged by.
//
// One request (`?submissions=summary`, 92 KB instead of 1.8 MB: the per-submission detail a page
// never shows is left on the server), and the answer is kept for a minute, so stepping between a
// bounty and its leaderboard costs nothing.

import { getBounty } from '../core/api.js';
import { html } from '../core/dom.js';
import { count, day, plural, since, stamp, timeLeft, usd } from '../core/format.js';
import { href } from '../core/router.js';
import { avatar } from '../ui/avatar.js';
import { money, stat } from '../ui/figures.js';
import { markdown } from '../ui/markdown.js';
import { categoryPill, deadlineBar, deadlinePill, statusPill } from '../ui/pills.js';

export async function render({ params, signal }) {
  const bounty = await getBounty(params.slug, { signal });
  const left = timeLeft(bounty.deadline);
  const open = bounty.status === 'open' && left.ms > 0;

  return {
    title: bounty.title,
    body: html`
      <nav class="crumbs">
        <a href="${href('')}">Board</a>
        <span class="crumbs__sep">/</span>
        <a href="${href('', { category: bounty.category })}">${bounty.category}</a>
        <span class="crumbs__sep">/</span>
        <span>${bounty.slug}</span>
      </nav>

      <header class="bhead">
        <div class="bhead__pills">
          ${statusPill(bounty)} ${categoryPill(bounty.category)} ${deadlinePill(bounty.deadline)}
          ${open ? '' : html`<span class="pill">${left.ms <= 0 && bounty.status === 'open' ? 'past its deadline, results pending' : 'not taking entries'}</span>`}
        </div>
        <h1>${bounty.title}</h1>
        <p class="bhead__summary">${bounty.summary}</p>
        <div class="bhead__by">
          <span>By <strong>${bounty.sponsor?.name ?? 'make.fun'}</strong>${bounty.sponsor?.isVerified ? ' ✓' : ''}</span>
          <span>Opened ${day(bounty.opensAt ?? bounty.publishedAt)}</span>
          ${bounty.harnessKind ? html`<span>Harness <code>${bounty.harnessKind}</code></span>` : ''}
        </div>
        ${bounty.skills?.length ? html`<div class="chips">${bounty.skills.map((skill) => html`<span class="chip">${skill}</span>`)}</div>` : ''}
      </header>

      <section class="ledger card">
        <div class="ledger__figures">
          ${stat({
            label: 'Live pot',
            value: money(bounty.potUsd ?? bounty.rewardAmount),
            note: Number(bounty.entryFeesUsd) > 0
              ? `${usd(bounty.rewardAmount)} put up + ${usd(bounty.entryFeesUsd)} in entry fees`
              : `${usd(bounty.rewardAmount)} put up, no fees yet`,
            tone: 'money',
            size: 'xl',
          })}
          ${stat({
            label: left.ms > 0 ? 'Time left' : 'Deadline',
            value: html`<span data-until="${bounty.deadline}" data-until-class="fig">${left.label}</span>`,
            note: stamp(bounty.deadline),
            size: 'xl',
          })}
          ${stat({
            label: 'Entry fee',
            value: bounty.entryFeeUsd ? usd(bounty.entryFeeUsd) : 'Free',
            note: bounty.entryFeePayers ? `${plural(bounty.entryFeePayers, 'entrant', 'entrants')} paid in` : 'no fee to enter',
          })}
          ${stat({
            label: 'Entries',
            value: count(bounty.submissionCount),
            note: bounty.submissionsPassed != null ? `${count(bounty.submissionsPassed)} valid` : 'submitted',
          })}
        </div>
        <div class="ledger__clock">
          ${deadlineBar(bounty.opensAt ?? bounty.publishedAt, bounty.deadline)}
          <p class="ledger__span">
            <span>Opened ${stamp(bounty.opensAt ?? bounty.publishedAt)}</span>
            <span>${bounty.acceptingSubmissions ? 'Taking entries now' : 'Entries are closed'}</span>
          </p>
        </div>
        <div class="ledger__bottom">
          ${podium(bounty)}
          <a class="btn btn--on" href="${href(`bounty/${bounty.slug}/leaderboard`)}">
            See the leaderboard →
          </a>
        </div>
      </section>

      <nav class="jump" aria-label="On this page">
        <button class="btn" type="button" data-scroll="rewards">Rewards</button>
        <button class="btn" type="button" data-scroll="description">What to build</button>
        ${bounty.rules ? html`<button class="btn" type="button" data-scroll="rules">Rules</button>` : ''}
        ${bounty.kit?.tarball ? html`<a class="btn" href="https://make.fun${bounty.kit.tarball}">Download the kit</a>` : ''}
      </nav>

      ${bounty.winner ? winnerCard(bounty) : ''}
      ${bounty.rulesNote?.text ? html`<p class="notice">${bounty.rulesNote.text}</p>` : ''}

      <div class="columns">
        <div class="columns__main">
          ${section('description', 'What to build', markdown(bounty.description))}
          ${bounty.rules ? section('rules', 'The rules', markdown(bounty.rules)) : ''}
        </div>
        <aside class="columns__rail">
          ${rewards(bounty)}
          ${phases(bounty)}
          ${resolution(bounty)}
          ${bounty.demand ? html`<section class="panel card"><h2 class="panel__title">Who wants it</h2><p class="panel__text">${bounty.demand}</p></section>` : ''}
        </aside>
      </div>`,
    mounted: (root) => {
      for (const button of root.querySelectorAll('[data-scroll]')) {
        button.addEventListener('click', () => {
          root.querySelector(`#${button.dataset.scroll}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
      }
    },
  };
}

/** What the first three places pay as the pot stands now — the figures the eye goes to. */
function podium(bounty) {
  const ladder = (bounty.rewardsNow ?? []).slice(0, 3);
  if (!ladder.length) return '';
  const place = ['1st', '2nd', '3rd'];
  return html`
    <ul class="podium">
      ${ladder.map(
        (row, index) => html`<li>
          <span class="label">${place[index] ?? `#${row.place}`}</span>
          <span class="fig fig--money fig--lg">${money(row.amountUsd ?? row.baseUsd)}</span>
        </li>`,
      )}
    </ul>`;
}

/** A prose block with a heading the page can scroll to without touching the hash. */
const section = (id, title, body) => html`
  <section class="block" id="${id}">
    <h2 class="block__title">${title}</h2>
    <div class="prose">${body}</div>
  </section>`;

/** The rewards table as it stands now: what was put up, plus each entry fee paid in since. */
function rewards(bounty) {
  const ladder = bounty.rewardsNow?.length
    ? bounty.rewardsNow
    : Object.entries(bounty.rewards ?? {}).map(([place, amount]) => ({ place: Number(place), baseUsd: amount, amountUsd: amount }));
  if (!ladder.length) return '';
  const shares = ladder.some((row) => Number(row.feeShareUsd) > 0);
  return html`
    <section class="panel card" id="rewards">
      <h2 class="panel__title">Rewards <span class="panel__hint">${plural(ladder.length, 'place', 'places')} paid</span></h2>
      <div class="scroller">
        <table class="table table--rewards">
          <thead>
            <tr><th>Place</th><th>Put up</th>${shares ? html`<th>Fee share</th>` : ''}<th>Pays now</th></tr>
          </thead>
          <tbody>
            ${ladder.map(
              (row) => html`<tr class="${row.place <= 3 ? 'is-podium' : ''}">
                <td class="num">${row.place}</td>
                <td class="num">${usd(row.baseUsd)}</td>
                ${shares ? html`<td class="num">${Number(row.feeShareUsd) ? `+${usd(row.feeShareUsd)}` : '—'}</td>` : ''}
                <td class="num fig--money">${usd(row.amountUsd ?? row.baseUsd)}</td>
              </tr>`,
            )}
          </tbody>
        </table>
      </div>
      <p class="panel__text">Every entry fee paid goes into the pot and is split down the same ladder, so the places pay more as more entries arrive.</p>
    </section>`;
}

/** The phases a bounty runs through, and which one the clock is in now. */
function phases(bounty) {
  if (!bounty.phases?.length) return '';
  const now = Date.now();
  return html`
    <section class="panel card">
      <h2 class="panel__title">Phases</h2>
      <ol class="phases">
        ${bounty.phases.map((phase) => {
          const started = new Date(phase.startsAt ?? 0).getTime() <= now;
          const ended = phase.finalizedAt != null || new Date(phase.endsAt ?? 0).getTime() <= now;
          return html`<li class="phase ${started && !ended ? 'is-live' : ended ? 'is-done' : ''}">
            <h3 class="phase__title">${phase.title} ${started && !ended ? html`<span class="pill pill--money">live</span>` : ''}</h3>
            <p class="phase__when">${phase.endsAt ? `ends ${stamp(phase.endsAt)}` : phase.key}${phase.scores ? ` · scores ${phase.scores}` : ''}</p>
            <p class="panel__text">${phase.description}</p>
          </li>`;
        })}
      </ol>
    </section>`;
}

/** How the winner is decided, in the organisers' own words. */
function resolution(bounty) {
  if (!bounty.resolution) return '';
  return html`
    <section class="panel card">
      <h2 class="panel__title">How it is settled <span class="panel__hint">${bounty.resolution.method}</span></h2>
      <p class="panel__text">${bounty.resolution.summary}</p>
      ${bounty.placements ? html`<p class="panel__hint">Placements ${bounty.placements.replace(/_/g, ' ')}</p>` : ''}
    </section>`;
}

/** A resolved bounty's winner, and the way to their profile. */
function winnerCard(bounty) {
  const winner = bounty.winner;
  return html`
    <section class="winner card">
      <span class="label">Winner</span>
      <a class="winner__who" href="${href(`u/${winner.handle}`)}">
        ${avatar({ image: winner.image, handle: winner.handle, size: 44 })}
        <span>
          <strong>${winner.handle}</strong>
          <span class="winner__title">${winner.title}</span>
        </span>
      </a>
      ${stat({ label: 'Paid', value: money(winner.amountUsd), tone: 'money', size: 'lg' })}
      ${stat({ label: 'Place', value: `#${winner.placement}`, note: bounty.resolvedAt ? since(bounty.resolvedAt) : '' })}
    </section>`;
}
