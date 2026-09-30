---
name: site-change
description: How to make and ship any change to candor.legal (this repo, static HTML on Vercel). Use for any page, style, script or copy change on the website, before committing, opening a PR, or telling Jesse it is live.
---

# Changing candor.legal

Static HTML, one shared stylesheet and script, deployed by Vercel from
`main`. Copy follows the `candor-copy` skill.

## Structure to keep
- **Nav** is identical on every page (and in `tools/fetch-news.mjs`, which
  rebuilds news.html daily): Product, Our plan, Why now, Free tools, Guides,
  News, Pricing, Security, Start free. The current section's link carries
  `aria-current="page"`: /vs/*, /ai-governance-software, /pattern-capture,
  /review-demo → Product; /international → Our plan; /ai-sanctions,
  /sanctions/*, /ai-rules, /rules* → Free tools; /guides/* → Guides.
- **Page head**: `<section class="wrap pagehead"><div class="mono eyebrow">`
  names the nav section first (e.g. "Guides · ABA guidance"), then the `h1`.
- **Homepage order** (decided 2026-09-29, keep it short): hero (rotating
  quote + one illustration) → the problem ("Anything you paste can and will
  be used against you" card) → one loop (Screen · Work · Prove) → works-with
  strip → 90-second video → Learn more cards → close. Detail belongs on
  its own page behind a Learn more link, not on the homepage.
- Animations: pausable if they loop longer than 5 seconds, and still under
  `prefers-reduced-motion`. Fictional details are labeled as invented.

## Cache-busting
When `assets/styles.css` or `assets/site.js` changes, bump its `?v=` number
on **every** HTML page and in `tools/fetch-news.mjs`. Check with:
`grep -rho 'styles.css?v=[0-9]*\|site.js?v=[0-9]*' --include=*.html --include=*.mjs . | sort | uniq -c`
(one version of each, on all pages).

## Check before committing
1. Serve it: `npx serve -l 5055 .`
2. Accessibility and sideways scroll, every page, desktop and phone:
   `node tools/a11y-check.cjs` (see the file's header for installing
   axe-core in a cloud session). It must report no problems.
3. Screenshots of what changed, at 1280px and 390px, with Playwright
   (`executablePath: '/opt/pw-browsers/chromium'`, never `playwright
   install`). Look at them. Send them to Jesse for anything visual.

## Ship
- Commit on the session's branch; if its PR was already merged, merge
  `origin/main` into the branch first (never force-push). One PR per batch.
- After Jesse merges, check the Vercel production deployment for the merge
  commit (GitHub deployments or commit status). Vercel has skipped a
  production build before (2026-09-29). If none appears, give Jesse the fix:
  Vercel → candor-site → Deployments → newest → ⋯ → **Promote to
  Production** (or Redeploy), then a private-tab refresh on his phone.
- candor.legal itself is blocked from the cloud sandbox; verify through
  Vercel's status on GitHub, not by fetching the site.
