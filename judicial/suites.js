/* Down-Ballot Studio: redesign suites
   Three complete looks that sit next to Lineup, Stripes and Quadrants in the
   Layout menu. Each one lays out every size from the same content (the size's
   message, the four judges, Roy Cooper, the disclaimer) and animates it its
   own way:
     Spotlight  - roll call: a headline, then each judge takes the whole frame
                  in turn through an iris wipe, then an end card with everyone
     Front Row  - poster: a scrolling ticker, a full-width stacked headline that
                  slams in, and the four judges standing shoulder to shoulder
     Scrapbook  - pop collage: tilted polaroid cards drop in over sunburst rays,
                  with a marker note, an arrow and a starburst button
   Everything here draws through the studio's helpers (window.DBS), so fonts,
   colors, name-line toggles, photo tweaks, element moves and exports all work. */
(() => {
'use strict';
const D = window.DBS;
if (!D) return;
const { clamp, EASE, prog, font, wrap, fitStack, stackAt, drawLines, blockH, search, minText, msgOf, MC, enter, popBack } = D;
const S = () => D.state();
const now = () => D.now();
const G = () => D.ctx();
const TAU = Math.PI * 2;
const motion = () => S().motion;
// looping background motion (ticker, shine, rays, wiggle) runs in the editor and in MP4s, not in GIFs or stills
const ambient = () => Number.isFinite(now()) && !D.curP()?.gif;
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

/* ---------- plan building ---------- */
function newPlan(bg) {
  const items = [];
  return {
    items,
    // a block from the studio (draws itself with draw(y, t0))
    block(id, b, y, t0, top) { if (b) items.push({ id, b, y, t0, x: b.bx, w: b.bw, top }); },
    // a custom element: fn(t0) paints it at its spot
    el(id, x, y, w, h, t0, fn, top) { items.push({ id, x, y, w, t0, top, b: { h, draw: (_, t) => fn(t) } }); },
    done(extra) { return { fam: 'suite', bg, bands: [], items, sticker: null, m: 1, end: 3, ...extra }; },
  };
}

/* ---------- text ---------- */
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
// a name stack: the title glides in, the last name slams down, the office fades up
function drawName(g, res, x, y, align, t0, dir = -1) {
  let yy = y;
  res.out.forEach((o, k) => {
    yy += o.gap;
    const at = yy, p = t0 == null ? 1 : prog(t0 + k * .1, .4), isLast = o.it.role === 'last';
    const lw = o.b.maxW, cx = align === 'center' ? x + res.w / 2 : align === 'right' ? x + res.w - lw / 2 : x + lw / 2;
    enter(g, p, cx, at + o.h / 2, [res.w * .3 * dir, 0], isLast ? q => 1.7 - .7 * EASE.out(q) : popBack,
      () => drawLines(g, o.b, o.f, o.size, o.it.lh || 1.15, x, at, res.w, align, o.it.color));
    yy += o.h;
  });
}
const drawStatic = (g, res, x, y, align, t0) => res && D.drawStack(g, res, x, y, align, t0);

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
  const ws = D.words(o.upper === false ? text : text.toUpperCase());
  const role = o.role || 'heavy', lead = o.lead ?? .16;
  MC.font = font(role, 100);
  const space = MC.measureText(' ').width, capH = (MC.measureText('H').actualBoundingBoxAscent || 72) / 100;
  const ww = ws.map(segs => segs.reduce((a, s) => a + MC.measureText(s.t).width, 0));
  let best = null;
  for (let L = 1; L <= Math.min(o.maxLines ?? 6, ws.length); L++) {
    const lines = partition(ww, space, L).map(([a, b]) => {
      const lw = ww.slice(a, b).reduce((x, y) => x + y, 0) + space * (b - a - 1);
      return { a, b, size: 100 * w / lw };
    });
    const mn = Math.min(...lines.map(l => l.size));
    lines.forEach(l => { l.size = Math.min(l.size, mn * (o.capRatio ?? 1.6), o.maxSize ?? 1e9); });
    let tot = lines.reduce((a, l, i) => a + l.size * capH + (i ? l.size * lead : 0), 0);
    const k = tot > hMax ? hMax / tot : 1;
    lines.forEach(l => { l.size *= k; }); tot *= k;
    const score = Math.min(...lines.map(l => l.size)) * (k < 1 ? .97 : 1);
    if (!best || score > best.score) best = { lines, score, h: tot };
  }
  if (!best || best.score < minText(P) * 1.15) return null;
  return { ...best, w, ws, capH, role, lead };
}
function drawPoster(g, PT, x, y, align, ink, hi, t0) {
  let yy = y;
  PT.lines.forEach((l, i) => {
    if (i) yy += l.size * PT.lead;
    const base = yy + l.size * PT.capH;
    g.font = font(PT.role, l.size);
    const sp = g.measureText(' ').width, segs = [];
    let lw = 0;
    for (let j = l.a; j < l.b; j++) {
      PT.ws[j].forEach(s => { const sw = g.measureText(s.t).width; segs.push({ t: s.t, hi: s.hi, x: lw }); lw += sw; });
      if (j < l.b - 1) lw += sp;
    }
    const x0 = align === 'center' ? x + (PT.w - lw) / 2 : align === 'right' ? x + PT.w - lw : x;
    const p = t0 == null ? 1 : prog(t0 + i * .11, .42), mv = motion();
    if (p > 0) {
      g.save();
      if (p < 1) {
        if (mv === 'pop') { const s = 1.9 - .9 * EASE.out(p), cx = x0 + lw / 2, cy = base - l.size * PT.capH / 2; g.globalAlpha *= Math.min(1, p * 2.5); g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy); }
        else if (mv === 'slide') { g.globalAlpha *= Math.min(1, p * 2); g.translate((i % 2 ? 1 : -1) * (1 - EASE.out(p)) * PT.w * .8, 0); }
        else g.globalAlpha *= EASE.out(p);
      }
      segs.forEach(s => { g.fillStyle = s.hi ? hi : ink; g.fillText(s.t, x0 + s.x, base); });
      g.restore();
    }
    yy += l.size * PT.capH;
  });
}

/* ---------- pieces ---------- */
// a judge's cutout standing on a baseline; rise 0..1 slides it up from below the line
function drawJudge(g, i, cx, base, h, rise = 1, clipBox) {
  if (rise <= 0) return;
  const c = S().candidates[i], img = D.judgeImg(i), dy = (1 - EASE.out(clamp(rise, 0, 1))) * h * 1.05;
  g.save(); g.beginPath();
  if (clipBox) g.rect(clipBox.x, clipBox.y, clipBox.w, clipBox.h); else g.rect(cx - h * 3, base - h * 3, h * 6, h * 3);
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
// a face in a circle (Roy Cooper, or a judge on a tiny banner)
function drawFace(g, img, adj, cx, cy, d, ring) {
  if (ring) { g.fillStyle = ring; g.beginPath(); g.arc(cx, cy, d / 2, 0, TAU); g.fill(); }
  const r = d / 2 * (ring ? .9 : 1);
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
  g.fillStyle = '#d9dbe3'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (img) {
    const h = r * 2 * 1.45 * (adj.zoom || 1), s = h / img.height, iw = img.width * s;
    g.drawImage(img, cx - iw / 2 + (adj.x || 0) * r, cy - r * .8 + (adj.y || 0) * r, iw, h);
  } else {
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.beginPath(); g.arc(cx, cy - r * .15, r * .38, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(cx, cy + r * .9, r * .7, r * .55, 0, 0, TAU); g.fill();
  }
  g.restore();
}
// Roy Cooper: face and name. 'row' puts the name beside the face, 'stack' under it
function coopBlock(x, w, h, ring, ink, style, P) {
  const E = S().endorser, name = E.name.trim();
  if (!name) return null;
  const gap = Math.min(w, h) * .08;
  if (style === 'stack') {
    const d = Math.min(w * .8, h * .66), res = fit1(name, 'heavy', w, h - d - gap, { color: ink, maxLines: 2, max: d * .32 });
    const ok = res && res.s >= minText(P);
    return { h: d + (ok ? gap + res.total : 0), w, bx: x, bw: w, dur: .9, draw: (y, t0 = -1e9) => {
      const g = G(), p = prog(t0, .5), cx = x + w / 2;
      enter(g, p, cx, y + d / 2, [0, d * .4], popBack, () => drawFace(g, D.endorserImg(), E, cx, y + d / 2, d, ring));
      if (ok) drawStatic(g, res, x, y + d + gap, 'center', t0 + .25);
    } };
  }
  const d = Math.min(h, w * .36), res = fit1(name, 'heavy', w - d - gap, d * .7, { color: ink, maxLines: 2, max: d * .4 });
  const ok = res && res.s >= minText(P), gw = d + (ok ? gap + res.maxW : 0), x0 = x + (w - gw) / 2;
  return { h: d, w: gw, bx: x0, bw: gw, dur: .9, draw: (y, t0 = -1e9) => {
    const g = G(), p = prog(t0, .5);
    enter(g, p, x0 + d / 2, y + d / 2, [d * .6, 0], popBack, () => drawFace(g, D.endorserImg(), E, x0 + d / 2, y + d / 2, d, ring));
    if (ok) drawStatic(g, { ...res, w: res.maxW }, x0 + d + gap, y + (d - res.total) / 2, 'left', t0 + .25);
  } };
}
// the call-to-action pill: pops open, pulses, and a highlight sweeps across it now and then
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
function drawPill(g, F, x, y, fill, ink, t0) {
  const p = t0 == null ? 1 : prog(t0, .5);
  if (p <= 0) return;
  const cx = x + F.pw / 2, cy = y + F.ph / 2, since = now() - (t0 ?? 0) - 1.1, amb = ambient() && since > 0;
  enter(g, p, cx, cy, [0, F.ph * 1.2], popBack, () => {
    const pulse = amb && S().pulse ? 1 + .05 * Math.pow(Math.max(0, Math.sin(since * Math.PI / 1.1)), 6) : 1;
    g.save(); g.translate(cx, cy); g.scale(pulse, pulse); g.translate(-cx, -cy);
    g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, F.pw, F.ph, F.ph / 2); g.fill();
    if (amb) {
      const q = (since % 2.6) / .75;
      if (q < 1) {
        g.save(); g.beginPath(); g.roundRect(x, y, F.pw, F.ph, F.ph / 2); g.clip();
        const sx = x - F.ph + (F.pw + F.ph * 2) * q;
        g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath();
        g.moveTo(sx, y); g.lineTo(sx + F.ph * .5, y); g.lineTo(sx + F.ph * .1, y + F.ph); g.lineTo(sx - F.ph * .4, y + F.ph); g.closePath(); g.fill();
        g.restore();
      }
    }
    const f = font('heavy', F.s);
    drawLines(g, F.b, f, F.s, 1.08, x + F.s * .9, D.pillTextTop(f, F.s, F.b.lines.length, 1.08, y, F.ph), F.pw - F.s * 1.8, 'center', ink);
    g.restore();
  });
}
function pillItem(pl, F, x, y, fill, ink, t0, top) {
  if (F) pl.el('cta', x, y, F.pw, F.ph, t0, t => drawPill(G(), F, x, y, fill, ink, t), top);
}
// the legal line; optional backing pill so it reads on any background
function discItem(pl, P, x, w, y, size, ink, align, back) {
  const text = S().text.disclaimer.trim();
  if (!text) return 0;
  MC.font = font('medium', size);
  const tw = MC.measureText(text).width, s = tw > w * (back ? .9 : 1) ? size * w * (back ? .9 : 1) / tw : size;
  MC.font = font('medium', s);
  const aw = MC.measureText(text).width, padX = back ? s * .6 : 0, bw = aw + padX * 2, bh = back ? s * 1.65 : s * 1.15;
  const bx = align === 'center' ? x + (w - bw) / 2 : align === 'right' ? x + w - bw : x;
  pl.el('disclaimer', bx, y, bw, bh, .3, t0 => {
    const g = G();
    g.save(); g.globalAlpha *= prog(t0, .5);
    if (back) { g.fillStyle = back; g.beginPath(); g.roundRect(bx, y, bw, bh, bh / 2); g.fill(); }
    g.font = font('medium', s); g.fillStyle = ink; g.textBaseline = 'alphabetic';
    g.fillText(text, bx + padX, y + bh / 2 + s * .36);
    g.restore();
  }, true);
  return bh;
}
function burstPath(g, cx, cy, R, points = 18, inner = .84) {
  g.beginPath();
  for (let k = 0; k < points * 2; k++) {
    const a = -Math.PI / 2 + k * Math.PI / points, r = k % 2 ? R * inner : R;
    k ? g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}
// a scrolling ticker band; still frames and GIFs show it parked
function drawTicker(g, x, y, w, h, text, bg, ink, t0) {
  const p = t0 == null ? 1 : EASE.out(prog(t0, .4));
  if (p <= 0) return;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.translate(0, -h * (1 - p));
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  const s = h * .5, f = font('heavy', s);
  g.font = f; g.fillStyle = ink; g.textBaseline = 'alphabetic';
  MC.font = f;
  const capH = MC.measureText('H').actualBoundingBoxAscent || s * .72, base = y + h / 2 + capH / 2;
  const unit = `${text}   ★   `, uw = g.measureText(unit).width;
  const off = ambient() ? ((now() - (t0 ?? 0)) * h * 2.4) % uw : 0;
  for (let xx = x + s * .5 - off; xx < x + w; xx += uw) g.fillText(unit, xx, base);
  g.restore();
}
const tickerText = P => { const M = msgOf(P); return [M.kicker, M.cta].filter(s => s && s.trim()).map(s => s.toUpperCase()).join('   ★   '); };
// iris / wipe / crossfade between two full-frame scenes, following the motion style
function transition(g, rect, p, ox, oy, drawPrev, drawCur) {
  const mv = motion();
  if (p >= 1) { drawCur?.(); return; }
  drawPrev?.();
  if (!drawCur) return;
  g.save();
  if (mv === 'fade') { g.globalAlpha *= EASE.out(p); drawCur(); g.restore(); return; }
  g.beginPath();
  if (mv === 'slide') g.rect(rect.x + rect.w * (1 - EASE.out(p)), rect.y, rect.w, rect.h);
  else g.arc(ox, oy, Math.hypot(rect.w, rect.h) * EASE.out(p), 0, TAU);
  g.clip(); drawCur(); g.restore();
}

/* =========================================================================
   SPOTLIGHT: hook, then each judge full-frame, then the end card
   ========================================================================= */
function spotlight(P) {
  const f = famOf(P), { m, pad, box } = frameOf(P), { Y, B, W, K } = pal(), M = msgOf(P), cfg = S().sizes[P.key] || {};
  const endOn = !!(cfg.endorser && S().endorser.name.trim()), discOn = !!(cfg.disclaimer && S().text.disclaimer.trim()), photos = D.usePhotos();
  const banner = f === 'strip' || f === 'bill', pl = newPlan(B);
  const J0 = 1.45, STEP = .95, END0 = J0 + 4 * STEP;
  let A = { ...box }, side = null;
  if (banner) [side, A] = cutRight(box, box.w * (f === 'strip' ? .3 : .22), pad);
  const sceneRect = { x: 0, y: 0, w: banner ? side.x - pad * .5 : P.w, h: P.h };

  // the legal line: a white pill along the bottom, or the foot of the side column on banners
  if (discOn && !banner) {
    const s = clamp(P.h * .017, 10, 20), bh = s * 1.65;
    discItem(pl, P, A.x, A.w, A.y + A.h - bh, s, K, 'center', W);
    A = cutBottom(A, bh, pad * .4)[1];
  }
  // banners: a white column on the right stays put the whole time (button, legal line, Cooper on the billboard)
  if (banner) {
    const colX = side.x - pad * .5;
    pl.el(null, colX, 0, P.w - colX, P.h, 0, () => { const g = G(); g.fillStyle = W; g.fillRect(colX, 0, P.w - colX, P.h); }, true);
    let rest = { ...side };
    if (discOn) {
      const s = clamp(P.h * (f === 'strip' ? .14 : .05), 7.5, 13);
      discItem(pl, P, rest.x, rest.w, rest.y + rest.h - s * 1.15, s, K, 'center');
      rest = cutBottom(rest, s * 1.15, pad * .3)[1];
    }
    let coop = null;
    if (f === 'bill' && endOn) { const [ct, r2] = cutTop(rest, rest.h * .42, pad * .4); coop = coopBlock(ct.x, ct.w, ct.h, Y, K, 'row', P); if (coop) { pl.block('endorser', coop, ct.y + (ct.h - coop.h) / 2, END0 + .9, true); rest = r2; } }
    const F = pillFit(M.cta, rest.w, rest.h, P, 3);
    if (F) pillItem(pl, F, rest.x + (rest.w - F.pw) / 2, rest.y + (rest.h - F.ph) / 2, B, W, .5, true);
  }

  // the hook: the size's headline, big, on yellow
  const hookT = { kick: B, kickInk: W, ink: K, hi: B };
  const hook = D.headerBlock(A.x, A.w, A.h * (banner ? 1 : .86), hookT, banner || f === 'wide' ? 'left' : 'center', P, f === 'strip');
  const hookY = hook ? A.y + (A.h - hook.h) / 2 : 0;

  // one full-frame scene per judge
  const judgeScenes = [0, 1, 2, 3].map(i => {
    const bg = i % 2 ? Y : B, ink = bg === Y ? K : W, accent = bg === Y ? B : Y;
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
    const nf = namesFit([i], nb.w, nb.h, ink, P, { offColor: accent, max: nb.h * .55, preR: .48 });
    const name = nf && nf.res[0], ny = name ? nb.y + (nb.h - name.total) / 2 : 0;
    const d = Math.min(ph * .82, (f === 'tall' ? A.w : P.w * .5) * .9), dcy = base - ph * .44;
    const draw = (g, ts) => {
      g.fillStyle = bg; g.fillRect(sceneRect.x, sceneRect.y, sceneRect.w, sceneRect.h);
      if (base < P.h - 1) { g.fillStyle = accent; g.fillRect(sceneRect.x, base, sceneRect.w, P.h - base); }
      if (photos) {
        if (S().frame !== 'none') enter(g, prog(ts + .05, .4), cx, dcy, [0, d * .3], popBack, () => {
          g.fillStyle = accent; g.beginPath();
          if (S().frame === 'square') g.roundRect(cx - d / 2, dcy - d / 2, d, d, d * .16); else g.arc(cx, dcy, d / 2, 0, TAU);
          g.fill();
        });
        drawJudge(g, i, cx, base, ph, motion() === 'fade' ? 1 : prog(ts + .12, .55), { x: sceneRect.x, y: 0, w: sceneRect.w, h: base });
      }
      if (name) drawName(g, name, nb.x, ny, align, ts + .3);
    };
    return { start: J0 + i * STEP, ox: photos ? cx : A.x + A.w / 2, oy: photos ? dcy : A.y + A.h / 2, draw };
  });
  const drawHook = (g, ts) => {
    g.fillStyle = Y; g.fillRect(sceneRect.x, sceneRect.y, sceneRect.w, sceneRect.h);
    // a blue disc swells up in the corner behind the headline
    const p = EASE.out(prog(ts, .7)), R = Math.hypot(sceneRect.w, P.h) * .32 * p;
    g.fillStyle = mix(Y, W, .25); g.beginPath(); g.arc(sceneRect.w, P.h, R, 0, TAU); g.fill();
    if (hook) hook.draw(hookY, ts + .12);
  };

  // the end card (the finished frame): headline, everyone, Cooper, the button
  const endT = { kick: Y, kickInk: K, ink: W, hi: Y, disc: Y };
  const t1 = END0 + .3;
  if (f === 'tall' || f === 'square') {
    const hdr = D.headerBlock(A.x, A.w, A.h * (f === 'tall' ? .27 : .25), endT, 'center', P, false);
    const ctaH = Math.max(A.h * (f === 'tall' ? .1 : .13), 30);
    let F = pillFit(M.cta, A.w * .86, ctaH, P), coop = null, row = null;
    if (endOn) {
      if (f === 'square') {
        coop = coopBlock(A.x, A.w * .42, A.h * .13, Y, W, 'row', P);
        if (coop) { F = pillFit(M.cta, A.w - coop.w - pad * 1.5, ctaH, P); row = F && { h: Math.max(coop.h, F.ph) }; }
      } else coop = coopBlock(A.x, A.w, A.h * .11, Y, W, A.w < 420 ? 'stack' : 'row', P);
    }
    const ctaRow = row || (F && { h: F.ph });
    const used = (hdr?.h || 0) + (row ? row.h : (coop?.h || 0) + (F?.ph || 0)), gaps = m * .05 * 3;
    const lu = D.lineupBlock(A.x, A.w, Math.max(40, A.h - used - gaps), endT, W, P);
    column([hdr, lu, row ? null : coop, ctaRow], A, m * .07);
    pl.block('header', hdr, hdr?.y, t1);
    pl.block('lineup', lu, lu?.y, t1 + .35);
    if (row) {
      const rx = A.x + (A.w - (coop.w + pad + F.pw)) / 2;
      const cb = coopBlock(rx, coop.w, coop.h, Y, W, 'row', P);
      pl.block('endorser', cb, row.y + (row.h - coop.h) / 2, t1 + 1.1);
      pillItem(pl, F, rx + coop.w + pad, row.y + (row.h - F.ph) / 2, Y, K, t1 + 1.3);
    } else {
      pl.block('endorser', coop, coop?.y, t1 + 1.1);
      if (F) pillItem(pl, F, A.x + (A.w - F.pw) / 2, ctaRow.y, Y, K, t1 + 1.3);
    }
  } else if (f === 'wide') {
    const [l, r] = cutLeft(A, A.w * .42, pad);
    const hdr = D.headerBlock(l.x, l.w, l.h * .55, endT, 'left', P, false), F = pillFit(M.cta, l.w, l.h * .17, P);
    const coop = endOn ? coopBlock(l.x, l.w, l.h * .2, Y, W, 'row', P) : null;
    column([hdr, coop, F && { h: F.ph, isF: 1 }], l, m * .07).forEach(b => {
      if (b === hdr) pl.block('header', hdr, b.y, t1);
      else if (b === coop) pl.block('endorser', { ...coop, bx: l.x, draw: (y, t) => coopBlock(l.x - (l.w - coop.w) / 2, l.w, l.h * .2, Y, W, 'row', P).draw(y, t) }, b.y, t1 + 1.1);
      else pillItem(pl, F, l.x, b.y, Y, K, t1 + 1.3);
    });
    const lu = D.lineupBlock(r.x, r.w, r.h, endT, W, P);
    pl.block('lineup', lu, lu ? r.y + (r.h - lu.h) / 2 : 0, t1 + .35);
  } else {
    // banners: headline beside the judges when there's room, else just the judges
    let lb = A;
    if (A.w > 380) {
      const [l, r] = cutLeft(A, A.w * .36, pad * .6);
      const hdr = D.headerBlock(l.x, l.w, l.h, endT, 'left', P, f === 'strip');
      if (hdr) { pl.block('header', hdr, l.y + (l.h - hdr.h) / 2, t1); lb = r; }
    }
    const lu = D.lineupBlock(lb.x, lb.w, lb.h, endT, W, P);
    pl.block('lineup', lu, lu ? lb.y + (lb.h - lu.h) / 2 : 0, t1 + .35);
  }

  const scenes = [{ start: 0, ox: A.x + A.w / 2, oy: A.y + A.h / 2, draw: drawHook }, ...judgeScenes, { start: END0, ox: P.w / 2, oy: P.h / 2, end: true }];
  return pl.done({
    end: END0 + 1.3,
    // Stories: a sunrise fills the bottom of the frame, where Instagram's buttons sit
    under: P.safe ? g => {
      const cy = P.h, R = P.w * .62 * EASE.back(prog(END0 + .2, .7));
      g.fillStyle = mix(B, W, .1);
      for (let k = 0; k < 12; k++) { const a = Math.PI + k * Math.PI / 6; g.beginPath(); g.moveTo(P.w / 2, cy); g.arc(P.w / 2, cy, R * 2, a, a + Math.PI / 12); g.closePath(); g.fill(); }
      g.fillStyle = Y; g.beginPath(); g.arc(P.w / 2, cy, R, 0, TAU); g.fill();
    } : null,
    over(g) {
      const t = now();
      if (!Number.isFinite(t)) return;
      let k = 0;
      scenes.forEach((sc, j) => { if (t >= sc.start) k = j; });
      const cur = scenes[k], prev = scenes[k - 1], p = k ? prog(cur.start, .5) : 1;
      if (cur.end) {
        if (p >= 1) return;
        // the end card opens through a widening hole in the last judge's scene
        g.save(); g.beginPath();
        const mv = motion();
        if (mv === 'fade') { g.globalAlpha *= 1 - EASE.out(p); prev.draw(g, prev.start); g.restore(); return; }
        g.rect(sceneRect.x, 0, sceneRect.w, P.h);
        if (mv === 'slide') g.rect(sceneRect.x + sceneRect.w * (1 - EASE.out(p)), 0, sceneRect.w * EASE.out(p), P.h);
        else g.arc(cur.ox, cur.oy, Math.hypot(P.w, P.h) * EASE.out(p), 0, TAU);
        g.clip('evenodd'); prev.draw(g, prev.start); g.restore();
        return;
      }
      transition(g, sceneRect, p, cur.ox, cur.oy, prev && (() => prev.draw(g, prev.start)), () => cur.draw(g, cur.start));
    },
  });
}

/* =========================================================================
   FRONT ROW: ticker, poster headline, the judges shoulder to shoulder
   ========================================================================= */
function frontrow(P) {
  const f = famOf(P), { m, pad, box } = frameOf(P), { Y, B, W, K } = pal(), M = msgOf(P), cfg = S().sizes[P.key] || {};
  const endOn = !!(cfg.endorser && S().endorser.name.trim()), discOn = !!(cfg.disclaimer && S().text.disclaimer.trim()), photos = D.usePhotos();
  const pl = newPlan(Y), panels = [], strips = [], suns = [];
  const ids = [0, 1, 2, 3];

  // judges standing on `base`, spread across [gx, gx + gw], plus their names on a white strip
  const addGroup = (id, list, gx, gw, base, jh, t0) => {
    const slot = gw / list.length, order = list.map((_, k) => k).sort((a, b) => Math.abs(b - (list.length - 1) / 2) - Math.abs(a - (list.length - 1) / 2));
    pl.el(id, gx, base - jh, gw, jh, t0, t => {
      if (!photos) return;
      const g = G();
      order.forEach(k => {
        const i = list[k], cx = gx + slot * (k + .5), p = t == null ? 1 : prog(t + k * .16, .6);
        if (motion() === 'fade') { if (p <= 0) return; g.save(); g.globalAlpha *= EASE.out(p); drawJudge(g, i, cx, base, jh, 1); g.restore(); }
        else drawJudge(g, i, cx, base, jh, motion() === 'pop' ? Math.min(1.08, EASE.back(p) * .5 + p * .5) : p);
      });
    });
  };
  const addNames = (list, gx, gw, y, nf, t0) => {
    const slot = gw / list.length;
    pl.el(list.length === 4 ? 'names' : `names${list[0]}`, gx, y, gw, Math.max(...nf.map(r => r.total)), t0, t => {
      list.forEach((i, k) => { const r = nf[k]; drawName(G(), r, gx + slot * k + slot * .03, y, 'center', t == null ? null : t + k * .16, 0); });
    });
  };
  const addTicker = (x, y, w, h) => pl.el('ticker', x, y, w, h, 0, t => drawTicker(G(), x, y, w, h, tickerText(P), K, Y, t));
  const addCoop = (cx, cy, d, t0, ink = W) => {
    const E = S().endorser, name = E.name.trim(), res = fit1(name, 'heavy', d * 1.5, d * .4, { color: ink, maxLines: 2, max: d * .2 });
    const ok = res && res.s >= minText(P), h = d + (ok ? d * .08 + res.total : 0);
    pl.el('endorser', cx - d * .75, cy - d / 2, d * 1.5, h, t0, t => {
      const g = G(), p = t == null ? 1 : prog(t, .55);
      if (p <= 0) return;
      g.save();
      if (motion() === 'pop' && p < 1) { g.translate(cx, cy); g.rotate((1 - EASE.out(p)) * -1.4); g.scale(EASE.back(p), EASE.back(p)); g.translate(-cx, -cy); }
      else g.globalAlpha *= EASE.out(p);
      drawFace(g, D.endorserImg(), E, cx, cy, d, Y);
      g.restore();
      if (ok) drawStatic(g, res, cx - d * .75, cy + d / 2 + d * .08, 'center', t == null ? null : t + .3);
    });
  };
  const headT = .2;

  if (f === 'tall' || f === 'square') {
    const th = clamp(P.h * (f === 'tall' ? .036 : .05), 16, 56), ty = P.safe ? box.y : 0;
    addTicker(0, ty, P.w, th);
    const bottomY = P.safe ? box.y + box.h : P.h;
    const contentTop = ty + th + pad * .8, avail = bottomY - contentTop;
    const cols = f === 'tall' && box.w < 340 ? 2 : 4, rows = 4 / cols;
    const PT = poster(M.headline, box.w, avail * (f === 'tall' ? .36 : .32), P, { maxLines: rows === 2 ? 5 : 6 }) || poster(M.short, box.w, avail * .3, P);
    let gy = contentTop;
    if (PT) { pl.el('header', box.x, contentTop, box.w, PT.h, headT, t => drawPoster(G(), PT, box.x, contentTop, 'center', K, B, t)); gy = contentTop + PT.h + pad * .8; }
    // Stories put Cooper above the group, so the judges get the full width
    const coopW = endOn && !P.safe ? box.w * (cols === 4 ? .2 : .3) : 0, gw = box.w - coopW - (coopW ? pad * .4 : 0), slot = gw / cols;
    const discS = discOn ? clamp(P.h * .016, 9, 20) : 0, discH = discS ? discS * 1.3 : 0;
    const overlap = cols === 4 ? 1.28 : 1.6; // judges stand a little shoulder-over-shoulder
    if (P.safe) {
      // Stories: the group and their names fill the safe area; under it the sun rises behind Cooper
      const nf = namesFit(ids, slot * .94, (bottomY - gy) * .25, K, P, { max: slot * .25 });
      const stripH = (nf ? Math.max(...nf.res.map(r => r.total)) + pad * .7 : 0) + discH + pad * .3, stripY = bottomY - stripH;
      const panel = { x: 0, y: gy, w: P.w, h: stripY - gy, t0: .45 }, lower = { x: 0, y: bottomY, w: P.w, h: P.h - bottomY, t0: .6 };
      panels.push(panel, lower);
      strips.push({ x: 0, y: stripY, w: P.w, h: stripH, t0: .85 });
      suns.push({ cx: box.x + gw / 2, cy: stripY, R: Math.min(gw * .44, panel.h * .8), t0: .7, clip: panel });
      suns.push({ cx: P.w / 2, cy: P.h, R: Math.min(P.w * .5, lower.h * .9), t0: 2.0, clip: lower });
      addGroup('group', ids, box.x, gw, stripY, Math.min(panel.h * .97, slot * 1.36), 1.0);
      if (nf) addNames(ids, box.x, gw, stripY + pad * .35, nf.res, 1.35);
      if (discOn) discItem(pl, P, box.x, box.w, bottomY - discH - pad * .15, discS, K, 'center');
      if (endOn) { const d = Math.min(box.w * .24, lower.h * .45); addCoop(P.w / 2, bottomY + lower.h * .38, d, 2.2, K); }
    } else {
      const rowH = (bottomY - gy - discH) / rows;
      const nf = namesFit(ids, slot * .94, rowH * .3, K, P, { max: slot * .25 });
      const stripH = nf ? Math.max(...nf.res.map(r => r.total)) + pad * .7 : rowH * .22;
      for (let r = 0; r < rows; r++) {
        const y0 = gy + r * rowH, stripY = y0 + rowH - stripH, list = ids.slice(r * cols, r * cols + cols);
        const jh = Math.min((stripY - y0) * .98, slot * overlap), panel = { x: 0, y: y0, w: P.w, h: stripY - y0, t0: .5 + r * .15 };
        panels.push(panel);
        strips.push({ x: 0, y: stripY, w: P.w, h: (r === rows - 1 ? P.h : stripY + stripH) - stripY, t0: .85 + r * .15 });
        suns.push({ cx: box.x + gw / 2, cy: stripY, R: Math.min(gw * .44, (stripY - y0) * .82), t0: .7 + r * .15, clip: panel });
        addGroup(rows === 1 ? 'group' : `group${r}`, list, box.x, gw, stripY, jh, 1.0 + r * .35);
        if (nf) addNames(list, box.x, gw, stripY + pad * .35, nf.res.slice(r * cols, r * cols + cols), 1.35 + r * .35);
      }
      if (coopW) { const d = Math.min(coopW * .86, (rowH - stripH) * .62); addCoop(box.x + box.w - coopW / 2, gy + (rowH - stripH) * .45, d, 2.2); }
      if (discOn) discItem(pl, P, box.x, box.w, bottomY - discH, discS, K, 'center');
    }
  } else if (f === 'wide' || f === 'bill') {
    const th = clamp(P.h * (f === 'wide' ? .07 : .13), 16, 44);
    addTicker(0, 0, P.w, th);
    const B2 = { x: box.x, y: th + pad * .6, w: box.w, h: P.h - th - pad * 1.2 };
    const [l, rest] = cutLeft(B2, B2.w * (f === 'wide' ? .43 : .32), pad * 1.2);
    let r = rest, coopBox = null;
    if (f === 'bill' && endOn) [coopBox, r] = cutRight(rest, rest.w * .17, pad * .5);
    // left: the poster headline (with Cooper under it on the link ad) and the legal line
    const discS = discOn ? clamp(P.h * .03, 9, 16) : 0, discH = discS * 1.3;
    let lh = l.h - discH - (discH ? pad * .3 : 0), coopH = f === 'wide' && endOn ? l.h * .24 : 0;
    const PT = poster(M.headline, l.w, lh - coopH - (coopH ? pad * .5 : 0), P, { maxLines: 6 }) || poster(M.short, l.w, lh - coopH, P, { maxLines: 4 });
    const blockHt = (PT ? PT.h : 0) + (coopH ? coopH + pad * .5 : 0), y0 = l.y + (lh - blockHt) / 2;
    if (PT) pl.el('header', l.x, y0, l.w, PT.h, headT, t => drawPoster(G(), PT, l.x, y0, 'left', K, B, t));
    if (coopH) { const cb = coopBlock(l.x, l.w * .8, coopH, Y, K, 'row', P); if (cb) pl.block('endorser', { ...cb, bx: l.x, draw: (y, t) => coopBlock(l.x - (l.w * .8 - cb.w) / 2, l.w * .8, coopH, Y, K, 'row', P).draw(y, t) }, y0 + (PT ? PT.h : 0) + pad * .5, 2.2); }
    if (discOn) discItem(pl, P, l.x, l.w, l.y + l.h - discH, discS, K, 'left');
    // right: the blue panel, judges, names strip
    const px = r.x - pad * .6, nf = namesFit(ids, r.w / 4 * .94, r.h * .32, K, P, { max: r.w / 4 * .24 });
    const stripH = nf ? Math.max(...nf.res.map(q => q.total)) + pad * .7 : 0, stripY = P.h - stripH;
    const panel = { x: px, y: th, w: P.w - px, h: stripY - th, t0: .45 };
    panels.push(panel);
    strips.push({ x: px, y: stripY, w: P.w - px, h: stripH, t0: .8 });
    suns.push({ cx: r.x + r.w / 2, cy: stripY, R: Math.min(r.w * .42, (stripY - th) * .85), t0: .7, clip: panel });
    const jh = Math.min((stripY - th - pad * .3) * .97, r.w / 4 * 1.28);
    addGroup('group', ids, r.x, r.w, stripY, jh, 1.0);
    if (nf) addNames(ids, r.x, r.w, stripY + pad * .35, nf.res, 1.35);
    if (coopBox) { const d = Math.min(coopBox.w * .86, (stripY - th) * .6); addCoop(coopBox.x + coopBox.w / 2, th + (stripY - th) * .42, d, 2.2); }
  } else {
    // strips: [headline] [judges on blue] [ticker column with the poll hours]
    const colW = P.w * (P.w > 500 ? .22 : .38), colX = P.w - colW;
    let x = 0, w = colX;
    if (P.w > 500) {
      const hw = P.w * .3, PT = poster(M.short, hw - pad * 1.5, P.h - pad * 1.4 - 9, P, { maxLines: 3 });
      if (PT) { const y0 = pad * .7; pl.el('header', pad, y0, hw - pad * 1.5, PT.h, headT, t => drawPoster(G(), PT, pad, y0, 'left', K, B, t)); }
      x = hw; w = colX - hw;
    }
    panels.push({ x, y: 0, w, h: P.h, t0: .3 });
    const inner = { x: x + pad * .5, y: pad * .3, w: w - pad, h: P.h - pad * .6 };
    const nfRow = namesFit(ids, inner.w / 4 * .96, P.h * .3, W, P, { modes: [[null, null]] });
    const jh = nfRow ? P.h - nfRow.res[0].total - pad * .8 : 0;
    if (photos && nfRow && jh >= 34) {
      addGroup('group', ids, inner.x, inner.w, P.h - nfRow.res[0].total - pad * .5, Math.min(jh, inner.w / 4 * 1.28), .6);
      addNames(ids, inner.x, inner.w, P.h - nfRow.res[0].total - pad * .3, nfRow.res, .9);
    } else {
      // too short for photos: last names in a 2 x 2 grid
      const nf = namesFit(ids, inner.w / 2 * .94, inner.h / 2 * .9, W, P, { modes: [[null, null]] });
      if (nf) [0, 1].forEach(row => addNames(ids.slice(row * 2, row * 2 + 2), inner.x, inner.w, inner.y + row * inner.h / 2 + (inner.h / 2 - nf.res[0].total) / 2, nf.res.slice(row * 2, row * 2 + 2), .6 + row * .3));
    }
    // the ticker column: the poll hours scroll big while it plays, parked when still
    const discS = discOn ? clamp(P.h * .13, 7.5, 10) : 0, discH = discS * 1.2;
    const cta = (M.cta || '').toUpperCase(), cres = fit1(cta, 'heavy', colW - pad, P.h - discH - pad, { color: Y, maxLines: 3 });
    pl.el('cta', colX, 0, colW, P.h, 0, t => {
      const g = G(), p = t == null ? 1 : EASE.out(prog(t + .2, .4));
      g.save(); g.beginPath(); g.rect(colX, 0, colW, P.h); g.clip();
      g.fillStyle = K; g.fillRect(colX + colW * (1 - p), 0, colW, P.h);
      if (ambient()) {
        const s = (P.h - discH) * .5, f = font('heavy', s); g.font = f; g.fillStyle = Y;
        const unit = `${cta}   ★   `, uw = g.measureText(unit).width, off = ((now() - (t ?? 0)) * s * 2.6) % uw;
        for (let xx = colX + colW - off - uw; xx < P.w; xx += uw) g.fillText(unit, xx, (P.h - discH) / 2 + s * .36);
      } else if (cres && p >= 1) drawStatic(g, cres, colX + pad / 2, (P.h - discH - cres.total) / 2, 'center');
      g.restore();
    });
    if (discOn) discItem(pl, P, colX + pad * .3, colW - pad * .6, P.h - discH - 1, discS, W, 'center');
  }

  return pl.done({
    end: 3.2,
    under(g) {
      const amb = ambient(), t = now();
      panels.forEach(b => { const p = EASE.out(prog(b.t0, .45)); if (p > 0) { g.fillStyle = B; g.fillRect(b.x, b.y + b.h * (1 - p), b.w, b.h * p); } });
      suns.forEach(s => {
        const p = EASE.back(prog(s.t0, .6)); if (p <= 0) return;
        const c = s.clip || { x: 0, y: s.cy - s.R * 2, w: P.w, h: s.R * 2 };
        g.save(); g.beginPath(); g.rect(c.x, c.y, c.w, Math.min(c.h, s.cy - c.y)); g.clip();
        // slow-turning rays behind the sun
        g.fillStyle = mix(B, W, .1);
        const rot = amb ? t * .12 : 0;
        for (let k = 0; k < 14; k++) { const a = Math.PI + rot + k * Math.PI / 7; g.beginPath(); g.moveTo(s.cx, s.cy); g.arc(s.cx, s.cy, s.R * 2.4 * p, a, a + Math.PI / 14); g.closePath(); g.fill(); }
        g.fillStyle = Y; g.beginPath(); g.arc(s.cx, s.cy, s.R * p, 0, TAU); g.fill();
        g.restore();
      });
      strips.forEach(b => { const p = EASE.out(prog(b.t0, .45)); if (p > 0) { g.fillStyle = W; g.fillRect(b.x, b.y, b.w * p, b.h); } });
    },
  });
}

/* =========================================================================
   SCRAPBOOK: polaroid cards, marker note, starburst
   ========================================================================= */
const TILT = [-4, 3.5, -2.5, 4.5].map(d => d * Math.PI / 180);
function scrapbook(P) {
  const f = famOf(P), { m, pad, box } = frameOf(P), { Y, B, W, K } = pal(), M = msgOf(P), cfg = S().sizes[P.key] || {};
  const endOn = !!(cfg.endorser && S().endorser.name.trim()), discOn = !!(cfg.disclaimer && S().text.disclaimer.trim()), photos = D.usePhotos();
  const pl = newPlan(B), ids = [0, 1, 2, 3], hdrT = { kick: Y, kickInk: K, ink: W, hi: Y, disc: Y };
  let raysAt = { x: P.w / 2, y: P.h / 2 };

  // the tag as a strip of yellow tape, slapped on at an angle
  const addTape = (x, y, w, h, align) => {
    const res = fit1(M.kicker.toUpperCase(), 'condBold', w * .9, h * .62, { color: K, maxLines: 1, max: h * .62 });
    if (!res || res.s < minText(P)) return 0;
    const tw = res.maxW + res.s * 1.6, th = res.total + res.s * .7, tx = align === 'center' ? x + (w - tw) / 2 : x;
    pl.el('kicker', tx, y, tw, th, .15, t => {
      const g = G(), p = t == null ? 1 : prog(t, .4);
      enter(g, p, tx + tw / 2, y + th / 2, [tw * .5, 0], q => 1.6 - .6 * EASE.out(q), () => {
        g.save(); g.translate(tx + tw / 2, y + th / 2); g.rotate(-.05); g.translate(-tx - tw / 2, -y - th / 2);
        g.fillStyle = Y; g.beginPath();
        const z = th / 6;
        g.moveTo(tx, y); g.lineTo(tx + tw, y);
        for (let k = 0; k < 6; k++) g.lineTo(tx + tw + (k % 2 ? 0 : -z * .7), y + z * (k + 1)); // torn ends
        g.lineTo(tx, y + th);
        for (let k = 0; k < 6; k++) g.lineTo(tx + (k % 2 ? 0 : z * .7), y + th - z * (k + 1));
        g.closePath(); g.fill();
        drawStatic(g, { ...res, w: tw }, tx, y + (th - res.total) / 2, 'center');
        g.restore();
      });
    });
    return th;
  };
  // headline: wide type, white, highlights in yellow (tape above when there's room)
  const addHeader = (b, align, withTape = true) => {
    let tapeH = 0;
    if (withTape && b.h > 70) tapeH = addTape(b.x, b.y, b.w, Math.min(b.h * .22, 60), align);
    const hb = { x: b.x, y: b.y + (tapeH ? tapeH + pad * .5 : 0), w: b.w, h: b.h - (tapeH ? tapeH + pad * .5 : 0) };
    const hdr = D.headerBlock(hb.x, hb.w, hb.h, hdrT, align, P, true);
    if (hdr) pl.block('header', hdr, tapeH ? hb.y : hb.y + (hb.h - hdr.h) / 2, .35);
    return hdr;
  };
  // the four judges as polaroids; 'tile' = photo on top, 'row' = photo beside the name
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
  const addCards = (R, t0) => {
    const F = cardsFit(R);
    if (!F) { // tiny: faces with last names
      const lu = D.lineupBlock(R.x, R.w, R.h, hdrT, W, P);
      pl.block('lineup', lu, lu ? R.y + (R.h - lu.h) / 2 : 0, t0);
      return lu ? { x: lu.bx, y: R.y + (R.h - lu.h) / 2, w: lu.bw, h: lu.h } : null;
    }
    const tw = F.cols * F.w + (F.cols - 1) * F.gx, thh = F.rows * F.h + (F.rows - 1) * F.gy;
    const x0 = R.x + (R.w - tw) / 2, y0 = R.y + (R.h - thh) / 2;
    raysAt = { x: x0 + tw / 2, y: y0 + thh / 2 };
    pl.el('cards', x0, y0, tw, thh, t0, t => {
      const g = G();
      ids.forEach((i, k) => {
        const c = k % F.cols, r = Math.floor(k / F.cols), x = x0 + c * (F.w + F.gx), y = y0 + r * (F.h + F.gy) + (F.cols === 4 ? (k % 2 ? F.h * .04 : -F.h * .02) : 0);
        const tt = t == null ? null : t + k * .2, p = tt == null ? 1 : prog(tt, .5), mv = motion();
        if (p <= 0) return;
        g.save();
        const cx = x + F.w / 2, cy = y + F.h / 2;
        let rot = TILT[k];
        if (p < 1) {
          if (mv === 'pop') { const q = EASE.out(p); g.translate(0, -(1 - q) * P.h * .55); rot += (1 - q) * (k % 2 ? .6 : -.6); const s = 1 + (1 - q) * .25; g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy); }
          else if (mv === 'slide') { g.globalAlpha *= Math.min(1, p * 2); g.translate((k % 2 ? 1 : -1) * (1 - EASE.out(p)) * P.w * .6, 0); }
          else g.globalAlpha *= EASE.out(p);
        }
        g.translate(cx, cy); g.rotate(rot); g.translate(-cx, -cy);
        // shadow, card, photo window, judge, tape, name
        g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.roundRect(x + F.w * .03, y + F.w * .045, F.w, F.h, F.mg * .6); g.fill();
        g.fillStyle = W; g.beginPath(); g.roundRect(x, y, F.w, F.h, F.mg * .6); g.fill();
        const wx = x + F.mg, wy = y + F.mg;
        g.fillStyle = Y; g.fillRect(wx, wy, F.win.w, F.win.h);
        if (photos) drawJudge(g, i, wx + F.win.w / 2, wy + F.win.h, Math.min(F.win.h * 1.04, F.win.w / judgeAspect(i) * 1.25), mv === 'fade' ? 1 : (tt == null ? 1 : prog(tt + .2, .5)), { x: wx, y: wy, w: F.win.w, h: F.win.h });
        g.fillStyle = 'rgba(255,255,255,.6)';
        const tpw = Math.min(F.w, F.h) * .34, tph = tpw * .28;
        g.save(); g.translate(cx, y); g.rotate(-rot * 1.5); g.fillRect(-tpw / 2, -tph / 2, tpw, tph); g.restore();
        const res = F.nf.res[k];
        if (F.kind === 'tile') drawName(g, res, wx, wy + F.win.h + F.mg * .8 + (F.nameBox.h - res.total) / 2, 'center', tt == null ? null : tt + .35, 0);
        else drawName(g, res, wx + F.win.w + F.mg, y + (F.h - res.total) / 2, 'left', tt == null ? null : tt + .35);
        g.restore();
      });
    });
    return { x: x0, y: y0, w: tw, h: thh };
  };
  // the button as a starburst sticker (or a pill when the burst would be too small to read)
  const addBurst = (b, t0) => {
    const R = Math.min(b.w, b.h) / 2, cta = M.cta.trim();
    const res = fit1(cta.toUpperCase(), 'heavy', R * 1.28, R * 1.0, { color: K, maxLines: 3, lh: 1, max: R * .4 });
    if (!res || res.s < minText(P)) { const F = pillFit(cta, b.w, b.h, P, 3); if (F) pillItem(pl, F, b.x + (b.w - F.pw) / 2, b.y + (b.h - F.ph) / 2, Y, K, t0); return; }
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    pl.el('burst', cx - R, cy - R, R * 2, R * 2, t0, t => {
      const g = G(), p = t == null ? 1 : prog(t, .55);
      if (p <= 0) return;
      const wig = ambient() && t != null && now() > t + .6 ? Math.sin((now() - t) * 4) * .04 : 0;
      g.save(); g.translate(cx, cy); g.rotate(-.12 + wig);
      if (p < 1) { if (motion() === 'pop') { g.rotate((1 - EASE.out(p)) * 2); g.scale(EASE.back(p), EASE.back(p)); } else g.globalAlpha *= EASE.out(p); }
      g.fillStyle = 'rgba(0,0,0,.25)'; burstPath(g, R * .05, R * .07, R); g.fill();
      g.fillStyle = Y; burstPath(g, 0, 0, R); g.fill();
      drawStatic(g, res, -res.w / 2, -res.total / 2, 'center');
      g.restore();
    });
  };
  // Roy Cooper as a round sticker with his name on black tape
  const addCooper = (b, t0) => {
    if (!endOn) return;
    const E = S().endorser, name = E.name.trim(), d = Math.min(b.h * .74, b.w * .62);
    const res = fit1(name, 'heavy', b.w * .95, b.h - d, { color: W, maxLines: 1, max: d * .22 });
    const ok = res && res.s >= minText(P), cx = b.x + b.w / 2, cy = b.y + (ok ? d / 2 : b.h / 2);
    pl.el('endorser', b.x, b.y, b.w, b.h, t0, t => {
      const g = G(), p = t == null ? 1 : prog(t, .5);
      enter(g, p, cx, cy, [0, d * .5], popBack, () => {
        g.save(); g.translate(cx, cy); g.rotate(.06); g.translate(-cx, -cy);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(cx + d * .04, cy + d * .05, d / 2, 0, TAU); g.fill();
        drawFace(g, D.endorserImg(), E, cx, cy, d, Y);
        if (ok) {
          const tw = res.maxW + res.s * 1.2, th = res.total + res.s * .55, ty = cy + d / 2 - th * .2;
          g.fillStyle = K; g.fillRect(cx - tw / 2, ty, tw, th);
          drawStatic(g, { ...res, w: tw }, cx - tw / 2, ty + (th - res.total) / 2, 'center');
        }
        g.restore();
      });
    });
  };
  // the handwritten note, written out left to right, with an arrow that draws itself toward the cards
  const addNote = (b, target, t0) => {
    const note = S().text.note.trim();
    if (!note) return;
    const res = fit1(note, 'marker', b.w * .9, b.h, { color: Y, maxLines: 2, lh: 1, max: b.h * .7 });
    if (!res || res.s < minText(P) * 1.1) return;
    const nx = b.x, ny = b.y + (b.h - res.total) / 2;
    const ax0 = nx + res.maxW + res.s * .3, ay0 = ny + res.total * .5;
    const tx = target ? clamp(ax0 + res.s * 2.2, target.x + target.w * .15, target.x + target.w * .85) : 0, ty = target ? target.y - res.s * .3 : 0;
    const goDown = target && ty > ay0 + res.s;
    pl.el('note', nx, ny, res.maxW, res.total, t0, t => {
      const g = G(), p = t == null ? 1 : prog(t, .7);
      if (p <= 0) return;
      g.save(); g.translate(nx, ny); g.rotate(-.035); g.translate(-nx, -ny);
      g.save(); g.beginPath(); g.rect(nx - res.s, ny - res.s, (res.maxW + res.s * 2) * EASE.out(p), res.total + res.s * 2); g.clip();
      drawStatic(g, { ...res, w: res.maxW }, nx, ny, 'left');
      g.restore(); g.restore();
      if (!target || !goDown) return;
      const q = t == null ? 1 : prog(t + .6, .5);
      if (q <= 0) return;
      const c1x = tx + res.s * 1.5, c1y = ay0;
      g.save(); g.strokeStyle = Y; g.lineWidth = Math.max(2, res.s * .13); g.lineCap = 'round'; g.lineJoin = 'round';
      const len = Math.hypot(c1x - ax0, c1y - ay0) + Math.hypot(tx - c1x, ty - c1y);
      g.setLineDash([len * q, len * 2]);
      g.beginPath(); g.moveTo(ax0, ay0); g.quadraticCurveTo(c1x, c1y, tx, ty); g.stroke();
      if (q > .85) {
        g.setLineDash([]);
        const a = Math.atan2(ty - c1y, tx - c1x), hl = res.s * .6;
        g.beginPath(); g.moveTo(tx - Math.cos(a - .5) * hl, ty - Math.sin(a - .5) * hl); g.lineTo(tx, ty); g.lineTo(tx - Math.cos(a + .5) * hl, ty - Math.sin(a + .5) * hl); g.stroke();
      }
      g.restore();
    });
  };

  // layout per shape
  let A = { ...box };
  if (discOn) {
    const s = clamp(P.h * (f === 'strip' ? .12 : .017), f === 'strip' ? 7.5 : 9.5, 20), dh = s * 1.15;
    if (f !== 'strip') { discItem(pl, P, A.x, A.w, A.y + A.h - dh, s, W, 'center'); A = cutBottom(A, dh, pad * .4)[1]; }
  }
  if (f === 'tall') {
    const skinny = A.w < 230;
    const [hb, r1] = cutTop(A, A.h * (skinny ? .2 : .25), pad * .5);
    addHeader(hb, 'center', !skinny);
    const bottomH = r1.h * (skinny ? .2 : .22), [bot, r2] = cutBottom(r1, bottomH, pad * .5);
    const noteH = skinny ? 0 : r2.h * .1;
    const [nb, cb] = noteH ? cutTop(r2, noteH, pad * .3) : [null, r2];
    const cards = addCards(cb, 1.0);
    if (nb) addNote({ x: nb.x, y: nb.y, w: nb.w * .7, h: nb.h }, cards, 2.0);
    if (endOn && !skinny) { const [cl, cr] = cutLeft(bot, bot.w * .42, pad); addCooper(cl, 2.5); addBurst(cr, 2.2); }
    else addBurst(bot, 2.2);
  } else if (f === 'square') {
    const [hrow, r1] = cutTop(A, A.h * .3, pad * .5), [bb, hl] = cutRight(hrow, Math.min(hrow.h * 1.15, hrow.w * .34), pad * .5);
    addHeader(hl, 'left');
    addBurst(bb, 2.2);
    let cb = r1, bot = null;
    if (endOn || A.h > 400) [bot, cb] = cutBottom(r1, r1.h * .2, pad * .4);
    const cards = addCards(cb, 1.0);
    if (bot) {
      if (endOn) { const [cl, cr] = cutLeft(bot, bot.w * .3, pad); addCooper(cl, 2.5); addNote(cr, null, 2.0); }
      else addNote(bot, null, 2.0);
    }
    if (bot && !endOn) { /* note shows without an arrow when it sits under the cards */ }
  } else if (f === 'wide') {
    const [l, r] = cutLeft(A, A.w * .42, pad);
    const [hb, lb] = cutTop(l, l.h * .56, pad * .5);
    addHeader(hb, 'left');
    const cards = addCards(r, 1.0);
    const [nb, bb] = cutTop(lb, lb.h * .3, pad * .3);
    addNote(nb, cards, 2.0);
    if (endOn) { const [cl, cr] = cutLeft(bb, bb.w * .45, pad * .5); addCooper(cl, 2.5); addBurst(cr, 2.2); }
    else addBurst(bb, 2.2);
  } else if (f === 'bill') {
    const [l, rest] = cutLeft(A, A.w * .3, pad), [rb, mid] = cutRight(rest, rest.w * .26, pad);
    addHeader(l, 'left');
    addCards(mid, .9);
    if (endOn) { const [ct, cbm] = cutTop(rb, rb.h * .42, pad * .2); addCooper(ct, 2.4); addBurst(cbm, 2.1); }
    else addBurst(rb, 2.1);
  } else {
    let rest = A;
    if (A.w > 500) { const [l, r] = cutLeft(A, A.w * .3, pad * .6); addHeader(l, 'left', false); rest = r; }
    const [pb, mid] = cutRight(rest, rest.w * (A.w > 500 ? .3 : .36), pad * .6);
    addCards(mid, .7);
    let pbb = pb;
    if (discOn) { const s = clamp(P.h * .12, 7.5, 10); discItem(pl, P, pb.x, pb.w, pb.y + pb.h - s * 1.15, s, W, 'center'); pbb = cutBottom(pb, s * 1.15, 2)[1]; }
    const F = pillFit(M.cta, pbb.w, pbb.h, P, 3);
    if (F) pillItem(pl, F, pbb.x + (pbb.w - F.pw) / 2, pbb.y + (pbb.h - F.ph) / 2, Y, K, 1.6);
  }

  // sunburst rays and a little confetti behind everything
  const conf = [], rr = rng(P.w * 31 + P.h);
  for (let k = 0; k < 26; k++) conf.push({ x: rr() * P.w, y: rr() * P.h, s: (2 + rr() * 5) * Math.max(1, Math.min(P.w, P.h) / 300), c: rr() > .5 ? Y : W, a: rr() * TAU });
  return pl.done({
    end: 3.3,
    under(g) {
      const p = EASE.out(prog(0, .8)), rot = ambient() ? now() * .08 : 0, R = Math.hypot(P.w, P.h) * p;
      g.fillStyle = mix(B, W, .08);
      for (let k = 0; k < 16; k++) { const a = rot + k * TAU / 16; g.beginPath(); g.moveTo(raysAt.x, raysAt.y); g.arc(raysAt.x, raysAt.y, R, a, a + TAU / 32); g.closePath(); g.fill(); }
      const q = prog(.4, .8);
      conf.forEach(c => { g.save(); g.globalAlpha = .55 * q; g.fillStyle = c.c; g.translate(c.x, c.y); g.rotate(c.a); g.fillRect(-c.s, -c.s * .4, c.s * 2, c.s * .8); g.restore(); });
    },
  });
}

D.register('spotlight', 'Spotlight (judges one by one)', spotlight);
D.register('frontrow', 'Front Row (poster + ticker)', frontrow);
D.register('scrapbook', 'Scrapbook (polaroids + marker)', scrapbook);
document.fonts.load('400 40px "Permanent Marker"').then(() => D.redraw()).catch(() => {});
window.__suites = { spotlight, frontrow, scrapbook };
})();
