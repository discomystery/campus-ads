/* Campus Early Vote Studio
   Renders 1080x1350 (4:5) animated PSAs on a canvas, one per school, using the
   NCSBE early voting site list in data.js. */
(() => {
'use strict';

const W = 1080, H = 1350;
const SITES = window.EV_SITES, SCHOOLS = window.EV_SCHOOLS, META = window.EV_META;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const STORE_KEY = 'evstudio.v1';

/* ---------- easing ---------- */
const ease = {
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inOutCubic: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outBounce: x => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375;
    return n * (x -= 2.625 / d) * x + .984375;
  },
};

/* ---------- color ---------- */
function rgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]) { return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { const A = rgb(a), B = rgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); }
function rgba(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }
function lum(hex) {
  const c = rgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
/* best readable color on `bg`, preferring the school's own colors */
function inkOn(bg, prefs, min = 4.5) {
  const cands = prefs.filter(c => !same(c, bg));
  const good = cands.filter(c => contrast(c, bg) >= min).sort((a, b) => contrast(b, bg) - contrast(a, bg));
  if (good.length) return good[0];
  return contrast('#FFFFFF', bg) >= contrast('#111111', bg) ? '#FFFFFF' : '#111111';
}

/* ---------- geo / schedule helpers ---------- */
function miles(a, b, c, d) {
  const R = 3958.8, r = Math.PI / 180;
  const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON3 = MONTHS.map(m => m.slice(0, 3).toUpperCase());
const DOW3 = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const YEAR = 2026;
function parseDay(str) { // "Thursday, October 15"
  const m = str.match(/([A-Za-z]+)\s+(\d{1,2})\s*$/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1]);
  return mi < 0 ? null : new Date(YEAR, mi, +m[2]);
}
function parseEntry([dates, time]) {
  const [a, b] = dates.split(/\s+-\s+/);
  const d0 = parseDay(a), d1 = b ? parseDay(b) : d0;
  const days = [];
  if (d0 && d1) for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  return { d0, d1, days, time, rawDates: dates };
}
const fmtDay = d => `${MON3[d.getMonth()]} ${d.getDate()}`;
const fmtDow = d => `${DOW3[d.getDay()]} ${fmtDay(d)}`;
function fmtRange(e) {
  if (!e.d0) return e.rawDates.toUpperCase();
  if (+e.d0 === +e.d1) return fmtDow(e.d0);
  const sameMon = e.d0.getMonth() === e.d1.getMonth();
  return `${DOW3[e.d0.getDay()]}–${DOW3[e.d1.getDay()]} ${fmtDay(e.d0)}–${sameMon ? e.d1.getDate() : fmtDay(e.d1)}`;
}
function fmtTime(s) {
  try {
    const [x, y] = s.split(/\s+-\s+/).map(z => {
      const m = z.match(/(\d{1,2}):(\d{2})\s*([ap])/i);
      return { h: +m[1], mm: m[2], ap: m[3].toUpperCase() + 'M' };
    });
    const f = o => o.h + (o.mm !== '00' ? ':' + o.mm : '');
    return x.ap === y.ap ? `${f(x)}–${f(y)}${y.ap}` : `${f(x)}${x.ap}–${f(y)}${y.ap}`;
  } catch { return s; }
}
function scheduleInfo(site) {
  const entries = site.sched.map(parseEntry);
  const all = entries.flatMap(e => e.days).sort((a, b) => a - b);
  const first = all[0], last = all[all.length - 1];
  const isWeekend = d => d.getDay() === 0 || d.getDay() === 6;
  const wkEntries = entries.filter(e => e.days.length && !e.days.every(isWeekend));
  const weEntries = entries.filter(e => e.days.length && e.days.every(isWeekend));
  const compact = [];
  const times = new Set(wkEntries.map(e => e.time));
  const covered = new Set(wkEntries.flatMap(e => e.days).map(d => +d));
  let allWeekdays = true;
  if (first) for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    if (!isWeekend(d) && !covered.has(+d)) { allWeekdays = false; break; }
  }
  if (times.size === 1 && allWeekdays) compact.push(`Mon–Fri ${fmtTime([...times][0])}`);
  else wkEntries.forEach(e => compact.push(`${fmtRange(e)} ${fmtTime(e.time)}`));
  // group weekend days that share a weekday + hours: "SAT OCT 17, 24 & 31 8AM–3PM"
  const groups = new Map();
  weEntries.forEach(e => e.days.forEach(d => {
    const k = d.getDay() + '|' + e.time;
    if (!groups.has(k)) groups.set(k, { dow: d.getDay(), time: e.time, days: [] });
    groups.get(k).days.push(d);
  }));
  [...groups.values()].sort((a, b) => a.days[0] - b.days[0]).forEach(g => {
    const ds = g.days.sort((a, b) => a - b);
    let label = '', prevMon = -1;
    ds.forEach((d, i) => {
      const part = d.getMonth() === prevMon ? String(d.getDate()) : fmtDay(d);
      prevMon = d.getMonth();
      label += (i === 0 ? '' : i === ds.length - 1 ? ' & ' : ', ') + part;
    });
    const isLast = ds.length === 1 && +ds[0] === +last;
    compact.push(`${DOW3[g.dow]} ${label} ${fmtTime(g.time)}${isLast ? ' (last\u00a0day)' : ''}`);
  });
  const full = entries.map(e => `${fmtRange(e)} · ${fmtTime(e.time)}`);
  return { first, last, compact, full };
}
function titleStreet(s) {
  return s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())
    .replace(/\b(Nc|Us|Ne|Nw|Se|Sw|Wt|Mlk)\b/g, m => m.toUpperCase());
}

/* ---------- per-school site candidates ---------- */
const candCache = {};
function candidates(school) {
  if (candCache[school.id]) return candCache[school.id];
  const list = SITES.filter(s => s.county === school.county).map(s => {
    const d = miles(school.lat, school.lon, s.lat, s.lon);
    const onCampus = !!school.campusKey && s.name.includes(school.campusKey);
    return { site: s, d, onCampus };
  }).sort((a, b) => ((b.site.id === school.pdfSite) - (a.site.id === school.pdfSite)) || (b.onCampus - a.onCampus) || (a.d - b.d));
  return (candCache[school.id] = list);
}
// the school's flyer name for its flyer site, otherwise the official name
function siteName(school, site) { return site.id === school.pdfSite && school.pdfLabel || site.nice; }
function chosen(school) {
  const ov = state.overrides[school.id] || {};
  const list = candidates(school);
  return (ov.siteId != null && list.find(c => c.site.id === ov.siteId)) || list[0];
}

/* ---------- layer definitions ---------- */
const LAYERS = [
  { id: 'ticket', label: 'Ticket', kind: 'graphic', only: 'ticket' },
  { id: 'campus', label: 'Campus marker', kind: 'graphic' },
  { id: 'pin', label: 'Site pin', kind: 'graphic' },
  { id: 'ballot', label: 'Ballot box', kind: 'graphic' },
  { id: 'kicker', label: 'Shout-out', kind: 'text', font: 'body', weight: 800, upper: true, lh: 1.1 },
  { id: 'headline', label: 'Headline', kind: 'text', font: 'display', upper: true, lh: .9, fit: true },
  { id: 'dates', label: 'Dates', kind: 'text', font: 'display', upper: true, lh: 1, fit: true },
  { id: 'site', label: 'Site name', kind: 'text', font: 'display', upper: true, lh: .98 },
  { id: 'address', label: 'Address', kind: 'text', font: 'body', weight: 700, lh: 1.15 },
  { id: 'distance', label: 'Distance', kind: 'text', font: 'body', weight: 800, upper: true, lh: 1.15 },
  { id: 'hours', label: 'Hours', kind: 'text', font: 'body', weight: 700, upper: true, lh: 1.3 },
  { id: 'cta', label: 'Call to action', kind: 'text', font: 'body', weight: 800, lh: 1.15 },
  { id: 'footer', label: 'Footer', kind: 'text', font: 'body', weight: 600, lh: 1.25 },
  { id: 'countdown', label: 'Sticker', kind: 'text', font: 'display', upper: true, lh: .9, fit: true },
  { id: 'tap', label: 'Tap prompt', kind: 'text', font: 'display', upper: true, lh: .95 },
  // template-only layers ("only" = the template that shows them)
  ...[1, 2, 3, 4].map(n => ({ id: 'chat' + n, label: 'Chat message ' + n, kind: 'text', font: 'body', weight: 700, lh: 1.18, only: 'chat' })),
  { id: 'todo0', label: 'To-do title', kind: 'text', font: 'hand', lh: 1.05, only: 'todo' },
  ...[1, 2, 3].map(n => ({ id: 'todo' + n, label: 'To-do item ' + n, kind: 'text', font: 'hand', lh: 1.02, only: 'todo' })),
];
const LAYER = Object.fromEntries(LAYERS.map(l => [l.id, l]));

const DEFAULT_TEXTS = {
  kicker: 'Hey {short} {mascot}!',
  headline: 'Early voting\nis open!',
  dates: '{span}',
  site: '{site}',
  address: '{street}, {city}',
  distance: '{proximity}',
  hours: '{hours}',
  cta: 'Not registered? Register + vote the same day.',
  footer: '{photoid} · ncsbe.gov',
  countdown: 'Skip\nthe\nlines!',
  tap: 'Tap to find your spot',
  chat1: "who's voting early??",
  chat2: "me!! it's at {site}",
  chat3: 'wait it’s open already?',
  chat4: 'open every day til {end} + you can register there too',
  todo0: 'today’s to-do:',
  todo1: 'grab coffee',
  todo2: '10am class',
  todo3: 'VOTE EARLY @ {site}!!',
};
const TOKENS = [
  ['{school}', 'Full school name'], ['{short}', 'Short name'], ['{mascot}', 'Mascot'],
  ['{site}', 'Site name'], ['{street}', 'Street address'], ['{city}', 'City'], ['{county}', 'County'],
  ['{proximity}', '"On campus" or distance + travel time'], ['{miles}', 'Distance in miles'], ['{travel}', '"~6 min walk"'],
  ['{span}', 'Date range, e.g. OCT 15–31'], ['{start}', 'First day'], ['{end}', 'Last day'],
  ['{hours}', 'Hours (compact/full)'], ['{days}', 'Days left'], ['{countdown}', 'Days-left text (changes daily)'], ['{photoid}', 'Student-ID line if the school’s ID is approved, otherwise a photo-ID reminder'], ['{idline}', 'Student-ID line, blank if the school’s ID isn’t approved'],
];

const TEMPLATES = {
  ticker:  { name: 'Ticker', desc: 'Scrolling tape + floating shapes' },
  sticker: { name: 'Sticker Bomb', desc: 'Chunky cards, ballot box, confetti' },
  map:     { name: 'Map Drop', desc: 'Route from campus to the pin' },
  rays:    { name: 'Sunburst', desc: 'Spinning rays, centered type' },
  chat:    { name: 'Group Chat', desc: 'Messages pop in, typing dots' },
  todo:    { name: 'To-Do List', desc: 'Notebook page, items get checked' },
  ticket:  { name: 'Game Ticket', desc: 'Admit one, stub tears off' },
};
const base = {
  campus:    { x: .2,  y: .6,   size: 60,  visible: false, anim: 'pop',  delay: .8, idle: 'none' },
  pin:       { x: .78, y: .5,   size: 120, visible: false, anim: 'drop', delay: 1.0, idle: 'float' },
  ballot:    { x: .8,  y: .4,   size: 190, visible: false, anim: 'pop',  delay: 1.2, idle: 'none' },
  kicker:    { x: .07, y: .061, w: .86, size: 44, align: 'left', style: 'pill', fitMin: .7, anim: 'left', delay: .1 },
  headline:  { x: .07, y: .14, w: .86, size: 210, align: 'left', style: 'plain', anim: 'slam', delay: .35 },
  dates:     { x: .07, y: .405, w: .62, size: 130, align: 'left', style: 'highlight', anim: 'wipe', delay: .9 },
  site:      { x: .07, y: .53,  w: .86, size: 84, align: 'left', style: 'card', rot: -1.5, fitMin: .6, anim: 'up', delay: 1.1 },
  address:   { x: .07, y: .665, w: .86, size: 40, align: 'left', style: 'plain', icon: 'pin', anim: 'up', delay: 1.3 },
  distance:  { x: .07, y: .718, w: .38, size: 34, align: 'left', style: 'highlight', anim: 'left', delay: 1.5 },
  hours:     { x: .93, y: .718, w: .55, size: 31, align: 'right', style: 'plain', icon: 'clock', anim: 'fade', delay: 1.7 },
  cta:       { x: .07, y: .838, w: .86, size: 40, align: 'left', style: 'pill', color: 'pop', fitMin: .8, anim: 'up', delay: 1.9, idle: 'pulse' },
  footer:    { x: .07, y: .9, w: .86, size: 29, align: 'left', style: 'plain', fitMin: .85, anim: 'fade', delay: 2.1 },
  countdown: { x: .82, y: .345, w: .26, size: 56, align: 'center', style: 'sticker', rot: 10, anim: 'pop', delay: 1.6, idle: 'wiggle' },
  ticket:    { x: .5,  y: .1,   w: .88, h: .78, stub: .78, size: 100, visible: false, anim: 'up', delay: .05, tear: 3.6 },
  chat1:     { x: .07, y: .33, w: .74, size: 44, align: 'left',  style: 'bubble', visible: false, anim: 'pop', delay: 1.0 },
  chat2:     { x: .93, y: .4,  w: .74, size: 44, align: 'right', style: 'bubble', visible: false, anim: 'pop', delay: 1.9, after: 'chat1' },
  chat3:     { x: .07, y: .47, w: .74, size: 44, align: 'left',  style: 'bubble', visible: false, anim: 'pop', delay: 2.8, after: 'chat2' },
  chat4:     { x: .93, y: .54, w: .74, size: 44, align: 'right', style: 'bubble', visible: false, anim: 'pop', delay: 3.7, after: 'chat3' },
  todo0:     { x: .12, y: .335, w: .8, size: 62, align: 'left', style: 'plain', visible: false, anim: 'fade', delay: .9 },
  todo1:     { x: .12, y: .4,  w: .8, size: 70, align: 'left', style: 'todo', check: 'check', visible: false, anim: 'type', delay: 1.2, after: 'todo0', gap: .008 },
  todo2:     { x: .12, y: .46, w: .8, size: 70, align: 'left', style: 'todo', check: 'check', visible: false, anim: 'type', delay: 2.0, after: 'todo1', gap: .004 },
  todo3:     { x: .12, y: .52, w: .8, size: 70, align: 'left', style: 'todo', check: 'circle', visible: false, anim: 'type', delay: 2.8, after: 'todo2', gap: .004 },
  tap:       { x: .07, y: .69,  w: .86, size: 84, align: 'left', style: 'pill', color: 'pop', icon: 'arrow', fitMin: .7, visible: false, anim: 'pop', delay: 1.4, idle: 'pulse' },
};
const CHAT_SHOW = Object.fromEntries([1, 2, 3, 4].map(n => ['chat' + n, { visible: true }]));
const TODO_SHOW = Object.fromEntries([0, 1, 2, 3].map(n => ['todo' + n, { visible: true }]));
const layerDefaults = { visible: true, w: .86, size: 40, align: 'left', style: 'plain', rot: 0, color: 'auto', icon: 'none', anim: 'fade', delay: 0, idle: 'none' };
const TEMPLATE_LAYOUT = {
  ticker: {},
  sticker: {
    ballot: { visible: true, x: .8, y: .318, size: 150, rot: 6 },
    kicker: { y: .034 },
    headline: { y: .115 },
    dates: { y: .405, w: .6, style: 'card', rot: 2, size: 120 },
    countdown: { x: .83, y: .415, size: 44, rot: 12 },
    site: { y: .575, rot: -2 },
    address: { y: .71 },
    distance: { y: .758, w: .4, size: 30, style: 'pill' },
    hours: { y: .755 },
    cta: { y: .882 },
    footer: { y: .94 },
  },
  map: {
    campus: { visible: true, x: .17, y: .445 },
    pin: { visible: true, x: .8, y: .468 },
    kicker: { y: .025 },
    headline: { y: .102, w: .7, size: 190 },
    countdown: { x: .865, y: .1, size: 46, rot: 10 },
    distance: { x: .5, y: .327, w: .8, align: 'center', style: 'pill', anim: 'pop', delay: 2.4 },
    dates: { y: .505, size: 110 },
    site: { y: .592, size: 72 },
    address: { y: .708 },
    hours: { x: .07, y: .748, w: .86, align: 'left' },
    cta: { y: .88 },
    footer: { y: .943 },
  },
  rays: {
    kicker: { align: 'center', x: .5, y: .034 },
    headline: { align: 'center', x: .5, y: .114, w: .9 },
    countdown: { x: .855, y: .372, size: 46, rot: -10 },
    dates: { align: 'center', x: .5, y: .382, style: 'pill', size: 120 },
    site: { align: 'center', x: .5, y: .532, rot: 0 },
    address: { align: 'center', x: .5, y: .655 },
    distance: { y: .708 },
    hours: { y: .708 },
    cta: { align: 'center', x: .5, y: .842 },
    footer: { align: 'center', x: .5, y: .908 },
  },
  chat: {
    ...CHAT_SHOW,
    kicker: { y: .042 },
    headline: { y: .11, size: 150 },
    countdown: { x: .82, y: .2, size: 44, delay: .8 },
    chat3: { visible: false }, chat4: { visible: true, after: 'chat2', gap: .008, delay: 2.8 },
    dates: { visible: false }, site: { visible: false },
    address: { after: 'chat4', gap: .035, size: 36, delay: 3.6 },
    distance: { after: 'address', gap: .004, x: .07, w: .86, size: 30, style: 'plain', color: 'pop', delay: 3.8 },
    hours: { after: 'distance', gap: .01, x: .07, align: 'left', w: .86, size: 30, delay: 4 },
    cta: { y: .865, delay: 4.4 },
    footer: { y: .928, delay: 4.6 },
  },
  todo: {
    ...TODO_SHOW,
    kicker: { x: .12, y: .04 },
    headline: { x: .12, y: .112, w: .56, size: 150 },
    dates: { style: 'note', x: .825, y: .105, size: 54, rot: 4, font: 'hand', lh: 1, text: 'early voting\n{span}!', anim: 'pop', delay: 1 },
    todo0: { visible: true, y: .292, size: 66 }, todo1: { visible: true, size: 80 }, todo2: { visible: true, size: 80 }, todo3: { visible: true, size: 80 },
    countdown: { visible: false }, site: { visible: false }, distance: { visible: false },
    address: { x: .12, w: .82, after: 'todo3', gap: .03, size: 36, delay: 3.9 },
    hours: { after: 'address', gap: .006, x: .12, align: 'left', w: .82, size: 30, delay: 4.1 },
    cta: { x: .12, y: .862, delay: 4.4 },
    footer: { x: .12, y: .925, delay: 4.6 },
  },
  ticket: {
    ticket: { visible: true, y: .1, h: .84, stub: .8 },
    kicker: { y: .03 },
    headline: { x: .12, y: .17, w: .76, size: 130, on: 'card' },
    countdown: { x: .8, y: .25, size: 40, rot: 12, delay: 1.2 },
    dates: { x: .12, y: .363, size: 74, style: 'plain', caption: 'When', on: 'card' },
    site: { x: .12, y: .468, w: .76, size: 66, style: 'plain', caption: 'Gate', on: 'card', rot: 0, fitMin: .5 },
    address: { x: .12, y: .578, w: .3, size: 31, caption: 'Where', on: 'card', icon: 'none' },
    distance: { x: .12, y: .703, w: .3, size: 27, style: 'plain', on: 'card' },
    hours: { x: .88, y: .578, w: .45, size: 27, caption: 'Hours', on: 'card', icon: 'none' },
    cta: { x: .5, y: .8, align: 'center', anim: 'pop', delay: 3.8 },
    footer: { x: .5, y: .878, align: 'center', delay: 4 },
  },
};
// "Call to action" version: no site, address, hours, distance or ID line, just a big tap prompt
const VARIANTS = { full: 'Full details', cta: 'Call to action' };
const CTA_HIDE = { address: { visible: false }, distance: { visible: false }, hours: { visible: false }, footer: { visible: false } };
const CTA_ID = (extra = {}) => ({ visible: true, text: '{idline}', icon: 'check', size: 31, fitMin: .8, delay: 2.3, ...extra });
const CTA_LAYOUT = {
  ticker: { footer: CTA_ID({ y: .893 }),  site: { size: 96, fitMin: .5 }, tap: { visible: true, y: .69 }, cta: { y: .82, size: 44, delay: 1.7 } },
  sticker: { footer: CTA_ID({ y: .925 }),  site: { size: 92, fitMin: .5 }, tap: { visible: true, y: .725 }, cta: { y: .855, size: 44, delay: 1.7 } },
  map: {
    campus: { y: .385 }, pin: { y: .405 }, dates: { y: .455 }, site: { y: .55, size: 88, fitMin: .5 },
    tap: { visible: true, y: .69 }, cta: { y: .825, size: 44, delay: 1.7 }, footer: CTA_ID({ y: .9 }),
  },
  rays: { footer: CTA_ID({ x: .5, align: 'center', y: .885 }),  site: { size: 92, fitMin: .5 }, tap: { visible: true, x: .5, y: .675, align: 'center' }, cta: { y: .81, size: 44, delay: 1.7 } },
  chat: {
    ...Object.fromEntries([1, 2, 3].map(n => ['chat' + n, { size: 54, visible: true, gap: .022, w: .8 }])), chat4: { visible: false },
    chat1: { size: 54, visible: true, y: .335, w: .8 },
    tap: { visible: true, after: 'chat3', gap: .04, x: .5, align: 'center', size: 88, delay: 3.6 },
    cta: { after: 'tap', gap: .022, x: .5, align: 'center', size: 44, delay: 3.9 },
    footer: CTA_ID({ after: 'cta', gap: .014, x: .5, align: 'center', delay: 4.2 }),
  },
  todo: {
    todo0: { size: 72 }, todo1: { size: 84 }, todo2: { size: 84 }, todo3: { size: 84 },
    tap: { visible: true, after: 'todo3', gap: .075, x: .12, w: .82, size: 92, delay: 3.8 },
    cta: { after: 'tap', gap: .03, size: 44, delay: 4.1 },
    footer: CTA_ID({ after: 'cta', gap: .018, x: .12, delay: 4.4 }),
  },
  ticket: {
    ticket: { stub: .72 },
    headline: { size: 140 },
    countdown: { y: .26 },
    dates: { y: .38, size: 84 },
    site: { y: .51, size: 96 },
    tap: { visible: true, x: .5, y: .73, align: 'center', delay: 3.7 },
    cta: { x: .5, y: .845, align: 'center', size: 42, delay: 3.9 },
    footer: CTA_ID({ x: .5, y: .912, align: 'center', delay: 4.2 }),
  },
};
const LAYOUT_KEYS = Object.keys(TEMPLATES).flatMap(t => [t, t + ':cta']);
const layoutKey = () => state.template + (state.variant === 'cta' ? ':cta' : '');
function defaultLayout(key) {
  const [tpl, variant] = key.split(':'), out = {};
  for (const l of LAYERS) out[l.id] = { ...layerDefaults, ...base[l.id], ...(TEMPLATE_LAYOUT[tpl][l.id] || {}),
    ...(variant === 'cta' ? { ...(CTA_HIDE[l.id] || {}), ...(CTA_LAYOUT[tpl][l.id] || {}) } : {}) };
  return out;
}

const FONT_PRESETS = {
  loud:     { name: 'Loud — Anton + Archivo', display: 'Anton', dw: 400, body: 'Archivo' },
  bubbly:   { name: 'Bubbly — Bowlby One + DM Sans', display: 'Bowlby One', dw: 400, body: 'DM Sans', scale: .78 },
  arcade:   { name: 'Arcade — Bungee + Space Grotesk', display: 'Bungee', dw: 400, body: 'Space Grotesk', scale: .72 },
  marker:   { name: 'Handmade — Permanent Marker + Rubik', display: 'Permanent Marker', dw: 400, body: 'Rubik', scale: .8 },
  grotesk:  { name: 'Grotesk — Bricolage Grotesque', display: 'Bricolage Grotesque', dw: 800, body: 'Bricolage Grotesque', scale: .82 },
};

/* ---------- state ---------- */
function freshState() {
  return {
    schoolId: SCHOOLS[0].id,
    template: 'ticker',
    font: 'loud',
    colorMode: 'primary',
    pattern: 'dots',
    duration: 9,
    outro: 'fade',
    confetti: true,
    guides: false,
    hoursMode: 'compact',
    asOf: todayISO(),
    tickerText: 'EARLY VOTING ✶ {short} ✶ {span} ✶ ',
    texts: { ...DEFAULT_TEXTS },
    variant: 'full',
    layouts: Object.fromEntries(LAYOUT_KEYS.map(k => [k, defaultLayout(k)])),
    overrides: {},
    layoutVersion: LAYOUT_VERSION,
    filter: 'all',
    search: '',
  };
}
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
// bump when default layouts change: older saved layouts (and untouched old default texts) give way to the new defaults
const LAYOUT_VERSION = 8;
// Positions whose defaults moved after v3: [version, layout key, layer, prop, old default]. A saved value still
// equal to the old default is dropped on load so the new default applies; hand-placed values are kept.
const LAYOUT_CHANGES = [
  ...['ticker', 'ticker:cta'].flatMap(k => [[4, k, 'kicker', 'y', .068], [4, k, 'headline', 'y', .122]]),
  ...['sticker', 'sticker:cta'].flatMap(k => [[4, k, 'kicker', 'y', .045], [4, k, 'headline', 'y', .1]]),
  ...['map', 'map:cta'].flatMap(k => [[4, k, 'kicker', 'y', .035], [4, k, 'headline', 'y', .085]]),
  ...['rays', 'rays:cta'].flatMap(k => [[4, k, 'kicker', 'y', .045], [4, k, 'headline', 'y', .098],
    [5, k, 'countdown', 'x', .86], [5, k, 'countdown', 'y', .305], [5, k, 'countdown', 'size', 48], [5, k, 'dates', 'y', .39], [5, k, 'site', 'y', .52]]),
  [4, 'map', 'distance', 'y', .31],
  [5, 'map', 'campus', 'y', .425], [5, 'map', 'pin', 'y', .445], [5, 'map', 'dates', 'y', .485], [5, 'map', 'site', 'y', .575],
  [5, 'map', 'site', 'size', 76], [5, 'map', 'address', 'y', .688], [5, 'map', 'hours', 'y', .733],
  ...Object.keys(TEMPLATES).map(k => [8, k + ':cta', 'footer', 'visible', false]), // CTA versions now show the student-ID line
  [5, 'map:cta', 'campus', 'y', .37], [5, 'map:cta', 'pin', 'y', .39], [5, 'map:cta', 'dates', 'y', .445], [5, 'map:cta', 'site', 'y', .54],
];
const OLD_DEFAULT_TEXTS = {
  headline: ['Early\nvoting is\nopen!'],
  footer: ['Bring a photo ID (many NC student IDs count). Sites & hours: ncsbe.gov', 'Bring a photo ID (many NC student IDs count) · ncsbe.gov'],
  tap: ['Tap to find your\nvoting spot →', 'Tap to find\nyour spot'],
  countdown: ['{countdown}'],
};
function merge(fresh, saved) {
  const from = saved.layoutVersion || 1;
  if (from < LAYOUT_VERSION) {
    saved = { ...saved, layoutVersion: LAYOUT_VERSION, texts: { ...(saved.texts || {}) }, layouts: structuredClone(saved.layouts || {}) };
    if (from < 3) delete saved.layouts;
    else for (const [ver, key, id, prop, old] of LAYOUT_CHANGES) {
      const L = (saved.layouts[key] || {})[id];
      if (ver > from && L && L[prop] === old) delete L[prop];
    }
    for (const [k, olds] of Object.entries(OLD_DEFAULT_TEXTS)) if (olds.includes(saved.texts[k])) delete saved.texts[k];
  }
  const s = { ...fresh, ...saved };
  s.texts = { ...fresh.texts, ...(saved.texts || {}) };
  s.layouts = {};
  for (const t of LAYOUT_KEYS) {
    s.layouts[t] = {};
    for (const l of LAYERS) s.layouts[t][l.id] = { ...fresh.layouts[t][l.id], ...((saved.layouts || {})[t] || {})[l.id] };
  }
  s.overrides = saved.overrides || {};
  if (!SCHOOLS.find(x => x.id === s.schoolId)) s.schoolId = fresh.schoolId;
  if (!TEMPLATES[s.template]) s.template = fresh.template;
  if (!FONT_PRESETS[s.font]) s.font = fresh.font;
  return s;
}
let state = freshState();
try { const raw = localStorage.getItem(STORE_KEY); if (raw) state = merge(freshState(), JSON.parse(raw)); } catch {}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }, 250);
}
const school = () => SCHOOLS.find(s => s.id === state.schoolId);
const layout = () => state.layouts[layoutKey()];

/* ---------- per-school derived content ---------- */
function paletteFor(sc) {
  const ov = state.overrides[sc.id] || {};
  const [p, s, a] = ov.colors || sc.colors;
  const mode = state.colorMode;
  const bg = state.template === 'todo' ? '#FBF8F0' // notebook paper
    : mode === 'primary' ? p : mode === 'secondary' ? s : mode === 'dark' ? mix(p, '#0a0a0f', .82) : '#F5F0E6';
  const prefs = [p, s, a];
  const ink = inkOn(bg, prefs);
  const popCands = prefs.filter(c => !same(c, bg) && !same(c, ink) && contrast(c, bg) >= 2.2);
  const pop = popCands.sort((x, y) => contrast(y, bg) - contrast(x, bg))[0] || mix(ink, bg, .25);
  const isDark = lum(bg) < .25;
  const cardFill = isDark ? '#FFFFFF' : (lum(bg) > .8 ? p : '#FFFFFF');
  const cardInk = inkOn(cardFill, [p, s, a, '#111111']);
  const outline = '#111111';
  const shadow = same(pop, cardFill) ? '#111111' : pop;
  return { p, s, a, bg, ink, pop, cardFill, cardInk, outline, shadow, isDark };
}

function contentFor(sc) {
  const c = chosen(sc);
  if (!c) return null;
  const site = c.site, ov = state.overrides[sc.id] || {};
  const sch = scheduleInfo(site);
  const asOf = new Date(state.asOf + 'T00:00:00');
  const dayMs = 864e5;
  let days = Math.round((sch.last - asOf) / dayMs) + 1;
  let countdown;
  if (asOf < sch.first) { days = Math.round((sch.first - asOf) / dayMs); countdown = `Starts\n${fmtDay(sch.first)}`; }
  else if (days > 1) countdown = `${days}\ndays\nleft`;
  else if (days === 1) countdown = 'Last\nday!';
  else countdown = 'Vote\nNov 3';
  const walk = Math.round(c.d * 1.25 / 3 * 60);
  const travel = walk <= 25 ? `~${Math.max(walk, 2)} min walk` : `~${Math.max(3, Math.round(c.d * 1.3 / 28 * 60))} min drive`;
  const near = c.onCampus && c.d < 1.2;
  const proximity = near ? `Right on campus · ${travel}` : `${c.d.toFixed(1)} mi from campus · ${travel}`;
  const sameMon = sch.first.getMonth() === sch.last.getMonth();
  // only schools whose student ID is on the State Board's approved list get the student-ID line
  const idOk = idApproved(sc), photoid = idOk ? `Your ${ov.idCard || sc.idCard || sc.short + ' student ID'} counts as voter ID!`
    : 'Bring a photo ID, like a driver’s license or passport';
  return {
    tokens: {
      school: sc.name, short: sc.short, mascot: sc.mascot,
      site: ov.siteLabel || siteName(sc, site), street: titleStreet(site.street), city: site.city, county: site.county + ' County',
      proximity, miles: c.d.toFixed(1), travel,
      span: sameMon ? `${fmtDay(sch.first)}–${sch.last.getDate()}` : `${fmtDay(sch.first)} – ${fmtDay(sch.last)}`,
      start: fmtDay(sch.first), end: fmtDay(sch.last),
      hours: (state.hoursMode === 'full' ? sch.full : sch.compact).join('\n'),
      days: String(Math.max(days, 0)), countdown, photoid, idline: idOk ? photoid : '',
    },
    site, c, sch,
  };
}
function idApproved(sc) { const o = (state.overrides[sc.id] || {}).idOk; return o != null ? o : !!sc.idOk; }
function fill(str, tokens) { return str.replace(/\{(\w+)\}/g, (m, k) => tokens[k] != null ? tokens[k] : m); }
function textFor(id, sc, content) {
  const ov = state.overrides[sc.id] || {};
  const src = id === 'headline' && ov.headline ? ov.headline : state.texts[id];
  return fill(src || '', content.tokens);
}

/* ---------- drawing primitives ---------- */
function fontStr(def, size) {
  const fp = FONT_PRESETS[state.font];
  if (def.font === 'display') return `${fp.dw} ${size}px "${fp.display}"`;
  if (def.font === 'hand') return `700 ${size}px "Caveat"`;
  return `${def.weight || 700} ${size}px "${fp.body}"`;
}
function displayScale(def) { return def.font === 'display' ? (FONT_PRESETS[state.font].scale || 1) : 1; }
function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    // too long for one line: break at " · " separators before breaking mid-phrase
    if (para.includes(' · ') && ctx.measureText(para).width > maxW) {
      out.push(...wrapLines(ctx, para.split(' · ').join('\n'), maxW)); continue;
    }
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (line && ctx.measureText(test).width > maxW) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
}
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function starPath(ctx, cx, cy, R, r, n, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R, a = rot + i * Math.PI / n;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}
function icon(ctx, kind, x, y, s, color) { // x,y = center
  ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = s * .12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'pin') {
    const r = s * .32, cy = y - s * .12;
    ctx.beginPath(); ctx.arc(x, cy, r, Math.PI * .85, Math.PI * .15); ctx.lineTo(x, y + s * .45); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, cy, r * .42, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'clock') {
    ctx.beginPath(); ctx.arc(x, y, s * .38, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - s * .2); ctx.lineTo(x, y); ctx.lineTo(x + s * .15, y + s * .1); ctx.stroke();
  } else if (kind === 'arrow') {
    const hw = s * .42, sh = s * .14;
    ctx.beginPath(); ctx.moveTo(x - hw, y - sh); ctx.lineTo(x + s * .02, y - sh); ctx.lineTo(x + s * .02, y - s * .34); ctx.lineTo(x + hw, y);
    ctx.lineTo(x + s * .02, y + s * .34); ctx.lineTo(x + s * .02, y + sh); ctx.lineTo(x - hw, y + sh); ctx.closePath(); ctx.fill();
  } else if (kind === 'cal') {
    roundRect(ctx, x - s * .38, y - s * .32, s * .76, s * .7, s * .1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * .38, y - s * .1); ctx.lineTo(x + s * .38, y - s * .1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * .18, y - s * .45); ctx.lineTo(x - s * .18, y - s * .25); ctx.moveTo(x + s * .18, y - s * .45); ctx.lineTo(x + s * .18, y - s * .25); ctx.stroke();
  } else if (kind === 'check') {
    ctx.beginPath(); ctx.moveTo(x - s * .32, y); ctx.lineTo(x - s * .08, y + s * .25); ctx.lineTo(x + s * .35, y - s * .28); ctx.lineWidth = s * .16; ctx.stroke();
  } else if (kind === 'star') {
    starPath(ctx, x, y, s * .45, s * .2, 5, -Math.PI / 2); ctx.fill();
  }
  ctx.restore();
}

/* seeded random for deterministic decoration */
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function hashStr(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- backgrounds ---------- */
function drawPattern(ctx, pal, t) {
  const col = rgba(pal.ink, pal.isDark ? .08 : .1);
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col;
  if (state.pattern === 'dots') {
    for (let y = 20; y < H; y += 44) for (let x = (y / 44) % 2 ? 42 : 20; x < W; x += 44) { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); }
  } else if (state.pattern === 'halftone') {
    for (let y = 0; y < H; y += 30) for (let x = 0; x < W; x += 30) {
      const r = 1 + 7 * Math.pow((x + y) / (W + H), 1.6); ctx.beginPath(); ctx.arc(x + ((y / 30) % 2) * 15, y, r, 0, 7); ctx.fill();
    }
  } else if (state.pattern === 'stripes') {
    ctx.lineWidth = 18; const off = (t * 30) % 80;
    for (let x = -H; x < W + H; x += 80) { ctx.beginPath(); ctx.moveTo(x + off, 0); ctx.lineTo(x + off - H, H); ctx.stroke(); }
  } else if (state.pattern === 'grid') {
    ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  ctx.restore();
}
function tickerBand(ctx, pal, t, yc, h, ang, speed, text) {
  const fp = FONT_PRESETS[state.font];
  ctx.save();
  ctx.translate(W / 2, yc); ctx.rotate(ang * Math.PI / 180);
  ctx.fillStyle = pal.ink; ctx.fillRect(-W, -h / 2, W * 2, h);
  ctx.fillStyle = pal.bg;
  ctx.font = `${fp.dw} ${Math.round(h * .58 * (fp.scale || 1))}px "${fp.display}"`;
  ctx.textBaseline = 'middle';
  const unit = ctx.measureText(text).width || 100;
  let x = -W - ((t * speed) % unit + unit) % unit;
  while (x < W) { ctx.fillText(text, x, h * .03); x += unit; }
  ctx.restore();
}
// floating shapes go only where they clear every element (so they fill empty space instead of cluttering text)
function floaters(ctx, pal, t, seed, count, alpha, keepOut = [], edge = 0) {
  const r = rng(seed);
  for (let i = 0, tries = 0; i < count && tries < count * 12; tries++) {
    const x0 = r() * W, y0 = r() * H, s = 30 + r() * 70, kind = Math.floor(r() * 3), sp = .3 + r() * .6, ph = r() * 6.28;
    const reach = s * .6 + 34 + 18;
    if (y0 < edge + reach || y0 > H - edge - reach || x0 < reach * .5 || x0 > W - reach * .5) continue;
    if (keepOut.some(b => x0 > b.x - reach - 24 && x0 < b.x + b.w + reach + 24 && y0 > b.y - reach - 24 && y0 < b.y + b.h + reach + 24)) continue;
    i++;
    const x = x0 + Math.sin(t * sp + ph) * 30, y = y0 + Math.cos(t * sp * .8 + ph) * 26, rot = t * sp + ph;
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = i % 2 ? pal.pop : pal.ink; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.translate(x, y); ctx.rotate(rot);
    if (kind === 0) { starPath(ctx, 0, 0, s * .5, s * .22, 4); ctx.fill(); }
    else if (kind === 1) { ctx.beginPath(); ctx.arc(0, 0, s * .35, 0, 7); ctx.lineWidth = 9; ctx.stroke(); }
    else { ctx.beginPath(); for (let k = 0; k <= 4; k++) ctx.lineTo(-s * .6 + k * s * .3, k % 2 ? -s * .15 : s * .15); ctx.stroke(); }
    ctx.restore();
  }
}
function confetti(ctx, pal, t, start) {
  const dt = t - start; if (dt < 0 || dt > 3.4) return;
  const r = rng(99), cols = [pal.p, pal.s, pal.a, pal.ink, pal.pop];
  for (let i = 0; i < 90; i++) {
    const x0 = W * (.2 + r() * .6), vx = (r() - .5) * 900, vy = -500 - r() * 900, spin = (r() - .5) * 14, w = 12 + r() * 14, c = cols[i % cols.length];
    const x = x0 + vx * dt, y = H * .45 + vy * dt + 900 * dt * dt;
    if (y > H + 40) continue;
    ctx.save(); ctx.globalAlpha = clamp(3.4 - dt, 0, 1); ctx.translate(x, y); ctx.rotate(spin * dt); ctx.scale(1, Math.cos(dt * 9 + i));
    ctx.fillStyle = c; ctx.fillRect(-w / 2, -w / 4, w, w / 2); ctx.restore();
  }
}
function drawMapStreets(ctx, pal, t) {
  ctx.save();
  ctx.translate(W / 2, H * .45); ctx.rotate(-.21); ctx.translate(-W / 2 - (t * 6) % 110, -H * .45);
  const minor = rgba(pal.ink, .1), major = rgba(pal.ink, .2);
  ctx.strokeStyle = minor; ctx.lineWidth = 3;
  for (let x = -400; x < W + 500; x += 110) { ctx.beginPath(); ctx.moveTo(x, -400); ctx.lineTo(x, H + 400); ctx.stroke(); }
  for (let y = -400; y < H + 400; y += 110) { ctx.beginPath(); ctx.moveTo(-400, y); ctx.lineTo(W + 500, y); ctx.stroke(); }
  ctx.fillStyle = rgba(pal.pop, .14);
  const r = rng(7);
  for (let i = 0; i < 9; i++) { const gx = Math.floor(r() * 12) * 110 - 300, gy = Math.floor(r() * 14) * 110 - 200; ctx.fillRect(gx + 8, gy + 8, 94 + (i % 2) * 110, 94); }
  ctx.strokeStyle = major; ctx.lineWidth = 16;
  ctx.beginPath(); ctx.moveTo(-400, 260); ctx.bezierCurveTo(300, 380, 600, 120, W + 500, 420); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(550, -400); ctx.lineTo(450, H + 400); ctx.stroke();
  ctx.restore();
}
function drawRays(ctx, pal, t) {
  const cx = W / 2, cy = H * .42, n = 18, R = Math.hypot(W, H);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * .12);
  ctx.fillStyle = mix(pal.bg, pal.pop, pal.isDark ? .18 : .22);
  for (let i = 0; i < n; i++) {
    const a = i * 2 * Math.PI / n;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a, a + Math.PI / n); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawBackground(ctx, pal, t, sc, keepOut) {
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
  const tpl = state.template;
  if (tpl === 'map') {
    ctx.fillStyle = mix(pal.bg, '#000000', pal.isDark ? 0 : .08); ctx.fillRect(0, 0, W, H);
    drawMapStreets(ctx, pal, t);
  }
  if (tpl === 'rays') drawRays(ctx, pal, t);
  if (tpl === 'todo') { drawNotebook(ctx, pal); return; }
  drawPattern(ctx, pal, t);
  if (tpl === 'ticker') floaters(ctx, pal, t, hashStr(sc.id), 7, .22, keepOut, 110);
  if (tpl === 'sticker') floaters(ctx, pal, t, hashStr(sc.id) + 3, 10, .3, keepOut, 0);
  if (tpl === 'chat') floaters(ctx, pal, t, hashStr(sc.id) + 7, 6, .22, keepOut, 0);
}
function drawNotebook(ctx, pal) {
  const rule = 'rgba(70,130,200,.28)', top = H * .3;
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = rule;
  for (let y = top; y < H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(215,38,61,.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W * .095, 0); ctx.lineTo(W * .095, H); ctx.stroke();
  ctx.fillStyle = mix(pal.bg, '#000000', .12);
  for (const y of [.18, .5, .82]) { ctx.beginPath(); ctx.arc(W * .045, H * y, 17, 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawForeground(ctx, pal, t, content) {
  if (state.template === 'ticker') {
    const txt = fill(state.tickerText, content.tokens).toUpperCase();
    tickerBand(ctx, pal, t, 38, 74, -2, 120, txt);
    tickerBand(ctx, pal, t, H - 34, 74, -2, -120, txt);
  }
}

/* ---------- animation ---------- */
const ANIMS = { none: 'None', fade: 'Fade', up: 'Slide up', left: 'Slide from left', right: 'Slide from right', pop: 'Pop', slam: 'Slam', drop: 'Drop + bounce', wipe: 'Wipe', type: 'Typewriter', spin: 'Spin in' };
const IDLES = { none: 'None', float: 'Float', wiggle: 'Wiggle', pulse: 'Pulse' };
function animDur(L, chars) { return L.anim === 'type' ? clamp(chars * .035, .4, 2.2) : L.anim === 'drop' ? .9 : L.anim === 'slam' ? .5 : .6; }

/* Draws one layer. Returns the hit box {x,y,w,h,cx,cy,rot}. */
function drawLayer(ctx, id, L, pal, t, sc, content, opts) {
  const base0 = LAYER[id];
  if (base0.kind === 'graphic') return drawGraphic(ctx, id, L, pal, t, sc, content, opts);
  // a layout can swap the font (e.g. handwriting on the to-do sticky note) and the text
  const def = L.font ? { ...base0, font: L.font, upper: false, lh: L.lh || base0.lh } : base0;
  let text = L.text != null ? fill(L.text, content.tokens) : textFor(id, sc, content);
  if (!text.trim()) return null;
  if (def.upper) text = text.toUpperCase();

  const ds = displayScale(def);
  let size = L.size * ds;
  ctx.font = fontStr(def, size);
  const style = L.style;
  const padX = style === 'pill' ? size * .6 : style === 'card' ? size * .5 : style === 'bubble' ? size * .62 : 0;
  const padY = style === 'pill' ? size * .3 : style === 'card' ? size * .38 : style === 'bubble' ? size * .42 : 0;
  const hasIcon = style === 'todo' || (L.icon && L.icon !== 'none');
  const iconEnd = style !== 'todo' && (L.icon === 'arrow' || L.align === 'right'); // arrows trail the text, other icons lead it
  const iconW = style === 'todo' ? size * .95 : hasIcon ? size * 1.15 : 0;
  // small field label above the text (ticket fields)
  const capSize = L.caption ? Math.round(clamp(size * .4, 20, 28)) : 0, capH = capSize * 1.5;
  const maxW = L.w * W - padX * 2 - iconW;

  let lines;
  // fit: shrink to keep each line whole (down to fitMin of the set size), then wrap anything still too wide
  const fitMin = L.fitMin ?? (def.fit ? .35 : 0);
  if (fitMin) {
    lines = text.split('\n');
    const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
    if (widest > maxW && style !== 'sticker') { size = Math.max(size * maxW / widest, size * fitMin); ctx.font = fontStr(def, size); }
    if (Math.max(...lines.map(l => ctx.measureText(l).width)) > maxW + 1) lines = wrapLines(ctx, text, maxW);
  } else lines = wrapLines(ctx, text, maxW);

  const lh = size * def.lh;
  const widths = lines.map(l => ctx.measureText(l).width);
  const textW = Math.max(...widths, 1);
  const bw = textW + padX * 2 + iconW, bh = lines.length * lh + padY * 2 + capH;
  // flow: stack under another layer (chat bubbles, to-do items) so wrapped lines push the rest down
  const prev = L.after && opts.boxes && opts.boxes[L.after];
  const ax = L.x * W, ay = prev ? prev.y + prev.h + (L.gap ?? .014) * H : L.y * H;
  let x0 = L.align === 'center' ? ax - bw / 2 : L.align === 'right' ? ax - bw : ax;
  let y0 = ay;
  let cx = x0 + bw / 2, cy = y0 + bh / 2;
  let box = { x: x0, y: y0, w: bw, h: bh, cx, cy, rot: L.rot || 0 };
  if (style === 'sticker') {
    const R = Math.max(textW, lines.length * lh) / 2 + size * .62;
    cx = ax; cy = ay + R;
    box = { x: cx - R, y: cy - R, w: R * 2, h: R * 2, cx, cy, rot: L.rot || 0 };
  } else if (style === 'note') { // square sticky note, centered on x
    const side = Math.max(textW, lines.length * lh) + size * 1.1;
    cx = ax; cy = ay + side / 2;
    box = { x: cx - side / 2, y: ay, w: side, h: side, cx, cy, rot: L.rot || 0 };
  }
  if (opts.measure) return box;
  if (style === 'bubble' && L.anim !== 'none' && t < L.delay) { // "typing…" dots just before a message lands
    if (t > L.delay - .75) typingBubble(ctx, L, x0, y0, bw, size, t, pal);
    return box;
  }

  // animation
  const chars = text.length;
  const dur = animDur(L, chars);
  const e = L.anim === 'none' ? 1 : clamp((t - L.delay) / dur, 0, 1);
  if (L.anim !== 'none' && t < L.delay) return box;
  let alpha = 1, dx = 0, dy = 0, sc2 = 1, rot = (L.rot || 0) * Math.PI / 180, clipW = null, reveal = Infinity;
  switch (L.anim) {
    case 'fade': alpha = ease.outCubic(e); break;
    case 'up': dy = (1 - ease.outCubic(e)) * 110; alpha = clamp(e * 2.5, 0, 1); break;
    case 'left': dx = -(1 - ease.outCubic(e)) * (box.x + box.w + 60); break;
    case 'right': dx = (1 - ease.outCubic(e)) * (W - box.x + 60); break;
    case 'pop': sc2 = ease.outBack(e); break;
    case 'slam': sc2 = 1 + (1 - ease.outCubic(e)) * 1.8; alpha = clamp(e * 2, 0, 1); break;
    case 'drop': dy = -(1 - ease.outBounce(e)) * 700; break;
    case 'wipe': clipW = ease.inOutCubic(e); break;
    case 'type': reveal = Math.floor(e * chars); break;
    case 'spin': rot += (1 - ease.outCubic(e)) * -Math.PI; sc2 = ease.outCubic(e); break;
  }
  if (e >= 1) {
    const tt = t - L.delay - dur, ph = hashStr(id) % 100 / 16;
    if (L.idle === 'float') dy += Math.sin(tt * 2.6 + ph) * 7;
    if (L.idle === 'wiggle') rot += Math.sin(tt * 5.5 + ph) * .05;
    if (L.idle === 'pulse') sc2 *= 1 + Math.sin(tt * 5.2 + ph) * .035;
  }

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(box.cx + dx, box.cy + dy); ctx.rotate(rot); ctx.scale(sc2, sc2); ctx.translate(-box.cx, -box.cy);
  if (clipW != null) { ctx.beginPath(); ctx.rect(box.x - 20, box.y - 40, (box.w + 40) * clipW, box.h + 80); ctx.clip(); }

  const named = { ink: pal.ink, pop: pal.pop, primary: pal.p, secondary: pal.s, accent: pal.a, white: '#FFFFFF', black: '#111111' };
  const surf = L.on === 'card' ? pal.cardFill : pal.bg, surfInk = L.on === 'card' ? pal.cardInk : pal.ink; // what the text sits on
  const pick = L.color && L.color !== 'auto' ? named[L.color] : null;
  let textCol;
  if (style === 'pill') {
    const f = pick || pal.ink; ctx.fillStyle = f; roundRect(ctx, x0, y0, bw, bh, bh / 2); ctx.fill();
    textCol = inkOn(f, [pal.bg, pal.p, pal.s, pal.a]);
  } else if (style === 'card') {
    const f = pick || pal.cardFill;
    ctx.fillStyle = pal.shadow; ctx.fillRect(x0 + 12, y0 + 12, bw, bh);
    ctx.fillStyle = f; ctx.fillRect(x0, y0, bw, bh);
    ctx.lineWidth = 6; ctx.strokeStyle = pal.outline; ctx.strokeRect(x0, y0, bw, bh);
    textCol = inkOn(f, [pal.p, pal.s, pal.a, '#111111']);
  } else if (style === 'sticker') {
    const f = pick || pal.pop, R = box.w / 2;
    starPath(ctx, cx, cy, R, R * .88, 22, t * .2); ctx.fillStyle = f; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = pal.outline; ctx.stroke();
    textCol = inkOn(f, [pal.bg, pal.ink, pal.p, pal.s, pal.a, '#111111']);
  } else if (style === 'note') {
    const f = pick || '#FFE45C';
    drawStickyNote(ctx, box, f);
    textCol = inkOn(f, [pal.p, pal.s, pal.a, '#111111']);
  } else if (style === 'bubble') {
    const f = bubbleFill(L, pal, pick);
    bubblePath(ctx, x0, y0, bw, bh, size, L.align === 'right');
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.save(); ctx.translate(7, 9); ctx.fill(); ctx.restore();
    ctx.fillStyle = f; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = pal.outline; ctx.stroke();
    textCol = inkOn(f, ['#111111', pal.p, pal.s, pal.a]);
  } else if (style === 'highlight') {
    textCol = inkOn(pick || pal.pop, [pal.bg, pal.p, pal.s, pal.a, '#111111']);
  } else textCol = pick && contrast(pick, surf) >= 3 ? pick : surfInk;

  ctx.font = fontStr(def, size);
  ctx.textBaseline = 'alphabetic';
  // optically center each line on its box using real glyph metrics
  const mH = ctx.measureText('H'), mG = ctx.measureText('g');
  const baseOff = (mH.actualBoundingBoxAscent - (def.upper ? 0 : mG.actualBoundingBoxDescent * .5)) / 2;
  const iconCol = style === 'plain' || style === 'outline' ? (contrast(pick || pal.pop, surf) >= 2.5 ? (pick || pal.pop) : surfInk) : textCol;
  if (capSize) {
    ctx.save(); ctx.font = `800 ${capSize}px "${FONT_PRESETS[state.font].body}"`; ctx.textBaseline = 'top';
    if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(capSize * .14) + 'px';
    ctx.textAlign = L.align === 'right' ? 'right' : L.align === 'center' ? 'center' : 'left';
    ctx.fillStyle = iconCol; ctx.globalAlpha *= .9;
    ctx.fillText(L.caption.toUpperCase(), L.align === 'right' ? x0 + bw - padX : L.align === 'center' ? x0 + bw / 2 : x0 + padX, y0 + padY);
    ctx.restore();
  }
  if (style === 'todo') todoMarks(ctx, L, x0, y0 + capH, bw, bh - capH, iconW, lines, widths, lh, size, t, dur, pal, textCol, baseOff);
  else if (hasIcon) {
    const ix = (iconEnd ? x0 + bw - padX - iconW / 2 : x0 + padX + iconW / 2) + (iconEnd ? size * .1 : -size * .08);
    icon(ctx, L.icon, ix, y0 + capH + padY + (L.icon === 'arrow' ? lines.length * lh / 2 : lh / 2), size * 1.0, iconCol);
  }
  let shown = 0;
  lines.forEach((ln, i) => {
    let s = ln;
    if (reveal !== Infinity) { const left = reveal - shown; s = left <= 0 ? '' : ln.slice(0, left); shown += ln.length + 1; }
    const lw = widths[i];
    const innerL = x0 + padX + (iconEnd ? 0 : iconW), innerR = x0 + bw - padX - (iconEnd ? iconW : 0);
    let tx;
    if (style === 'sticker' || style === 'note') { ctx.textAlign = 'center'; tx = cx; }
    else if (L.align === 'center') { ctx.textAlign = 'center'; tx = (innerL + innerR) / 2; }
    else if (L.align === 'right') { ctx.textAlign = 'right'; tx = innerR; }
    else { ctx.textAlign = 'left'; tx = innerL; }
    const ty = style === 'sticker' || style === 'note' ? cy - (lines.length * lh) / 2 + lh * (i + .5) : y0 + capH + padY + lh * (i + .5);
    if (style === 'highlight' && s) {
      const hx = ctx.textAlign === 'center' ? tx - lw / 2 : ctx.textAlign === 'right' ? tx - lw : tx;
      ctx.fillStyle = pick || pal.pop;
      ctx.beginPath();
      const hp = size * .22, hh = lh * .92;
      ctx.moveTo(hx - hp, ty - hh / 2 + 3); ctx.lineTo(hx + lw + hp, ty - hh / 2 - 2); ctx.lineTo(hx + lw + hp - 4, ty + hh / 2); ctx.lineTo(hx - hp + 3, ty + hh / 2 + 2);
      ctx.closePath(); ctx.fill();
    }
    const yAdj = baseOff;
    if (style === 'outline') { ctx.lineWidth = Math.max(2, size * .05); ctx.strokeStyle = textCol; ctx.strokeText(s, tx, ty + yAdj); }
    else { ctx.fillStyle = textCol; ctx.fillText(s, tx, ty + yAdj); }
  });
  ctx.restore();
  return box;
}

// sticky note: lifted shadow, sticky strip along the top, bottom-right corner curling up
function drawStickyNote(ctx, b, f) {
  const { x, y, w, h } = b, c = w * .16;
  const shape = () => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - c); ctx.quadraticCurveTo(x + w - c * .15, y + h - c * .15, x + w - c, y + h); ctx.lineTo(x, y + h); ctx.closePath(); };
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 22; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 14;
  shape(); ctx.fillStyle = f; ctx.fill();
  ctx.restore();
  ctx.save(); shape(); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, mix(f, '#FFFFFF', .25)); g.addColorStop(1, mix(f, '#000000', .04));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect(x, y, w, h * .17); // adhesive strip
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(x + w, y + h - c); ctx.quadraticCurveTo(x + w - c * .55, y + h - c * .7, x + w - c * 1.02, y + h - c * 1.0);
  ctx.quadraticCurveTo(x + w - c * .7, y + h - c * .5, x + w - c, y + h); ctx.quadraticCurveTo(x + w - c * .15, y + h - c * .15, x + w, y + h - c);
  ctx.fillStyle = mix(f, '#000000', .14); ctx.fill();
}
// chat bubble: rounded box with a tail on the sender's side (right = "me")
function bubblePath(ctx, x, y, w, h, size, right) {
  const r = Math.min(size * .75, h / 2), tw = size * .42;
  ctx.save();
  if (!right) { ctx.translate(x * 2 + w, 0); ctx.scale(-1, 1); } // mirror for incoming messages
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r * .7);
  ctx.quadraticCurveTo(x + w, y + h, x + w + tw, y + h + size * .06);
  ctx.quadraticCurveTo(x + w - tw * .4, y + h + size * .1, x + w - r * .9, y + h);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.restore();
}
function bubbleFill(L, pal, pick) {
  if (pick) return pick;
  if (L.align !== 'right') return '#FFFFFF';
  return [pal.pop, pal.p, pal.s, pal.a].find(c => lum(c) < .85 && contrast(c, pal.bg) >= 1.6) || '#2B2D42';
}
function typingBubble(ctx, L, x0, y0, bw, size, t, pal) {
  const w = size * 2.5, h = size * 1.3, x = L.align === 'right' ? x0 + bw - w : x0, f = bubbleFill(L, pal, null);
  ctx.save();
  bubblePath(ctx, x, y0, w, h, size, L.align === 'right');
  ctx.fillStyle = f; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = pal.outline; ctx.stroke();
  ctx.fillStyle = inkOn(f, ['#111111', '#FFFFFF']);
  for (let i = 0; i < 3; i++) {
    const b = Math.max(0, Math.sin(t * 9 - i * .9)) * size * .12;
    ctx.beginPath(); ctx.arc(x + w / 2 + (i - 1) * size * .5, y0 + h / 2 - b, size * .13, 0, 7); ctx.fill();
  }
  ctx.restore();
}
// to-do line: hand-drawn checkbox, then a check + strike-through, or a marker circle around the item
function todoMarks(ctx, L, x0, y0, bw, bh, iconW, lines, widths, lh, size, t, dur, pal, ink, baseOff) {
  const done = L.delay + dur, side = size * .52, bx = x0 + iconW * .4, by = y0 + lh * .5;
  const mark = contrast(pal.pop, pal.bg) >= 2.2 ? pal.pop : '#D7263D';
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = ink; ctx.lineWidth = size * .055;
  ctx.beginPath(); ctx.moveTo(bx - side / 2, by - side / 2 + 2); ctx.lineTo(bx + side / 2, by - side / 2); ctx.lineTo(bx + side / 2 + 2, by + side / 2);
  ctx.lineTo(bx - side / 2 - 1, by + side / 2 + 1); ctx.closePath(); ctx.stroke();
  const textX = x0 + iconW, textW = Math.max(...widths, 1);
  if (L.check === 'check') {
    const p = clamp((t - done - .1) / .35, 0, 1);
    if (p > 0) {
      const pts = [[bx - side * .45, by - side * .02], [bx - side * .05, by + side * .42], [bx + side * .75, by - side * .8]];
      const seg1 = Math.min(1, p / .35), seg2 = clamp((p - .35) / .65, 0, 1);
      ctx.strokeStyle = mark; ctx.lineWidth = size * .1; ctx.beginPath(); ctx.moveTo(...pts[0]);
      ctx.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * seg1, pts[0][1] + (pts[1][1] - pts[0][1]) * seg1);
      if (seg2 > 0) ctx.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * seg2, pts[1][1] + (pts[2][1] - pts[1][1]) * seg2);
      ctx.stroke();
    }
    const sp = clamp((t - done - .45) / .3, 0, 1);
    if (sp > 0) {
      ctx.strokeStyle = ink; ctx.lineWidth = size * .065; ctx.globalAlpha *= .85;
      lines.forEach((ln, i) => { const yy = y0 + lh * (i + .5) + size * .04; ctx.beginPath(); ctx.moveTo(textX - 6, yy + 3); ctx.lineTo(textX + (widths[i] + 12) * sp, yy - 3); ctx.stroke(); });
    }
  } else if (L.check === 'circle') {
    const p = clamp((t - done - .15) / .6, 0, 1);
    if (p > 0) {
      const cx = textX + textW / 2, cy = y0 + bh / 2, rx = textW / 2 + size * .38, ry = bh / 2 + size * .2, a0 = -2.6;
      ctx.strokeStyle = mark; ctx.lineWidth = size * .085; ctx.beginPath();
      for (let k = 0; k <= 60; k++) {
        const a = a0 + p * 2.15 * Math.PI * k / 60, wob = 1 + Math.sin(a * 3 + 1) * .035 + k / 60 * .05;
        const px = cx + Math.cos(a) * rx * wob, py = cy + Math.sin(a) * ry * wob;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// "ADMIT ONE" ticket: main body + stub that tears off at L.tear, revealing what sits underneath
function drawTicket(ctx, L, b, pal, t, sc) {
  const { x, y, w, h } = b, py = y + h * L.stub, r = 30, nr = 30;
  const fill = pal.cardFill, ink = pal.cardInk, accent = contrast(pal.pop, fill) >= 2.5 ? pal.pop : ink;
  // one piece of the ticket: rounded on its outer end, with half-circle notches where it meets the other piece
  const paint = (top, bot, upper) => {
    const shape = () => { ctx.beginPath(); ctx.roundRect(x, top, w, bot - top, upper ? [r, r, 0, 0] : [0, 0, r, r]); };
    ctx.save(); ctx.translate(14, 14); shape(); ctx.fillStyle = pal.shadow; ctx.fill(); ctx.restore();
    shape(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = pal.outline; ctx.stroke();
    for (const [cx, a0, a1] of upper ? [[x, -Math.PI / 2, 0], [x + w, Math.PI, Math.PI * 1.5]] : [[x, 0, Math.PI / 2], [x + w, Math.PI / 2, Math.PI]]) {
      ctx.beginPath(); ctx.moveTo(cx, py); ctx.arc(cx, py, nr, a0, a1); ctx.closePath(); ctx.fillStyle = pal.bg; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, py, nr, a0, a1); ctx.stroke();
    }
  };
  paint(y, py, true);
  // header strip
  const fp = FONT_PRESETS[state.font];
  ctx.save(); ctx.fillStyle = accent; ctx.font = `800 26px "${fp.body}"`; ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.textAlign = 'left'; ctx.fillText('ADMIT ONE', x + 44, y + 42);
  ctx.textAlign = 'right'; ctx.fillText(`${sc.short.toUpperCase()} ★ EARLY VOTING`, x + w - 44, y + 42);
  ctx.fillRect(x + 44, y + 70, w - 88, 4);
  ctx.restore();
  // stub (torn off after L.tear)
  const tt = t - L.tear, p = clamp(tt / .9, 0, 1);
  if (p >= 1) return;
  ctx.save();
  if (p > 0) { ctx.globalAlpha *= 1 - p; ctx.translate(x, py); ctx.rotate(p * .35); ctx.translate(-x, -py + p * p * 420); }
  paint(py, y + h, false);
  ctx.strokeStyle = rgba(ink, .5); ctx.lineWidth = 4; ctx.setLineDash([14, 12]);
  ctx.beginPath(); ctx.moveTo(x + nr + 10, py); ctx.lineTo(x + w - nr - 10, py); ctx.stroke(); ctx.setLineDash([]);
  const sy = py + 34, sh = y + h - py - 68, rnd = rng(hashStr(sc.id));
  ctx.fillStyle = ink;
  for (let bx = x + 50; bx < x + w * .42;) { const bw2 = 3 + Math.floor(rnd() * 4) * 3; ctx.fillRect(bx, sy, bw2, sh); bx += bw2 + 4 + Math.floor(rnd() * 3) * 3; }
  ctx.font = `${fp.dw} ${Math.round(sh * .5 * (fp.scale || 1))}px "${fp.display}"`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = accent; ctx.fillText('TEAR HERE ✂', x + w - 50, sy + sh * .52);
  ctx.font = `800 24px "${fp.body}"`; ctx.fillStyle = ink; ctx.fillText('ONE VOTE · YOURS', x + w - 52, sy + sh * .92);
  ctx.restore();
}

function graphicAnim(L, t) {
  if (L.anim === 'none') return { show: true, e: 1, alpha: 1, dx: 0, dy: 0, s: 1 };
  if (t < L.delay) return { show: false };
  const dur = animDur(L, 0), e = clamp((t - L.delay) / dur, 0, 1);
  const o = { show: true, e, alpha: 1, dx: 0, dy: 0, s: 1, rot: 0 };
  if (L.anim === 'fade') o.alpha = e;
  if (L.anim === 'up') { o.dy = (1 - ease.outCubic(e)) * 110; o.alpha = clamp(e * 2.5, 0, 1); }
  if (L.anim === 'left') o.dx = -(1 - ease.outCubic(e)) * (L.x * W + 300);
  if (L.anim === 'right') o.dx = (1 - ease.outCubic(e)) * (W - L.x * W + 300);
  if (L.anim === 'pop' || L.anim === 'slam' || L.anim === 'wipe' || L.anim === 'type') o.s = ease.outBack(e);
  if (L.anim === 'spin') { o.s = ease.outCubic(e); o.rot = (1 - e) * -Math.PI; }
  if (L.anim === 'drop') o.dy = -(1 - ease.outBounce(e)) * 700;
  if (e >= 1) {
    const tt = t - L.delay - dur;
    if (L.idle === 'float') o.dy += Math.sin(tt * 2.6) * 8;
    if (L.idle === 'pulse') o.s *= 1 + Math.sin(tt * 5.2) * .04;
    if (L.idle === 'wiggle') o.rot = (o.rot || 0) + Math.sin(tt * 5.5) * .06;
  }
  return o;
}

function drawGraphic(ctx, id, L, pal, t, sc, content, opts) {
  const x = L.x * W, y = L.y * H, s = L.size;
  let box;
  if (id === 'ticket') box = { x: x - L.w * W / 2, y, w: L.w * W, h: L.h * H };
  else if (id === 'pin') box = { x: x - s * .45, y: y - s * 1.05, w: s * .9, h: s * 1.1 };
  else if (id === 'campus') { // include the school-name label under the marker
    ctx.save(); ctx.font = `800 ${Math.round(s * .42)}px "${FONT_PRESETS[state.font].body}"`;
    const lw = Math.max(s * 1.8, ctx.measureText(sc.short.toUpperCase()).width + s * .5); ctx.restore();
    const lx = clamp(x, lw / 2 + 16, W - lw / 2 - 16);
    box = { x: lx - lw / 2, y: y - s * .5, w: lw, h: s * 1.6 };
  }
  else box = { x: x - s * .55, y: y - s * .65, w: s * 1.1, h: s * 1.2 };
  box.cx = box.x + box.w / 2; box.cy = box.y + box.h / 2; box.rot = L.rot || 0;
  if (opts.measure) return box;
  const a = graphicAnim(L, t);
  if (!a.show) return box;
  ctx.save(); ctx.globalAlpha *= a.alpha;
  const px = id === 'pin' ? x : box.cx, py = id === 'pin' ? y : box.cy;
  ctx.translate(px + a.dx, py + a.dy); ctx.rotate((L.rot || 0) * Math.PI / 180 + (a.rot || 0)); ctx.scale(a.s, a.s); ctx.translate(-px, -py);

  if (id === 'ticket') drawTicket(ctx, L, box, pal, t, sc);
  else if (id === 'pin') {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 4 - a.dy, s * .22, s * .07, 0, 0, 7); ctx.fill();
    const r = s * .38, cy = y - s * .64;
    ctx.beginPath(); ctx.arc(x, cy, r, Math.PI * .78, Math.PI * .22); ctx.lineTo(x, y); ctx.closePath();
    ctx.fillStyle = pal.pop; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = pal.outline; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, cy, r * .45, 0, 7); ctx.fillStyle = pal.bg; ctx.fill(); ctx.stroke();
    icon(ctx, 'check', x, cy, r * .7, pal.ink);
  } else if (id === 'campus') {
    const cy = y;
    const ph = ((t - L.delay) % 1.6) / 1.6;
    if (t > L.delay) { ctx.beginPath(); ctx.arc(x, cy, s * .25 + ph * s * .7, 0, 7); ctx.strokeStyle = rgba(pal.ink, 1 - ph); ctx.lineWidth = 5; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, cy, s * .25, 0, 7); ctx.fillStyle = pal.ink; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = pal.bg; ctx.stroke();
    const label = (sc.short).toUpperCase();
    const fp = FONT_PRESETS[state.font];
    ctx.font = `800 ${Math.round(s * .42)}px "${fp.body}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lw = ctx.measureText(label).width + s * .5, lh = s * .62;
    const lx = clamp(x, lw / 2 + 16, W - lw / 2 - 16); // keep long names on the canvas
    ctx.fillStyle = pal.ink; roundRect(ctx, lx - lw / 2, cy + s * .42, lw, lh, lh / 2); ctx.fill();
    ctx.fillStyle = inkOn(pal.ink, [pal.bg, pal.p, pal.s, pal.a]); ctx.fillText(label, lx, cy + s * .42 + lh / 2 + 1);
  } else if (id === 'ballot') {
    const bw = s, bh = s * .72, bx = x - bw / 2, by = y - bh / 2 + s * .15;
    const cyc = ((t - L.delay) % 2.2) / 2.2, slide = cyc < .6 ? ease.inOutCubic(cyc / .6) : 1;
    // paper going in
    ctx.save(); ctx.beginPath(); ctx.rect(bx - 40, by - s, bw + 80, s); ctx.clip();
    const pw = s * .5, ph2 = s * .62, ppx = x - pw / 2, ppy = by - ph2 * .9 + slide * ph2;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(ppx, ppy, pw, ph2); ctx.lineWidth = 5; ctx.strokeStyle = pal.outline; ctx.strokeRect(ppx, ppy, pw, ph2);
    icon(ctx, 'check', x, ppy + ph2 * .35, pw * .55, pal.p === '#FFFFFF' ? pal.s : pal.p);
    ctx.restore();
    ctx.fillStyle = pal.shadow === pal.pop ? pal.outline : pal.shadow; ctx.fillRect(bx + 12, by + 12, bw, bh);
    ctx.fillStyle = pal.pop; ctx.fillRect(bx, by, bw, bh); ctx.lineWidth = 6; ctx.strokeStyle = pal.outline; ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = pal.outline; roundRect(ctx, x - s * .3, by + s * .06, s * .6, s * .07, s * .035); ctx.fill();
    const fp = FONT_PRESETS[state.font];
    ctx.font = `${fp.dw} ${Math.round(s * .3 * (fp.scale || 1))}px "${fp.display}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = inkOn(pal.pop, [pal.bg, pal.ink, '#111111']); ctx.fillText('VOTE', x, by + bh * .6);
  }
  ctx.restore();
  return box;
}

function drawRoute(ctx, pal, t, lay) {
  const c = lay.campus, p = lay.pin;
  if (!c.visible || !p.visible) return;
  const x1 = c.x * W, y1 = c.y * H, x2 = p.x * W, y2 = p.y * H - p.size * .1;
  const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 140;
  const start = Math.max(c.delay, p.delay) + .7, prog = clamp((t - start) / 1.3, 0, 1);
  if (prog <= 0) return;
  const pt = u => [(1 - u) ** 2 * x1 + 2 * (1 - u) * u * mx + u * u * x2, (1 - u) ** 2 * y1 + 2 * (1 - u) * u * my + u * u * y2];
  ctx.save(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.setLineDash([2, 22]);
  ctx.lineDashOffset = -t * 30;
  ctx.beginPath();
  const end = ease.inOutCubic(prog);
  for (let u = 0; u <= end; u += .01) { const [x, y] = pt(u); u === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke(); ctx.setLineDash([]);
  if (prog >= 1) { const u = ((t - start - 1.3) % 2.4) / 2.4, [wx, wy] = pt(u); ctx.fillStyle = pal.pop; ctx.beginPath(); ctx.arc(wx, wy, 13, 0, 7); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = pal.outline; ctx.stroke(); }
  ctx.restore();
}

/* ---------- frame render ---------- */
const ORDER = ['ticket', 'campus', 'pin', 'ballot', 'kicker', 'headline', 'dates', 'site', 'chat1', 'chat2', 'chat3', 'chat4', 'todo0', 'todo1', 'todo2', 'todo3', 'address', 'distance', 'hours', 'tap', 'cta', 'footer', 'countdown'];
function renderFrame(ctx, sc, t, opts = {}) {
  const pal = paletteFor(sc), content = contentFor(sc), lay = layout();
  const boxes = {};
  ctx.save();
  const keepOut = [], measured = {};
  if (content) for (const id of ORDER) {
    if (!lay[id].visible) continue;
    ctx.save(); const b = drawLayer(ctx, id, lay[id], pal, t, sc, content, { ...opts, measure: true, boxes: measured }); ctx.restore();
    if (b) { keepOut.push(b); measured[id] = b; }
  }
  if (state.template === 'map' || (lay.campus.visible && lay.pin.visible)) keepOut.push({ x: lay.campus.x * W, y: Math.min(lay.campus.y, lay.pin.y) * H - 200, w: (lay.pin.x - lay.campus.x) * W, h: 260 });
  drawBackground(ctx, pal, t, sc, keepOut);
  if (!content) {
    ctx.fillStyle = pal.ink; ctx.font = '700 40px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No early voting site found for ' + sc.county + ' County', W / 2, H / 2);
    ctx.restore(); return boxes;
  }
  if (state.template === 'map' || (lay.campus.visible && lay.pin.visible)) drawRoute(ctx, pal, t, lay);
  for (const id of ORDER) {
    const L = lay[id];
    if (!L.visible) continue;
    const b = drawLayer(ctx, id, L, pal, t, sc, content, { ...opts, boxes });
    if (b) boxes[id] = b;
  }
  drawForeground(ctx, pal, t, content);
  if (state.confetti && !opts.still) confetti(ctx, pal, t, state.template === 'sticker' ? .55 : state.template === 'ticket' ? lay.ticket.tear + .1 : (lay.headline.delay + .45));
  const D = state.duration;
  if (state.outro === 'fade' && t > D - .45) { ctx.globalAlpha = clamp((t - (D - .45)) / .4, 0, 1); ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  ctx.restore();
  return boxes;
}

/* ---------- editor canvas ---------- */
const adCanvas = $('#ad'), adCtx = adCanvas.getContext('2d');
const ovCanvas = $('#overlay'), ovCtx = ovCanvas.getContext('2d');
let playing = true, t = 0, lastNow = performance.now(), boxes = {}, selected = 'headline', recording = false;
window.evDebug = { boxes: () => boxes }; // read-only hook for layout checks

function drawOverlay() {
  ovCtx.clearRect(0, 0, W, H);
  if (recording) return;
  if (state.guides) {
    ovCtx.save(); ovCtx.strokeStyle = 'rgba(0,255,200,.7)'; ovCtx.setLineDash([10, 8]); ovCtx.lineWidth = 2;
    const m = W * .07; ovCtx.strokeRect(m, m, W - 2 * m, H - 2 * m);
    ovCtx.beginPath(); ovCtx.moveTo(W / 2, 0); ovCtx.lineTo(W / 2, H); ovCtx.stroke();
    // 1:1 center crop (profile grid shows a 3:4 / square crop of feed posts)
    ovCtx.strokeStyle = 'rgba(255,80,200,.7)'; ovCtx.strokeRect(0, (H - W) / 2, W, W);
    ovCtx.fillStyle = 'rgba(255,80,200,.9)'; ovCtx.font = '600 22px sans-serif'; ovCtx.fillText('square grid crop', 12, (H - W) / 2 + 28);
    ovCtx.restore();
  }
  const b = boxes[selected];
  if (b && $('[data-body=layout]').hidden === false || (b && dragging)) {
    ovCtx.save(); ovCtx.translate(b.cx, b.cy); ovCtx.rotate(b.rot * Math.PI / 180);
    ovCtx.strokeStyle = '#ffd23f'; ovCtx.lineWidth = 3; ovCtx.setLineDash([12, 8]);
    ovCtx.strokeRect(-b.w / 2 - 8, -b.h / 2 - 8, b.w + 16, b.h + 16);
    ovCtx.restore();
  }
}
let exporting = false; // batch/fast export in progress: skip the live preview so it doesn't compete
function tick(now) {
  const dt = Math.min(.1, (now - lastNow) / 1000); lastNow = now;
  if (exporting) { requestAnimationFrame(tick); return; }
  if (playing) { t += dt; if (t >= state.duration) t = recording ? state.duration : 0; }
  boxes = renderFrame(adCtx, school(), t);
  drawOverlay();
  if (!scrubbing) $('#scrub').value = Math.round(t / state.duration * 1000);
  $('#timeRead').textContent = `${t.toFixed(1)}s / ${state.duration}s`;
  requestAnimationFrame(tick);
}

/* drag & drop on canvas */
let dragging = null, scrubbing = false;
function canvasPt(ev) { const r = ovCanvas.getBoundingClientRect(); return [(ev.clientX - r.left) * W / r.width, (ev.clientY - r.top) * H / r.height]; }
function hit(px, py) {
  for (let i = ORDER.length - 1; i >= 0; i--) {
    const id = ORDER[i], b = boxes[id]; if (!b) continue;
    const a = -b.rot * Math.PI / 180, dx = px - b.cx, dy = py - b.cy;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= b.w / 2 + 8 && Math.abs(ly) <= b.h / 2 + 8) return id;
  }
  return null;
}
ovCanvas.addEventListener('pointerdown', ev => {
  const [px, py] = canvasPt(ev), id = hit(px, py);
  if (!id) return;
  selected = id; detach(id); const L = layout()[id];
  dragging = { id, ox: px - L.x * W, oy: py - L.y * H };
  ovCanvas.setPointerCapture(ev.pointerId);
  showTab('layout'); renderLayerList(); renderLayerProps();
});
ovCanvas.addEventListener('pointermove', ev => {
  const [px, py] = canvasPt(ev);
  if (!dragging) { ovCanvas.style.cursor = hit(px, py) ? 'move' : 'default'; return; }
  const L = layout()[dragging.id];
  let nx = (px - dragging.ox) / W, ny = (py - dragging.oy) / H;
  if (!ev.altKey) for (const s of [.07, .5, .93]) if (Math.abs(nx - s) < .012) nx = s;
  L.x = +clamp(nx, -.2, 1.2).toFixed(4); L.y = +clamp(ny, -.2, 1.2).toFixed(4);
  syncPropInputs(); save();
});
ovCanvas.addEventListener('pointerup', () => { dragging = null; });
document.addEventListener('keydown', ev => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (ev.code === 'Space') { ev.preventDefault(); togglePlay(); return; }
  const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
  if (k && selected) {
    ev.preventDefault(); detach(selected); const L = layout()[selected], step = ev.shiftKey ? 20 : 2;
    L.x = +(L.x + k[0] * step / W).toFixed(4); L.y = +(L.y + k[1] * step / H).toFixed(4); syncPropInputs(); save();
  }
});

/* transport */
function togglePlay() { playing = !playing; $('#playBtn').textContent = playing ? '❚❚' : '▶'; }
$('#playBtn').onclick = togglePlay;
$('#scrub').addEventListener('input', e => { scrubbing = true; t = e.target.value / 1000 * state.duration; });
$('#scrub').addEventListener('change', () => { scrubbing = false; });
$('#scrub').addEventListener('pointerdown', () => { if (playing) togglePlay(); });

/* ---------- UI: schools ---------- */
function visibleSchools() {
  const q = state.search.trim().toLowerCase();
  return SCHOOLS.filter(s => (state.filter === 'all' || s.type === state.filter || (state.filter === 'public' && s.type === 'hbcu' && ['ecsu','fsu','ncat','nccu','wssu'].includes(s.id)))
    && (!q || (s.name + ' ' + s.short + ' ' + s.city).toLowerCase().includes(q)));
}
function swatchHTML(c) { return `<span class="swatch"><i style="background:${c[0]}"></i><i style="background:${c[1]}"></i></span>`; }
function renderSchoolList() {
  const ul = $('#schoolList'); ul.innerHTML = '';
  for (const s of visibleSchools()) {
    const c = chosen(s), cols = (state.overrides[s.id] || {}).colors || s.colors;
    const li = document.createElement('li');
    const on = c && c.onCampus && c.d < 1.2;
    li.innerHTML = `<button class="${s.id === state.schoolId ? 'active' : ''}">${swatchHTML(cols)}<span class="sname">${s.short}<span class="ssub">${c ? esc(siteName(s, c.site)) : 'no site'}</span></span><span class="dist ${on ? 'on' : ''}">${c ? (on ? 'on campus' : c.d.toFixed(1) + 'mi') : ''}</span></button>`;
    li.firstChild.onclick = () => selectSchool(s.id);
    ul.appendChild(li);
  }
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function selectSchool(id) {
  state.schoolId = id; save(); t = Math.min(t, state.duration);
  renderSchoolList(); renderContentTab(); renderSiteNote();
}
$('#search').addEventListener('input', e => { state.search = e.target.value; renderSchoolList(); refreshAltViews(); });
$$('#filters .chip').forEach(b => b.onclick = () => {
  state.filter = b.dataset.f; $$('#filters .chip').forEach(x => x.classList.toggle('active', x === b)); save(); renderSchoolList(); refreshAltViews();
});

function renderSiteNote() {
  const sc = school(), content = contentFor(sc);
  if (!content) { $('#siteNote').textContent = 'No site in this county.'; return; }
  const { site, c } = content;
  const flags = [];
  if (site.geo !== 'census') flags.push('map position approximate');
  if (!c.onCampus && c.d > 3) flags.push('nearest site is over 3 mi away');
  $('#siteNote').innerHTML = `<b>${esc(sc.name)}</b> → <b>${esc(siteName(sc, site))}</b>${site.id === sc.pdfSite ? ' (from school flyer)' : ''}, ${esc(titleStreet(site.street))}, ${esc(site.city)} (${esc(site.county)} Co.) · ${c.d.toFixed(2)} mi` +
    (flags.length ? ` · <span class="warn">⚠ ${flags.join('; ')}</span>` : '') +
    `<br>Source: ${esc(META.source)}, retrieved ${META.retrieved}. Check with the county board before posting.`;
}

/* ---------- UI: content tab ---------- */
function renderContentTab() {
  const sc = school(), ov = state.overrides[sc.id] || {};
  $('#schoolTitle').textContent = sc.name;
  const sel = $('#siteSelect'); sel.innerHTML = '';
  candidates(sc).forEach((c, i) => {
    const o = document.createElement('option'); o.value = c.site.id;
    o.textContent = `${c.onCampus ? '★ ' : ''}${siteName(sc, c.site)} — ${c.d.toFixed(1)} mi${c.site.id === sc.pdfSite ? ' (school flyer)' : i === 0 ? ' (default)' : ''}`;
    sel.appendChild(o);
  });
  sel.value = chosen(sc) ? chosen(sc).site.id : '';
  $('#siteLabel').value = ov.siteLabel || '';
  $('#siteLabel').placeholder = chosen(sc) ? siteName(sc, chosen(sc).site) : '';
  $('#schoolHeadline').value = ov.headline || '';
  $('#idStatus').value = ov.idOk == null ? 'default' : ov.idOk ? 'yes' : 'no';
  $('#idStatus').options[0].textContent = `From the State Board list: ${sc.idOk ? 'approved' : 'not confirmed'}`;
  $('#idCard').value = ov.idCard || ''; $('#idCard').placeholder = sc.idCard || sc.short + ' student ID';
  const cols = ov.colors || sc.colors;
  ['c0', 'c1', 'c2'].forEach((id, i) => $('#' + id).value = cols[i]);
}
function ovr() { const id = state.schoolId; return (state.overrides[id] = state.overrides[id] || {}); }
$('#siteSelect').onchange = e => { ovr().siteId = +e.target.value; save(); renderSchoolList(); renderSiteNote(); };
$('#siteLabel').oninput = e => { ovr().siteLabel = e.target.value; save(); };
$('#schoolHeadline').oninput = e => { ovr().headline = e.target.value; save(); };
$('#idStatus').onchange = e => { const v = e.target.value; if (v === 'default') delete ovr().idOk; else ovr().idOk = v === 'yes'; save(); refreshAltViews(); };
$('#idCard').oninput = e => { ovr().idCard = e.target.value; save(); };
['c0', 'c1', 'c2'].forEach((id, i) => $('#' + id).oninput = e => {
  const o = ovr(); o.colors = (o.colors || school().colors).slice(); o.colors[i] = e.target.value.toUpperCase(); save(); renderSchoolList();
});
$('#resetColors').onclick = () => { delete ovr().colors; save(); renderContentTab(); renderSchoolList(); };

function renderTextFields() {
  const box = $('#textFields'); box.innerHTML = '';
  for (const l of LAYERS.filter(l => l.kind === 'text' && inTemplate(l.id))) {
    const lab = document.createElement('label');
    lab.innerHTML = `${l.label}${l.only ? ` <span class="hint">(${TEMPLATES[l.only].name})</span>` : ''}<textarea rows="${l.id === 'headline' || l.id === 'footer' ? 3 : 1}"></textarea>`;
    const ta = lab.querySelector('textarea'); ta.value = state.texts[l.id];
    ta.oninput = () => { state.texts[l.id] = ta.value; save(); };
    box.appendChild(lab);
  }
  $('#tokenList').innerHTML = TOKENS.map(([k, d]) => `<li><code>${k}</code> ${d}</li>`).join('');
}
$('#hoursMode').onchange = e => { state.hoursMode = e.target.value; save(); };
$('#asOf').onchange = e => { state.asOf = e.target.value || todayISO(); save(); };

/* ---------- UI: layout tab ---------- */
const inTemplate = id => !LAYER[id].only || LAYER[id].only === state.template;
// a stacked layer (chat bubble, to-do item) becomes free-standing once it is moved by hand
function detach(id) { const L = layout()[id]; if (L.after && boxes[id]) { L.y = +(boxes[id].y / H).toFixed(4); delete L.after; } }
function renderLayerList() {
  const ul = $('#layerList'); ul.innerHTML = '';
  for (const id of [...ORDER].reverse().filter(inTemplate)) {
    const L = layout()[id], li = document.createElement('li');
    li.className = (id === selected ? 'active ' : '') + (L.visible ? '' : 'hidden-layer');
    li.innerHTML = `<button class="eye" title="Show / hide">${L.visible ? '👁' : '—'}</button><span>${LAYER[id].label}</span>`;
    li.onclick = () => { selected = id; renderLayerList(); renderLayerProps(); };
    li.querySelector('.eye').onclick = ev => { ev.stopPropagation(); L.visible = !L.visible; save(); renderLayerList(); };
    ul.appendChild(li);
  }
}
const STYLE_OPTS = { plain: 'Plain', pill: 'Pill', card: 'Card', highlight: 'Highlighter', sticker: 'Sticker', outline: 'Outline', bubble: 'Chat bubble', todo: 'To-do line', note: 'Sticky note' };
const COLOR_OPTS = { auto: 'Auto', ink: 'Ink', pop: 'Pop', primary: 'Primary', secondary: 'Secondary', accent: 'Accent', white: 'White', black: 'Black' };
const ICON_OPTS = { none: 'None', pin: 'Pin', clock: 'Clock', cal: 'Calendar', check: 'Check', star: 'Star', arrow: 'Arrow' };
function selectHTML(key, opts, val) { return `<select data-k="${key}">${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${v}</option>`).join('')}</select>`; }
function renderLayerProps() {
  const box = $('#layerProps'), L = layout()[selected], def = LAYER[selected];
  if (!L) { box.innerHTML = ''; return; }
  const range = (k, label, min, max, step, fmt = v => v) =>
    `<div class="prop">${label}<input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${L[k]}"><output data-o="${k}">${fmt(L[k])}</output></div>`;
  let h = `<h3>${def.label}</h3>`;
  h += range('x', 'X', -.1, 1.1, .001, v => (+v).toFixed(2)) + range('y', 'Y', -.1, 1.1, .001, v => (+v).toFixed(2));
  h += range('size', 'Size', 10, 300, 1);
  if (def.kind === 'text') {
    h += range('w', 'Max width', .15, 1, .01, v => (+v).toFixed(2));
    h += `<div class="prop">Align<div class="align-btns">${['left', 'center', 'right'].map(a => `<button data-align="${a}" class="${L.align === a ? 'active' : ''}">${a}</button>`).join('')}</div></div>`;
    h += `<div class="prop">Style${selectHTML('style', STYLE_OPTS, L.style)}</div>`;
    h += `<div class="prop">Color${selectHTML('color', COLOR_OPTS, L.color)}</div>`;
    h += `<div class="prop">Icon${selectHTML('icon', ICON_OPTS, L.icon)}</div>`;
  }
  h += range('rot', 'Rotate', -30, 30, .5, v => v + '°');
  h += `<div class="prop">Entrance${selectHTML('anim', ANIMS, L.anim)}</div>`;
  h += range('delay', 'Starts at', 0, 8, .05, v => (+v).toFixed(2) + 's');
  h += `<div class="prop">Loop motion${selectHTML('idle', IDLES, L.idle)}</div>`;
  box.innerHTML = h;
  $$('input[type=range]', box).forEach(inp => inp.oninput = () => {
    if (inp.dataset.k === 'y') detach(selected);
    L[inp.dataset.k] = +inp.value; $(`[data-o=${inp.dataset.k}]`, box).textContent = inp.dataset.k === 'rot' ? inp.value + '°' : (+inp.value).toFixed(['size'].includes(inp.dataset.k) ? 0 : 2) + (inp.dataset.k === 'delay' ? 's' : '');
    if (inp.dataset.k === 'delay') t = Math.max(t, 0); save();
  });
  $$('select', box).forEach(s => s.onchange = () => { L[s.dataset.k] = s.value; save(); if (s.dataset.k === 'anim' || s.dataset.k === 'idle') replayFrom(L.delay); });
  $$('[data-align]', box).forEach(b => b.onclick = () => { L.align = b.dataset.align; save(); renderLayerProps(); });
}
function syncPropInputs() {
  const L = layout()[selected], box = $('#layerProps');
  for (const k of ['x', 'y']) {
    const inp = $(`input[data-k=${k}]`, box); if (inp) { inp.value = L[k]; $(`[data-o=${k}]`, box).textContent = L[k].toFixed(2); }
  }
}
function replayFrom(s) { t = Math.max(0, s - .3); if (!playing) togglePlay(); }
$('#resetLayout').onclick = () => {
  if (!confirm(`Reset the ${TEMPLATES[state.template].name} (${VARIANTS[state.variant]}) layout to its defaults?`)) return;
  state.layouts[layoutKey()] = defaultLayout(layoutKey()); save(); renderLayerList(); renderLayerProps();
};

/* ---------- UI: style tab ---------- */
function renderStyleTab() {
  $('#templatePick').innerHTML = Object.entries(TEMPLATES).map(([k, v]) =>
    `<button data-tpl="${k}" class="${k === state.template ? 'active' : ''}"><b>${v.name}</b><span>${v.desc}</span></button>`).join('');
  $$('#templatePick button').forEach(b => b.onclick = () => {
    state.template = b.dataset.tpl; if (!inTemplate(selected)) selected = 'headline';
    save(); renderStyleTab(); renderLayerList(); renderLayerProps(); renderTextFields(); t = 0; refreshAltViews();
  });
  $('#fontPreset').innerHTML = Object.entries(FONT_PRESETS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  $('#fontPreset').value = state.font;
  $('#colorMode').value = state.colorMode;
  $('#pattern').value = state.pattern;
  $('#tickerText').value = state.tickerText;
  $('#duration').value = state.duration;
  $('#outro').value = state.outro;
  $('#confetti').checked = state.confetti;
  $('#guides').checked = state.guides;
  $('#hoursMode').value = state.hoursMode;
  $('#asOf').value = state.asOf;
}
$('#fontPreset').onchange = e => { state.font = e.target.value; save(); refreshAltViews(); };
$('#colorMode').onchange = e => { state.colorMode = e.target.value; save(); refreshAltViews(); };
$('#pattern').onchange = e => { state.pattern = e.target.value; save(); refreshAltViews(); };
$('#tickerText').oninput = e => { state.tickerText = e.target.value; save(); };
$('#duration').onchange = e => { state.duration = clamp(+e.target.value || 9, 4, 30); e.target.value = state.duration; save(); };
$('#outro').onchange = e => { state.outro = e.target.value; save(); };
$('#confetti').onchange = e => { state.confetti = e.target.checked; save(); };
$('#guides').onchange = e => { state.guides = e.target.checked; save(); };

/* tabs */
function showTab(name) {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab-body').forEach(b => b.hidden = b.dataset.body !== name);
}
$$('.tab').forEach(b => b.onclick = () => showTab(b.dataset.tab));

/* ---------- views: grid + data table ---------- */
let view = 'single';
const offscreen = document.createElement('canvas'); offscreen.width = W; offscreen.height = H;
const offCtx = offscreen.getContext('2d');
function renderGrid() {
  const grid = $('#adGrid'); grid.innerHTML = '';
  const gt = clamp(+$('#gridTime').value || 4, 0, state.duration - .01);
  for (const s of visibleSchools()) {
    const card = document.createElement('button'); card.className = 'ad-card';
    const cv = document.createElement('canvas'); cv.width = 432; cv.height = 540;
    renderFrame(offCtx, s, gt);
    cv.getContext('2d').drawImage(offscreen, 0, 0, 432, 540);
    const c = chosen(s);
    card.appendChild(cv);
    const info = document.createElement('div');
    info.innerHTML = `<b>${esc(s.short)}</b><span>${c ? esc(siteName(s, c.site)) + ' · ' + c.d.toFixed(1) + ' mi' : 'no site'}</span>`;
    card.appendChild(info);
    card.onclick = () => { selectSchool(s.id); setView('single'); };
    grid.appendChild(card);
  }
}
function renderTable() {
  const rows = visibleSchools().map(s => {
    const c = chosen(s); if (!c) return `<tr><td>${esc(s.name)}</td><td colspan="6">No site found</td></tr>`;
    const flags = [];
    if (c.site.geo !== 'census') flags.push('approx. map position');
    if (!c.onCampus && c.d > 3) flags.push('>3 mi');
    if (c.onCampus && c.d >= 1.2) flags.push('campus-run site, but >1.2 mi from the campus point');
    const sch = scheduleInfo(c.site);
    return `<tr><td><b>${esc(s.short)}</b><br><span class="muted">${esc(s.county)} Co.</span></td><td>${c.onCampus ? '★ ' : ''}${esc(siteName(s, c.site))}${c.site.id === s.pdfSite ? ' <span class="muted">(school flyer' + (s.pdfLabel !== c.site.nice ? '; official: ' + esc(c.site.nice) : '') + ')</span>' : ''}<br><span class="muted">${esc(titleStreet(c.site.street))}, ${esc(c.site.city)} ${c.site.zip}</span></td>
      <td class="num">${c.d.toFixed(2)} mi</td><td class="num">${fmtDay(sch.first)}–${fmtDay(sch.last)}</td><td>${sch.compact.map(esc).join('<br>')}</td>
      <td>${s.colors.map(x => `<span class="swatch" style="display:inline-grid;width:18px;height:18px;vertical-align:middle;background:${x}"></span>`).join(' ')}</td>
      <td>${idApproved(s) ? '✓ ' + esc((state.overrides[s.id] || {}).idCard || s.idCard || 'student ID') : '<span class="muted">not confirmed: ads skip student IDs</span>'}</td>
      <td class="warn">${flags.length ? '⚠ ' + flags.join('; ') : ''}</td></tr>`;
  }).join('');
  $('#dataTable').innerHTML = `<thead><tr><th>School</th><th>Early voting site</th><th>Distance</th><th>Dates</th><th>Hours</th><th>Colors</th><th>Student ID for voting</th><th>Check</th></tr></thead><tbody>${rows}</tbody>`;
}
function setView(v) {
  view = v;
  $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('#stageSingle').hidden = v !== 'single'; $('#stageGrid').hidden = v !== 'grid'; $('#stageTable').hidden = v !== 'table';
  refreshAltViews();
}
function refreshAltViews() { if (view === 'grid') renderGrid(); if (view === 'table') renderTable(); }
$$('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
function renderVariant() { $$('[data-variant]').forEach(b => b.classList.toggle('active', b.dataset.variant === state.variant)); }
$$('[data-variant]').forEach(b => b.onclick = () => {
  state.variant = b.dataset.variant; save(); renderVariant(); renderLayerList(); renderLayerProps(); t = 0; refreshAltViews();
});
$('#gridTime').onchange = () => renderGrid();

/* ---------- export ---------- */
function pickMime() {
  // a bare 'video/mp4' can mean VP9-in-MP4 (e.g. Chromium without H.264), so it ranks after the avc1 types
  const types = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return window.MediaRecorder ? types.find(x => MediaRecorder.isTypeSupported(x)) : null;
}
const MIME = pickMime();

/* Fast video: render each frame off-screen and encode with WebCodecs (much faster than real time).
   H.264 where the browser has it, VP9 otherwise; MediaRecorder screen recording is the last resort. */
const FPS = 30;
const FAST_CODECS = [
  { mux: 'avc', codec: 'avc1.640028' }, { mux: 'avc', codec: 'avc1.4d0028' }, { mux: 'avc', codec: 'avc1.42e028' },
  { mux: 'vp9', codec: 'vp09.00.40.08' },
];
// every encoder config this browser says it supports, best first; one that fails in practice is dropped
const fastCodecs = (async () => {
  const ok = [];
  if (!window.VideoEncoder || !window.Mp4Muxer) return ok;
  for (const c of FAST_CODECS) {
    const config = { codec: c.codec, width: W, height: H, bitrate: 10e6, framerate: FPS, ...(c.mux === 'avc' ? { avc: { format: 'avc' } } : {}) };
    try { if ((await VideoEncoder.isConfigSupported(config)).supported) ok.push({ ...c, config }); } catch {}
  }
  return ok;
})();
const fastCodec = fastCodecs.then(l => l[0] || null);
let lastVideoNote = '';
// yield without setTimeout, which background tabs throttle
const yieldNow = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
// prep() runs before every frame so several encodes can interleave (each sets its own school/design)
async function encodeVideo(sc, onFrame, prep, fc) {
  const n = Math.round(state.duration * FPS);
  const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: fc.mux, width: W, height: H, frameRate: FPS }, fastStart: 'in-memory' });
  let failure = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; } });
  enc.configure(fc.config);
  for (let i = 0; i < n; i++) {
    if (failure) throw failure;
    if (prep) prep();
    renderFrame(offCtx, sc, i / FPS);
    const frame = new VideoFrame(offscreen, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
    enc.encode(frame, { keyFrame: i % (FPS * 2) === 0 }); frame.close();
    while (enc.encodeQueueSize > 6) await yieldNow();
    if (i % 15 === 0) { onFrame && onFrame(i / n); await yieldNow(); }
  }
  await enc.flush(); enc.close();
  if (failure) throw failure;
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  if (blob.size < 20000) throw new Error(`the ${fc.codec} encoder produced an empty file`);
  return blob;
}
// try each working encoder in turn; drop one that fails so later videos skip it
async function encodeVideoSafe(sc, onFrame, prep) {
  const list = await fastCodecs;
  while (list.length) {
    try { return await encodeVideo(sc, onFrame, prep, list[0]); }
    catch (e) {
      console.warn('Video encoder failed, trying the next one:', list[0].codec, e);
      lastVideoNote = `${list[0].codec} failed (${e.message || e}); `;
      list.shift(); fastReady = list[0] || null; updateFormatNote();
    }
  }
  throw new Error(lastVideoNote + 'no video encoder worked in this browser.');
}
// one video for a school in the current design: fast path if available, else real-time recording
async function makeVideo(sc, onFrame) {
  if ((await fastCodecs).length) { try { return await encodeVideoSafe(sc, onFrame); } catch (e) { if (!MIME) throw e; } }
  exporting = false; // real-time recording needs the live preview running
  return recordCurrent(); // last resort
}
function updateFormatNote() {
  const fc = fastReady;
  if (fc) $('#formatNote').textContent = fc.mux === 'avc'
    ? 'Exports MP4 (H.264) at 1080×1350, ready for Instagram, rendered faster than real time.'
    : 'Exports MP4 (VP9) faster than real time. This browser has no working H.264 encoder; if Instagram rejects the file, export in Chrome.';
  else if (MIME) $('#formatNote').textContent = 'Records video in real time (keep this tab in front).';
  if (lastVideoNote) $('#formatNote').textContent += ' Note: ' + lastVideoNote;
}
fastCodec.then(fc => { fastReady = fc; updateFormatNote(); bxSummary(); });
$('#formatNote').textContent = !MIME ? 'This browser cannot record video. Try Chrome.'
  : MIME.includes('avc1') ? 'Records MP4 (H.264) in real time at 1080×1350, ready for Instagram.'
  : MIME.startsWith('video/mp4') ? 'Records MP4, but this browser may not use H.264. If Instagram rejects the file, record in Chrome or convert it (e.g. HandBrake).'
  : 'This browser records WebM. Instagram needs MP4: use Chrome or Safari, or convert the file (e.g. HandBrake).';
function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
function fileBase(sc) { return `early-vote_${sc.id}_${designSlug(layoutKey())}`; }
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 120000);
}
function recordCurrent() {
  return new Promise((resolve, reject) => {
    if (!MIME) return reject(new Error('Recording not supported'));
    const stream = adCanvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: MIME, videoBitsPerSecond: 12e6 });
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => { stream.getTracks().forEach(tr => tr.stop()); resolve(new Blob(chunks, { type: MIME.split(';')[0] })); };
    recording = true; $('#recBadge').hidden = false;
    t = 0; if (!playing) togglePlay();
    lastNow = performance.now();
    rec.start(250);
    setTimeout(() => { rec.stop(); recording = false; $('#recBadge').hidden = true; t = 0; }, state.duration * 1000 + 150);
  });
}
function setBusy(b) { $$('#exportVideo,#exportPng,#bxStart,#bxThisSchool,#bxThisDesign').forEach(x => x.disabled = b); if (!b) bxSummary(); }
let fastReady = null; fastCodec.then(fc => { fastReady = fc; });
const ext = () => fastReady || (MIME && MIME.startsWith('video/mp4')) ? 'mp4' : 'webm';
$('#exportVideo').onclick = async () => {
  setView('single'); setBusy(true);
  try {
    const fast = await fastCodec; if (fast) { exporting = true; progress(0, 1, 'Rendering video…'); }
    const blob = await makeVideo(school(), f => progress(f, 1, `Rendering video… ${Math.round(f * 100)}%`));
    download(blob, `${fileBase(school())}.${ext()}`); progress(1, 1, 'Done ✓');
  } catch (e) { progress(0, 1, 'Video export failed: ' + (e.message || e)); alert('Video export failed: ' + (e.message || e)); }
  exporting = false;
  setBusy(false);
};
// stills use the paused playhead; while playing, a frame after every entrance and before the fade
const stillTime = () => playing ? state.duration * .6 : t;
$('#exportPng').onclick = () => {
  const sc = school(), at = stillTime(); renderFrame(offCtx, sc, at, { still: playing });
  offscreen.toBlob(b => download(b, `${fileBase(sc)}_${at.toFixed(1)}s.png`), 'image/png');
};
function progress(i, n, label) {
  const p = $('#batchProgress'); p.hidden = false;
  p.firstElementChild.style.width = (i / n * 100) + '%'; p.lastElementChild.textContent = label;
}
/* ---------- batch export: any schools × any designs ---------- */
const designLabel = k => `${TEMPLATES[k.split(':')[0]].name} · ${k.endsWith(':cta') ? 'CTA' : 'Full'}`;
const designSlug = k => k.replace(':', '-');
let bxCancel = false, secsPerVideo = 3; // updated from real encode times
function bxSel() { state.batch = state.batch || { schools: [state.schoolId], designs: [layoutKey()] }; return state.batch; }
function renderBatch() {
  const sel = bxSel();
  $('#bxSchools').innerHTML = SCHOOLS.map(sc => `<label><input type="checkbox" data-bx-school="${sc.id}" ${sel.schools.includes(sc.id) ? 'checked' : ''}>${esc(sc.short)}</label>`).join('');
  $('#bxDesigns').innerHTML = '<tr><th>Template</th><th>Full details</th><th>Call to action</th></tr>' + Object.entries(TEMPLATES).map(([k, v]) =>
    `<tr><td>${v.name}</td>${[k, k + ':cta'].map(d => `<td><label><input type="checkbox" data-bx-design="${d}" ${sel.designs.includes(d) ? 'checked' : ''}></label></td>`).join('')}</tr>`).join('');
  $$('[data-bx-school]').forEach(cb => cb.onchange = () => { toggleIn(sel.schools, cb.dataset.bxSchool, cb.checked); bxSummary(); });
  $$('[data-bx-design]').forEach(cb => cb.onchange = () => { toggleIn(sel.designs, cb.dataset.bxDesign, cb.checked); bxSummary(); });
  bxSummary();
}
function toggleIn(arr, v, on) { const i = arr.indexOf(v); if (on && i < 0) arr.push(v); if (!on && i >= 0) arr.splice(i, 1); save(); }
function bxJobs() {
  const sel = bxSel(), schools = SCHOOLS.filter(sc => sel.schools.includes(sc.id) && chosen(sc)), designs = LAYOUT_KEYS.filter(k => sel.designs.includes(k));
  return schools.flatMap(sc => designs.map(d => ({ sc, d })));
}
function bxSummary() {
  const sel = bxSel(), n = bxJobs().length, video = $('#bxFormat').value === 'video';
  $('#bxSchoolCount').textContent = `${sel.schools.length} of ${SCHOOLS.length}`;
  $('#bxDesignCount').textContent = `${sel.designs.length} of ${LAYOUT_KEYS.length}`;
  const perVideo = fastReady ? secsPerVideo : state.duration + .7;
  const secs = n * (video ? perVideo : .12), mb = n * (video ? state.duration * .7 : .6);
  const time = secs < 90 ? `${Math.max(1, Math.round(secs))} sec` : `${Math.round(secs / 60)} min`;
  const big = $('#bxZip').checked && mb > 1500;
  $('#bxSummary').innerHTML = !n ? 'Pick at least one school and one design.'
    : `<b>${n} file${n === 1 ? '' : 's'}</b> · about ${time}${video && !fastReady ? ' (videos record in real time; keep this tab in front)' : ''} · ~${mb >= 1000 ? (mb / 1000).toFixed(1) + ' GB' : Math.round(mb) + ' MB'}` +
      (big ? '<br><span class="warn">That ZIP would be very large. Uncheck “Bundle” to download files one by one, or export in smaller batches.</span>' : '');
  $('#bxStart').disabled = !n || big;
  $('#bxGroup').disabled = !$('#bxZip').checked;
}
$$('[data-bx-s]').forEach(b => b.onclick = () => {
  const sel = bxSel(), m = b.dataset.bxS;
  sel.schools = m === 'all' ? SCHOOLS.map(s => s.id) : m === 'listed' ? visibleSchools().map(s => s.id) : [];
  save(); renderBatch();
});
$$('[data-bx-d]').forEach(b => b.onclick = () => {
  const sel = bxSel(), m = b.dataset.bxD;
  sel.designs = LAYOUT_KEYS.filter(k => m === 'all' || (m === 'cta' && k.endsWith(':cta')) || (m === 'full' && !k.endsWith(':cta')));
  save(); renderBatch();
});
$('#bxThisSchool').onclick = () => { const sel = bxSel(); sel.schools = [state.schoolId]; sel.designs = [...LAYOUT_KEYS]; save(); renderBatch(); };
$('#bxThisDesign').onclick = () => { const sel = bxSel(); sel.schools = SCHOOLS.map(s => s.id); sel.designs = [layoutKey()]; save(); renderBatch(); };
['#bxFormat', '#bxZip'].forEach(id => $(id).onchange = bxSummary);
$('#bxCancel').onclick = () => { bxCancel = true; $('#bxCancel').textContent = 'Stopping…'; };
$('#bxStart').onclick = async () => {
  const jobs = bxJobs(), video = $('#bxFormat').value === 'video', zip = $('#bxZip').checked, group = $('#bxGroup').value;
  if (!jobs.length) return;
  const fast = video && await fastCodec;
  if (video && !fast && !MIME) { alert('This browser cannot export video. Try Chrome.'); return; }
  const est = Math.ceil(jobs.length * (fast ? secsPerVideo : state.duration + .7) / 60);
  if (video && jobs.length > 3 && !confirm(`Export ${jobs.length} videos? This takes about ${est} min.${fast ? '' : ' Keep this tab in front while it runs.'}`)) return;
  const keep = { schoolId: state.schoolId, template: state.template, variant: state.variant }, files = [], ex = video ? ext() : 'png';
  const pathFor = (sc, d) => { const name = `early-vote_${sc.id}_${designSlug(d)}.${ex}`; return { name, path: group === 'school' ? `${sc.id}/${name}` : group === 'design' ? `${designSlug(d)}/${name}` : name }; };
  const deliver = async (sc, d, blob) => { const { name, path } = pathFor(sc, d); if (zip) files.push({ path, blob }); else { download(blob, name); await new Promise(r => setTimeout(r, 350)); } };
  bxCancel = false; setBusy(true); $('#bxCancel').hidden = false; $('#bxCancel').textContent = 'Stop after this file';
  exporting = !video || !!fast; // the live preview is only needed for real-time recording
  if (video && !fast) setView('single');
  const started = performance.now();
  try {
    const pending = []; // stills: PNG encoding runs in the background while the next frame renders
    for (let i = 0; i < jobs.length && !bxCancel; i++) {
      const { sc, d } = jobs[i], [tpl, v] = d.split(':');
      state.schoolId = sc.id; state.template = tpl; state.variant = v ? 'cta' : 'full';
      const label = `${sc.short} · ${designLabel(d)} (${i + 1}/${jobs.length})`;
      if (!video) {
        progress(i, jobs.length, `Rendering ${label}`);
        renderFrame(offCtx, sc, state.duration * .6, { still: true });
        pending.push(new Promise(r => offscreen.toBlob(r, 'image/png')).then(blob => deliver(sc, d, blob)));
        if (pending.length >= 6) await pending.shift();
        if (i % 4 === 3) await yieldNow();
      } else if (fast) {
        // up to 3 encodes at once: the encoders run on their own threads, frames are drawn in turn
        const lanes = Math.min(3, jobs.length), done = new Array(jobs.length).fill(0), t0 = performance.now();
        let next = 0, finished = 0;
        const lane = async () => {
          while (next < jobs.length && !bxCancel) {
            const k = next++, job = jobs[k], [jt, jv] = job.d.split(':');
            const prep = () => { state.schoolId = job.sc.id; state.template = jt; state.variant = jv ? 'cta' : 'full'; };
            const blob = await encodeVideoSafe(job.sc, f => {
              done[k] = f; const total = done.reduce((a, b) => a + b, 0);
              progress(total, jobs.length, `Rendering ${finished}/${jobs.length} done · ${job.sc.short} · ${designLabel(job.d)}`);
            }, prep);
            done[k] = 1; finished++;
            await deliver(job.sc, job.d, blob);
          }
        };
        await Promise.all(Array.from({ length: lanes }, lane));
        if (finished) secsPerVideo = (performance.now() - t0) / 1000 / finished;
        break;
      } else {
        progress(i, jobs.length, `Recording ${label}`);
        renderSchoolList(); renderVariant();
        await deliver(sc, d, await recordCurrent());
        await new Promise(r => setTimeout(r, 300));
      }
    }
    await Promise.all(pending);
    if (zip && files.length) {
      progress(1, 1, `Zipping ${files.length} files…`);
      download(await makeZip(files), `early-vote-ads_${video ? 'videos' : 'stills'}_${files.length}.zip`);
    }
    const took = (performance.now() - started) / 1000;
    progress(1, 1, `${bxCancel ? 'Stopped' : 'Done ✓'} · ${files.length || jobs.length} files in ${took < 90 ? Math.round(took) + ' sec' : Math.round(took / 60) + ' min'}`);
  } catch (e) { progress(0, 1, 'Export failed: ' + (e.message || e)); alert('Export failed: ' + (e.message || e)); }
  exporting = false;
  Object.assign(state, keep); t = 0;
  setBusy(false); $('#bxCancel').hidden = true;
  renderSchoolList(); renderContentTab(); renderSiteNote(); renderStyleTab(); renderVariant(); renderLayerList(); renderLayerProps(); renderTextFields();
};

/* minimal ZIP writer (stored, no compression: PNG and video are already compressed) */
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
$('#saveSettings').onclick = () => download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'early-vote-studio-settings.json');
$('#loadSettings').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { state = merge(freshState(), JSON.parse(await f.text())); save(); initUI(); }
  catch { alert('That file could not be read as settings.'); }
  e.target.value = '';
};
$('#resetAll').onclick = () => { if (confirm('Reset all text, layouts, colors and site choices?')) { state = freshState(); save(); initUI(); } };

/* ---------- boot ---------- */
function initUI() {
  $('#search').value = state.search;
  $$('#filters .chip').forEach(x => x.classList.toggle('active', x.dataset.f === state.filter));
  renderSchoolList(); renderContentTab(); renderTextFields(); renderStyleTab(); renderLayerList(); renderLayerProps(); renderSiteNote(); renderVariant(); renderBatch();
  refreshAltViews();
}
initUI();
requestAnimationFrame(tick);
// make sure canvas fonts are loaded, then refresh static views
const fams = new Set(Object.values(FONT_PRESETS).flatMap(f => [`${f.dw} 40px "${f.display}"`, `400 40px "${f.body}"`, `700 40px "${f.body}"`, `800 40px "${f.body}"`]).concat('700 40px "Caveat"'));
Promise.all([...fams].map(f => document.fonts.load(f).catch(() => {}))).then(() => refreshAltViews());
})();
