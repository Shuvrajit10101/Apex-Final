/* ============================================================
   APEX AUTOMATIONS — Scroll-Scrubbed Eagle Flight
   The hero is pinned while the user's scroll drives a 121-frame
   eagle sequence on a canvas. Footage is black-backed and
   screen-blended, so the eagle flies inside the page. At the end
   of its run it rises and dissolves; the site continues below.

   Perf: progress is derived from cached scroll metrics (no
   per-frame getBoundingClientRect reflow); draw() skips redundant
   clearRect/drawImage when the frame index and exit value are
   unchanged; opacity and per-beat styles are only written on
   change. This keeps the hero scrub cheap and the loop idle-free.
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
  var lastFi = -1, lastEase = -1, lastOpacity = -1, lastCue = -1;

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

  /* ---------- canvas sizing (dpr capped — the source is only 720p, so a
     higher backing store buys no detail but costs fill-rate every frame) ---------- */
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    dirty = true;
    lastFi = -1; lastOpacity = -1; // force a repaint into the new backing store
  }

  /* ---------- cached scroll metrics (measured on load/resize, never per frame) ---------- */
  var stageTop = 0, stageRange = 1, vh = window.innerHeight;
  function measure() {
    var top = 0, el = stage;
    while (el) { top += el.offsetTop; el = el.offsetParent; }
    stageTop = top;
    vh = window.innerHeight;
    stageRange = Math.max(1, stage.offsetHeight - vh);
  }
  function progress() {
    var sy = window.pageYOffset || document.documentElement.scrollTop || 0;
    var p = (sy - stageTop) / stageRange;
    return p < 0 ? 0 : (p > 1 ? 1 : p);
  }

  /* ---------- drawing ---------- */
  function draw(p) {
    var cw = canvas.width, ch = canvas.height;
    if (!cw || !ch) return;

    var scrub = p / SCRUB_END; if (scrub > 1) scrub = 1;
    var fi = Math.min(FRAMES - 1, Math.round(scrub * (FRAMES - 1)));
    var exit = p <= SCRUB_END ? 0 : (p - SCRUB_END) / (1 - SCRUB_END);
    var ease = exit * exit * (3 - 2 * exit); // smoothstep

    // skip the expensive clear+draw when the visible result can't have changed
    // (the lerp settles over many sub-pixel frames that map to the same frame)
    if (fi === lastFi && ease === lastEase && !dirty) return;

    var im = nearestReady(fi);
    ctx.clearRect(0, 0, cw, ch);
    if (!im) { lastFi = -1; return; } // nothing ready yet — retry next frame
    lastFi = fi; lastEase = ease;

    // exit: after the flight, the eagle rises, grows and dissolves
    var op = +(0.9 * (1 - ease)).toFixed(3);
    if (op !== lastOpacity) { canvas.style.opacity = op; lastOpacity = op; }

    // Fit the 16:9 footage to the frame, then scale up + drift up on exit.
    // Desktop = cover (fills the wide hero). Mobile (portrait) = contain, so
    // the WHOLE eagle stays visible instead of cropping to the centre 26%.
    var iw = im.naturalWidth, ih = im.naturalHeight;
    var fit = isMobile ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih);
    var scale = fit * (1 + ease * 0.22);
    var dw = iw * scale, dh = ih * scale;
    var dx = (cw - dw) / 2;
    // Mobile: anchor the contained eagle in the upper third (just under the nav).
    var baseDy = isMobile ? ch * 0.12 : (ch - dh) / 2;
    var dy = baseDy - ease * ch * 0.28;
    ctx.drawImage(im, dx, dy, dw, dh);
  }

  /* ---------- reduced motion: one static frame, no pin, one download ---------- */
  if (prefersReduced) {
    var staticDraw = function () { resize(); dirty = true; draw(0); };
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

  resize();
  measure();

  /* debounced resize — raw resize fires dozens of times during a window drag
     and on every mobile URL-bar show/hide; reallocating the canvas each time
     is wasteful */
  var resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { resize(); measure(); dirty = true; }, 150);
  }
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('load', function () { measure(); dirty = true; });
  setTimeout(measure, 800); // re-measure once late layout (fonts, CDN) settles

  var scrollCue = document.querySelector('.scroll-cue');

  /* title-card beats: each block of hero copy gets its own window of the
     flight (data-in → data-out) so the eagle is never buried under text */
  var beats = Array.prototype.map.call(document.querySelectorAll('.hero-beat'), function (el) {
    return {
      el: el,
      a: parseFloat(el.getAttribute('data-in')) || 0,
      b: parseFloat(el.getAttribute('data-out')) || 1,
      hasStats: !!el.querySelector('.hero-stats'),
      lastVis: -1, lastPE: null
    };
  });
  var countersFired = false;

  function ss(x) { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); }

  function applyText(p) {
    beats.forEach(function (bt) {
      var inP = bt.a === 0 ? 1 : ss((p - bt.a) / 0.06); // first card opens the film
      var outP = ss((p - (bt.b - 0.08)) / 0.08);
      var vis = inP * (1 - outP);
      var visR = Math.round(vis * 1000) / 1000;
      if (visR === bt.lastVis) return; // unchanged — no DOM write
      bt.lastVis = visR;
      bt.el.style.opacity = visR.toFixed(3);
      bt.el.style.transform = 'translateY(' + ((1 - inP) * 46 - outP * 56).toFixed(1) + 'px)';
      var pe = vis > 0.5;
      if (pe !== bt.lastPE) { bt.el.style.pointerEvents = pe ? '' : 'none'; bt.lastPE = pe; }
      if (bt.hasStats && !countersFired && vis > 0.5) {
        countersFired = true;
        if (window.__startHeroCounters) window.__startHeroCounters();
      }
    });
    if (scrollCue) {
      var cue = +Math.max(0, 1 - p * 6).toFixed(2);
      if (cue !== lastCue) { scrollCue.style.opacity = cue; lastCue = cue; }
    }
  }

  /* ---------- main loop ---------- */
  function tick() {
    if (!document.hidden && !window.__eagleHold) {
      target = progress();
      display += (target - display) * 0.18;
      if (Math.abs(target - display) < 0.0006) display = target;
      // idle: nothing moved and nothing new loaded — skip all draw work
      if (display !== target || dirty) {
        draw(display);
        applyText(display);
        dirty = false;
      }
    }
    requestAnimationFrame(tick);
  }
  tick();

  // debug/test hook: force a progress value and draw synchronously
  window.__eagleScrub = function (p) {
    display = target = (p < 0 ? 0 : (p > 1 ? 1 : p));
    resize();
    dirty = true;
    draw(display);
    applyText(display);
    return display;
  };
})();
