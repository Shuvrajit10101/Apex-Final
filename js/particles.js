/* ============================================================
   APEX AUTOMATIONS — Particle Eagle Engine (Three.js)
   Samples the logo image and assembles it from gold particles.
   Gracefully degrades if WebGL / Three.js are unavailable.
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('webgl');
  if (!canvas || !window.THREE) return;

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;

  // Mobile: skip WebGL entirely. A per-frame Three.js render is pure GPU
  // fill-rate cost on phones; the eagle film + CSS ambience carry the mood.
  if (isMobile) { canvas.style.display = 'none'; return; }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance'
    });
  } catch (e) {
    canvas.style.display = 'none';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(50, 1, 1, 3000);
  camera.position.z = 580; // far enough back that the whole eagle fits in frame

  /* Soft round sprite for every particle */
  function makeSprite() {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,244,210,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  var sprite = makeSprite();

  /* ---------- Ambient gold dust (always on) ---------- */
  var dustCount = isMobile ? 320 : 850;
  var dustGeo = new THREE.BufferGeometry();
  var dPos = new Float32Array(dustCount * 3);
  var dCol = new Float32Array(dustCount * 3);
  var dSeed = new Float32Array(dustCount);
  var goldTones = [
    [0.83, 0.66, 0.26], // base gold
    [0.91, 0.78, 0.42], // light gold
    [0.55, 0.45, 0.21], // deep gold
    [0.96, 0.93, 0.82]  // near white
  ];
  for (var i = 0; i < dustCount; i++) {
    dPos[i * 3] = (Math.random() - 0.5) * 1700;
    dPos[i * 3 + 1] = (Math.random() - 0.5) * 1000;
    dPos[i * 3 + 2] = (Math.random() - 0.5) * 700 - 100;
    var t = goldTones[(Math.random() * goldTones.length) | 0];
    dCol[i * 3] = t[0]; dCol[i * 3 + 1] = t[1]; dCol[i * 3 + 2] = t[2];
    dSeed[i] = Math.random() * Math.PI * 2;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
  var dustMat = new THREE.PointsMaterial({
    size: isMobile ? 3.4 : 2.8,
    map: sprite,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    sizeAttenuation: true
  });
  var dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  /* ---------- Eagle particles (built from the logo) ---------- */
  var eagleGroup = new THREE.Group();
  scene.add(eagleGroup);

  var eagle = null;        // THREE.Points
  var eagleData = null;    // { start, target, delay, wobble, count, positions }
  var formStart = -1;      // timestamp when assembly begins
  var FORM_DURATION = 2.6; // seconds for full assembly

  function buildEagle(img) {
    var SIZE = 300;
    var off = document.createElement('canvas');
    off.width = off.height = SIZE;
    var ctx = off.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    var data;
    try {
      data = ctx.getImageData(0, 0, SIZE, SIZE).data;
    } catch (e) {
      return; // tainted canvas (file://) — keep ambient dust only
    }

    var step = isMobile ? 3 : 2;
    var scale = isMobile ? 0.8 : 1.5; // mobile frustum is narrow — keep the full eagle visible
    var pts = [], cols = [];
    for (var y = 0; y < SIZE; y += step) {
      for (var x = 0; x < SIZE; x += step) {
        var idx = (y * SIZE + x) * 4;
        var a = data[idx + 3];
        if (a > 110) {
          var r = data[idx] / 255, g = data[idx + 1] / 255, b = data[idx + 2] / 255;
          var lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < 0.06) continue; // skip near-black pixels
          pts.push(
            (x - SIZE / 2) * scale + (Math.random() - 0.5) * 1.4,
            -(y - SIZE / 2) * scale + (Math.random() - 0.5) * 1.4 + 18,
            (Math.random() - 0.5) * 36
          );
          // push sampled colour toward warm gold so dark pixels still glow
          cols.push(
            Math.min(1, r * 0.55 + 0.45 * 0.85 + lum * 0.18),
            Math.min(1, g * 0.55 + 0.45 * 0.66 + lum * 0.14),
            Math.min(1, b * 0.55 + 0.45 * 0.24)
          );
        }
      }
    }
    var count = pts.length / 3;
    if (!count) return;

    var target = new Float32Array(pts);
    var colors = new Float32Array(cols);
    var start = new Float32Array(count * 3);
    var delay = new Float32Array(count);
    var wobble = new Float32Array(count);
    for (var p = 0; p < count; p++) {
      // start scattered on a big sphere shell
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      var rad = 520 + Math.random() * 420;
      start[p * 3] = rad * Math.sin(phi) * Math.cos(theta);
      start[p * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta) * 0.7;
      start[p * 3 + 2] = rad * Math.cos(phi) - 150;
      delay[p] = Math.random() * 0.55;
      wobble[p] = Math.random() * Math.PI * 2;
    }

    var geo = new THREE.BufferGeometry();
    // reduced-motion users get the eagle already assembled — no scatter flight
    var positions = new Float32Array(prefersReduced ? target : start);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    var mat = new THREE.PointsMaterial({
      size: isMobile ? 3.5 : 3.1,
      map: sprite,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true
    });
    eagle = new THREE.Points(geo, mat);
    eagleGroup.add(eagle);
    eagleData = { start: start, target: target, delay: delay, wobble: wobble, count: count, positions: positions };
    formStart = -1; // set on first animation frame after load
    if (prefersReduced) formed = true; // skip per-frame position updates entirely
  }

  // film mode: when the cinematic eagle video owns the hero, keep only the
  // ambient gold dust — a second (particle) eagle would fight the real one
  if (!document.querySelector('.hero-film')) {
    var logoImg = new Image();
    logoImg.onload = function () { buildEagle(logoImg); };
    logoImg.src = 'assets/logo-512.png'; // sampled at 300px — 512 source is plenty
  }

  /* ---------- Interaction state ---------- */
  var mouseX = 0, mouseY = 0, targetMX = 0, targetMY = 0;
  window.addEventListener('pointermove', function (e) {
    targetMX = e.clientX / window.innerWidth - 0.5;
    targetMY = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  var scrollRatio = 0;
  function onScroll() {
    scrollRatio = Math.min(window.scrollY / window.innerHeight, 1.6);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  var clock = new THREE.Clock();
  var formed = false;

  function animate() {
    requestAnimationFrame(animate);
    if (document.hidden) return;
    // stop rendering entirely once scrolled far past the hero
    if (scrollRatio >= 1.55) { return; }

    var t = clock.getElapsedTime();

    // smooth mouse
    mouseX += (targetMX - mouseX) * 0.045;
    mouseY += (targetMY - mouseY) * 0.045;

    // ambient dust drift (static under reduced motion)
    if (!prefersReduced) {
      dust.rotation.y = t * 0.012 + mouseX * 0.12;
      dust.rotation.x = mouseY * 0.08;
    }
    dustMat.opacity = 0.5 * Math.max(0, 1 - scrollRatio * 0.55);

    if (eagle && eagleData) {
      if (formStart < 0) formStart = t + 0.35; // slight hold before assembly
      var d = eagleData;
      var pos = d.positions;
      var elapsed = t - formStart;
      var allDone = true;

      // desktop keeps its living shimmer (formed stays false there);
      // mobile + reduced-motion freeze the buffer once assembly is done
      if (!formed) {
        for (var i = 0; i < d.count; i++) {
          var p = (elapsed - d.delay[i] * FORM_DURATION * 0.6) / (FORM_DURATION * 0.55);
          if (p < 0) p = 0; else if (p > 1) p = 1;
          if (p < 1) allDone = false;
          var e = easeOutCubic(p);
          var ix = i * 3;
          var x = d.start[ix] + (d.target[ix] - d.start[ix]) * e;
          var y = d.start[ix + 1] + (d.target[ix + 1] - d.start[ix + 1]) * e;
          var z = d.start[ix + 2] + (d.target[ix + 2] - d.start[ix + 2]) * e;
          if (p >= 1 && !isMobile && !prefersReduced) {
            // gentle living shimmer after formation
            var w = d.wobble[i];
            x += Math.sin(t * 0.9 + w) * 1.1;
            y += Math.cos(t * 0.8 + w * 1.3) * 1.1;
          }
          pos[ix] = x; pos[ix + 1] = y; pos[ix + 2] = z;
        }
        eagle.geometry.attributes.position.needsUpdate = true;
        if (allDone && (isMobile || prefersReduced)) formed = true; // freeze updates on mobile once formed
      }

      // mouse parallax + slow breathing (off under reduced motion)
      var breathe = 1;
      if (!prefersReduced) {
        eagleGroup.rotation.y = mouseX * 0.42 + Math.sin(t * 0.22) * 0.04;
        eagleGroup.rotation.x = -mouseY * 0.28;
        breathe = 1 + Math.sin(t * 0.7) * 0.008;
      }

      // scroll: lift, spread and fade the eagle away
      var s = Math.min(scrollRatio * 1.25, 1);
      var baseY = isMobile ? 24 : 46; // sit the eagle a touch high so the head clears the headline
      eagleGroup.position.y = baseY + s * 260;
      eagleGroup.position.z = s * -160;
      eagleGroup.scale.setScalar(breathe * (1 + s * 0.9));
      eagle.material.opacity = 0.95 * Math.max(0, 1 - s * 1.15);
    }

    if (!prefersReduced) {
      camera.position.x += (mouseX * 26 - camera.position.x) * 0.04;
      camera.position.y += (-mouseY * 18 - camera.position.y) * 0.04;
    }
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();
})();
