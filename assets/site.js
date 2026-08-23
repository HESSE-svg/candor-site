// Candor site — nav, gentle reveal-on-scroll, and the live redaction demo.
(function () {
  // mobile nav
  var toggle = document.querySelector('.navtoggle')
  var links = document.querySelector('.navlinks')
  if (toggle && links) toggle.addEventListener('click', function () { links.classList.toggle('open') })

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
