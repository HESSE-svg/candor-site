// Candor site: find the citations in pasted text, in the browser.
//
// Used by /check (the free citation check). The text a visitor pastes is read
// here, on their own machine, and never sent anywhere. Only the bare citation
// strings this finds are sent to app.candor.legal, which asks CourtListener
// (Free Law Project) whether each one exists.
//
// COPIED FROM the Candor app: HESSE-svg/candor, app/src/lib/moduleF.ts
// (REPORTERS through extractCitations), itself kept identical to
// app/server/verify/classify.mjs and extension/src/verify.js. Keep them in
// sync: when the app's extractor changes, copy the change here, then run
//   node tools/check-extractor-sync.mjs <path to the candor repo>
// which compares the two and re-runs the address checks.
(function (root) {
  // ---- copied from app/src/lib/moduleF.ts: start ----
  // Reporters. Periods are optional where the letters cannot be mistaken for
  // anything else ("347 US 483", "123 F3d 456", "5 So 3d 12"). A short reporter
  // that ordinary text also uses (A, P, F, So, Cal, and the regional NE/NW/SE/SW
  // and NY) needs either its periods or its series: "1450 NW 87" is a Miami
  // street address, not a citation, while "123 NW2d 456" and "123 N.W. 456" are
  // citations.
  const REPORTERS = [
    'U\\.?\\s?S\\.?', 'S\\.?\\s?Ct\\.?', 'L\\.?\\s?Ed\\.?(?:\\s?2d)?',
    'F\\.?\\s?Supp\\.?(?:\\s?(?:2d|3d))?',
    'F\\.(?:\\s?(?:2d|3d|4th))?', 'F\\s?(?:2d|3d|4th)',
    'So\\.(?:\\s?(?:2d|3d))?', 'So\\s?(?:2d|3d)',
    'A\\.(?:\\s?(?:2d|3d))?', 'A\\s?(?:2d|3d)', 'P\\.(?:\\s?(?:2d|3d))?', 'P\\s?(?:2d|3d)',
    'N\\.\\s?E\\.?(?:\\s?(?:2d|3d))?', 'N\\s?E\\s?(?:2d|3d)', 'N\\.\\s?W\\.?(?:\\s?(?:2d|3d))?', 'N\\s?W\\s?(?:2d|3d)',
    'S\\.\\s?E\\.?(?:\\s?(?:2d|3d))?', 'S\\s?E\\s?(?:2d|3d)', 'S\\.\\s?W\\.?(?:\\s?(?:2d|3d))?', 'S\\s?W\\s?(?:2d|3d)',
    'Cal\\.(?:\\s?(?:App\\.?)?\\s?(?:2d|3d|4th|5th))?', 'Cal\\s?(?:App\\.?\\s?)?(?:2d|3d|4th|5th)',
    'N\\.\\s?Y\\.?(?:\\s?(?:2d|3d))?', 'N\\s?Y\\s?(?:2d|3d)',
  ]
  const CITATION = new RegExp('\\b\\d{1,4}\\s+(?:' + REPORTERS.join('|') + ')\\s+\\d{1,4}\\b', 'g')
  const USC = /\b\d{1,2}\s+U\.?S\.?C\.?\s+§?\s?\d+[a-z]?\b/g
  // Text the pattern matches that is not a citation, most often an address:
  //   · anything followed by a street word or direction, in any case ("1450 N.W. 87
  //     AVE", "300 SW 1 St", "3900 U.S. 1 North"), or by a ZIP code
  //   · a citation written with no periods at all, unless it reads like one,
  //     i.e. is followed by a year ("347 US 483 (1954)") or a pin cite
  //     ("347 US 483, 495"). Without that, "3900 US 1" (US Highway 1) and
  //     "390 US 1" cannot be told apart, and an address must never be sent.
  // Only the text right after the match is read, and only to decide this.
  const AFTER_STREET = new RegExp('^\\s*,?\\s*' + '(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ct|Court|Ter|Terrace|Pl|Place|Dr|Drive|Way|Ln|Lane|Cir|Circle|Hwy|Highway|Pkwy|Parkway|Trl|Trail|Ste|Suite|Apt|Unit|Fl|Floor|N|S|E|W|North|South|East|West|NE|NW|SE|SW)\\b', 'i')
  // A state and ZIP, or a ZIP, soon after: "3900 U.S. 1, Tequesta, FL 33469".
  const ADDRESS_TAIL = /^[^()]{0,60}?\b(?:[A-Z]{2}\s+)?\d{5}(?:-\d{4})?\b/
  const AFTER_CITE_SHAPE = /^\s*(?:\([^()]{0,40}?\b\d{4}\s*\)|,\s*\d{1,4}(?!\w))/
  function looksLikeCitation(text, m) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 60)
    if (AFTER_STREET.test(after)) return false
    if (ADDRESS_TAIL.test(after)) return false
    // Two reporters whose shapes Florida addresses share: a first-series regional
    // reporter ("1450 N.W. 87, Miami") needs a year or pin cite after it, and
    // U.S. Reports has no volume above 700 ("3900 U.S. 1" is US Highway 1).
    // U.S. Reports is near volume 605 in 2026: raise 700 before it gets close.
    if (/^\d+\s+[NS]\.\s?[EW]\.?\s+\d+$/.test(m[0]) && !AFTER_CITE_SHAPE.test(after)) return false
    if (/^\d+\s+U\.?\s?S\.?\s/.test(m[0]) && parseInt(m[0], 10) > 700) return false
    if (!/\./.test(m[0]) && !AFTER_CITE_SHAPE.test(after)) return false
    return true
  }

  function extractCitations(text) {
    const out = new Set()
    let m
    CITATION.lastIndex = 0
    while ((m = CITATION.exec(text))) if (looksLikeCitation(text, m)) out.add(m[0].replace(/\s+/g, ' ').trim())
    USC.lastIndex = 0
    while ((m = USC.exec(text))) out.add(m[0].replace(/\s+/g, ' ').trim())
    return [...out]
  }
  // ---- copied from app/src/lib/moduleF.ts: end ----

  // Site only: statutes are listed on the page but not sent (the free check
  // looks up case law only).
  const USC_ONLY = /^\d{1,2}\s+U\.?S\.?C\.?\s+§?\s?\d+[a-z]?$/i
  function isStatute(c) { return USC_ONLY.test(c) }

  root.CandorCite = { extractCitations: extractCitations, isStatute: isStatute }
})(typeof window !== 'undefined' ? window : globalThis)
