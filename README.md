# candor-site

The marketing site for **Candor** — AI governance and audit trails for law
firms — served at [candor.legal](https://candor.legal).

Static HTML, CSS, and a little vanilla JavaScript. No build step, no framework.

## Structure

```
index.html          Home
product.html        How Candor works
plan.html           Our plan — the roadmap across industries
pricing.html        Pricing
why-now.html        The case for acting now
security.html       Security posture
resources.html      Free tools
pattern-capture.html  The Pattern Capture add-on
news.html           Auto-updated legal-AI news
start.html          Sign-up / free-trial checkout
about.html · demo.html · ai-rules.html · ai-sanctions.html · 404.html
assets/
  styles.css        The shared design system (bump ?v=N when it changes)
  site.js           Nav toggle + small interactions
  wordmark.svg      The horizontal lockup
tools/fetch-news.mjs  Builds news.html from feeds
vercel.json         cleanUrls: true (so /product serves product.html)
```

## Design system

Flat and institutional — navy `#1B2A41`, paper `#FAF8F5`, oxblood `#7A2E2E` for
CTAs, with seal-green `#2F5D50` as a second accent for roadmap/status cues. Serif
headlines (Instrument Serif), Inter for body. No gradients or drop shadows in the
core style; the one exception is the deep-navy "vision-mode" band on the plan and
home pages. Tokens and shared components live in `assets/styles.css` — when you
change it, bump the `?v=N` query on every page's stylesheet link so returning
visitors don't get a cached copy.

## Develop

Open any `.html` file in a browser — there's nothing to build. Paths are
root-relative (`/assets/...`), so serve the folder if you want links to resolve
locally, e.g. `npx serve .`.

## Deploy

Push to `main`. Vercel builds and deploys automatically.
