/* ============================================================
   APEX AUTOMATIONS — Scroll-Scrubbed Eagle Flight
   The hero is pinned for 300vh while the user's scroll drives a
   121-frame ultra-realistic eagle sequence on a canvas. The
   footage is black-backed and screen-blended, so the eagle flies
   inside the page, not inside a video rectangle. At the end of
   its run the eagle makes its final move and dissolves; the rest
   of the site continues below.
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('eagle-canvas');
  var stage = document.querySelector('.hero-stage');
  if (!canvas || !stage || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia('(max-width: 768px)').matches;

  var FRAMES = 121;
  var SCRUB_END = 0.74;   // share of the pin spent flying; the rest is the exit

  var display = 0, target = 0, dirty = true;

  /* ---------- frame loading ---------- */
  var imgs = new Array(FRAMES);
  function src(i) { return 'assets/eagle-seq2/frame-' + ('00' + (i + 1)).slice(-3) + '.webp'; }
  function load(i, cb) {
    if (imgs[i]) {
      if (cb && imgs[i].ready) cb();
      return;
    }
    var im = new Image();
    im.decoding = 'async';
    im.onload = function () {
      im.ready = true;
      dirty = true; // repaint so a placeholder frame upgrades to the real one
      if (cb) cb();
    };
    im.src = src(i);
    imgs[i] = im;
  }

  function nearestReady(i) {
    for (var d = i; d >= 0; d--) if (imgs[d] && imgs[d].ready) return imgs[d];
    return null;
  }

  /* ---------- canvas sizing ---------- */
  var dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
  function resize() {
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    dirty = true;
  }

  /* ---------- drawing ---------- */
  function draw(p) {
    var cw = canvas.width, ch = canvas.height;
    if (!cw || !ch) return;

    var scrub = Math.min(p / SCRUB_END, 1);
    var fi = Math.min(FRAMES - 1, Math.round(scrub * (FRAMES - 1)));
    var im = nearestReady(fi);
    ctx.clearRect(0, 0, cw, ch);
    if (!im) return;

    // exit: after the flight, the eagle rises, grows and dissolves
    var exit = p <= SCRUB_END ? 0 : (p - SCRUB_END) / (1 - SCRUB_END);
    var ease = exit * exit * (3 - 2 * exit); // smoothstep
    canvas.style.opacity = (0.9 * (1 - ease)).toFixed(3);

    // Fit the 16:9 footage to the frame, then scale up + drift up on exit.
    // Desktop = cover (fills the wide hero). Mobile (portrait) = contain, so
    // the WHOLE eagle stays visible instead of cropping to the centre 26%;
    // the black void around it screen-blends into the page invisibly.
    var iw = im.naturalWidth, ih = im.naturalHeight;
    var fit = isMobile ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih);
    var scale = fit * (1 + ease * 0.22);
    var dw = iw * scale, dh = ih * scale;
    var dx = (cw - dw) / 2;
    // Mobile: anchor the contained eagle in the upper third (just under the
    // nav) instead of dead-centre, so the hero reads as a deliberate
    // top-anchored composition with the title beneath it — not a small bird
    // floating in empty space. Desktop stays centred.
    var baseDy = isMobile ? ch * 0.12 : (ch - dh) / 2;
    var dy = baseDy - ease * ch * 0.28;
    ctx.drawImage(im, dx, dy, dw, dh);
  }

  /* ---------- reduced motion: one static frame, no pin, one download ---------- */
  if (prefersReduced) {
    function staticDraw() { resize(); draw(0); }
    load(0, staticDraw);
    window.addEventListener('resize', staticDraw);
    // the title-card beats never get scrubbed here — show them all, statically
    Array.prototype.forEach.call(document.querySelectorAll('.hero-beat'), function (el) {
      el.style.opacity = '1';
    });
    if (window.__startHeroCounters) window.__startHeroCounters();
    return;
  }

  /* normal path: eager-load the opening frames, then the rest */
  load(0);
  for (var i = 1; i <= 20; i++) load(i);
  setTimeout(function () { for (var j = 21; j < FRAMES; j++) load(j); }, 600);

  window.addEventListener('resize', resize);
  resize();

  /* ---------- scroll progress through the stage ---------- */
  function progress() {
    var r = stage.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, -r.top / total));
  }

  var scrollCue = document.querySelector('.scroll-cue');

  /* title-card beats: each block of hero copy gets its own window of the
     flight (data-in → data-out) so the eagle is never buried under text */
  var beats = Array.prototype.map.call(document.querySelectorAll('.hero-beat'), function (el) {
    return {
      el: el,
      a: parseFloat(el.getAttribute('data-in')) || 0,
      b: parseFloat(el.getAttribute('data-out')) || 1,
      hasStats: !!el.querySelector('.hero-stats')
    };
  });
  var countersFired = false;

  function ss(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }

  function applyText(p) {
    beats.forEach(function (bt) {
      var inP = bt.a === 0 ? 1 : ss((p - bt.a) / 0.06); // first card opens the film
      var outP = ss((p - (bt.b - 0.08)) / 0.08);
      var vis = inP * (1 - outP);
      bt.el.style.opacity = vis.toFixed(3);
      bt.el.style.transform = 'translateY(' + ((1 - inP) * 46 - outP * 56).toFixed(1) + 'px)';
      bt.el.style.pointerEvents = vis > 0.5 ? '' : 'none';
      if (bt.hasStats && !countersFired && vis > 0.5) {
        countersFired = true;
        if (window.__startHeroCounters) window.__startHeroCounters();
      }
    });
    if (scrollCue) scrollCue.style.opacity = Math.max(0, 1 - p * 6).toFixed(2);
  }

  /* ---------- main loop ---------- */
  function tick() {
    requestAnimationFrame(tick);
    if (document.hidden || window.__eagleHold) return;
    target = progress();
    display += (target - display) * 0.18;
    if (Math.abs(target - display) < 0.0006) display = target;
    // idle: nothing moved and nothing new loaded — skip all draw work
    if (display === target && !dirty) return;
    draw(display);
    applyText(display);
    dirty = false;
  }
  tick();

  // debug/test hook: force a progress value and draw synchronously
  window.__eagleScrub = function (p) {
    display = target = Math.min(1, Math.max(0, p));
    resize();
    draw(display);
    applyText(display);
    return display;
  };
})();
