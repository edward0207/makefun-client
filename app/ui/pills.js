// The small labelled shapes the screens share: a bounty's category, its state, and the clock
// that drives both the board and the bounty page.

import { html } from '../core/dom.js';
import { elapsed, stamp, timeLeft } from '../core/format.js';

/** A bounty's category, as the API spells it: Trading, Forecasting, Security, Code … */
export const categoryPill = (category) =>
  category ? html`<span class="pill pill--cat">${category}</span>` : '';

/** Where a bounty stands: open for entries, closed and being judged, or resolved and paid. */
export function statusPill(bounty) {
  const state = {
    open: ['Open', 'pill--money'],
    closed: ['Judging', ''],
    resolved: ['Resolved', ''],
    draft: ['Draft', ''],
  }[bounty.status] ?? [bounty.status, ''];
  return html`<span class="pill ${state[1]}">${state[0]}</span>`;
}

/**
 * The time left, live. The clock (core/clock.js) rewrites every `data-until` element each second
 * and swaps the class as the deadline closes in, so this is painted once and then keeps itself.
 */
export function deadlinePill(deadline, { prefix } = {}) {
  const { label, urgency } = timeLeft(deadline);
  const tone = urgency === 'urgent' ? 'pill--hot' : urgency === 'ended' ? 'pill--done' : 'pill--time';
  return html`<span class="pill ${tone}" data-until="${deadline}" data-until-class="pill"
    ${prefix ? html`data-until-prefix="${prefix}"` : ''} title="Closes ${stamp(deadline)}"
    >${prefix ? `${prefix} ${label}` : label}</span>`;
}

/** How much of a bounty's run is gone, as a hairline: full and coral once the clock is out. */
export function deadlineBar(openedAt, deadline) {
  const gone = elapsed(openedAt, deadline);
  const { urgency } = timeLeft(deadline);
  const tone = urgency === 'urgent' || urgency === 'ended' ? 'bar__fill--hot' : '';
  return html`<span class="bar" role="presentation"
    ><span class="bar__fill ${tone}" style="width:${Math.round(gone * 100)}%"></span
  ></span>`;
}
