// Candor site: nav, gentle reveal-on-scroll, the live redaction demo, and
// funnel counts.
(function () {
  // ---- funnel counts + (optional) Google Ads conversions ----
  //
  // Candor's own counter: four steps are counted, a visit (once per browser
  // session), opening /start, clicking through to checkout, and reaching
  // /welcome after checkout. Only the step's name is sent; this counter sets
  // no cookie and sends no visitor id, and the app keeps only per-day totals
  // (app/server/siteEventApi.mjs).
  //
  // Google Ads stays OFF until ADS.id is filled in. When on, it loads Google's
  // tag (which does set cookies) and reports the two conversions below, except
  // for visitors whose browser sends Global Privacy Control or Do Not Track.
  // Before switching it on: keep "enhanced conversions" off in Google Ads (it
  // can read the email field on /start), and make sure Stripe's redirect to
  // /welcome carries no query string.

  var ADS = {
    id: '',                // e.g. 'AW-123456789'
    labels: {              // conversion labels from Google Ads, per step
      checkout_click: '',  // "Begin checkout"
      welcome_view: '',    // "Sign-up" (trial started)
    },
  }
  var ENDPOINT = 'https://app.candor.legal/api/site/event'
  var optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1'
  var adsOn = !!ADS.id && !optedOut

  function beacon(step) {
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, new Blob([step], { type: 'text/plain' }))
      else fetch(ENDPOINT, { method: 'POST', body: step, keepalive: true, mode: 'no-cors' })
    } catch (e) { /* counting must never break the page */ }
  }

  if (adsOn) {
    var tag = document.createElement('script')
    tag.async = true
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ADS.id)
    document.head.appendChild(tag)
    window.dataLayer = window.dataLayer || []
    window.gtag = function () { window.dataLayer.push(arguments) }
    window.gtag('js', new Date())
    window.gtag('config', ADS.id)
  }

  // candorTrack(step, { value, done }): count a step. `done` runs once the
  // Google conversion is sent (or after 800ms), so a page can navigate away
  // without losing it; with Ads off it runs straight away.
  window.candorTrack = function (step, opts) {
    opts = opts || {}
    beacon(step)
    var done = typeof opts.done === 'function' ? opts.done : null
    var label = ADS.labels[step]
    if (adsOn && label && window.gtag) {
      var fired = false
      var finish = function () { if (!fired) { fired = true; if (done) done() } }
      var params = { send_to: ADS.id + '/' + label, event_callback: finish }
      if (typeof opts.value === 'number') { params.value = opts.value; params.currency = 'USD' }
      window.gtag('event', 'conversion', params)
      setTimeout(finish, 800)
    } else if (done) done()
  }

  try {
    if (!sessionStorage.getItem('candor-visit')) { sessionStorage.setItem('candor-visit', '1'); beacon('visit') }
  } catch (e) { beacon('visit') }
  var page = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '')
  if (page === '/start') window.candorTrack('start_view')
  if (page === '/welcome') window.candorTrack('welcome_view')

  var here = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/'
  document.documentElement.classList.add('js')
  var navEl = document.querySelector('.navlinks')

  // ---- top menu: groups that open (Product, Resources, Company) ----
  // The markup comes from tools/site-chrome.mjs. Hover opens a group on a
  // mouse; a click or Enter opens it for touch and keyboard.
  var MENU = []
  if (navEl) {
    [].forEach.call(navEl.children, function (el) {
      if (el.classList.contains('nd')) {
        var b = el.querySelector('.nd-b')
        MENU.push([b.textContent.trim(), [].map.call(el.querySelectorAll('.nd-p a'), function (a) {
          return [a.getAttribute('href'), (a.querySelector('b') || a).textContent.trim()]
        })])
      } else if (el.tagName === 'A' && !el.classList.contains('m-cta')) MENU.push([el.getAttribute('href'), el.textContent.trim()])
    })
    navEl.querySelectorAll('a').forEach(function (a) {
      if (a.getAttribute('href') === here) {
        a.setAttribute('aria-current', 'page')
        var g = a.closest('.nd'); if (g) g.classList.add('cur')
      }
    })
    var groups = [].slice.call(navEl.querySelectorAll('.nd'))
    var shut = function (except) {
      groups.forEach(function (g) { if (g !== except) { g.classList.remove('open'); g.querySelector('.nd-b').setAttribute('aria-expanded', 'false') } })
    }
    groups.forEach(function (g) {
      var b = g.querySelector('.nd-b')
      var t = null
      b.addEventListener('click', function () {
        var open = !g.classList.contains('open')
        shut(g)
        g.classList.toggle('open', open)
        b.setAttribute('aria-expanded', open ? 'true' : 'false')
      })
      g.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse') return; clearTimeout(t); shut(g); g.classList.add('open'); b.setAttribute('aria-expanded', 'true') })
      g.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'mouse') return; t = setTimeout(function () { g.classList.remove('open'); b.setAttribute('aria-expanded', 'false') }, 140) })
      g.addEventListener('focusout', function (e) { if (!g.contains(e.relatedTarget)) { g.classList.remove('open'); b.setAttribute('aria-expanded', 'false') } })
      g.addEventListener('keydown', function (e) { if (e.key === 'Escape' && g.classList.contains('open')) { shut(); b.focus() } })
    })
    document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('.nd')) shut() })
  }

  // ---- announcement bar: the latest release, dismissible ----
  // One line across the top of every page except the homepage, which has its
  // own "New" pill. Dismissing it hides this message only; a new one shows.
  var NEWS = { id: '2026-10-01', text: 'New: the browser panel now works in Eve, Harvey, CoCounsel and Lexis+ AI', href: '/changelog#2026-10-01' }
  var header = document.querySelector('header.nav')
  var dismissed = false
  try { dismissed = localStorage.getItem('candor-bar') === NEWS.id } catch (e) { /* storage blocked */ }
  if (header && here !== '/' && !dismissed) {
    var bar = document.createElement('div')
    bar.className = 'ab'
    bar.setAttribute('role', 'region')
    bar.setAttribute('aria-label', 'Announcement')
    bar.innerHTML = '<a href="' + NEWS.href + '">' + NEWS.text.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] }) + ' <span aria-hidden="true">&rarr;</span></a>' +
      '<button type="button" aria-label="Dismiss announcement"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>'
    header.parentNode.insertBefore(bar, header)
    bar.querySelector('button').addEventListener('click', function () {
      bar.remove()
      try { localStorage.setItem('candor-bar', NEWS.id) } catch (e) { /* storage blocked */ }
    })
  }

  // ---- phones: Start free and Contact stay within reach ----
  // Shows after the first screen, hides over the footer, and is left off
  // the pages that are already the form.
  if (!/^\/(start|contact|welcome)$/.test(here)) {
    var dock = document.createElement('nav')
    dock.setAttribute('aria-label', 'Get started')
    dock.className = 'dock'
    dock.innerHTML = '<a class="dock-go" href="/start">Start free</a><a class="dock-alt" href="/contact">Contact</a>'
    document.body.appendChild(dock)
    var foot = document.querySelector('footer')
    var onScroll = function () {
      var y = window.scrollY || 0
      var footTop = foot ? foot.getBoundingClientRect().top : Infinity
      dock.classList.toggle('on', y > window.innerHeight * 0.75 && footTop > window.innerHeight - 20)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    onScroll()
  }

  // ---- phone menu: full screen, sections open in place ----
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  var cur = function (href) { return href === here ? ' aria-current="page"' : '' }
  var CHEV = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  var XICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  var toggle = document.querySelector('.navtoggle')
  if (toggle) {
    var sm = document.createElement('div')
    sm.className = 'sm'
    sm.id = 'site-menu'
    sm.setAttribute('role', 'dialog')
    sm.setAttribute('aria-modal', 'true')
    sm.setAttribute('aria-label', 'Menu')
    sm.hidden = true
    var rows = MENU.map(function (it, n) {
      if (typeof it[1] === 'string') return '<div class="sm-row"><a href="' + it[0] + '"' + cur(it[0]) + '>' + esc(it[1]) + '</a></div>'
      var open = it[1].some(function (l) { return l[0] === here })
      return '<div class="sm-row"><button type="button" aria-expanded="' + open + '" aria-controls="sm-sub-' + n + '">' + esc(it[0]) + CHEV + '</button>' +
        '<div class="sm-sub" id="sm-sub-' + n + '"><div><ul>' + it[1].map(function (l) { return '<li><a href="' + l[0] + '"' + cur(l[0]) + '>' + esc(l[1]) + '</a></li>' }).join('') + '</ul></div></div></div>'
    }).join('')
    sm.innerHTML = '<div class="sm-top"><a class="brand" href="/" aria-label="Candor home"><img src="/assets/icon.svg" alt="" width="26" height="26"><b>Candor<span>.</span></b></a>' +
      '<button type="button" class="sm-x" aria-label="Close menu">' + XICON + '</button></div>' +
      '<nav class="sm-list" aria-label="Site">' + rows + '</nav>' +
      '<div class="sm-bot"><a class="sm-cta" href="/start">Start free for a month</a>' +
      '<div class="sm-links"><a href="/contact">Contact</a><span aria-hidden="true">&middot;</span><a href="/demo">Get a look</a><span aria-hidden="true">&middot;</span><a href="/privacy">Privacy</a></div></div>'
    document.body.appendChild(sm)
    // Collapsed sections stay out of the tab order.
    var syncSub = function (b) {
      var sub = document.getElementById(b.getAttribute('aria-controls'))
      if (sub) sub.querySelectorAll('a').forEach(function (a) { a.tabIndex = b.getAttribute('aria-expanded') === 'true' ? 0 : -1 })
    }
    sm.querySelectorAll('.sm-row>button').forEach(function (b) {
      syncSub(b)
      b.addEventListener('click', function () {
        b.setAttribute('aria-expanded', b.getAttribute('aria-expanded') === 'true' ? 'false' : 'true')
        syncSub(b)
      })
    })
    var openMenu = function () {
      sm.hidden = false
      void sm.offsetWidth // start the fade from the closed state
      sm.classList.add('open')
      document.documentElement.classList.add('sm-lock')
      toggle.setAttribute('aria-expanded', 'true')
      sm.querySelector('.sm-x').focus()
    }
    var closeMenu = function (back) {
      if (!sm.classList.contains('open')) return
      sm.classList.remove('open')
      document.documentElement.classList.remove('sm-lock')
      toggle.setAttribute('aria-expanded', 'false')
      setTimeout(function () { if (!sm.classList.contains('open')) sm.hidden = true }, 230)
      if (back !== false) toggle.focus()
    }
    toggle.setAttribute('aria-controls', 'site-menu')
    toggle.setAttribute('aria-expanded', 'false')
    toggle.addEventListener('click', openMenu)
    sm.querySelector('.sm-x').addEventListener('click', function () { closeMenu() })
    sm.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(false) })
    sm.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeMenu(); return }
      if (e.key !== 'Tab') return
      // Keep focus inside the menu while it is open.
      var f = [].filter.call(sm.querySelectorAll('a,button'), function (el) { return el.tabIndex >= 0 && el.offsetParent !== null })
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
    })
    // Widening past the phone layout closes it.
    if (window.matchMedia) matchMedia('(min-width:861px)').addEventListener('change', function (q) { if (q.matches) closeMenu(false) })
  }

  // ---- Contact form: a dialog from any /contact link, inline on /contact ----
  //
  // Sent to app.candor.legal, which emails it to Candor (reply-to the sender)
  // and stores nothing (app/server/siteContactApi.mjs). Client identifiers are
  // refused there; the note under the form asks people to leave them out.
  var CONTACT_URL = 'https://app.candor.legal/api/site/contact'
  var TOPICS = [
    ['walkthrough', 'A walkthrough of Candor'],
    ['trial', 'Starting a free trial'],
    ['pricing', 'Pricing and plans'],
    ['security', 'Security or a vendor review'],
    ['carrier', 'Carriers, brokers and partnerships'],
    ['other', 'Something else'],
  ]
  var SIZES = [['', 'Choose one'], ['1', 'Just me'], ['2-5', '2 to 5'], ['6-20', '6 to 20'], ['21-50', '21 to 50'], ['51+', 'More than 50']]
  var EMAILISH = /^[^\s@]{1,64}@[^\s@]+\.[a-z]{2,24}$/i
  var formN = 0
  function contactForm(inDialog) {
    var n = ++formN
    var id = function (s) { return 'cf' + n + '-' + s }
    var wrap = document.createElement('div')
    wrap.className = 'cf'
    var opts = function (list, sel) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sel ? ' selected' : '') + '>' + esc(o[1]) + '</option>' }).join('') }
    var close = inDialog ? '<button type="button" class="cf-close" aria-label="Close">' + XICON + '</button>' : ''
    function step1(v) {
      // On /contact the page itself carries the heading and introduction.
      wrap.innerHTML = close + (inDialog
        ? '<h2 id="' + id('h') + '">Talk to Candor</h2>' +
          '<p class="cf-intro">Questions about the product, a walkthrough on your own matters, pricing, or a security review.</p>'
        : '') +
        '<form novalidate>' +
        '<div class="cf-field"><label for="' + id('email') + '">Work email<i aria-hidden="true">*</i></label>' +
        '<input id="' + id('email') + '" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@yourfirm.com" required aria-describedby="' + id('email-e') + '" value="' + esc(v.email || '') + '">' +
        '<span class="cf-err" id="' + id('email-e') + '" role="alert"></span></div>' +
        '<div class="cf-field"><label for="' + id('topic') + '">What can we help you with?<i aria-hidden="true">*</i></label>' +
        '<select id="' + id('topic') + '" name="topic">' + opts(TOPICS, v.topic || 'walkthrough') + '</select></div>' +
        '<button class="cf-go" type="submit">Continue <span aria-hidden="true">&rarr;</span></button>' +
        '</form>'
      var f = wrap.querySelector('form')
      f.addEventListener('submit', function (e) {
        e.preventDefault()
        var email = f.email.value.trim()
        var err = wrap.querySelector('#' + id('email-e'))
        if (!EMAILISH.test(email)) {
          err.textContent = 'Please enter a valid work email address'
          f.email.setAttribute('aria-invalid', 'true')
          f.email.focus()
          return
        }
        step2({ email: email, topic: f.topic.value })
      })
      f.email.addEventListener('input', function () { f.email.removeAttribute('aria-invalid'); wrap.querySelector('#' + id('email-e')).textContent = '' })
    }
    function step2(v) {
      wrap.innerHTML = close +
        '<h2 id="' + id('h') + '">A little about you</h2>' +
        '<p class="cf-intro">The reply goes to <strong>' + esc(v.email) + '</strong>.</p>' +
        '<form novalidate>' +
        '<div class="cf-two"><div class="cf-field"><label for="' + id('name') + '">Your name<i aria-hidden="true">*</i></label>' +
        '<input id="' + id('name') + '" name="name" type="text" autocomplete="name" maxlength="100" required value="' + esc(v.name || '') + '"></div>' +
        '<div class="cf-field"><label for="' + id('firm') + '">Firm<small>optional</small></label>' +
        '<input id="' + id('firm') + '" name="firm" type="text" autocomplete="organization" maxlength="150" value="' + esc(v.firm || '') + '"></div></div>' +
        '<div class="cf-field"><label for="' + id('size') + '">Attorneys at the firm<small>optional</small></label>' +
        '<select id="' + id('size') + '" name="size">' + opts(SIZES, v.size || '') + '</select></div>' +
        '<div class="cf-field"><label for="' + id('msg') + '">Message<i aria-hidden="true">*</i></label>' +
        '<textarea id="' + id('msg') + '" name="message" maxlength="2000" required placeholder="How your firm uses AI today, and what you would like to see."></textarea></div>' +
        '<div class="cf-hp" aria-hidden="true"><label>Leave this empty<input name="hp" tabindex="-1" autocomplete="off"></label></div>' +
        '<span class="cf-err" id="' + id('send-e') + '" role="alert"></span>' +
        '<button class="cf-go" type="submit">Send message <span aria-hidden="true">&rarr;</span></button>' +
        '<button class="cf-back" type="button">&larr; Back</button>' +
        '<p class="cf-fine">Please leave out anything about a client: no names, numbers or case details. Your message is delivered by email and not stored in Candor. <a href="/privacy">Privacy</a></p>' +
        '</form>'
      var f = wrap.querySelector('form')
      var err = wrap.querySelector('#' + id('send-e'))
      if (v.message) f.message.value = v.message
      wrap.querySelector('.cf-back').addEventListener('click', function () { step1(v) })
      f.addEventListener('submit', function (e) {
        e.preventDefault()
        var body = { email: v.email, topic: v.topic, name: f.name.value.trim(), firm: f.firm.value.trim(), size: f.size.value, message: f.message.value.trim(), hp: f.hp.value }
        f.name.removeAttribute('aria-invalid'); f.message.removeAttribute('aria-invalid')
        if (!body.name) { err.textContent = 'Please add your name.'; f.name.setAttribute('aria-invalid', 'true'); f.name.focus(); return }
        if (!body.message) { err.textContent = 'Please write a short message.'; f.message.setAttribute('aria-invalid', 'true'); f.message.focus(); return }
        err.textContent = ''
        var go = f.querySelector('.cf-go')
        go.disabled = true
        go.firstChild.textContent = 'Sending… '
        var fail = function (msg) {
          go.disabled = false
          go.firstChild.textContent = 'Send message '
          err.innerHTML = esc(msg || 'Your message could not be sent just now.') + (/jesse@candor\.legal/.test(msg || '') ? '' : ' You can also write to <a href="mailto:jesse@candor.legal">jesse@candor.legal</a>.')
        }
        // text/plain keeps this a simple request (no preflight).
        fetch(CONTACT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })
          .then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { return { ok: r.ok && j.ok, j: j } }) })
          .then(function (res) {
            if (!res.ok) return fail(res.j && res.j.error)
            done(v.email)
          }, function () { fail('Your message could not be sent just now.') })
        v.name = body.name; v.firm = body.firm; v.size = body.size; v.message = body.message
      })
      f.name.focus()
    }
    function done(email) {
      wrap.innerHTML = close +
        '<div class="cf-done"><div class="cf-tick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
        '<h2 id="' + id('h') + '" tabindex="-1">Message sent</h2>' +
        '<p class="cf-intro">Thanks. The answer will go to <strong>' + esc(email) + '</strong>. In the meantime, you can see the product in 90 seconds.</p>' +
        '<a class="cf-go" href="/#watch" style="text-decoration:none">Watch the walkthrough</a></div>'
      var h = wrap.querySelector('h2'); if (h) h.focus()
    }
    step1({})
    return { el: wrap, labelId: id('h') }
  }

  var host = document.getElementById('contact-form')
  if (host) host.appendChild(contactForm(false).el)

  var dlg = null
  function openContact() {
    if (!window.HTMLDialogElement) { location.href = '/contact'; return }
    if (dlg) dlg.remove()
    dlg = document.createElement('dialog')
    dlg.className = 'cf-dlg'
    var form = contactForm(true)
    dlg.setAttribute('aria-labelledby', form.labelId)
    dlg.appendChild(form.el)
    document.body.appendChild(dlg)
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.closest('.cf-close')) dlg.close()
    })
    dlg.addEventListener('close', function () { document.documentElement.classList.remove('sm-lock') })
    document.documentElement.classList.add('sm-lock')
    dlg.showModal()
    var first = dlg.querySelector('input'); if (first) first.focus()
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    var a = e.target.closest ? e.target.closest('a[href="/contact"],[data-contact]') : null
    if (!a || host) return
    e.preventDefault()
    openContact()
  })

  // Moving content can be paused (WCAG 2.2.2): a button on each scrolling strip.
  document.querySelectorAll('.works-track').forEach(function (track) {
    var b = document.createElement('button')
    b.type = 'button'
    b.className = 'works-pause'
    b.setAttribute('aria-pressed', 'false')
    b.textContent = 'Pause'
    b.addEventListener('click', function () {
      var paused = track.classList.toggle('paused')
      b.setAttribute('aria-pressed', paused ? 'true' : 'false')
      b.textContent = paused ? 'Play' : 'Pause'
    })
    track.parentNode.insertBefore(b, track.nextSibling)
  })

  // reveal on scroll (skipped for reduced-motion via CSS)
  var els = document.querySelectorAll('.reveal')
  if ('IntersectionObserver' in window && els.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
    }, { threshold: 0.12 })
    els.forEach(function (el) { io.observe(el) })
  } else {
    els.forEach(function (el) { el.classList.add('in') })
  }

  // copy-to-clipboard for any [data-copy] control (works even with no mail app)
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-copy]') : null
    if (!b) return
    e.preventDefault()
    var val = b.getAttribute('data-copy')
    var done = function () { var t = b.getAttribute('data-label') || b.textContent; b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = t }, 1600) }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(val).then(done, done)
    else done()
  })

  // ---- live confidentiality demo (only if present) ----
  var demoIn = document.getElementById('demo-in')
  if (!demoIn) return
  var demoOut = document.getElementById('demo-out')
  var demoChips = document.getElementById('demo-chips')

  var MED = ['diagnos\\w*','prescri\\w*','medication','treatment','injur\\w*','patient','medical','therapy','symptom\\w*','concussion','hospital','physician']
  var DET = [
    ['EMAIL', /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi],
    ['SSN', /\b\d{3}-\d{2}-\d{4}\b/g],
    ['ACCOUNT#', /\b(?:\d[ \-]?){13,16}\b/g],
    ['POLICY#', /\b(?:policy|claim|case|matter|acct|file|member|MRN)\s*(?:no\.?|number|#)?\s*[:#]?\s*[A-Z0-9][A-Z0-9\-]{4,}/gi],
    ['AMOUNT', /\$\s?\d[\d,]*(?:\.\d{1,2})?/g],
    ['DATE', /\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b/g],
    ['PHONE', /(?:\+?1[ \-.]?)?\(?\d{3}\)?[ \-.]?\d{3}[ \-.]?\d{4}\b/g],
    ['ID', /\b\d{7,}\b/g],
    ['ZIP', /\b\d{5}(?:-\d{4})?\b/g],
    ['MEDICAL', new RegExp('\\b(?:' + MED.join('|') + ')\\b', 'gi')]
  ]
  var ORDER = ['NAME','SSN','ACCOUNT#','POLICY#','DOB','DATE','EMAIL','PHONE','AMOUNT','ID','ZIP','MEDICAL']
  var STRONG = /\b(?:Mr|Mrs|Ms|Miss|Dr|Atty|Attorney|Hon|Judge|Officer|Det|Sgt)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g
  var TWO = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g
  var CAP = /\b[A-Z][a-z]+\b/g
  var ROLES = 'defendant|plaintiff|client|witness|victim|petitioner|respondent|claimant|insured'
  var RB = new RegExp('\\b([A-Z][a-z]+)\\s+the\\s+(?:' + ROLES + ')\\b', 'gi')
  var RA = new RegExp('\\b(?:' + ROLES + ')\\s+([A-Z][a-z]+)\\b', 'gi')
  var COMMON = {}; ('the this that there dear hi hello thanks thank please our your their court company insurance policy claim law firm office attorney client matter case united states general the').split(' ').forEach(function (w) { COMMON[w] = 1 })
  var FIRST = {}; ('jessica sarah emily michael john james david robert maria juan carlos jose ana daniel jennifer laura mark thomas anna jordan rivera').split(' ').forEach(function (w) { FIRST[w] = 1 })

  function esc(s){return s.replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  function run(){
    var text = demoIn.value
    var spans = []
    function push(s,e,t){ if(e>s) spans.push([s,e,t]) }
    var m
    DET.forEach(function(d){ var re=d[1]; re.lastIndex=0; while((m=re.exec(text))){ if(!m[0].length){re.lastIndex++;continue} push(m.index,m.index+m[0].length,d[0]) } })
    STRONG.lastIndex=0; while((m=STRONG.exec(text))) push(m.index,m.index+m[0].length,'NAME')
    TWO.lastIndex=0; while((m=TWO.exec(text))){ var p=m[0].split(/\s+/); if(COMMON[p[0].toLowerCase()]||COMMON[p[1].toLowerCase()])continue; push(m.index,m.index+m[0].length,'NAME') }
    CAP.lastIndex=0; while((m=CAP.exec(text))){ if(FIRST[m[0].toLowerCase()]) push(m.index,m.index+m[0].length,'NAME') }
    var cap=function(w){return w&&w[0]>='A'&&w[0]<='Z'}
    RB.lastIndex=0; while((m=RB.exec(text))){ if(cap(m[1])&&!COMMON[m[1].toLowerCase()]) push(m.index,m.index+m[1].length,'NAME') }
    RA.lastIndex=0; while((m=RA.exec(text))){ var w=m[1]; if(!cap(w)||COMMON[w.toLowerCase()])continue; var gi=m.index+m[0].lastIndexOf(w); push(gi,gi+w.length,'NAME') }
    spans.sort(function(a,b){return a[0]-b[0]||(b[1]-b[0])-(a[1]-a[0])})
    var chosen=[],last=-1; spans.forEach(function(s){ if(s[0]>=last){chosen.push(s);last=s[1]} })
    var html='',i=0,counts={}
    chosen.forEach(function(s){ html+=esc(text.slice(i,s[0]))+'<span class="r">['+s[2]+']</span>'; counts[s[2]]=(counts[s[2]]||0)+1; i=s[1] })
    html+=esc(text.slice(i))
    demoOut.innerHTML = text.trim() ? html : '<span style="color:var(--muted)">Redacted preview appears here.</span>'
    demoChips.innerHTML=''
    var total=0
    ORDER.filter(function(t){return counts[t]}).forEach(function(t){ total+=counts[t]; var s=document.createElement('span'); s.className='chip'; s.textContent=t+' '+counts[t]; demoChips.appendChild(s) })
    if(text.trim() && !total){ var s=document.createElement('span'); s.className='chip'; s.style.color='var(--seal)'; s.textContent='✓ nothing flagged'; demoChips.appendChild(s) }
  }
  demoIn.addEventListener('input', run)
  run()
})()

// ---- animated browser-extension demo (product page, illustration only) ----
;(function () {
  var stage = document.getElementById('exd')
  if (!stage) return
  var runId = 0, visible = false, playing = false
  function play() {
    playing = true
    var id = ++runId
    stage.className = 'exd'
    var add = function (t, c) { setTimeout(function () { if (id === runId) stage.classList.add(c) }, t) }
    add(700, 'open'); add(1700, 'checking'); add(3100, 'r1'); add(3900, 'r2'); add(4300, 'alert')
    setTimeout(function () {
      if (id !== runId) return
      stage.className = 'exd'; playing = false
      if (visible) setTimeout(function () { if (visible && !playing) play() }, 900)
    }, 8200)
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting
      if (visible && !playing) play()
    }, { threshold: 0.15 })
    io.observe(stage)
  } else { visible = true; play() }
  // Safety net: if the observer never fires for any reason, start anyway.
  setTimeout(function () { if (!playing && runId === 0) { visible = true; play() } }, 1600)
})()

// ---- expandable product steps (click to reveal a mock + more detail) ----
;(function () {
  var steps = document.querySelectorAll('.steps .step')
  if (!steps.length) return
  function toggle(step) {
    var d = step.querySelector('.step-detail'); if (!d) return
    var open = step.getAttribute('aria-expanded') === 'true'
    step.setAttribute('aria-expanded', open ? 'false' : 'true')
    d.hidden = open
  }
  steps.forEach(function (step) {
    step.addEventListener('click', function () { toggle(step) })
    step.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(step) }
    })
  })
})()
