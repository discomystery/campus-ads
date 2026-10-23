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
/* the page and its scripts carry the same build id (bump-build.sh sets it); browsers cache scripts for a
   few minutes, so if a page ever runs with scripts from another build, ask for a reload instead of half-working */
const BUILD = '20261023185021';
function staleBuild() {
  if ($('#staleBar')) return;
  const bar = document.createElement('div');
  bar.id = 'staleBar'; bar.className = 'stale-bar';
  bar.innerHTML = 'The studio was updated while this page was open. <button>Reload to finish updating</button>';
  $('button', bar).onclick = () => location.reload();
  document.body.prepend(bar);
}
if (document.querySelector('meta[name="build"]')?.content !== BUILD) staleBuild();
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
// photo: the campaign's cutouts ship with the studio; an upload replaces one, Remove leaves it empty ('')
const cand = (prefix, last, office, short, photo) => ({ prefix, last, office, short, showPrefix: true, showOffice: true, photo, zoom: 1, x: 0, y: 0 });
// Alternate messages. Each size uses one, so the set of ads doesn't all say the same thing.
const msg = (kicker, headline, short, cta) => ({ kicker, headline, short, cta, ticker: '' });
const DEFAULT_MESSAGES = [
  msg('Today is Election Day', 'Your rights are on the ballot, and *you* could cast the *deciding vote* for *justice*.', 'Cast the *deciding vote* for *justice*.', 'Polls open till 7:30\u00a0PM'),
  msg('Today is Election Day', 'Missed early voting? *It\'s not too late.*', '*It\'s not too late.*', 'Vote by 7:30\u00a0PM tonight'),
  msg('Election Day', 'Don\'t stop at the top. Vote *all the way down* the ballot.', 'Vote *all the way down* the ballot.', 'Polls open till 7:30\u00a0PM'),
  msg('Today is Election Day', '*Our courts* are on the ballot today.', '*Our courts* are on the ballot.', 'Polls close at 7:30\u00a0PM'),
  msg('Every vote counts', '*Statewide* court races here have been decided by *just a few hundred votes*. Make one of them *yours*.', 'Make *your vote* count.', 'Vote by 7:30\u00a0PM tonight'),
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// the "Mix" pattern: the three designs in turn down the list of sizes
const DESIGNS = ['spotlight', 'frontrow', 'scrapbook'];
const mixLayout = (p, i) => DESIGNS[i % DESIGNS.length];
function freshState() {
  const sizes = {};
  // spread the messages across the sizes so neighbors differ
  PRESETS.forEach((p, i) => { sizes[p.key] = { endorser: !!p.big, disclaimer: true, batch: p.key !== 'custom', message: i % DEFAULT_MESSAGES.length, layout: mixLayout(p, i) }; });
  return {
    size: 'meta45', view: 'single', tab: 'cands',
    messages: DEFAULT_MESSAGES.map(m => ({ ...m })),
    text: {
      note: 'Don\'t skip these four!',
      stripeTag: 'Vote for justice!', dayLabel: 'Election Day', date: 'November 3rd',
      sticker: 'It\'s not too late!',
      disclaimer: 'Paid for by [Committee Name]',
    },
    candPhotos: true,
    candidates: [
      cand('Justice Anita', 'Earls', 'for Supreme Court', 'Supreme Court', 'photos/earls.webp'),
      cand('Judge John', 'Arrowood', 'for Court of Appeals', 'Court of Appeals', 'photos/arrowood.webp'),
      cand('Judge Tobias', 'Hampson', 'for Court of Appeals', 'Court of Appeals', 'photos/hampson.webp'),
      cand('Judge Christine', 'Walczyk', 'for Court of Appeals', 'Court of Appeals', 'photos/walczyk.webp'),
    ],
    endorser: { photo: 'photos/cooper.webp', zoom: 1, x: 0, y: 0, name: 'Roy Cooper' },
    sizes,
    custom: { w: 600, h: 500 },
    colors: { ...DEFAULT_COLORS },
    theme: 'classic', themeAuto: false,
    pattern: 'none', sticker: false, guides: true, snap: true, lcollapse: { sizes: false, layers: false },
    slideTimes: {}, // seconds per slide: slideTimes[design][slide]
    tweaks: {}, // your manual moves and resizes: tweaks[size][layout][element] = { dx, dy, s }
    duration: 8, outro: 'hold', motion: 'pop', pulse: true,
    frame: 'circle', endFrame: 'circle',
    font: { kit: '', family: 'obviously-variable', css: '', dWeight: '500', hWeight: '800', cWeight: '500', wideW: 150, lastW: 150, condW: 75, bodyW: 100 },
    exp: { kind: 'anim', format: 'png', cap: true, zip: true, stills: true, allMessages: false },
  };
}
function merge(base, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;
  for (const k of Object.keys(base)) {
    if (!(k in saved)) continue;
    const b = base[k], s = saved[k];
    if (k === 'tweaks' || k === 'slideTimes') { base[k] = s && typeof s === 'object' && !Array.isArray(s) ? s : {}; continue; }
    if (b && typeof b === 'object' && !Array.isArray(b)) base[k] = merge(b, s);
    else if (Array.isArray(b)) {
      if (!Array.isArray(s)) continue;
      // fixed lists (candidates) keep their length; messages can grow and shrink
      base[k] = k === 'messages' ? s.filter(Boolean).map(x => merge({ ...b[0] }, x)) : b.map((x, i) => s[i] ? merge(x, s[i]) : x);
      if (!base[k].length) base[k] = b;
    }
    else if (b === null || typeof b === typeof s) base[k] = s;
  }
  return base;
}
let state = freshState();
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY));
  if (saved) {
    // the single message from before alternate messages existed becomes message A
    if (!saved.messages && saved.text?.headline) saved.messages = [{ ...DEFAULT_MESSAGES[0], ...saved.text }, ...DEFAULT_MESSAGES.slice(1)];
    state = merge(freshState(), saved);
    // sizes still on a retired layout (Lineup, Stripes, Quadrants) move to the designs
    PRESETS.forEach((p, i) => { if (!DESIGNS.includes(state.sizes[p.key]?.layout)) state.sizes[p.key].layout = mixLayout(p, i); });
    // the first draft of message E made a vaguer claim
    state.messages.forEach(m => { if (m.headline.startsWith('Court races are won by *a few thousand votes*')) Object.assign(m, DEFAULT_MESSAGES[4]); });
  }
  else { // carry photos and settings over from the first version's saved data
    const old = JSON.parse(localStorage.getItem('judstudio.v1'));
    if (old) {
      old.candidates?.forEach((c, i) => { if (c?.photo && state.candidates[i]) Object.assign(state.candidates[i], { photo: c.photo, zoom: c.zoom ?? 1, x: c.x ?? 0, y: c.y ?? 0 }); });
      state = merge(state, { endorser: { photo: old.endorser?.photo || null }, sizes: old.sizes, custom: old.custom, font: { kit: old.font?.kit || '' } });
    }
  }
} catch {}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { $('#warnings').textContent = 'Your browser ran out of room to save the photos. Try smaller photos, or use Export → Save settings file.'; }
}

/* ---------- fonts ---------- */
/* One variable family (Obviously Variable from Adobe Fonts) drawn at three
   widths: wide for the headline, last names and button, narrow for the name
   lines and tag, normal for fine print. Adobe's embed code declares a single
   weight and no width range, and a canvas can't use font-variation-settings,
   so the studio reads the font file's address from the project's CSS and
   registers it again once per width, each copy pinned to that width and open
   to every weight. Until that works, Archivo's width axis stands in. */
const FALLBACK = '"Archivo", sans-serif';
const STRETCH = [[50, 'ultra-condensed'], [62.5, 'extra-condensed'], [75, 'condensed'], [87.5, 'semi-condensed'], [100, 'normal'], [112.5, 'semi-expanded'], [125, 'expanded'], [150, 'extra-expanded'], [200, 'ultra-expanded']];
const nearestStretch = w => STRETCH.reduce((a, b) => (Math.abs(b[0] - w) < Math.abs(a[0] - w) ? b : a))[1];
let varSrc = null, varNote = ''; // the variable font's src, once found
const aliases = new Map();
// a copy of the variable font pinned to one width
function aliasFor(w) {
  const key = Math.round(w);
  if (aliases.has(key)) return aliases.get(key);
  const name = `dbv-${key}`, face = new FontFace(name, varSrc, { weight: '1 1000', stretch: `${key}%`, style: 'normal' });
  document.fonts.add(face);
  face.load().then(() => { redraw(); }).catch(() => { varNote = 'The font file wouldn\'t load from this site. Check that this domain is added to the Adobe Fonts project.'; fontStatus(); });
  aliases.set(key, name);
  return name;
}
const ROLE = { // [weight setting or number, width setting]
  head: ['dWeight', 'wideW'], heavy: ['hWeight', 'wideW'], last: ['hWeight', 'lastW'], cond: ['cWeight', 'condW'], condBold: [700, 'condW'], medium: [500, 'bodyW'], body: [400, 'bodyW'],
};
function font(role, size) {
  if (role === 'marker') return `400 ${Math.max(1, size).toFixed(2)}px "Permanent Marker", cursive`;
  const f = state.font, px = `${Math.max(1, size).toFixed(2)}px`, [wt, wd] = ROLE[role] || ROLE.body;
  const weight = typeof wt === 'number' ? wt : f[wt], width = +f[wd] || 100;
  const fam = varSrc ? `"${aliasFor(width)}", "${f.family}"` : `"${f.family}"`;
  return `${weight} ${nearestStretch(width)} ${px} ${fam}, ${FALLBACK}`;
}
const ROLES = Object.keys(ROLE);
// a role's font with an element's edits: weight (or hweight for highlighted words) and width
function fontOv(role, size, ov, hi) {
  if (role === 'marker' || !ov) return font(role, size);
  const wo = hi ? ov.hweight : ov.weight;
  if (wo == null && ov.width == null) return font(role, size);
  const f = state.font, [wt, wd] = ROLE[role] || ROLE.body;
  const weight = wo ?? (typeof wt === 'number' ? wt : f[wt]), width = ov.width ?? (+f[wd] || 100);
  const fam = varSrc ? `"${aliasFor(width)}", "${f.family}"` : `"${f.family}"`;
  return `${weight} ${nearestStretch(width)} ${Math.max(1, size).toFixed(2)}px ${fam}, ${FALLBACK}`;
}
const roleDefaults = role => { if (!ROLE[role]) return null; const [wt, wd] = ROLE[role]; return { weight: typeof wt === 'number' ? wt : +state.font[wt], width: +state.font[wd] || 100 }; };
const kitFamilies = () => [...new Set([...document.fonts].map(f => f.family.replace(/["']/g, '')))].filter(f => f !== 'Archivo' && !f.startsWith('dbv-'));
// find the family's @font-face src in the project's CSS (fetched, or pasted in by hand)
async function findVariableSource() {
  const f = state.font;
  let css = f.css.trim(), fetched = false;
  if (!css && f.kit) {
    try { const r = await fetch(`https://use.typekit.net/${f.kit}.css`); if (r.ok) { css = await r.text(); fetched = true; } } catch {}
  }
  let src = null;
  for (const block of css.match(/@font-face\s*{[^}]*}/g) || []) {
    const fam = block.match(/font-family\s*:\s*["']?([^"';]+)/i)?.[1].trim();
    if (fam?.toLowerCase() !== f.family.trim().toLowerCase() || /font-style\s*:\s*(italic|oblique)/i.test(block)) continue;
    const s = block.match(/src\s*:\s*([^;]+)/i)?.[1].trim();
    if (!s) continue;
    // Google-style CSS splits a font by language; prefer the Latin part
    const range = block.match(/unicode-range\s*:\s*([^;]+)/i)?.[1] || '';
    if (!src || !range || /U\+0000/i.test(range)) src = s;
    if (!range || /U\+0000/i.test(range)) break;
  }
  if (src !== varSrc) { varSrc = src; aliases.clear(); }
  varNote = src ? '' : css ? `"${f.family}" isn't in that CSS.` : f.kit && !fetched ? 'auto' : '';
  return src;
}
function loadKit() {
  const id = state.font.kit;
  $$('link[data-kit]').forEach(l => { if (l.dataset.kit !== id) l.remove(); });
  const linked = !id || $(`link[data-kit="${id}"]`) ? Promise.resolve() : new Promise(res => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = `https://use.typekit.net/${id}.css`; l.dataset.kit = id;
    l.onload = res;
    l.onerror = () => { varNote = 'Could not load that Adobe Fonts project. Check the ID, and that this site\'s domain is added to the project.'; res(); };
    document.head.appendChild(l);
  });
  return linked.then(findVariableSource).then(warmFonts);
}
function warmFonts() {
  return Promise.all(ROLES.map(r => document.fonts.load(font(r, 40)).catch(() => []))).then(() => { fontStatus(); redraw(); });
}
function fontStatus() {
  const fams = kitFamilies(), f = state.font;
  $('#famList').innerHTML = [...new Set([...fams, 'obviously-variable'])].map(x => `<option value="${esc(x)}">`).join('');
  const has = [...document.fonts].some(x => x.family.replace(/["']/g, '') === f.family && x.status === 'loaded');
  const ok = varSrc && [...aliases.values()].some(n => [...document.fonts].some(x => x.family === n && x.status === 'loaded'));
  $('#fontStatus').innerHTML = varNote && varNote !== 'auto' ? `<span class="warn">${esc(varNote)}</span>`
    : ok ? `✓ <b>${esc(f.family)}</b> is live: every width and weight below is adjustable.`
    : varSrc ? `Loading <b>${esc(f.family)}</b>…`
    : varNote === 'auto' ? `${has ? `<b>${esc(f.family)}</b> loaded, but` : 'The project loaded, but'} the browser won't let the studio read its CSS, so widths and weights can't be set yet. Open <a href="https://use.typekit.net/${esc(f.kit)}.css" target="_blank" rel="noopener">the project's CSS</a>, copy everything, and paste it in the box below.`
    : 'No Adobe Fonts project yet. Using Archivo in place of Obviously.';
  if (varNote === 'auto') $('#cssBox').open = true;
  document.documentElement.style.setProperty('--display', `"${f.family}", ${FALLBACK}`);
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

/* ---------- motion ---------- */
// NOW is the moment being drawn, in seconds of animation; Infinity draws the finished ad
let NOW = Infinity;
const EASE = {
  out: x => 1 - Math.pow(1 - x, 3),
  back: x => { const c1 = 1.8, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
const prog = (t0, dur) => clamp((NOW - t0) / dur, 0, 1);
/* How each element arrives depends on the chosen style:
   pop = scales in with a bounce, slide = glides in, fade = fades up, none = no motion. */
const MOTIONS = { pop: 'Pop (bouncy)', slide: 'Slide (smooth)', fade: 'Fade (calm)', none: 'None (still image)' };
function enter(ctx, p, cx, cy, slide, popScale, draw) {
  if (p <= 0) return;
  if (p >= 1) { draw(); return; }
  const m = state.motion;
  ctx.save();
  if (m === 'pop') { const s = popScale(p); ctx.globalAlpha *= Math.min(1, p * 2); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy); }
  else if (m === 'slide') { const k = 1 - EASE.out(p); ctx.globalAlpha *= Math.min(1, p * 1.5); ctx.translate(-slide[0] * k, slide[1] * k); }
  else ctx.globalAlpha *= EASE.out(p);
  draw(); ctx.restore();
}
const popBack = p => EASE.back(p);

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
  let over = false, count = 0;
  for (const para of String(text).split('\n')) {
    let line = [], lw = 0;
    for (const segs of words(para)) {
      segs.forEach(s => { ctx.font = s.hi && fHi ? fHi : f; s.w = ctx.measureText(s.t).width; });
      const ww = segs.reduce((a, s) => a + s.w, 0);
      if (ww > maxW + .5) over = true;
      if (line.length && lw + space + ww > maxW) { lines.push({ words: line, w: lw }); line = []; lw = 0; }
      lw += (line.length ? space : 0) + ww; line.push({ segs, w: ww }); count++;
    }
    if (line.length) lines.push({ words: line, w: lw });
  }
  return { lines, over, space, count, maxW: lines.reduce((a, l) => Math.max(a, l.w), 0) };
}
const ASC = .76; // cap height-ish, as a share of font size
/* first-line top for text centered in a pill: measured cap height of the
   actual font, so tags and buttons sit dead center in any typeface */
function pillTextTop(f, size, lines, lh, top, h) {
  MC.font = f;
  const cap = MC.measureText('H').actualBoundingBoxAscent || size * .7;
  const base1 = top + h / 2 - (lines - 1) * size * lh / 2 + cap / 2;
  return base1 - size * ASC;
}
const blockH = (n, size, lh) => n ? size * (1 + (n - 1) * lh) : 0;
const WORD_STEP = .075; // seconds between words as a headline builds
/* With anim, words arrive one after another: plain words rise into place,
   highlighted ones pop in a little larger and settle. */
function drawLines(ctx, b, f, size, lh, x, y, w, align, color, hi, anim) {
  ctx.textBaseline = 'alphabetic';
  let n = 0;
  b.lines.forEach((line, i) => {
    let cx = align === 'center' ? x + (w - line.w) / 2 : align === 'right' ? x + w - line.w : x;
    const base = y + size * ASC + i * size * lh;
    line.words.forEach(word => {
      const p = anim ? prog(anim.t0 + n * WORD_STEP, .5) : 1, isHi = hi && word.segs.some(s => s.hi);
      n++;
      if (p > 0) {
        ctx.save(); ctx.globalAlpha *= state.motion === 'fade' ? EASE.out(p) : Math.min(1, p * 1.6);
        if (p < 1 && state.motion === 'pop') {
          if (isHi) { const s = .3 + .7 * EASE.back(p), mx = cx + word.w / 2, my = base - size * .35; ctx.translate(mx, my); ctx.scale(s, s); ctx.translate(-mx, -my); }
          else ctx.translate(0, (1 - EASE.out(p)) * size * .6);
        } else if (p < 1 && state.motion === 'slide') ctx.translate(-(1 - EASE.out(p)) * size * .45, 0);
        let sx = cx;
        word.segs.forEach(s => {
          const h = s.hi && hi;
          ctx.font = h ? hi.font : f; ctx.fillStyle = h ? hi.color : color;
          ctx.fillText(s.t, sx, base); sx += s.w;
        });
        ctx.restore();
      }
      cx += word.w + b.space;
    });
  });
}
// binary search the biggest value for which build() returns a layout (build(lo) must fit)
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
// lay out a stack at one base size s; null if it doesn't fit w x h
function stackAt(ctx, use, w, h, s) {
  let total = 0, maxW = 0; const out = [];
  for (const it of use) {
    const size = Math.min(s * it.r, it.cap || 1e9), pad = it.pill ? size * .7 : 0;
    const f = font(it.role, size), fh = it.hi ? font(it.hiRole || it.role, size) : null, b = wrap(ctx, it.text, f, w - pad * 2, fh);
    if (b.over || b.lines.length > (it.maxLines || 99)) return null;
    const bh = blockH(b.lines.length, size, it.lh || 1.15) + (it.pill ? size * .7 : 0), gap = out.length ? s * (it.gap ?? .3) : 0;
    total += gap + bh; maxW = Math.max(maxW, b.maxW + pad * 2); out.push({ it, size, f, fh, b, h: bh, gap, pad });
  }
  return total <= h ? { s, out, total, w, maxW } : null;
}
function fitStack(ctx, items, w, h, maxBase) {
  items = items.filter(it => it && it.text && String(it.text).trim());
  const build = (s, use) => stackAt(ctx, use, w, h, s);
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
// seconds a stack takes to build: pills pop, then text arrives word by word
const stackDur = res => res ? res.out.reduce((a, o) => a + (o.it.pill ? .2 : o.b.count * WORD_STEP + .15), 0) + .35 : 0;
function drawStack(ctx, res, x, y, align, t0) {
  if (!res) return;
  let t = t0;
  for (const o of res.out) {
    y += o.gap;
    const it = o.it, hi = it.hi ? { color: it.hi, font: o.fh } : null;
    if (it.pill) {
      const pw = o.b.maxW + o.pad * 2, px = align === 'center' ? x + (res.w - pw) / 2 : x, yy = y;
      const p = t0 == null ? 1 : prog(t, .45);
      enter(ctx, p, px + pw / 2, yy + o.h / 2, [o.h * 2, 0], popBack, () => {
        ctx.fillStyle = it.pill; ctx.beginPath(); ctx.roundRect(px, yy, pw, o.h, o.h / 2); ctx.fill();
        drawLines(ctx, o.b, o.f, o.size, it.lh || 1.15, px + o.pad, pillTextTop(o.f, o.size, o.b.lines.length, it.lh || 1.15, yy, o.h), pw - o.pad * 2, 'center', it.color, hi);
      });
      t += .2;
    } else {
      drawLines(ctx, o.b, o.f, o.size, it.lh || 1.15, x, y, res.w, align, it.color, hi, t0 == null ? null : { t0: t });
      t += o.b.count * WORD_STEP + .15;
    }
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
// frame shapes: 'circle', 'square' (rounded) or 'none'
function framePath(ctx, frame, cx, cy, d) {
  ctx.beginPath();
  if (frame === 'circle') ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  else ctx.roundRect(cx - d / 2, cy - d / 2, d, d, frame === 'square' ? d * .16 : 0);
}
function drawPhoto(ctx, cx, cy, d, ring, ink) {
  const frame = state.endFrame, i = frame === 'none' ? d : d * .9;
  if (frame !== 'none') { ctx.fillStyle = ring; framePath(ctx, frame, cx, cy, d); ctx.fill(); }
  ctx.save();
  if (frame === 'none' && photoImg) {
    // no frame: show the whole picture, fit to the box height and standing on its bottom edge
    const E = state.endorser, s = d * E.zoom / photoImg.height, iw = photoImg.width * s, ih = photoImg.height * s;
    ctx.drawImage(photoImg, cx - iw / 2 + E.x * d * .5, cy + d / 2 - ih + E.y * d * .5, iw, ih);
    ctx.restore(); return;
  }
  framePath(ctx, frame === 'none' ? 'square' : frame, cx, cy, i); ctx.clip();
  if (photoImg) {
    const E = state.endorser, s = Math.max(i / photoImg.width, i / photoImg.height) * E.zoom;
    const iw = photoImg.width * s, ih = photoImg.height * s;
    ctx.drawImage(photoImg, cx - iw / 2 + E.x * i * .5, cy - ih / 2 + E.y * i * .5, iw, ih);
  } else {
    ctx.fillStyle = '#d9dbe3'; ctx.fillRect(cx - i / 2, cy - i / 2, i, i);
    ctx.fillStyle = rgba(ink, .25);
    ctx.beginPath(); ctx.arc(cx, cy - i * .1, i * .2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + i * .42, i * .36, i * .3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
/* Candidate cutouts (transparent PNGs, shoulders up) stand on a colored disc
   with the head popping out over the top of it, like the literature. rise
   (0..1) slides the photo up out of the disc as it animates in. */
const candImgs = [];
function loadCandPhotos() {
  state.candidates.forEach((c, i) => {
    if (!c.photo) { candImgs[i] = null; return; }
    if (candImgs[i]?._src === c.photo) return;
    const img = new Image(); img._src = c.photo;
    img.onload = () => { drawCandThumbs(); redraw(); };
    img.src = c.photo; candImgs[i] = img;
  });
  drawCandThumbs(); redraw();
}
const POP = 1.12; // cutout box height as a multiple of the disc diameter
function drawCutout(ctx, i, x, y, d, disc, ink, rise = 1) {
  const c = state.candidates[i], img = candImgs[i]?.complete ? candImgs[i] : null;
  const h = d * POP, R = d / 2, cx = x + R, cy = y + h - R, dy = (1 - EASE.out(rise)) * h * .95, frame = state.frame;
  if (frame !== 'none') { ctx.fillStyle = disc; framePath(ctx, frame, cx, cy, d); ctx.fill(); }
  if (rise <= 0) return;
  ctx.save();
  // the head pops out over the top of the frame; with no frame the photo just stands on its own
  ctx.beginPath();
  if (frame === 'none') ctx.rect(x - d * 4, y - h * 4, d * 9, h * 5); // the whole cutout shows; only the bottom edge it stands on trims it
  else {
    ctx.rect(x - R * .15, y - h * 1.5, d + R * .3, cy - y + h * 1.5);
    if (frame === 'circle') ctx.arc(cx, cy, R, 0, Math.PI * 2); else ctx.roundRect(x, cy - R, d, d, frame === 'square' ? d * .16 : 0);
  }
  ctx.clip();
  ctx.translate(0, dy);
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

/* ---------- messages ---------- */
// which message a size uses; an export can force one with P.message
const msgIndex = P => clamp(P.message ?? state.sizes[P.key]?.message ?? 0, 0, state.messages.length - 1);
const msgOf = P => state.messages[msgIndex(P)];

/* ---------- blocks ---------- */
// Every block is measured once (with MC, a scratch context) and reports its
// natural height, width and how long it takes to animate in. draw(y, t0)
// paints it on DC, the context being rendered, starting its motion at t0.
const MC = document.createElement('canvas').getContext('2d');
let DC = MC;
const usePhotos = () => state.candPhotos;
const minText = P => Math.max(10.5, Math.min(P.w, P.h) * .018); // nothing smaller than this gets drawn

function headerBlock(x, w, h, T, align, P, small) {
  const t = msgOf(P), m = Math.min(P.w, P.h);
  const make = head => fitStack(MC, [
    !small && { text: t.kicker.toUpperCase(), role: 'condBold', r: .5, cap: w * .045 + 8, min: minText(P), pill: T.kick, color: T.kickInk, maxLines: 1, lh: 1, gap: 0, optional: true },
    { text: head, role: 'head', hiRole: 'heavy', r: 1, lh: 1.04, color: T.ink, hi: T.hi, gap: .42 },
  ], w, h, Math.min(w * .1, 120));
  // the full line from the literature where it reads well; the short one on small sizes
  const long = t.headline.trim() ? make(t.headline) : null, short = t.short.trim() ? make(t.short) : null;
  const res = long && (!short || long.s >= Math.max(16, m * .045)) ? long : short || long;
  if (!res || res.out.find(o => o.it.role === 'head').size < minText(P)) return null; // too small to read: leave it off
  return { h: res.total, w: res.maxW, bx: x, bw: w, dur: stackDur(res), draw: (y, t0) => drawStack(DC, res, x, y, align, t0) };
}

/* The four judges: a cutout on a disc, then "Justice Anita" / EARLS / "for Supreme Court".
   Tries 4 across, 2x2 and one column; photos win when they fit with readable
   names, then the office line, then the first-name line, then the biggest size. */
const JUDGE_STEP = .22;
function lineupBlock(x, w, h, T, ink, P) {
  const C = state.candidates, minP = minText(P), fits = [];
  for (const cols of [4, 2, 1]) {
    if (cols === 1 && w > 260) continue;
    const gx = w * (cols === 4 ? .03 : .07), cw = (w - gx * (cols - 1)) / cols, rows = Math.ceil(C.length / cols);
    // biggest last-name size that fits the column
    const nMax = search(n => C.every(c => !wrap(MC, c.last, font('last', n), cw).over) ? n : null, 4, 260);
    if (!nMax) continue;
    const anyPre = C.some(c => c.showPrefix && c.prefix.trim()), anyOff = C.some(c => c.showOffice);
    for (const photos of usePhotos() ? [true, false] : [false]) for (const pre of anyPre ? [true, false] : [false]) for (const off of anyOff ? [true, false] : [false]) {
      const build = (d, n) => {
        const p = n * .56;
        if (n > nMax + .01 || ((pre || off) && p < minP)) return null;
        if (photos && (d > cw * .96 || n < 11)) return null;
        // each judge can hide either small line; hidden ones still keep their slot so last names line up
        const empty = { lines: [], over: false };
        const pb = pre ? C.map(c => c.showPrefix && c.prefix.trim() ? wrap(MC, c.prefix, font('cond', p), cw) : empty) : null;
        if (pb && pb.some(b => b.over || b.lines.length > 2)) return null;
        let ob = null;
        if (off) {
          const mode = (k, ml) => { const o = C.map(c => c.showOffice ? wrap(MC, (c[k] || c.office || c.short || '').trim(), font('cond', p), cw) : empty); return o.every(b => !b.over && b.lines.length <= ml) ? o : null; };
          ob = mode('office', 1) || mode('short', 1) || mode('office', 2) || mode('short', 2);
          if (!ob) return null;
        }
        const ph = photos ? d * POP : 0;
        const preL = pb ? Math.max(...pb.map(b => b.lines.length)) : 0, offL = ob ? Math.max(...ob.map(b => b.lines.length)) : 0;
        const preH = preL ? blockH(preL, p, 1.05) + p * .2 : 0;
        const cells = C.map(() => ({ h: ph + (photos ? n * .28 : 0) + preH + n * .98 + (offL ? p * .25 + blockH(offL, p, 1.05) : 0) }));
        const rowH = []; for (let r = 0; r < rows; r++) rowH.push(Math.max(...cells.slice(r * cols, r * cols + cols).map(c => c.h)));
        const gy = n * (photos ? .9 : .7), total = rowH.reduce((a, b) => a + b, 0) + gy * (rows - 1);
        return total <= h ? { cols, gx, cw, rows, rowH, gy, total, d: photos ? d : 0, ph, n, p, pb, ob, preH, photos, pre, off } : null;
      };
      // search() needs its low end to fit, so start where the smallest allowed text is
      const nLo = Math.max(pre || off ? minP / .56 : 6, photos ? 11 : 0);
      const res = photos ? search(d => build(d, Math.min(nMax, d * .25)), Math.max(40, nLo / .25), Math.min(cw * .96, h))
        : search(n => build(0, n), nLo, nMax);
      if (res) fits.push(res);
    }
  }
  if (!fits.length) return null;
  const rank = f => (f.photos ? 4 : 0) + (f.off ? 2 : 0) + (f.pre ? 1 : 0);
  const best = Math.max(...fits.map(rank));
  const F = fits.filter(f => rank(f) === best).reduce((a, b) => ((b.photos ? b.d * b.n : b.n) > (a.photos ? a.d * a.n : a.n) ? b : a));
  const width = F.cols * F.cw + (F.cols - 1) * F.gx;
  return { h: F.total, w: width, bx: x + (w - width) / 2, bw: width, bandTop: F.photos ? F.ph - F.d * .7 : -F.n * .6, dur: (C.length - 1) * JUDGE_STEP + 1, draw: (y, t0 = -1e9) => {
    const ctx = DC;
    let cy = y;
    for (let r = 0; r < F.rows; r++) {
      for (let col = 0; col < F.cols; col++) {
        const i = r * F.cols + col; if (i >= C.length) continue;
        const cx = x + (w - width) / 2 + col * (F.cw + F.gx), mid = cx + F.cw / 2, t = t0 + i * JUDGE_STEP;
        let ty = cy;
        if (F.photos) {
          // the frame arrives, then the judge rises up out of it (a calm fade skips the rise)
          const dx = cx + (F.cw - F.d) / 2, rise = state.motion === 'fade' ? 1 : prog(t + .15, .6);
          enter(ctx, prog(t, .45), dx + F.d / 2, cy + F.ph - F.d / 2, [0, F.d * .5], popBack, () => drawCutout(ctx, i, dx, cy, F.d, T.disc, ink, rise));
          ty += F.ph + F.n * .28;
        }
        const fade = (t1, dy, draw) => { const p = prog(t1, .35); if (p > 0) { ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - EASE.out(p)) * dy); draw(); ctx.restore(); } };
        if (F.pb) { const yy = ty + (F.preH - (F.pb[i].lines.length ? blockH(F.pb[i].lines.length, F.p, 1.05) + F.p * .2 : 0)); fade(t + .5, F.p, () => drawLines(ctx, F.pb[i], font('cond', F.p), F.p, 1.05, cx, yy, F.cw, 'center', ink)); ty += F.preH; }
        // the last name lands: drops in big and settles (or glides / fades in)
        const pn = prog(t + .35, .4), ny = ty;
        enter(ctx, pn, mid, ny + F.n * .4, [F.cw * .4, 0], p => 1.5 - .5 * EASE.out(p), () => {
          ctx.font = font('last', F.n); ctx.fillStyle = ink; ctx.textAlign = 'center';
          ctx.fillText(C[i].last, mid, ny + F.n * ASC); ctx.textAlign = 'left';
        });
        ty += F.n * .98;
        if (F.ob) { const yy = ty + F.p * .25; fade(t + .6, -F.p, () => drawLines(ctx, F.ob[i], font('cond', F.p), F.p, 1.05, cx, yy, F.cw, 'center', ink)); }
      }
      cy += F.rowH[r] + F.gy;
    }
  } };
}

// endorser: face and name only; 'row' = name beside the photo, 'stack' = under it
function endBlock(x, w, h, T, ink, style, P) {
  const name = state.endorser.name.trim(), gap = Math.min(w, h) * .08;
  const items = [{ text: name, role: 'heavy', r: 1, lh: 1.02, color: ink, maxLines: 2 }];
  const ring = T.disc;
  if (style === 'stack') {
    const d = Math.min(w * .85, h * .7), res = name ? fitStack(MC, items, w, h - d - gap, Math.min(w * .12, d * .3)) : null;
    const textOk = res && res.s >= minText(P);
    return { h: d + (textOk ? gap + res.total : 0), w, bx: x, bw: w, dur: 1, draw: (y, t0 = -1e9) => {
      const ctx = DC, p = prog(t0, .5);
      enter(ctx, p, x + w / 2, y + d / 2, [0, d * .4], popBack, () => drawPhoto(ctx, x + w / 2, y + d / 2, d, ring, ink));
      if (textOk) drawStack(ctx, res, x, y + d + gap, 'center', t0 + .3);
    } };
  }
  const d = Math.min(h, w * .3), tw = Math.min(w - d - gap, w * .6), res = name ? fitStack(MC, items, tw, h * .6, Math.min(tw * .12, d * .3)) : null;
  const textOk = res && res.s >= minText(P), gw = d + (textOk ? gap + res.maxW : 0);
  return { h: d, w: gw, bx: x + (w - gw) / 2, bw: gw, dur: 1, draw: (y, t0 = -1e9) => {
    const ctx = DC, x0 = x + (w - gw) / 2, p = prog(t0, .5);
    enter(ctx, p, x0 + d / 2, y + d / 2, [d * .6, 0], popBack, () => drawPhoto(ctx, x0 + d / 2, y + d / 2, d, ring, ink));
    if (textOk) drawStack(ctx, { ...res, w: res.maxW }, x0 + d + gap, y + (d - res.total) / 2, 'left', t0 + .3);
  } };
}

// the button: stretches open, then gives a gentle pulse every couple of seconds
function ctaBlock(x, w, h, fill, fillInk, align, P, maxLines = 2) {
  let text = msgOf(P).cta.trim();
  if (!text) return null;
  // too long for a tiny banner: drop trailing words ("Vote by 7:30 PM tonight" -> "Vote by 7:30 PM")
  for (;;) {
    const res = ctaFit(text, x, w, h, fill, fillInk, align, P, maxLines);
    const shorter = text.replace(/\s+\S+$/, '');
    if (res || shorter === text || !/\s/.test(shorter)) return res;
    text = shorter;
  }
}
function ctaFit(text, x, w, h, fill, fillInk, align, P, maxLines) {
  const build = s => {
    const b = wrap(MC, text, font('heavy', s), w - s * 1.8);
    if (b.over || b.lines.length > maxLines) return null;
    const ph = blockH(b.lines.length, s, 1.08) + s * 1.1, pw = b.maxW + s * 1.8;
    return ph <= h && pw <= w ? { s, b, ph, pw } : null;
  };
  const F = search(build, 4, Math.min(h * .5, 60));
  if (!F || F.s < minText(P) * .9) return null;
  return { h: F.ph, w: F.pw, bx: align === 'center' ? x + (w - F.pw) / 2 : x, bw: F.pw, dur: .9, draw: (y, t0 = -1e9) => {
    const ctx = DC, px = align === 'center' ? x + (w - F.pw) / 2 : x, cx = px + F.pw / 2, cy = y + F.ph / 2;
    const p = prog(t0, .55), since = NOW - t0 - 1.4, m = state.motion;
    const pulse = state.pulse && Number.isFinite(since) && since > 0 ? 1 + .045 * Math.pow(Math.max(0, Math.sin(since * Math.PI / 1.1)), 6) : 1;
    if (p <= 0) return;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(pulse, pulse); ctx.translate(-cx, -cy);
    // pop stretches the button open; slide brings it up; fade fades it in
    const pw = m === 'pop' ? Math.max(F.ph, F.pw * EASE.back(p)) : F.pw, sx = align === 'center' ? cx - pw / 2 : px;
    if (m === 'slide') ctx.translate(0, (1 - EASE.out(p)) * F.ph * 1.2);
    ctx.globalAlpha *= m === 'pop' ? Math.min(1, p * 3) : EASE.out(p);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(sx, y, pw, F.ph, F.ph / 2); ctx.fill();
    const tp = m === 'pop' ? prog(t0 + .3, .3) : 1;
    if (tp > 0) { ctx.globalAlpha *= tp; drawLines(ctx, F.b, font('heavy', F.s), F.s, 1.08, px + F.s * .9, pillTextTop(font('heavy', F.s), F.s, F.b.lines.length, 1.08, y, F.ph), F.pw - F.s * 1.8, 'center', fillInk); }
    ctx.restore();
  } };
}

function discBlock(x, w, size, ink, align) {
  const text = state.text.disclaimer.trim();
  MC.font = font('medium', size);
  const tw = MC.measureText(text).width, s = tw > w ? size * w / tw : size;
  return { h: s * 1.1, w: Math.min(tw, w), bx: align === 'center' ? x + (w - Math.min(tw, w)) / 2 : x, bw: Math.min(tw, w), dur: .5, draw: (y, t0 = -1e9) => {
    const ctx = DC;
    ctx.save(); ctx.globalAlpha *= prog(t0, .5);
    ctx.font = font('medium', s); ctx.fillStyle = ink; ctx.textBaseline = 'alphabetic';
    ctx.textAlign = align; ctx.fillText(text, align === 'center' ? x + w / 2 : x, y + s * ASC);
    ctx.restore();
  } };
}

/* ---------- layout ---------- */
// the designs live in suites.js and register themselves here
const LAYOUTS = {};
const layoutOf = P => P.layout ?? state.sizes[P.key]?.layout ?? 'spotlight';
/* Works out where every element goes and when it animates in. Plans are cached:
   fitting text is the slow part, and video export draws the same plan hundreds of times. */
const planCache = new Map();
let planVersion = 0;
function plan(P, T) {
  const key = `${P.key}|${P.w}x${P.h}|${T.name}|${msgIndex(P)}|${layoutOf(P)}|${planVersion}`;
  if (planCache.has(key)) return planCache.get(key);
  if (planCache.size > 60) planCache.clear();
  const L = makePlan(P, T);
  L.byId = new Map(L.items.filter(it => it.id).map(it => [it.id, it]));
  L.items.forEach(it => { it._L = L; });
  planCache.set(key, L);
  return L;
}
function makePlan(P, T) {
  const suite = SUITES[layoutOf(P)] || SUITES.spotlight, prevP = CUR_P;
  CUR_P = P; // suites read the size being planned through DBS.curP / slideLen
  try { return (suite && suite(P, T)) || { fam: 'suite', bg: state.colors.blue, bands: [], items: [], end: 1 }; }
  finally { CUR_P = prevP; }
}

/* ---------- edits on elements ---------- */
/* per size and design, per element: dx, dy (moves, as fractions of the ad so a custom size can change),
   s (scale), weight / hweight (text and highlight weight), width, color / hcolor (text and highlight
   color), fill (shapes, pills, backgrounds) and hidden */
const tweaksFor = P => state.tweaks?.[P.key]?.[layoutOf(P)] || {};
function tweakOf(P, id, create) {
  const L = layoutOf(P);
  if (!create) return tweaksFor(P)[id] || null;
  state.tweaks[P.key] ??= {}; state.tweaks[P.key][L] ??= {};
  return (state.tweaks[P.key][L][id] ??= { dx: 0, dy: 0, s: 1 });
}
const NO_TWEAK = { dx: 0, dy: 0, s: 1 };
// an element's box before its own move/resize (text measures itself, since weight and width change how wide it is)
function baseBox(it, tk) { const m = it.measure ? it.measure(tk) : { x: it.x || 0, w: it.w || 0 }; return { x: m.x, y: it.y, w: m.w, h: it.b.h }; }
// where an element ends up after its edits (and its parent's, for a card's name lines), in ad pixels
function itemBox(P, it) {
  const T = tweaksFor(P), tk = T[it.id] || NO_TWEAK, b = baseBox(it, tk), s0 = tk.s ?? 1;
  let cx = b.x + b.w / 2 + (tk.dx || 0) * P.w, cy = b.y + b.h / 2 + (tk.dy || 0) * P.h, w = b.w * s0, h = b.h * s0;
  const pit = it.parent && it._L?.byId.get(it.parent), pt = pit && T[it.parent];
  if (pt) {
    const pb = baseBox(pit, pt), px = pb.x + pb.w / 2, py = pb.y + pb.h / 2, s = pt.s ?? 1;
    cx = px + (cx - px) * s + (pt.dx || 0) * P.w; cy = py + (cy - py) * s + (pt.dy || 0) * P.h; w *= s; h *= s;
  }
  return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
}
function applyTweak(ctx, P, it, tk) {
  const b = baseBox(it, tk), cx = b.x + b.w / 2, cy = b.y + b.h / 2, s = tk.s ?? 1;
  ctx.translate(cx + (tk.dx || 0) * P.w, cy + (tk.dy || 0) * P.h); ctx.scale(s, s); ctx.translate(-cx, -cy);
}
let CUR_OV = null, CUR_EDITOR = false; // the edits on the element being drawn; whether the editor is drawing
function drawItem(ctx, P, it) {
  const T = tweaksFor(P), tk = it.id ? T[it.id] : null, pt = it.parent ? T[it.parent] : null, hidden = tk?.hidden || pt?.hidden;
  if (hidden && !CUR_EDITOR) return;
  ctx.save();
  if (hidden) ctx.globalAlpha *= .2; // hidden elements stay faintly visible in the editor so they can be picked again
  const pit = pt && it._L?.byId.get(it.parent);
  if (pit) applyTweak(ctx, P, pit, pt);
  if (tk) applyTweak(ctx, P, it, tk);
  const late = (tk?.delay || 0) + (pt?.delay || 0); // timing edits push an element's entrance later (or earlier)
  CUR_OV = tk; it.b.draw(it.y, late && it.t0 != null ? it.t0 + late : it.t0); CUR_OV = null;
  ctx.restore();
}

// a band sweeps in from one side (or fades in)
function drawBand(ctx, P, b) {
  const p = EASE.out(prog(b.t0, .65));
  if (p <= 0) return;
  ctx.fillStyle = b.color;
  if (state.motion === 'fade') { ctx.save(); ctx.globalAlpha = p; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.restore(); return; }
  if (b.from === 'left') ctx.fillRect(b.x, b.y, b.w * p, b.h);
  else if (b.from === 'top') ctx.fillRect(b.x, b.y, b.w, b.h * p);
  else if (b.from === 'right') ctx.fillRect(b.x + b.w * (1 - p), b.y, b.w * p, b.h);
  else ctx.fillRect(b.x, b.y + b.h * (1 - p), b.w, b.h * p);
}
/* t is seconds into the animation (Infinity = the finished ad). If the intro is longer
   than the chosen length allows, it plays faster. `slide` freezes one slide, fully built,
   for editing. Slides change through an iris (or a wipe or crossfade, per motion style). */
let CUR_P = null; // the size being rendered right now (an export marks GIFs with gif: true)
const slideAt = (L, t) => { let k = 0; L.slides.forEach((s, j) => { if (t >= s.start) k = j; }); return k; };
// designs built from slides set their own running time (the sum of the slide lengths);
// the Length setting is then a minimum. Others speed up if the intro outruns the length.
const speedOf = L => L.total ? 1 : Math.max(1, L.end / Math.max(1, state.duration - 1.5));
const durOf = P => { const L = plan(P, themeFor(P)); return L.total ? clamp(Math.max(state.duration, L.total), 1, 30) : state.duration; };
const slideLens = L => (L.slides || []).map((s, j, a) => (j + 1 < a.length ? a[j + 1].start : L.total) - s.start);
function render(ctx, P, k, editor, t = Infinity, slide = null) {
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
  CUR_P = P; CUR_EDITOR = !!editor;
  const T = themeFor(P), L = plan(P, T);
  NOW = slide != null || state.motion === 'none' ? Infinity : t * speedOf(L); DC = ctx;
  try {
    ctx.fillStyle = L.bg; ctx.fillRect(0, 0, P.w, P.h);
    for (const b of L.bands) drawBand(ctx, P, b);
    L.under?.(ctx, P);
    const SL = L.slides?.length ? L.slides : null, n = SL ? (slide != null ? clamp(slide, 0, SL.length - 1) : slideAt(L, NOW)) : 0;
    if (SL) {
      const drawSlide = j => L.items.forEach(it => it.slide === j && !it.top && drawItem(ctx, P, it));
      const p = slide == null && n > 0 ? prog(SL[n].start, .5) : 1;
      if (p < 1) {
        drawSlide(n - 1);
        ctx.save();
        if (state.motion === 'fade') ctx.globalAlpha = EASE.out(p);
        else {
          ctx.beginPath();
          if (state.motion === 'slide') ctx.rect(P.w * (1 - EASE.out(p)), 0, P.w, P.h);
          else ctx.arc(SL[n].ox, SL[n].oy, Math.hypot(P.w, P.h) * EASE.out(p), 0, Math.PI * 2);
          ctx.clip();
        }
        drawSlide(n); ctx.restore();
      } else drawSlide(n);
      L.items.forEach(it => it.slide === '*' && !it.top && drawItem(ctx, P, it));
    } else L.items.forEach(it => !it.top && drawItem(ctx, P, it));
    L.over?.(ctx, P);
    L.items.forEach(it => it.top && (!SL || it.slide === '*' || it.slide === n) && drawItem(ctx, P, it));
    // optional fade at the very end so a looping video starts again cleanly
    if (Number.isFinite(t) && slide == null && state.outro === 'fade') {
      const f = clamp((t - (durOf(P) - .45)) / .45, 0, 1);
      if (f > 0) { ctx.globalAlpha = f; ctx.fillStyle = L.bg; ctx.fillRect(0, 0, P.w, P.h); ctx.globalAlpha = 1; }
    }
  } finally { NOW = Infinity; DC = MC; CUR_EDITOR = false; }
  if (editor && P.safe && state.guides) {
    const s = P.safe;
    ctx.fillStyle = 'rgba(8,8,14,.38)';
    ctx.fillRect(0, 0, P.w, P.h * s.t); ctx.fillRect(0, P.h * (1 - s.b), P.w, P.h * s.b);
    ctx.fillRect(0, P.h * s.t, P.w * s.l, P.h * (1 - s.t - s.b)); ctx.fillRect(P.w * (1 - s.r), P.h * s.t, P.w * s.r, P.h * (1 - s.t - s.b));
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    ctx.strokeRect(P.w * s.l, P.h * s.t, P.w * (1 - s.l - s.r), P.h * (1 - s.t - s.b)); ctx.setLineDash([]);
  }
}

/* ---------- views ---------- */
// the editor plays the animation on a loop; any edit re-plans every size
let drawQueued = false, playing = true, playT = 0, lastTs = 0, exporting = false;
function redraw() {
  planVersion++;
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; state.view === 'grid' ? drawGrid() : drawSingle(true); });
}
let shownKey = '', lastShown = -1;
function drawSingle(full) {
  const P = presetOf(state.size), wrapEl = $('#canvasWrap'), c = $('#ad');
  const aw = wrapEl.clientWidth - 40, ah = wrapEl.clientHeight - 40;
  const k = Math.max(.05, Math.min(aw / P.w, ah / P.h, 3)), dpr = window.devicePixelRatio || 1;
  const key = `${P.w}x${P.h}@${k}`;
  if (full || key !== shownKey) {
    shownKey = key;
    c.width = Math.round(P.w * k * dpr); c.height = Math.round(P.h * k * dpr);
    c.style.width = `${Math.round(P.w * k)}px`; c.style.height = `${Math.round(P.h * k)}px`;
  }
  viewK = k;
  render(c.getContext('2d'), P, k * dpr, true, playT, frozen() ? editSlide : null);
  drawSelection(c.getContext('2d'), P, k * dpr);
  $('#scrub').value = Math.round(playT / durOf(P) * 1000);
  // while it plays, the slide strip and the layers list follow the slide on screen
  const ss = shownSlide();
  if (ss !== lastShown) { lastShown = ss; markPlaying(); renderLayers(); }
  $('#timeRead').textContent = `${playT.toFixed(1)}s`;
  if (!full) return;
  renderSlideBar();
  $('#sizeInfo').innerHTML = `<b>${esc(P.name)}</b> <span class="mono">${P.w}×${P.h} · ${Math.round(k * 100)}%</span>`;
  $('#sizeInfo').title = P.note || '';
  $('[data-bind="guides"]').closest('label').hidden = !P.safe;
  const warn = [];
  if (state.sizes[P.key]?.endorser && !state.endorser.photo) warn.push('No endorser photo yet: add one on the Endorser tab.');
  if (usePhotos() && state.candidates.some(c => !c.photo)) warn.push('Some candidates have no photo yet.');
  if (/\[/.test(JSON.stringify([state.text, msgOf(P)]))) warn.push('Placeholder text is still in the ad.');
  if (!state.sizes[P.key]?.disclaimer || !state.text.disclaimer.trim()) warn.push('No disclaimer on this size.');
  $('#warnings').textContent = warn.join(' ');
}
/* ---------- direct editing: slides, layers, click, drag, snapping, the inspector ---------- */
let selId = null, selIds = [], hoverId = null, dragging = null, viewK = 1, editSlide = null, guides = [], dragNote = '';
const curPlan = () => { const P = presetOf(state.size); return { P, L: plan(P, themeFor(P)) }; };
// the slide on screen: the one being edited, or (while it plays) the one the animation is on
function shownSlide() {
  const { L } = curPlan();
  if (!L.slides?.length) return 0;
  if (editSlide != null) return clamp(editSlide, 0, L.slides.length - 1);
  return slideAt(L, state.motion === 'none' ? Infinity : playT * speedOf(L));
}
const frozen = () => !playing && editSlide != null;
const currentItems = () => {
  const { P, L } = curPlan(), k = shownSlide();
  return { P, L, items: L.items.filter(it => it.id && (!L.slides?.length || it.slide === k || it.slide === '*') && !it.off?.(P)) };
};
/* the selection: selId is the element clicked last, selIds everything selected (selId among them).
   Code elsewhere may just set selId; syncSel squares the two up against what's on the slide. */
function syncSel(items) {
  if (!selId) { selIds = []; return; }
  const here = new Set(items.map(i => i.id));
  selIds = selIds.filter(id => here.has(id));
  if (!here.has(selId)) selId = selIds[selIds.length - 1] || null;
  else if (!selIds.includes(selId)) selIds = [selId];
}
const selItems = () => { const { items } = currentItems(); syncSel(items); return selIds.map(id => items.find(i => i.id === id)).filter(Boolean); };
const selectOnly = id => { selId = id || null; selIds = id ? [id] : []; };
function toggleSel(id) {
  if (selIds.includes(id)) { selIds = selIds.filter(x => x !== id); selId = selIds[selIds.length - 1] || null; }
  else { selIds = [...selIds, id]; selId = id; }
}
// what moves when the selection moves: no backgrounds, and no line whose card is moving anyway
const movers = list => list.filter(it => !it.fixed && !(it.parent && list.some(o => o.id === it.parent)));
const unionBox = bs => { const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y)), x1 = Math.max(...bs.map(b => b.x + b.w)), y1 = Math.max(...bs.map(b => b.y + b.h)); return { x, y, w: x1 - x, h: y1 - y, cx: (x + x1) / 2, cy: (y + y1) / 2 }; };
const groupBox = (P, list) => list.length === 1 ? itemBox(P, list[0]) : unionBox(list.map(it => itemBox(P, it)));
const nameOf = id => currentItems().items.find(i => i.id === id)?.name || id;
const adPoint = e => { const r = $('#ad').getBoundingClientRect(); return { x: (e.clientX - r.left) / viewK, y: (e.clientY - r.top) / viewK }; };
const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
function hit(p) {
  const { P, items } = currentItems();
  // the smallest box under the pointer wins, so a line of text inside a big panel can be picked
  const area = it => { const b = itemBox(P, it); return b.w * b.h; };
  // (shapes marked hitLast, like the frame behind a photo, only when nothing else is there; pick them in Layers)
  return items.filter(it => inBox(p, itemBox(P, it))).sort((a, b) => (a.hitLast - b.hitLast) || area(a) - area(b))[0]?.id || null;
}
const handleSize = () => 11 / viewK;
function onHandle(p) {
  const { P } = currentItems(), list = movers(selItems());
  if (!list.length) return false;
  const b = groupBox(P, list), hs = handleSize();
  return Math.abs(p.x - (b.x + b.w)) < hs && Math.abs(p.y - (b.y + b.h)) < hs;
}
// exact numbers: positions and sizes in ad pixels, whatever the element's parent (a card) does
const parentScale = (P, it) => (it.parent && tweaksFor(P)[it.parent]?.s) || 1;
const fontPx = (P, it) => it.fs ? it.fs * (tweaksFor(P)[it.id]?.s ?? 1) * parentScale(P, it) : null;
function moveBy(P, it, ddx, ddy) {
  const tk = tweakOf(P, it.id, true), ps = parentScale(P, it);
  tk.dx = (tk.dx || 0) + ddx / (P.w * ps); tk.dy = (tk.dy || 0) + ddy / (P.h * ps);
}
// the design's margins (on Stories, the safe area)
function marginBox(P) {
  if (P.safe) return { x: P.w * P.safe.l, y: P.h * P.safe.t, w: P.w * (1 - P.safe.l - P.safe.r), h: P.h * (1 - P.safe.t - P.safe.b) };
  const pad = Math.round(clamp(Math.min(P.w, P.h) * .055, 4, 60));
  return { x: pad, y: pad, w: P.w - pad * 2, h: P.h - pad * 2 };
}
// the same element on the other slides: every judge slide is built alike (s1.name.1, s2.name.1, ...)
const twinsOf = (L, id) => /^s\d+\./.test(id) ? L.items.filter(o => o.id && o.id !== id && /^s\d+\./.test(o.id) && o.id.replace(/^s\d+\./, '') === id.replace(/^s\d+\./, '')) : [];
const slideLabel = (L, o) => o.slide === '*' ? 'every slide' : L.slides?.length > 1 ? `slide ${o.slide + 1}` : '';

/* snapping: the dragged selection's edges and center snap to the ad's edges, center and margins, to the
   other elements on the slide, and (one element) to its twins on the other slides, so names line up slide to slide */
function snapMove(P, list, off) {
  guides = [];
  const b = groupBox(P, list), one = list.length === 1 ? list[0] : null;
  dragNote = `X ${Math.round(b.x)}  Y ${Math.round(b.y)}`;
  if (!state.snap || off) return;
  const L = list[0]._L, M = marginBox(P), k = shownSlide(), T = tweaksFor(P), thr = 6 / viewK;
  const xs = [[0, 'edge'], [P.w / 2, 'center'], [P.w, 'edge'], [M.x, 'margin'], [M.x + M.w, 'margin']].map(([v, kind]) => ({ v, kind }));
  const ys = [[0, 'edge'], [P.h / 2, 'center'], [P.h, 'edge'], [M.y, 'margin'], [M.y + M.h, 'margin']].map(([v, kind]) => ({ v, kind }));
  const skip = new Set();
  list.forEach(it => { skip.add(it.id); if (it.parent) skip.add(it.parent); });
  L.items.forEach(o => { if (o.parent && skip.has(o.parent)) skip.add(o.id); });
  const twins = new Set(one ? twinsOf(L, one.id).map(o => o.id) : []);
  L.items.forEach(o => {
    if (!o.id || o.fixed || skip.has(o.id) || T[o.id]?.hidden || o.off?.(P)) return;
    const here = !L.slides?.length || o.slide === k || o.slide === '*';
    if (!here && !twins.has(o.id)) return;
    const ob = itemBox(P, o), kind = here ? 'item' : 'twin';
    xs.push({ v: ob.x, kind, ob, o }, { v: ob.cx, kind, ob, o }, { v: ob.x + ob.w, kind, ob, o });
    ys.push({ v: ob.y, kind, ob, o }, { v: ob.cy, kind, ob, o }, { v: ob.y + ob.h, kind, ob, o });
  });
  // twins win ties, so a judge's name prefers lining up with the same name on the other slides
  const best = (edges, tg) => { let r = null; for (const e of edges) for (const t of tg) { const d = t.v - e, a = Math.abs(d) - (t.kind === 'twin' ? .01 : 0); if (Math.abs(d) < thr && (!r || a < r.a)) r = { d, a, t }; } return r; };
  const bx = best([b.x, b.cx, b.x + b.w], xs), by = best([b.y, b.cy, b.y + b.h], ys);
  if (!bx && !by) return;
  list.forEach(it => moveBy(P, it, bx?.d || 0, by?.d || 0));
  const nb = groupBox(P, list), notes = [];
  const span = (t, lo, hi, full) => t.ob && t.kind === 'item' ? [Math.min(lo, t.ob[full ? 'y' : 'x']), Math.max(hi, t.ob[full ? 'y' : 'x'] + t.ob[full ? 'h' : 'w'])] : [0, full ? P.h : P.w];
  if (bx) { const [a, z] = span(bx.t, nb.y, nb.y + nb.h, true); guides.push({ axis: 'x', v: bx.t.v, a, z, kind: bx.t.kind }); if (bx.t.kind === 'twin') notes.push(`lines up with ${bx.t.o.name} (${slideLabel(L, bx.t.o)})`); }
  if (by) { const [a, z] = span(by.t, nb.x, nb.x + nb.w, false); guides.push({ axis: 'y', v: by.t.v, a, z, kind: by.t.kind }); if (by.t.kind === 'twin' && !notes.length) notes.push(`lines up with ${by.t.o.name} (${slideLabel(L, by.t.o)})`); }
  dragNote = `X ${Math.round(nb.x)}  Y ${Math.round(nb.y)}${notes.length ? ' · ' + notes[0] : ''}`;
}
// resizing text snaps to the font sizes already used anywhere in the ad (any slide)
function snapSize(P, it, off) {
  guides = [];
  const fs = fontPx(P, it);
  if (!fs) { const b = itemBox(P, it); dragNote = `${Math.round(b.w)} × ${Math.round(b.h)}`; return; }
  if (state.snap && !off) {
    let best = null;
    for (const o of it._L.items) {
      if (!o.fs || o.id === it.id) continue;
      const f = fontPx(P, o), d = Math.abs(f - fs) / f;
      if (d < .035 && (!best || d < best.d)) best = { d, f, o };
    }
    if (best) { tweakOf(P, it.id, true).s *= best.f / fs; dragNote = `${Math.round(best.f)}px · same as ${best.o.name}${best.o.slide !== it.slide ? ` (${slideLabel(it._L, best.o)})` : ''}`; return; }
  }
  dragNote = `${Math.round(fs)}px`;
}
const SEL = '#ff2d95';
function drawSelection(ctx, P, K) {
  const { items } = currentItems();
  syncSel(items);
  ctx.setTransform(K, 0, 0, K, 0, 0);
  const lw = 1.6 / viewK, inset = it => { const b = itemBox(P, it); return it.fixed ? { x: b.x + lw * 2, y: b.y + lw * 2, w: b.w - lw * 4, h: b.h - lw * 4 } : b; };
  const hov = !dragging && hoverId && !selIds.includes(hoverId) && items.find(i => i.id === hoverId);
  if (hov) { const b = inset(hov); ctx.strokeStyle = 'rgba(255,45,149,.75)'; ctx.lineWidth = lw; ctx.setLineDash([5 / viewK, 4 / viewK]); ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]); }
  // alignment guides while dragging
  for (const g of guides) {
    ctx.strokeStyle = g.kind === 'twin' ? '#3ee0ff' : SEL; ctx.lineWidth = lw;
    ctx.setLineDash(g.kind === 'margin' || g.kind === 'twin' ? [6 / viewK, 4 / viewK] : []);
    ctx.beginPath();
    if (g.axis === 'x') { ctx.moveTo(g.v, g.a); ctx.lineTo(g.v, g.z); } else { ctx.moveTo(g.a, g.v); ctx.lineTo(g.z, g.v); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  const list = selIds.map(id => items.find(i => i.id === id)).filter(Boolean), mv = movers(list);
  list.forEach(it => { const b = inset(it); ctx.strokeStyle = SEL; ctx.lineWidth = lw * (list.length > 1 ? 1.1 : 1.4); ctx.strokeRect(b.x, b.y, b.w, b.h); });
  let gb = null;
  if (mv.length) {
    gb = groupBox(P, mv);
    if (mv.length > 1) { ctx.strokeStyle = SEL; ctx.lineWidth = lw; ctx.setLineDash([7 / viewK, 4 / viewK]); ctx.strokeRect(gb.x - 3 / viewK, gb.y - 3 / viewK, gb.w + 6 / viewK, gb.h + 6 / viewK); ctx.setLineDash([]); }
    const hs = handleSize(); ctx.fillStyle = '#fff'; ctx.lineWidth = lw * 1.4;
    ctx.fillRect(gb.x + gb.w - hs / 2, gb.y + gb.h - hs / 2, hs, hs); ctx.strokeRect(gb.x + gb.w - hs / 2, gb.y + gb.h - hs / 2, hs, hs);
  }
  // a box dragged across the ad selects what it touches
  if (dragging?.mode === 'marquee' && dragging.moved) {
    const r = dragging.rect; ctx.fillStyle = 'rgba(255,45,149,.08)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = SEL; ctx.lineWidth = lw; ctx.strokeRect(r.x, r.y, r.w, r.h);
  }
  // a readout under the selection while dragging: position, size, or the font size it matched
  if (gb && dragging && dragging.mode !== 'marquee' && dragNote) {
    const b = gb, fsz = 11.5 / viewK; ctx.font = `600 ${fsz}px system-ui, sans-serif`;
    const tw = ctx.measureText(dragNote).width, pw = tw + fsz * 1.2, ph = fsz * 1.8;
    let x = clamp(b.x + b.w / 2 - pw / 2, 2 / viewK, P.w - pw - 2 / viewK), y = b.y + b.h + fsz * .8;
    if (y + ph > P.h) y = b.y - ph - fsz * .6;
    ctx.fillStyle = SEL; ctx.beginPath(); ctx.roundRect(x, y, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(dragNote, x + fsz * .6, y + ph / 2); ctx.textBaseline = 'alphabetic';
  }
}
const ad = $('#ad');
const startEditing = () => { if (!frozen()) editSlide = shownSlide(); setPlaying(false); };
/* on the ad: click selects, Shift/Cmd/Ctrl-click adds or removes, drag moves the selection, the corner
   handle resizes it, and a drag that starts on empty space (or a background) draws a selection box */
const addKey = e => e.shiftKey || e.metaKey || e.ctrlKey;
ad.addEventListener('pointerdown', e => {
  const p = adPoint(e);
  // editing freezes the slide that was on screen, fully built
  startEditing();
  const { P, items } = currentItems();
  syncSel(items);
  const add = addKey(e);
  if (!add && onHandle(p)) {
    const list = movers(selItems()), gb = groupBox(P, list);
    dragging = { mode: 'size', list, cx: gb.cx, cy: gb.cy, d0: Math.max(4, Math.hypot(p.x - gb.cx, p.y - gb.cy)),
      start: list.map(it => { const b = itemBox(P, it); return { it, s0: tweakOf(P, it.id)?.s ?? 1, cx: b.cx, cy: b.cy }; }) };
  } else {
    const id = hit(p), it = id && items.find(i => i.id === id);
    if (it && !it.fixed) {
      if (add) toggleSel(id);
      else if (selIds.includes(id)) selId = id; // keep the group, so it can be dragged together
      else selectOnly(id);
      const list = movers(selItems());
      if (!add && list.length) dragging = { mode: 'move', list, x0: p.x, y0: p.y, start: list.map(o => { const tk = tweakOf(P, o.id) || NO_TWEAK; return { dx: tk.dx || 0, dy: tk.dy || 0 }; }), moved: false };
    } else dragging = { mode: 'marquee', x0: p.x, y0: p.y, rect: { x: p.x, y: p.y, w: 0, h: 0 }, base: add ? [...selIds] : [], hitId: id, add, moved: false };
  }
  if (dragging) ad.setPointerCapture(e.pointerId);
  renderSlideBar(); renderTweakBar(); drawSingle(false);
});
ad.addEventListener('pointermove', e => {
  const p = adPoint(e), P = presetOf(state.size);
  if (dragging) {
    if (dragging.mode !== 'size' && !dragging.moved && Math.hypot(p.x - dragging.x0, p.y - dragging.y0) < 3 / viewK) return; // a click, not a drag
    dragging.moved = true;
    if (dragging.mode === 'move') {
      dragging.list.forEach((it, j) => { const tk = tweakOf(P, it.id, true), ps = parentScale(P, it), s0 = dragging.start[j];
        tk.dx = s0.dx + (p.x - dragging.x0) / (P.w * ps); tk.dy = s0.dy + (p.y - dragging.y0) / (P.h * ps); });
      snapMove(P, dragging.list, e.altKey);
    } else if (dragging.mode === 'size') {
      const f = Math.hypot(p.x - dragging.cx, p.y - dragging.cy) / dragging.d0;
      if (dragging.list.length === 1) { const it = dragging.list[0]; tweakOf(P, it.id, true).s = clamp(dragging.start[0].s0 * f, .1, 6); snapSize(P, it, e.altKey); }
      else {
        // a group grows from its middle: each element scales and its center moves out with it
        dragging.start.forEach(({ it, s0, cx, cy }) => {
          tweakOf(P, it.id, true).s = clamp(s0 * f, .1, 6);
          const b = itemBox(P, it); moveBy(P, it, dragging.cx + (cx - dragging.cx) * f - b.cx, dragging.cy + (cy - dragging.cy) * f - b.cy);
        });
        guides = []; dragNote = `${Math.round(f * 100)}%`;
      }
    } else {
      const r = { x: Math.min(p.x, dragging.x0), y: Math.min(p.y, dragging.y0), w: Math.abs(p.x - dragging.x0), h: Math.abs(p.y - dragging.y0) };
      dragging.rect = r;
      const touched = currentItems().items.filter(it => { if (it.fixed) return false; const b = itemBox(P, it); return b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y; }).map(it => it.id);
      selIds = [...new Set([...dragging.base, ...touched])]; selId = selIds[selIds.length - 1] || null;
      renderTweakBar(); drawSingle(false); return;
    }
    renderTweakBar(true); drawSingle(false); return;
  }
  const h = onHandle(p) ? selId : hit(p), it = h && currentItems().items.find(i => i.id === h);
  ad.style.cursor = onHandle(p) ? 'nwse-resize' : it ? (it.fixed ? 'crosshair' : 'move') : 'crosshair';
  if (h !== hoverId) { hoverId = h; drawSingle(false); markLayer(); }
});
const endDrag = () => {
  if (!dragging) return;
  const d = dragging; dragging = null; guides = []; dragNote = '';
  // a click (no drag) on a background or empty space: select the background, or clear
  if (d.mode === 'marquee' && !d.moved) { if (d.add) { if (d.hitId) toggleSel(d.hitId); } else selectOnly(d.hitId); }
  if (d.mode !== 'marquee' && d.moved) save();
  renderTweakBar(); renderSlideBar(); drawSingle(false);
};
ad.addEventListener('pointerup', endDrag);
ad.addEventListener('pointercancel', endDrag);
ad.addEventListener('pointerleave', () => { if (!dragging && hoverId) { hoverId = null; drawSingle(false); markLayer(); } });

/* the slide strip under the ad: a thumbnail per slide (click to edit it) and how long each stays up */
function renderSlideBar() {
  const { P, L } = curPlan(), bar = $('#slideBar');
  if (!L.slides || L.slides.length < 2) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  const k = frozen() ? clamp(editSlide, 0, L.slides.length - 1) : -1, lens = slideLens(L), lay = layoutOf(P), n = L.slides.length;
  const custom = Object.keys(state.slideTimes[lay] || {}).length > 0, dur = durOf(P);
  const th = 52, tw = Math.min(110, th * P.w / P.h), thH = tw * P.h / P.w;
  const cards = L.slides.map((s, j) => `<div class="slide-card${j === k ? ' active' : ''}" data-slide="${j}" title="Edit slide ${j + 1}">
      <canvas width="${Math.round(tw * 2)}" height="${Math.round(thH * 2)}" style="width:${Math.round(tw)}px;height:${Math.round(thH)}px"></canvas>
      <span class="sc-name">${j + 1}<b>${esc(s.name)}</b></span><span class="sc-len"><input type="number" data-len="${j}" min=".5" max="10" step=".1" value="${lens[j].toFixed(1)}" title="Seconds on screen">s</span>
    </div>`).join('');
  const note = dur > L.total + .05 ? `The end card holds to fill the ${state.duration}s Length setting.` : '';
  bar.innerHTML = `<div class="strip-cards">${cards}</div>
    <div class="strip-side"><span class="strip-total"><b>${dur.toFixed(1)}s</b> total</span>
      ${k > 0 && k < n - 1 && n > 3 ? `<button id="slAll" class="ghost sm">Give slides 2–${n - 1} this length</button>` : ''}
      ${custom ? '<button id="slReset" class="ghost sm">Reset timing</button>' : ''}
      <span class="hint">${note} Timing applies to every size in this design.</span></div>`;
  $$('#slideBar .slide-card').forEach((c, j) => {
    const cv = $('canvas', c);
    render(cv.getContext('2d'), P, cv.width / P.w, false, Infinity, j);
    c.onclick = e => { if (e.target.closest('input')) return; editSlide = j; selId = null; setPlaying(false); renderSlideBar(); renderTweakBar(); drawSingle(false); };
  });
  const setLen = (js, v) => { const t = (state.slideTimes[lay] ||= {}); js.forEach(j => { t[j] = Math.round(clamp(v, .5, 10) * 10) / 10; }); planVersion++; };
  $$('#slideBar [data-len]').forEach(el => {
    el.oninput = () => { const v = +el.value; if (!(v >= .5 && v <= 10)) return; setLen([+el.dataset.len], v); $('.strip-total b', bar).textContent = `${durOf(P).toFixed(1)}s`; drawSingle(false); };
    el.onchange = () => { save(); renderSlideBar(); };
  });
  $('#slAll')?.addEventListener('click', () => { setLen([...Array(n - 2)].map((_, j) => j + 1), lens[k]); save(); renderSlideBar(); drawSingle(false); });
  $('#slReset')?.addEventListener('click', () => { delete state.slideTimes[lay]; planVersion++; save(); renderSlideBar(); drawSingle(false); });
}
// while it plays, the strip follows along
function markPlaying() {
  const k = playing ? shownSlide() : -1;
  $$('#slideBar .slide-card').forEach((c, j) => c.classList.toggle('playing', j === k));
}

/* the layers list (left panel): everything on the slide, top first; click to select, eye to hide */
const ICONS = {
  text: '<svg viewBox="0 0 16 16"><path d="M3 3h10M8 3v10" /></svg>',
  pill: '<svg viewBox="0 0 16 16"><rect x="1.5" y="4.5" width="13" height="7" rx="3.5"/></svg>',
  photo: '<svg viewBox="0 0 16 16"><circle cx="8" cy="6" r="2.6"/><path d="M3 14c.6-3 2.6-4.4 5-4.4s4.4 1.4 5 4.4"/></svg>',
  shape: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/></svg>',
  bg: '<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M2 11l4-4 3 3 2-2 3 3"/></svg>',
  eye: '<svg viewBox="0 0 16 16"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  eyeOff: '<svg viewBox="0 0 16 16"><path d="M2 2l12 12M6.3 4c.5-.2 1.1-.4 1.7-.4 4 0 6.5 4.4 6.5 4.4s-.7 1.3-2 2.5M10 11.9c-.6.4-1.3.6-2 .6-4 0-6.5-4.5-6.5-4.5s.8-1.4 2.2-2.6"/></svg>',
};
const kindOf = it => it.fixed ? 'bg' : it.textual ? (it.fillable ? 'pill' : 'text') : /photo|face|judge\d/.test(it.id) ? 'photo' : 'shape';
function renderLayers() {
  const box = $('#layerList'); if (!box) return;
  const { P, L, items } = currentItems(), T = tweaksFor(P), k = shownSlide(), multi = L.slides?.length > 1, sname = multi ? L.slides[k].name : '';
  const short = it => { const n = it.name || it.id; return sname && n.startsWith(sname + ' · ') ? n.slice(sname.length + 3) : n; };
  const row = it => { const tk = T[it.id], edited = tk && Object.keys(tk).some(x => x === 'dx' || x === 'dy' ? Math.abs(tk[x]) > 1e-6 : x === 's' ? tk.s !== 1 : x !== 'hidden');
    return `<div class="layer${selIds.includes(it.id) ? ' sel' : ''}${tk?.hidden ? ' off' : ''}${it.parent ? ' child' : ''}" data-id="${esc(it.id)}"><span class="lk">${ICONS[kindOf(it)]}</span><span class="ln">${esc(short(it))}</span>${edited ? '<i class="dot" title="Edited"></i>' : ''}<button class="eye" data-eye="${esc(it.id)}" title="${tk?.hidden ? 'Show' : 'Hide'}">${tk?.hidden ? ICONS.eyeOff : ICONS.eye}</button></div>`; };
  // top of the stack first, children right under their card
  const order = list => { const top = list.filter(i => !i.parent).reverse(), out = []; top.forEach(t => { out.push(t); list.filter(c => c.parent === t.id).forEach(c => out.push(c)); }); list.filter(c => c.parent && !list.some(t => t.id === c.parent)).forEach(c => out.push(c)); return out; };
  const here = items.filter(i => i.slide !== '*' || !multi), all = multi ? items.filter(i => i.slide === '*') : [];
  const any = Object.keys(T).length, shown = [...order(here), ...order(all)];
  box.innerHTML = `<div class="layers-head"><b>${multi ? `Slide ${k + 1} · ${esc(sname)}` : 'This ad'}</b>${multi && !frozen() ? '<span class="hint">Playing. Click a layer or a slide to edit.</span>' : ''}</div>
    ${order(here).map(row).join('')}
    ${all.length ? `<div class="layers-sub">On every slide</div>${order(all).map(row).join('')}` : ''}
    ${any ? '<button id="tkResetAll" class="ghost sm">Reset all edits on this size</button>' : ''}
    <p class="hint">Edits apply to this size in this design. Shift- or Cmd-click (here or on the ad) to select several, or drag a box across the ad. Drag to move, drag the corner to resize, arrow keys nudge (Shift = 10px). Hold Alt while dragging to skip snapping.</p>`;
  $$('.layer', box).forEach(r => {
    r.onclick = e => {
      if (e.target.closest('[data-eye]')) return;
      startEditing(); syncSel(items);
      const id = r.dataset.id;
      if (e.shiftKey && selId) { const a = shown.findIndex(o => o.id === selId), z = shown.findIndex(o => o.id === id); const [lo, hi] = a < z ? [a, z] : [z, a]; selIds = [...new Set([...selIds, ...shown.slice(lo, hi + 1).map(o => o.id)])]; selId = id; }
      else if (e.metaKey || e.ctrlKey) toggleSel(id);
      else selectOnly(id);
      renderSlideBar(); renderTweakBar(); drawSingle(false);
    };
    r.onmouseenter = () => { hoverId = r.dataset.id; drawSingle(false); };
    r.onmouseleave = () => { hoverId = null; drawSingle(false); };
  });
  $$('[data-eye]', box).forEach(b => b.onclick = () => { const t = tweakOf(P, b.dataset.eye, true); t.hidden = !t.hidden; save(); renderTweakBar(); drawSingle(false); });
  $('#tkResetAll', box)?.addEventListener('click', () => { if (confirm('Clear every edit on this size in this design?')) { if (state.tweaks[P.key]) delete state.tweaks[P.key][layoutOf(P)]; save(); renderTweakBar(); renderSlideBar(); drawSingle(false); } });
}
const markLayer = () => $$('#layerList .layer').forEach(r => r.classList.toggle('hov', r.dataset.id === hoverId));

/* the inspector (right panel, while something is selected): exact numbers for everything */
const swatches = () => [state.colors.yellow, state.colors.blue, state.colors.white, state.colors.black];
const colorCtl = (key, label, cur) => `<div class="ctl col"><span class="lab">${label}</span><span class="sws">${swatches().map(c => `<button class="sw${cur && cur.toLowerCase() === c.toLowerCase() ? ' on' : ''}" data-col="${key}" data-v="${c}" style="background:${c}" title="${c}"></button>`).join('')}<input type="color" data-colin="${key}" value="${cur || '#ffffff'}" title="Any color">${cur ? `<button class="tk-x" data-colclear="${key}" title="Back to the design's color">↺</button>` : ''}</span></div>`;
const ALIGN = [
  ['l', 'Align left (Shift: to the ad edge)', '<path d="M2 1v14"/><rect x="4" y="4" width="9" height="3"/><rect x="4" y="9" width="6" height="3"/>'],
  ['ch', 'Center across the ad', '<path d="M8 1v14"/><rect x="2.5" y="4" width="11" height="3"/><rect x="4.5" y="9" width="7" height="3"/>'],
  ['r', 'Align right (Shift: to the ad edge)', '<path d="M14 1v14"/><rect x="3" y="4" width="9" height="3"/><rect x="6" y="9" width="6" height="3"/>'],
  ['t', 'Align top (Shift: to the ad edge)', '<path d="M1 2h14"/><rect x="4" y="4" width="3" height="9"/><rect x="9" y="4" width="3" height="6"/>'],
  ['cv', 'Center down the ad', '<path d="M1 8h14"/><rect x="4" y="2.5" width="3" height="11"/><rect x="9" y="4.5" width="3" height="7"/>'],
  ['b', 'Align bottom (Shift: to the ad edge)', '<path d="M1 14h14"/><rect x="4" y="3" width="3" height="9"/><rect x="9" y="6" width="3" height="6"/>'],
];
function inspectorValues(P, it) {
  const tk = tweaksFor(P)[it.id] || {}, b = itemBox(P, it), d = roleDefaults(it.role), dh = roleDefaults('heavy');
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), s: Math.round((tk.s ?? 1) * 100),
    fs: it.fs ? Math.round(fontPx(P, it) * 10) / 10 : '', weight: tk.weight ?? d?.weight ?? '', width: tk.width ?? d?.width ?? '',
    hweight: tk.hweight ?? dh?.weight ?? '', delay: tk.delay ?? 0 };
}
// text keeps its aligned edge (and its top) when its size, weight or width changes, like a layout app
const anchorX = (it, b) => it.align === 'right' ? b.x + b.w : it.align === 'center' ? b.cx : b.x;
function keepAnchor(P, it, b, fn) {
  fn();
  if (!it.textual || !it.align) return;
  const nb = itemBox(P, it);
  moveBy(P, it, anchorX(it, b) - anchorX(it, nb), b.y - nb.y);
}
function setValue(P, it, key, v) {
  const tk = tweakOf(P, it.id, true), b = itemBox(P, it);
  if (key === 'x') moveBy(P, it, v - b.x, 0);
  else if (key === 'y') moveBy(P, it, 0, v - b.y);
  else if (key === 'w') { if (v > 0 && b.w > 0) keepAnchor(P, it, b, () => { tk.s = (tk.s ?? 1) * v / b.w; }); }
  else if (key === 's') keepAnchor(P, it, b, () => { tk.s = v / 100; });
  else if (key === 'fs') { if (v > 0) keepAnchor(P, it, b, () => { tk.s = v / (it.fs * parentScale(P, it)); }); }
  else if (key === 'weight' || key === 'width' || key === 'hweight') keepAnchor(P, it, b, () => { tk[key] = v; });
  else tk[key] = v;
}
// copy an element's edits to its twins on the other slides: same font size in px, and lined up
// on the same edge (text) or moved the same way (photos, shapes)
function copyToTwins(P, it, twins) {
  const src = tweaksFor(P)[it.id], all = state.tweaks[P.key]?.[layoutOf(P)];
  if (!src) { twins.forEach(o => { if (all) delete all[o.id]; }); return; }
  const sb = itemBox(P, it), sf = fontPx(P, it);
  twins.forEach(o => {
    all[o.id] = JSON.parse(JSON.stringify(src));
    if (!it.textual || !o.fs || !sf) return;
    const t = all[o.id]; t.dx = 0; t.dy = 0;
    t.s = sf / (o.fs * parentScale(P, o));
    const ob = itemBox(P, o);
    moveBy(P, o, anchorX(it, sb) - anchorX(o, ob), sb.y - ob.y);
  });
}
function syncInspector(P, it, except) {
  const v = inspectorValues(P, it), box = $('#inspector');
  $$('[data-num]', box).forEach(el => { if (el !== except && el !== document.activeElement) el.value = v[el.dataset.num]; });
  $$('[data-sl]', box).forEach(el => { if (el !== except) el.value = v[el.dataset.sl]; });
}
function renderTweakBar(valuesOnly) {
  const { P, L, items } = currentItems(), box = $('#inspector');
  syncSel(items);
  const many = selIds.map(id => items.find(i => i.id === id)).filter(Boolean);
  if (many.length > 1) {
    const key = 'multi:' + selIds.join(',');
    if (valuesOnly && box.dataset.id === key && !box.hidden) { syncMulti(P, many); return; }
    renderLayers(); $('#settings').hidden = true; box.hidden = false; box.dataset.id = key;
    renderMulti(P, L, many, box); return;
  }
  const it = selId && items.find(i => i.id === selId);
  if (valuesOnly && it && box.dataset.id === it.id && !box.hidden) { syncInspector(P, it); return; }
  renderLayers();
  $('#settings').hidden = !!it; box.hidden = !it;
  if (!it) { box.innerHTML = ''; box.dataset.id = ''; return; }
  box.dataset.id = it.id;
  const tk = tweakOf(P, it.id) || {}, v = inspectorValues(P, it), d = roleDefaults(it.role), dh = roleDefaults('heavy'), twins = twinsOf(L, it.id);
  const where = slideLabel(L, it);
  const num = (key, label, o = {}) => `<label class="num"><span>${label}</span><input type="number" data-num="${key}" value="${v[key]}" step="${o.step ?? 1}"${o.min != null ? ` min="${o.min}"` : ''}${o.max != null ? ` max="${o.max}"` : ''}${o.ro ? ' readonly tabindex="-1"' : ''}>${o.unit ? `<i>${o.unit}</i>` : ''}</label>`;
  const slider = (key, min, max, step) => `<input type="range" class="sl" data-sl="${key}" min="${min}" max="${max}" step="${step}" value="${v[key]}">`;
  const sec = (title, body) => `<section><h4>${title}</h4>${body}</section>`;
  const parts = [`<div class="insp-head"><div><small>${esc(where ? where[0].toUpperCase() + where.slice(1) : 'Element')}</small><b>${esc(it.name || it.id)}</b></div><button id="tkClose" class="x" title="Done (Esc)">✕</button></div>`];
  if (!it.fixed) parts.push(sec('Position and size', `<div class="grid2">${num('x', 'X', { unit: 'px' })}${num('y', 'Y', { unit: 'px' })}${num('w', 'W', { min: 1, unit: 'px' })}${num('h', 'H', { ro: true, unit: 'px' })}</div>
    <div class="ctl">${num('s', 'Scale', { min: 10, max: 600, unit: '%' })}${slider('s', 10, 300, 1)}</div>
    <div class="align-row">${ALIGN.map(([k, t, svg]) => `<button data-align="${k}" title="${t}"><svg viewBox="0 0 16 16">${svg}</svg></button>`).join('')}</div>`));
  if (it.textual && d) {
    const sizes = L.items.filter(o => o.fs && o.id !== it.id).map(o => ({ o, f: Math.round(fontPx(P, o)) }));
    parts.push(sec('Text', `<div class="ctl">${num('fs', 'Font size', { min: 2, max: 900, step: .5, unit: 'px' })}${slider('fs', 4, Math.max(200, Math.ceil(v.fs * 2)), .5)}</div>
      <select id="tkMatch"><option value="">Match the font size of…</option>${sizes.map(({ o, f }) => `<option value="${esc(o.id)}">${f}px · ${esc(o.name)}${o.slide !== it.slide ? ` (${slideLabel(L, o)})` : ''}</option>`).join('')}</select>
      <div class="ctl">${num('weight', 'Weight', { min: 100, max: 900, step: 10 })}${slider('weight', 100, 900, 10)}</div>
      <div class="ctl">${num('width', 'Width', { min: 25, max: 200, unit: '%' })}${slider('width', 25, 200, 1)}</div>
      ${colorCtl('color', 'Color', tk.color)}
      ${it.hasHi ? colorCtl('hcolor', 'Highlight', tk.hcolor) + (dh ? `<div class="ctl">${num('hweight', 'Highlight weight', { min: 100, max: 900, step: 10 })}${slider('hweight', 100, 900, 10)}</div>` : '') : ''}`));
  }
  if (it.framable) {
    const dflt = it.frameDefault || (it.framable === 'endorser' ? state.endFrame : state.frame) || 'circle', cur = tk.frame || '';
    const FR = { circle: 'Circle', square: 'Rounded square', none: 'No frame' };
    parts.push(sec('Headshot frame', `<div class="seg-row">${[['', `Default (${FR[dflt].toLowerCase()})`], ...Object.entries(FR)].map(([k, l]) => `<button data-frame="${k}" class="${k === cur ? 'on' : ''}">${l}</button>`).join('')}</div>
      <p class="hint">Just this ${it.framable === 'endorser' ? 'photo' : 'headshot'} on this slide and size${twinsOf(L, it.id).length ? '; copy it to the other judge slides below' : ''}. The default is set on the ${it.framable === 'endorser' ? 'Endorser' : 'Candidates'} tab.</p>`));
  }
  if (it.fillable) parts.push(sec(it.framable ? 'Frame color' : it.textual ? 'Fill' : 'Color', colorCtl('fill', it.framable ? 'Color' : it.textual ? 'Fill' : 'Color', tk.fill)));
  if (!it.fixed) parts.push(sec('Timing', `<div class="ctl">${num('delay', 'Delay', { min: -1, max: 3, step: .05, unit: 's' })}${slider('delay', -1, 3, .05)}</div><p class="hint">Comes in this much later (or earlier) than the design has it.</p>`));
  parts.push(`<section class="insp-actions">
    ${twins.length ? `<button id="tkTwins" class="ghost">Copy these edits to the ${twins.length} other slide${twins.length > 1 ? 's' : ''}</button>` : ''}
    <div class="btn-row"><button id="tkHide" class="ghost">${tk.hidden ? 'Show' : 'Hide'}</button><button id="tkReset" class="ghost">Reset this element</button></div>
    <p class="hint">${it.fixed ? 'Backgrounds stay put; change their color here.' : 'Arrow keys nudge (Shift = 10px). Esc or ✕ goes back to the settings.'}</p></section>`);
  box.innerHTML = parts.join('');
  const edit = fn => { fn(tweakOf(P, it.id, true)); };
  const after = () => { save(); renderTweakBar(); renderSlideBar(); drawSingle(false); };
  $$('[data-num]', box).forEach(el => {
    el.oninput = () => { const x = parseFloat(el.value); if (!Number.isFinite(x) || el.readOnly) return; setValue(P, it, el.dataset.num, x); syncInspector(P, it, el); drawSingle(false); };
    el.onchange = () => { save(); syncInspector(P, it); renderLayers(); renderSlideBar(); };
    el.onkeydown = e => { if (e.key === 'Enter') el.blur(); };
  });
  $$('[data-sl]', box).forEach(el => {
    el.oninput = () => { setValue(P, it, el.dataset.sl, +el.value); syncInspector(P, it, el); drawSingle(false); };
    el.onchange = () => { save(); renderLayers(); renderSlideBar(); };
  });
  $$('[data-align]', box).forEach(b => b.onclick = e => {
    const r = itemBox(P, it), M = e.shiftKey ? { x: 0, y: 0, w: P.w, h: P.h } : marginBox(P), k = b.dataset.align;
    const dx = k === 'l' ? M.x - r.x : k === 'r' ? M.x + M.w - r.x - r.w : k === 'ch' ? P.w / 2 - r.cx : 0;
    const dy = k === 't' ? M.y - r.y : k === 'b' ? M.y + M.h - r.y - r.h : k === 'cv' ? P.h / 2 - r.cy : 0;
    moveBy(P, it, dx, dy); after();
  });
  $('#tkMatch', box)?.addEventListener('change', e => { const o = L.byId.get(e.target.value); if (o) { setValue(P, it, 'fs', fontPx(P, o)); after(); } });
  $$('[data-frame]', box).forEach(b => b.onclick = () => { edit(t => { if (b.dataset.frame) t.frame = b.dataset.frame; else delete t.frame; }); planVersion++; after(); });
  $$('[data-col]', box).forEach(b => b.onclick = () => { edit(t => { t[b.dataset.col] = b.dataset.v; }); after(); });
  $$('[data-colin]', box).forEach(el => { el.oninput = () => { edit(t => { t[el.dataset.colin] = el.value; }); drawSingle(false); }; el.onchange = after; });
  $$('[data-colclear]', box).forEach(b => b.onclick = () => { edit(t => { delete t[b.dataset.colclear]; }); after(); });
  $('#tkHide', box).onclick = () => { edit(t => { t.hidden = !t.hidden; }); after(); };
  $('#tkReset', box).onclick = () => { delete state.tweaks[P.key]?.[layoutOf(P)]?.[it.id]; after(); };
  $('#tkClose', box).onclick = () => { selectOnly(null); renderTweakBar(); drawSingle(false); };
  $('#tkTwins', box)?.addEventListener('click', () => {
    copyToTwins(P, it, twins); after();
  });
}

/* the inspector for several elements: shared values (blank where they differ), and changes apply to each */
const ALIGN_MULTI = ALIGN.map(([k, t, svg]) => [k, { l: 'Align left edges', ch: 'Align centers (across)', r: 'Align right edges', t: 'Align tops', cv: 'Align middles (down)', b: 'Align bottoms' }[k] + ' (Shift: move the group to the ad)', svg]);
const DIST = [
  ['h', 'Even across', '<rect x="1.5" y="4" width="3" height="8"/><rect x="6.5" y="4" width="3" height="8"/><rect x="11.5" y="4" width="3" height="8"/>'],
  ['v', 'Even down', '<rect x="4" y="1.5" width="8" height="3"/><rect x="4" y="6.5" width="8" height="3"/><rect x="4" y="11.5" width="8" height="3"/>'],
];
function multiValues(P, list) {
  const mv = movers(list), gb = mv.length ? groupBox(P, mv) : null, tx = list.filter(it => it.textual && it.fs), hi = list.filter(it => it.hasHi);
  const same = (arr, f) => { const vs = arr.map(f).filter(v => v !== '' && v != null); return vs.length && vs.every(v => Math.abs(v - vs[0]) < .05) ? vs[0] : ''; };
  const iv = it => inspectorValues(P, it);
  return { x: gb ? Math.round(gb.x) : '', y: gb ? Math.round(gb.y) : '', w: gb ? Math.round(gb.w) : '', h: gb ? Math.round(gb.h) : '',
    fs: same(tx, it => iv(it).fs), weight: same(tx, it => iv(it).weight), width: same(tx, it => iv(it).width), hweight: same(hi, it => iv(it).hweight), delay: same(mv, it => iv(it).delay) };
}
function syncMulti(P, list, except) {
  const v = multiValues(P, list), box = $('#inspector');
  $$('[data-num]', box).forEach(el => { if (el !== except && el !== document.activeElement) el.value = v[el.dataset.num]; });
  $$('[data-sl]', box).forEach(el => { if (el !== except && v[el.dataset.sl] !== '') el.value = v[el.dataset.sl]; });
}
function setMulti(P, list, key, v) {
  const mv = movers(list);
  if (key === 'x' || key === 'y') { const gb = groupBox(P, mv), d = v - gb[key]; mv.forEach(it => moveBy(P, it, key === 'x' ? d : 0, key === 'y' ? d : 0)); return; }
  const to = key === 'hweight' ? list.filter(it => it.hasHi) : key === 'delay' ? mv : list.filter(it => it.textual && it.fs);
  to.forEach(it => setValue(P, it, key, v));
}
function renderMulti(P, L, list, box) {
  const v = multiValues(P, list), mv = movers(list), tx = list.filter(it => it.textual && it.fs), T = tweaksFor(P);
  const hi = list.filter(it => it.hasHi), fl = list.filter(it => it.fillable), fr = list.filter(it => it.framable);
  const same = (arr, k) => { const vs = arr.map(it => T[it.id]?.[k] || ''); return vs.every(x => x === vs[0]) ? vs[0] : ''; };
  const num = (key, label, o = {}) => `<label class="num"><span>${label}</span><input type="number" data-num="${key}" value="${v[key]}" placeholder="Mixed" step="${o.step ?? 1}"${o.min != null ? ` min="${o.min}"` : ''}${o.max != null ? ` max="${o.max}"` : ''}${o.ro ? ' readonly tabindex="-1"' : ''}>${o.unit ? `<i>${o.unit}</i>` : ''}</label>`;
  const slider = (key, min, max, step) => `<input type="range" class="sl" data-sl="${key}" min="${min}" max="${max}" step="${step}" value="${v[key] === '' ? (min + max) / 2 : v[key]}">`;
  const sec = (title, body) => `<section><h4>${title}</h4>${body}</section>`;
  const names = list.map(it => it.name || it.id), twinsAll = [...new Set(list.flatMap(it => twinsOf(L, it.id).map(o => o.id)))];
  const anyShown = list.some(it => !T[it.id]?.hidden);
  const parts = [`<div class="insp-head"><div><small>${esc(names.slice(0, 3).join(', '))}${names.length > 3 ? ` and ${names.length - 3} more` : ''}</small><b>${list.length} elements</b></div><button id="tkClose" class="x" title="Done (Esc)">✕</button></div>`];
  if (mv.length) parts.push(sec('Position', `<div class="grid2">${num('x', 'X', { unit: 'px' })}${num('y', 'Y', { unit: 'px' })}${num('w', 'W', { ro: true, unit: 'px' })}${num('h', 'H', { ro: true, unit: 'px' })}</div>
    ${mv.length > 1 ? `<div class="align-row">${ALIGN_MULTI.map(([k, t, svg]) => `<button data-align="${k}" title="${t}"><svg viewBox="0 0 16 16">${svg}</svg></button>`).join('')}</div>
    <div class="align-row two">${DIST.map(([k, t, svg]) => `<button data-dist="${k}" title="${t}: equal gaps (3 or more)"${mv.length < 3 ? ' disabled' : ''}><svg viewBox="0 0 16 16">${svg}</svg> ${t}</button>`).join('')}</div>` : ''}
    <p class="hint">Aligns to each other. Shift-click to move the whole group to the ad's margins or center. Drag the corner on the ad to resize them together.</p>`));
  if (tx.length) parts.push(sec(`Text <span class="cnt">${tx.length}</span>`, `<div class="ctl">${num('fs', 'Font size', { min: 2, max: 900, step: .5, unit: 'px' })}${slider('fs', 4, 300, .5)}</div>
    <div class="ctl">${num('weight', 'Weight', { min: 100, max: 900, step: 10 })}${slider('weight', 100, 900, 10)}</div>
    <div class="ctl">${num('width', 'Width', { min: 25, max: 200, unit: '%' })}${slider('width', 25, 200, 1)}</div>
    ${colorCtl('color', 'Color', same(tx, 'color'))}
    ${hi.length ? colorCtl('hcolor', 'Highlight', same(hi, 'hcolor')) + `<div class="ctl">${num('hweight', 'Highlight weight', { min: 100, max: 900, step: 10 })}${slider('hweight', 100, 900, 10)}</div>` : ''}`));
  if (fr.length) {
    const cur = same(fr, 'frame'), FR = { circle: 'Circle', square: 'Rounded square', none: 'No frame' };
    parts.push(sec(`Headshot frame <span class="cnt">${fr.length}</span>`, `<div class="seg-row">${[['', 'Default'], ...Object.entries(FR)].map(([k, l]) => `<button data-frame="${k}" class="${k === cur && (k || fr.every(it => !T[it.id]?.frame)) ? 'on' : ''}">${l}</button>`).join('')}</div>`));
  }
  if (fl.length) parts.push(sec(`Fill <span class="cnt">${fl.length}</span>`, colorCtl('fill', 'Fill', same(fl, 'fill'))));
  if (mv.length) parts.push(sec('Timing', `<div class="ctl">${num('delay', 'Delay', { min: -1, max: 3, step: .05, unit: 's' })}${slider('delay', -1, 3, .05)}</div>
    ${mv.length > 1 ? `<div class="stagger"><span class="lab">Stagger</span><label class="num"><input type="number" id="tkStag" value="0.1" step=".05" min="0" max="1"><i>s</i></label><button id="tkStagGo" class="ghost sm">One after another</button></div><p class="hint">Gives each a little more delay than the one before it, top to bottom, then left to right.</p>` : ''}`));
  parts.push(`<section class="insp-actions">
    ${twinsAll.length ? `<button id="tkTwins" class="ghost">Copy these edits to the other slides</button>` : ''}
    <div class="btn-row"><button id="tkHide" class="ghost">${anyShown ? 'Hide all' : 'Show all'}</button><button id="tkReset" class="ghost">Reset these</button></div>
    <p class="hint">Shift- or Cmd-click to add or remove. Arrow keys nudge them together. Esc clears.</p></section>`);
  box.innerHTML = parts.join('');
  const after = () => { save(); renderTweakBar(); renderSlideBar(); drawSingle(false); };
  const each = (arr, fn) => arr.forEach(it => fn(tweakOf(P, it.id, true), it));
  $$('[data-num]', box).forEach(el => {
    el.oninput = () => { const x = parseFloat(el.value); if (!Number.isFinite(x) || el.readOnly) return; setMulti(P, list, el.dataset.num, x); syncMulti(P, list, el); drawSingle(false); };
    el.onchange = () => { save(); syncMulti(P, list); renderLayers(); renderSlideBar(); };
    el.onkeydown = e => { if (e.key === 'Enter') el.blur(); };
  });
  $$('[data-sl]', box).forEach(el => {
    el.oninput = () => { setMulti(P, list, el.dataset.sl, +el.value); syncMulti(P, list, el); drawSingle(false); };
    el.onchange = () => { save(); renderLayers(); renderSlideBar(); };
  });
  $$('[data-align]', box).forEach(b => b.onclick = e => {
    const k = b.dataset.align, gb = groupBox(P, mv);
    if (e.shiftKey) { // the group as one block, to the ad's margins or center
      const M = marginBox(P);
      const dx = k === 'l' ? M.x - gb.x : k === 'r' ? M.x + M.w - gb.x - gb.w : k === 'ch' ? P.w / 2 - gb.cx : 0;
      const dy = k === 't' ? M.y - gb.y : k === 'b' ? M.y + M.h - gb.y - gb.h : k === 'cv' ? P.h / 2 - gb.cy : 0;
      mv.forEach(it => moveBy(P, it, dx, dy));
    } else mv.forEach(it => {
      const r = itemBox(P, it);
      const dx = k === 'l' ? gb.x - r.x : k === 'r' ? gb.x + gb.w - r.x - r.w : k === 'ch' ? gb.cx - r.cx : 0;
      const dy = k === 't' ? gb.y - r.y : k === 'b' ? gb.y + gb.h - r.y - r.h : k === 'cv' ? gb.cy - r.cy : 0;
      moveBy(P, it, dx, dy);
    });
    after();
  });
  $$('[data-dist]', box).forEach(b => b.onclick = () => {
    const h = b.dataset.dist === 'h', bs = mv.map(it => ({ it, b: itemBox(P, it) })).sort((a, z) => h ? a.b.cx - z.b.cx : a.b.cy - z.b.cy);
    const gb = groupBox(P, mv), used = bs.reduce((a, o) => a + (h ? o.b.w : o.b.h), 0), gap = ((h ? gb.w : gb.h) - used) / (bs.length - 1);
    let at = h ? gb.x : gb.y;
    bs.forEach(o => { moveBy(P, o.it, h ? at - o.b.x : 0, h ? 0 : at - o.b.y); at += (h ? o.b.w : o.b.h) + gap; });
    after();
  });
  $$('[data-frame]', box).forEach(b => b.onclick = () => { each(fr, t => { if (b.dataset.frame) t.frame = b.dataset.frame; else delete t.frame; }); planVersion++; after(); });
  const target = k => k === 'color' ? tx : k === 'hcolor' ? hi : fl;
  $$('[data-col]', box).forEach(b => b.onclick = () => { each(target(b.dataset.col), t => { t[b.dataset.col] = b.dataset.v; }); after(); });
  $$('[data-colin]', box).forEach(el => { el.oninput = () => { each(target(el.dataset.colin), t => { t[el.dataset.colin] = el.value; }); drawSingle(false); }; el.onchange = after; });
  $$('[data-colclear]', box).forEach(b => b.onclick = () => { each(target(b.dataset.colclear), t => { delete t[b.dataset.colclear]; }); after(); });
  $('#tkStagGo', box)?.addEventListener('click', () => {
    const st = parseFloat($('#tkStag', box).value) || 0, d0 = Math.min(...mv.map(it => T[it.id]?.delay || 0));
    [...mv].sort((a, z) => { const A = itemBox(P, a), Z = itemBox(P, z); return Math.abs(A.cy - Z.cy) > 4 ? A.cy - Z.cy : A.cx - Z.cx; })
      .forEach((it, j) => { tweakOf(P, it.id, true).delay = Math.round((d0 + st * j) * 100) / 100; }); after();
  });
  $('#tkHide', box).onclick = () => { each(list, t => { t.hidden = anyShown; }); after(); };
  $('#tkReset', box).onclick = () => { list.forEach(it => { delete state.tweaks[P.key]?.[layoutOf(P)]?.[it.id]; }); after(); };
  $('#tkClose', box).onclick = () => { selectOnly(null); renderTweakBar(); drawSingle(false); };
  $('#tkTwins', box)?.addEventListener('click', () => { list.forEach(it => { const tw = twinsOf(L, it.id); if (tw.length) copyToTwins(P, it, tw); }); after(); });
}
// scale the selection by f, each element about the group's middle
function scaleGroup(P, mv, f) {
  if (mv.length === 1) { const tk = tweakOf(P, mv[0].id, true); tk.s = clamp((tk.s ?? 1) * f, .1, 6); return; }
  const gb = groupBox(P, mv);
  mv.forEach(it => { const b0 = itemBox(P, it), tk = tweakOf(P, it.id, true); tk.s = clamp((tk.s ?? 1) * f, .1, 6); const b = itemBox(P, it); moveBy(P, it, gb.cx + (b0.cx - gb.cx) * f - b.cx, gb.cy + (b0.cy - gb.cy) * f - b.cy); });
}
document.addEventListener('keydown', e => {
  if (state.view !== 'single' || /input|textarea|select/i.test(e.target.tagName)) return;
  const P = presetOf(state.size);
  // Cmd/Ctrl+A: everything on the slide that can move
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault(); startEditing();
    const { items } = currentItems(); selIds = items.filter(i => !i.fixed).map(i => i.id); selId = selIds[selIds.length - 1] || null;
    renderSlideBar(); renderTweakBar(); drawSingle(false); return;
  }
  if (!selId) return;
  const mv = movers(selItems()), step = e.shiftKey ? 10 : 1;
  const arrow = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (e.key === 'Escape') selectOnly(null);
  else if (!mv.length) return;
  else if (arrow) mv.forEach(it => moveBy(P, it, arrow[0], arrow[1]));
  else if (e.key === '+' || e.key === '=') scaleGroup(P, mv, 1.05);
  else if (e.key === '-' || e.key === '_') scaleGroup(P, mv, 1 / 1.05);
  else return;
  e.preventDefault(); save(); renderTweakBar(); drawSingle(false);
});
function tick(ts) {
  const dt = lastTs ? Math.min(.1, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  if (playing && !exporting && state.view === 'single') {
    playT += dt;
    if (playT > durOf(presetOf(state.size))) playT = 0;
    drawSingle(false);
  }
  requestAnimationFrame(tick);
}
function setPlaying(v) { playing = v; if (v) editSlide = null; $('#playBtn').textContent = v ? '❚❚' : '▶'; renderSlideBar(); markPlaying(); renderLayers(); }
$('#playBtn').onclick = () => { if (!playing && playT >= durOf(presetOf(state.size)) - .05) playT = 0; setPlaying(!playing); };
$('#scrub').oninput = e => { setPlaying(false); editSlide = null; renderSlideBar(); playT = +e.target.value / 1000 * durOf(presetOf(state.size)); drawSingle(false); };
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || /input|textarea|select/i.test(e.target.tagName)) return;
  e.preventDefault(); $('#playBtn').click();
});
// the grid shows every size finished; hover a card to play it
function drawGrid() {
  const grid = $('#adGrid'), dpr = window.devicePixelRatio || 1;
  if (grid.children.length !== PRESETS.length) {
    grid.innerHTML = PRESETS.map(p => `<button class="ad-card" data-key="${p.key}"><canvas></canvas><div><b>${esc(p.name)}</b> <span></span></div></button>`).join('');
    $$('.ad-card', grid).forEach(b => {
      b.onclick = () => { state.size = b.dataset.key; if ($('#gridLayout').value) state.sizes[b.dataset.key].layout = $('#gridLayout').value; playT = 0; selId = null; editSlide = null; setView('single'); renderSizeList(); renderMessages(); renderLayouts(); renderTweakBar(); bindAll(); save(); };
      b.onmouseenter = () => playCard(b);
    });
  }
  PRESETS.forEach((p0, i) => drawCard(grid.children[i], Infinity));
}
function drawCard(card, t) {
  const P0 = presetOf(card.dataset.key), gl = $('#gridLayout')?.value, P = gl ? { ...P0, layout: gl } : P0, c = $('canvas', card), dpr = window.devicePixelRatio || 1;
  const k = Math.min(1, 380 / P.w, 340 / P.h);
  if (c.width !== Math.round(P.w * k * dpr)) { c.width = Math.round(P.w * k * dpr); c.height = Math.round(P.h * k * dpr); }
  c.style.width = `${Math.round(P.w * k)}px`; c.style.height = `${Math.round(P.h * k)}px`;
  render(c.getContext('2d'), P, k * dpr, false, t);
  $('span', card).textContent = `${P.w}×${P.h} · ${layoutOf(P)} · message ${LETTERS[msgIndex(P)]}`;
  card.classList.toggle('active', P.key === state.size);
}
function playCard(card) {
  if (card.dataset.playing) return;
  card.dataset.playing = '1';
  const start = performance.now();
  const step = now => {
    const t = (now - start) / 1000;
    if (t > durOf(presetOf(card.dataset.key)) || state.view !== 'grid') { delete card.dataset.playing; drawCard(card, Infinity); return; }
    drawCard(card, t); requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
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
    const out = $(`[data-out="${p}"]`), fmt = x => p.startsWith('font.') ? `${Math.round(x)}%` : Number(x).toFixed(2);
    if (out) out.textContent = fmt(v);
    el.oninput = el.onchange = () => {
      const nv = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? +el.value : el.value;
      setPath(p, nv); if (out) out.textContent = fmt(nv);
      if (p === 'font.css' || p === 'font.family') findVariableSource().then(warmFonts); else if (p.startsWith('font.')) warmFonts();
      if (p.startsWith('colors.') || p === 'theme') renderThemes();
      if (p.startsWith('endorser.')) drawThumb();
      if (p.startsWith('candidates.')) drawCandThumbs();
      if (p.startsWith('messages.')) refreshMsgLabels();
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
    <div class="row2 checks"><label class="check"><input type="checkbox" data-bind="candidates.${i}.showPrefix"> Show title + first name</label>
    <label class="check"><input type="checkbox" data-bind="candidates.${i}.showOffice"> Show office</label></div>
    <div class="cand-photo"><canvas width="120" height="140" data-thumb="${i}"></canvas>
      <div><div class="btn-row"><label class="ghost file-btn sm">${c.photo ? 'Replace photo' : 'Upload photo'}<input type="file" accept="image/*" data-photo="${i}" hidden></label>
        ${c.photo ? `<button class="ghost sm" data-clear="${i}">Remove</button>` : ''}</div>
      <div class="prop"><span>Zoom</span><input type="range" min="0.3" max="3" step="0.01" data-bind="candidates.${i}.zoom"><output data-out="candidates.${i}.zoom"></output></div>
      <div class="prop"><span>Left / right</span><input type="range" min="-3" max="3" step="0.01" data-bind="candidates.${i}.x"><output data-out="candidates.${i}.x"></output></div>
      <div class="prop"><span>Up / down</span><input type="range" min="-3" max="3" step="0.01" data-bind="candidates.${i}.y"><output data-out="candidates.${i}.y"></output></div></div></div></div>`).join('');
  $$('#candFields input[data-photo]').forEach(el => el.onchange = e => {
    const f = e.target.files[0]; if (f) readCutout(f, url => { Object.assign(state.candidates[+el.dataset.photo], { photo: url, zoom: 1, x: 0, y: 0 }); save(); renderCandFields(); bindAll(); loadCandPhotos(); });
  });
  $$('#candFields button[data-clear]').forEach(b => b.onclick = () => { state.candidates[+b.dataset.clear].photo = ''; save(); renderCandFields(); bindAll(); loadCandPhotos(); });
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
    let out = c, clear = false;
    for (let i = 3; i < d.length; i += 16) if (d[i] < 250) { clear = true; break; }
    if (x1 >= 0 && (x0 > 0 || y0 > 0 || x1 < c.width - 1 || y1 < c.height - 1)) {
      out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
      out.getContext('2d').drawImage(c, -x0, -y0);
    }
    // a regular photo (no transparency) is stored as JPEG to save browser storage
    URL.revokeObjectURL(url); done(clear ? out.toDataURL('image/png') : out.toDataURL('image/jpeg', .9));
  };
  img.onerror = () => alert('That file could not be opened as an image.');
  img.src = url;
}
function refreshMsgLabels() {
  $$('#msgSizes select, #msgPick').forEach(sel => [...sel.options].forEach(o => { o.textContent = `${LETTERS[+o.value]}: ${excerpt(state.messages[+o.value])}`; }));
}
const excerpt = m => (m.short || m.headline).replace(/\*/g, '').slice(0, 34);
function renderMessages() {
  const n = state.messages.length;
  $('#msgFields').innerHTML = state.messages.map((m, i) => `<div class="msg"><div class="msg-head"><b>Message ${LETTERS[i]}</b>${n > 1 ? `<button data-del="${i}">Remove</button>` : ''}</div>
    <label>Tag above the headline<input type="text" data-bind="messages.${i}.kicker"></label>
    <label>Headline<textarea rows="2" data-bind="messages.${i}.headline"></textarea></label>
    <label>Short headline<input type="text" data-bind="messages.${i}.short"></label>
    <label>Button<input type="text" data-bind="messages.${i}.cta"></label>
    <label>Ticker <span class="hint">(Front Row's scrolling band; separate phrases with | for a ★ between them. Blank uses the tag and button.)</span><input type="text" data-bind="messages.${i}.ticker" placeholder="${esc([m.kicker, m.cta].filter(Boolean).join(' | '))}"></label></div>`).join('');
  $$('#msgFields button[data-del]').forEach(b => b.onclick = () => {
    const d = +b.dataset.del;
    state.messages.splice(d, 1);
    // sizes on the removed message fall back to A; later ones shift down a letter
    PRESETS.forEach(p => { const s = state.sizes[p.key]; s.message = s.message === d ? 0 : s.message > d ? s.message - 1 : s.message; });
    save(); renderMessages(); bindAll(); redraw();
  });
  const opts = sel => state.messages.map((m, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${LETTERS[i]}: ${esc(excerpt(m))}</option>`).join('');
  $('#msgSizes').innerHTML = PRESETS.map(p => `<span>${esc(p.name)}</span><select data-msg-size="${p.key}">${opts(state.sizes[p.key].message)}</select>`).join('');
  $$('#msgSizes select').forEach(el => el.onchange = () => { state.sizes[el.dataset.msgSize].message = +el.value; save(); renderMessages(); redraw(); });
  $('#msgPick').innerHTML = opts(msgIndex(presetOf(state.size)));
  bindAll();
}
function renderLayouts() {
  const opts = sel => Object.entries(LAYOUTS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
  $('#layoutSizes').innerHTML = PRESETS.map(p => `<span>${esc(p.name)}</span><select data-layout-size="${p.key}">${opts(layoutOf(p))}</select>`).join('');
  $$('#layoutSizes select').forEach(el => el.onchange = () => { state.sizes[el.dataset.layoutSize].layout = el.value; save(); renderLayouts(); redraw(); });
  $('#layoutPick').innerHTML = opts(layoutOf(presetOf(state.size)));
  const gl = $('#gridLayout'), keep = gl.value;
  gl.innerHTML = `<option value="">Each size's own layout</option>` + Object.entries(LAYOUTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  gl.value = keep;
}
$('#gridLayout').onchange = () => drawGrid();
$('#layoutPick').onchange = e => { state.sizes[state.size].layout = e.target.value; selId = null; editSlide = null; save(); renderLayouts(); renderTweakBar(); redraw(); };
$$('[data-layout-all]').forEach(b => b.onclick = () => {
  PRESETS.forEach((p, i) => { state.sizes[p.key].layout = b.dataset.layoutAll === 'mix' ? mixLayout(p, i) : b.dataset.layoutAll; });
  selId = null; editSlide = null; save(); renderLayouts(); renderTweakBar(); redraw();
});
$('#msgPick').onchange = e => { state.sizes[state.size].message = +e.target.value; save(); renderMessages(); redraw(); };
$('#addMsg').onclick = () => { state.messages.push({ ...state.messages[state.messages.length - 1] }); save(); renderMessages(); bindAll(); };
$('#msgSpread').onclick = () => { PRESETS.forEach((p, i) => { state.sizes[p.key].message = i % state.messages.length; }); save(); renderMessages(); redraw(); };
$('#msgAllA').onclick = () => { PRESETS.forEach(p => { state.sizes[p.key].message = 0; }); save(); renderMessages(); redraw(); };
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
  $$('#sizeList button[data-key]').forEach(b => b.onclick = () => { state.size = b.dataset.key; playT = 0; selId = null; editSlide = null; save(); renderSizeList(); renderMessages(); renderLayouts(); renderTweakBar(); bindAll(); setView('single'); });
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
$$('[data-lines]').forEach(b => b.onclick = () => {
  const [field, v] = b.dataset.lines.split(':');
  state.candidates.forEach(c => { c[field] = v === '1'; });
  save(); bindAll(); redraw();
});
$$('[data-all]').forEach(b => b.onclick = () => {
  const [field, v] = b.dataset.all.split(':');
  PRESETS.forEach(p => {
    state.sizes[p.key][field] = v === 'big' ? !!p.big : v === 'meta' ? p.group === 'Meta' : v === 'google' ? p.group === 'Google' : v === '1';
  });
  save(); renderSizeList(); renderSizeToggles(); redraw();
});
function renderThemes() {
  if (!$('#themePick')) return;
  $('#themePick').innerHTML = Object.entries(THEMES).map(([k, label]) => {
    const t = themeFor(null, k);
    return `<button data-theme="${k}" class="${k === state.theme ? 'active' : ''}" style="background:linear-gradient(${t.top} 55%, ${t.band} 55%);color:${t.ink}"><span>${label}</span></button>`;
  }).join('');
  $$('#themePick button').forEach(b => b.onclick = () => { state.theme = b.dataset.theme; save(); renderThemes(); redraw(); });
}
$('#resetColors').onclick = () => { state.colors = { ...DEFAULT_COLORS }; save(); bindAll(); renderThemes(); redraw(); };

$$('.seg[data-view]').forEach(b => b.onclick = () => { setView(b.dataset.view); save(); });
// the left panel: Sizes over Layers, each can fold away
const renderLeft = () => ['sizes', 'layers'].forEach(k => $(`#sec${k[0].toUpperCase() + k.slice(1)}`).classList.toggle('collapsed', !!state.lcollapse[k]));
$$('[data-lsec]').forEach(b => b.onclick = () => { const k = b.dataset.lsec; state.lcollapse[k] = !state.lcollapse[k]; save(); renderLeft(); });
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
  readCutout(f, url => { Object.assign(state.endorser, { photo: url, zoom: 1, x: 0, y: 0 }); save(); bindAll(); loadPhoto(); });
  e.target.value = '';
};
$('#photoClear').onclick = () => { state.endorser.photo = ''; save(); loadPhoto(); };
function drawThumb() {
  const c = $('#photoThumb'), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const T = themeFor(presetOf(state.size));
  drawPhoto(ctx, c.width / 2, c.height / 2, c.width, T.disc, T.ink);
}

$('#kitLoad').onclick = () => {
  const raw = $('#kitInput').value.trim(), m = raw.match(/typekit\.net\/([a-z0-9]+)\.css/i) || raw.match(/^([a-z0-9]{5,12})$/i);
  if (raw && !m) { varNote = 'That doesn\'t look like an Adobe Fonts project ID (something like "abc1def").'; fontStatus(); return; }
  state.font.kit = m ? m[1] : ''; $('#kitInput').value = state.font.kit; varNote = ''; save(); loadKit();
};
document.fonts.addEventListener('loadingdone', () => { fontStatus(); redraw(); });

/* ---------- export ---------- */
// Meta sizes export as MP4 video; Google Display doesn't take video in image
// slots, so its sizes export as animated GIFs kept under Google's 150 KB.
const toBlob = (c, type, q) => new Promise(res => c.toBlob(res, type, q));
const yieldNow = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
const isGif = P => P.group === 'Google';
async function stillBlob(P) {
  const c = document.createElement('canvas'); c.width = P.w; c.height = P.h;
  render(c.getContext('2d'), P, 1, false);
  let blob = await toBlob(c, state.exp.format === 'jpg' ? 'image/jpeg' : 'image/png', .92);
  if (P.group === 'Google' && state.exp.cap && blob.size > GOOGLE_CAP) {
    for (let q = .92; q >= .4; q -= .06) { blob = await toBlob(c, 'image/jpeg', q); if (blob.size <= GOOGLE_CAP) break; }
  }
  return blob;
}

/* MP4: render each frame off-screen and encode with WebCodecs, H.264 where
   the browser has it (Chrome), VP9 otherwise. */
const FPS = 30;
const CODECS = [{ mux: 'avc', codec: 'avc1.640028' }, { mux: 'avc', codec: 'avc1.4d0028' }, { mux: 'avc', codec: 'avc1.42e028' }, { mux: 'vp9', codec: 'vp09.00.40.08' }];
async function pickCodec(P) {
  if (!window.VideoEncoder || !window.Mp4Muxer) return null;
  for (const c of CODECS) {
    const config = { codec: c.codec, width: P.w, height: P.h, bitrate: clamp(P.w * P.h * 5, 1e6, 10e6), framerate: FPS, ...(c.mux === 'avc' ? { avc: { format: 'avc' } } : {}) };
    try { if ((await VideoEncoder.isConfigSupported(config)).supported) return { ...c, config }; } catch {}
  }
  return null;
}
async function videoBlob(P, onProg) {
  const fc = await pickCodec(P);
  if (!fc) throw new Error('this browser can\'t encode video. Use Chrome or Edge.');
  const c = document.createElement('canvas'); c.width = P.w; c.height = P.h;
  const ctx = c.getContext('2d'), n = Math.round(durOf(P) * FPS);
  const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: fc.mux, width: P.w, height: P.h, frameRate: FPS }, fastStart: 'in-memory' });
  let failure = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; } });
  enc.configure(fc.config);
  for (let i = 0; i < n; i++) {
    if (failure) throw failure;
    render(ctx, P, 1, false, i / FPS);
    const frame = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
    enc.encode(frame, { keyFrame: i % (FPS * 2) === 0 }); frame.close();
    while (enc.encodeQueueSize > 6) await yieldNow();
    if (i % 10 === 0) { onProg?.(i / n); await yieldNow(); }
  }
  await enc.flush(); enc.close();
  if (failure) throw failure;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

/* GIF: one shared palette (median cut over a few frames), and each frame
   only stores the pixels that changed, which is what keeps these small.
   Steps down frame rate and colors until it fits under 150 KB. */
function medianCut(hist, maxColors) {
  const bins = [];
  for (let i = 0; i < hist.length; i++) if (hist[i]) bins.push(i);
  let boxes = [bins];
  const ch = (b, c) => c === 0 ? b >> 10 : c === 1 ? (b >> 5) & 31 : b & 31;
  while (boxes.length < maxColors) {
    let bi = -1, best = 0, bc = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 31, hi = 0; for (const b of box) { const v = ch(b, c); if (v < lo) lo = v; if (v > hi) hi = v; }
        const score = (hi - lo) * Math.log2(box.length + 1);
        if (score > best) { best = score; bi = i; bc = c; }
      }
    });
    if (bi < 0) break;
    const box = boxes[bi].sort((a, b) => ch(a, bc) - ch(b, bc));
    let total = 0; for (const b of box) total += hist[b];
    let acc = 0, cut = 1;
    for (let i = 0; i < box.length - 1; i++) { acc += hist[box[i]]; if (acc >= total / 2) { cut = i + 1; break; } }
    boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
  }
  return boxes.map(box => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const x of box) { const w = hist[x]; r += ((x >> 10) * 8 + 4) * w; g += (((x >> 5) & 31) * 8 + 4) * w; b += ((x & 31) * 8 + 4) * w; n += w; }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}
function lzw(idx, out) {
  const minCode = 8, clear = 256, eoi = 257;
  let codeSize = 9, next = 258, cur = 0, bits = 0;
  const dict = new Map(), bytes = [];
  const emit = c => { cur |= c << bits; bits += codeSize; while (bits >= 8) { bytes.push(cur & 255); cur >>>= 8; bits -= 8; } };
  emit(clear);
  let prefix = idx[0];
  for (let i = 1; i < idx.length; i++) {
    const k = idx[i], key = prefix << 8 | k, v = dict.get(key);
    if (v !== undefined) { prefix = v; continue; }
    emit(prefix);
    if (next === 4096) { emit(clear); dict.clear(); next = 258; codeSize = 9; }
    else { if (next >= 1 << codeSize) codeSize++; dict.set(key, next++); }
    prefix = k;
  }
  emit(prefix); emit(eoi);
  if (bits > 0) bytes.push(cur & 255);
  out.push(minCode);
  for (let i = 0; i < bytes.length; i += 255) { const n = Math.min(255, bytes.length - i); out.push(n); for (let j = 0; j < n; j++) out.push(bytes[i + j]); }
  out.push(0);
}
async function gifBlob(P, onProg) {
  const c = document.createElement('canvas'); c.width = P.w; c.height = P.h;
  const ctx = c.getContext('2d', { willReadFrequently: true }), W = P.w, H = P.h;
  // GIFs skip the looping ambient motion (ticker, shine, rays), which would bloat every frame
  const GP = { ...P, gif: true }, grab = (t, slide = null) => { render(ctx, GP, 1, false, t, slide); return ctx.getImageData(0, 0, W, H).data; };
  // palette from a handful of moments, weighted toward the finished ad
  const hist = new Uint32Array(32768);
  for (const t of [.5, 1.5, 2.5, 3.5, Infinity, Infinity]) {
    const d = grab(t);
    for (let i = 0; i < d.length; i += 8) hist[(d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3]++;
  }
  // frame rate, colors: stepped down until the file fits (scene-by-scene designs need the low end)
  // the last resort for slide designs ('cuts') shows each finished slide for its length, without the transitions
  const L = plan(GP, themeFor(GP)), dur = durOf(P), lens = L.slides?.length > 1 ? slideLens(L) : null;
  const tries = [[12, 255], [10, 160], [8, 110], [6, 72], [5, 48], [4, 40], [3, 32], [2, 28], ...(lens ? [['cuts', 96], ['cuts', 48]] : [[2, 16]])];
  let blob = null;
  for (const [ti, [fps, colors]] of tries.entries()) {
    const shots = fps === 'cuts'
      ? L.slides.map((sl, j) => ({ t: null, slide: j, t0: sl.start, t1: j === L.slides.length - 1 ? dur : sl.start + lens[j] }))
      : [...Array(Math.max(2, Math.round(dur * fps)))].map((_, f) => ({ t: f / fps, slide: null, t0: f / fps, t1: (f + 1) / fps }));
    const pal = medianCut(hist, colors), lookup = new Int16Array(32768).fill(-1);
    const nearest = key => {
      if (lookup[key] >= 0) return lookup[key];
      const r = (key >> 10) * 8 + 4, g = ((key >> 5) & 31) * 8 + 4, b = (key & 31) * 8 + 4;
      let bi = 0, bd = 1e9;
      pal.forEach(([pr, pg, pb], i) => { const dd = (pr - r) ** 2 * 2 + (pg - g) ** 2 * 3 + (pb - b) ** 2; if (dd < bd) { bd = dd; bi = i; } });
      return (lookup[key] = bi + 1); // index 0 is "unchanged" (transparent)
    };
    const out = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, W & 255, W >> 8, H & 255, H >> 8, 0xF7, 0, 0];
    for (let i = 0; i < 256; i++) { const p = pal[i - 1] || [0, 0, 0]; out.push(p[0], p[1], p[2]); }
    // Google allows looping only within 30 seconds in total
    const plays = Math.max(1, Math.floor(30 / durOf(P)));
    if (plays > 1) out.push(0x21, 0xFF, 11, ...[...'NETSCAPE2.0'].map(ch => ch.charCodeAt(0)), 3, 1, (plays - 1) & 255, (plays - 1) >> 8, 0);
    const n = shots.length, prev = new Uint8Array(W * H);
    const frames = [];
    for (let f = 0; f < n; f++) {
      const d = grab(shots[f].t, shots[f].slide), cur = new Uint8Array(W * H);
      for (let i = 0, j = 0; i < cur.length; i++, j += 4) cur[i] = nearest((d[j] >> 3) << 10 | (d[j + 1] >> 3) << 5 | d[j + 2] >> 3);
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (f === 0 || cur[i] !== prev[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      if (x1 < 0) { frames[frames.length - 1].end = shots[f].t1; continue; }
      const w = x1 - x0 + 1, h = y1 - y0 + 1, sub = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y + y0) * W + x + x0; sub[y * w + x] = f && cur[i] === prev[i] ? 0 : cur[i]; }
      prev.set(cur);
      frames.push({ x0, y0, w, h, sub, start: shots[f].t0, end: shots[f].t1, first: f === 0 });
      if (f % 6 === 0) { onProg?.((ti + f / n) / tries.length); await yieldNow(); }
    }
    // hold the finished ad until the end of the clip
    for (const fr of frames) {
      const delay = Math.round(fr.end * 100) - Math.round(fr.start * 100);
      out.push(0x21, 0xF9, 4, (1 << 2) | (fr.first ? 0 : 1), delay & 255, delay >> 8, 0, 0);
      out.push(0x2C, fr.x0 & 255, fr.x0 >> 8, fr.y0 & 255, fr.y0 >> 8, fr.w & 255, fr.w >> 8, fr.h & 255, fr.h >> 8, 0);
      lzw(fr.sub, out);
    }
    out.push(0x3B);
    blob = new Blob([new Uint8Array(out)], { type: 'image/gif' });
    if (!state.exp.cap || blob.size <= GOOGLE_CAP) break;
  }
  return blob;
}
const animBlob = (P, onProg) => isGif(P) ? gifBlob(P, onProg) : videoBlob(P, onProg);

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'video/mp4': 'mp4' };
const fileName = (P, blob) => `judicial-ad_${P.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}_${P.w}x${P.h}${state.messages.length > 1 ? `_message-${LETTERS[msgIndex(P)]}` : ''}.${EXT[blob.type] || 'bin'}`;
function download(blob, name) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function progress(frac, text) {
  const prog = $('#progress'); prog.hidden = false;
  $('div', prog).style.width = `${clamp(frac, 0, 1) * 100}%`; $('span', prog).textContent = text;
}
async function busy(fn) {
  if (exporting) return;
  exporting = true; $$('#exportOne, #exportAnim, #exportBatch').forEach(b => { b.disabled = true; });
  try { await fn(); }
  catch (err) { progress(1, `Export failed: ${err.message || err}`); }
  exporting = false; $$('#exportOne, #exportAnim, #exportBatch').forEach(b => { b.disabled = false; });
}
const kb = b => `${Math.round(b.size / 1024)} KB`;
$('#exportOne').onclick = () => busy(async () => { const P = presetOf(state.size), b = await stillBlob(P); download(b, fileName(P, b)); });
$('#exportAnim').onclick = () => busy(async () => {
  const P = presetOf(state.size);
  const b = await animBlob(P, f => progress(f, `${P.name}: ${Math.round(f * 100)}%`));
  download(b, fileName(P, b));
  progress(1, `Done: ${fileName(P, b)} (${kb(b)})${isGif(P) && b.size > GOOGLE_CAP ? ' — over 150 KB; try a shorter length' : ''}`);
});
$('#exportBatch').onclick = () => busy(async () => {
  const sizes = PRESETS.filter(p => state.sizes[p.key].batch).map(p => presetOf(p.key));
  if (!sizes.length) { alert('Check at least one size.'); return; }
  const list = state.exp.allMessages ? sizes.flatMap(P => state.messages.map((_, m) => ({ ...P, message: m }))) : sizes;
  const anim = state.exp.kind === 'anim', files = [], over = [];
  for (const [i, P] of list.entries()) {
    const label = f => progress((i + f) / list.length, `${P.name}, message ${LETTERS[msgIndex(P)]} (${i + 1}/${list.length})`);
    label(0);
    const add = async blob => {
      const name = fileName(P, blob);
      if (state.exp.zip) files.push({ path: `${P.group.toLowerCase()}/${name}`, blob });
      else { download(blob, name); await new Promise(r => setTimeout(r, 350)); }
    };
    if (anim) {
      const b = await animBlob(P, label);
      if (isGif(P) && b.size > GOOGLE_CAP) over.push(`${P.name} ${LETTERS[msgIndex(P)]}`);
      await add(b);
      if (state.exp.stills && isGif(P)) await add(await stillBlob(P)); // Google asks for a still backup too
    } else await add(await stillBlob(P));
  }
  if (files.length) download(await makeZip(files), `judicial-ads_${anim ? 'animated' : 'stills'}_${list.length}-ads.zip`);
  progress(1, `Done: ${list.length} ads${over.length ? `. Over 150 KB: ${over.join(', ')} (try a shorter length)` : ''}`);
});

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

/* ---------- suites (judicial/suites.js) plug in here ---------- */
const SUITES = {};
window.DBS = {
  state: () => state, now: () => NOW, ctx: () => DC, curP: () => CUR_P, ov: () => CUR_OV, fontOv, MC,
  clamp, rgba, EASE, prog, enter, popBack, font, words, wrap, fitStack, stackAt, drawStack, drawLines, stackDur, blockH, ASC, search, pillTextTop, minText, msgOf, usePhotos,
  headerBlock, lineupBlock, endBlock, ctaBlock, discBlock, drawPhoto,
  judgeImg: i => { const im = candImgs[i]; return im && im.complete && im.naturalWidth ? im : null; },
  endorserImg: () => (photoImg && photoImg.naturalWidth ? photoImg : null),
  register(key, label, fn) { SUITES[key] = fn; LAYOUTS[key] = label; renderLayouts(); redraw(); },
  redraw, build: BUILD, staleBuild,
  // a slide's length in seconds: the user's setting for this design, else the design's own default
  tweakFor: (P, id) => (P ? tweaksFor(P)[id] : null) || null,
  slideLen: (j, def) => { const v = state.slideTimes[layoutOf(CUR_P)]?.[j]; return Number.isFinite(v) ? clamp(v, .3, 10) : def; },
};

/* ---------- boot ---------- */
$('#motionPick').innerHTML = Object.entries(MOTIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
function initUI() {
  renderCandFields(); renderMessages(); renderLayouts(); bindAll(); renderSizeList(); renderTweakBar(); renderSizeToggles(); renderThemes();
  $('#customW').value = state.custom.w; $('#customH').value = state.custom.h;
  $('#kitInput').value = state.font.kit;
  $$('.tab').find(t => t.dataset.tab === state.tab)?.click();
  renderLeft();
  setView(state.view); loadPhoto(); loadCandPhotos(); fontStatus(); loadKit();
}
window.addEventListener('resize', redraw);
initUI();
requestAnimationFrame(tick);
warmFonts();
// for headless checks: render a preset to a data URL
window.__renderSize = (key, t, layout, slide = null) => { const P = layout ? { ...presetOf(key), layout } : presetOf(key), c = document.createElement('canvas'); c.width = P.w; c.height = P.h; render(c.getContext('2d'), P, 1, false, t ?? Infinity, slide); return c.toDataURL('image/png'); };
window.__dur = key => durOf(presetOf(key));
window.__slides = (key, layout) => { const P = layout ? { ...presetOf(key), layout } : presetOf(key); return (plan(P, themeFor(P)).slides || []).length; };
window.__exportAnim = async key => { const b = await animBlob(presetOf(key)); return { type: b.type, size: b.size, data: [...new Uint8Array(await b.arrayBuffer())] }; };
})();
