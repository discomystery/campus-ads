/* Down-Ballot Studio: the ad designs
   Spotlight  - roll call: a headline slide, a slide per judge (each revealed
                through an iris wipe), then an end card with everyone
   Front Row  - poster: a scrolling ticker, a full-width stacked headline that
                slams in, and the four judges standing shoulder to shoulder
   Scrapbook  - pop collage: tilted polaroid cards drop in over sunburst rays,
                with a marker note, an arrow and a starburst button
   Every piece of every slide is its own element: each line of text, each
   photo, each shape, each slide's background. The editor can move and resize
   any of them, change a text line's weight, width and colors, or a shape's
   fill, and the animations play from wherever things end up. Everything draws
   through the studio's helpers (window.DBS), so fonts, colors, messages and
   exports all apply. */
(() => {
'use strict';
const D = window.DBS;
if (!D) return;
if (D.build !== '20261023195406') { D.staleBuild?.(); return; } // scripts from two different builds: don't run half of one
const { clamp, EASE, prog, font, wrap, fitStack, stackAt, search, minText, msgOf, MC, enter, popBack, ASC, blockH } = D;
const S = () => D.state();
const now = () => D.now();
const G = () => D.ctx();
const OV = () => D.ov() || {}; // the edits on the element being drawn
const TAU = Math.PI * 2, WS = .075; // WS: seconds between words as a line builds
const motion = () => S().motion;
// looping background motion (ticker, shine, rays, wiggle) runs in MP4s, not in GIFs (or the Google sizes' preview) or stills
const ambient = () => Number.isFinite(now()) && !D.gifLook();
const pal = () => { const c = S().colors; return { Y: c.yellow, B: c.blue, W: c.white, K: c.black }; };
function mix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), Bc = p(b);
  return '#' + A.map((v, i) => Math.round(v + (Bc[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- sizes and boxes ---------- */
function famOf(P) {
  const r = P.h / P.w;
  if (P.h <= 100) return 'strip';
  if (r < .42) return 'bill';
  if (r < .75) return 'wide';
  if (r < 1.15) return 'square';
  return 'tall';
}
function frameOf(P) {
  const m = Math.min(P.w, P.h), pad = Math.round(clamp(m * .055, 4, 60));
  const box = P.safe ? { x: P.w * P.safe.l, y: P.h * P.safe.t, w: P.w * (1 - P.safe.l - P.safe.r), h: P.h * (1 - P.safe.t - P.safe.b) }
    : { x: pad, y: pad, w: P.w - pad * 2, h: P.h - pad * 2 };
  return { m, pad, box };
}
const cutTop = (b, h, g = 0) => [{ x: b.x, y: b.y, w: b.w, h }, { x: b.x, y: b.y + h + g, w: b.w, h: b.h - h - g }];
const cutBottom = (b, h, g = 0) => [{ x: b.x, y: b.y + b.h - h, w: b.w, h }, { x: b.x, y: b.y, w: b.w, h: b.h - h - g }];
const cutLeft = (b, w, g = 0) => [{ x: b.x, y: b.y, w, h: b.h }, { x: b.x + w + g, y: b.y, w: b.w - w - g, h: b.h }];
const cutRight = (b, w, g = 0) => [{ x: b.x + b.w - w, y: b.y, w, h: b.h }, { x: b.x, y: b.y, w: b.w - w - g, h: b.h }];
// stack blocks down a box with even gaps (capped, so a group stays together), the group centered; sets block.y
function column(blocks, b, gapMax) {
  const list = blocks.filter(Boolean), total = list.reduce((a, k) => a + k.h, 0);
  const gap = list.length > 1 ? clamp((b.h - total) / (list.length + 1), 0, gapMax) : 0;
  let y = b.y + (b.h - total - gap * (list.length - 1)) / 2;
  list.forEach(k => { k.y = y; y += k.h + gap; });
  return list;
}

/* ---------- plans: slides and elements ---------- */
function newPlan(P) {
  const items = [], slides = [];
  return {
    P, items, slides,
    slide(s) { slides.push(s); return slides.length - 1; },
    /* an element: id (unique in the plan), slide (index, or '*' for every slide), name (shown in the editor),
       x/y/w/h (its box), fs (text: font size in px), t0 (when it starts animating), draw(t0); textual/hasHi/fillable say which edits apply */
    add(o) {
      items.push({ id: o.id, slide: o.slide ?? 0, name: o.name, role: o.role, textual: !!o.textual, hasHi: !!o.hasHi, fillable: !!o.fillable,
        fixed: !!o.fixed, top: !!o.top, parent: o.parent, fs: o.fs, align: o.align, framable: o.framable, frameDefault: o.frameDefault, off: o.off, hitLast: !!o.hitLast, x: o.x, y: o.y, w: o.w, t0: o.t0, measure: o.measure, b: { h: o.h, draw: (_, t) => o.draw(t) } });
    },
    done(extra) { return { fam: 'suite', bg: '#000', bands: [], items, slides, sticker: null, m: 1, end: 3, ...extra }; },
  };
}
// a slide's background: a fixed element you can recolor
function bgEl(pl, slide, name, fill, paint) {
  const P = pl.P;
  pl.add({ id: `s${slide}.bg`, slide, name: `${name} · background`, fillable: true, fixed: true, x: 0, y: 0, w: P.w, h: P.h, t0: 0, draw: t => paint(G(), OV().fill || fill, t) });
}
function shapeEl(pl, o) {
  pl.add({ ...o, fillable: true, draw: t => { const g = G(); g.save(); o.tx?.(g); o.paint(g, OV().fill || o.fill, t); g.restore(); } });
}
function photoEl(pl, o) {
  pl.add({ ...o, fillable: o.fill != null, draw: t => { const g = G(); g.save(); o.tx?.(g); o.paint(g, t, OV().fill || o.fill); g.restore(); } });
}

/* ---------- text: one element per line ---------- */
// lay a line out with the element's weight/width edits applied
function layLine(g, ln, ov, x, w, align) {
  const f = D.fontOv(ln.role, ln.size, ov), fh = D.fontOv(ln.hiRole || ln.role, ln.size, ov, true);
  g.font = f;
  const sp = g.measureText(' ').width, words = [];
  let cx = 0;
  ln.words.forEach((wd, wi) => {
    const segs = [], x0 = cx;
    wd.segs.forEach(s => { const hi = !!(s.hi && ln.hi); g.font = hi ? fh : f; segs.push({ t: s.t, hi, x: cx, f: hi ? fh : f }); cx += g.measureText(s.t).width; });
    words.push({ segs, x: x0, w: cx - x0, hi: segs.some(s => s.hi) });
    if (wi < ln.words.length - 1) cx += sp;
  });
  const x0 = align === 'center' ? x + (w - cx) / 2 : align === 'right' ? x + w - cx : x;
  return { words, lw: cx, x0 };
}
const plainLine = (text, role, size, color) => ({ words: D.words(text).map(segs => ({ segs })), size, role, color });
/* anim: words (each word arrives in turn), slam (drops in big), glide (pops/glides in), poster (slams,
   alternating sides when sliding), fade, write (revealed left to right), none */
function textEl(pl, o) {
  const ln = o.ln, h = ln.size;
  const draw = t0 => {
    const g = G(), ov = OV(), L = layLine(g, ln, ov, o.x, o.w, o.align), base = o.y + ln.size * ASC;
    const col = ov.color || ln.color, hcol = ov.hcolor || ln.hi || col, mv = motion();
    const paintWord = wd => wd.segs.forEach(s => { g.font = s.f; g.fillStyle = s.hi ? hcol : col; g.fillText(s.t, L.x0 + s.x, base); });
    const paint = () => L.words.forEach(paintWord);
    g.save(); o.tx?.(g); g.textBaseline = 'alphabetic';
    const p = t0 == null ? 1 : prog(t0, o.anim === 'write' ? .7 : .42), cx = L.x0 + L.lw / 2, cy = o.y + ln.size * .45;
    switch (o.anim) {
      case 'words':
        L.words.forEach((wd, wi) => {
          const q = t0 == null ? 1 : prog(t0 + wi * WS, .5);
          if (q <= 0) return;
          g.save(); g.globalAlpha *= mv === 'fade' ? EASE.out(q) : Math.min(1, q * 1.6);
          if (q < 1 && mv === 'pop') {
            if (wd.hi) { const s = .3 + .7 * EASE.back(q), mx = L.x0 + wd.x + wd.w / 2, my = base - ln.size * .35; g.translate(mx, my); g.scale(s, s); g.translate(-mx, -my); }
            else g.translate(0, (1 - EASE.out(q)) * ln.size * .6);
          } else if (q < 1 && mv === 'slide') g.translate(-(1 - EASE.out(q)) * ln.size * .45, 0);
          paintWord(wd); g.restore();
        });
        break;
      case 'poster':
        if (p > 0) {
          g.save();
          if (p < 1) {
            if (mv === 'pop') { const s = 1.9 - .9 * EASE.out(p); g.globalAlpha *= Math.min(1, p * 2.5); g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy); }
            else if (mv === 'slide') { g.globalAlpha *= Math.min(1, p * 2); g.translate(((o.idx || 0) % 2 ? 1 : -1) * (1 - EASE.out(p)) * o.w * .8, 0); }
            else g.globalAlpha *= EASE.out(p);
          }
          paint(); g.restore();
        }
        break;
      case 'slam': enter(g, p, cx, cy, [L.lw * .3 * (o.dir ?? -1), 0], q => 1.7 - .7 * EASE.out(q), paint); break;
      case 'glide': enter(g, p, cx, cy, [L.lw * .3 * (o.dir ?? -1), 0], popBack, paint); break;
      case 'fade': if (p > 0) { g.save(); g.globalAlpha *= EASE.out(p); g.translate(0, (1 - EASE.out(p)) * ln.size * .3); paint(); g.restore(); } break;
      case 'write':
        if (p > 0) { g.save(); g.beginPath(); g.rect(L.x0 - ln.size, o.y - ln.size, (L.lw + ln.size * 2) * EASE.out(p), ln.size * 3); g.clip(); paint(); g.restore(); }
        break;
      default: paint();
    }
    g.restore();
  };
  pl.add({ id: o.id, slide: o.slide, name: o.name, role: ln.role, textual: true, hasHi: !!ln.hi && ln.words.some(w => w.segs.some(s => s.hi)),
    parent: o.parent, top: o.top, fs: ln.size, align: o.align || 'left', x: o.x, y: o.y, w: o.w, h, t0: o.t0, draw,
    measure: tk => { const L = layLine(MC, ln, tk || {}, o.x, o.w, o.align); return { x: L.x0, w: L.lw }; } });
}
// a fitted stack (from fitStack/stackAt) becomes one element per line; a pill in it (the tag) becomes a pill element
function explode(pl, base, res, x, y, align, t0, o) {
  let yy = y, t = t0, n = 0;
  res.out.forEach(it => {
    yy += it.gap;
    const lh = it.it.lh || 1.15;
    if (it.it.pill) {
      const pw = it.b.maxW + it.pad * 2;
      pillEl(pl, { id: `${base}.tag`, slide: o.slide, name: `${o.title} · tag`, lines: it.b.lines, role: it.it.role, size: it.size, lh, padX: it.pad, padY: it.size * .35,
        cx: align === 'center' ? x + res.w / 2 : x + pw / 2, y: yy, fill: it.it.pill, ink: it.it.color, t0: t, parent: o.parent, tx: o.tx });
      t += .2; yy += it.h; return;
    }
    const kind = typeof o.anim === 'function' ? o.anim(it.it.role) : o.anim;
    it.b.lines.forEach((line, li) => {
      textEl(pl, { id: `${base}.${n}`, slide: o.slide, name: o.label ? o.label(it.it.role, n) : `${o.title} · line ${n + 1}`,
        ln: { words: line.words, size: it.size, role: it.it.role, hiRole: it.it.hiRole, color: it.it.color, hi: it.it.hi },
        x, y: yy + li * it.size * lh, w: res.w, align, anim: kind, t0: kind === 'words' ? t : t0 == null ? null : t0 + n * .1, dir: o.dir, parent: o.parent, tx: o.tx, top: o.top });
      if (kind === 'words') t += line.words.length * WS;
      n++;
    });
    if (kind === 'words') t += .15;
    yy += it.h;
  });
  return t;
}
// a pill (tag, button, label): its own fill, and text with weight/width/color edits; it grows from its center
function pillEl(pl, o) {
  const lh = o.lh ?? 1.08, lineText = l => l.words.map(w => w.segs.map(s => s.t).join('')).join(' ');
  const size = (g, ov) => {
    const f = D.fontOv(o.role, o.size, ov); g.font = f;
    const lw = Math.max(...o.lines.map(l => g.measureText(lineText(l)).width));
    const pw = lw + o.padX * 2, ph = blockH(o.lines.length, o.size, lh) + o.padY * 2;
    return { f, pw, ph, px: o.cx - pw / 2 };
  };
  const z = size(MC, {});
  const draw = t0 => {
    const g = G(), ov = OV(), Z = size(g, ov), y = o.y, p = t0 == null ? 1 : prog(t0, .5);
    if (p <= 0) return;
    const fill = ov.fill || o.fill, ink = ov.color || o.ink, cy = y + Z.ph / 2;
    const since = now() - (t0 ?? 0) - 1.1, amb = o.cta && ambient() && since > 0, r = Math.min(Z.ph / 2, o.radius ?? 1e9);
    g.save(); o.tx?.(g);
    enter(g, p, o.cx, cy, [0, Z.ph * 1.2], popBack, () => {
      const pulse = amb && S().pulse ? 1 + .05 * Math.pow(Math.max(0, Math.sin(since * Math.PI / 1.1)), 6) : 1;
      g.save(); g.translate(o.cx, cy); g.scale(pulse, pulse); g.translate(-o.cx, -cy);
      g.fillStyle = fill; g.beginPath(); g.roundRect(Z.px, y, Z.pw, Z.ph, r); g.fill();
      if (amb) {
        const q = (since % 2.6) / .75;
        if (q < 1) {
          g.save(); g.beginPath(); g.roundRect(Z.px, y, Z.pw, Z.ph, r); g.clip();
          const sx = Z.px - Z.ph + (Z.pw + Z.ph * 2) * q;
          g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath();
          g.moveTo(sx, y); g.lineTo(sx + Z.ph * .5, y); g.lineTo(sx + Z.ph * .1, y + Z.ph); g.lineTo(sx - Z.ph * .4, y + Z.ph); g.closePath(); g.fill();
          g.restore();
        }
      }
      g.font = Z.f; g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const top = D.pillTextTop(Z.f, o.size, o.lines.length, lh, y, Z.ph);
      o.lines.forEach((l, i) => g.fillText(lineText(l), o.cx, top + o.size * ASC + i * o.size * lh));
      g.restore();
    });
    g.restore();
  };
  pl.add({ id: o.id, slide: o.slide, name: o.name, role: o.role, textual: true, fillable: true, parent: o.parent, top: o.top, fs: o.size, align: 'center',
    x: z.px, y: o.y, w: z.pw, h: z.ph, t0: o.t0, draw, measure: tk => { const Z = size(MC, tk || {}); return { x: Z.px, w: Z.pw }; } });
}

/* ---------- fitting ---------- */
const fit1 = (text, role, w, h, o = {}) => text && text.trim() ? fitStack(MC, [{ text, role, r: 1, lh: o.lh ?? 1.05, color: o.color, hi: o.hi, hiRole: o.hiRole, maxLines: o.maxLines ?? 3 }], w, h, o.max ?? 400) : null;
const officeOf = (c, mode) => ((mode === 'short' ? c.short || c.office : c.office || c.short) || '').trim();
/* the judges' name stacks ("Justice Anita" / EARLS / "for Supreme Court") at one shared size;
   office lines go first, then the short office, then titles, until the last name is readable */
function namesFit(ids, w, h, color, P, o = {}) {
  const C = S().candidates, minP = minText(P), pr = o.preR ?? .52, orr = o.offR ?? .42;
  const modes = o.modes || [['p', 'office'], ['p', 'short'], ['p', null], [null, 'short'], [null, null]];
  for (const [pre, off] of modes) {
    const sets = ids.map(i => { const c = C[i]; return [
      pre && c.showPrefix && c.prefix.trim() && { text: c.prefix, role: 'condBold', r: pr, lh: 1, color, maxLines: 1, gap: 0 },
      { text: c.last, role: 'last', r: 1, lh: 1, color, maxLines: 1, gap: o.gap ?? .06 },
      off && c.showOffice && officeOf(c, off) && { text: officeOf(c, off), role: 'cond', r: orr, lh: 1.05, color: o.offColor || color, maxLines: 1, gap: .22 },
    ].filter(Boolean); });
    const ratios = [pre && sets.some(s => s[0].role === 'condBold') && pr, off && sets.some(s => s.length && s[s.length - 1].role === 'cond') && orr].filter(Boolean);
    const lo = minP / Math.min(1, ...ratios);
    const ok = s => sets.every(it => stackAt(MC, it, w, h, s)) ? s : null;
    if (!ok(lo)) continue;
    const s = search(ok, lo, Math.min(h, o.max ?? 230));
    return { s, res: sets.map(it => stackAt(MC, it, w, h, s)) };
  }
  return null;
}
const ROLE_LABEL = { condBold: 'title', last: 'last name', cond: 'office', heavy: 'name' };
// a judge's name stack as separate lines: the title glides in, the last name slams down, the office fades up
function nameEls(pl, i, base, res, x, y, align, t0, o = {}) {
  const last = S().candidates[i].last;
  return explode(pl, base, res, x, y, align, t0, { ...o, title: last, anim: r => r === 'last' ? 'slam' : r === 'condBold' ? 'glide' : 'fade', label: r => `${last} · ${ROLE_LABEL[r] || 'line'}` });
}
// headline (with the tag above it unless small): the full line where it reads well, else the short one
function headerFit(w, h, colors, P, small, maxBase) {
  const t = msgOf(P), m = Math.min(P.w, P.h);
  const make = head => fitStack(MC, [
    !small && { text: t.kicker.toUpperCase(), role: 'condBold', r: .5, cap: w * .045 + 8, min: minText(P), pill: colors.kick, color: colors.kickInk, maxLines: 1, lh: 1, gap: 0, optional: true },
    { text: head, role: 'head', hiRole: 'heavy', r: 1, lh: 1.04, color: colors.ink, hi: colors.hi, gap: .42 },
  ], w, h, maxBase ?? Math.min(w * .1, 120));
  const long = t.headline.trim() ? make(t.headline) : null, short = t.short.trim() ? make(t.short) : null;
  const res = long && (!short || long.s >= Math.max(16, m * .045)) ? long : short || long;
  if (!res || res.out.find(o => o.it.role === 'head').size < minText(P)) return null;
  return res;
}
const headerBlock = (pl, x, w, h, colors, align, P, small, slide, base = 'head') => {
  const res = headerFit(w, h, colors, P, small);
  return res && { h: res.total, w: res.maxW, place(y, t0) { return explode(pl, base, res, x, y, align, t0, { slide, title: 'Headline', anim: 'words' }); } };
};
/* justified poster type: every line stretched to the full width, the way a
   gig poster stacks words; picks the line breaks that give the biggest type */
function partition(ww, space, L) {
  const n = ww.length, pre = [0];
  ww.forEach((w, i) => pre.push(pre[i] + w));
  const width = (a, b) => pre[b] - pre[a] + space * (b - a - 1), target = width(0, n) / L, INF = 1e18;
  const dp = Array.from({ length: L + 1 }, () => new Array(n + 1).fill(INF)), cut = Array.from({ length: L + 1 }, () => new Array(n + 1).fill(0));
  dp[0][0] = 0;
  for (let l = 1; l <= L; l++) for (let b = l; b <= n; b++) for (let a = l - 1; a < b; a++) {
    if (dp[l - 1][a] === INF) continue;
    const c = dp[l - 1][a] + (width(a, b) - target) ** 2;
    if (c < dp[l][b]) { dp[l][b] = c; cut[l][b] = a; }
  }
  const out = []; let b = n;
  for (let l = L; l > 0; l--) { const a = cut[l][b]; out.unshift([a, b]); b = a; }
  return out;
}
function poster(text, w, hMax, P, o = {}) {
  if (!text || !text.trim()) return null;
  const ws = D.words(text.toUpperCase()), role = o.role || 'heavy', lead = o.lead ?? .16;
  MC.font = font(role, 100);
  const space = MC.measureText(' ').width, capH = (MC.measureText('H').actualBoundingBoxAscent || 72) / 100;
  const ww = ws.map(segs => segs.reduce((a, s) => a + MC.measureText(s.t).width, 0));
  let best = null;
  for (let L = 1; L <= Math.min(o.maxLines ?? 6, ws.length); L++) {
    const lines = partition(ww, space, L).map(([a, b]) => ({ a, b, size: 100 * w / (ww.slice(a, b).reduce((x, y) => x + y, 0) + space * (b - a - 1)) }));
    const mn = Math.min(...lines.map(l => l.size));
    lines.forEach(l => { l.size = Math.min(l.size, mn * 1.6); });
    let tot = lines.reduce((a, l, i) => a + l.size * capH + (i ? l.size * lead : 0), 0);
    const k = tot > hMax ? hMax / tot : 1;
    lines.forEach(l => { l.size *= k; }); tot *= k;
    const score = Math.min(...lines.map(l => l.size)) * (k < 1 ? .97 : 1);
    if (!best || score > best.score) best = { lines, score, h: tot };
  }
  if (!best || best.score < minText(P) * 1.15) return null;
  return { ...best, w, ws, capH, role, lead };
}
function posterEls(pl, PT, x, y, align, ink, hi, t0, slide) {
  let yy = y;
  PT.lines.forEach((l, i) => {
    if (i) yy += l.size * PT.lead;
    textEl(pl, { id: `head.${i}`, slide, name: `Headline · line ${i + 1}`, ln: { words: PT.ws.slice(l.a, l.b).map(segs => ({ segs })), size: l.size, role: PT.role, hiRole: PT.role, color: ink, hi },
      x, y: yy + l.size * PT.capH - l.size * ASC, w: PT.w, align, anim: 'poster', idx: i, t0: t0 + i * .11 });
    yy += l.size * PT.capH;
  });
}
function pillFit(text0, w, h, P, maxLines = 2) {
  let text = (text0 || '').trim();
  if (!text) return null;
  for (;;) {
    const F = search(s => {
      const b = wrap(MC, text, font('heavy', s), w - s * 1.8);
      if (b.over || b.lines.length > maxLines) return null;
      const ph = blockH(b.lines.length, s, 1.08) + s * 1.1, pw = b.maxW + s * 1.8;
      return ph <= h && pw <= w ? { s, b, ph, pw } : null;
    }, 4, Math.min(h * .5, 72));
    if (F && F.s >= minText(P) * .9) return F;
    const shorter = text.replace(/\s+\S+$/, '');
    if (shorter === text || !/\s/.test(shorter)) return null;
    text = shorter;
  }
}
const ctaEl = (pl, F, x, y, fill, ink, t0, slide, o = {}) => F && pillEl(pl, { id: o.id || 'cta', slide, name: 'Button', lines: F.b.lines, role: 'heavy', size: F.s, padX: F.s * .9, padY: F.s * .55, cx: x + F.pw / 2, y, fill, ink, t0, cta: true, top: o.top });
// the legal line (with an optional backing pill so it reads on any background)
function discEl(pl, P, x, w, y, size, ink, align, back, slide = '*') {
  const text = S().text.disclaimer.trim();
  if (!text) return 0;
  MC.font = font('medium', size);
  const tw = MC.measureText(text).width, s = tw > w * (back ? .9 : 1) ? size * w * (back ? .9 : 1) / tw : size;
  if (back) {
    pillEl(pl, { id: 'disclaimer', slide, name: 'Disclaimer', lines: [plainLine(text, 'medium', s, ink)], role: 'medium', size: s, padX: s * .6, padY: s * .32, cx: x + w / 2, y, fill: back, ink, t0: .3, top: true });
    return s * 1.65;
  }
  textEl(pl, { id: 'disclaimer', slide, name: 'Disclaimer', ln: plainLine(text, 'medium', s, ink), x, y, w, align, anim: 'fade', t0: .3, top: true });
  return s * 1.15;
}

/* ---------- photos ---------- */
function paintJudge(g, i, cx, base, h, rise = 1, clip) {
  if (rise <= 0) return;
  const c = S().candidates[i], img = D.judgeImg(i), dy = (1 - EASE.out(clamp(rise, 0, 1))) * h * 1.05;
  g.save(); g.beginPath();
  if (clip) clip(g); else g.rect(cx - h * 3, base - h * 3, h * 6, h * 3);
  g.clip();
  if (img) {
    const s = h * (c.zoom || 1) / img.height, iw = img.width * s, ih = img.height * s;
    g.drawImage(img, cx - iw / 2 + (c.x || 0) * h * .45, base - ih + (c.y || 0) * h * .45 + dy, iw, ih);
  } else {
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.arc(cx, base - h * .7 + dy, h * .2, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(cx, base + h * .02 + dy, h * .46, h * .4, 0, 0, TAU); g.fill();
  }
  g.restore();
}
const judgeAspect = i => { const im = D.judgeImg(i); return im ? im.width / im.height : 1.05; };
// a headshot's frame: its own edit (per slide, per size), else the setting for judges or the endorser
const judgeFrame = () => OV().frame || S().frame, endFrame = () => OV().frame || S().endFrame || 'circle';
const framePath = (g, cx, cy, d, frame) => { if (frame === 'square') g.roundRect(cx - d / 2, cy - d / 2, d, d, d * .16); else g.arc(cx, cy, d / 2, 0, TAU); };
// a cutout standing in a disc, the head popping out over the top
function paintPop(g, i, cx, dcy, d, disc, rise, frame = judgeFrame()) {
  const h = d * 1.12, base = dcy + d / 2;
  if (frame !== 'none') { g.fillStyle = disc; g.beginPath(); framePath(g, cx, dcy, d, frame); g.fill(); }
  paintJudge(g, i, cx, base, h, rise, frame === 'none' ? null : gg => { gg.rect(cx - d * .58, base - h * 2, d * 1.16, h * 2 - d / 2); framePath(gg, cx, dcy, d, frame); });
}
// the endorser's face: in a ringed circle or rounded square, or (no frame) the cutout standing in the box
function paintFace(g, img, adj, cx, cy, d, ring, frame = endFrame()) {
  if (frame === 'none') {
    if (!img) return;
    const h = d * 1.1 * (adj.zoom || 1), s = h / img.height, iw = img.width * s;
    g.drawImage(img, cx - iw / 2 + (adj.x || 0) * d * .5, cy + d / 2 - h + (adj.y || 0) * d * .5, iw, h);
    return;
  }
  const sq = frame === 'square', shape = (gg, dd) => sq ? gg.roundRect(cx - dd / 2, cy - dd / 2, dd, dd, dd * .16) : gg.arc(cx, cy, dd / 2, 0, TAU);
  if (ring) { g.fillStyle = ring; g.beginPath(); shape(g, d); g.fill(); }
  const r = d / 2 * (ring ? .9 : 1);
  g.save(); g.beginPath(); shape(g, r * 2); g.clip();
  g.fillStyle = '#d9dbe3'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (img) {
    const h = r * 2 * 1.45 * (adj.zoom || 1), s = h / img.height, iw = img.width * s;
    g.drawImage(img, cx - iw / 2 + (adj.x || 0) * r, cy - r * .8 + (adj.y || 0) * r, iw, h);
  }
  g.restore();
}
function burstPath(g, cx, cy, R, points = 18, inner = .84) {
  g.beginPath();
  for (let k = 0; k < points * 2; k++) {
    const a = -Math.PI / 2 + k * Math.PI / points, r = k % 2 ? R * inner : R;
    k ? g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

/* ---------- shared blocks ---------- */
// the four judges in a grid: a cutout in a disc over each name stack (names only when photos won't fit)
function gridFit(R, P, ink) {
  const ids = [0, 1, 2, 3];
  for (const photos of D.usePhotos() ? [true, false] : [false]) {
    let best = null;
    for (const cols of [4, 2, 1]) {
      if (cols === 1 && R.w > 280) continue;
      const rows = 4 / cols, gx = R.w * (cols === 4 ? .035 : .08), cw = (R.w - gx * (cols - 1)) / cols;
      const build = d => {
        const nf = namesFit(ids, cw, photos ? d * .7 : R.h / rows * .9, ink, P, { max: photos ? d * .26 : cw * .22 });
        if (!nf) return null;
        const nh = Math.max(...nf.res.map(r => r.total)), ph = photos ? d * 1.12 : 0, gi = photos ? d * .08 : 0;
        const cellH = ph + gi + nh, gy = photos ? d * .16 : nh * .4, total = rows * cellH + (rows - 1) * gy;
        return total <= R.h ? { cols, rows, gx, cw, d, nf, ph, gi, cellH, gy, total, nh, photos } : null;
      };
      let F;
      if (photos) { if (!build(30)) continue; F = search(build, 30, Math.min(cw * .94, R.h)); } else F = build(0);
      if (!F) continue;
      const score = (photos ? F.d : 1) * F.nf.s;
      if (!best || score > best.score) best = { ...F, score };
    }
    if (best) return best;
  }
  return null;
}
function gridBlock(pl, R, P, ink, disc, slide, base = 'grid') {
  const F = gridFit(R, P, ink);
  if (!F) return null;
  const tw = F.cols * F.cw + (F.cols - 1) * F.gx, x0 = R.x + (R.w - tw) / 2;
  return { h: F.total, w: tw, place(y, t0) {
    [0, 1, 2, 3].forEach(i => {
      const col = i % F.cols, row = Math.floor(i / F.cols), cx = x0 + col * (F.cw + F.gx), cy = y + row * (F.cellH + F.gy), t = t0 + i * .22, last = S().candidates[i].last;
      if (F.photos) {
        const mid = cx + F.cw / 2, dcy = cy + F.ph - F.d / 2;
        photoEl(pl, { id: `${base}.photo${i}`, slide, name: `${last} · photo`, framable: 'judge', x: mid - F.d / 2, y: cy, w: F.d, h: F.ph, t0: t, fill: disc,
          paint: (g, tt, fill) => enter(g, tt == null ? 1 : prog(tt, .45), mid, dcy, [0, F.d * .5], popBack, () => paintPop(g, i, mid, dcy, F.d, fill, motion() === 'fade' || tt == null ? 1 : prog(tt + .15, .6))) });
      }
      nameEls(pl, i, `${base}.name${i}`, F.nf.res[i], cx, cy + F.ph + F.gi, 'center', t + .35, { slide, dir: 0 });
    });
  } };
}
// Roy Cooper: face and name ('row' = name beside the face, 'stack' = under it)
function cooperBlock(pl, x, w, h, ring, ink, style, P, slide, base = 'cooper') {
  const E = S().endorser, name = E.name.trim();
  if (!name) return null;
  const gap = Math.min(w, h) * .08;
  const face = (cx, cy, d, t0) => photoEl(pl, { id: `${base}.face`, slide, name: 'Roy Cooper · photo', framable: 'endorser', x: cx - d / 2, y: cy - d / 2, w: d, h: d, t0, fill: ring,
    paint: (g, tt, fill) => enter(g, tt == null ? 1 : prog(tt, .5), cx, cy, [0, d * .4], popBack, () => paintFace(g, D.endorserImg(), E, cx, cy, d, fill)) });
  const nameLines = (res, nx, ny, align, t0) => explode(pl, `${base}.name`, res, nx, ny, align, t0, { slide, title: 'Roy Cooper', anim: 'glide', label: (_, n) => `Roy Cooper · name${n ? ` line ${n + 1}` : ''}` });
  if (style === 'stack') {
    const d = Math.min(w * .8, h * .66), res = fit1(name, 'heavy', w, h - d - gap, { color: ink, maxLines: 2, max: d * .32 });
    const ok = res && res.s >= minText(P);
    return { h: d + (ok ? gap + res.total : 0), w, place(y, t0) { face(x + w / 2, y + d / 2, d, t0); if (ok) nameLines(res, x, y + d + gap, 'center', t0 + .25); } };
  }
  const d = Math.min(h, w * .36), res = fit1(name, 'heavy', w - d - gap, d * .7, { color: ink, maxLines: 2, max: d * .4 });
  const ok = res && res.s >= minText(P), gw = d + (ok ? gap + res.maxW : 0);
  return { h: d, w: gw, place(y, t0, xAt) {
    const x0 = xAt ?? x + (w - gw) / 2;
    face(x0 + d / 2, y + d / 2, d, t0);
    if (ok) nameLines({ ...res, w: res.maxW }, x0 + d + gap, y + (d - res.total) / 2, 'left', t0 + .25);
  } };
}

/* =========================================================================
   SPOTLIGHT: a headline slide, a slide per judge, then the end card
   ========================================================================= */
function spotlight(P) {
  const f = famOf(P), { m, pad, box } = frameOf(P), { Y, B, W, K } = pal(), M = msgOf(P), cfg = S().sizes[P.key] || {};
  const endOn = !!(cfg.endorser && S().endorser.name.trim()), discOn = !!(cfg.disclaimer && S().text.disclaimer.trim()), photos = D.usePhotos();
  const banner = f === 'strip' || f === 'bill', pl = newPlan(P);
  let A = { ...box }, side = null;
  if (banner) [side, A] = cutRight(box, box.w * (f === 'strip' ? .3 : .22), pad);
  const sw = banner ? side.x - pad * .5 : P.w; // slides cover everything left of the side column
  const fillScene = (g, fill) => { g.fillStyle = fill; g.fillRect(0, 0, sw, P.h); };

  // on every slide: the legal line, and on banners a white column with the button (and Cooper on the billboard)
  if (discOn && !banner) {
    const s = clamp(P.h * .017, 10, 20), bh = s * 1.65;
    discEl(pl, P, A.x, A.w, A.y + A.h - bh, s, K, 'center', W);
    A = cutBottom(A, bh, pad * .4)[1];
  }
  if (banner) {
    shapeEl(pl, { id: 'side', slide: '*', name: 'Side panel', top: true, x: sw, y: 0, w: P.w - sw, h: P.h, t0: 0, fill: W, paint: (g, fill) => { g.fillStyle = fill; g.fillRect(sw, 0, P.w - sw, P.h); } });
    let rest = { ...side };
    if (discOn) {
      const s = clamp(P.h * (f === 'strip' ? .14 : .05), 7.5, 13);
      discEl(pl, P, rest.x, rest.w, rest.y + rest.h - s * 1.15, s, K, 'center');
      rest = cutBottom(rest, s * 1.15, pad * .3)[1];
    }
    if (f === 'bill' && endOn) {
      const [ct, r2] = cutTop(rest, rest.h * .42, pad * .4), cb = cooperBlock(pl, ct.x, ct.w, ct.h, Y, K, 'row', P, '*');
      if (cb) { cb.place(ct.y + (ct.h - cb.h) / 2, .9); rest = r2; }
    }
    const F = pillFit(M.cta, rest.w, rest.h, P, 3);
    ctaEl(pl, F, rest.x + (rest.w - (F?.pw || 0)) / 2, rest.y + (rest.h - (F?.ph || 0)) / 2, B, W, .5, '*', { top: true });
  }

  // slide 1: the headline, big, on yellow
  const s0 = pl.slide({ name: 'Headline', start: 0, ox: A.x + A.w / 2, oy: A.y + A.h / 2 });
  bgEl(pl, s0, 'Headline', Y, (g, fill) => {
    fillScene(g, fill);
    const R = Math.hypot(sw, P.h) * .32 * EASE.out(prog(0, .7)); // a pale disc swells up in the corner
    g.fillStyle = mix(fill, W, .25); g.beginPath(); g.arc(sw, P.h, R, 0, TAU); g.fill();
  });
  const hook = headerBlock(pl, A.x, A.w, A.h * (banner ? 1 : .86), { kick: B, kickInk: W, ink: K, hi: B }, banner || f === 'wide' ? 'left' : 'center', P, f === 'strip', s0, 'hook');
  const hookEnd = hook ? hook.place(A.y + (A.h - hook.h) / 2, .12) : .5;
  // slide lengths: the user's, else a long headline gets time to finish building before the first judge
  const len = [D.slideLen(0, Math.max(1.45, hookEnd + .55)), ...[1, 2, 3, 4].map(j => D.slideLen(j, 1.6)), D.slideLen(5, 3)];
  const starts = len.reduce((a, l) => [...a, a[a.length - 1] + l], [0]), END0 = starts[5];

  // slides 2-5: one judge each
  [0, 1, 2, 3].forEach(i => {
    const bg = i % 2 ? Y : B, ink = bg === Y ? K : W, accent = bg === Y ? B : Y, last = S().candidates[i].last;
    let nb, cx, base, ph, align = 'left';
    if (f === 'tall') {
      [nb] = cutTop(A, A.h * .32, pad * .4); align = 'center';
      const top = nb.y + nb.h + pad * .4;
      ph = Math.min(P.h - top, P.w * .95); cx = P.w / 2; base = top + ph;
    } else if (f === 'square') {
      const [l, r] = cutLeft(A, A.w * .5, pad * .5); nb = l;
      ph = Math.min(P.h - A.y * .6, (r.w + pad) * .98); cx = r.x + r.w * .52; base = P.h;
    } else if (f === 'wide') {
      const [l, r] = cutLeft(A, A.w * .46, pad); nb = r;
      ph = Math.min(P.h - A.y * .5, l.w * 1.02); cx = l.x + l.w / 2; base = P.h;
    } else {
      const pw = Math.min(A.w * .42, P.h * 1.15), [l, r] = cutLeft(A, pw, pad * .5); nb = r;
      ph = P.h - Math.max(2, pad * .3); cx = l.x + l.w / 2; base = P.h;
    }
    if (!photos) { nb = A; align = banner || f === 'wide' ? 'left' : 'center'; }
    const d = Math.min(ph * .82, (f === 'tall' ? A.w : P.w * .5) * .9), dcy = base - ph * .44, ts = starts[1 + i];
    const k = pl.slide({ name: last, start: ts, ox: photos ? cx : A.x + A.w / 2, oy: photos ? dcy : A.y + A.h / 2 });
    bgEl(pl, k, last, bg, fillScene);
    if (base < P.h - 1) shapeEl(pl, { id: `s${k}.ground`, slide: k, name: `${last} · ground`, x: 0, y: base, w: sw, h: P.h - base, t0: ts, fill: accent, paint: (g, fill) => { g.fillStyle = fill; g.fillRect(0, base, sw, P.h - base); } });
    if (photos) {
      // the frame behind the photo follows the photo's Frame setting (and its Fill, if set there)
      const pid = `s${k}.photo`, fr = PP => D.tweakFor(PP, pid)?.frame || S().frame;
      shapeEl(pl, { id: `s${k}.disc`, slide: k, name: `${last} · frame`, x: cx - d / 2, y: dcy - d / 2, w: d, h: d, t0: ts + .05, fill: accent, hitLast: true, off: PP => fr(PP) === 'none',
        paint: (g, fill, t) => { const f0 = fr(D.curP()); if (f0 === 'none') return; const fl = OV().fill || D.tweakFor(D.curP(), pid)?.fill || fill;
          enter(g, t == null ? 1 : prog(t, .4), cx, dcy, [0, d * .3], popBack, () => { g.fillStyle = fl; g.beginPath(); framePath(g, cx, dcy, d, f0); g.fill(); }); } });
      const pw = ph * judgeAspect(i);
      photoEl(pl, { id: `s${k}.photo`, slide: k, name: `${last} · photo`, framable: 'judge', fill: accent, x: cx - pw / 2, y: base - ph, w: pw, h: ph, t0: ts + .12,
        paint: (g, t) => paintJudge(g, i, cx, base, ph, motion() === 'fade' || t == null ? 1 : prog(t, .55), gg => gg.rect(0, -P.h, sw, base + P.h)) });
    }
    const nf = namesFit([i], nb.w, nb.h, ink, P, { offColor: accent, max: nb.h * .55, preR: .48 });
    if (nf) { const r = nf.res[0]; nameEls(pl, i, `s${k}.name`, r, nb.x, nb.y + (nb.h - r.total) / 2, align, ts + .3, { slide: k }); }
  });

  // the end card (the finished frame): headline, everyone, Cooper, the button
  const e = pl.slide({ name: 'End card', start: END0, ox: P.w / 2, oy: P.h / 2 });
  bgEl(pl, e, 'End card', B, (g, fill) => {
    fillScene(g, fill);
    if (P.safe) { // Stories: a sunrise fills the bottom of the frame, where Instagram's buttons sit
      const R = P.w * .62 * EASE.back(prog(END0 + .2, .7));
      g.fillStyle = mix(fill, W, .1);
      for (let q = 0; q < 12; q++) { const a = Math.PI + q * Math.PI / 6; g.beginPath(); g.moveTo(P.w / 2, P.h); g.arc(P.w / 2, P.h, R * 2, a, a + Math.PI / 12); g.closePath(); g.fill(); }
      g.fillStyle = Y; g.beginPath(); g.arc(P.w / 2, P.h, R, 0, TAU); g.fill();
    }
  });
  const endC = { kick: Y, kickInk: K, ink: W, hi: Y }, t1 = END0 + .3;
  if (f === 'tall' || f === 'square') {
    const hdr = headerBlock(pl, A.x, A.w, A.h * (f === 'tall' ? .27 : .25), endC, 'center', P, false, e);
    const ctaH = Math.max(A.h * (f === 'tall' ? .1 : .13), 30);
    let F = pillFit(M.cta, A.w * .86, ctaH, P), coop = null, row = null;
    if (endOn) {
      if (f === 'square') {
        coop = cooperBlock(pl, A.x, A.w * .42, A.h * .13, Y, W, 'row', P, e);
        if (coop) { F = pillFit(M.cta, A.w - coop.w - pad * 1.5, ctaH, P); row = F && { h: Math.max(coop.h, F.ph) }; }
      } else coop = cooperBlock(pl, A.x, A.w, A.h * .11, Y, W, A.w < 420 ? 'stack' : 'row', P, e);
    }
    const ctaRow = row || (F && { h: F.ph });
    const used = (hdr?.h || 0) + (row ? row.h : (coop?.h || 0) + (F?.ph || 0));
    const grid = gridBlock(pl, { x: A.x, y: 0, w: A.w, h: Math.max(40, A.h - used - m * .15) }, P, W, Y, e);
    column([hdr, grid, row ? null : coop, ctaRow], A, m * .07);
    hdr?.place(hdr.y, t1);
    grid?.place(grid.y, t1 + .35);
    if (row) {
      const rx = A.x + (A.w - (coop.w + pad + F.pw)) / 2;
      coop.place(row.y + (row.h - coop.h) / 2, t1 + 1.1, rx);
      ctaEl(pl, F, rx + coop.w + pad, row.y + (row.h - F.ph) / 2, Y, K, t1 + 1.3, e);
    } else {
      coop?.place(coop.y, t1 + 1.1);
      if (F) ctaEl(pl, F, A.x + (A.w - F.pw) / 2, ctaRow.y, Y, K, t1 + 1.3, e);
    }
  } else if (f === 'wide') {
    const [l, r] = cutLeft(A, A.w * .42, pad);
    const hdr = headerBlock(pl, l.x, l.w, l.h * .55, endC, 'left', P, false, e), F = pillFit(M.cta, l.w, l.h * .17, P);
    const coop = endOn ? cooperBlock(pl, l.x, l.w, l.h * .2, Y, W, 'row', P, e) : null, fb = F && { h: F.ph };
    column([hdr, coop, fb], l, m * .07);
    hdr?.place(hdr.y, t1);
    coop?.place(coop.y, t1 + 1.1, l.x);
    if (fb) ctaEl(pl, F, l.x, fb.y, Y, K, t1 + 1.3, e);
    const grid = gridBlock(pl, r, P, W, Y, e);
    grid?.place(r.y + (r.h - grid.h) / 2, t1 + .35);
  } else {
    // banners: headline beside the judges when there's room, else just the judges
    let lb = A;
    if (A.w > 380) {
      const [l, r] = cutLeft(A, A.w * .36, pad * .6);
      const hdr = headerBlock(pl, l.x, l.w, l.h, endC, 'left', P, f === 'strip', e);
      if (hdr) { hdr.place(l.y + (l.h - hdr.h) / 2, t1); lb = r; }
    }
    const grid = gridBlock(pl, lb, P, W, Y, e);
    grid?.place(lb.y + (lb.h - grid.h) / 2, t1 + .35);
  }
  return pl.done({ bg: B, end: END0 + 1.3, total: END0 + len[5] });
}

/* =========================================================================
   FRONT ROW: ticker, poster headline, the judges shoulder to shoulder
   ========================================================================= */
// the ticker's words: the message's own ticker text (phrases split by |), else its tag and button text
const tickerText = M => ((M.ticker || '').trim() ? M.ticker.split('|') : [M.kicker, M.cta]).map(t => (t || '').trim()).filter(Boolean).map(t => t.toUpperCase()).join('   ★   ');
function frontrow(P) {
  const f = famOf(P), { pad, box } = frameOf(P), { Y, B, W, K } = pal(), M = msgOf(P), cfg = S().sizes[P.key] || {};
  const endOn = !!(cfg.endorser && S().endorser.name.trim()), discOn = !!(cfg.disclaimer && S().text.disclaimer.trim()), photos = D.usePhotos();
  const pl = newPlan(P), ids = [0, 1, 2, 3], C = S().candidates;
  pl.slide({ name: 'Ad', start: 0, ox: P.w / 2, oy: P.h / 2 });
  bgEl(pl, 0, 'Ad', Y, (g, fill) => { g.fillStyle = fill; g.fillRect(0, 0, P.w, P.h); });
  let nPanel = 0, nStrip = 0, nSun = 0;
  // the blue panel the judges stand in, with slow-turning rays behind a rising sun
  const panel = (x, y, w, h, t0, sun) => {
    const id = nPanel++ ? `panel${nPanel}` : 'panel';
    shapeEl(pl, { id, name: nPanel > 1 ? `Panel ${nPanel}` : 'Panel', x, y, w, h, t0, fill: B, paint: (g, fill, t) => {
      const p = t == null ? 1 : EASE.out(prog(t, .45));
      if (p <= 0) return;
      g.save(); g.beginPath(); g.rect(x, y + h * (1 - p), w, h * p); g.clip();
      g.fillStyle = fill; g.fillRect(x, y, w, h);
      if (sun) {
        const q = EASE.back(t == null ? 1 : prog(sun.t0, .6)), rot = ambient() ? now() * .12 : 0;
        g.fillStyle = mix(fill, W, .1);
        for (let k = 0; k < 14; k++) { const a = Math.PI + rot + k * Math.PI / 7; g.beginPath(); g.moveTo(sun.cx, sun.cy); g.arc(sun.cx, sun.cy, sun.R * 2.4 * q, a, a + Math.PI / 14); g.closePath(); g.fill(); }
      }
      g.restore();
    } });
    if (sun) {
      const sid = nSun++ ? `sun${nSun}` : 'sun';
      shapeEl(pl, { id: sid, name: nSun > 1 ? `Sun ${nSun}` : 'Sun', x: sun.cx - sun.R, y: sun.cy - sun.R, w: sun.R * 2, h: sun.R, t0: sun.t0, fill: Y, paint: (g, fill, t) => {
        const q = t == null ? 1 : EASE.back(prog(t, .6));
        if (q <= 0) return;
        g.save(); g.beginPath(); g.rect(x, y, w, Math.min(h, sun.cy - y)); g.clip();
        g.fillStyle = fill; g.beginPath(); g.arc(sun.cx, sun.cy, sun.R * q, 0, TAU); g.fill(); g.restore();
      } });
    }
  };
  const strip = (x, y, w, h, t0) => shapeEl(pl, { id: nStrip++ ? `strip${nStrip}` : 'strip', name: nStrip > 1 ? `Name strip ${nStrip}` : 'Name strip', x, y, w, h, t0, fill: W,
    paint: (g, fill, t) => { const p = t == null ? 1 : EASE.out(prog(t, .45)); if (p > 0) { g.fillStyle = fill; g.fillRect(x, y, w * p, h); } } });
  // judges standing on `base`, spread across [gx, gx + gw], the middle ones in front; then their names
  const group = (list, gx, gw, base, jh, t0) => {
    if (!photos) return;
    const slot = gw / list.length, order = list.map((_, k) => k).sort((a, b) => Math.abs(b - (list.length - 1) / 2) - Math.abs(a - (list.length - 1) / 2));
    order.forEach(k => {
      const i = list[k], cx = gx + slot * (k + .5), pw = jh * judgeAspect(i), t = t0 + k * .16;
      photoEl(pl, { id: `judge${i}`, name: `${C[i].last} · photo`, framable: 'judge', frameDefault: 'none', x: cx - pw / 2, y: base - jh, w: pw, h: jh, t0: t, fill: W, paint: (g, tt, fill) => {
        const p = tt == null ? 1 : prog(tt, .6), fr = OV().frame || 'none', d = jh / 1.12;
        const one = rise => fr === 'none' ? paintJudge(g, i, cx, base, jh, rise) : paintPop(g, i, cx, base - d / 2, d, fill, rise, fr);
        if (motion() === 'fade') { if (p <= 0) return; g.globalAlpha *= EASE.out(p); one(1); }
        else one(p);
      } });
    });
  };
  const names = (list, gx, gw, y, res, t0) => { const slot = gw / list.length; list.forEach((i, k) => nameEls(pl, i, `name${i}`, res[k], gx + slot * k + slot * .03, y, 'center', t0 + k * .16, { dir: 0 })); };
  const ticker = (x, y, w, h) => {
    const text = tickerText(M), s = h * .5;
    pl.add({ id: 'ticker', name: 'Ticker', role: 'heavy', textual: true, fillable: true, x, y, w, h, t0: 0, draw: t0 => {
      const g = G(), ov = OV(), p = t0 == null ? 1 : EASE.out(prog(t0, .4));
      if (p <= 0) return;
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(0, -h * (1 - p));
      g.fillStyle = ov.fill || K; g.fillRect(x, y, w, h);
      const fnt = D.fontOv('heavy', s, ov); g.font = fnt; g.fillStyle = ov.color || Y; g.textBaseline = 'alphabetic';
      MC.font = fnt;
      const capH = MC.measureText('H').actualBoundingBoxAscent || s * .72, base = y + h / 2 + capH / 2, unit = `${text}   ★   `, uw = g.measureText(unit).width;
      const off = ambient() ? ((now() - (t0 ?? 0)) * h * 2.4) % uw : 0;
      for (let xx = x + s * .5 - off; xx < x + w; xx += uw) g.fillText(unit, xx, base);
      g.restore();
    } });
  };
  const cooper = (cx, cy, d, t0, ink = W) => {
    const E = S().endorser, name = E.name.trim();
    if (!name) return;
    const res = fit1(name, 'heavy', d * 1.5, d * .4, { color: ink, maxLines: 2, max: d * .2 }), ok = res && res.s >= minText(P);
    photoEl(pl, { id: 'cooper.face', name: 'Roy Cooper · photo', framable: 'endorser', x: cx - d / 2, y: cy - d / 2, w: d, h: d, t0, fill: Y, paint: (g, t, fill) => {
      const p = t == null ? 1 : prog(t, .55);
      if (p <= 0) return;
      if (motion() === 'pop' && p < 1) { g.translate(cx, cy); g.rotate((1 - EASE.out(p)) * -1.4); g.scale(EASE.back(p), EASE.back(p)); g.translate(-cx, -cy); }
      else g.globalAlpha *= EASE.out(p);
      paintFace(g, D.endorserImg(), E, cx, cy, d, fill);
    } });
    if (ok) explode(pl, 'cooper.name', res, cx - d * .75, cy + d / 2 + d * .08, 'center', t0 + .3, { slide: 0, title: 'Roy Cooper', anim: 'glide', label: () => 'Roy Cooper · name' });
  };
  const headT = .2;

  if (f === 'tall' || f === 'square') {
    const th = clamp(P.h * (f === 'tall' ? .036 : .05), 16, 56), ty = P.safe ? box.y : 0;
    ticker(0, ty, P.w, th);
    const bottomY = P.safe ? box.y + box.h : P.h, contentTop = ty + th + pad * .8, avail = bottomY - contentTop;
    const cols = f === 'tall' && box.w < 340 ? 2 : 4, rows = 4 / cols;
    const PT = poster(M.headline, box.w, avail * (f === 'tall' ? .36 : .32), P, { maxLines: rows === 2 ? 5 : 6 }) || poster(M.short, box.w, avail * .3, P);
    let gy = contentTop;
    if (PT) { posterEls(pl, PT, box.x, contentTop, 'center', K, B, headT, 0); gy = contentTop + PT.h + pad * .8; }
    // Stories put Cooper under the group, so the judges get the full width
    const coopW = endOn && !P.safe ? box.w * (cols === 4 ? .2 : .3) : 0, gw = box.w - coopW - (coopW ? pad * .4 : 0), slot = gw / cols;
    const discS = discOn ? clamp(P.h * .016, 9, 20) : 0, discH = discS ? discS * 1.3 : 0, overlap = cols === 4 ? 1.28 : 1.6;
    if (P.safe) {
      const nf = namesFit(ids, slot * .94, (bottomY - gy) * .25, K, P, { max: slot * .25 });
      const stripH = (nf ? Math.max(...nf.res.map(r => r.total)) + pad * .7 : 0) + discH + pad * .3, stripY = bottomY - stripH;
      panel(0, gy, P.w, stripY - gy, .45, { cx: box.x + gw / 2, cy: stripY, R: Math.min(gw * .44, (stripY - gy) * .8), t0: .7 });
      panel(0, bottomY, P.w, P.h - bottomY, .6, { cx: P.w / 2, cy: P.h, R: Math.min(P.w * .5, (P.h - bottomY) * .9), t0: 2.0 });
      strip(0, stripY, P.w, stripH, .85);
      group(ids, box.x, gw, stripY, Math.min((stripY - gy) * .97, slot * 1.36), 1.0);
      if (nf) names(ids, box.x, gw, stripY + pad * .35, nf.res, 1.35);
      if (discOn) discEl(pl, P, box.x, box.w, bottomY - discH - pad * .15, discS, K, 'center', null, 0);
      if (endOn) cooper(P.w / 2, bottomY + (P.h - bottomY) * .38, Math.min(box.w * .24, (P.h - bottomY) * .45), 2.2, K);
    } else {
      const rowH = (bottomY - gy - discH) / rows;
      const nf = namesFit(ids, slot * .94, rowH * .3, K, P, { max: slot * .25 });
      const stripH = nf ? Math.max(...nf.res.map(r => r.total)) + pad * .7 : rowH * .22;
      for (let r = 0; r < rows; r++) {
        const y0 = gy + r * rowH, stripY = y0 + rowH - stripH, list = ids.slice(r * cols, r * cols + cols);
        panel(0, y0, P.w, stripY - y0, .5 + r * .15, { cx: box.x + gw / 2, cy: stripY, R: Math.min(gw * .44, (stripY - y0) * .82), t0: .7 + r * .15 });
        strip(0, stripY, P.w, (r === rows - 1 ? P.h : stripY + stripH) - stripY, .85 + r * .15);
        group(list, box.x, gw, stripY, Math.min((stripY - y0) * .98, slot * overlap), 1.0 + r * .35);
        if (nf) names(list, box.x, gw, stripY + pad * .35, nf.res.slice(r * cols, r * cols + cols), 1.35 + r * .35);
      }
      if (coopW) { const d = Math.min(coopW * .86, (rowH - stripH) * .62); cooper(box.x + box.w - coopW / 2, gy + (rowH - stripH) * .45, d, 2.2); }
      if (discOn) discEl(pl, P, box.x, box.w, bottomY - discH, discS, K, 'center', null, 0);
    }
  } else if (f === 'wide' || f === 'bill') {
    const th = clamp(P.h * (f === 'wide' ? .07 : .13), 16, 44);
    ticker(0, 0, P.w, th);
    const B2 = { x: box.x, y: th + pad * .6, w: box.w, h: P.h - th - pad * 1.2 };
    const [l, rest] = cutLeft(B2, B2.w * (f === 'wide' ? .43 : .32), pad * 1.2);
    let r = rest, coopBox = null;
    if (f === 'bill' && endOn) [coopBox, r] = cutRight(rest, rest.w * .17, pad * .5);
    const discS = discOn ? clamp(P.h * .03, 9, 16) : 0, discH = discS * 1.3;
    const lh = l.h - discH - (discH ? pad * .3 : 0), coopH = f === 'wide' && endOn ? l.h * .24 : 0;
    const PT = poster(M.headline, l.w, lh - coopH - (coopH ? pad * .5 : 0), P, { maxLines: 6 }) || poster(M.short, l.w, lh - coopH, P, { maxLines: 4 });
    const blockHt = (PT ? PT.h : 0) + (coopH ? coopH + pad * .5 : 0), y0 = l.y + (lh - blockHt) / 2;
    if (PT) posterEls(pl, PT, l.x, y0, 'left', K, B, headT, 0);
    if (coopH) { const cb = cooperBlock(pl, l.x, l.w * .8, coopH, Y, K, 'row', P, 0); cb?.place(y0 + (PT ? PT.h : 0) + pad * .5, 2.2, l.x); }
    if (discOn) discEl(pl, P, l.x, l.w, l.y + l.h - discH, discS, K, 'left', null, 0);
    const px = r.x - pad * .6, nf = namesFit(ids, r.w / 4 * .94, r.h * .32, K, P, { max: r.w / 4 * .24 });
    const stripH = nf ? Math.max(...nf.res.map(q => q.total)) + pad * .7 : 0, stripY = P.h - stripH;
    panel(px, th, P.w - px, stripY - th, .45, { cx: r.x + r.w / 2, cy: stripY, R: Math.min(r.w * .42, (stripY - th) * .85), t0: .7 });
    strip(px, stripY, P.w - px, stripH, .8);
    group(ids, r.x, r.w, stripY, Math.min((stripY - th - pad * .3) * .97, r.w / 4 * 1.28), 1.0);
    if (nf) names(ids, r.x, r.w, stripY + pad * .35, nf.res, 1.35);
    if (coopBox) cooper(coopBox.x + coopBox.w / 2, th + (stripY - th) * .42, Math.min(coopBox.w * .86, (stripY - th) * .6), 2.2);
  } else {
    // ultrawide strips: the ticker runs the full width on top; the judges stand along the bottom with their names
    // (names only when there's no room for photos), the disclaimer at the right end of the bottom row
    const th = clamp(P.h * .3, 15, 30), bh = P.h - th;
    ticker(0, 0, P.w, th);
    const discS = discOn ? clamp(bh * .16, 7.5, 10) : 0, discW = discOn ? clamp(P.w * .2, 92, 150) : 0;
    const ax = pad * .6, aw = P.w - ax * 2 - (discW ? discW + pad * .4 : 0), slot = aw / 4;
    const nfStrip = namesFit(ids, slot * .94, bh * .3, K, P, { modes: [[null, null]], max: slot * .2 });
    const stripH = nfStrip ? nfStrip.res[0].total + pad * .5 : 0, stripY = P.h - stripH, jh = stripY - th - 2;
    if (photos && nfStrip && jh >= 30) {
      panel(0, th, P.w, stripY - th, .3, { cx: ax + aw / 2, cy: stripY, R: Math.min(aw * .3, (stripY - th) * .92), t0: .5 });
      strip(0, stripY, P.w, stripH, .5);
      group(ids, ax, aw, stripY, Math.min(jh, slot * 1.2), .7);
      names(ids, ax, aw, stripY + pad * .25, nfStrip.res, 1.0);
      if (discOn) discEl(pl, P, P.w - discW - pad * .4, discW, stripY + (stripH - discS * 1.15) / 2, discS, K, 'right', null, 0);
    } else {
      panel(0, th, P.w, bh, .3, null);
      const nf = namesFit(ids, slot * .94, bh * .72, W, P, { modes: [[null, null]] });
      if (nf) names(ids, ax, aw, th + (bh - nf.res[0].total) / 2, nf.res, .6);
      else {
        const nf2 = namesFit(ids, aw / 2 * .94, bh / 2 * .9, W, P, { modes: [[null, null]] });
        if (nf2) [0, 1].forEach(row => names(ids.slice(row * 2, row * 2 + 2), ax, aw, th + row * bh / 2 + (bh / 2 - nf2.res[0].total) / 2, nf2.res.slice(row * 2, row * 2 + 2), .6 + row * .3));
      }
      if (discOn) discEl(pl, P, P.w - discW - pad * .4, discW, th + (bh - discS * 1.15) / 2, discS, W, 'right', null, 0);
    }
  }
  return pl.done({ bg: Y, end: 3.2 });
}

/* =========================================================================
   SCRAPBOOK: polaroid cards, marker note, starburst
   ========================================================================= */
const TILT = [-4, 3.5, -2.5, 4.5].map(d => d * Math.PI / 180);
function scrapbook(P) {
  const f = famOf(P), { pad, box } = frameOf(P), { Y, B, W, K } = pal(), M = msgOf(P), cfg = S().sizes[P.key] || {};
  const endOn = !!(cfg.endorser && S().endorser.name.trim()), discOn = !!(cfg.disclaimer && S().text.disclaimer.trim()), photos = D.usePhotos();
  const pl = newPlan(P), ids = [0, 1, 2, 3], hdrC = { kick: Y, kickInk: K, ink: W, hi: Y }, C = S().candidates;
  let raysAt = { x: P.w / 2, y: P.h / 2 };
  pl.slide({ name: 'Ad', start: 0, ox: P.w / 2, oy: P.h / 2 });
  // sunburst rays and a little confetti behind everything
  const conf = [], rr = rng(P.w * 31 + P.h);
  for (let k = 0; k < 26; k++) conf.push({ x: rr() * P.w, y: rr() * P.h, s: (2 + rr() * 5) * Math.max(1, Math.min(P.w, P.h) / 300), c: rr() > .5 ? Y : W, a: rr() * TAU });
  bgEl(pl, 0, 'Ad', B, (g, fill) => {
    g.fillStyle = fill; g.fillRect(0, 0, P.w, P.h);
    const p = EASE.out(prog(0, .8)), rot = ambient() ? now() * .08 : 0, R = Math.hypot(P.w, P.h) * p;
    g.fillStyle = mix(fill, W, .08);
    for (let k = 0; k < 16; k++) { const a = rot + k * TAU / 16; g.beginPath(); g.moveTo(raysAt.x, raysAt.y); g.arc(raysAt.x, raysAt.y, R, a, a + TAU / 32); g.closePath(); g.fill(); }
    const q = prog(.4, .8);
    conf.forEach(c => { g.save(); g.globalAlpha = .55 * q; g.fillStyle = c.c; g.translate(c.x, c.y); g.rotate(c.a); g.fillRect(-c.s, -c.s * .4, c.s * 2, c.s * .8); g.restore(); });
  });

  // the tag as a strip of torn yellow tape
  const tape = (x, y, w, h, align) => {
    const res = fit1(M.kicker.toUpperCase(), 'condBold', w * .9, h * .62, { color: K, maxLines: 1, max: h * .62 });
    if (!res || res.s < minText(P)) return 0;
    const s = res.out[0].size, text = M.kicker.toUpperCase(), th = res.total + s * .7, tw0 = res.maxW + s * 1.6, cx = align === 'center' ? x + w / 2 : x + tw0 / 2;
    const size = (g, ov) => { const fnt = D.fontOv('condBold', s, ov); g.font = fnt; return { fnt, tw: g.measureText(text).width + s * 1.6 }; };
    pl.add({ id: 'kicker', name: 'Tag', role: 'condBold', textual: true, fillable: true, x: cx - tw0 / 2, y, w: tw0, h: th, t0: .15,
      measure: tk => { const z = size(MC, tk || {}); return { x: cx - z.tw / 2, w: z.tw }; },
      draw: t => {
        const g = G(), ov = OV(), z = size(g, ov), tx = cx - z.tw / 2, tw = z.tw, p = t == null ? 1 : prog(t, .4);
        enter(g, p, cx, y + th / 2, [tw * .5, 0], q => 1.6 - .6 * EASE.out(q), () => {
          g.save(); g.translate(cx, y + th / 2); g.rotate(-.05); g.translate(-cx, -y - th / 2);
          g.fillStyle = ov.fill || Y; g.beginPath();
          const zz = th / 6;
          g.moveTo(tx, y); g.lineTo(tx + tw, y);
          for (let k = 0; k < 6; k++) g.lineTo(tx + tw + (k % 2 ? 0 : -zz * .7), y + zz * (k + 1)); // torn ends
          g.lineTo(tx, y + th);
          for (let k = 0; k < 6; k++) g.lineTo(tx + (k % 2 ? 0 : zz * .7), y + th - zz * (k + 1));
          g.closePath(); g.fill();
          g.font = z.fnt; g.fillStyle = ov.color || K; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
          g.fillText(text, cx, D.pillTextTop(z.fnt, s, 1, 1, y, th) + s * ASC);
          g.restore();
        });
      } });
    return th;
  };
  const header = (b, align, withTape = true) => {
    let tapeH = 0;
    if (withTape && b.h > 70) tapeH = tape(b.x, b.y, b.w, Math.min(b.h * .22, 60), align);
    const hb = { x: b.x, y: b.y + (tapeH ? tapeH + pad * .5 : 0), w: b.w, h: b.h - (tapeH ? tapeH + pad * .5 : 0) };
    const hdr = headerBlock(pl, hb.x, hb.w, hb.h, hdrC, align, P, true, 0);
    hdr?.place(tapeH ? hb.y : hb.y + (hb.h - hdr.h) / 2, .35);
  };
  // the four judges as polaroids: 'tile' = photo on top, 'row' = photo beside the name
  const cardsFit = R => {
    const tries = [];
    for (const [kind, cols] of [['tile', 4], ['tile', 2], ['row', 2], ['row', 1], ['tile', 1]]) {
      const rows = 4 / cols, gx = R.w * .04, gy = R.h * .05;
      let w, h;
      if (kind === 'tile') { w = Math.min((R.w - gx * (cols - 1)) / cols, (R.h - gy * (rows - 1)) / rows / 1.34); h = w * 1.34; }
      else { h = Math.min((R.h - gy * (rows - 1)) / rows, ((R.w - gx * (cols - 1)) / cols) / 2.4); w = Math.min(h * 2.8, (R.w - gx * (cols - 1)) / cols); }
      if (w < 30 || h < 30) continue;
      const mg = Math.min(w, h) * .07, win = kind === 'tile' ? { w: w - mg * 2, h: (w - mg * 2) * .9 } : { w: h - mg * 2, h: h - mg * 2 };
      const nameBox = kind === 'tile' ? { w: w - mg * 2, h: h - win.h - mg * 2.6 } : { w: w - win.w - mg * 3, h: h - mg * 2 };
      const nf = namesFit(ids, nameBox.w, nameBox.h, K, P, { modes: [['p', 'short'], ['p', null], [null, null]], preR: .5, max: nameBox.h * .5 });
      if (!nf) continue;
      tries.push({ kind, cols, rows, w, h, gx, gy, mg, win, nameBox, nf, score: (photos ? win.w * win.h : 0) + nf.s * nf.s * 40 });
    }
    return tries.sort((a, b) => b.score - a.score)[0] || null;
  };
  const cards = (R, t0) => {
    const F = cardsFit(R);
    if (!F) { // tiny: faces with last names
      const gb = gridBlock(pl, R, P, W, Y, 0);
      if (!gb) return null;
      const y = R.y + (R.h - gb.h) / 2; gb.place(y, t0);
      return { x: R.x + (R.w - gb.w) / 2, y, w: gb.w, h: gb.h };
    }
    const tw = F.cols * F.w + (F.cols - 1) * F.gx, thh = F.rows * F.h + (F.rows - 1) * F.gy;
    const x0 = R.x + (R.w - tw) / 2, y0 = R.y + (R.h - thh) / 2;
    raysAt = { x: x0 + tw / 2, y: y0 + thh / 2 };
    ids.forEach((i, k) => {
      const c = k % F.cols, r = Math.floor(k / F.cols), x = x0 + c * (F.w + F.gx), y = y0 + r * (F.h + F.gy) + (F.cols === 4 ? (k % 2 ? F.h * .04 : -F.h * .02) : 0);
      const tt = t0 + k * .2, cx = x + F.w / 2, cy = y + F.h / 2, id = `card${i}`;
      // the card's drop and tilt; its name lines ride along with it
      const tx = g => {
        const p = prog(tt, .5), mv = motion();
        let rot = TILT[k];
        if (p < 1 && Number.isFinite(now())) {
          if (mv === 'pop') { const q = EASE.out(p); g.translate(0, -(1 - q) * P.h * .55); rot += (1 - q) * (k % 2 ? .6 : -.6); const s = 1 + (1 - q) * .25; g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy); }
          else if (mv === 'slide') { g.globalAlpha *= Math.min(1, p * 2); g.translate((k % 2 ? 1 : -1) * (1 - EASE.out(p)) * P.w * .6, 0); }
          else g.globalAlpha *= EASE.out(p);
        }
        g.translate(cx, cy); g.rotate(rot); g.translate(-cx, -cy);
      };
      const shown = () => !Number.isFinite(now()) || now() >= tt;
      const wx = x + F.mg, wy = y + F.mg;
      photoEl(pl, { id, name: `${C[i].last} · card`, x, y, w: F.w, h: F.h, t0: tt, fill: W, tx, paint: (g, t, fill) => {
        if (!shown()) return;
        g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.roundRect(x + F.w * .03, y + F.w * .045, F.w, F.h, F.mg * .6); g.fill();
        g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, F.w, F.h, F.mg * .6); g.fill();
        g.fillStyle = Y; g.fillRect(wx, wy, F.win.w, F.win.h);
        if (photos) paintJudge(g, i, wx + F.win.w / 2, wy + F.win.h, Math.min(F.win.h * 1.04, F.win.w / judgeAspect(i) * 1.25), motion() === 'fade' || t == null ? 1 : prog(t + .2, .5), gg => gg.rect(wx, wy, F.win.w, F.win.h));
        const tpw = Math.min(F.w, F.h) * .34, tph = tpw * .28;
        g.fillStyle = 'rgba(255,255,255,.6)'; g.save(); g.translate(cx, y); g.rotate(-TILT[k] * 1.5); g.fillRect(-tpw / 2, -tph / 2, tpw, tph); g.restore();
      } });
      const res = F.nf.res[k], ntx = g => { if (!shown()) g.globalAlpha = 0; tx(g); };
      if (F.kind === 'tile') nameEls(pl, i, `${id}.name`, res, wx, wy + F.win.h + F.mg * .8 + (F.nameBox.h - res.total) / 2, 'center', tt + .35, { dir: 0, parent: id, tx: ntx });
      else nameEls(pl, i, `${id}.name`, res, wx + F.win.w + F.mg, y + (F.h - res.total) / 2, 'left', tt + .35, { parent: id, tx: ntx });
    });
    return { x: x0, y: y0, w: tw, h: thh };
  };
  // the button as a starburst sticker (or a pill when a burst would be too small to read)
  const burst = (b, t0) => {
    const R = Math.min(b.w, b.h) / 2, cta = M.cta.trim();
    const res = fit1(cta.toUpperCase(), 'heavy', R * 1.28, R * 1.0, { color: K, maxLines: 3, lh: 1, max: R * .4 });
    if (!res || res.s < minText(P)) { const F = pillFit(cta, b.w, b.h, P, 3); ctaEl(pl, F, b.x + (b.w - (F?.pw || 0)) / 2, b.y + (b.h - (F?.ph || 0)) / 2, Y, K, t0, 0); return; }
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const tx = g => {
      const p = prog(t0, .55), wig = ambient() && now() > t0 + .6 ? Math.sin((now() - t0) * 4) * .04 : 0;
      g.translate(cx, cy); g.rotate(-.12 + wig);
      if (p < 1 && Number.isFinite(now())) { if (motion() === 'pop') { g.rotate((1 - EASE.out(p)) * 2); g.scale(EASE.back(p), EASE.back(p)); } else g.globalAlpha *= EASE.out(p); }
      g.translate(-cx, -cy);
    };
    const shown = () => !Number.isFinite(now()) || now() >= t0;
    shapeEl(pl, { id: 'burst', name: 'Starburst', x: cx - R, y: cy - R, w: R * 2, h: R * 2, t0, fill: Y, tx, paint: (g, fill) => {
      if (!shown()) return;
      g.fillStyle = 'rgba(0,0,0,.25)'; burstPath(g, cx + R * .05, cy + R * .07, R); g.fill();
      g.fillStyle = fill; burstPath(g, cx, cy, R); g.fill();
    } });
    explode(pl, 'burst.text', res, cx - res.w / 2, cy - res.total / 2, 'center', null, { title: 'Starburst', anim: 'none', parent: 'burst', tx: g => { if (!shown()) g.globalAlpha = 0; tx(g); }, label: (_, n) => `Starburst · line ${n + 1}` });
  };
  // Roy Cooper as a round sticker with his name on black tape
  const cooper = (b, t0) => {
    if (!endOn) return;
    const E = S().endorser, name = E.name.trim(), d = Math.min(b.h * .74, b.w * .62);
    const res = fit1(name, 'heavy', b.w * .95, b.h - d, { color: W, maxLines: 1, max: d * .22 });
    const ok = res && res.s >= minText(P), cx = b.x + b.w / 2, cy = b.y + (ok ? d / 2 : b.h / 2);
    const tx = g => { g.translate(cx, cy); g.rotate(.06); g.translate(-cx, -cy); };
    photoEl(pl, { id: 'cooper.face', name: 'Roy Cooper · photo', framable: 'endorser', x: cx - d / 2, y: cy - d / 2, w: d, h: d, t0, fill: Y, tx, paint: (g, t, fill) =>
      enter(g, t == null ? 1 : prog(t, .5), cx, cy, [0, d * .5], popBack, () => {
        if (endFrame() !== 'none') { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); framePath(g, cx + d * .04, cy + d * .05, d, endFrame()); g.fill(); }
        paintFace(g, D.endorserImg(), E, cx, cy, d, fill);
      }) });
    if (ok) {
      const it = res.out[0];
      pillEl(pl, { id: 'cooper.name', name: 'Roy Cooper · name', parent: 'cooper.face', tx, lines: it.b.lines, role: 'heavy', size: it.size, padX: it.size * .6, padY: it.size * .28, radius: 0,
        cx, y: cy + d / 2 - (res.total + it.size * .55) * .2, fill: K, ink: W, t0: t0 + .25 });
    }
  };
  // the handwritten note, written out left to right, with an arrow that draws itself toward the cards
  const note = (b, target, t0) => {
    const text = S().text.note.trim();
    if (!text) return;
    const res = fit1(text, 'marker', b.w * .9, b.h, { color: Y, maxLines: 2, lh: 1, max: b.h * .7 });
    if (!res || res.s < minText(P) * 1.1) return;
    const nx = b.x, ny = b.y + (b.h - res.total) / 2, s = res.out[0].size;
    const rot = g => { g.translate(nx, ny); g.rotate(-.035); g.translate(-nx, -ny); };
    explode(pl, 'note', res, nx, ny, 'left', t0, { title: 'Marker note', anim: 'write', tx: rot });
    const ax0 = nx + res.maxW + s * .3, ay0 = ny + res.total * .5;
    if (!target) return;
    const tx = clamp(ax0 + s * 2.2, target.x + target.w * .15, target.x + target.w * .85), ty = target.y - s * .3;
    if (ty <= ay0 + s) return;
    const c1x = tx + s * 1.5, c1y = ay0;
    shapeEl(pl, { id: 'arrow', name: 'Arrow', x: ax0, y: ay0, w: Math.max(4, c1x - ax0), h: Math.max(4, ty - ay0), t0: t0 + .6, fill: Y, paint: (g, fill, t) => {
      const q = t == null ? 1 : prog(t, .5);
      if (q <= 0) return;
      g.strokeStyle = fill; g.lineWidth = Math.max(2, s * .13); g.lineCap = 'round'; g.lineJoin = 'round';
      const len = Math.hypot(c1x - ax0, c1y - ay0) + Math.hypot(tx - c1x, ty - c1y);
      g.setLineDash([len * q, len * 2]);
      g.beginPath(); g.moveTo(ax0, ay0); g.quadraticCurveTo(c1x, c1y, tx, ty); g.stroke();
      if (q > .85) {
        g.setLineDash([]);
        const a = Math.atan2(ty - c1y, tx - c1x), hl = s * .6;
        g.beginPath(); g.moveTo(tx - Math.cos(a - .5) * hl, ty - Math.sin(a - .5) * hl); g.lineTo(tx, ty); g.lineTo(tx - Math.cos(a + .5) * hl, ty - Math.sin(a + .5) * hl); g.stroke();
      }
    } });
  };

  // layout per shape
  let A = { ...box };
  if (discOn && f !== 'strip') {
    const s = clamp(P.h * .017, 9.5, 20), dh = s * 1.15;
    discEl(pl, P, A.x, A.w, A.y + A.h - dh, s, W, 'center', null, 0);
    A = cutBottom(A, dh, pad * .4)[1];
  }
  if (f === 'tall') {
    const skinny = A.w < 230;
    const [hb, r1] = cutTop(A, A.h * (skinny ? .2 : .25), pad * .5);
    header(hb, 'center', !skinny);
    const [bot, r2] = cutBottom(r1, r1.h * (skinny ? .2 : .22), pad * .5);
    const noteH = skinny ? 0 : r2.h * .1;
    const [nb, cb] = noteH ? cutTop(r2, noteH, pad * .3) : [null, r2];
    const box2 = cards(cb, 1.0);
    if (nb) note({ x: nb.x, y: nb.y, w: nb.w * .7, h: nb.h }, box2, 2.0);
    if (endOn && !skinny) { const [cl, cr] = cutLeft(bot, bot.w * .42, pad); cooper(cl, 2.5); burst(cr, 2.2); }
    else burst(bot, 2.2);
  } else if (f === 'square') {
    const [hrow, r1] = cutTop(A, A.h * .3, pad * .5), [bb, hl] = cutRight(hrow, Math.min(hrow.h * 1.15, hrow.w * .34), pad * .5);
    header(hl, 'left');
    burst(bb, 2.2);
    let cb = r1, bot = null;
    if (endOn || A.h > 400) [bot, cb] = cutBottom(r1, r1.h * .2, pad * .4);
    cards(cb, 1.0);
    if (bot) {
      if (endOn) { const [cl, cr] = cutLeft(bot, bot.w * .3, pad); cooper(cl, 2.5); note(cr, null, 2.0); }
      else note(bot, null, 2.0);
    }
  } else if (f === 'wide') {
    const [l, r] = cutLeft(A, A.w * .42, pad), [hb, lb] = cutTop(l, l.h * .56, pad * .5);
    header(hb, 'left');
    const box2 = cards(r, 1.0), [nb, bb] = cutTop(lb, lb.h * .3, pad * .3);
    note(nb, box2, 2.0);
    if (endOn) { const [cl, cr] = cutLeft(bb, bb.w * .45, pad * .5); cooper(cl, 2.5); burst(cr, 2.2); }
    else burst(bb, 2.2);
  } else if (f === 'bill') {
    const [l, rest] = cutLeft(A, A.w * .3, pad), [rb, mid] = cutRight(rest, rest.w * .26, pad);
    header(l, 'left');
    cards(mid, .9);
    if (endOn) { const [ct, cbm] = cutTop(rb, rb.h * .42, pad * .2); cooper(ct, 2.4); burst(cbm, 2.1); }
    else burst(rb, 2.1);
  } else {
    let rest = A;
    if (A.w > 500) { const [l, r] = cutLeft(A, A.w * .3, pad * .6); header(l, 'left', false); rest = r; }
    const [pb, mid] = cutRight(rest, rest.w * (A.w > 500 ? .3 : .36), pad * .6);
    cards(mid, .7);
    let pbb = pb;
    if (discOn) { const s = clamp(P.h * .12, 7.5, 10); discEl(pl, P, pb.x, pb.w, pb.y + pb.h - s * 1.15, s, W, 'center', null, 0); pbb = cutBottom(pb, s * 1.15, 2)[1]; }
    const F = pillFit(M.cta, pbb.w, pbb.h, P, 3);
    ctaEl(pl, F, pbb.x + (pbb.w - (F?.pw || 0)) / 2, pbb.y + (pbb.h - (F?.ph || 0)) / 2, Y, K, 1.6, 0);
  }
  return pl.done({ bg: B, end: 3.3 });
}

D.register('spotlight', 'Spotlight (judges one by one)', spotlight);
D.register('frontrow', 'Front Row (poster + ticker)', frontrow);
D.register('scrapbook', 'Scrapbook (polaroids + marker)', scrapbook);
document.fonts.load('400 40px "Permanent Marker"').then(() => D.redraw()).catch(() => {});
})();
