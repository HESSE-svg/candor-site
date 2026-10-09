// Candor site: is assets/cite-extract.js still the app's citation extractor?
//
//   node tools/check-extractor-sync.mjs                  behaviour checks only
//   node tools/check-extractor-sync.mjs ../candor        ...and compare with the app's copy
//
// The free check at /check finds citations in the browser with a copy of
// app/src/lib/moduleF.ts (HESSE-svg/candor). The app server refuses anything
// that is not a citation, but what the page FINDS should match what the app
// finds, and above all the page must never pick up a street address and send
// it. This compares the copied pieces (comments, spacing and TypeScript types
// ignored) and runs the same address and citation cases the app's
// security.test.mjs runs. Exit 1 on any difference.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Line endings differ between checkouts (Windows gives CRLF); compare on \n.
const lf = (s) => s.replace(/\r\n/g, '\n')
const site = lf(readFileSync(join(ROOT, 'assets', 'cite-extract.js'), 'utf8'))
let failed = 0
const ok = (name, cond) => { if (!cond) failed++; console.log((cond ? 'PASS  ' : 'FAIL  ') + name) }

// --- behaviour ---
const sandbox = {}
vm.runInNewContext(site, { globalThis: sandbox })
const x = sandbox.CandorCite.extractCitations
for (const addr of ['the insured property at 1450 NW 87 Ave, Miami', '1450 N.W. 87 Ave', '300 SW 1 Ave', '1100 SE 3 St',
  '3000 NE 2 Ave', '3900 US 1, Tequesta, FL 33469', 'at 1200 US 441.', '3900 US 1, 2nd floor', 'Unit 5 A 210', 'Box 12 P 34',
  '1450 N.W. 87 AVE', '1450 N.W. 87 ave', '300 S.W. 1 STREET', '3900 U.S. 1, Tequesta, FL 33469',
  '1200 U.S. 441, Pahokee, FL 33476', '3900 U.S. 1 North', '1450 N.W. 87, Miami 33147',
  '1450 N.W. 87, Miami', '3900 U.S. 1, Tequesta', '1450 S.E. 12, Homestead']) {
  ok('address never extracted: ' + addr, x(addr).length === 0)
}
ok('no-period citations are extracted when written like one',
  x('Brown, 347 US 483 (1954)').join() === '347 US 483' && x('Brown, 347 US 483, 495').join() === '347 US 483'
  && x('123 F3d 456 (11th Cir. 1999)').join() === '123 F3d 456')
ok('citations with periods are extracted', x('Brown v. Board, 347 U.S. 483.').join() === '347 U.S. 483'
  && x('Roe v. Wade, 410 U.S. 113, 153 (1973), and Brown, 347 U.S. 483.').join() === '410 U.S. 113,347 U.S. 483'
  && x('123 N.W.2d 456 (Minn. 1964)').join() === '123 N.W.2d 456'
  && x('Smith v. Jones, 123 N.W. 456 (Minn. 1909)').join() === '123 N.W. 456' && x('Marbury, 5 U.S. 137.').join() === '5 U.S. 137')
ok('a statute is found and told apart', x('under 42 U.S.C. § 1983').join() === '42 U.S.C. § 1983' && sandbox.CandorCite.isStatute('42 U.S.C. § 1983') && !sandbox.CandorCite.isStatute('347 U.S. 483'))
ok('names, SSNs and docket numbers are never extracted', x('Jane Roe, SSN 123-45-6789, Case No. 2026-CA-0417, policy 45812').length === 0)

// --- the copy matches the app ---
const appRepo = process.argv[2]
if (appRepo) {
  const app = lf(readFileSync(join(appRepo, 'app', 'src', 'lib', 'moduleF.ts'), 'utf8'))
  const norm = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
    .replace(/\s+/g, '')
    .replace(/^export/, '')
    .replace(/\(text:string,m:RegExpExecArray\):boolean/g, '(text,m)')
    .replace(/\(text:string\):string\[\]/g, '(text)')
    .replace(/newSet<string>\(\)/g, 'newSet()')
    .replace(/letm:RegExpExecArray\|null/g, 'letm')
  const PIECES = [
    ['reporters', /const REPORTERS = \[[\s\S]*?\n\s*\]/],
    ['citation pattern', /const CITATION = .*/],
    ['statute pattern', /const USC = .*/],
    ['address filter', /const AFTER_STREET[\s\S]*?return true\n\s*\}/],
    ['extractCitations', /function extractCitations[\s\S]*?return \[\.\.\.out\]\n\s*\}/],
  ]
  for (const [name, re] of PIECES) {
    const a = (app.match(re) || [''])[0]
    const b = (site.match(re) || [''])[0]
    ok('same as the app: ' + name, !!a && !!b && norm(a) === norm(b))
  }
} else {
  console.log('(no app repo given: compared behaviour only)')
}

console.log(failed ? '\n' + failed + ' check(s) failed' : '\nall extractor checks passed')
process.exit(failed ? 1 : 0)
