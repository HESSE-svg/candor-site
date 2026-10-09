// Candor site: the free citation check at /check.
//
// The pasted text is read here, in the browser, by assets/cite-extract.js and
// is never sent anywhere. The only thing that leaves is the list of case
// citations found in it, as bare strings ("347 U.S. 483"), sent to
// app.candor.legal (app/server/publicCitationApi.mjs), which asks
// CourtListener about each one. The page then sorts what came back into
// "didn't find", "found" and "not looked up". It never says a citation is
// good: a found citation still has to be read.
(function () {
  var root = document.getElementById('cc')
  if (!root || !window.CandorCite) return

  var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  var ENDPOINT = (local ? 'http://localhost:5173' : 'https://app.candor.legal') + '/api/public/citation-check'
  var BATCH = 25

  var $ = function (id) { return document.getElementById(id) }
  var text = $('cc-text'), go = $('cc-go'), clear = $('cc-clear'), next = $('cc-next')
  var preview = $('cc-preview'), status = $('cc-status'), out = $('cc-results'), after = $('cc-after')

  var cases = [], statutes = [], sent = 0, busy = false
  var shown = { results: [], statutes: [] } // everything checked from the current text

  function el(tag, cls, txt) {
    var e = document.createElement(tag)
    if (cls) e.className = cls
    if (txt != null) e.textContent = txt
    return e
  }
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many) }

  // What would be sent, shown before anything is sent.
  function scan() {
    var found = window.CandorCite.extractCitations(text.value || '')
    cases = found.filter(function (c) { return !window.CandorCite.isStatute(c) })
    statutes = found.filter(function (c) { return window.CandorCite.isStatute(c) })
    sent = 0
    next.hidden = true
    preview.textContent = ''
    if (!text.value.trim()) {
      preview.appendChild(el('p', 'cc-hint', 'Citations appear here as Candor finds them. Nothing is sent until you press Check.'))
    } else if (!found.length) {
      preview.appendChild(el('p', 'cc-hint', 'No case citations found yet. The check picks up reporter citations such as 347 U.S. 483 or 123 So. 3d 456.'))
    } else {
      var head = el('p', 'cc-hint')
      head.textContent = cases.length
        ? 'Only ' + (cases.length === 1 ? 'this citation' : 'these ' + cases.length + ' citations') + ' would be sent' + (cases.length > BATCH ? ', ' + BATCH + ' at a time' : '') + ':'
        : 'Only statutes found. They are listed here but not looked up.'
      preview.appendChild(head)
      var ul = el('ul', 'cc-chips')
      cases.forEach(function (c) { ul.appendChild(el('li', 'cc-chip', c)) })
      statutes.forEach(function (c) { ul.appendChild(el('li', 'cc-chip cc-chip-off', c + ' (not looked up)')) })
      preview.appendChild(ul)
    }
    go.disabled = !cases.length || busy
  }

  function say(msg, kind) {
    status.textContent = msg || ''
    status.className = 'cc-status' + (kind ? ' cc-' + kind : '')
  }

  function group(title, cls, items, render) {
    if (!items.length) return
    var sec = el('section', 'cc-group ' + cls)
    sec.appendChild(el('h3', null, title))
    var ul = el('ul', 'cc-list')
    items.forEach(function (r) { ul.appendChild(render(r)) })
    sec.appendChild(ul)
    out.appendChild(sec)
  }

  function row(citation, note, link) {
    var li = el('li', 'cc-row')
    li.appendChild(el('span', 'cc-cite', citation))
    var p = el('span', 'cc-note')
    p.appendChild(document.createTextNode(note))
    if (link) {
      p.appendChild(document.createTextNode(' '))
      var a = el('a', null, 'Open it on CourtListener')
      a.href = link
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      p.appendChild(a)
    }
    li.appendChild(p)
    return li
  }

  // CourtListener links come back as https://www.courtlistener.com/...; use
  // nothing else as a link.
  var safeLink = function (u) { return typeof u === 'string' && /^https:\/\/www\.courtlistener\.com\/[A-Za-z0-9/_-]*$/.test(u) ? u : '' }

  function show(results, batchStatutes) {
    out.textContent = ''
    var missing = results.filter(function (r) { return r.status === 'not_found' })
    var found = results.filter(function (r) { return r.status === 'found' })
    var unchecked = results.filter(function (r) { return r.status !== 'found' && r.status !== 'not_found' })

    var sum = el('p', 'cc-sum')
    sum.textContent = 'Sent ' + plural(results.length, 'case citation', 'case citations') + ': ' +
      missing.length + ' not found, ' + found.length + ' found.' +
      (unchecked.length ? ' ' + plural(unchecked.length, 'citation', 'citations') + ' couldn’t be looked up.' : '') +
      (batchStatutes.length ? ' ' + plural(batchStatutes.length, 'statute', 'statutes') + ' listed, not sent.' : '')
    out.appendChild(sum)

    group('CourtListener didn’t find these', 'cc-miss', missing, function (r) {
      return row(r.citation, 'Not in CourtListener. It may be invented, mistyped, or a real case CourtListener doesn’t carry. Pull it yourself before it goes in a filing.')
    })
    group('Found. Read them yourself before you rely on them', 'cc-found', found, function (r) {
      var name = r.name ? 'CourtListener lists this as ' + r.name + '. Check that it is the case your brief names and says what your brief says.' : 'CourtListener has a case at this citation. Check that it is the one your brief means.'
      return row(r.citation, name, safeLink(r.url))
    })
    var notLooked = unchecked.map(function (r) { return { citation: r.citation, reason: r.reason || 'This one couldn’t be looked up just now.' } })
      .concat(batchStatutes.map(function (c) { return { citation: c, reason: 'Statutes aren’t looked up by the free check. Read the current text yourself.' } }))
    group('Not looked up', 'cc-skip', notLooked, function (r) { return row(r.citation, r.reason) })
    after.hidden = false
  }

  function check() {
    if (busy || sent >= cases.length) return
    var batch = cases.slice(sent, sent + BATCH)
    busy = true
    go.disabled = true
    next.hidden = true
    say('Asking CourtListener about ' + plural(batch.length, 'citation', 'citations') + '. A long list can take half a minute.', 'wait')
    // Exactly one key, an array of bare citation strings. Nothing else.
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ citations: batch }) })
      .then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { return { status: r.status, body: j } }) })
      .then(function (r) {
        if (r.status === 200 && r.body && r.body.ok) {
          sent += batch.length
          if (r.body.live === false) say('The check isn’t connected to CourtListener right now, so nothing was looked up. Try again later.', 'warn')
          else say('')
          shown.results = shown.results.concat(r.body.results || [])
          show(shown.results, shown.statutes)
          if (sent < cases.length) {
            next.hidden = false
            next.textContent = 'Check the next ' + Math.min(BATCH, cases.length - sent) + ' citations'
          }
        } else {
          var msg = (r.body && r.body.error) || 'The check didn’t go through. Try again in a minute.'
          say(msg, 'warn')
          if (r.body && (r.body.capped || r.body.limited)) after.hidden = false
        }
      })
      .catch(function () { say('Couldn’t reach Candor just now. Check your connection and try again.', 'warn') })
      .then(function () { busy = false; go.disabled = !cases.length; })
  }

  var t = 0
  text.addEventListener('input', function () { clearTimeout(t); t = setTimeout(scan, 150) })
  go.addEventListener('click', function () { sent = 0; shown = { results: [], statutes: statutes.slice() }; check() })
  next.addEventListener('click', check)
  clear.addEventListener('click', function () {
    text.value = ''
    out.textContent = ''
    after.hidden = true
    say('')
    scan()
    text.focus()
  })
  scan()
})()
