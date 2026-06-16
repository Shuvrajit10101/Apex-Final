/* ============================================================
   APEX AUTOMATIONS — Interactions & Scroll Choreography
   All effects degrade gracefully when a CDN library is missing.
   ============================================================ */
(function () {
  'use strict';

  var hasGSAP = typeof window.gsap !== 'undefined';
  var hasST = hasGSAP && typeof window.ScrollTrigger !== 'undefined';
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia('(max-width: 768px)').matches;

  if (hasST) gsap.registerPlugin(ScrollTrigger);
  // advance by real elapsed time after rAF throttling (background tabs),
  // so animations complete instead of crawling and leaving content hidden
  if (hasGSAP) gsap.ticker.lagSmoothing(0);

  // marks JS as active — CSS only hides icon strokes for the draw-on
  // effect when this class exists, so no-JS visitors still see icons
  document.documentElement.classList.add('js');

  /* ---------- playful icon entrance (spring pop) ---------- */
  var svcCards = document.querySelectorAll('.svc-card3d');
  if ('IntersectionObserver' in window && !prefersReduced) {
    var popObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('pop');
          popObs.unobserve(en.target);
        }
      });
    }, { threshold: 0.35 });
    svcCards.forEach(function (c) { popObs.observe(c); });
  } else {
    svcCards.forEach(function (c) { c.classList.add('pop'); });
  }

  /* ---------- Loader ---------- */
  var loader = document.getElementById('loader');
  var loaderBar = document.querySelector('.loader-bar i');
  var loaderCount = document.querySelector('.loader-count');
  var loadDone = false;

  function finishLoader() {
    if (loadDone || !loader) return;
    loadDone = true;
    if (loaderBar) loaderBar.style.transform = 'scaleX(1)';
    if (loaderCount) loaderCount.textContent = '100%';
    setTimeout(function () {
      loader.classList.add('done');
      document.body.classList.add('ready');
      runHeroIntro();
    }, 350);
  }

  (function fakeProgress() {
    var p = 0;
    var iv = setInterval(function () {
      if (loadDone) { clearInterval(iv); return; } // never overwrite the finished bar
      p = Math.min(p + Math.random() * 16, 92);
      if (loaderBar) loaderBar.style.transform = 'scaleX(' + p / 100 + ')';
      if (loaderCount) loaderCount.textContent = Math.round(p) + '%';
      if (p >= 92) clearInterval(iv);
    }, 120);
  })();

  window.addEventListener('load', finishLoader);
  setTimeout(finishLoader, 3500); // hard cap — never trap the page

  /* ---------- Smooth scroll (Lenis) ---------- */
  // Mobile uses native momentum scrolling — it's smoother than a JS rAF loop
  // on touch, and frees the main thread during the heavy hero scrub.
  var lenis = null;
  if (typeof window.Lenis !== 'undefined' && !prefersReduced && !isMobile) {
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true }); // 0.11 settles a touch faster → fewer trailing scrub frames
    // Drive Lenis off GSAP's single ticker instead of a 2nd standalone rAF
    // loop — one scheduler for scroll + animation, and it pauses with the tab.
    if (hasGSAP) {
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    } else {
      var raf = function (time) { if (!document.hidden) lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    if (hasST) lenis.on('scroll', ScrollTrigger.update);
    window.apexLenis = lenis; // exposed for programmatic scrolling/debugging
  }

  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -70, duration: 1.4 });
    else el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
  }

  // anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length > 1) {
        var el = document.querySelector(id);
        if (el) { e.preventDefault(); scrollToEl(el); closeMenu(); }
      }
    });
  });

  /* ---------- Navigation ---------- */
  var nav = document.querySelector('.nav');
  var toTop = document.querySelector('.to-top');
  var navScrolled = null, toTopShown = null;
  function onScrollNav() {
    var y = window.scrollY;
    var s = y > 40, t = y > 700;
    // only touch classList when state actually flips — toggling a
    // backdrop-filtered element's class every scroll event re-triggers
    // its blur layer
    if (nav && s !== navScrolled) { nav.classList.toggle('scrolled', s); navScrolled = s; }
    if (toTop && t !== toTopShown) { toTop.classList.toggle('show', t); toTopShown = t; }
  }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  if (toTop) toTop.addEventListener('click', function () {
    if (lenis) lenis.scrollTo(0, { duration: 1.4 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // burger / mobile menu
  var burger = document.querySelector('.burger');
  var mobileMenu = document.querySelector('.mobile-menu');
  function closeMenu() {
    if (burger) burger.classList.remove('open');
    if (mobileMenu) mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
    if (lenis) lenis.start(); // overflow:hidden doesn't stop Lenis — pause it explicitly
  }
  if (burger && mobileMenu) {
    burger.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
      if (lenis) { if (open) lenis.stop(); else lenis.start(); }
      // stagger links
      mobileMenu.querySelectorAll('a').forEach(function (a, i) {
        a.style.transitionDelay = open ? (0.06 + i * 0.05) + 's' : '0s';
      });
    });
  }

  // active section highlighting + chapter ambience
  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.nav-link[href^="#"], .story-nav a');
  var ambience = document.querySelector('.ambience');
  var ambMap = { home: 1, why: 1, services: 2, process: 2, calculator: 3, packages: 3, portfolio: 4, faq: 4, contact: 4 };
  if ('IntersectionObserver' in window && sections.length) {
    var secObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          navLinks.forEach(function (l) {
            l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id);
          });
          if (ambience && ambMap[en.target.id]) {
            var cls = 'ambience amb-' + ambMap[en.target.id];
            if (ambience.className !== cls) ambience.className = cls; // skip redundant style recalc
          }
        }
      });
    }, { rootMargin: '-38% 0px -55% 0px' });
    sections.forEach(function (s) { secObs.observe(s); });
  }

  /* ---------- Hero intro ---------- */
  function runHeroIntro() {
    if (!hasGSAP || prefersReduced) return;
    // only the opening title card animates at load — the later beats
    // belong to the scroll (sequenced by eagle-scroll.js)
    var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.from('.hero-eyebrow', { y: 26, opacity: 0, duration: 0.9 })
      .from('.hero-title .line > span', { yPercent: 115, duration: 1.25, stagger: 0.14 }, '-=0.55')
      .from('.scroll-cue', { opacity: 0, duration: 1 }, '-=0.4');
    // failsafe: if anything kept the timeline from finishing, force the card visible
    setTimeout(function () {
      var eb = document.querySelector('.hero-eyebrow');
      if (eb && getComputedStyle(eb).opacity === '0') {
        tl.kill();
        gsap.set('.hero-eyebrow, .hero-title .line > span, .scroll-cue', { clearProps: 'all' });
      }
    }, 9000);
  }

  /* ---------- kinetic headlines (story mode) ---------- */
  function splitWords(root) {
    Array.prototype.slice.call(root.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        var frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var mask = document.createElement('span'); mask.className = 'kwm';
          var word = document.createElement('span'); word.className = 'kw';
          word.textContent = part;
          mask.appendChild(word);
          frag.appendChild(mask);
        });
        root.replaceChild(frag, node);
      } else if (node.nodeType === 1) {
        splitWords(node);
      }
    });
  }
  if (hasST && !prefersReduced) {
    document.querySelectorAll('.section-head h2, .contact-info h2').forEach(function (h) {
      splitWords(h);
      gsap.from(h.querySelectorAll('.kw'), {
        yPercent: 120, rotate: 6, duration: 0.9, ease: 'power3.out', stagger: 0.045,
        scrollTrigger: { trigger: h, start: 'top 88%', once: true }
      });
    });
  }

  /* ---------- Scroll reveals ---------- */
  if (hasST && !prefersReduced) {
    // generic rise-in
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      gsap.from(el, {
        y: 64, opacity: 0, duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
    // grouped stagger
    gsap.utils.toArray('[data-reveal-group]').forEach(function (group) {
      gsap.from(group.children, {
        y: 56, opacity: 0, duration: 0.95, ease: 'power3.out', stagger: 0.1,
        scrollTrigger: { trigger: group, start: 'top 86%', once: true }
      });
    });
    // 3D flip-up cards
    gsap.utils.toArray('[data-reveal-3d]').forEach(function (group) {
      gsap.from(group.children, {
        rotationX: -32, y: 90, opacity: 0, transformOrigin: '50% 100%',
        duration: 1.15, ease: 'power3.out', stagger: 0.08,
        scrollTrigger: { trigger: group, start: 'top 85%', once: true }
      });
    });
    // story: full-screen chapter scenes — numeral and title breathe in,
    // hold while pinned, then hand off to the chapter content
    gsap.utils.toArray('.chapter-scene').forEach(function (scene) {
      var num = scene.querySelector('.cs-num');
      var body = scene.querySelector('.cs-body');
      var rule = scene.querySelector('.cs-rule');
      var tl = gsap.timeline({
        scrollTrigger: { trigger: scene, start: 'top 75%', end: 'bottom 25%', scrub: 0.5 }
      });
      tl.fromTo(num, { yPercent: 36, opacity: 0, scale: 0.92 }, { yPercent: 0, opacity: 1, scale: 1, duration: 0.3, ease: 'none' }, 0)
        .fromTo(body, { y: 90, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'none' }, 0.08)
        .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.15, ease: 'none' }, 0.22)
        .to(num, { yPercent: -28, opacity: 0, duration: 0.3, ease: 'none' }, 0.7)
        .to(body, { y: -70, opacity: 0, duration: 0.28, ease: 'none' }, 0.72);
    });

    // story: cards dealt onto the table, alternating tilt.
    // CSS hover transitions on these cards would fight the tween and the
    // leftover inline transform would kill :hover lifts — so transitions
    // are suspended during the deal and transforms cleared after it.
    gsap.utils.toArray('[data-reveal-deal]').forEach(function (group) {
      var kids = Array.prototype.slice.call(group.children);
      kids.forEach(function (k) { k.style.transition = 'none'; });
      gsap.from(kids, {
        y: 110, opacity: 0,
        rotation: function (i) { return i % 2 ? 5 : -5; },
        transformOrigin: '50% 100%',
        duration: 1.0, ease: 'back.out(1.4)', stagger: 0.12,
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: group, start: 'top 85%', once: true },
        onComplete: function () { kids.forEach(function (k) { k.style.transition = ''; }); }
      });
    });
    // story: process steps swoop in from alternating sides
    gsap.utils.toArray('[data-step]').forEach(function (step, i) {
      gsap.from(step, {
        x: (i % 2 ? 1 : -1) * (isMobile ? 28 : 90), opacity: 0,
        duration: 1.0, ease: 'power3.out',
        scrollTrigger: { trigger: step, start: 'top 86%', once: true }
      });
    });
    // story: packages rise, the featured one lands last with a flourish
    gsap.utils.toArray('[data-reveal-packages]').forEach(function (grid) {
      var cards = Array.prototype.slice.call(grid.children);
      var featured = grid.querySelector('.pkg.featured');
      var rest = cards.filter(function (c) { return c !== featured; });
      cards.forEach(function (c) { c.style.transition = 'none'; });
      var tl = gsap.timeline({
        scrollTrigger: { trigger: grid, start: 'top 82%', once: true },
        onComplete: function () { cards.forEach(function (c) { c.style.transition = ''; }); }
      });
      tl.from(rest, { y: 90, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, clearProps: 'transform,opacity' });
      if (featured) tl.from(featured, { y: 130, opacity: 0, scale: 0.92, duration: 1.0, ease: 'back.out(1.6)', clearProps: 'transform,opacity' }, '-=0.45');
    });
    // (hero text fade is owned by eagle-scroll.js, synced to the eagle's flight)
    // process line draw
    var processLine = document.querySelector('.process-line');
    if (processLine) {
      gsap.to(processLine, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: '.process-track', start: 'top 70%', end: 'bottom 55%', scrub: 0.6 }
      });
    }
    // edge watermark parallax
    var wm = document.querySelector('.edge-watermark');
    if (wm) {
      gsap.to(wm, {
        y: -120, rotation: 6, ease: 'none',
        scrollTrigger: { trigger: '.edge', start: 'top bottom', end: 'bottom top', scrub: 0.6 } // smoothed: fewer transform commits than scrub:true
      });
    }
  } else {
    // ensure the process line is visible without GSAP
    var pl = document.querySelector('.process-line');
    if (pl) pl.style.transform = 'scaleY(1)';
  }

  /* ---------- 3D tilt cards ---------- */
  if (finePointer && !prefersReduced) {
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      var bounds = null;
      card.addEventListener('pointerenter', function () { bounds = card.getBoundingClientRect(); });
      card.addEventListener('pointermove', function (e) {
        if (!bounds) bounds = card.getBoundingClientRect();
        var px = (e.clientX - bounds.left) / bounds.width;
        var py = (e.clientY - bounds.top) / bounds.height;
        var rx = (0.5 - py) * 10;
        var ry = (px - 0.5) * 12;
        card.style.transform = 'perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-4px)';
        card.style.setProperty('--gx', (px * 100) + '%');
        card.style.setProperty('--gy', (py * 100) + '%');
      });
      card.addEventListener('pointerleave', function () {
        bounds = null;
        card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)';
      });
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !prefersReduced) {
    document.querySelectorAll('.btn-gold, .btn-ghost, .nav-cta').forEach(function (btn) {
      var bb = null; // cache the rect on enter instead of reading layout every move
      btn.addEventListener('pointerenter', function () { bb = btn.getBoundingClientRect(); });
      btn.addEventListener('pointermove', function (e) {
        if (!bb) bb = btn.getBoundingClientRect();
        var dx = e.clientX - (bb.left + bb.width / 2);
        var dy = e.clientY - (bb.top + bb.height / 2);
        btn.style.transform = 'translate(' + dx * 0.18 + 'px,' + (dy * 0.22 - 3) + 'px)';
      });
      btn.addEventListener('pointerleave', function () {
        bb = null;
        btn.style.transform = '';
      });
    });
  }

  /* ---------- Animated counters ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1800;
    var t0 = null;
    function frame(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(target * eased);
      el.textContent = val + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var counters = document.querySelectorAll('[data-count]');
  function startCounters() {
    if ('IntersectionObserver' in window && counters.length) {
      var cObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { animateCount(en.target); cObs.unobserve(en.target); }
        });
      }, { threshold: 0.6 });
      counters.forEach(function (c) { cObs.observe(c); });
    } else {
      counters.forEach(function (c) {
        c.textContent = c.getAttribute('data-count') + (c.getAttribute('data-suffix') || '');
      });
    }
  }
  // the count-up fires the moment its title-card beat becomes visible
  window.__startHeroCounters = startCounters;
  if (prefersReduced || !document.querySelector('.hero-beat')) startCounters();

  /* ---------- ROI calculator ---------- */
  var calc = {
    team: document.getElementById('calc-team'),
    hours: document.getElementById('calc-hours'),
    rate: document.getElementById('calc-rate'),
    out: document.getElementById('calc-output'),
    hoursOut: document.getElementById('calc-hours-saved'),
    cur: 'inr'
  };
  var curBtns = document.querySelectorAll('.calc-cur button');
  var displayed = 0;

  function fmtMoney(v) {
    if (calc.cur === 'inr') {
      if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2) + ' Cr';
      if (v >= 100000) return '₹' + (v / 100000).toFixed(1) + ' L';
      return '₹' + Math.round(v).toLocaleString('en-IN');
    }
    return '$' + Math.round(v).toLocaleString('en-US');
  }

  function updateRangeFill(input) {
    var min = +input.min, max = +input.max, val = +input.value;
    input.style.setProperty('--fill', ((val - min) / (max - min)) * 100 + '%');
  }

  function computeROI(animate) {
    if (!calc.team || !calc.out) return;
    var team = +calc.team.value;
    var hours = +calc.hours.value;
    var rate = +calc.rate.value;
    var rateMoney = calc.cur === 'inr' ? rate * 10 : rate * 0.5; // slider 10–100 → ₹100–₹1000 or $5–$50
    // 70% of repetitive hours are realistically automatable
    var weeklySaved = team * hours * 0.7;
    var yearly = weeklySaved * 52 * rateMoney;

    document.getElementById('calc-team-out').textContent = team;
    document.getElementById('calc-hours-out').textContent = hours + ' hrs';
    document.getElementById('calc-rate-out').textContent = fmtMoney(rateMoney) + '/hr';
    if (calc.hoursOut) calc.hoursOut.textContent = Math.round(weeklySaved * 52).toLocaleString() + ' hours';

    if (animate === false || prefersReduced) {
      displayed = yearly;
      calc.out.textContent = fmtMoney(yearly);
      return;
    }
    var from = displayed, t0 = null, dur = 700;
    displayed = yearly;
    function frame(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      calc.out.textContent = fmtMoney(from + (yearly - from) * eased);
      if (p < 1 && displayed === yearly) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (calc.team) {
    [calc.team, calc.hours, calc.rate].forEach(function (input) {
      updateRangeFill(input);
      input.addEventListener('input', function () {
        updateRangeFill(input);
        computeROI(true);
      });
    });
    curBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        curBtns.forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        calc.cur = b.getAttribute('data-cur');
        computeROI(true);
      });
    });
    computeROI(false);

    // story: the calculator demos itself the first time it appears
    var calcTouched = false;
    var calcDemo = null;
    var calcOptOut = function () {
      calcTouched = true;
      if (calcDemo) { calcDemo.kill(); calcDemo = null; }
    };
    [calc.team, calc.hours, calc.rate].forEach(function (inp) {
      inp.addEventListener('pointerdown', calcOptOut, { once: true });
      inp.addEventListener('keydown', calcOptOut, { once: true }); // keyboard users too
    });
    if (hasST && !prefersReduced) {
      ScrollTrigger.create({
        trigger: '.calc-box', start: 'top 75%', once: true,
        onEnter: function () {
          if (calcTouched) return;
          var goal = { t: +calc.team.value, h: +calc.hours.value, r: +calc.rate.value };
          var state = { t: +calc.team.min, h: +calc.hours.min, r: +calc.rate.min };
          calcDemo = gsap.to(state, {
            t: goal.t, h: goal.h, r: goal.r,
            duration: 1.6, ease: 'power2.out', delay: 0.35,
            onUpdate: function () {
              if (calcTouched) return; // hands off the moment the user grabs a slider
              calc.team.value = Math.round(state.t);
              calc.hours.value = Math.round(state.h);
              calc.rate.value = Math.round(state.r);
              updateRangeFill(calc.team); updateRangeFill(calc.hours); updateRangeFill(calc.rate);
              computeROI(false);
            }
          });
        }
      });
    }
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.setAttribute('aria-expanded', 'false');
    q.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (o) {
        o.classList.remove('open');
        o.querySelector('.faq-a').style.maxHeight = '0px';
        o.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
        q.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- Contact form → WhatsApp ---------- */
  var form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (document.getElementById('f-name').value || '').trim();
      var biz = (document.getElementById('f-biz').value || '').trim();
      var service = document.getElementById('f-service').value;
      var msg = (document.getElementById('f-msg').value || '').trim();
      var text =
        'Hi Apex Automations! 👋\n' +
        '• Name: ' + (name || '—') + '\n' +
        (biz ? '• Business: ' + biz + '\n' : '') +
        '• Interested in: ' + (service || 'General enquiry') + '\n' +
        (msg ? '• Project details: ' + msg : '');
      var url = 'https://wa.me/917087642005?text=' + encodeURIComponent(text);
      window.open(url, '_blank', 'noopener');
      var note = document.querySelector('.form-note');
      if (note) note.classList.add('show');
    });
  }

  /* ---------- Custom cursor ---------- */
  if (finePointer && !prefersReduced) {
    var dot = document.querySelector('.cursor-dot');
    var ring = document.querySelector('.cursor-ring');
    if (dot && ring) {
      var cx = -100, cy = -100, rx = -100, ry = -100;
      window.addEventListener('pointermove', function (e) {
        cx = e.clientX; cy = e.clientY;
        dot.style.transform = 'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%)';
      }, { passive: true });
      (function ringLoop() {
        requestAnimationFrame(ringLoop);
        if (document.hidden) return;
        // settle-gate: when the ring has caught up to a stationary pointer,
        // stop writing a transform every frame (this loop ran forever otherwise)
        if (Math.abs(cx - rx) < 0.1 && Math.abs(cy - ry) < 0.1) return;
        rx += (cx - rx) * 0.16;
        ry += (cy - ry) * 0.16;
        // the trailing -50% keeps the ring centered even when .is-hover resizes it
        ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      })();
      document.querySelectorAll('a, button, [data-tilt], input, select, textarea, .faq-q').forEach(function (el) {
        el.addEventListener('pointerenter', function () { ring.classList.add('is-hover'); });
        el.addEventListener('pointerleave', function () { ring.classList.remove('is-hover'); });
      });
    }
  }

  /* ---------- golden story path (non-uniform serpentine) ---------- */
  var spContainer = document.querySelector('.story-path');
  if (spContainer && hasST && !prefersReduced) {
    var spSvg = spContainer.querySelector('svg');
    var spLine = spContainer.querySelector('.sp-line');
    var spComet = spContainer.querySelector('.sp-comet');
    var spTrigger = null;

    var buildPath = function () {
      var first = document.querySelector('#why');
      var last = document.querySelector('#contact');
      if (!first || !last || !spLine.getTotalLength) return;
      var startY = first.getBoundingClientRect().top + window.scrollY;
      var endY = last.getBoundingClientRect().bottom + window.scrollY;
      var H = Math.round(endY - startY);
      var W = document.documentElement.clientWidth;
      if (H < 100) return;
      spContainer.style.top = startY + 'px';
      spContainer.style.height = H + 'px';
      spContainer.style.display = 'block';
      spSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

      // the eagle's path on the ground: weave through alternating lanes
      var ids = ['#why', '#services', '#process', '#calculator', '#packages', '#portfolio', '#faq', '#contact'];
      var lanes = [0.84, 0.14, 0.86, 0.16, 0.82, 0.18, 0.86, 0.5];
      var pts = [[W * 0.5, 0]];
      ids.forEach(function (sel, i) {
        var el = document.querySelector(sel);
        if (!el) return;
        var r = el.getBoundingClientRect();
        var y = r.top + window.scrollY - startY + r.height * 0.45;
        pts.push([W * lanes[i], Math.max(0, Math.min(H, y))]);
      });
      var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1];
      for (var i = 1; i < pts.length; i++) {
        var midY = ((pts[i - 1][1] + pts[i][1]) / 2).toFixed(1);
        d += ' C' + pts[i - 1][0].toFixed(1) + ' ' + midY +
             ' ' + pts[i][0].toFixed(1) + ' ' + midY +
             ' ' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1);
      }
      spLine.setAttribute('d', d);

      var L = spLine.getTotalLength();
      spLine.style.strokeDasharray = L + ' ' + L;
      spLine.style.strokeDashoffset = L;

      // Pre-sample the comet positions ONCE (getPointAtLength is a synchronous
      // geometry walk — calling it every scroll frame on this full-page path
      // was a top jank source). onUpdate now just indexes this array.
      var SAMPLES = 240, cometPts = new Array(SAMPLES + 1);
      for (var s = 0; s <= SAMPLES; s++) {
        var pt = spLine.getPointAtLength((s / SAMPLES) * L);
        cometPts[s] = [pt.x, pt.y];
      }
      var cometShown = null;

      if (spTrigger) spTrigger.kill();
      spTrigger = ScrollTrigger.create({
        trigger: spContainer, start: 'top 72%', end: 'bottom 80%', scrub: 0.6,
        onUpdate: function (self) {
          var prog = self.progress;
          spLine.style.strokeDashoffset = L * (1 - prog);
          if (spComet) {
            var on = prog > 0.002 && prog < 0.995;
            if (on) {
              var p = cometPts[(prog * SAMPLES) | 0] || cometPts[SAMPLES];
              spComet.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)';
            }
            if (on !== cometShown) { spComet.style.opacity = on ? '1' : '0'; cometShown = on; }
          }
        }
      });
      spBuilt = true;
    };

    var spBuilt = false, spLastW = 0, spRebuild;
    window.addEventListener('resize', function () {
      // mobile URL-bar show/hide fires resize on height only — ignore those;
      // only rebuild when the WIDTH actually changes
      if (document.documentElement.clientWidth === spLastW) return;
      spLastW = document.documentElement.clientWidth;
      clearTimeout(spRebuild);
      spRebuild = setTimeout(buildPath, 250);
    });
    spLastW = document.documentElement.clientWidth;
    window.addEventListener('load', function () { setTimeout(buildPath, 400); });
    setTimeout(function () { if (!spBuilt) buildPath(); }, 1400); // fallback only if load already fired
    window.__buildStoryPath = buildPath; // debug/test hook
  }

  /* ---------- Footer year ---------- */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
})();
