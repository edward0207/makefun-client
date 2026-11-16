// Money and counts, set as figures: a value in tabular monospace with its name under it. The
// board, the bounty page and a profile all land the eye on the same shapes.

import { html } from '../core/dom.js';
import { usd } from '../core/format.js';

/** A dollar amount with its cents set quieter, so a column of money lines up on the dollar. */
export function money(value) {
  const text = usd(value);
  const [dollars, cents] = text.split('.');
  return cents ? html`${dollars}<span class="cents">.${cents}</span>` : html`${text}`;
}

/**
 * A figure under its label: `stat({ label: 'Live pot', value: money(b.potUsd), tone: 'money' })`.
 * `value` may be markup. `note` is the quiet line under it.
 */
export function stat({ label, value, note, tone = '', size = '' }) {
  return html`
    <div class="stat">
      <span class="label">${label}</span>
      <span class="stat__value ${tone ? `fig--${tone}` : ''} ${size ? `fig--${size}` : ''}">${value}</span>
      ${note ? html`<span class="stat__note">${note}</span>` : ''}
    </div>`;
}

/** The headline figure of a screen: the live pot, in mint, as big as the page allows. */
export const potFigure = (value, note) =>
  stat({ label: 'Live pot', value: money(value), note, tone: 'money', size: 'xl' });
