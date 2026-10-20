/* Down-Ballot Studio
   Election Day ads for statewide judicial races (one Supreme Court seat, three
   Court of Appeals seats) in every Meta and Google Display size, styled after
   the campaign literature: a headline up top, then the four judges' cutouts on
   blue circles popping out of a yellow band. Each size is laid out by fitting
   blocks into boxes, so a custom size works too. Drawn on a canvas so exports
   are pixel-exact PNG or JPG. */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STORE_KEY = 'judstudio.v2';
const GOOGLE_CAP = 150 * 1024;

/* ---------- sizes ---------- */
const PRESETS = [
  { key: 'meta45', group: 'Meta', name: 'Meta feed (4:5)', w: 1080, h: 1350, note: 'Default for Facebook/Instagram feed', big: true },
  { key: 'meta11', group: 'Meta', name: 'Meta feed (1:1)', w: 1080, h: 1080, note: 'Carousel, Marketplace', big: true },
  { key: 'story', group: 'Meta', name: 'Stories / Reels (9:16)', w: 1080, h: 1920, note: 'Text kept out of the top 14%, bottom 35% and sides 6%', big: true, safe: { t: .14, b: .35, l: .06, r: .06 } },
  { key: 'fblink', group: 'Meta', name: 'Facebook link ad', w: 1200, h: 628, big: true },
  { key: 'g300x250', group: 'Google', name: 'Inline rectangle', w: 300, h: 250 },
  { key: 'g336x280', group: 'Google', name: 'Large rectangle', w: 336, h: 280 },
  { key: 'g728x90', group: 'Google', name: 'Leaderboard', w: 728, h: 90 },
  { key: 'g970x250', group: 'Google', name: 'Billboard', w: 970, h: 250, big: true },
  { key: 'g160x600', group: 'Google', name: 'Wide skyscraper', w: 160, h: 600 },
  { key: 'g300x600', group: 'Google', name: 'Half-page', w: 300, h: 600, big: true },
  { key: 'g320x50', group: 'Google', name: 'Mobile banner', w: 320, h: 50 },
  { key: 'g320x100', group: 'Google', name: 'Large mobile banner', w: 320, h: 100 },
  { key: 'custom', group: 'Custom', name: 'Custom', w: 600, h: 500 },
];
const presetOf = key => {
  const p = PRESETS.find(x => x.key === key) || PRESETS[0];
  return p.key === 'custom' ? { ...p, w: state.custom.w, h: state.custom.h } : p;
};

/* ---------- state ---------- */
const DEFAULT_COLORS = { yellow: '#EFA531', blue: '#2F4A9B', white: '#FFFFFF', black: '#1A1A1A' };
const THEMES = { classic: 'White + yellow', blue: 'Blue + yellow', yellow: 'Yellow + blue', white: 'White + blue' };
const cand = (prefix, last, office, short) => ({ prefix, last, office, short, photo: null, zoom: 1, x: 0, y: 0 });
function freshState() {
  const sizes = {};
  PRESETS.forEach(p => { sizes[p.key] = { endorser: !!p.big, disclaimer: true, batch: p.key !== 'custom' }; });
  return {
    size: 'meta45', view: 'single', tab: 'cands',
    text: {
      kicker: 'Today is Election Day',
      headline: 'Your rights are on the ballot, and *you* could cast the *deciding vote* for *justice*.',
      short: 'Cast the *deciding vote* for *justice*.',
      sub: 'Missed early voting? There\'s still time. Vote at your assigned polling place, and vote all the way down the ballot.',
      cta: 'Polls open till 7:30 PM',
      info: 'Find your polling place at vote.nc.gov. In line by 7:30 PM? You can vote.',
      sticker: 'It\'s not too late!',
      disclaimer: 'Paid for by [Committee Name]',
    },
    candPhotos: true,
    candidates: [
      cand('Justice Anita', 'Earls', 'for Supreme Court', 'Supreme Court'),
      cand('Judge John', 'Arrowood', 'for Court of Appeals', 'Court of Appeals'),
      cand('Judge Tobias', 'Hampson', 'for Court of Appeals', 'Court of Appeals'),
      cand('Judge Christine', 'Walczyk', 'for Court of Appeals', 'Court of Appeals'),
    ],
    endorser: {
      photo: null, zoom: 1, x: 0, y: 0,
      tag: 'Endorsed by', name: 'Endorser Name', title: 'Title or organization',
      quote: "These four will protect our rights. I'm voting for every one of them.",
    },
    sizes,
    custom: { w: 600, h: 500 },
    colors: { ...DEFAULT_COLORS },
    theme: 'classic', themeAuto: false,
    pattern: 'none', sticker: false, guides: true,
    font: { kit: '', display: 'roc-grotesk-wide', dWeight: '500', hWeight: '800', cond: 'roc-grotesk-condensed', cWeight: '500', body: 'roc-grotesk' },
    exp: { format: 'png', cap: true, zip: true },
  };
}
function merge(base, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;
  for (const k of Object.keys(base)) {
    if (!(k in saved)) continue;
    const b = base[k], s = saved[k];
    if (b && typeof b === 'object' && !Array.isArray(b)) base[k] = merge(b, s);
    else if (Array.isArray(b)) { if (Array.isArray(s)) base[k] = b.map((x, i) => s[i] ? merge(x, s[i]) : x); }
    else if (b === null || typeof b === typeof s) base[k] = s;
  }
  return base;
}
let state = freshState();
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY));
  if (saved) state = merge(freshState(), saved);
  else { // carry photos and settings over from the first version's saved data
    const old = JSON.parse(localStorage.getItem('judstudio.v1'));
    if (old) {
      old.candidates?.forEach((c, i) => { if (c?.photo && state.candidates[i]) Object.assign(state.candidates[i], { photo: c.photo, zoom: c.zoom ?? 1, x: c.x ?? 0, y: c.y ?? 0 }); });
      state = merge(state, { endorser: old.endorser, sizes: old.sizes, custom: old.custom, exp: old.exp, font: { kit: old.font?.kit || '' } });
    }
  }
} catch {}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { $('#warnings').textContent = 'Your browser ran out of room to save the photos. Try smaller photos, or use Export → Save settings file.'; }
}

/* ---------- fonts ---------- */
// Roc Grotesk Wide for headlines and last names, Condensed for the small name lines.
// Until the Adobe Fonts project loads, Archivo's width axis stands in for both.
const FALLBACK = '"Archivo", sans-serif';
function font(role, size) {
  const f = state.font, px = `${Math.max(1, size).toFixed(2)}px`;
  switch (role) {
    case 'head': return `${f.dWeight} expanded ${px} "${f.display}", ${FALLBACK}`;
    case 'heavy': return `${f.hWeight} expanded ${px} "${f.display}", ${FALLBACK}`;
    case 'cond': return `${f.cWeight} condensed ${px} "${f.cond}", ${FALLBACK}`;
    case 'condBold': return `700 condensed ${px} "${f.cond}", ${FALLBACK}`;
    case 'medium': return `500 ${px} "${f.body}", ${FALLBACK}`;
    default: return `400 ${px} "${f.body}", ${FALLBACK}`;
  }
}
const ROLES = ['head', 'heavy', 'cond', 'condBold', 'medium', 'body'];
const kitFamilies = () => [...new Set([...document.fonts].map(f => f.family.replace(/["']/g, '')))].filter(f => f !== 'Archivo');
function loadKit() {
  const id = state.font.kit;
  $$('link[data-kit]').forEach(l => { if (l.dataset.kit !== id) l.remove(); });
  if (!id) { fontStatus(); return Promise.resolve(); }
  if ($(`link[data-kit="${id}"]`)) return warmFonts();
  return new Promise(res => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = `https://use.typekit.net/${id}.css`; l.dataset.kit = id;
    l.onload = () => warmFonts().then(res);
    l.onerror = () => { fontStatus('Could not load that Adobe Fonts project. Check the ID, and that this site\'s domain is added to the project.'); res(); };
    document.head.appendChild(l);
  });
}
function warmFonts() {
  return Promise.all(ROLES.map(r => document.fonts.load(font(r, 40)).catch(() => []))).then(() => { fontStatus(); redraw(); });
}
function fontStatus(msg) {
  const fams = kitFamilies(), f = state.font;
  $('#famList').innerHTML = [...new Set([...fams, 'roc-grotesk', 'roc-grotesk-wide', 'roc-grotesk-condensed', 'roc-grotesk-compressed', 'roc-grotesk-extrawide'])]
    .map(x => `<option value="${esc(x)}">`).join('');
  const has = fam => [...document.fonts].some(x => x.family.replace(/["']/g, '') === fam && x.status === 'loaded');
  const missing = [f.display, f.cond, f.body].filter(x => !has(x));
  $('#fontStatus').innerHTML = msg ? `<span class="warn">${esc(msg)}</span>`
    : !missing.length ? `✓ Using <b>${esc(f.display)}</b>, <b>${esc(f.cond)}</b> and <b>${esc(f.body)}</b>.`
    : f.kit ? `Project loaded${fams.length ? ` (families: ${fams.map(esc).join(', ')})` : ''}, but ${missing.map(x => `"${esc(x)}"`).join(', ')} isn't in it. Using Archivo in its place.`
    : 'No Adobe Fonts project yet. Using Archivo in place of Roc Grotesk.';
  document.documentElement.style.setProperty('--display', `"${f.display}", ${FALLBACK}`);
  document.documentElement.style.setProperty('--body', `"${f.body}", ${FALLBACK}, system-ui`);
}

/* ---------- colors ---------- */
function rgb(hex) { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
/* top = headline area, band = the strip the judges stand in, disc = the circles behind them */
function themeFor(P, forced) {
  const names = Object.keys(THEMES);
  let name = forced || state.theme;
  if (!forced && state.themeAuto) { const i = PRESETS.findIndex(p => p.key === P.key); name = names[(names.indexOf(state.theme) + Math.max(0, i)) % names.length]; }
  const { yellow, blue, white, black } = state.colors;
  const t = {
    classic: { top: white,  ink: black, hi: blue,   kick: blue,   kickInk: white, band: yellow, bandInk: black, disc: blue,   cta: blue,   ctaInk: white, ctaTop: blue,   ctaTopInk: white },
    blue:    { top: blue,   ink: white, hi: yellow, kick: yellow, kickInk: black, band: yellow, bandInk: black, disc: blue,   cta: blue,   ctaInk: white, ctaTop: yellow, ctaTopInk: black },
    yellow:  { top: yellow, ink: black, hi: blue,   kick: blue,   kickInk: white, band: blue,   bandInk: white, disc: yellow, cta: yellow, ctaInk: black, ctaTop: blue,   ctaTopInk: white },
    white:   { top: white,  ink: black, hi: blue,   kick: blue,   kickInk: white, band: blue,   bandInk: white, disc: yellow, cta: yellow, ctaInk: black, ctaTop: blue,   ctaTopInk: white },
  }[name] || {};
  return { name, ...t };
}

/* ---------- text: wrapping and fitting ---------- */
// "for *justice*." -> words made of segments; starred segments get the heavy font and accent color
function words(text) {
  const out = []; let hi = false, cur = null;
  for (const ch of text) {
    if (ch === '*') { hi = !hi; continue; }
    if (/[^\S ]/.test(ch)) { cur = null; continue; } // a no-break space keeps "7:30 PM" together
    if (!cur) out.push(cur = []);
    const last = cur[cur.length - 1];
    if (last && last.hi === hi) last.t += ch; else cur.push({ t: ch, hi });
  }
  return out;
}
function wrap(ctx, text, f, maxW, fHi) {
  ctx.font = f;
  const space = ctx.measureText(' ').width, lines = [];
  let over = false;
  for (const para of String(text).split('\n')) {
    let line = [], lw = 0;
    for (const segs of words(para)) {
      segs.forEach(s => { ctx.font = s.hi && fHi ? fHi : f; s.w = ctx.measureText(s.t).width; });
      const ww = segs.reduce((a, s) => a + s.w, 0);
      if (ww > maxW + .5) over = true;
      if (line.length && lw + space + ww > maxW) { lines.push({ words: line, w: lw }); line = []; lw = 0; }
      lw += (line.length ? space : 0) + ww; line.push({ segs, w: ww });
    }
    if (line.length) lines.push({ words: line, w: lw });
  }
  return { lines, over, space, maxW: lines.reduce((a, l) => Math.max(a, l.w), 0) };
}
const ASC = .76; // cap height-ish, as a share of font size
const blockH = (n, size, lh) => n ? size * (1 + (n - 1) * lh) : 0;
function drawLines(ctx, b, f, size, lh, x, y, w, align, color, hi) {
  ctx.textBaseline = 'alphabetic';
  b.lines.forEach((line, i) => {
    let cx = align === 'center' ? x + (w - line.w) / 2 : align === 'right' ? x + w - line.w : x;
    const base = y + size * ASC + i * size * lh;
    line.words.forEach(word => {
      word.segs.forEach(s => {
        const h = s.hi && hi;
        ctx.font = h ? hi.font : f; ctx.fillStyle = h ? hi.color : color;
        ctx.fillText(s.t, cx, base); cx += s.w;
      });
      cx += b.space;
    });
  });
}
// binary search the biggest value for which build() returns a layout
function search(build, lo, hi) {
  let best = build(lo);
  if (!best) return null;
  for (let i = 0; i < 18 && hi - lo > .1; i++) {
    const m = (lo + hi) / 2, r = build(m);
    if (r) { best = r; lo = m; } else hi = m;
  }
  return best;
}
/* A vertical stack of text items, all sized off one base size s.
   Optional items are dropped (last first) when keeping them would shrink
   the main text too much or leave them unreadably small. */
function fitStack(ctx, items, w, h, maxBase) {
  items = items.filter(it => it && it.text && String(it.text).trim());
  const build = (s, use) => {
    let total = 0, maxW = 0; const out = [];
    for (const it of use) {
      const size = Math.min(s * it.r, it.cap || 1e9), pad = it.pill ? size * .7 : 0;
      const f = font(it.role, size), fh = it.hi ? font(it.hiRole || it.role, size) : null, b = wrap(ctx, it.text, f, w - pad * 2, fh);
      if (b.over || b.lines.length > (it.maxLines || 99)) return null;
      const bh = blockH(b.lines.length, size, it.lh || 1.15) + (it.pill ? size * .7 : 0), gap = out.length ? s * (it.gap ?? .3) : 0;
      total += gap + bh; maxW = Math.max(maxW, b.maxW + pad * 2); out.push({ it, size, f, fh, b, h: bh, gap, pad });
    }
    return total <= h ? { s, out, total, w, maxW } : null;
  };
  const top = Math.min(maxBase || 1e9, h);
  const core = items.filter(i => !i.optional), coreFit = search(s => build(s, core), 2, top);
  let use = items.slice();
  for (;;) {
    const res = search(s => build(s, use), 2, top);
    const good = res && res.out.every(o => o.size >= (o.it.min || 0)) && (!coreFit || res.s >= coreFit.s * (use.length > core.length ? .58 : 0));
    if (good || use.length === core.length) return good ? res : coreFit;
    let drop = -1; use.forEach((it, i) => { if (it.optional) drop = i; });
    use = use.filter((_, i) => i !== drop);
  }
}
function drawStack(ctx, res, x, y, align) {
  if (!res) return;
  for (const o of res.out) {
    y += o.gap;
    const it = o.it, hi = it.hi ? { color: it.hi, font: o.fh } : null;
    if (it.pill) {
      const pw = o.b.maxW + o.pad * 2, px = align === 'center' ? x + (res.w - pw) / 2 : x;
      ctx.fillStyle = it.pill; ctx.beginPath(); ctx.roundRect(px, y, pw, o.h, o.h / 2); ctx.fill();
      drawLines(ctx, o.b, o.f, o.size, it.lh || 1.15, px + o.pad, y + o.size * .35, pw - o.pad * 2, 'center', it.color, hi);
    } else drawLines(ctx, o.b, o.f, o.size, it.lh || 1.15, x, y, res.w, align, it.color, hi);
    y += o.h;
  }
}

/* ---------- shapes ---------- */
function starPath(cx, cy, R, rot = -Math.PI / 2, points = 5, inner = .45) {
  const p = new Path2D();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + i * Math.PI / points, rr = i % 2 ? R * inner : R;
    i ? p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : p.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  p.closePath(); return p;
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- photos ---------- */
let photoImg = null;
function loadPhoto() {
  if (!state.endorser.photo) { photoImg = null; drawThumb(); redraw(); return; }
  const img = new Image();
  img.onload = () => { photoImg = img; drawThumb(); redraw(); };
  img.src = state.endorser.photo;
}
// endorser: a regular photo cropped to a circle with a ring
function drawPhoto(ctx, cx, cy, d, ring, ink) {
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
  const i = d * .9;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, i / 2, 0, Math.PI * 2); ctx.clip();
  if (photoImg) {
    const E = state.endorser, s = Math.max(i / photoImg.width, i / photoImg.height) * E.zoom;
    const iw = photoImg.width * s, ih = photoImg.height * s;
    ctx.drawImage(photoImg, cx - iw / 2 - E.x * (iw - i) / 2, cy - ih / 2 - E.y * (ih - i) / 2, iw, ih);
  } else {
    ctx.fillStyle = '#d9dbe3'; ctx.fillRect(cx - i / 2, cy - i / 2, i, i);
    ctx.fillStyle = rgba(ink, .25);
    ctx.beginPath(); ctx.arc(cx, cy - i * .1, i * .2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + i * .42, i * .36, i * .3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
/* Candidate cutouts (transparent PNGs, shoulders up) stand on a colored disc
   with the head popping out over the top of it, like the literature. */
const candImgs = [];
function loadCandPhotos() {
  state.candidates.forEach((c, i) => {
    if (!c.photo) { candImgs[i] = null; return; }
    if (candImgs[i]?.src === c.photo) return;
    const img = new Image();
    img.onload = () => { drawCandThumbs(); redraw(); };
    img.src = c.photo; candImgs[i] = img;
  });
  drawCandThumbs(); redraw();
}
const POP = 1.12; // cutout box height as a multiple of the disc diameter
function drawCutout(ctx, i, x, y, d, disc, ink) {
  const c = state.candidates[i], img = candImgs[i]?.complete ? candImgs[i] : null;
  const h = d * POP, R = d / 2, cx = x + R, cy = y + h - R;
  ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.rect(x - R * .15, y, d + R * .3, cy - y); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  if (img) {
    // fit by height so the top of the head touches the top of the box at zoom 1
    const s = h * c.zoom / img.height, iw = img.width * s, ih = img.height * s;
    ctx.drawImage(img, cx - iw / 2 + c.x * d * .5, y + h - ih + c.y * h * .5, iw, ih);
  } else {
    ctx.fillStyle = rgba(ink, .28);
    ctx.beginPath(); ctx.arc(cx, y + h * .36, d * .2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, y + h * .98, d * .4, h * .34, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ---------- blocks ---------- */
// Every block is fitted to a width and height first and reports its natural
// height (and width), then is drawn wherever the layout settles it.
const usePhotos = () => state.candPhotos;

function headerBlock(ctx, x, w, h, T, align, P, small) {
  const t = state.text, m = Math.min(P.w, P.h);
  const make = head => fitStack(ctx, [
    !small && { text: t.kicker.toUpperCase(), role: 'condBold', r: .5, cap: w * .045 + 8, min: 9, pill: T.kick, color: T.kickInk, maxLines: 1, lh: 1, gap: 0 },
    { text: head, role: 'head', hiRole: 'heavy', r: 1, lh: 1.04, color: T.ink, hi: T.hi, gap: .42 },
    !small && { text: t.sub, role: 'medium', r: .4, cap: w * .03 + 8, min: 9, color: T.ink, optional: true, lh: 1.3, gap: .5 },
  ], w, h, Math.min(w * .1, 110));
  // the full line from the literature where it reads well; the short one on small sizes
  const long = t.headline.trim() ? make(t.headline) : null, short = t.short.trim() ? make(t.short) : null;
  const res = long && (!short || long.s >= Math.max(15, m * .042)) ? long : short || long;
  return res && { h: res.total, w: res.maxW, draw: y => drawStack(ctx, res, x, y, align) };
}

/* The four judges: a cutout on a disc, then "Justice Anita" / EARLS / "for Supreme Court".
   Tries 4 across, 2x2 and one column; photos win when they fit with readable
   names, then the office line, then the first-name line, then the biggest size. */
function lineupBlock(ctx, x, w, h, T, ink) {
  const C = state.candidates;
  const fits = [];
  for (const cols of [4, 2, 1]) {
    if (cols === 1 && w > 260) continue;
    const gx = w * (cols === 4 ? .03 : .07), cw = (w - gx * (cols - 1)) / cols, rows = Math.ceil(C.length / cols);
    // biggest last-name size that fits the column
    const nMax = search(n => C.every(c => !wrap(ctx, c.last, font('heavy', n), cw).over) ? n : null, 4, 260);
    if (!nMax) continue;
    for (const photos of usePhotos() ? [true, false] : [false]) for (const pre of [true, false]) for (const off of [true, false]) {
      const build = (d, n) => {
        const p = n * .56;
        if (n > nMax + .01 || ((pre || off) && p < 8)) return null;
        if (photos && (d > cw * .96 || n < 10)) return null;
        const pb = pre ? C.map(c => wrap(ctx, c.prefix, font('cond', p), cw)) : null;
        if (pb && pb.some(b => b.over || b.lines.length > 2)) return null;
        let ob = null;
        if (off) {
          const mode = (k, ml) => { const o = C.map(c => wrap(ctx, (c[k] || c.office || c.short || '').trim(), font('cond', p), cw)); return o.every(b => !b.over && b.lines.length <= ml) ? o : null; };
          ob = mode('office', 1) || mode('short', 1) || mode('office', 2) || mode('short', 2);
          if (!ob) return null;
        }
        const ph = photos ? d * POP : 0;
        const cells = C.map((c, i) => {
          const pl = pb ? pb[i].lines.length : 0, ol = ob ? ob[i].lines.length : 0;
          return { pl, ol, h: ph + (photos ? n * .28 : 0) + (pl ? blockH(pl, p, 1.05) + p * .2 : 0) + n * .98 + (ol ? p * .25 + blockH(ol, p, 1.05) : 0) };
        });
        const rowH = []; for (let r = 0; r < rows; r++) rowH.push(Math.max(...cells.slice(r * cols, r * cols + cols).map(c => c.h)));
        const gy = n * (photos ? .9 : .7), total = rowH.reduce((a, b) => a + b, 0) + gy * (rows - 1);
        return total <= h ? { cols, gx, cw, rows, rowH, gy, total, d: photos ? d : 0, ph, n, p, pb, ob, photos, pre, off } : null;
      };
      // search() needs its low end to fit, so start where the smallest allowed text is
      const nLo = pre || off ? 8 / .56 : 6;
      const res = photos ? search(d => build(d, Math.min(nMax, d * .25)), Math.max(40, nLo / .25), Math.min(cw * .96, h))
        : search(n => build(0, n), nLo, nMax);
      if (res) fits.push(res);
    }
  }
  if (!fits.length) return null;
  const rank = f => (f.photos ? 4 : 0) + (f.off ? 2 : 0) + (f.pre ? 1 : 0);
  const top = Math.max(...fits.map(rank));
  const F = fits.filter(f => rank(f) === top).reduce((a, b) => ((b.photos ? b.d * b.n : b.n) > (a.photos ? a.d * a.n : a.n) ? b : a));
  const width = F.cols * F.cw + (F.cols - 1) * F.gx;
  return { h: F.total, w: width, bandTop: F.photos ? F.ph - F.d * .7 : -F.n * .6, draw: y => {
    let cy = y;
    for (let r = 0; r < F.rows; r++) {
      for (let col = 0; col < F.cols; col++) {
        const i = r * F.cols + col; if (i >= C.length) continue;
        const cx = x + (w - width) / 2 + col * (F.cw + F.gx);
        let ty = cy;
        if (F.photos) { drawCutout(ctx, i, cx + (F.cw - F.d) / 2, cy, F.d, T.disc, ink); ty += F.ph + F.n * .28; }
        if (F.pb) { drawLines(ctx, F.pb[i], font('cond', F.p), F.p, 1.05, cx, ty, F.cw, 'center', ink); ty += blockH(F.pb[i].lines.length, F.p, 1.05) + F.p * .2; }
        ctx.font = font('heavy', F.n); ctx.fillStyle = ink; ctx.textAlign = 'center';
        ctx.fillText(C[i].last, cx + F.cw / 2, ty + F.n * ASC); ctx.textAlign = 'left';
        ty += F.n * .98;
        if (F.ob) drawLines(ctx, F.ob[i], font('cond', F.p), F.p, 1.05, cx, ty + F.p * .25, F.cw, 'center', ink);
      }
      cy += F.rowH[r] + F.gy;
    }
  } };
}

// endorser: 'row' = photo beside the words, 'stack' = photo above them
function endBlock(ctx, x, w, h, T, ink, style) {
  const E = state.endorser, gap = Math.min(w, h) * .08;
  const items = [
    { text: E.tag.toUpperCase(), role: 'condBold', r: .55, min: 8, color: ink, optional: true, maxLines: 1, lh: 1, gap: 0 },
    { text: E.name, role: 'heavy', r: 1, lh: 1.02, color: ink, maxLines: 2, gap: .25 },
    { text: E.title, role: 'cond', r: .66, min: 8.5, color: ink, optional: true, lh: 1.1, maxLines: 2, gap: .2 },
    { text: E.quote ? `“${E.quote}”` : '', role: 'medium', r: .55, min: 9, color: ink, optional: true, lh: 1.3, gap: .5 },
  ];
  if (style === 'stack') {
    const d = Math.min(w * .8, h * .55), res = fitStack(ctx, items, w, h - d - gap, Math.min(w * .13, 46));
    return { h: d + (res ? gap + res.total : 0), w, draw: y => {
      drawPhoto(ctx, x + w / 2, y + d / 2, d, T.disc, ink);
      if (res) drawStack(ctx, res, x, y + d + gap, 'center');
    } };
  }
  const d = Math.min(h, w * .3), tw = Math.min(w - d - gap, w * .62), res = fitStack(ctx, items, tw, h, Math.min(tw * .09, 44));
  const bh = Math.max(d * .85, res ? res.total : 0), dd = Math.min(d, Math.max(bh, d * .85)), gw = dd + gap + (res ? res.maxW : 0);
  return { h: Math.max(dd, bh), w: gw, draw: y => {
    const H = Math.max(dd, bh), x0 = x + (w - gw) / 2;
    drawPhoto(ctx, x0 + dd / 2, y + H / 2, dd, T.disc, ink);
    if (res) drawStack(ctx, { ...res, w: res.maxW }, x0 + dd + gap, y + (H - res.total) / 2, 'left');
  } };
}

// the button, plus the polling-place line under it when there's room
function ctaBlock(ctx, x, w, h, fill, fillInk, ink, align, withInfo = true) {
  const text = state.text.cta.trim(), info = withInfo ? state.text.info.trim() : '';
  if (!text) return null;
  const build = (s, inc) => {
    const b = wrap(ctx, text, font('heavy', s), w - s * 1.8);
    if (b.over || b.lines.length > 2) return null;
    const ph = blockH(b.lines.length, s, 1.08) + s * 1.1, pw = b.maxW + s * 1.8;
    let tot = ph, ib = null, is = 0;
    if (inc) {
      is = s * .5; ib = wrap(ctx, info, font('medium', is), w);
      if (ib.over || ib.lines.length > 2) return null;
      tot += s * .45 + blockH(ib.lines.length, is, 1.25);
    }
    return tot <= h && pw <= w ? { s, b, ph, pw, h: tot, ib, is } : null;
  };
  const bare = search(s => build(s, false), 4, Math.min(h * .5, 52));
  const full = info ? search(s => build(s, true), 4, Math.min(h * .5, 52)) : null;
  const F = full && full.is >= 9 && bare && full.s >= bare.s * .6 ? full : bare;
  if (!F) return null;
  return { h: F.h, w: Math.max(F.pw, F.ib ? F.ib.maxW : 0), draw: y => {
    const px = align === 'center' ? x + (w - F.pw) / 2 : x;
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(px, y, F.pw, F.ph, F.ph / 2); ctx.fill();
    drawLines(ctx, F.b, font('heavy', F.s), F.s, 1.08, px + F.s * .9, y + F.s * .55, F.pw - F.s * 1.8, 'center', fillInk);
    if (F.ib) drawLines(ctx, F.ib, font('medium', F.is), F.is, 1.25, x, y + F.ph + F.s * .45, align === 'center' ? w : F.ib.maxW, align, ink);
  } };
}

function discBlock(ctx, x, w, size, ink, align) {
  const text = state.text.disclaimer.trim();
  ctx.font = font('medium', size);
  const tw = ctx.measureText(text).width, s = tw > w ? size * w / tw : size;
  return { h: s * 1.1, w: Math.min(tw, w), draw: y => {
    ctx.font = font('medium', s); ctx.fillStyle = ink; ctx.textBaseline = 'alphabetic';
    ctx.textAlign = align; ctx.fillText(text, align === 'center' ? x + w / 2 : x, y + s * ASC); ctx.textAlign = 'left';
  } };
}

/* ---------- layout ---------- */
function family(P, r) {
  if (P.h <= 120 || r.h / r.w < .2) return 'strip';
  if (r.h / r.w < .42) return 'cols';
  return r.h / r.w < .75 ? 'wide' : 'tall';
}
// stack rows down a column, spreading spare height evenly between them
function spread(rows, y0, h, gap) {
  rows = rows.filter(Boolean);
  const slack = h - rows.reduce((a, b) => a + b.h, 0) - gap * (rows.length - 1), extra = Math.max(0, slack) / (rows.length + 1);
  let y = y0 + extra;
  return rows.map(r => { const at = y; y += r.h + gap + extra; return at; });
}
/* Works out where every block goes. Returns the band (yellow strip) and the
   draw calls; render() paints the background and band first, then these. */
function plan(ctx, P, T) {
  const W = P.w, H = P.h, m = Math.min(W, H), cfg = state.sizes[P.key] || {};
  const pad = Math.round(clamp(m * .06, 5, 64));
  const r = P.safe ? { x: W * P.safe.l, y: H * P.safe.t, w: W * (1 - P.safe.l - P.safe.r), h: H * (1 - P.safe.t - P.safe.b) }
    : { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
  const fam = family(P, r), ops = [], put = (b, y) => b && ops.push(() => b.draw(y));
  const endOn = !!cfg.endorser, discOn = cfg.disclaimer && state.text.disclaimer.trim();
  let band = null, sticker = null;

  if (fam === 'tall' || fam === 'wide') {
    const gap = Math.round(m * (fam === 'tall' ? .035 : .03));
    const disc = discOn ? discBlock(ctx, r.x, r.w, clamp(H * .02, 10, 24), T.bandInk, 'center') : null;
    const avail = r.h - (disc ? disc.h + gap * .6 : 0);
    let hdr, endTop = null;
    if (fam === 'tall') {
      let hw = r.w;
      if (state.sticker && state.text.sticker.trim() && r.w >= 560) { const d = Math.min(avail * .2, r.w * .26); sticker = { d }; hw = r.w - d - gap; }
      hdr = headerBlock(ctx, r.x, hw, avail * (endOn ? .27 : .32), T, sticker ? 'left' : 'center', P, false);
    } else {
      const sw = endOn ? r.w * .36 : 0;
      hdr = headerBlock(ctx, r.x, r.w - sw - (sw ? gap : 0), avail * .36, T, 'left', P, false);
      if (endOn) endTop = endBlock(ctx, r.x + r.w - sw, sw, avail * .36, T, T.ink, 'row');
    }
    const cta = ctaBlock(ctx, r.x, r.w, clamp(avail * (fam === 'tall' ? .13 : .16), 30, 170), T.cta, T.ctaInk, T.bandInk, 'center');
    const endRow = fam === 'tall' && endOn ? endBlock(ctx, r.x, r.w, avail * .17, T, T.bandInk, r.w < 420 ? 'stack' : 'row') : null;
    const top = endTop ? { h: Math.max(hdr?.h || 0, endTop.h), draw: y => { const hh = Math.max(hdr?.h || 0, endTop.h); hdr?.draw(y + (hh - hdr.h) / 2); endTop.draw(y + (hh - endTop.h) / 2); } } : hdr;
    const used = [top, cta, endRow].filter(Boolean);
    const lu = lineupBlock(ctx, r.x, r.w, avail - used.reduce((a, b) => a + b.h, 0) - gap * used.length - avail * .04, T, T.bandInk);
    const rows = [top, lu, endRow, cta].filter(Boolean), ys = spread(rows, r.y, avail, gap);
    rows.forEach((row, i) => put(row, ys[i]));
    if (lu) { const ly = ys[rows.indexOf(lu)] + lu.bandTop; band = { x: 0, y: ly, w: W, h: H - ly }; }
    else if (cta) { const cy = ys[rows.indexOf(cta)] - gap; band = { x: 0, y: cy, w: W, h: H - cy }; }
    if (disc) put(disc, r.y + r.h - disc.h);
    if (sticker && hdr) sticker = { d: sticker.d, cx: r.x + r.w - sticker.d / 2, cy: ys[0] + top.h / 2 };
  } else {
    // side by side: headline (and button) on the left, judges in the band on the right
    const gap = Math.round(fam === 'strip' ? Math.max(5, r.h * .16) : m * .07);
    const leftW = r.w * (fam === 'strip' ? .3 : endOn ? .33 : .38);
    const ctaCol = fam === 'strip' && r.w >= 560 && state.text.cta.trim() ? r.w * .2 : 0;
    const endW = fam === 'cols' && endOn ? r.w * .17 : 0;
    const discH = discOn ? clamp(H * (fam === 'strip' ? .15 : .06), 7, 16) : 0;
    const lh = r.h - (discH ? discH + gap * .3 : 0);
    // left column on the headline color
    let left = [];
    const shortStrip = fam === 'strip' && lh < 46;
    if (shortStrip) left = [ctaBlock(ctx, r.x, leftW, lh, T.ctaTop, T.ctaTopInk, T.ink, 'left', false)];
    else {
      const ctaH = ctaCol ? 0 : lh * (fam === 'strip' ? .36 : .3);
      const hdr = headerBlock(ctx, r.x, leftW, lh - ctaH - (ctaH ? gap * .4 : 0), T, 'left', P, fam === 'strip');
      const cta = ctaH ? ctaBlock(ctx, r.x, leftW, ctaH, T.ctaTop, T.ctaTopInk, T.ink, 'left', fam !== 'strip') : null;
      left = [hdr, cta];
    }
    const lb = left.filter(Boolean);
    spread(lb, r.y, lh, gap * .4).forEach((y, i) => put(lb[i], y));
    if (discH) put(discBlock(ctx, r.x, leftW, discH * .8, T.ink, 'left'), r.y + r.h - discH);
    // the band: everything right of the left column, full height
    const bx = r.x + leftW + gap * .5;
    band = { x: bx, y: 0, w: W - bx, h: H };
    const lx = bx + gap * .5, lw = r.x + r.w - lx - endW - ctaCol - (endW || ctaCol ? gap : 0);
    const lu = lineupBlock(ctx, lx, lw, r.h, T, T.bandInk);
    if (lu) put(lu, r.y + (r.h - lu.h) / 2);
    if (endW) { const e = endBlock(ctx, r.x + r.w - endW, endW, r.h, T, T.bandInk, 'stack'); if (e) put(e, r.y + (r.h - e.h) / 2); }
    if (ctaCol) { const c = ctaBlock(ctx, r.x + r.w - ctaCol, ctaCol, r.h, T.cta, T.ctaInk, T.bandInk, 'center', false); if (c) put(c, r.y + (r.h - c.h) / 2); }
  }
  return { fam, band, ops, sticker, m };
}

/* ---------- drawing ---------- */
function drawPattern(ctx, P, T, L) {
  const W = P.w, H = P.h, m = L.m, rand = rng(W * 7 + H * 13), tone = rgba(T.ink, .06);
  if (state.pattern === 'burst') {
    const cx = W / 2, cy = L.band ? L.band.y : H, R = Math.hypot(W, H), n = 32;
    ctx.fillStyle = tone;
    for (let i = 0; i < n; i += 2) {
      const a0 = i * Math.PI * 2 / n, a1 = (i + 1) * Math.PI * 2 / n;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); ctx.fill();
    }
  } else if (state.pattern === 'halftone') {
    const R = Math.max(W, H) * .5, step = clamp(m * .035, 5, 36);
    ctx.fillStyle = rgba(T.hi, .3);
    for (let y = 0; y < R; y += step) for (let x = W - R; x < W + step; x += step) {
      const dd = Math.hypot(W - x, y) / R;
      if (dd < 1) { ctx.beginPath(); ctx.arc(x, y, step * .42 * (1 - dd), 0, Math.PI * 2); ctx.fill(); }
    }
  } else if (state.pattern === 'stars') {
    const n = clamp(Math.round(W * H / (m * m) * 6), 5, 36);
    ctx.fillStyle = tone;
    for (let i = 0; i < n; i++) ctx.fill(starPath(rand() * W, rand() * H, m * (.025 + rand() * .05), -Math.PI / 2 + (rand() - .5) * .6));
  }
}
function drawSticker(ctx, S, T) {
  const R = S.d / 2, fill = T.top === state.colors.yellow ? state.colors.blue : state.colors.yellow, ink = fill === state.colors.blue ? state.colors.white : state.colors.black;
  ctx.save(); ctx.translate(S.cx, S.cy); ctx.rotate(-.16);
  ctx.fillStyle = fill; ctx.fill(starPath(0, 0, R, 0, 14, .84));
  const res = fitStack(ctx, [{ text: state.text.sticker, role: 'heavy', r: 1, lh: 1, color: ink }], R * 1.4, R * 1.1, R * .45);
  if (res) drawStack(ctx, res, -R * .7, -res.total / 2, 'center');
  ctx.restore();
}

function render(ctx, P, k, editor) {
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const T = themeFor(P), L = plan(ctx, P, T);
  ctx.fillStyle = T.top; ctx.fillRect(0, 0, P.w, P.h);
  drawPattern(ctx, P, T, L);
  if (L.band) { ctx.fillStyle = T.band; ctx.fillRect(L.band.x, L.band.y, L.band.w, L.band.h); }
  L.ops.forEach(f => f());
  if (L.sticker?.cx) drawSticker(ctx, L.sticker, T);
  if (editor && P.safe && state.guides) {
    const s = P.safe;
    ctx.fillStyle = 'rgba(255,40,40,.16)';
    ctx.fillRect(0, 0, P.w, P.h * s.t); ctx.fillRect(0, P.h * (1 - s.b), P.w, P.h * s.b);
    ctx.fillRect(0, P.h * s.t, P.w * s.l, P.h * (1 - s.t - s.b)); ctx.fillRect(P.w * (1 - s.r), P.h * s.t, P.w * s.r, P.h * (1 - s.t - s.b));
    ctx.strokeStyle = 'rgba(255,40,40,.9)'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    ctx.strokeRect(P.w * s.l, P.h * s.t, P.w * (1 - s.l - s.r), P.h * (1 - s.t - s.b)); ctx.setLineDash([]);
  }
}

/* ---------- views ---------- */
let drawQueued = false;
function redraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; state.view === 'grid' ? drawGrid() : drawSingle(); });
}
function drawSingle() {
  const P = presetOf(state.size), wrapEl = $('#canvasWrap'), c = $('#ad');
  const aw = wrapEl.clientWidth - 8, ah = wrapEl.clientHeight - 8;
  const k = Math.max(.05, Math.min(aw / P.w, ah / P.h, 3)), dpr = window.devicePixelRatio || 1;
  c.width = Math.round(P.w * k * dpr); c.height = Math.round(P.h * k * dpr);
  c.style.width = `${Math.round(P.w * k)}px`; c.style.height = `${Math.round(P.h * k)}px`;
  render(c.getContext('2d'), P, k * dpr, true);
  $('#sizeInfo').innerHTML = `<b>${esc(P.name)}</b> · ${P.w}×${P.h}px · shown at ${Math.round(k * 100)}%${P.note ? ` · ${esc(P.note)}` : ''}`;
  const warn = [];
  if (state.sizes[P.key]?.endorser && !state.endorser.photo) warn.push('No endorser photo yet: add one on the Endorser tab.');
  if (usePhotos() && state.candidates.some(c => !c.photo)) warn.push('Some candidates have no photo yet.');
  if (/\[|endorser name/i.test(JSON.stringify([state.text, state.endorser.name]))) warn.push('Placeholder text is still in the ad.');
  if (!state.sizes[P.key]?.disclaimer || !state.text.disclaimer.trim()) warn.push('No disclaimer on this size.');
  $('#warnings').textContent = warn.join(' ');
}
function drawGrid() {
  const grid = $('#adGrid'), dpr = window.devicePixelRatio || 1;
  if (grid.children.length !== PRESETS.length) {
    grid.innerHTML = PRESETS.map(p => `<button class="ad-card" data-key="${p.key}"><canvas></canvas><div><b>${esc(p.name)}</b> <span></span></div></button>`).join('');
    $$('.ad-card', grid).forEach(b => b.onclick = () => { state.size = b.dataset.key; setView('single'); renderSizeList(); save(); });
  }
  PRESETS.forEach((p0, i) => {
    const P = presetOf(p0.key), card = grid.children[i], c = $('canvas', card);
    const k = Math.min(1, 380 / P.w, 340 / P.h);
    c.width = Math.round(P.w * k * dpr); c.height = Math.round(P.h * k * dpr);
    c.style.width = `${Math.round(P.w * k)}px`; c.style.height = `${Math.round(P.h * k)}px`;
    render(c.getContext('2d'), P, k * dpr, false);
    $('span', card).textContent = `${P.w}×${P.h}`;
    card.classList.toggle('active', P.key === state.size);
  });
}
function setView(v) {
  state.view = v;
  $$('.seg[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('#stageSingle').hidden = v !== 'single'; $('#stageGrid').hidden = v !== 'grid';
  redraw();
}

/* ---------- UI ---------- */
const getPath = p => p.split('.').reduce((o, k) => o?.[k], state);
function setPath(p, v) { const ks = p.split('.'), last = ks.pop(); ks.reduce((o, k) => o[k], state)[last] = v; }
function bindAll() {
  $$('[data-bind]').forEach(el => {
    const p = el.dataset.bind, v = getPath(p);
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
    const out = $(`[data-out="${p}"]`); if (out) out.textContent = Number(v).toFixed(2);
    el.oninput = el.onchange = () => {
      const nv = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? +el.value : el.value;
      setPath(p, nv); if (out) out.textContent = Number(nv).toFixed(2);
      if (p.startsWith('font.')) warmFonts();
      if (p.startsWith('colors.') || p === 'theme') renderThemes();
      if (p.startsWith('endorser.')) drawThumb();
      if (p.startsWith('candidates.')) drawCandThumbs();
      save(); redraw();
    };
  });
}
function renderCandFields() {
  const labels = ['Supreme Court', 'Court of Appeals', 'Court of Appeals', 'Court of Appeals'];
  $('#candFields').innerHTML = state.candidates.map((c, i) => `<div class="cand"><b>${i + 1} · ${labels[i]}</b>
    <div class="row2"><label>Title + first name<input type="text" data-bind="candidates.${i}.prefix"></label>
    <label>Last name<input type="text" data-bind="candidates.${i}.last"></label></div>
    <div class="row2"><label>Office line<input type="text" data-bind="candidates.${i}.office"></label>
    <label>Short office <span class="hint">(small sizes)</span><input type="text" data-bind="candidates.${i}.short"></label></div>
    <div class="cand-photo"><canvas width="120" height="140" data-thumb="${i}"></canvas>
      <div><div class="btn-row"><label class="ghost file-btn sm">${c.photo ? 'Replace photo' : 'Upload photo'}<input type="file" accept="image/*" data-photo="${i}" hidden></label>
        ${c.photo ? `<button class="ghost sm" data-clear="${i}">Remove</button>` : ''}</div>
      <div class="prop"><span>Zoom</span><input type="range" min="0.5" max="2" step="0.01" data-bind="candidates.${i}.zoom"><output data-out="candidates.${i}.zoom"></output></div>
      <div class="prop"><span>Left / right</span><input type="range" min="-1" max="1" step="0.01" data-bind="candidates.${i}.x"><output data-out="candidates.${i}.x"></output></div>
      <div class="prop"><span>Up / down</span><input type="range" min="-1" max="1" step="0.01" data-bind="candidates.${i}.y"><output data-out="candidates.${i}.y"></output></div></div></div></div>`).join('');
  $$('#candFields input[data-photo]').forEach(el => el.onchange = e => {
    const f = e.target.files[0]; if (f) readCutout(f, url => { Object.assign(state.candidates[+el.dataset.photo], { photo: url, zoom: 1, x: 0, y: 0 }); save(); renderCandFields(); bindAll(); loadCandPhotos(); });
  });
  $$('#candFields button[data-clear]').forEach(b => b.onclick = () => { state.candidates[+b.dataset.clear].photo = null; save(); renderCandFields(); bindAll(); loadCandPhotos(); });
}
function drawCandThumbs() {
  const T = themeFor(presetOf(state.size));
  $$('#candFields canvas[data-thumb]').forEach(c => {
    const ctx = c.getContext('2d'); ctx.fillStyle = T.band; ctx.fillRect(0, 0, c.width, c.height);
    drawCutout(ctx, +c.dataset.thumb, 10, 8, 100, T.disc, T.bandInk);
  });
}
/* keep transparency, trim empty margins so every cutout's shoulders sit on the bottom edge */
function readCutout(file, done) {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const s = Math.min(1, 700 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    let out = c;
    if (x1 >= 0 && (x0 > 0 || y0 > 0 || x1 < c.width - 1 || y1 < c.height - 1)) {
      out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
      out.getContext('2d').drawImage(c, -x0, -y0);
    }
    URL.revokeObjectURL(url); done(out.toDataURL('image/png'));
  };
  img.onerror = () => alert('That file could not be opened as an image.');
  img.src = url;
}
function renderSizeList() {
  let html = '', grp = '';
  for (const p0 of PRESETS) {
    const P = presetOf(p0.key), cfg = state.sizes[P.key];
    if (P.group !== grp) { grp = P.group; html += `<li class="grp">${grp}</li>`; }
    const k = 22 / Math.max(P.w, P.h);
    html += `<li class="item${P.key === state.size ? ' active' : ''}"><input type="checkbox" data-batch="${P.key}" ${cfg.batch ? 'checked' : ''} title="Include in batch export">
      <button data-key="${P.key}"><i class="shape" style="width:${Math.max(3, P.w * k)}px;height:${Math.max(3, P.h * k)}px"></i>
      <span><span class="nm">${esc(P.name)}</span>${cfg.endorser ? ' <span class="tagp">● photo</span>' : ''}</span><span class="dim">${P.w}×${P.h}</span></button></li>`;
  }
  $('#sizeList').innerHTML = html;
  $$('#sizeList button[data-key]').forEach(b => b.onclick = () => { state.size = b.dataset.key; save(); renderSizeList(); setView('single'); });
  $$('#sizeList input[data-batch]').forEach(b => b.onchange = () => { state.sizes[b.dataset.batch].batch = b.checked; save(); renderSizeToggles(); });
  $('#customBox').hidden = state.size !== 'custom';
}
function renderSizeToggles() {
  for (const [id, field] of [['#discSizes', 'disclaimer'], ['#endSizes', 'endorser'], ['#batchSizes', 'batch']]) {
    $(id).innerHTML = PRESETS.map(p => `<label><input type="checkbox" data-f="${field}" data-k="${p.key}" ${state.sizes[p.key][field] ? 'checked' : ''}> ${esc(p.name)}</label>`).join('');
  }
  $$('.bx-list input[data-f]').forEach(b => b.onchange = () => { state.sizes[b.dataset.k][b.dataset.f] = b.checked; save(); renderSizeList(); renderSizeToggles(); redraw(); });
  const n = PRESETS.filter(p => state.sizes[p.key].batch).length;
  $('#bxCount').textContent = `${n} checked`;
}
$$('[data-all]').forEach(b => b.onclick = () => {
  const [field, v] = b.dataset.all.split(':');
  PRESETS.forEach(p => {
    state.sizes[p.key][field] = v === 'big' ? !!p.big : v === 'meta' ? p.group === 'Meta' : v === 'google' ? p.group === 'Google' : v === '1';
  });
  save(); renderSizeList(); renderSizeToggles(); redraw();
});
function renderThemes() {
  $('#themePick').innerHTML = Object.entries(THEMES).map(([k, label]) => {
    const t = themeFor(null, k);
    return `<button data-theme="${k}" class="${k === state.theme ? 'active' : ''}" style="background:linear-gradient(${t.top} 55%, ${t.band} 55%);color:${t.ink}"><span>${label}</span></button>`;
  }).join('');
  $$('#themePick button').forEach(b => b.onclick = () => { state.theme = b.dataset.theme; save(); renderThemes(); redraw(); });
}
$('#resetColors').onclick = () => { state.colors = { ...DEFAULT_COLORS }; save(); bindAll(); renderThemes(); redraw(); };

$$('.seg[data-view]').forEach(b => b.onclick = () => { setView(b.dataset.view); save(); });
$$('.tab').forEach(b => b.onclick = () => {
  state.tab = b.dataset.tab;
  $$('.tab').forEach(x => x.classList.toggle('active', x === b));
  $$('.tab-body').forEach(x => { x.hidden = x.dataset.body !== b.dataset.tab; });
  save();
});
for (const [id, k] of [['#customW', 'w'], ['#customH', 'h']]) {
  $(id).oninput = e => { const v = Math.round(+e.target.value); if (v >= 50 && v <= 4000) { state.custom[k] = v; save(); renderSizeList(); redraw(); } };
}

/* endorser photo: downscale on upload so it fits in browser storage */
$('#photoFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const s = Math.min(1, 1100 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    Object.assign(state.endorser, { photo: c.toDataURL('image/jpeg', .9), zoom: 1, x: 0, y: 0 });
    URL.revokeObjectURL(url); save(); bindAll(); loadPhoto();
  };
  img.onerror = () => alert('That file could not be opened as an image.');
  img.src = url; e.target.value = '';
};
$('#photoClear').onclick = () => { state.endorser.photo = null; save(); loadPhoto(); };
function drawThumb() {
  const c = $('#photoThumb'), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const T = themeFor(presetOf(state.size));
  drawPhoto(ctx, c.width / 2, c.height / 2, c.width, T.disc, T.ink);
}

$('#kitLoad').onclick = () => {
  const raw = $('#kitInput').value.trim(), m = raw.match(/typekit\.net\/([a-z0-9]+)\.css/i) || raw.match(/^([a-z0-9]{5,12})$/i);
  if (raw && !m) { fontStatus('That doesn\'t look like an Adobe Fonts project ID (something like "abc1def").'); return; }
  state.font.kit = m ? m[1] : ''; $('#kitInput').value = state.font.kit; save(); loadKit();
};
document.fonts.addEventListener('loadingdone', () => { fontStatus(); redraw(); });

/* ---------- export ---------- */
const toBlob = (c, type, q) => new Promise(res => c.toBlob(res, type, q));
async function exportBlob(P) {
  const c = document.createElement('canvas'); c.width = P.w; c.height = P.h;
  render(c.getContext('2d'), P, 1, false);
  let blob = await toBlob(c, state.exp.format === 'jpg' ? 'image/jpeg' : 'image/png', .92);
  if (P.group === 'Google' && state.exp.cap && blob.size > GOOGLE_CAP) {
    for (let q = .92; q >= .4; q -= .06) { blob = await toBlob(c, 'image/jpeg', q); if (blob.size <= GOOGLE_CAP) break; }
  }
  return blob;
}
const fileName = (P, blob) => `judicial-ad_${P.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}_${P.w}x${P.h}.${blob.type === 'image/jpeg' ? 'jpg' : 'png'}`;
function download(blob, name) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
$('#exportOne').onclick = async () => { const P = presetOf(state.size), b = await exportBlob(P); download(b, fileName(P, b)); };
$('#exportBatch').onclick = async () => {
  const list = PRESETS.filter(p => state.sizes[p.key].batch).map(p => presetOf(p.key));
  if (!list.length) { alert('Check at least one size.'); return; }
  const prog = $('#progress'), bar = $('div', prog), lab = $('span', prog), btn = $('#exportBatch');
  prog.hidden = false; btn.disabled = true;
  const files = [];
  try {
    for (const [i, P] of list.entries()) {
      lab.textContent = `${P.name} (${i + 1}/${list.length})`; bar.style.width = `${(i / list.length) * 100}%`;
      const blob = await exportBlob(P), name = fileName(P, blob);
      if (state.exp.zip) files.push({ path: `${P.group.toLowerCase()}/${name}`, blob });
      else { download(blob, name); await new Promise(r => setTimeout(r, 350)); }
    }
    if (files.length) download(await makeZip(files), `judicial-ads_${files.length}-sizes.zip`);
    bar.style.width = '100%'; lab.textContent = `Done: ${list.length} files`;
  } catch (err) { lab.textContent = `Export failed: ${err.message}`; }
  btn.disabled = false;
};

/* minimal ZIP writer (stored, no compression: PNG and JPG are already compressed) */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [], d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let offset = 0;
  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.path), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(lh.buffer, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch.buffer, name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + (b.byteLength ?? b.length), 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

$('#saveSettings').onclick = () => download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'down-ballot-studio-settings.json');
$('#loadSettings').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { state = merge(freshState(), JSON.parse(await f.text())); save(); initUI(); }
  catch { alert('That file could not be read as settings.'); }
  e.target.value = '';
};
$('#resetAll').onclick = () => { if (confirm('Reset all text, candidates, photo, colors and size settings?')) { state = freshState(); save(); initUI(); } };

/* ---------- boot ---------- */
function initUI() {
  renderCandFields(); bindAll(); renderSizeList(); renderSizeToggles(); renderThemes();
  $('#customW').value = state.custom.w; $('#customH').value = state.custom.h;
  $('#kitInput').value = state.font.kit;
  $$('.tab').find(t => t.dataset.tab === state.tab)?.click();
  setView(state.view); loadPhoto(); loadCandPhotos(); fontStatus(); loadKit();
}
window.addEventListener('resize', redraw);
initUI();
warmFonts();
// for headless checks: render a preset to a data URL
window.__renderSize = key => { const P = presetOf(key), c = document.createElement('canvas'); c.width = P.w; c.height = P.h; render(c.getContext('2d'), P, 1, false); return c.toDataURL('image/png'); };
})();
