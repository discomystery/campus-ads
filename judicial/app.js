/* Down-Ballot Studio
   Static ads for statewide judicial races (one Supreme Court seat, three Court
   of Appeals seats) in every Meta and Google Display size. Each size is laid
   out from the same content by fitting text into boxes, so a custom size works
   too. Drawn on a canvas so exports are pixel-exact PNG or JPG. */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STORE_KEY = 'judstudio.v1';
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
const DEFAULT_COLORS = { red: '#E63329', white: '#FFFFFF', blue: '#1B2A78', yellow: '#FFD100' };
const THEMES = ['blue', 'red', 'yellow', 'white'];
function freshState() {
  const sizes = {};
  PRESETS.forEach(p => { sizes[p.key] = { endorser: !!p.big, disclaimer: true, batch: p.key !== 'custom' }; });
  return {
    size: 'meta45', view: 'single', tab: 'cands',
    text: {
      kicker: 'Today is Election Day',
      headline: "Don't skip the *judges!*",
      sub: 'Missed early voting? There\'s still time. Vote at your assigned polling place, and go all the way down the ballot.',
      cardTitle: 'Statewide judicial races',
      cta: 'Polls open till 7:30\u00a0PM',
      info: 'Find your polling place at vote.nc.gov. In line by 7:30\u00a0PM? You can vote.',
      sticker: 'It\'s not too late!',
      disclaimer: 'Paid for by [Committee Name]',
    },
    upper: true,
    candidates: [
      { seat: 'N.C. Supreme Court · Associate Justice', short: 'Supreme Court', name: 'Candidate One' },
      { seat: 'N.C. Court of Appeals · Seat 1', short: 'Court of Appeals', name: 'Candidate Two' },
      { seat: 'N.C. Court of Appeals · Seat 2', short: 'Court of Appeals', name: 'Candidate Three' },
      { seat: 'N.C. Court of Appeals · Seat 3', short: 'Court of Appeals', name: 'Candidate Four' },
    ],
    endorser: {
      photo: null, zoom: 1, x: 0, y: 0,
      tag: 'Endorsed by', name: 'Endorser Name', title: 'Title or organization',
      quote: "These four will protect our rights. I'm voting for every one of them.",
    },
    sizes,
    custom: { w: 600, h: 500 },
    colors: { ...DEFAULT_COLORS },
    theme: 'blue', themeAuto: false,
    pattern: 'stars', stripes: true, sticker: true, guides: true,
    font: { kit: '', display: 'roc-grotesk-wide', dWeight: '800', body: 'roc-grotesk' },
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
try { state = merge(freshState(), JSON.parse(localStorage.getItem(STORE_KEY))); } catch {}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { $('#warnings').textContent = 'Your browser ran out of room to save the photo. Try a smaller photo, or use Export → Save settings file.'; }
}

/* ---------- fonts ---------- */
const FALLBACK = { display: '"Archivo Black", "Archivo", sans-serif', body: '"Archivo", sans-serif' };
const WEIGHT = { body: 400, medium: 500, bold: 700, black: 800 };
function font(role, size) {
  const f = state.font, px = Math.max(1, size).toFixed(2);
  if (role === 'display') return `${f.dWeight} ${px}px "${f.display}", ${FALLBACK.display}`;
  return `${WEIGHT[role]} ${px}px "${f.body}", ${FALLBACK.body}`;
}
const kitFamilies = () => [...new Set([...document.fonts].map(f => f.family.replace(/["']/g, '')))]
  .filter(f => /roc|grotesk/i.test(f) || ![ 'Archivo', 'Archivo Black' ].includes(f));
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
  const f = state.font, loads = [`${f.dWeight} 40px "${f.display}"`, ...Object.values(WEIGHT).map(w => `${w} 40px "${f.body}"`),
    `${f.dWeight} 40px "Archivo Black"`, ...Object.values(WEIGHT).map(w => `${w} 40px "Archivo"`)];
  return Promise.all(loads.map(x => document.fonts.load(x).catch(() => []))).then(() => { fontStatus(); redraw(); });
}
function fontStatus(msg) {
  const fams = kitFamilies();
  $('#famList').innerHTML = [...new Set([...fams, 'roc-grotesk', 'roc-grotesk-wide', 'roc-grotesk-condensed', 'roc-grotesk-compressed', 'roc-grotesk-extrawide'])]
    .map(f => `<option value="${esc(f)}">`).join('');
  const has = fam => [...document.fonts].some(x => x.family.replace(/["']/g, '') === fam && x.status === 'loaded');
  const f = state.font;
  const ok = has(f.display) && has(f.body);
  $('#fontStatus').innerHTML = msg ? `<span class="warn">${esc(msg)}</span>`
    : ok ? `✓ Using <b>${esc(f.display)}</b> + <b>${esc(f.body)}</b>.`
    : state.font.kit ? `Project loaded${fams.length ? ` (families: ${fams.map(esc).join(', ')})` : ''}, but "${esc(has(f.display) ? f.body : f.display)}" isn't in it. Using Archivo in its place.`
    : 'No Adobe Fonts project yet. Using Archivo in place of Roc Grotesk.';
  document.documentElement.style.setProperty('--display', `"${f.display}", ${FALLBACK.display}`);
  document.documentElement.style.setProperty('--body', `"${f.body}", ${FALLBACK.body}, system-ui`);
}

/* ---------- colors ---------- */
function rgb(hex) { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
function themeFor(P) {
  let name = state.theme;
  if (state.themeAuto) { const i = PRESETS.findIndex(p => p.key === P.key); name = THEMES[(THEMES.indexOf(state.theme) + Math.max(0, i)) % 4]; }
  const { red, white, blue, yellow } = state.colors;
  return {
    blue:   { name, bg: blue,   ink: white, accent: yellow, accentInk: blue,  alt: red,  altInk: white, card: white, cardInk: blue,  oval: red,    shadow: red,  stripes: [red, white],  star: yellow, tag: red,  tagInk: white, cta: yellow, ctaInk: blue, tone: rgba(white, .09) },
    red:    { name, bg: red,    ink: white, accent: yellow, accentInk: blue,  alt: blue, altInk: white, card: white, cardInk: blue,  oval: red,    shadow: blue, stripes: [blue, white], star: yellow, tag: blue, tagInk: white, cta: yellow, ctaInk: blue, tone: rgba(white, .13) },
    yellow: { name, bg: yellow, ink: blue,  accent: red,    accentInk: white, alt: blue, altInk: white, card: white, cardInk: blue,  oval: red,    shadow: blue, stripes: [red, white],  star: red,    tag: blue, tagInk: white, cta: blue,   ctaInk: white, tone: rgba(white, .4) },
    white:  { name, bg: white,  ink: blue,  accent: yellow, accentInk: blue,  alt: red,  altInk: white, card: blue,  cardInk: white, oval: yellow, shadow: red,  stripes: [red, blue],   star: red,    tag: red,  tagInk: white, cta: red,    ctaInk: white, tone: rgba(blue, .07) },
  }[name];
}

/* ---------- text: wrapping and fitting ---------- */
// "Don't skip the *judges!*" -> words made of segments, starred segments highlighted
function words(text) {
  const out = []; let hi = false, cur = null;
  for (const ch of text) {
    if (ch === '*') { hi = !hi; continue; }
    if (/[^\S\u00a0]/.test(ch)) { cur = null; continue; } // a no-break space keeps "7:30 PM" together
    if (!cur) out.push(cur = []);
    const last = cur[cur.length - 1];
    if (last && last.hi === hi) last.t += ch; else cur.push({ t: ch, hi });
  }
  return out;
}
function wrap(ctx, text, f, maxW) {
  ctx.font = f;
  const space = ctx.measureText(' ').width, lines = [];
  let over = false;
  for (const para of String(text).split('\n')) {
    let line = [], lw = 0;
    for (const segs of words(para)) {
      segs.forEach(s => { s.w = ctx.measureText(s.t).width; });
      const ww = segs.reduce((a, s) => a + s.w, 0);
      if (ww > maxW + .5) over = true;
      if (line.length && lw + space + ww > maxW) { lines.push({ words: line, w: lw }); line = []; lw = 0; }
      lw += (line.length ? space : 0) + ww; line.push({ segs, w: ww });
    }
    if (line.length) lines.push({ words: line, w: lw });
  }
  return { lines, over, space, maxW: lines.reduce((a, l) => Math.max(a, l.w), 0) };
}
const ASC = .8; // cap height-ish, as a share of font size
const blockH = (n, size, lh) => n ? size * (1 + (n - 1) * lh) : 0;
function drawLines(ctx, b, f, size, lh, x, y, w, align, color, hi) {
  ctx.font = f; ctx.textBaseline = 'alphabetic';
  b.lines.forEach((line, i) => {
    let cx = align === 'center' ? x + (w - line.w) / 2 : align === 'right' ? x + w - line.w : x;
    const base = y + size * ASC + i * size * lh;
    line.words.forEach((word, wi) => {
      word.segs.forEach((s, si) => {
        if (s.hi && hi) {
          const nextHi = si === word.segs.length - 1 && line.words[wi + 1]?.segs[0].hi;
          const p = size * .1, sk = size * .08, top = base - size * ASC - p * .9, bot = base + size * .14;
          const x0 = cx - p, x1 = cx + s.w + (nextHi ? b.space : 0) + p;
          ctx.fillStyle = hi.fill;
          ctx.beginPath(); ctx.moveTo(x0 + sk, top); ctx.lineTo(x1 + sk, top); ctx.lineTo(x1 - sk, bot); ctx.lineTo(x0 - sk, bot); ctx.closePath(); ctx.fill();
          ctx.fillStyle = hi.ink;
        } else ctx.fillStyle = color;
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
    let total = 0; const out = [];
    for (const it of use) {
      const size = Math.min(s * it.r, it.cap || 1e9), pad = it.pill ? size * .62 : 0;
      const f = font(it.role, size), b = wrap(ctx, it.text, f, w - pad * 2);
      if (b.over || b.lines.length > (it.maxLines || 99)) return null;
      const bh = blockH(b.lines.length, size, it.lh || 1.15) + (it.pill ? size * .62 : 0), gap = out.length ? s * (it.gap ?? .3) : 0;
      total += gap + bh; out.push({ it, size, f, b, h: bh, gap, pad });
    }
    return total <= h ? { s, out, total, w } : null;
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
    const it = o.it;
    if (it.pill) {
      const pw = o.b.maxW + o.pad * 2, px = align === 'center' ? x + (res.w - pw) / 2 : x;
      ctx.fillStyle = it.pill; ctx.beginPath(); ctx.roundRect(px, y, pw, o.h, o.h / 2); ctx.fill();
      drawLines(ctx, o.b, o.f, o.size, it.lh || 1.15, px + o.pad, y + o.size * .31, pw - o.pad * 2, 'center', it.color, it.hi);
    } else drawLines(ctx, o.b, o.f, o.size, it.lh || 1.15, x, y, res.w, align, it.color, it.hi);
    y += o.h;
  }
}

/* ---------- shapes ---------- */
function rrect(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }
function shadowFill(ctx, path, fill, shadow, off) {
  ctx.save(); ctx.translate(off, off); ctx.fillStyle = shadow; ctx.fill(path); ctx.restore();
  ctx.fillStyle = fill; ctx.fill(path);
}
function starPath(cx, cy, R, rot = -Math.PI / 2, points = 5, inner = .45) {
  const p = new Path2D();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + i * Math.PI / points, rr = i % 2 ? R * inner : R;
    i ? p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : p.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  p.closePath(); return p;
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function waveStripes(ctx, x, y, w, h, colors, n, amp, wl, phase) {
  for (let i = 0; i < n; i++) {
    const top = y + i * h / n;
    ctx.beginPath(); ctx.moveTo(x, y + h + amp * 2);
    for (let xx = x; xx <= x + w + 8; xx += 8) ctx.lineTo(xx, top + amp * Math.sin((xx / wl) * Math.PI * 2 + phase));
    ctx.lineTo(x + w + 8, y + h + amp * 2); ctx.closePath();
    ctx.fillStyle = colors[i % colors.length]; ctx.fill();
  }
}

/* ---------- photo ---------- */
let photoImg = null;
function loadPhoto() {
  if (!state.endorser.photo) { photoImg = null; drawThumb(); redraw(); return; }
  const img = new Image();
  img.onload = () => { photoImg = img; drawThumb(); redraw(); };
  img.src = state.endorser.photo;
}
function drawPhoto(ctx, cx, cy, d, T) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.clip();
  if (photoImg) {
    const E = state.endorser, s = Math.max(d / photoImg.width, d / photoImg.height) * E.zoom;
    const iw = photoImg.width * s, ih = photoImg.height * s;
    ctx.drawImage(photoImg, cx - iw / 2 - E.x * (iw - d) / 2, cy - ih / 2 - E.y * (ih - d) / 2, iw, ih);
  } else {
    ctx.fillStyle = T.card; ctx.fillRect(cx - d / 2, cy - d / 2, d, d);
    ctx.fillStyle = rgba(T.cardInk, .22);
    ctx.beginPath(); ctx.arc(cx, cy - d * .1, d * .2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + d * .42, d * .36, d * .3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ---------- layout ---------- */
function family(P, r) {
  if (P.h <= 120 || r.h / r.w < .2) return 'strip';
  return r.h / r.w < .75 ? 'wide' : 'tall';
}
const split = (r, side, size, gap = 0) => {
  const a = side === 'top' ? { ...r, h: size } : side === 'bottom' ? { ...r, y: r.y + r.h - size, h: size }
    : side === 'left' ? { ...r, w: size } : { ...r, x: r.x + r.w - size, w: size };
  const b = side === 'top' ? { ...r, y: r.y + size + gap, h: r.h - size - gap } : side === 'bottom' ? { ...r, h: r.h - size - gap }
    : side === 'left' ? { ...r, x: r.x + size + gap, w: r.w - size - gap } : { ...r, w: r.w - size - gap };
  return [a, b];
};
/* Splits the ad into boxes. Tall sizes only get a first guess here; placeTall()
   then hands the space the header and button don't use to the middle. */
function layout(P) {
  const W = P.w, H = P.h, m = Math.min(W, H), cfg = state.sizes[P.key] || {};
  const pad = Math.round(clamp(m * .055, 5, 60));
  let r = P.safe ? { x: W * P.safe.l, y: H * P.safe.t, w: W * (1 - P.safe.l - P.safe.r), h: H * (1 - P.safe.t - P.safe.b) }
    : { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
  const fam = family(P, r), L = { fam, pad, m };
  const endorser = !!cfg.endorser, t = state.text;
  // the stripes band sits along the bottom edge; keep text off it
  L.band = state.stripes && fam !== 'strip' ? (P.safe ? H * P.safe.b * .8 : Math.round(clamp(H * (fam === 'wide' ? .075 : .06), 10, 90))) : 0;
  if (L.band && !P.safe) r.h -= Math.max(0, L.band * .75 - pad * .4);
  if (cfg.disclaimer && t.disclaimer.trim()) {
    const dh = Math.round(clamp(H * (fam === 'strip' ? .17 : .028), fam === 'strip' ? 8.5 : 12, 34));
    [L.disc, r] = split(r, 'bottom', dh, fam === 'strip' ? Math.max(2, dh * .2) : dh * .5);
  }
  const hasCta = !!t.cta.trim();
  if (fam === 'tall') {
    L.gap = Math.round(m * .035); L.body = r; L.endorser = endorser; L.side = endorser && r.w >= 420;
    if (hasCta) L.cta = split(r, 'bottom', clamp(r.h * (t.info.trim() ? .13 : .09), 26, 150))[0];
    L.header = split(r, 'top', r.h * (endorser ? (L.side ? .34 : .26) : r.w < 420 ? .27 : .36))[0];
    if (state.sticker && t.sticker.trim() && L.header.w >= 560) {
      const d = Math.min(L.header.h * 1.05, L.header.w * .3);
      L.sticker = { cx: L.header.x + L.header.w - d / 2, cy: L.header.y + L.header.h * .45, d };
      L.header.w -= d + L.gap * .5;
    }
  } else if (fam === 'wide') {
    const gap = Math.round(m * .07);
    let cols = r;
    if (endorser) [L.end, cols] = split(cols, 'left', r.w * .2, gap);
    let head;
    [head, L.cands] = split(cols, 'left', cols.w * (endorser ? .48 : .5), gap);
    L.headCol = head; L.colGap = gap * .5;
    if (hasCta) [L.cta, head] = split(head, 'bottom', clamp(head.h * (t.info.trim() ? .3 : .2), 16, 130), L.colGap);
    L.header = head;
  } else {
    const gap = Math.max(4, Math.round(r.h * .14));
    if (endorser) [L.end, r] = split(r, 'left', Math.min(r.h, r.w * .2), gap);
    if (hasCta && r.w >= 560) [L.cta, r] = split(r, 'right', r.w * .2, gap);
    [L.header, L.cands] = split(r, 'left', r.w * .34, gap);
    // too short for headline + button: on Election Day the button (polls close) wins
    if (hasCta && !L.cta && L.header.h < 54) { L.cta = L.header; L.header = null; }
    else if (hasCta && !L.cta && L.header.h >= 54) { [L.cta, L.header] = split(L.header, 'bottom', L.header.h * .32, L.header.h * .06); L.headCol = { ...L.header, h: L.header.h + L.cta.h + L.header.h * .06 }; L.colGap = L.header.h * .06; }
  }
  return L;
}

/* ---------- drawing ---------- */
// Every block is fitted to a box first and reports its natural height,
// then drawn at whatever y the layout settles on.
function drawBg(ctx, P, T, L) {
  const W = P.w, H = P.h, m = L.m;
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
  const rand = rng(W * 7 + H * 13);
  if (state.pattern === 'burst') {
    const cx = W * .82, cy = H * .18, R = Math.hypot(W, H), n = 28;
    ctx.fillStyle = T.tone;
    for (let i = 0; i < n; i += 2) {
      const a0 = i * Math.PI * 2 / n, a1 = (i + 1) * Math.PI * 2 / n;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); ctx.fill();
    }
  } else if (state.pattern === 'halftone') {
    const R = Math.max(W, H) * .55, step = clamp(m * .04, 5, 40);
    ctx.fillStyle = rgba(T.alt, .6);
    for (let y = 0; y < R; y += step) for (let x = W - R; x < W + step; x += step) {
      const dd = Math.hypot(W - x, y) / R;
      if (dd < 1) { ctx.beginPath(); ctx.arc(x, y, step * .42 * (1 - dd), 0, Math.PI * 2); ctx.fill(); }
    }
  } else if (state.pattern === 'stars') {
    const n = clamp(Math.round(W * H / (m * m) * 7), 5, 40);
    ctx.fillStyle = T.tone;
    for (let i = 0; i < n; i++) ctx.fill(starPath(rand() * W, rand() * H, m * (.025 + rand() * .05), -Math.PI / 2 + (rand() - .5) * .6));
  }
  if (L.band) {
    const n = 4, h = L.band, amp = h / n * .45;
    waveStripes(ctx, 0, H - h, W, h + 2, [...T.stripes, ...T.stripes], n, amp, Math.max(W * .55, 160), .6);
  }
}

function headerBlock(ctx, r, T, L) {
  const t = state.text, big = r.w * .028 + 6, strip = L.fam === 'strip';
  const hl = state.upper ? t.headline.toUpperCase() : t.headline;
  // Election Day ads: the "today" tag always shows; a banner too small for a button
  // carries the button's text (polls close) as the tag instead
  const kick = strip ? null
    : { text: t.kicker, pill: T.tag, color: T.tagInk, r: r.w < 420 ? .42 : .26 };
  const res = fitStack(ctx, [
    kick && { text: kick.text.toUpperCase(), role: 'black', r: kick.r, cap: big + 4, pill: kick.pill, color: kick.color, maxLines: 2, lh: 1.1, gap: 0 },
    { text: hl, role: 'display', r: 1, lh: .98, color: T.ink, hi: { fill: T.accent, ink: T.accentInk }, gap: .3 },
    { text: strip ? '' : t.sub, role: 'medium', r: .32, cap: big + 9, min: 8.5, color: T.ink, optional: true, lh: 1.28, gap: .32 },
  ], r.w, r.h, Math.min(r.w * (strip ? .3 : .19), 200));
  return res && { h: res.total, draw: y => drawStack(ctx, res, r.x, y, 'left') };
}

function buildCands(ctx, r, n, cols, seats, title) {
  const m = n * .5;
  if (seats && m < 6.5) return null;
  const ts = clamp(n * .42, 6.5, 40);
  if (title && n * .42 < 6.5) return null;
  const pad = n * .62, gapX = n * .9, gapY = n * .7, titleH = title ? ts * 2.1 : 0;
  const ow = n * 1.15, oh = n * .74, og = n * .48;
  const cellW = (r.w - pad * 2 - gapX * (cols - 1)) / cols, tw = cellW - ow - og;
  if (tw <= 4) return null;
  const names = state.candidates.map(c => wrap(ctx, c.name, font('black', n), tw));
  if (names.some(nb => nb.over || nb.lines.length > 2)) return null;
  // same office style on every row: full on one line, else short on one line, else either on two
  let offices = names.map(() => null);
  if (seats) {
    const tryMode = (key, maxLines) => {
      const out = state.candidates.map(c => {
        const t = (c[key].trim() || c.seat.trim() || c.short.trim()).toUpperCase();
        return t ? wrap(ctx, t, font('bold', m), tw) : { lines: [] };
      });
      return out.every(b => !b.over && b.lines.length <= maxLines) ? out : null;
    };
    offices = tryMode('seat', 1) || tryMode('short', 1) || tryMode('seat', 2) || tryMode('short', 2);
    if (!offices) return null;
  }
  const cells = names.map((nb, i) => {
    const sb = offices[i]?.lines.length ? offices[i] : null, sh = sb ? blockH(sb.lines.length, m, 1.15) + m * .45 : 0;
    return { nb, sb, sh, h: sh + blockH(nb.lines.length, n, 1.02) };
  });
  const rows = Math.ceil(cells.length / cols), rowH = [];
  for (let i = 0; i < rows; i++) rowH.push(Math.max(...cells.slice(i * cols, i * cols + cols).map(c => c.h)));
  const total = titleH + pad * 2 + rowH.reduce((a, b) => a + b, 0) + gapY * (rows - 1);
  return total <= r.h ? { n, m, ts, pad, gapX, gapY, titleH, ow, oh, og, cellW, cols, rows, rowH, cells, total, title, seats } : null;
}
/* Office lines win whenever they fit at a readable size; then the card title;
   then whichever column count gives the biggest names. */
function fitCands(ctx, r, allowTitle) {
  const ar = r.w / r.h, colsOpts = [1, 2, 4].filter(c => c === 1 || (c === 2 && ar > .85) || (c === 4 && ar > 2.6));
  const fits = [];
  for (const seats of [true, false]) for (const title of allowTitle && state.text.cardTitle.trim() ? [true, false] : [false]) for (const cols of colsOpts) {
    const res = search(n => buildCands(ctx, r, n, cols, seats, title), seats ? 13 : title ? 15.5 : 4, Math.min(r.h * .3, r.w * (cols === 1 ? .16 : .1), 76));
    if (res) fits.push(res);
  }
  const top = list => list.reduce((a, b) => (!a || b.n > a.n ? b : a), null);
  const withSeats = fits.filter(f => f.seats && f.m >= 7);
  const pool = withSeats.length ? withSeats : fits.filter(f => !f.seats);
  const best = top(pool), titled = top(pool.filter(f => f.title));
  return titled && best && titled.n >= best.n * .75 ? titled : best;
}
function candsBlock(ctx, r, T, L) {
  const F = fitCands(ctx, r, L.fam !== 'strip');
  if (!F) return null;
  return { h: F.total, draw: y => {
    const x = r.x, w = r.w, rad = F.n * .4;
    shadowFill(ctx, rrect(x, y, w, F.total, rad), T.card, T.shadow, Math.max(2, F.n * .16));
    if (F.title) {
      ctx.fillStyle = T.alt; ctx.beginPath(); ctx.roundRect(x, y, w, F.titleH, [rad, rad, 0, 0]); ctx.fill();
      const label = state.text.cardTitle.toUpperCase();
      ctx.font = font('black', F.ts);
      const tw = ctx.measureText(label).width, ts = tw > w - F.pad * 2 ? F.ts * (w - F.pad * 2) / tw : F.ts;
      ctx.save(); ctx.font = font('black', ts); ctx.fillStyle = T.altInk; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + F.titleH / 2 + ts * .05); ctx.restore();
    }
    let cy = y + F.titleH + F.pad;
    for (let row = 0; row < F.rows; row++) {
      if (row) {
        ctx.save(); ctx.strokeStyle = rgba(T.cardInk, .28); ctx.lineWidth = Math.max(1, F.n * .045); ctx.setLineDash([F.n * .2, F.n * .16]);
        ctx.beginPath(); ctx.moveTo(x + F.pad, cy - F.gapY / 2); ctx.lineTo(x + w - F.pad, cy - F.gapY / 2); ctx.stroke(); ctx.restore();
      }
      for (let col = 0; col < F.cols; col++) {
        const cell = F.cells[row * F.cols + col];
        if (!cell) continue;
        const cx = x + F.pad + col * (F.cellW + F.gapX), tx = cx + F.ow + F.og, tw = F.cellW - F.ow - F.og;
        if (cell.sb) drawLines(ctx, cell.sb, font('bold', F.m), F.m, 1.15, tx, cy, tw, 'left', rgba(T.cardInk, .72));
        const ny = cy + cell.sh;
        drawLines(ctx, cell.nb, font('black', F.n), F.n, 1.02, tx, ny, tw, 'left', T.cardInk);
        // a filled-in ballot oval, lined up with the name
        ctx.save(); ctx.translate(cx + F.ow / 2, ny + F.n * ASC / 2);
        ctx.fillStyle = T.oval; ctx.beginPath(); ctx.ellipse(F.n * .03, F.n * .02, F.ow * .44, F.oh * .42, -.12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = T.cardInk; ctx.lineWidth = Math.max(1, F.n * .075);
        ctx.beginPath(); ctx.ellipse(0, 0, F.ow / 2, F.oh / 2, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      cy += F.rowH[row] + F.gapY;
    }
  } };
}

function photoDisc(ctx, cx, cy, d, T) {
  const ring = Math.max(1.5, d * .045);
  ctx.fillStyle = T.shadow; ctx.beginPath(); ctx.arc(cx + ring * 1.3, cy + ring * 1.3, d / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
  drawPhoto(ctx, cx, cy, d - ring * 2, T);
  if (d >= 90) {
    const sr = d * .13;
    shadowFill(ctx, starPath(cx + d * .36, cy - d * .36, sr, -Math.PI / 2 + .2), T.alt, T.shadow === T.alt ? T.accent : T.shadow, Math.max(1, sr * .12));
  }
}
function endBlock(ctx, r, T, L) {
  const E = state.endorser, gap = Math.min(r.w, r.h) * .07;
  const items = [
    { text: E.tag.toUpperCase(), role: 'black', r: .5, min: 7, pill: T.tag, color: T.tagInk, optional: true, maxLines: 1, lh: 1.1, gap: 0 },
    { text: E.name, role: 'black', r: 1, lh: 1.02, color: T.ink, maxLines: 2, gap: .3 },
    { text: E.title, role: 'medium', r: .62, min: 8, color: T.ink, optional: true, lh: 1.2, maxLines: 2, gap: .2 },
    { text: E.quote ? `“${E.quote}”` : '', role: 'medium', r: .6, min: 9, color: T.ink, optional: true, lh: 1.28, gap: .5 },
  ];
  if (L.fam === 'strip') {
    const d = Math.min(r.w, r.h);
    return { h: d, draw: y => photoDisc(ctx, r.x + r.w / 2, y + d / 2, d, T) };
  }
  if (r.h >= r.w * .95) { // photo on top, words underneath
    const d = Math.min(r.w * .82, r.h * .58), res = fitStack(ctx, items, r.w, r.h - d - gap, Math.min(r.w * .12, 52));
    return { h: d + (res ? gap + res.total : 0), draw: y => {
      photoDisc(ctx, r.x + r.w / 2, y + d / 2, d, T);
      if (res) drawStack(ctx, res, r.x, y + d + gap, 'center');
    } };
  }
  const d = Math.min(r.h * .92, r.w * .42), tw = r.w - d - gap, res = fitStack(ctx, items, tw, r.h, Math.min(tw * .12, 52));
  const h = Math.max(d, res ? res.total : 0);
  return { h, draw: y => {
    photoDisc(ctx, r.x + d / 2, y + h / 2, d, T);
    if (res) drawStack(ctx, res, r.x + d + gap, y + (h - res.total) / 2, 'left');
  } };
}

// the button, plus the polling-place line under it when there's room
function ctaBlock(ctx, r, T, L) {
  const text = state.text.cta.trim(), info = L.fam === 'strip' ? '' : state.text.info.trim(), strip = L.fam === 'strip';
  const build = (s, withInfo) => {
    const b = wrap(ctx, text, font('black', s), r.w - s * 1.6);
    if (b.over || b.lines.length > 2) return null;
    const ph = blockH(b.lines.length, s, 1.05) + s * 1.1, w = b.maxW + s * 1.6;
    let h = ph, ib = null, is = 0;
    if (withInfo) {
      is = s * .46; ib = wrap(ctx, info, font('medium', is), r.w);
      if (ib.over || ib.lines.length > 2) return null;
      h += s * .4 + blockH(ib.lines.length, is, 1.25);
    }
    return h <= r.h && w <= r.w ? { s, b, ph, h, w, ib, is } : null;
  };
  const bare = search(s => build(s, false), 4, Math.min(r.h * .5, 64));
  const full = info ? search(s => build(s, true), 4, Math.min(r.h * .5, 64)) : null;
  const F = full && full.is >= 8.5 && bare && full.s >= bare.s * .6 ? full : bare;
  if (!F) return null;
  const tall = L.fam === 'tall';
  return { h: F.h, draw: y => {
    const x = tall ? r.x + (r.w - F.w) / 2 : r.x;
    shadowFill(ctx, rrect(x, y, F.w, F.ph, F.ph / 2), T.cta, T.shadow, strip ? Math.max(1.5, F.s * .12) : Math.max(2, F.s * .16));
    drawLines(ctx, F.b, font('black', F.s), F.s, 1.05, x + F.s * .8, y + F.s * .55, F.w - F.s * 1.6, 'center', T.ctaInk);
    if (F.ib) drawLines(ctx, F.ib, font('medium', F.is), F.is, 1.25, r.x, y + F.ph + F.s * .4, r.w, tall ? 'center' : 'left', T.ink);
  } };
}

function drawSticker(ctx, L, T) {
  const { cx, cy, d } = L.sticker, R = d / 2;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.18);
  shadowFill(ctx, starPath(0, 0, R, 0, 14, .82), T.accent, T.shadow, R * .06);
  const res = fitStack(ctx, [{ text: state.text.sticker.toUpperCase(), role: 'display', r: 1, lh: 1, color: T.accentInk }], R * 1.4, R * 1.1, R * .5);
  if (res) drawStack(ctx, res, -R * .7, -res.total / 2, 'center');
  ctx.restore();
}

function drawDisclaimer(ctx, L, T) {
  const r = L.disc, text = state.text.disclaimer.trim();
  let s = r.h * .66;
  ctx.font = font('bold', s);
  const tw = ctx.measureText(text).width, padX = s * .55;
  if (tw + padX * 2 > r.w) { s *= (r.w - padX * 2) / tw; ctx.font = font('bold', s); }
  const w = ctx.measureText(text).width + padX * 2, x = L.fam === 'tall' ? r.x + (r.w - w) / 2 : r.x;
  ctx.fillStyle = state.colors.white; ctx.fillRect(x, r.y, w, r.h);
  if (T.bg === state.colors.white) { ctx.strokeStyle = state.colors.blue; ctx.lineWidth = 1; ctx.strokeRect(x + .5, r.y + .5, w - 1, r.h - 1); }
  ctx.fillStyle = state.colors.blue; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, r.y + r.h / 2 + s * .04);
  ctx.textBaseline = 'alphabetic';
}

/* Tall sizes: fit the header and button, give the middle everything left,
   then spread any spare height evenly between the rows. */
function placeTall(ctx, L, T) {
  const r = L.body, gap = L.gap;
  const hdr = headerBlock(ctx, L.header, T, L), cta = L.cta ? ctaBlock(ctx, L.cta, T, L) : null;
  const used = (hdr ? hdr.h + gap : 0) + (cta ? cta.h + gap : 0);
  const mid = { x: r.x, y: r.y, w: r.w, h: r.h - used };
  const midRows = [];
  if (L.endorser && L.side) {
    const [cr, er] = split(mid, 'left', mid.w * .6, gap);
    const c = candsBlock(ctx, cr, T, L), e = endBlock(ctx, er, T, L), h = Math.max(c?.h || 0, e?.h || 0);
    midRows.push({ h, draw: y => { c?.draw(y + (h - c.h) / 2); e?.draw(y + (h - e.h) / 2); } });
  } else if (L.endorser) {
    const [er, cr] = split(mid, 'top', mid.h * .34, gap);
    const e = endBlock(ctx, er, T, L);
    const c = candsBlock(ctx, { ...cr, y: 0, h: mid.h - (e ? e.h + gap : 0) }, T, L);
    if (e) midRows.push(e);
    if (c) midRows.push(c);
  } else { const c = candsBlock(ctx, mid, T, L); if (c) midRows.push(c); }
  const rows = [hdr, ...midRows, cta].filter(Boolean);
  const slack = r.h - rows.reduce((a, b) => a + b.h, 0) - gap * (rows.length - 1);
  const extra = Math.max(0, slack) / (rows.length + 1);
  let y = r.y + extra;
  for (const row of rows) { row.draw(y); y += row.h + gap + extra; }
  if (L.sticker && hdr) L.sticker.cy = r.y + extra + hdr.h * .5;
}
// other sizes: each block centered in its own box; header + button centered together
function placeBoxes(ctx, L, T) {
  const center = (b, r) => b && b.draw(r.y + (r.h - b.h) / 2);
  const hdr = L.header && headerBlock(ctx, L.header, T, L), cta = L.cta ? ctaBlock(ctx, L.cta, T, L) : null;
  if (L.headCol && cta) {
    const col = L.headCol, h = (hdr ? hdr.h + L.colGap : 0) + cta.h, y = col.y + (col.h - h) / 2;
    hdr?.draw(y); cta.draw(y + h - cta.h);
  } else { center(hdr, L.header); if (cta) center(cta, L.cta); }
  if (L.cands) center(candsBlock(ctx, L.cands, T, L), L.cands);
  if (L.end) center(endBlock(ctx, L.end, T, L), L.end);
}

function render(ctx, P, k, editor) {
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const T = themeFor(P), L = layout(P);
  drawBg(ctx, P, T, L);
  L.fam === 'tall' ? placeTall(ctx, L, T) : placeBoxes(ctx, L, T);
  if (L.sticker) drawSticker(ctx, L, T);
  if (L.disc) drawDisclaimer(ctx, L, T);
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
  if (/\[|candidate (one|two|three|four)|endorser name/i.test(JSON.stringify([state.text, state.candidates, state.endorser.name]))) warn.push('Placeholder text is still in the ad.');
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
      save(); redraw();
    };
  });
}
function renderCandFields() {
  const labels = ['Supreme Court', 'Court of Appeals', 'Court of Appeals', 'Court of Appeals'];
  $('#candFields').innerHTML = state.candidates.map((c, i) => `<div class="cand"><b>${i + 1} · ${labels[i]}</b>
    <label>Name<input type="text" data-bind="candidates.${i}.name"></label>
    <label>Office<input type="text" data-bind="candidates.${i}.seat"></label>
    <label>Short office <span class="hint">(for small sizes)</span><input type="text" data-bind="candidates.${i}.short"></label></div>`).join('');
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
  const { red, white, blue, yellow } = state.colors;
  const sw = { blue: [blue, white], red: [red, white], yellow: [yellow, blue], white: [white, blue] };
  $('#themePick').innerHTML = THEMES.map(t => `<button data-theme="${t}" class="${t === state.theme ? 'active' : ''}" style="background:${sw[t][0]};color:${sw[t][1]}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('');
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
  drawPhoto(ctx, c.width / 2, c.height / 2, c.width, themeFor(presetOf(state.size)));
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
  setView(state.view); loadPhoto(); fontStatus(); loadKit();
}
window.addEventListener('resize', redraw);
initUI();
warmFonts();
// for headless checks: render a preset to a data URL
window.__renderSize = key => { const P = presetOf(key), c = document.createElement('canvas'); c.width = P.w; c.height = P.h; render(c.getContext('2d'), P, 1, false); return c.toDataURL('image/png'); };
})();
