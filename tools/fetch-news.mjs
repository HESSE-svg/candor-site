// Candor · news builder.
//
// Pulls legal-sector AI coverage from public RSS feeds, keeps the items that
// matter to the people who buy this product (firm leadership, practising
// lawyers, legal ops, legal tech buyers), and regenerates /news.html.
//
// Deliberate limits, so this stays a good citizen and a defensible thing for a
// legal-compliance brand to publish:
//   · Headline + the feed's own short summary only. Never the article body.
//     RSS exists to be syndicated; we trim to ~200 characters and always link
//     back to the publisher.
//   · The preview image is the publisher's own og:image, hotlinked exactly the
//     way a link preview works. Nothing is copied onto our servers, and if an
//     image is missing or blocked, a branded fallback shows instead.
//   · Every card names its source and links out to it.
//
// Zero dependencies on purpose: this runs in CI with no npm install.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UA = 'Mozilla/5.0 (compatible; CandorNewsBot/1.0; +https://candor.legal)'

const FEEDS = [
  { url: 'https://www.artificiallawyer.com/feed/', source: 'Artificial Lawyer' },
  { url: 'https://www.lawnext.com/feed', source: 'LawNext' },
  { url: 'https://abovethelaw.com/feed/', source: 'Above the Law' },
  { url: 'https://abovethelaw.com/legal-innovation-center/feed/', source: 'Above the Law' },
  { url: 'https://legaltechnology.com/feed/', source: 'Legal IT Insider' },
  { url: 'https://legal.thomsonreuters.com/blog/feed/', source: 'Thomson Reuters' },
  { url: 'https://lawtomated.com/feed/', source: 'Lawtomated' },
  { url: 'https://www.legaldive.com/feeds/news/', source: 'Legal Dive' },
]

// An item has to be about AI to make the page at all.
const AI = /\b(a\.?i\.?|artificial intelligence|genai|gen ai|generative|llm|large language model|chatgpt|openai|anthropic|claude|copilot|gemini|machine learning|algorithm|automation|hallucinat|deepfake|prompt)\b/i
// It also has to be about the practice or business of law. Keeps general tech
// news, and stories that merely mention AI in passing, off the page.
const LEGAL = /\b(law|legal|lawyer|attorney|counsel|firm|court|judge|litigat|bar\b|paralegal|practice|client|docket|case law|in-house|compliance|regulat)\b/i
// Hard block: lurid crime and off-topic noise. A story can mention AI and still
// be entirely wrong for a page aimed at firm leadership.
const BLOCK = /\b(murder|killed|kill|homicide|rape|sexual|sexually|porn|assault|shooting|shot dead|stabb|abuse|molest|indicted for|threaten|obituar|dies at|death of|divorce|celebrity|super bowl|nfl|nba)\b/i
// Vendor content marketing. Some is genuinely useful, but it should never crowd
// out reporting, so it is allowed only in small numbers (see PROMO_CAP).
const PROMO = /\b(webinar|white ?paper|e-?book|register now|sign up|sponsored|our (?:new )?product|introducing our|why choose|case study|free trial|demo today)\b/i

// Themes we tag with, in priority order. First hit wins, so the most
// consequential framing (a court sanctioning someone) beats the generic one.
const TOPICS = [
  { key: 'courts', label: 'Courts & sanctions', re: /\b(sanction\w*|fabricat\w*|hallucinat\w* citation|fake citation|nonexistent case|disciplin\w*|bar complaint|malpractice|disbar\w*|courtroom|contempt|judge\w*|court (?:order|rule|ruling|filing)|standing order|filed a brief|in court)\b/i },
  { key: 'rules', label: 'Rules & ethics', re: /\b(ethic\w*|bar association|state bar|aba\b|professional conduct|confidential\w*|privilege\w*|disclosure|supervis\w*|regulat\w*|guidance|legislat\w*|statute|eu ai act|ai act)\b/i },
  { key: 'firms', label: 'Firms & practice', re: /\b(law firm|firms|partner\w*|associate\w*|billable|billing|in-house|general counsel|legal ops|paralegal|practice group|client\w*|adoption|training)\b/i },
  { key: 'business', label: 'Business of legal tech', re: /\b(funding|raises?|acquisi\w*|merger|launch\w*|valuation|revenue|startup|vendor|platform|invest\w*|deal\b)\b/i },
]

const PER_SOURCE_CAP = 3
const PROMO_CAP = 2

const clean = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#8217;|&#039;|&apos;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;|&#8212;/g, ', ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const esc = (s = '') => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? clean(m[1]) : ''
}

async function get(url, ms = 15000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': UA, Accept: '*/*' } })
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

function parseFeed(xml, source) {
  if (!xml) return []
  const out = []
  const blocks = xml.split(/<item[\s>]/).slice(1)
  for (const raw of blocks) {
    const block = raw.split('</item>')[0]
    const title = tag(block, 'title')
    let link = tag(block, 'link')
    if (!link) {
      const m = block.match(/<link[^>]*href=["']([^"']+)/i)
      if (m) link = m[1]
    }
    if (!title || !link) continue
    const desc = tag(block, 'description') || tag(block, 'content:encoded')
    const date = tag(block, 'pubDate') || tag(block, 'dc:date')
    let img = ''
    const mi =
      block.match(/<media:content[^>]+url=["']([^"']+)/i) ||
      block.match(/<media:thumbnail[^>]+url=["']([^"']+)/i) ||
      block.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp))/i)
    if (mi) img = mi[1]
    out.push({ title, link: link.trim(), desc, date, img, source })
  }
  return out
}

async function ogImage(url) {
  const html = await get(url, 12000)
  if (!html) return ''
  const head = html.slice(0, 120000)
  const pats = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)/i,
  ]
  for (const p of pats) {
    const m = head.match(p)
    if (m && /^https?:\/\//i.test(m[1])) return m[1].replace(/&amp;/g, '&')
  }
  return ''
}

// Deterministic branded artwork, used when a publisher gives us no image.
// Flat geometry in the house palette, never a stock gavel.
function fallbackArt(seed, topic) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const beds = { courts: '#1B2A41', rules: '#2F5D50', firms: '#22201D', business: '#7A2E2E' }
  const bg = beds[topic] || '#1B2A41'
  const rot = h % 90
  const n = 5 + (h % 4)
  let marks = ''
  for (let i = 0; i < n; i++) {
    const y = 30 + i * (240 / n)
    const w = 120 + ((h >> (i + 1)) % 420)
    const x = ((h >> (i + 2)) % 200) - 40
    const o = (0.05 + ((h >> i) % 7) / 55).toFixed(3)
    marks += `<rect x="${x}" y="${y}" width="${w}" height="6" fill="#FAF8F5" opacity="${o}"/>`
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">` +
    `<rect width="640" height="360" fill="${bg}"/>` +
    `<g transform="rotate(${rot % 12 - 6} 320 180)">${marks}</g>` +
    `<circle cx="${120 + (h % 400)}" cy="${90 + (h % 180)}" r="${60 + (h % 70)}" fill="none" stroke="#FAF8F5" stroke-opacity="0.13" stroke-width="2"/>` +
    `<text x="42" y="316" font-family="Georgia,serif" font-size="46" fill="#FAF8F5" fill-opacity="0.16">C</text>` +
    `</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

function topicOf(text) {
  for (const t of TOPICS) if (t.re.test(text)) return t
  return { key: 'business', label: 'Business of legal tech' }
}

function when(d) {
  if (!d) return ''
  const t = new Date(d)
  if (isNaN(t)) return ''
  const days = Math.floor((Date.now() - t.getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return days + ' days ago'
  return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function pool(items, size, fn) {
  const out = []
  let i = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
      }
    }),
  )
  return out
}

// ---------------------------------------------------------------- page ------

function card(it, big = false) {
  const img = it.img || it.art
  const cls = big ? 'nc big' : 'nc'
  return `
    <a class="${cls}" href="${esc(it.link)}" target="_blank" rel="noopener noreferrer">
      <figure class="nc-fig" style="background-image:url(&quot;${esc(it.art)}&quot;)">
        <img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">
        <figcaption class="nc-topic">${esc(it.topicLabel)}</figcaption>
      </figure>
      <div class="nc-body">
        <h3>${esc(it.title)}</h3>
        ${it.desc ? `<p>${esc(it.desc)}</p>` : ''}
        <div class="nc-meta"><span class="nc-src">${esc(it.source)}</span>${it.when ? `<span class="nc-dot">·</span><span>${esc(it.when)}</span>` : ''}</div>
      </div>
    </a>`
}

function page(items, builtAt) {
  const [hero, ...rest] = items
  const stamp = builtAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const nav = `<nav class="navlinks"><a href="/product">Product</a><a href="/pattern-capture">Pattern Capture</a><a href="/why-now">Why now</a><a href="/pricing">Pricing</a><a href="/security">Security</a><a class="cta" href="/demo">Get a look</a></nav>`
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>News · Candor</title>
<meta name="description" content="AI in the legal sector, tracked: court sanctions, bar guidance, firm adoption, and the business of legal technology. Updated automatically.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="AI and the legal profession, tracked">
<meta property="og:description" content="Court rulings, ethics guidance, firm adoption, and legal tech business news, gathered in one place.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://candor.legal/news">
<meta property="og:image" content="https://candor.legal/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css?v=6">
</head><body>
<a class="skip" href="#main">Skip to content</a>
<header class="nav"><div class="nav-in">
  <a class="brand" href="/" aria-label="Candor home"><svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="16" fill="#1B2A41"/><circle cx="50" cy="50" r="39" fill="none" stroke="#FAF8F5" stroke-opacity="0.22" stroke-width="2"/><text x="50" y="52" font-family="Instrument Serif,Georgia,serif" font-size="58" fill="#FAF8F5" text-anchor="middle" dominant-baseline="central">C</text></svg><span class="name">Candor<span>.</span></span></a>
  <button class="navtoggle" aria-label="Toggle menu">&#9776;</button>
  ${nav}
</div></header>

<main id="main">
<section class="wrap pagehead">
  <div class="mono eyebrow">News</div>
  <h1>AI is rewriting legal practice. Here is the running record.</h1>
  <p class="lede">Court sanctions, bar guidance, firm adoption, and the money moving through legal technology, gathered from the trade press and refreshed automatically. Headlines and links only; each story opens at its publisher.</p>
  <p class="mono" style="margin-top:14px">Last updated ${esc(stamp)} &middot; refreshes on its own</p>
</section>

<section class="wrap">
  ${hero ? `<div class="newshero">${card(hero, true)}</div>` : '<p class="lede">The feed is refreshing. Check back shortly.</p>'}
  <div class="newsgrid">
    ${rest.map((it) => card(it)).join('\n')}
  </div>
  <p class="caption" style="margin-top:26px">Headlines and summaries belong to their publishers and link back to the original reporting. Candor gathers them for convenience and does not endorse any story, product, or company mentioned.</p>
</section>

<section class="band reveal"><div class="wrap narrow center">
  <h2>Reading about the risk is one thing. Documenting it is another.</h2>
  <p class="sectionlede" style="margin:14px auto 0">Most of these stories end the same way: someone could not show what happened. Candor is the record that answers it.</p>
  <div class="btnrow" style="justify-content:center"><a class="btn" href="/demo">Get a look</a><a class="btn ghost" href="/product">How it works</a></div>
</div></section>
</main>

<footer><div class="wrap">
  <div class="foot-grid">
    <div>
      <span class="name" style="font-family:var(--f-serif);font-size:22px;color:var(--navy)">Candor<span style="color:var(--ox)">.</span></span>
      <p style="margin-top:10px;max-width:22em">The record of how AI is used inside a law firm.</p>
      <div class="social">
        <a href="https://www.instagram.com/candor.legal" aria-label="Instagram" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a>
        <a href="#" aria-label="TikTok" title="TikTok (coming soon)"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2 1.6 3.6 3.6 3.9v2.5c-1.3 0-2.6-.4-3.6-1.1v6.1c0 3-2.4 5.4-5.4 5.4S5.2 17.4 5.2 14.4 7.6 9 10.6 9c.3 0 .6 0 .9.1v2.6c-.3-.1-.6-.2-.9-.2-1.5 0-2.8 1.2-2.8 2.8s1.2 2.8 2.8 2.8 2.8-1.2 2.8-2.8V3H16z"/></svg></a>
        <a href="https://www.linkedin.com/in/jesse-hollar-084999283" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21H9z"/></svg></a>
      </div>
    </div>
    <div class="foot-links"><a href="/product">Product</a><a href="/pattern-capture">Pattern Capture</a><a href="/why-now">Why now</a><a href="/news">News</a><a href="/pricing">Pricing</a><a href="/security">Security</a><a href="/resources">Resources</a><a href="/about">About</a><a href="/demo">Contact</a></div>
  </div>
  <p class="disc">Candor is software. It does not provide legal advice, and it does not determine whether a firm complies with any rule of professional conduct. It produces the record a firm's attorneys use to make that judgment themselves. &copy; 2026 Candor &middot; <a href="mailto:jesse@candor.legal">jesse@candor.legal</a></p>
</div></footer>
<script src="/assets/site.js?v=6"></script>
</body></html>
`
}

// ---------------------------------------------------------------- main ------

async function main() {
  const raw = (await Promise.all(FEEDS.map(async (f) => parseFeed(await get(f.url), f.source)))).flat()
  console.log(`fetched ${raw.length} items from ${FEEDS.length} feeds`)

  const seenLink = new Set()
  const seenTitle = new Set()
  const pool0 = []
  for (const it of raw) {
    const hay = it.title + ' ' + it.desc
    if (!AI.test(hay)) continue
    if (!LEGAL.test(hay)) continue
    if (BLOCK.test(hay)) continue
    const key = it.link.split('?')[0]
    const tkey = it.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
    if (seenLink.has(key) || seenTitle.has(tkey)) continue
    seenLink.add(key)
    seenTitle.add(tkey)
    const ts = it.date ? Date.parse(it.date) : 0
    // Anything older than ~120 days is stale for a "what is happening" page.
    if (ts && Date.now() - ts > 120 * 86400000) continue
    const t = topicOf(hay)
    let desc = it.desc.replace(/\s*\[?\.\.\.\]?\s*$/, '')
    if (desc.length > 200) desc = desc.slice(0, 197).replace(/\s+\S*$/, '') + '…'
    // A story whose own headline is about AI is more likely to be real news than
    // one that only mentions it in passing.
    const strong = AI.test(it.title)
    pool0.push({ ...it, ts, desc, topic: t.key, topicLabel: t.label, when: when(it.date), strong, promo: PROMO.test(hay) })
  }

  // Rank by headline relevance first, then recency, then fill under the caps so
  // no single outlet (or a run of vendor posts) takes over the page.
  pool0.sort((a, b) => (b.strong - a.strong) || (b.ts - a.ts))
  const perSource = {}
  let promos = 0
  let items = []
  for (const it of pool0) {
    if ((perSource[it.source] || 0) >= PER_SOURCE_CAP) continue
    if (it.promo && promos >= PROMO_CAP) continue
    perSource[it.source] = (perSource[it.source] || 0) + 1
    if (it.promo) promos++
    items.push(it)
    if (items.length >= 21) break
  }
  items.sort((a, b) => b.ts - a.ts)
  console.log(`kept ${items.length} of ${pool0.length} eligible (caps: ${PER_SOURCE_CAP}/source, ${PROMO_CAP} promo)`)

  const imgs = await pool(items, 6, async (it) => (it.img ? it.img : await ogImage(it.link)))
  items.forEach((it, i) => {
    it.img = imgs[i] || ''
    it.art = fallbackArt(it.title + it.source, it.topic)
  })
  console.log(`resolved images for ${items.filter((i) => i.img).length}/${items.length}`)

  const builtAt = new Date()
  writeFileSync(join(ROOT, 'news.html'), page(items, builtAt))
  mkdirSync(join(ROOT, 'assets'), { recursive: true })
  writeFileSync(
    join(ROOT, 'assets', 'news.json'),
    JSON.stringify({ builtAt: builtAt.toISOString(), count: items.length, items: items.map(({ art, ...r }) => r) }, null, 2),
  )
  console.log('wrote news.html + assets/news.json')
}

main().catch((e) => {
  console.error('news build failed:', e)
  process.exit(1)
})
