// Markup without a framework: an `html` template tag that escapes everything it interpolates,
// and the two DOM calls the views need. A view returns markup; the screen puts it on the page.

/** Markup already escaped: what `html` returns, and the only thing interpolated verbatim. */
class Markup {
  constructor(text) {
    this.text = text;
  }
  toString() {
    return this.text;
  }
}

/** Text made safe to put inside HTML, attribute values included. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Trusted markup, for the rare value built as HTML elsewhere (see ui/markdown.js). */
export const raw = (text) => new Markup(String(text ?? ''));

/**
 * A template tag for HTML: `html`<p>${name}</p>`` escapes `name`, passes nested `html` results
 * through untouched, joins arrays and drops null, undefined and false.
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += flatten(values[i]) + strings[i + 1];
  return new Markup(out);
}

function flatten(value) {
  if (value == null || value === false) return '';
  if (value instanceof Markup) return value.text;
  if (Array.isArray(value)) return value.map(flatten).join('');
  return esc(value);
}

/** Markup parsed into nodes, ready to insert. */
export function nodes(markup) {
  const template = document.createElement('template');
  template.innerHTML = String(markup);
  return template.content;
}

/** An element's children replaced by markup, in one paint. */
export function fill(element, markup) {
  element.replaceChildren(nodes(markup));
  return element;
}

const sheets = new Map();

/**
 * The stylesheet at `app/styles/<name>.css`, fetched once and awaited, so a screen is never shown
 * unstyled. styles/core.css carries the first paint; a view asks for its own sheet here, which is
 * why a first load pays for one stylesheet instead of all five.
 */
export function sheet(name) {
  const href = `styles/${name}.css`;
  if (sheets.has(href)) return sheets.get(href);
  const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href });
  const ready = new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
  document.head.append(link);
  sheets.set(href, ready);
  return ready;
}
