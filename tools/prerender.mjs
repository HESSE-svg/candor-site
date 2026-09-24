// Candor site · write crawler-readable HTML for the pages that render from data.
//
// The sanctions tracker and the AI-rules checker build their content in the
// browser from a data array. Many AI crawlers (and some search crawlers) read
// the raw HTML and never run that script, so they saw an empty tracker. This
// writes the same content as plain HTML between <!--prerender:NAME--> markers,
// plus schema.org data. The page's own script still re-renders it for people.
//
// Run after changing CASES or JUR:   node tools/prerender.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const grab = (html, name) => {
  const m = html.match(new RegExp('var ' + name + ' = ([\\s\\S]*?\\n[\\]}]);'))
  if (!m) throw new Error('no ' + name + ' in page')
  return vm.runInNewContext('(' + m[1] + ')')
}
function put(html, name, inner) {
  const re = new RegExp('<!--prerender:' + name + '-->[\\s\\S]*?<!--/prerender:' + name + '-->')
  if (!re.test(html)) throw new Error('no prerender:' + name + ' markers')
  return html.replace(re, '<!--prerender:' + name + '-->' + inner + '<!--/prerender:' + name + '-->')
}

// --- sanctions tracker ---
{
  const file = 'ai-sanctions.html'
  let html = readFileSync(file, 'utf8')
  const cases = grab(html, 'CASES').slice().sort((a, b) => b.penalty - a.penalty)
  const cards = cases.map((c) =>
    '<article class="case" id="' + esc(c.id) + '"><div class="case-top"><div><h3>' + esc(c.name) + '</h3>' +
    '<div class="meta">' + esc(c.court) + ' &middot; ' + esc(c.year) + ' &middot; ' + esc(c.jurisdiction) + '</div></div>' +
    '<div class="penalty">' + esc(c.penaltyLabel) + '</div></div>' +
    '<p class="what">' + esc(c.what) + '</p>' + (c.note ? '<p class="cnote">' + esc(c.note) + '</p>' : '') +
    '<p class="src"><a href="' + esc(c.source) + '" target="_blank" rel="noopener">' + esc(c.sourceLabel) + ' &rarr;</a>' +
    (c.detail ? ' &middot; <a href="' + esc(c.detail) + '">Full case &rarr;</a>' : '') + '</p></article>').join('')
  html = put(html, 'cases', cards)
  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'AI hallucination sanctions against lawyers',
    description: 'Court decisions sanctioning lawyers for filing AI-fabricated citations, with the penalty and a link to each decision.',
    url: 'https://candor.legal/ai-sanctions', numberOfItems: cases.length,
    itemListElement: cases.map((c, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: { '@type': 'CreativeWork', name: c.name, description: c.what, url: c.detail ? 'https://candor.legal' + c.detail : 'https://candor.legal/ai-sanctions#' + c.id },
    })),
  }
  html = put(html, 'cases-ld', '<script type="application/ld+json">' + JSON.stringify(ld) + '</script>')
  writeFileSync(file, html)
  console.log(file + ': ' + cases.length + ' cases')
}

// --- AI rules checker ---
{
  const file = 'ai-rules.html'
  let html = readFileSync(file, 'utf8')
  const jur = grab(html, 'JUR')
  const blocks = Object.entries(jur).map(([id, j]) =>
    '<details class="jall"' + (id === 'aba' ? ' open' : '') + '><summary><b>' + esc(j.name) + '</b></summary>' +
    '<p class="auth">' + (j.url ? '<a href="' + esc(j.url) + '" target="_blank" rel="noopener">' + esc(j.authority) + '</a>' : esc(j.authority)) + '</p>' +
    '<ul>' + (j.duties || []).map((d) => '<li><b>' + esc(d.label) + ': ' + esc(d.vlabel) + '.</b> ' + esc(d.text) + '</li>').join('') + '</ul></details>').join('')
  html = put(html, 'jur', '<h2>Every jurisdiction covered, in full</h2>' + blocks)
  writeFileSync(file, html)
  console.log(file + ': ' + Object.keys(jur).length + ' jurisdictions')
}
