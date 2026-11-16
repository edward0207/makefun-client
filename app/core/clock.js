// One second-hand for the whole page: the header's UTC clock and every deadline on screen.
//
// A deadline is markup, not state: any element with `data-until="<iso>"` is refreshed in place
// each second, and gets the class the time left deserves, so a bounty closing in an hour looks
// different from one closing next week without the view re-rendering.

import { timeLeft } from './format.js';

const WATCHED = '[data-until]';
let started = false;

/** Starts the tick. Called once, from main.js. */
export function startClock() {
  if (started) return;
  started = true;
  const beat = () => {
    paintClock();
    paintDeadlines(document);
    setTimeout(beat, 1000 - (Date.now() % 1000));
  };
  beat();
}

/** Paints the deadlines inside a freshly mounted screen, without waiting for the next second. */
export const refreshDeadlines = (root) => paintDeadlines(root);

function paintClock() {
  const clock = document.getElementById('clock');
  if (!clock) return;
  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = now.toISOString().slice(11, 19);
}

function paintDeadlines(root) {
  for (const element of root.querySelectorAll(WATCHED)) {
    const left = timeLeft(element.dataset.until);
    const text = element.dataset.untilPrefix ? `${element.dataset.untilPrefix} ${left.label}` : left.label;
    if (element.textContent !== text) element.textContent = text;
    const kind = element.dataset.untilClass;
    if (kind) {
      element.classList.toggle(`${kind}--time`, left.urgency === 'open' || left.urgency === 'soon');
      element.classList.toggle(`${kind}--hot`, left.urgency === 'urgent');
      element.classList.toggle(`${kind}--done`, left.urgency === 'ended');
    }
  }
}
