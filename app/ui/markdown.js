// The Markdown a bounty is written in. make.fun's `description`, `summary` and `rules` come back
// as Markdown, and this is the smallest renderer that does them justice: headings, lists, fenced
// and inline code, bold, italic and links. Everything is escaped before a tag is added, and only
// http, https and in-page links survive, so nothing the API sends can inject markup.

import { esc, raw } from '../core/dom.js';

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^(?:---+|\*\*\*+|___+)\s*$/;
const FENCE = /^\s*```/;

/** Markdown as markup, ready for a `.prose` block. */
export function markdown(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  let list = null;
  let fenced = false;

  const endParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const endList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const startList = (tag) => {
    if (list !== tag) {
      endList();
      out.push(`<${tag}>`);
      list = tag;
    }
  };

  for (const line of lines) {
    if (FENCE.test(line)) {
      endParagraph();
      endList();
      out.push(fenced ? '</code></pre>' : '<pre><code>');
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      out.push(`${esc(line)}\n`);
      continue;
    }
    if (!line.trim()) {
      endParagraph();
      endList();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      endParagraph();
      endList();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (RULE.test(line)) {
      endParagraph();
      endList();
      out.push('<hr>');
      continue;
    }
    const bullet = BULLET.exec(line);
    const number = !bullet && NUMBER.exec(line);
    if (bullet || number) {
      endParagraph();
      startList(bullet ? 'ul' : 'ol');
      out.push(`<li>${inline((bullet ?? number)[1])}</li>`);
      continue;
    }
    const quote = QUOTE.exec(line);
    if (quote) {
      endParagraph();
      endList();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }
    const previous = out.length - 1;
    if (list && out[previous]?.endsWith('</li>')) {
      // A plain line under a list item is part of that item, not a new paragraph.
      out[previous] = `${out[previous].slice(0, -5)} ${inline(line.trim())}</li>`;
      continue;
    }
    paragraph.push(line.trim());
  }
  endParagraph();
  endList();
  if (fenced) out.push('</code></pre>');
  return raw(out.join(''));
}

/** The first sentences of a Markdown block as plain text, for a card or a meta description. */
export function plainStart(text, limit = 220) {
  const flat = String(text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > limit ? `${flat.slice(0, limit).replace(/\s\S*$/, '')}…` : flat;
}

/** Inline Markdown. Code spans are taken out first so nothing is transformed inside them. */
function inline(text) {
  return String(text)
    .split('`')
    .map((part, index) => (index % 2 ? `<code>${esc(part)}</code>` : emphasis(esc(part))))
    .join('');
}

function emphasis(escaped) {
  return escaped
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|#|\/)[^\s)]+)\)/g, (_, label, url) => `<a href="${link(url)}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_(?=$|[\s.,;:)])/g, '$1<em>$2</em>');
}

/** A Markdown link's target: in-page, or on make.fun when the API gave a site path. */
const link = (url) => (url.startsWith('/') ? `https://make.fun${url}` : url);
