// Candor site: put the shared footer, the header's Contact link and the
// shared stylesheet into every page. Run after changing FOOTER below:
//
//   node tools/site-chrome.mjs
//
// The phone menu is built by assets/site.js (MENU), so it needs no page edits.
// tools/fetch-news.mjs imports FOOTER so /news stays the same as the rest.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CHROME_CSS = '<link rel="stylesheet" href="/assets/chrome.css?v=7">'
export const SITE_JS = '<script src="/assets/site.js?v=16"></script>'

const COLS = [
  ['Product', [
    ['/product', 'How Candor works'],
    ['/ai-governance-software', 'AI governance software'],
    ['/review-demo', 'Click through a review'],
    ['/pattern-capture', 'Pattern Capture'],
    ['/renewal-packet', 'Carrier renewal packet'],
    ['/changelog', 'What’s new'],
  ]],
  ['Get started', [
    ['/start', 'Start free for a month'],
    ['/pricing', 'Pricing'],
    ['/demo', 'Get a look'],
    ['/contact', 'Contact'],
  ]],
  ['Resources', [
    ['/resources', 'Free tools'],
    ['/guides', 'Guides'],
    ['/rules', 'AI rules by state'],
    ['/ai-rules', 'AI ethics rules'],
    ['/ai-sanctions', 'AI sanctions tracker'],
    ['/news', 'News'],
  ]],
  ['Compare', [
    ['/vs/manual-tracking', 'vs manual tracking'],
    ['/vs/credo-ai', 'vs Credo AI'],
    ['/vs/intapp-celeste', 'vs Intapp Celeste'],
  ]],
  ['Company', [
    ['/about', 'About'],
    ['/plan', 'Our plan'],
    ['/why-now', 'Why now'],
    ['/international', 'International'],
  ]],
  ['Trust', [
    ['/security', 'Security'],
    ['/privacy', 'Privacy'],
    ['/accessibility', 'Accessibility'],
  ]],
]
const amp = (s) => s.replace(/&/g, '&amp;').replace(/’/g, '&rsquo;')

export const FOOTER = `<footer class="sf"><div class="sf-in">
  <div class="sf-top">
    <div><a class="sf-brand" href="/" aria-label="Candor home"><img src="/assets/icon.svg" alt="" width="28" height="28"><b>Candor<span>.</span></b></a>
      <p class="sf-tag">The AI your firm works in, with the record built in.</p></div>
  </div>
  <nav class="sf-cols" aria-label="Footer">
${COLS.map(([h, links]) => `    <div><h2>${h}</h2><ul>${links.map(([href, t]) => `<li><a href="${href}">${amp(t)}</a></li>`).join('')}</ul></div>`).join('\n')}
  </nav>
  <div class="sf-bot">
    <p class="sf-copy">&copy; 2026 Candor &middot; <a href="mailto:jesse@candor.legal">jesse@candor.legal</a></p>
    <div class="sf-social">
      <a href="https://www.instagram.com/candor.legal" aria-label="Instagram" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a>
    </div>
  </div>
  <p class="disc">Candor is software. It does not provide legal advice, and it does not determine whether a firm complies with any rule of professional conduct. It produces the record a firm&rsquo;s attorneys use to make that judgment themselves.</p>
</div></footer>`

const NAV_CONTACT = '<a class="nav-contact" href="/contact">Contact</a>'

// The top menu: three groups that open, then two plain links. The phone menu
// (assets/site.js) is built from this same markup, so there is one list.
const NAV = [
  ['Product', [
    ['/product', 'How Candor works', 'Screening, the AI log, sign-off and reports'],
    ['/ai-governance-software', 'AI governance software', 'What the category is, and where Candor fits'],
    ['/review-demo', 'Click through a review', 'An attorney sign-off, start to finish'],
    ['/pattern-capture', 'Pattern Capture', 'How your firm corrects AI, metadata only'],
    ['/renewal-packet', 'Carrier renewal packet', 'The AI questions carriers ask, from your record'],
    ['/changelog', 'What’s new', 'Every release, dated'],
  ]],
  ['Resources', [
    ['/resources', 'Free tools', 'An AI policy template and a readiness checklist'],
    ['/guides', 'Guides', 'ABA Opinion 512, firm AI policy, carrier questions'],
    ['/rules', 'AI rules by state', 'Consent, billing, verification and filing duties'],
    ['/ai-rules', 'AI ethics rules', 'Pick a jurisdiction, see its duties'],
    ['/ai-sanctions', 'AI sanctions tracker', 'Courts that sanctioned AI-made citations'],
  ]],
  ['Company', [
    ['/about', 'About', 'Why Candor exists'],
    ['/plan', 'Our plan', 'Law firms first, then other professions'],
    ['/why-now', 'Why now', 'Carriers, regulators and courts are asking'],
    ['/international', 'International', 'Where Candor is headed outside the U.S.'],
    ['/contact', 'Contact', 'Questions, a walkthrough or a security review'],
  ]],
  ['/pricing', 'Pricing'],
  ['/security', 'Security'],
  ['/news', 'News'],
]
const CHEV = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
export const NAV_HTML = '<nav class="navlinks" aria-label="Primary">' + NAV.map((it) => {
  if (typeof it[1] === 'string') return `<a href="${it[0]}">${it[1]}</a>`
  const id = 'nd-' + it[0].toLowerCase()
  return `<div class="nd"><button type="button" class="nd-b" aria-expanded="false" aria-controls="${id}">${it[0]}${CHEV}</button>` +
    `<div class="nd-p" id="${id}"><ul>${it[1].map(([href, t, d]) => `<li><a href="${href}"><b>${amp(t)}</b><small>${amp(d)}</small></a></li>`).join('')}</ul></div></div>`
}).join('') + '<a class="m-cta" href="/start">Start free</a></nav>'

/** Apply the shared chrome to one page's HTML. Idempotent. */
export function applyChrome(html) {
  let s = html
  if (!s.includes('/assets/chrome.css')) s = s.replace('</head>', CHROME_CSS + '\n</head>')
  else s = s.replace(/<link rel="stylesheet" href="\/assets\/chrome\.css[^"]*">/, CHROME_CSS)
  s = s.replace(/<script src="\/assets\/site\.js(?:\?v=\d+)?"><\/script>/, SITE_JS)
  if (!s.includes('/assets/site.js')) s = s.replace('</body>', SITE_JS + '\n</body>')
  if (!s.includes('class="nav-contact"')) s = s.replace('<div class="nav-r">', '<div class="nav-r">' + NAV_CONTACT)
  s = s.replace(/<nav class="(?:nav-links )?navlinks"[^>]*>[\s\S]*?<\/nav>\s*(?=\n?\s*<div class="nav-r">)/, NAV_HTML + '\n  ')
  s = s.replace(/<footer[\s\S]*?<\/footer>/, FOOTER)
  if (!s.includes('<footer')) s = s.replace(SITE_JS, FOOTER + '\n' + SITE_JS)
  return s
}

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const SKIP = new Set(['walkthrough.html']) // embedded in the homepage, no chrome
function pages(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return ['design-lab', 'node_modules', '.git', '.vercel', 'tools', 'assets', '.claude'].includes(f) ? [] : pages(p)
    return f.endsWith('.html') && !SKIP.has(relative(ROOT, p).replace(/\\/g, '/')) ? [p] : []
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let n = 0
  for (const p of pages(ROOT)) {
    const raw = readFileSync(p, 'utf8')
    const crlf = raw.includes('\r\n')
    const out = applyChrome(raw.split('\r\n').join('\n'))
    const final = crlf ? out.split('\n').join('\r\n') : out
    if (final !== raw) { writeFileSync(p, final); n++ }
  }
  console.log('updated ' + n + ' pages')
}
