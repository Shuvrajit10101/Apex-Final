# Apex Automations — website

Static marketing site for Apex Automations, an AI and automation services agency. It is four hand-written pages with no build step and no backend: an animated single-page home (`index.html`) covering services, process, an ROI calculator, packages, portfolio, FAQ and contact; a standalone service catalogue (`catalogue.html`); and privacy and terms pages. The contact form and every call-to-action hand off to a prefilled WhatsApp chat rather than posting to a server.

The hero is a scroll-scrubbed WebP sequence of an eagle drawn to a `<canvas>` (102 landscape frames on desktop and tablets, a separate 73-frame portrait sequence on phones held upright), choreographed with GSAP ScrollTrigger and Lenis, plus a Three.js particle logo on desktop. Mobile and `prefers-reduced-motion` visitors deliberately get the heavy effects disabled (no WebGL dust, no animated film grain, native scrolling) — see the commit history for that work.

## Stack

- Plain HTML, CSS and JavaScript — no bundler, no `package.json`, no framework
- CDN libraries: GSAP 3.12.5 + ScrollTrigger, Lenis 1.1.18, Three.js r128
- Google Fonts: DM Sans, Playfair Display
- Hosted as a static site on Vercel — `vercel.json` sets long-lived caching for `/assets/*` and adds `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` headers

## Running it

Everything is static, so any static file server works. The config checked into `.claude/launch.json` uses Python's:

```
py -m http.server 8765 --bind 127.0.0.1
```

then open <http://127.0.0.1:8765/>. Serve over HTTP rather than opening the file from disk — the hero loads the eagle as separate image requests (102 on desktop, 73 on a phone).

CSS and JS are referenced with cache-busting query strings (`style.css?v=22`, `main.js?v=17`); bump these when you change those files.

## Structure

- `index.html` — the home page, all sections in one file
- `catalogue.html` — service catalogue; `privacy.html`, `terms.html` — legal pages
- `css/style.css` — the entire stylesheet
- `js/eagle-scroll.js` — pinned hero, canvas frame scrubbing
- `js/particles.js` — Three.js particle logo (skipped on mobile and without WebGL)
- `js/main.js` — nav, scroll reveals, custom cursor, ROI calculator, WhatsApp form handoff
- `assets/` — logo, poster frame, eagle MP4 masters and four WebP frame sequences. `eagle-seq3` (16:9, desktop, tablets and phones held sideways) and `eagle-mobile` (720×1560 portrait, phones held upright) are referenced; `eagle-seq` and `eagle-seq2` are superseded and left in place (noted in the commit that replaced them). This is why the repo is ~36 MB. `/assets/*` is cached as immutable for a year, so re-rendered frames must go in a new folder rather than overwrite existing files.
