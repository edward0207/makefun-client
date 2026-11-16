// When there is nothing to show: a hash that matches no route, or an API call that came back with
// a problem. Both say what happened and offer the way back to the board, rather than an empty page.

import { html } from '../core/dom.js';
import { href } from '../core/router.js';

/** The screen for a hash that matches no route. */
export function render({ params }) {
  return {
    title: 'No such page',
    body: html`
      <section class="fail card">
        <h1>No such page</h1>
        <p>Nothing here answers to <code>${params.hash ?? location.hash}</code>. The four addresses this
          client knows are the board, a bounty, a bounty's leaderboard and an account's profile.</p>
        <p class="fail__routes">
          <a class="btn btn--on" href="${href('')}">The board</a>
          <code>#/bounty/&lt;slug&gt;</code>
          <code>#/bounty/&lt;slug&gt;/leaderboard</code>
          <code>#/u/&lt;handle&gt;</code>
        </p>
      </section>`,
  };
}

/** The screen for a failed request: the API's own words, and what to do about them. */
export function failure(error) {
  const status = error?.status;
  const title = status === 404 ? 'Not on make.fun' : status === 429 ? 'Too many requests' : 'make.fun did not answer';
  return html`
    <section class="fail card">
      <h1>${title}</h1>
      <p>${error?.message ?? String(error)}</p>
      ${status ? html`<p><code>HTTP ${status}</code> <code>${error.path ?? ''}</code></p>` : ''}
      <p class="fail__routes">
        <a class="btn btn--on" href="${href('')}">Back to the board</a>
        <button class="btn" type="button" data-reload>Try again</button>
      </p>
    </section>`;
}
