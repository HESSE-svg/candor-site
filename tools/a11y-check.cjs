// Accessibility check for candor.legal: runs axe-core (WCAG 2.2 AA plus best
// practice) on every .html page, served locally, at desktop and phone width.
//
//   npx serve -l 5055 .          (in another shell, from the repo root)
//   node tools/a11y-check.cjs    (prints violations; exit 1 if any)
//
// Needs Playwright and axe-core. In a Claude Code cloud session, install
// axe-core into the scratchpad and point NODE_PATH at it:
//   npm i --prefix "$SCRATCH" axe-core
//   NODE_PATH="$SCRATCH/node_modules:/opt/node22/lib/node_modules" node tools/a11y-check.cjs
const fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const root = path.resolve(__dirname, '..')
const base = process.env.A11Y_BASE || 'http://127.0.0.1:5055/'
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined

const pages = []
;(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    if (f === 'node_modules' || f.startsWith('.')) continue
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.html')) pages.push(path.relative(root, p))
  }
})(root)

;(async () => {
  try { await fetch(base) } catch (e) {
    console.error('Nothing is serving ' + base + '. Start it first: npx serve -l 5055 .')
    process.exit(2)
  }
  const b = await chromium.launch({ executablePath: exe })
  let total = 0
  for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const agg = {}
    for (const pg of pages) {
      const p = await b.newPage({ viewport, reducedMotion: 'reduce' })
      await p.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort())
      try { await p.goto(base + pg, { waitUntil: 'load', timeout: 15000 }) } catch (e) {}
      await p.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in')))
      await p.waitForTimeout(500)
      await p.addScriptTag({ content: axe })
      const r = await p.evaluate(async () => {
        const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })
        return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, t: v.nodes[0].target.join(' ') }))
      })
      const wide = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      if (wide) r.push({ id: 'horizontal-overflow', impact: 'serious', help: 'Page scrolls sideways', n: 1, t: 'html' })
      for (const v of r) {
        agg[v.id] = agg[v.id] || { impact: v.impact, help: v.help, n: 0, eg: [] }
        agg[v.id].n += v.n
        if (agg[v.id].eg.length < 3) agg[v.id].eg.push(pg + ': ' + v.t)
      }
      await p.close()
    }
    for (const [id, v] of Object.entries(agg)) {
      total += v.n
      console.log(`[${label}] ${v.impact} ${id} (${v.n}): ${v.help}\n    e.g. ${v.eg.join('\n         ')}`)
    }
  }
  await b.close()
  console.log(total ? `${total} problem(s) found.` : `No problems on ${pages.length} pages, desktop and phone.`)
  process.exit(total ? 1 : 0)
})()
