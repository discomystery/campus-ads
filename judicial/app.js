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
const cand = (prefix, last, office, short) => ({ prefix, last, office, short, showPrefix: true, showOffice: true, photo: null, zoom: 1, x: 0, y: 0 });
// Alternate messages. Each size uses one, so the set of ads doesn't all say the same thing.
const msg = (kicker, headline, short, cta) => ({ kicker, headline, short, cta });
const DEFAULT_MESSAGES = [
  msg('Today is Election Day', 'Your rights are on the ballot, and *you* could cast the *deciding vote* for *justice*.', 'Cast the *deciding vote* for *justice*.', 'Polls open till 7:30\u00a0PM'),
  msg('Today is Election Day', 'Missed early voting? *It\'s not too late.*', '*It\'s not too late.*', 'Vote by 7:30\u00a0PM tonight'),
  msg('Election Day', 'Don\'t stop at the top. Vote *all the way down* the ballot.', 'Vote *all the way down* the ballot.', 'Polls open till 7:30\u00a0PM'),
  msg('Today is Election Day', '*Our courts* are on the ballot today.', '*Our courts* are on the ballot.', 'Polls close at 7:30\u00a0PM'),
  msg('Every vote counts', '*Statewide* court races here have been decided by *just a few hundred votes*. Make one of them *yours*.', 'Make *your vote* count.', 'Vote by 7:30\u00a0PM tonight'),
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// the "Mix" pattern: alternate lineup with stripes, using quadrants where the ad is roughly square
const squarish = p => p.h / p.w >= .75 && p.h / p.w <= 1.35;
const mixLayout = (p, i) => i % 2 ? (squarish(p) ? 'quads' : 'stripes') : 'lineup';
function freshState() {
  const sizes = {};
  // spread the messages across the sizes so neighbors differ
  PRESETS.forEach((p, i) => { sizes[p.key] = { endorser: !!p.big, disclaimer: true, batch: p.key !== 'custom', message: i % DEFAULT_MESSAGES.length, layout: mixLayout(p, i) }; });
  return {
    size: 'meta45', view: 'single', tab: 'cands',
    messages: DEFAULT_MESSAGES.map(m => ({ ...m })),
    text: {
      stripeTag: 'Vote for justice!', dayLabel: 'Election Day', date: 'November 3rd',
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
    endorser: { photo: null, zoom: 1, x: 0, y: 0, name: 'Roy Cooper' },
    sizes,
    custom: { w: 600, h: 500 },
    colors: { ...DEFAULT_COLORS },
    theme: 'classic', themeAuto: false,
    pattern: 'none', sticker: false, guides: true,
    quadsTried: true,
    tweaks: {}, // your manual moves and resizes: tweaks[size][layout][element] = { dx, dy, s }
    duration: 8, outro: 'hold', motion: 'pop', pulse: true,
    frame: 'circle', endFrame: 'circle',
    font: { kit: '', family: 'obviously-variable', css: '', dWeight: '500', hWeight: '800', cWeight: '500', wideW: 150, condW: 75, bodyW: 100 },
    exp: { kind: 'anim', format: 'png', cap: true, zip: true, stills: true, allMessages: false },
  };
}
function merge(base, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;
  for (const k of Object.keys(base)) {
    if (!(k in saved)) continue;
    const b = base[k], s = saved[k];
    if (k === 'tweaks') { base[k] = s && typeof s === 'object' && !Array.isArray(s) ? s : {}; continue; }
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
    if (!saved.quadsTried) { PRESETS.forEach(p => { if (squarish(p) && state.sizes[p.key]?.layout === 'stripes') state.sizes[p.key].layout = 'quads'; }); }
    state.quadsTried = true;
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
  head: ['dWeight', 'wideW'], heavy: ['hWeight', 'wideW'], cond: ['cWeight', 'condW'], condBold: [700, 'condW'], medium: [500, 'bodyW'], body: [400, 'bodyW'],
};
function font(role, size) {
  const f = state.font, px = `${Math.max(1, size).toFixed(2)}px`, [wt, wd] = ROLE[role] || ROLE.body;
  const weight = typeof wt === 'number' ? wt : f[wt], width = +f[wd] || 100;
  const fam = varSrc ? `"${aliasFor(width)}", "${f.family}"` : `"${f.family}"`;
  return `${weight} ${nearestStretch(width)} ${px} ${fam}, ${FALLBACK}`;
}
const ROLES = Object.keys(ROLE);
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
    if (candImgs[i]?.src === c.photo) return;
    const img = new Image();
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
    const nMax = search(n => C.every(c => !wrap(MC, c.last, font('heavy', n), cw).over) ? n : null, 4, 260);
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
          ctx.font = font('heavy', F.n); ctx.fillStyle = ink; ctx.textAlign = 'center';
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
/* ---------- stripes layout ---------- */
/* The alternative look from the earlier campaign pieces: a header, one colored
   band per judge (name on one side, photo on the other, alternating sides),
   and a white footer with the date and poll hours. On wide sizes the bands
   turn into columns. Returns null when a size is too small for it, and the
   size falls back to the lineup. */
const LAYOUTS = { lineup: 'Lineup (judges in a row)', stripes: 'Stripes (a band per judge)', quads: 'Quadrants (2×2 grid)' };
const layoutOf = P => P.layout ?? state.sizes[P.key]?.layout ?? 'lineup';
const lum = hex => { const [r, g, b] = rgb(hex).map(v => v / 255); return .2126 * r + .7152 * g + .0722 * b; };
const inkOn = c => lum(c) > .45 ? state.colors.black : state.colors.white;
const STRIPE_STEP = .3;

function stripeHeader(x, w, h, A, B, P, align) {
  const t = msgOf(P), m = Math.min(P.w, P.h);
  const make = head => fitStack(MC, [
    { text: state.text.stripeTag.toUpperCase(), role: 'heavy', r: .42, color: B, maxLines: 2, lh: 1, gap: 0, optional: true, min: minText(P) },
    { text: head, role: 'heavy', r: 1, lh: 1, color: inkOn(A), hi: B, gap: .22 },
  ], w, h, Math.min(w * .13, 110));
  const long = t.headline.trim() ? make(t.headline) : null, short = t.short.trim() ? make(t.short) : null;
  const res = long && (!short || long.s >= Math.max(18, m * .06)) ? long : short || long;
  if (!res || res.out.find(o => o.it.role === 'heavy' && o.it.r === 1).size < minText(P)) return null;
  return { h: res.total, bx: x, bw: w, dur: stackDur(res), draw: (y, t0) => drawStack(DC, res, x, y, align, t0) };
}
// the four name stacks share one size; office lines go first, then titles, until it's readable
function fitNames(w, h, colors, P, align) {
  const C = state.candidates, minP = minText(P);
  const items = (c, color, pre, off) => [
    // like the earlier campaign pieces: a big bold "Judge Christine" sitting tight on the last name
    pre && c.showPrefix && c.prefix.trim() && { text: c.prefix, role: 'condBold', r: .72, lh: 1, color, maxLines: 2, gap: 0 },
    { text: c.last, role: 'heavy', r: 1, lh: 1, color, maxLines: 1, gap: .04 },
    off && c.showOffice && { text: c.office || c.short, role: 'cond', r: .46, lh: 1.05, color, maxLines: 2, gap: .2 },
  ].filter(Boolean);
  for (const [pre, off] of [[true, true], [true, false], [false, false]]) {
    const sets = C.map((c, i) => items(c, colors[i], pre, off));
    // the smallest line in use sets the lowest size worth trying
    const rs = [pre && C.some(c => c.showPrefix) && .72, off && C.some(c => c.showOffice) && .46].filter(Boolean);
    const lo = minP / Math.min(1, ...rs);
    const s = search(s => sets.every(it => stackAt(MC, it, w, h, s)) ? s : null, lo, Math.min(h, w * .3, 120));
    if (s) return sets.map(it => { const res = stackAt(MC, it, w, h, s); return { h: res.total, dur: stackDur(res), res, align }; });
  }
  return null;
}
function stripesPlan(P, T) {
  const W = P.w, H = P.h, m = Math.min(W, H), cfg = state.sizes[P.key] || {}, M = msgOf(P), C = state.candidates;
  const A = T.disc, B = T.band, white = state.colors.white, black = state.colors.black, blue = state.colors.blue;
  const pad = Math.round(clamp(m * .06, 5, 56)), items = [], bands = [];
  const put = (b, y, t0, id, x = b?.bx, w = b?.bw) => b && items.push({ b, y, t0, id, x, w });
  const at = (b, x) => b && { ...b, draw: (y, t0) => drawStack(DC, b.res, x, y, b.align, t0) };
  const S = P.safe ? { t: H * P.safe.t, b: H * (1 - P.safe.b), l: W * P.safe.l, r: W * (1 - P.safe.r) } : { t: pad * .5, b: H - pad * .5, l: pad, r: W - pad };
  const discOn = cfg.disclaimer && state.text.disclaimer.trim(), endOn = cfg.endorser && state.endorser.name.trim();
  const footItems = (big) => [
    big && { text: state.text.dayLabel.toUpperCase(), role: 'heavy', r: .42, color: blue, maxLines: 1, lh: 1, gap: 0, optional: true, min: minText(P) },
    { text: state.text.date, role: 'heavy', r: 1, color: black, maxLines: 2, lh: 1, gap: .15 },
    { text: M.cta, role: 'heavy', r: .42, color: blue, maxLines: 2, lh: 1.1, gap: .2 }, // the poll hours always stay
  ];
  let t = .25;
  const photoBlock = (i, x, d, rowBottom, disc) => ({ h: d * POP, draw: (y, t0) => {
    const ctx = DC, rise = state.motion === 'fade' ? 1 : prog(t0 + .1, .6);
    enter(ctx, prog(t0, .45), x + d / 2, y + d * POP - d / 2, [0, d * .4], popBack, () => drawCutout(ctx, i, x, y, d, disc, inkOn(disc), rise));
  } });

  if (layoutOf(P) === 'quads' && H / W >= .45) {
    // quadrants: header, a 2x2 checkerboard of judges (names toward the outside, photos toward the middle), footer
    const span = S.b - S.t, hh = span * .2, fh = span * .19, ch = (span - hh - fh) / 2, x0 = S.l, cw = S.r - S.l, qw = W / 2;
    const ew = endOn && cw >= 260 ? cw * .28 : 0;
    const hdr = stripeHeader(x0, cw - ew - (ew ? pad * .5 : 0), hh - pad * .3, A, B, P, ew ? 'left' : 'center');
    // name on the outer ~58% of each cell, photo tucked against the inner edge
    const cellColor = i => ((i % 2) + (i >> 1)) % 2 ? B : A, tw = qw * .58 - pad;
    const names = fitNames(tw, ch * .8, C.map((_, i) => inkOn(cellColor(i))), P, 'center');
    if (!hdr || !names) return null;
    bands.push({ x: 0, y: 0, w: W, h: S.t + hh + 1, color: A, from: 'top', t0: 0 });
    put(hdr, S.t + (hh - hdr.h) / 2, t, 'header'); t += hdr.dur * .6;
    if (ew) { const e = endBlock(S.r - ew, ew, hh * .92, { ...T, disc: B }, inkOn(A), 'stack', P); if (e) put(e, S.t + (hh - e.h) / 2, t + .2, 'endorser'); }
    C.forEach((c, i) => {
      const col = i % 2, row = i >> 1, x = col * qw, y = S.t + hh + row * ch, color = cellColor(i), t0 = .35 + i * STRIPE_STEP;
      bands.push({ x, y, w: qw + (col ? 0 : 1), h: ch + (row ? 0 : 1), color, from: col ? 'right' : 'left', t0 });
      const nb = names[i], nx = col ? x + qw * .42 : x + pad;
      put(at(nb, nx), y + (ch - nb.h) / 2, t0 + .25, `name${i}`, nx, tw);
      if (usePhotos()) {
        const d = Math.min(ch * .88, qw * .36), px = col ? x + qw * .4 - d : x + qw * .6;
        const top = y + ch - d * POP - (state.frame === 'none' ? 0 : ch * .04);
        put(photoBlock(i, px, d, y + ch, color === A ? B : A), top, t0 + .3, `photo${i}`, px, d);
      }
      t = t0 + .9;
    });
    const fy = S.t + hh + 2 * ch, disc = discOn ? discBlock(x0, cw, clamp(H * .018, 10.5, 22), black, 'center') : null;
    bands.push({ x: 0, y: fy, w: W, h: H - fy, color: white, from: 'bottom', t0: t - .4 });
    const fres = fitStack(MC, footItems(true), cw, fh - (disc ? disc.h + pad * .3 : 0) - pad * .4, Math.min(cw * .14, 120));
    if (fres) put({ h: fres.total, draw: (y, t0) => drawStack(DC, fres, x0, y, 'center', t0) }, fy + pad * .3 + (fh - (disc ? disc.h + pad * .3 : 0) - pad * .3 - fres.total) / 2, t - .2, 'footer', x0, cw);
    if (disc) put(disc, Math.min(H - pad * .5, S.b) - disc.h, .3, 'disclaimer');
    return { fam: 'stripes', bg: white, bands, items, sticker: null, m, end: t + (fres ? stackDur(fres) : 0) };
  }
  if (H / W >= .45) {
    // rows: header, four judge bands, footer
    const span = S.b - S.t, hh = span * .2, fh = span * .19, rh = (span - hh - fh) / 4, x0 = S.l, cw = S.r - S.l;
    const ew = endOn && cw >= 260 ? cw * .28 : 0;
    const hdr = stripeHeader(x0, cw - ew - (ew ? pad * .5 : 0), hh - pad * .3, A, B, P, ew ? 'left' : 'center');
    const half = cw * .5, names = fitNames(half - pad * .4, rh * .78, C.map((_, i) => inkOn(i % 2 ? B : A)), P, 'center');
    if (!hdr || !names) return null;
    bands.push({ x: 0, y: 0, w: W, h: S.t + hh + 1, color: A, from: 'top', t0: 0 });
    put(hdr, S.t + (hh - hdr.h) / 2, t, 'header'); t += hdr.dur * .6;
    if (ew) { const e = endBlock(S.r - ew, ew, hh * .92, { ...T, disc: B }, inkOn(A), 'stack', P); if (e) put(e, S.t + (hh - e.h) / 2, t + .2, 'endorser'); }
    C.forEach((c, i) => {
      const y = S.t + hh + i * rh, color = i % 2 ? B : A, textRight = i % 2 === 0, t0 = .35 + i * STRIPE_STEP;
      bands.push({ x: 0, y: i === 3 ? y : y, w: W, h: rh + (i === 3 ? 0 : 1), color, from: textRight ? 'right' : 'left', t0 });
      const nx = textRight ? x0 + half + pad * .2 : x0 + pad * .2, nb = names[i];
      put(at(nb, nx), y + (rh - nb.h) / 2, t0 + .25, `name${i}`, nx, half - pad * .4);
      if (usePhotos()) {
        const d = Math.min(rh * .9, half * .8), px = (textRight ? x0 : x0 + half) + (half - d) / 2;
        const top = y + rh - d * POP - (state.frame === 'none' ? 0 : rh * .04);
        put(photoBlock(i, px, d, y + rh, textRight ? B : A), top, t0 + .3, `photo${i}`, px, d);
      }
      t = t0 + .9;
    });
    // footer
    const fy = S.t + hh + 4 * rh, disc = discOn ? discBlock(x0, cw, clamp(H * .018, 10.5, 22), black, 'center') : null;
    bands.push({ x: 0, y: fy, w: W, h: H - fy, color: white, from: 'bottom', t0: t - .4 });
    const fres = fitStack(MC, footItems(true), cw, fh - (disc ? disc.h + pad * .3 : 0) - pad * .4, Math.min(cw * .14, 120));
    if (fres) put({ h: fres.total, draw: (y, t0) => drawStack(DC, fres, x0, y, 'center', t0) }, fy + pad * .3 + (fh - (disc ? disc.h + pad * .3 : 0) - pad * .3 - fres.total) / 2, t - .2, 'footer', x0, cw);
    if (disc) put(disc, Math.min(H - pad * .5, S.b) - disc.h, .3, 'disclaimer');
    return { fam: 'stripes', bg: white, bands, items, sticker: null, m, end: t + (fres ? stackDur(fres) : 0) };
  }
  // columns: header, four judge columns, footer
  const strip = H <= 120, showHdr = W >= 500;
  const hw = showHdr ? W * (strip ? .22 : .24) : 0, fw = W * (strip ? .2 : .19), jw = (W - hw - fw) / 4;
  const vpad = Math.max(4, pad * .6), inner = H - vpad * 2;
  const hdr = showHdr ? stripeHeader(pad * .7, hw - pad * 1.2, inner, A, B, P, 'left') : null;
  const photoD = usePhotos() && !strip ? Math.min(jw * .8, H * .5) : 0;
  const names = fitNames(jw - pad * .5, photoD ? inner - photoD * POP - vpad : inner, C.map((_, i) => inkOn(i % 2 ? B : A)), P, 'center');
  if ((showHdr && !hdr) || !names) return null;
  if (hw) bands.push({ x: 0, y: 0, w: hw + 1, h: H, color: A, from: 'top', t0: 0 });
  if (hdr) { put(hdr, vpad + (inner - hdr.h) / 2, t, 'header'); t += hdr.dur * .6; }
  C.forEach((c, i) => {
    const x = hw + i * jw, color = i % 2 ? B : A, t0 = .35 + i * STRIPE_STEP, nb = names[i];
    bands.push({ x, y: 0, w: jw + 1, h: H, color, from: i % 2 ? 'bottom' : 'top', t0 });
    const blockH = nb.h + (photoD ? photoD * POP + vpad * .5 : 0), y0 = photoD ? vpad : vpad + (inner - nb.h) / 2;
    put(at(nb, x + pad * .25), y0, t0 + .25, `name${i}`, x + pad * .25, jw - pad * .5);
    if (photoD) put(photoBlock(i, x + (jw - photoD) / 2, photoD, H, i % 2 ? A : B), H - photoD * POP - (state.frame === 'none' ? 0 : vpad * .5), t0 + .3, `photo${i}`, x + (jw - photoD) / 2, photoD);
    t = t0 + .9;
  });
  const fx = W - fw, disc = discOn ? discBlock(fx + pad * .3, fw - pad * .6, clamp(H * (strip ? .13 : .05), 7, 14), black, 'center') : null;
  bands.push({ x: fx, y: 0, w: fw, h: H, color: white, from: 'right', t0: t - .4 });
  const fres = fitStack(MC, footItems(!strip), fw - pad * .6, inner - (disc ? disc.h + vpad * .3 : 0), Math.min(fw * .2, 90));
  if (fres) put({ h: fres.total, draw: (y, t0) => drawStack(DC, fres, fx + pad * .3, y, 'center', t0) }, vpad + (inner - (disc ? disc.h + vpad * .3 : 0) - fres.total) / 2, t - .2, 'footer', fx + pad * .3, fw - pad * .6);
  if (disc) put(disc, H - vpad - disc.h, .3, 'disclaimer');
  return { fam: 'stripes', bg: white, bands, items, sticker: null, m, end: t + (fres ? stackDur(fres) : 0) };
}

/* Works out where every block goes and when it animates in. Returns the
   band (the colored strip the judges stand in), the blocks with their
   positions and start times, and when the intro ends. Plans are cached:
   fitting text is the slow part, and video export draws the same plan
   hundreds of times. */
const planCache = new Map();
let planVersion = 0;
function plan(P, T) {
  const key = `${P.key}|${P.w}x${P.h}|${T.name}|${msgIndex(P)}|${layoutOf(P)}|${planVersion}`;
  if (planCache.has(key)) return planCache.get(key);
  if (planCache.size > 60) planCache.clear();
  const L = makePlan(P, T);
  planCache.set(key, L);
  return L;
}
function makePlan(P, T) {
  if (layoutOf(P) === 'stripes' || layoutOf(P) === 'quads') { const S = stripesPlan(P, T); if (S) return S; }
  const W = P.w, H = P.h, m = Math.min(W, H), cfg = state.sizes[P.key] || {};
  const pad = Math.round(clamp(m * .06, 5, 64));
  const r = P.safe ? { x: W * P.safe.l, y: H * P.safe.t, w: W * (1 - P.safe.l - P.safe.r), h: H * (1 - P.safe.t - P.safe.b) }
    : { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
  const fam = family(P, r), items = [], put = (b, y, t0, id, x = b?.bx, w = b?.bw) => b && items.push({ b, y, t0, id, x, w });
  const endOn = !!cfg.endorser && state.endorser.name.trim(), discOn = cfg.disclaimer && state.text.disclaimer.trim();
  let band = null, sticker = null, t = .35; // the band sweeps in first, then everything follows in order

  if (fam === 'tall' || fam === 'wide') {
    const gap = Math.round(m * (fam === 'tall' ? .04 : .035));
    const disc = discOn ? discBlock(r.x, r.w, clamp(H * .02, 10.5, 24), T.bandInk, 'center') : null;
    const avail = r.h - (disc ? disc.h + gap * .6 : 0);
    let hdr, endTop = null;
    if (fam === 'tall') {
      let hw = r.w;
      if (state.sticker && state.text.sticker.trim() && r.w >= 560) { const d = Math.min(avail * .2, r.w * .26); sticker = { d }; hw = r.w - d - gap; }
      hdr = headerBlock(r.x, hw, avail * (endOn ? .27 : .32), T, sticker ? 'left' : 'center', P, false);
    } else {
      const sw = endOn ? r.w * .3 : 0;
      hdr = headerBlock(r.x, r.w - sw - (sw ? gap : 0), avail * .36, T, 'left', P, false);
      if (endOn) endTop = endBlock(r.x + r.w - sw, sw, avail * .3, T, T.ink, 'row', P);
    }
    const cta = ctaBlock(r.x, r.w, clamp(avail * .1, 30, 130), T.cta, T.ctaInk, 'center', P);
    const endRow = fam === 'tall' && endOn ? endBlock(r.x, r.w, avail * .14, T, T.bandInk, r.w < 420 ? 'stack' : 'row', P) : null;
    const topH = Math.max(hdr?.h || 0, endTop?.h || 0);
    const top = endTop ? { h: topH } : hdr;
    const used = [top, cta, endRow].filter(Boolean);
    const lu = lineupBlock(r.x, r.w, avail - used.reduce((a, b) => a + b.h, 0) - gap * used.length - avail * .04, T, T.bandInk, P);
    const rows = [top, lu, endRow, cta].filter(Boolean), ys = spread(rows, r.y, avail, gap), yOf = b => ys[rows.indexOf(b)];
    if (hdr) { put(hdr, endTop ? yOf(top) + (topH - hdr.h) / 2 : yOf(hdr), t, 'header'); t += hdr.dur; }
    if (sticker && hdr) { sticker = { ...sticker, cx: r.x + r.w - sticker.d / 2, cy: yOf(top) + topH / 2, t0: t - .2 }; }
    if (lu) { put(lu, yOf(lu), t - .25, 'lineup'); t += lu.dur - .25; }
    if (endTop) { put(endTop, yOf(top) + (topH - endTop.h) / 2, t - .3, 'endorser'); t += endTop.dur - .3; }
    if (endRow) { put(endRow, yOf(endRow), t - .3, 'endorser'); t += endRow.dur - .3; }
    if (cta) { put(cta, yOf(cta), t - .2, 'cta'); t += cta.dur - .2; }
    if (lu) { const ly = yOf(lu) + lu.bandTop; band = { x: 0, y: ly, w: W, h: H - ly, from: 'bottom' }; }
    else if (cta) { const cy = yOf(cta) - gap; band = { x: 0, y: cy, w: W, h: H - cy, from: 'bottom' }; }
    if (disc) put(disc, r.y + r.h - disc.h, .3, 'disclaimer');
  } else {
    // side by side: headline (and button) on the left, judges in the band on the right
    const gap = Math.round(fam === 'strip' ? Math.max(5, r.h * .16) : m * .07);
    const leftW = r.w * (fam === 'strip' ? .3 : endOn ? .33 : .38);
    const ctaCol = fam === 'strip' && r.w >= 560 && msgOf(P).cta.trim() ? r.w * .2 : 0;
    const endW = fam === 'cols' && endOn ? r.w * .15 : 0;
    const discH = discOn ? clamp(H * (fam === 'strip' ? .15 : .06), 7, 16) : 0;
    const lh = r.h - (discH ? discH + gap * .3 : 0);
    let hdr = null, cta = null;
    if (fam === 'strip' && lh < 46) cta = ctaBlock(r.x, leftW, lh, T.ctaTop, T.ctaTopInk, 'left', P, 3);
    else {
      const ctaH = ctaCol ? 0 : lh * (fam === 'strip' ? .36 : .28);
      hdr = headerBlock(r.x, leftW, lh - ctaH - (ctaH ? gap * .4 : 0), T, 'left', P, fam === 'strip');
      if (!hdr && !ctaCol) cta = ctaBlock(r.x, leftW, lh, T.ctaTop, T.ctaTopInk, 'left', P, 3); // no room for a readable headline: the button says it
      else if (ctaH) cta = ctaBlock(r.x, leftW, ctaH, T.ctaTop, T.ctaTopInk, 'left', P);
    }
    const left = [hdr, cta].filter(Boolean), ys = spread(left, r.y, lh, gap * .4);
    const bx = r.x + leftW + gap * .5;
    band = { x: bx, y: 0, w: W - bx, h: H, from: 'right' };
    const lx = bx + gap * .5, lw = r.x + r.w - lx - endW - ctaCol - (endW || ctaCol ? gap : 0);
    const lu = lineupBlock(lx, lw, r.h, T, T.bandInk, P);
    const e = endW ? endBlock(r.x + r.w - endW, endW, r.h, T, T.bandInk, 'stack', P) : null;
    const c2 = ctaCol ? ctaBlock(r.x + r.w - ctaCol, ctaCol, r.h, T.cta, T.ctaInk, 'center', P) : null;
    if (hdr) { put(hdr, ys[left.indexOf(hdr)], t, 'header'); t += hdr.dur; }
    if (lu) { put(lu, r.y + (r.h - lu.h) / 2, t - .3, 'lineup'); t += lu.dur - .3; }
    if (e) { put(e, r.y + (r.h - e.h) / 2, t - .3, 'endorser'); t += e.dur - .3; }
    if (cta) { put(cta, ys[left.indexOf(cta)], t - .2, 'cta'); t += cta.dur - .2; }
    if (c2) { put(c2, r.y + (r.h - c2.h) / 2, t - .2, 'cta'); t += c2.dur - .2; }
    if (discH) put(discBlock(r.x, leftW, discH * .8, T.ink, 'left'), r.y + r.h - discH, .3, 'disclaimer');
  }
  return { fam, bg: T.top, bands: band ? [{ ...band, color: T.band, t0: 0, follow: band.from === 'bottom' ? 'lineup' : null }] : [], items, sticker, m, end: t };
}

/* ---------- drawing ---------- */
function drawPattern(ctx, P, T, L) {
  const W = P.w, H = P.h, m = L.m, rand = rng(W * 7 + H * 13), tone = rgba(T.ink, .06);
  // patterns drift slowly while the ad plays
  const drift = Number.isFinite(NOW) ? NOW : 0;
  if (state.pattern === 'burst') {
    const cx = W / 2, cy = L.bands[0] ? L.bands[0].y : H, R = Math.hypot(W, H), n = 32, rot = drift * .05;
    ctx.fillStyle = tone;
    for (let i = 0; i < n; i += 2) {
      const a0 = rot + i * Math.PI * 2 / n, a1 = rot + (i + 1) * Math.PI * 2 / n;
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
    for (let i = 0; i < n; i++) ctx.fill(starPath(rand() * W, ((rand() * H - drift * m * .02) % H + H) % H, m * (.025 + rand() * .05), -Math.PI / 2 + (rand() - .5) * .6 + drift * .2));
  }
}
function drawSticker(ctx, S, T) {
  const R = S.d / 2, fill = T.top === state.colors.yellow ? state.colors.blue : state.colors.yellow, ink = fill === state.colors.blue ? state.colors.white : state.colors.black;
  const p = prog(S.t0, .6);
  if (p <= 0) return;
  ctx.save(); ctx.translate(S.cx, S.cy); ctx.rotate(-.16 - (1 - EASE.out(p)) * 1.2); ctx.scale(EASE.back(p), EASE.back(p));
  ctx.fillStyle = fill; ctx.fill(starPath(0, 0, R, 0, 14, .84));
  const res = fitStack(MC, [{ text: state.text.sticker, role: 'heavy', r: 1, lh: 1, color: ink }], R * 1.4, R * 1.1, R * .45);
  if (res) drawStack(ctx, res, -R * .7, -res.total / 2, 'center');
  ctx.restore();
}

/* ---------- manual tweaks ---------- */
// dx, dy are fractions of the ad's width and height so a custom size can change; s scales around the element's center
const tweaksFor = P => state.tweaks?.[P.key]?.[layoutOf(P)] || {};
function tweakOf(P, id, create) {
  const L = layoutOf(P);
  if (!create) return tweaksFor(P)[id] || null;
  state.tweaks[P.key] ??= {}; state.tweaks[P.key][L] ??= {};
  return (state.tweaks[P.key][L][id] ??= { dx: 0, dy: 0, s: 1 });
}
// where an element ends up after its tweak, in ad pixels
function itemBox(P, it) {
  const tk = tweaksFor(P)[it.id] || { dx: 0, dy: 0, s: 1 }, w = (it.w || 0) * tk.s, h = it.b.h * tk.s;
  const cx = (it.x || 0) + (it.w || 0) / 2 + tk.dx * P.w, cy = it.y + it.b.h / 2 + tk.dy * P.h;
  return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
}
function drawItem(ctx, P, it) {
  const tk = it.id && tweaksFor(P)[it.id];
  if (!tk) { it.b.draw(it.y, it.t0); return; }
  const cx = (it.x || 0) + (it.w || 0) / 2, cy = it.y + it.b.h / 2;
  ctx.save(); ctx.translate(cx + tk.dx * P.w, cy + tk.dy * P.h); ctx.scale(tk.s, tk.s); ctx.translate(-cx, -cy);
  it.b.draw(it.y, it.t0); ctx.restore();
}

// a band sweeps in from one side (or fades in)
function drawBand(ctx, P, b) {
  if (b.follow) { const tk = tweaksFor(P)[b.follow]; if (tk?.dy) b = { ...b, y: b.y + tk.dy * P.h, h: b.h - tk.dy * P.h }; }
  const p = EASE.out(prog(b.t0, .65));
  if (p <= 0) return;
  ctx.fillStyle = b.color;
  if (state.motion === 'fade') { ctx.save(); ctx.globalAlpha = p; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.restore(); return; }
  if (b.from === 'left') ctx.fillRect(b.x, b.y, b.w * p, b.h);
  else if (b.from === 'top') ctx.fillRect(b.x, b.y, b.w, b.h * p);
  else if (b.from === 'right') ctx.fillRect(b.x + b.w * (1 - p), b.y, b.w * p, b.h);
  else ctx.fillRect(b.x, b.y + b.h * (1 - p), b.w, b.h * p);
}
/* t is seconds into the animation (Infinity = the finished ad). If the
   intro is longer than the chosen length allows, it plays faster. */
function render(ctx, P, k, editor, t = Infinity) {
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
  const T = themeFor(P), L = plan(P, T);
  const speed = Math.max(1, L.end / Math.max(1, state.duration - 1.5));
  NOW = state.motion === 'none' ? Infinity : t * speed; DC = ctx;
  try {
    ctx.fillStyle = L.bg; ctx.fillRect(0, 0, P.w, P.h);
    if (L.fam !== 'stripes') drawPattern(ctx, P, T, L);
    for (const b of L.bands) drawBand(ctx, P, b);
    L.items.forEach(it => drawItem(ctx, P, it));
    if (L.sticker?.cx) drawSticker(ctx, L.sticker, T);
    // optional fade at the very end so a looping video starts again cleanly
    if (Number.isFinite(t) && state.outro === 'fade') {
      const f = clamp((t - (state.duration - .45)) / .45, 0, 1);
      if (f > 0) { ctx.globalAlpha = f; ctx.fillStyle = T.top; ctx.fillRect(0, 0, P.w, P.h); ctx.globalAlpha = 1; }
    }
  } finally { NOW = Infinity; DC = MC; }
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
// the editor plays the animation on a loop; any edit re-plans every size
let drawQueued = false, playing = true, playT = 0, lastTs = 0, exporting = false;
function redraw() {
  planVersion++;
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; state.view === 'grid' ? drawGrid() : drawSingle(true); });
}
let shownKey = '';
function drawSingle(full) {
  const P = presetOf(state.size), wrapEl = $('#canvasWrap'), c = $('#ad');
  const aw = wrapEl.clientWidth - 8, ah = wrapEl.clientHeight - 8;
  const k = Math.max(.05, Math.min(aw / P.w, ah / P.h, 3)), dpr = window.devicePixelRatio || 1;
  const key = `${P.w}x${P.h}@${k}`;
  if (full || key !== shownKey) {
    shownKey = key;
    c.width = Math.round(P.w * k * dpr); c.height = Math.round(P.h * k * dpr);
    c.style.width = `${Math.round(P.w * k)}px`; c.style.height = `${Math.round(P.h * k)}px`;
  }
  viewK = k;
  render(c.getContext('2d'), P, k * dpr, true, playT);
  drawSelection(c.getContext('2d'), P, k * dpr);
  $('#scrub').value = Math.round(playT / state.duration * 1000);
  $('#timeRead').textContent = `${playT.toFixed(1)}s`;
  if (!full) return;
  $('#sizeInfo').innerHTML = `<b>${esc(P.name)}</b> · ${P.w}×${P.h}px · shown at ${Math.round(k * 100)}%${P.note ? ` · ${esc(P.note)}` : ''}`;
  const warn = [];
  if (state.sizes[P.key]?.endorser && !state.endorser.photo) warn.push('No endorser photo yet: add one on the Endorser tab.');
  if (usePhotos() && state.candidates.some(c => !c.photo)) warn.push('Some candidates have no photo yet.');
  if (/\[/.test(JSON.stringify([state.text, msgOf(P)]))) warn.push('Placeholder text is still in the ad.');
  if (!state.sizes[P.key]?.disclaimer || !state.text.disclaimer.trim()) warn.push('No disclaimer on this size.');
  $('#warnings').textContent = warn.join(' ');
}
/* ---------- direct editing: click, drag, resize ---------- */
let selId = null, hoverId = null, dragging = null, viewK = 1;
const ELEMENT_NAMES = { header: 'Headline', lineup: 'Judges', endorser: 'Endorser', cta: 'Button', disclaimer: 'Disclaimer', footer: 'Footer' };
const nameOf = id => ELEMENT_NAMES[id] || (/^name\d/.test(id) ? `${state.candidates[+id.slice(4)].last} name` : /^photo\d/.test(id) ? `${state.candidates[+id.slice(5)].last} photo` : id);
const currentItems = () => { const P = presetOf(state.size); return { P, items: plan(P, themeFor(P)).items.filter(it => it.id) }; };
const adPoint = e => { const r = $('#ad').getBoundingClientRect(); return { x: (e.clientX - r.left) / viewK, y: (e.clientY - r.top) / viewK }; };
const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
function hit(p) {
  const { P, items } = currentItems();
  // the smallest box under the pointer wins, so a name inside a big band can be picked
  const under = items.filter(it => inBox(p, itemBox(P, it))).sort((a, b) => itemBox(P, a).w * itemBox(P, a).h - itemBox(P, b).w * itemBox(P, b).h);
  return under[0]?.id || null;
}
const handleSize = () => 11 / viewK;
function onHandle(p) {
  const { P, items } = currentItems(), it = selId && items.find(i => i.id === selId);
  if (!it) return false;
  const b = itemBox(P, it), hs = handleSize();
  return Math.abs(p.x - (b.x + b.w)) < hs && Math.abs(p.y - (b.y + b.h)) < hs;
}
function drawSelection(ctx, P, K) {
  const { items } = currentItems();
  ctx.setTransform(K, 0, 0, K, 0, 0);
  const lw = 1.6 / viewK;
  const hov = hoverId && hoverId !== selId && items.find(i => i.id === hoverId);
  if (hov) { const b = itemBox(P, hov); ctx.strokeStyle = 'rgba(255,45,149,.75)'; ctx.lineWidth = lw; ctx.setLineDash([5 / viewK, 4 / viewK]); ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]); }
  const sel = selId && items.find(i => i.id === selId);
  if (sel) {
    const b = itemBox(P, sel), hs = handleSize();
    ctx.strokeStyle = '#ff2d95'; ctx.lineWidth = lw * 1.4; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#fff'; ctx.fillRect(b.x + b.w - hs / 2, b.y + b.h - hs / 2, hs, hs);
    ctx.strokeRect(b.x + b.w - hs / 2, b.y + b.h - hs / 2, hs, hs);
  }
}
const ad = $('#ad');
ad.addEventListener('pointerdown', e => {
  const p = adPoint(e), { P, items } = currentItems();
  // edit on the finished frame, where everything is in place
  setPlaying(false); playT = state.duration;
  if (onHandle(p)) {
    const it = items.find(i => i.id === selId), b = itemBox(P, it), tk = tweakOf(P, selId) || { s: 1 };
    dragging = { mode: 'size', cx: b.cx, cy: b.cy, d0: Math.max(4, Math.hypot(p.x - b.cx, p.y - b.cy)), s0: tk.s };
  } else {
    selId = hit(p);
    if (selId) { const tk = tweakOf(P, selId) || { dx: 0, dy: 0 }; dragging = { mode: 'move', x0: p.x, y0: p.y, dx0: tk.dx, dy0: tk.dy }; }
  }
  if (dragging) ad.setPointerCapture(e.pointerId);
  renderTweakBar(); drawSingle(false);
});
ad.addEventListener('pointermove', e => {
  const p = adPoint(e), P = presetOf(state.size);
  if (dragging) {
    const tk = tweakOf(P, selId, true);
    if (dragging.mode === 'move') { tk.dx = dragging.dx0 + (p.x - dragging.x0) / P.w; tk.dy = dragging.dy0 + (p.y - dragging.y0) / P.h; }
    else tk.s = clamp(dragging.s0 * Math.hypot(p.x - dragging.cx, p.y - dragging.cy) / dragging.d0, .2, 4);
    renderTweakBar(true); drawSingle(false); return;
  }
  const h = onHandle(p) ? selId : hit(p);
  ad.style.cursor = onHandle(p) ? 'nwse-resize' : h ? 'move' : 'default';
  if (h !== hoverId) { hoverId = h; drawSingle(false); }
});
const endDrag = () => { if (dragging) { dragging = null; save(); renderTweakBar(); } };
ad.addEventListener('pointerup', endDrag);
ad.addEventListener('pointercancel', endDrag);
ad.addEventListener('pointerleave', () => { if (!dragging && hoverId) { hoverId = null; drawSingle(false); } });
function renderTweakBar(valuesOnly) {
  const P = presetOf(state.size), { items } = currentItems(), bar = $('#tweakBar');
  if (selId && !items.some(i => i.id === selId)) selId = null;
  const tk = selId && tweakOf(P, selId), any = Object.keys(tweaksFor(P)).length;
  if (valuesOnly && selId && $('#tkSize')) { $('#tkSize').value = Math.round((tk?.s || 1) * 100); $('#tkOut').textContent = `${Math.round((tk?.s || 1) * 100)}%`; return; }
  bar.innerHTML = selId
    ? `<b>${esc(nameOf(selId))}</b><label>Size <input type="range" id="tkSize" min="20" max="300" value="${Math.round((tk?.s || 1) * 100)}"></label><output id="tkOut">${Math.round((tk?.s || 1) * 100)}%</output>
       <button id="tkReset" class="ghost sm">Reset</button>${any ? '<button id="tkResetAll" class="ghost sm">Reset all on this size</button>' : ''}<span class="hint">Drag to move · corner to resize · arrow keys nudge · Esc to deselect</span>`
    : `<span class="hint">Click anything on the ad to move or resize it. Tweaks apply to this size and layout only.</span>${any ? '<button id="tkResetAll" class="ghost sm">Reset all on this size</button>' : ''}`;
  $('#tkSize')?.addEventListener('input', e => { const t = tweakOf(P, selId, true); t.s = +e.target.value / 100; $('#tkOut').textContent = `${e.target.value}%`; drawSingle(false); });
  $('#tkSize')?.addEventListener('change', save);
  $('#tkReset')?.addEventListener('click', () => { delete state.tweaks[P.key]?.[layoutOf(P)]?.[selId]; save(); renderTweakBar(); drawSingle(false); });
  $('#tkResetAll')?.addEventListener('click', () => { if (state.tweaks[P.key]) delete state.tweaks[P.key][layoutOf(P)]; save(); renderTweakBar(); drawSingle(false); });
}
document.addEventListener('keydown', e => {
  if (!selId || state.view !== 'single' || /input|textarea|select/i.test(e.target.tagName)) return;
  const P = presetOf(state.size), step = e.shiftKey ? 10 : 1;
  const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (mv) { const tk = tweakOf(P, selId, true); tk.dx += mv[0] / P.w; tk.dy += mv[1] / P.h; }
  else if (e.key === '+' || e.key === '=') tweakOf(P, selId, true).s *= 1.05;
  else if (e.key === '-' || e.key === '_') tweakOf(P, selId, true).s /= 1.05;
  else if (e.key === 'Escape') selId = null;
  else return;
  e.preventDefault(); save(); renderTweakBar(); drawSingle(false);
});
function tick(ts) {
  const dt = lastTs ? Math.min(.1, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  if (playing && !exporting && state.view === 'single') {
    playT += dt;
    if (playT > state.duration) playT = 0;
    drawSingle(false);
  }
  requestAnimationFrame(tick);
}
function setPlaying(v) { playing = v; $('#playBtn').textContent = v ? '❚❚' : '▶'; }
$('#playBtn').onclick = () => { if (!playing && playT >= state.duration - .05) playT = 0; setPlaying(!playing); };
$('#scrub').oninput = e => { setPlaying(false); playT = +e.target.value / 1000 * state.duration; drawSingle(false); };
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
      b.onclick = () => { state.size = b.dataset.key; playT = 0; selId = null; setView('single'); renderSizeList(); renderMessages(); renderLayouts(); renderTweakBar(); bindAll(); save(); };
      b.onmouseenter = () => playCard(b);
    });
  }
  PRESETS.forEach((p0, i) => drawCard(grid.children[i], Infinity));
}
function drawCard(card, t) {
  const P = presetOf(card.dataset.key), c = $('canvas', card), dpr = window.devicePixelRatio || 1;
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
    if (t > state.duration || state.view !== 'grid') { delete card.dataset.playing; drawCard(card, Infinity); return; }
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
    <label>Button<input type="text" data-bind="messages.${i}.cta"></label></div>`).join('');
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
}
$('#layoutPick').onchange = e => { state.sizes[state.size].layout = e.target.value; selId = null; save(); renderLayouts(); renderTweakBar(); redraw(); };
$$('[data-layout-all]').forEach(b => b.onclick = () => {
  PRESETS.forEach((p, i) => { state.sizes[p.key].layout = b.dataset.layoutAll === 'mix' ? mixLayout(p, i) : b.dataset.layoutAll; });
  save(); renderLayouts(); redraw();
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
  $$('#sizeList button[data-key]').forEach(b => b.onclick = () => { state.size = b.dataset.key; playT = 0; selId = null; save(); renderSizeList(); renderMessages(); renderLayouts(); renderTweakBar(); bindAll(); setView('single'); });
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
  readCutout(f, url => { Object.assign(state.endorser, { photo: url, zoom: 1, x: 0, y: 0 }); save(); bindAll(); loadPhoto(); });
  e.target.value = '';
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
  const ctx = c.getContext('2d'), n = Math.round(state.duration * FPS);
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
  const grab = t => { render(ctx, P, 1, false, t); return ctx.getImageData(0, 0, W, H).data; };
  // palette from a handful of moments, weighted toward the finished ad
  const hist = new Uint32Array(32768);
  for (const t of [.5, 1.5, 2.5, 3.5, Infinity, Infinity]) {
    const d = grab(t);
    for (let i = 0; i < d.length; i += 8) hist[(d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3]++;
  }
  const tries = [[12, 255], [10, 160], [8, 110], [6, 72], [5, 48]];
  let blob = null;
  for (const [ti, [fps, colors]] of tries.entries()) {
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
    const plays = Math.max(1, Math.floor(30 / state.duration));
    if (plays > 1) out.push(0x21, 0xFF, 11, ...[...'NETSCAPE2.0'].map(ch => ch.charCodeAt(0)), 3, 1, (plays - 1) & 255, (plays - 1) >> 8, 0);
    const n = Math.max(2, Math.round(state.duration * fps)), prev = new Uint8Array(W * H);
    const frames = [];
    for (let f = 0; f < n; f++) {
      const d = grab(f / fps), cur = new Uint8Array(W * H);
      for (let i = 0, j = 0; i < cur.length; i++, j += 4) cur[i] = nearest((d[j] >> 3) << 10 | (d[j + 1] >> 3) << 5 | d[j + 2] >> 3);
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (f === 0 || cur[i] !== prev[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      if (x1 < 0) { frames[frames.length - 1].end = f + 1; continue; }
      const w = x1 - x0 + 1, h = y1 - y0 + 1, sub = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y + y0) * W + x + x0; sub[y * w + x] = f && cur[i] === prev[i] ? 0 : cur[i]; }
      prev.set(cur);
      frames.push({ x0, y0, w, h, sub, start: f, end: f + 1, first: f === 0 });
      if (f % 6 === 0) { onProg?.((ti + f / n) / tries.length); await yieldNow(); }
    }
    // hold the finished ad until the end of the clip
    for (const fr of frames) {
      const delay = Math.round(fr.end * 100 / fps) - Math.round(fr.start * 100 / fps);
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

/* ---------- boot ---------- */
$('#motionPick').innerHTML = Object.entries(MOTIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
function initUI() {
  renderCandFields(); renderMessages(); renderLayouts(); bindAll(); renderSizeList(); renderTweakBar(); renderSizeToggles(); renderThemes();
  $('#customW').value = state.custom.w; $('#customH').value = state.custom.h;
  $('#kitInput').value = state.font.kit;
  $$('.tab').find(t => t.dataset.tab === state.tab)?.click();
  setView(state.view); loadPhoto(); loadCandPhotos(); fontStatus(); loadKit();
}
window.addEventListener('resize', redraw);
initUI();
requestAnimationFrame(tick);
warmFonts();
// for headless checks: render a preset to a data URL
window.__renderSize = (key, t) => { const P = presetOf(key), c = document.createElement('canvas'); c.width = P.w; c.height = P.h; render(c.getContext('2d'), P, 1, false, t ?? Infinity); return c.toDataURL('image/png'); };
window.__exportAnim = async key => { const b = await animBlob(presetOf(key)); return { type: b.type, size: b.size, data: [...new Uint8Array(await b.arrayBuffer())] }; };
})();
