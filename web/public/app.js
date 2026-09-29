'use strict';

const $ = (id) => document.getElementById(id);
const { t } = window.I18N;
const HOLD_MS = 800;
const RING = 2 * Math.PI * 52;

const state = {
  live: null, forecast: null, user: null, day: 0,
  prevSlots: {}, seenActivity: new Set(),
  conn: 'connecting',   // connecting | live | lost
  gate: null,           // { res, phase: opening | open | closing }
  bike: null,           // /api/me/bike
  chip: null,           // /api/me/chip
  clockOffset: 0,       // server time - local time
};

// ---- helpers -------------------------------------------------------------
const loc = () => window.I18N.locale;
const fmtTime = (iso) => new Date(iso).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
function ago(iso) {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 5) return t('ago.now');
  if (s < 60) return t('ago.s', { n: s });
  if (s < 3600) return t('ago.m', { n: Math.round(s / 60) });
  if (s < 86400) return t('ago.at', { t: fmtTime(iso) });
  return new Date(iso).toLocaleString(loc(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
const num = (n, d = 1) => Number(n).toLocaleString(loc(), { maximumFractionDigits: d });
const hourText = (h) => t('time.hour', { h: window.I18N.lang === 'de' ? h : String(h).padStart(2, '0') });
const rangeText = (h) => {
  const pad = window.I18N.lang === 'de' ? String : (x) => String(x).padStart(2, '0');
  return t('time.range', { a: pad(h), b: pad(h + 1) });
};
const kindText = (k) => t({ measured: 'legend.measured', now: 'legend.now', forecast: 'legend.forecast' }[k]);
const icon = (name) => `<svg><use href="#i-${name}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg; el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3800);
}

// errors carry a code from the server; word them in the current language
function errText(err) {
  if (err.code) return t(`err.${err.code}`, err.data);
  return err.message;
}

async function api(path, body) {
  let res;
  try {
    res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw Object.assign(new Error('network'), { code: 'network' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, code: data.code, data });
  }
  return data;
}

// ---- hero ------------------------------------------------------------------
function animateNumber(el, to) {
  const from = Number(el.dataset.v ?? to);
  el.dataset.v = to;
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 500);
    el.textContent = Math.round(from + (to - from) * k);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderHero(l) {
  const hero = $('hero');
  const { free, total } = l;
  const share = total ? free / total : 0;
  let level; let pill; let title;
  if (!l.fresh) {
    level = 'stale'; pill = ['', 'alert', t('pill.offline')];
    title = t(l.lastUpdate ? 'title.last' : 'title.nodata');
  } else if (free === 0) {
    level = 'crit'; pill = ['crit', 'x', t('pill.full')]; title = t('title.full');
  } else if (share <= 0.25) {
    level = 'warn'; pill = ['warn', 'alert', t('pill.almost')];
    title = free === 1 ? t('title.one') : t('title.few', { n: free });
  } else {
    level = 'good'; pill = ['good', 'check', t('pill.plenty')]; title = t('title.many', { n: free });
  }
  hero.dataset.level = level;
  $('heroPill').className = `status-pill ${pill[0]}`;
  $('heroPill').innerHTML = `${icon(pill[1])}<span>${esc(pill[2])}</span>`;
  $('heroTitle').textContent = title;
  animateNumber($('heroNum'), free);
  $('heroOf').textContent = t('hero.of', { total });
  // the ring fills up as the station fills up; the big number stays "free"
  const used = total ? (total - free) / total : 0;
  $('ringFill').style.strokeDashoffset = String(RING * (1 - used));
  $('ringFill').style.opacity = used > 0 ? '1' : '0';
  $('heroOcc').textContent = t('hero.occ', { p: Math.round(used * 100) });
  $('heroSub').textContent = l.fresh
    ? t('sub.live', { ago: ago(l.lastUpdate) })
    : l.lastUpdate ? t('sub.stale', { ago: ago(l.lastUpdate) }) : t('sub.waiting');

  // a hint from the forecast: when does it get better / worse?
  const f = state.forecast;
  let hint = '';
  if (f && f.best && l.fresh && free <= 1) {
    hint = t('hint.best', { day: t(`dayl.${f.best.day}`), time: hourText(f.best.hour), n: Math.round(f.best.expectedFree) });
  } else if (f && f.peak && l.fresh && free > 1) {
    hint = t('hint.peak', { day: t(`dayl.${f.peak.day}`), time: hourText(f.peak.hour), p: f.peak.occupancy });
  }
  $('heroHint').textContent = hint;
}

// ---- slots -----------------------------------------------------------------
const SLOT_ICON = { free: 'p', occupied: 'bike', reserved: 'clock', unknown: 'alert' };

function renderSlots(l, rebuild = false) {
  const wrap = $('slots');
  if (wrap.querySelector('.skeleton')) wrap.innerHTML = '';
  for (const s of l.slots) {
    let el = wrap.querySelector(`[data-slot="${s.slot}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'slot'; el.dataset.slot = s.slot;
      wrap.appendChild(el);
    }
    const st = SLOT_ICON[s.state] ? s.state : 'unknown';
    const changed = state.prevSlots[s.slot] && state.prevSlots[s.slot] !== st;
    if (rebuild || el.dataset.state !== st || !el.innerHTML) {
      el.dataset.state = st;
      el.innerHTML = `
        <div class="slot-top"><span class="slot-no">${esc(t('slot.label', { n: s.slot }))}</span><span class="slot-icon">${icon(SLOT_ICON[st])}</span></div>
        <div><div class="slot-state">${esc(t(`state.${st}`))}</div><div class="slot-meta"></div></div>`;
      if (changed) { el.classList.remove('changed'); void el.offsetWidth; el.classList.add('changed'); }
    }
    el.classList.toggle('stale', !s.fresh);
    const dist = s.distanceCm !== null ? `${num(s.distanceCm)} cm · ` : '';
    el.querySelector('.slot-meta').textContent = !s.since ? t('slot.nodata')
      : s.fresh ? `${dist}${t('slots.live')}` : t('slot.asof', { ago: ago(s.since) });
    state.prevSlots[s.slot] = st;

    const cur = state.user && state.bike && state.bike.current;
    const mine = cur && cur.slot === s.slot ? cur.status : null;
    el.classList.toggle('mine', Boolean(mine));
    let badge = el.querySelector('.mine-badge');
    if (mine) {
      if (!badge) { badge = document.createElement('span'); badge.className = 'mine-badge'; el.appendChild(badge); }
      badge.textContent = t(mine === 'parked' ? 'bike.yours' : 'bike.forYou');
    } else if (badge) badge.remove();
  }
  $('slotsAge').textContent = t(l.fresh ? 'slots.live' : 'slots.offline');
}

// ---- activity & system -----------------------------------------------------
function activityText(a) {
  if (a.kind === 'chip') return t('act.chip', { uid: a.uid });
  if (a.result === 'opened') return t(a.action === 'park' ? 'act.park' : 'act.pickup');
  return t(a.result === 'full' ? 'act.full' : 'act.error');
}

function renderActivity(l) {
  const ul = $('activity');
  if (!l.activity.length) { ul.innerHTML = `<li class="muted">${esc(t('act.none'))}</li>`; return; }
  const key = (a) => `${a.ts}|${a.kind}|${a.uid || a.action}`;
  ul.innerHTML = l.activity.map((a) => {
    const isNew = state.seenActivity.size && !state.seenActivity.has(key(a));
    return `<li class="${isNew ? 'new' : ''}"><span class="act-icon ${a.kind}">${icon(a.kind === 'app' ? 'phone' : 'chip')}</span>
      <span>${esc(activityText(a))}</span><span class="act-time" data-ts="${a.ts}">${ago(a.ts)}</span></li>`;
  }).join('');
  for (const a of l.activity) state.seenActivity.add(key(a));
}

function renderSystem(l) {
  const devs = l.devices || [];
  $('devices').innerHTML = devs.length
    ? devs.map((d) => `<span class="device ${d.online ? 'on' : 'off'}">${icon(d.online ? 'check' : 'x')}${esc(d.name)} · ${esc(t(d.online ? 'sys.online' : 'sys.offline'))}</span>`).join('')
    : `<span class="muted small">${esc(t('sys.none'))}</span>`;
  const s = l.stats;
  if (!s) return;
  const c = s.last_cleanup;
  $('stats').innerHTML = `
    <dt>${t('sys.db')}</dt><dd>${esc(s.db_size)}</dd>
    <dt>${t('sys.raw')}</dt><dd>${t('sys.rawVal', { n: num(s.raw_rows, 0) })}</dd>
    <dt>${t('sys.minutes')}</dt><dd>${t('sys.minutesVal', { live: num(s.live_minutes, 0), demo: num(s.demo_minutes, 0) })}</dd>
    <dt>${t('sys.cleanup')}</dt><dd>${c ? `${ago(c.ts)}: ${num(c.rows_in, 0)} → ${num(c.buckets_out, 0)}` : t('sys.cleanupEvery')}</dd>
    <dt>${t('sys.gate')}</dt><dd>${t(l.gateControl?.mqtt ? 'sys.connected' : 'sys.disconnected')}</dd>`;
}

// ---- forecast chart ----------------------------------------------------------
function renderForecast() {
  const f = state.forecast;
  if (!f) return;

  const tile = (k, when, d) => `<div class="insight"><div class="k">${esc(t(k))}</div>
    <div class="v">${esc(`${t(`day.${when.day}`)} ${hourText(when.hour)}`)}</div><div class="d">${esc(d)}</div></div>`;
  $('insights').innerHTML = [
    f.best && tile('fc.best', f.best, t('fc.bestSub', { n: Math.round(f.best.expectedFree), total: f.slots })),
    f.peak && tile('fc.peak', f.peak, t('fc.peakSub', { p: f.peak.occupancy })),
  ].filter(Boolean).join('');

  $('dayTabs').innerHTML = f.days.map((d, i) =>
    `<button role="tab" type="button" data-day="${i}" aria-selected="${i === state.day}">${esc(t(`day.${i}`))}</button>`).join('');

  $('forecastNote').textContent = f.trainingDays
    ? `${t('fc.note', { n: f.trainingDays })}${f.liveBlended ? t('fc.noteLive') : ''}.${f.includesDemo ? ` ${t('fc.noteDemo')}` : ''}`
    : t('fc.noteNone');
  drawChart(f.days[state.day], state.day);
  renderTable(f.days[state.day]);
}

function drawChart(day, dayIndex) {
  const svg = $('chart');
  const W = svg.clientWidth || 600; const H = 220;
  const padL = 34; const padR = 6; const padT = 18; const padB = 24;
  const cw = (W - padL - padR) / 24;
  const bw = Math.max(3, cw - 2); // 2px gap between bars
  const y = (p) => padT + (H - padT - padB) * (1 - p / 100);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  let out = '';
  for (const g of [0, 50, 100]) {
    out += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(g)}" y2="${y(g)}"/>`;
    out += `<text class="axis-label" x="${padL - 6}" y="${y(g) + 4}" text-anchor="end">${g}%</text>`;
  }
  day.hours.forEach((h, i) => {
    const x = padL + i * cw + (cw - bw) / 2;
    const v = h.occupancy;
    const cls = v === null ? 'empty' : h.kind === 'measured' ? 'measured' : h.kind === 'now' ? 'now' : 'forecast';
    const top = v === null ? y(4) : y(Math.max(v, 1.5));
    const hgt = y(0) - top;
    const r = Math.min(4, bw / 2, hgt);
    // rounded top, square base
    const path = `M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${y(0)} Z`;
    out += `<g class="col" data-i="${i}">
      <path class="bar ${cls}" d="${path}" style="animation-delay:${i * 18}ms"/>
      <rect class="hit" x="${padL + i * cw}" y="${padT}" width="${cw}" height="${H - padT - padB}"/>
    </g>`;
    if (i % 3 === 0) out += `<text class="axis-label" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${String(h.hour).padStart(2, '0')}</text>`;
    if (h.kind === 'now') {
      out += `<line class="now-line" x1="${x + bw / 2}" x2="${x + bw / 2}" y1="${padT - 4}" y2="${y(0)}"/>`;
      out += `<text class="now-label" x="${x + bw / 2}" y="${padT - 7}" text-anchor="middle">${esc(t('chart.now'))}</text>`;
    }
  });
  svg.innerHTML = out;
  svg.setAttribute('aria-label', t('chart.aria', { day: t(`day.${dayIndex}`) }));

  const tip = $('tooltip');
  const show = (i) => {
    const h = day.hours[i];
    svg.querySelectorAll('.col.active').forEach((c) => c.classList.remove('active'));
    svg.querySelector(`.col[data-i="${i}"]`)?.classList.add('active');
    tip.innerHTML = h.occupancy === null
      ? `<b>${esc(rangeText(h.hour))}</b>${esc(t('tip.nodata'))}`
      : `<b>${esc(`${rangeText(h.hour)} · ${kindText(h.kind)}`)}</b>${esc(t('tip.value', { p: h.occupancy, n: num(h.expectedFree) }))}`;
    const x = padL + i * cw + cw / 2;
    const rect = svg.getBoundingClientRect();
    const px = (x / W) * rect.width;
    tip.style.left = `${Math.min(rect.width - 90, Math.max(90, px))}px`;
    tip.style.top = `${(y(h.occupancy ?? 0) / H) * rect.height - 8}px`;
    tip.hidden = false;
  };
  svg.onpointermove = svg.onpointerdown = (e) => {
    const col = e.target.closest('.col');
    if (col) show(Number(col.dataset.i));
  };
  svg.onpointerleave = () => { tip.hidden = true; svg.querySelectorAll('.col.active').forEach((c) => c.classList.remove('active')); };
}

function renderTable(day) {
  $('forecastTable').innerHTML = `<table><thead><tr><th>${t('table.hour')}</th><th>${t('table.kind')}</th><th>${t('table.occ')}</th><th>${t('table.free')}</th></tr></thead><tbody>${
    day.hours.map((h) => `<tr><td>${esc(rangeText(h.hour))}</td><td>${esc(kindText(h.kind))}</td>
      <td>${h.occupancy === null ? '–' : `${h.occupancy} %`}</td><td>${h.expectedFree === null ? '–' : num(h.expectedFree)}</td></tr>`).join('')
  }</tbody></table>`;
}

$('dayTabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-day]');
  if (!b) return;
  state.day = Number(b.dataset.day);
  $('tooltip').hidden = true;
  renderForecast();
});
let resizeT;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(renderForecast, 150); });

// ---- live stream -----------------------------------------------------------
function renderConn() {
  $('connDot').className = `pulse ${{ live: 'on', lost: 'off', connecting: '' }[state.conn]}`;
  $('connText').textContent = t({ live: 'conn.live', lost: 'conn.lost', connecting: 'conn.connecting' }[state.conn]);
}

function onLive(l) {
  state.live = l;
  renderHero(l); renderSlots(l); renderActivity(l); renderSystem(l);
}

function connect() {
  const es = new EventSource('/api/stream');
  es.addEventListener('live', (e) => onLive(JSON.parse(e.data)));
  es.addEventListener('forecast', (e) => { state.forecast = JSON.parse(e.data); renderForecast(); if (state.live) renderHero(state.live); });
  es.onopen = () => { state.conn = 'live'; renderConn(); };
  es.onerror = () => { state.conn = 'lost'; renderConn(); };
}

// relative times keep counting between updates
setInterval(() => {
  if (!state.live) return;
  document.querySelectorAll('.act-time[data-ts]').forEach((el) => { el.textContent = ago(el.dataset.ts); });
  renderHero(state.live);
  renderSlots(state.live);
  if (state.bike) renderBike(false);
  if (state.chip && state.chip.pairingUntil && !state.chip.linked) renderChip();
}, 1000);

// ---- account -----------------------------------------------------------------
let authMode = 'login';
let codeRequired = false;

function setUser(user) {
  state.user = user;
  $('accessGuest').hidden = !!user;
  $('accessUser').hidden = !user;
  $('accountLabel').textContent = user ? user.displayName : t('account.login');
  if (user) $('userName').textContent = user.displayName;
  const was = setUser.current;
  setUser.current = user ? user.username : null;
  if (setUser.current === was) return;
  clearInterval(bikeTimer); stopPairPoll();
  state.bike = null; state.chip = null;
  if (user) {
    refreshBike(); refreshChip();
    bikeTimer = setInterval(refreshBike, 5000);
  }
  if (state.live) renderSlots(state.live);
}

function renderAuthTexts() {
  $('authTitle').textContent = t(authMode === 'login' ? 'auth.welcome' : 'auth.create');
  $('authSubmit').textContent = t(authMode === 'login' ? 'account.login' : 'access.register');
}

function openAuth(mode) {
  authMode = mode;
  const sheet = $('authSheet');
  sheet.querySelectorAll('.auth-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  sheet.querySelectorAll('[data-only="register"]').forEach((el) => { el.hidden = mode !== 'register' || (el.id === 'codeField' && !codeRequired); });
  renderAuthTexts();
  sheet.querySelector('[name=password]').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('authError').textContent = '';
  if (!sheet.open) sheet.showModal();
  sheet.querySelector(mode === 'register' ? '[name=displayName]' : '[name=username]').focus();
}

document.querySelectorAll('[data-auth]').forEach((b) => b.addEventListener('click', () => openAuth(b.dataset.auth)));
$('accountBtn').addEventListener('click', () => {
  if (state.user) $('access').scrollIntoView({ behavior: 'smooth', block: 'center' });
  else openAuth('login');
});
document.querySelectorAll('.auth-tabs button').forEach((b) => b.addEventListener('click', () => openAuth(b.dataset.mode)));
$('authCancel').addEventListener('click', () => $('authSheet').close());
$('authSheet').addEventListener('click', (e) => { if (e.target === $('authSheet')) $('authSheet').close(); });

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target));
  const btn = $('authSubmit'); btn.disabled = true;
  try {
    const { user } = await api(authMode === 'login' ? '/api/login' : '/api/register', fd);
    setUser(user);
    $('authSheet').close();
    e.target.reset();
    toast(t(authMode === 'login' ? 'toast.hello' : 'toast.welcome', { name: user.displayName }));
  } catch (err) {
    const el = $('authError');
    el.textContent = errText(err);
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  } finally { btn.disabled = false; }
});

$('logoutBtn').addEventListener('click', async () => {
  await api('/api/logout', {}).catch(() => {});
  setUser(null);
  toast(t('toast.bye'));
});

// ---- my bike ----------------------------------------------------------------
const serverNow = () => Date.now() + state.clockOffset;
function fmtDur(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60);
  if (h) return t('dur.hm', { h, m });
  if (m) return t('dur.m', { m });
  return t('dur.s', { s: sec });
}
function fmtClock(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const ss = sec % 60;
  const two = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(ss)}` : `${m}:${two(ss)}`;
}

let bikeTimer = null;
async function refreshBike() {
  if (!state.user) return;
  try {
    const b = await api('/api/me/bike');
    state.clockOffset = new Date(b.now).getTime() - Date.now();
    const before = state.bike && state.bike.current;
    const after = b.current;
    // tell the user what just happened
    if (before && before.status === 'reserved' && after && after.status === 'parked') toast(t('bike.parkedToast', { n: after.slot }));
    else if (before && before.status === 'reserved' && !after) toast(t('bike.expiredToast'));
    else if (before && before.status === 'parked' && !after && b.last) toast(t('bike.doneToast', { dur: fmtDur(new Date(b.last.endedAt) - new Date(b.last.parkedAt)) }));
    const changed = (before && before.status + before.slot) !== (after && after.status + after.slot);
    state.bike = b;
    renderBike(changed);
    if (state.live) renderSlots(state.live);
  } catch (err) {
    if (err.status === 401) setUser(null);
  }
}

function renderBike(animate) {
  const el = $('myBike');
  const b = state.bike;
  if (!b) return;
  const cur = b.current;
  const st = cur ? cur.status : 'none';
  el.dataset.state = st;
  $('myBikeIcon').innerHTML = `<use href="#i-${st === 'reserved' ? 'clock' : 'bike'}"/>`;
  $('myBikeBar').hidden = st !== 'reserved';
  el.classList.remove('urgent');
  if (st === 'parked') {
    $('myBikeTitle').textContent = t('bike.parked', { n: cur.slot });
    $('myBikeSub').textContent = t('bike.parkedSince', { time: fmtTime(cur.parkedAt) });
    $('myBikeTimer').textContent = fmtClock(serverNow() - new Date(cur.parkedAt));
  } else if (st === 'reserved') {
    const left = new Date(cur.expiresAt) - serverNow();
    const total = new Date(cur.expiresAt) - new Date(cur.reservedAt);
    $('myBikeTitle').textContent = t('bike.reserved', { n: cur.slot });
    $('myBikeSub').textContent = t('bike.reservedSub');
    $('myBikeTimer').textContent = fmtClock(left);
    $('myBikeBarFill').style.transform = `scaleX(${Math.max(0, Math.min(1, left / total))})`;
    el.classList.toggle('urgent', left < 60000);
    if (left <= 0) refreshBike();
  } else {
    $('myBikeTitle').textContent = t('bike.none');
    $('myBikeSub').textContent = b.last
      ? t('bike.last', { dur: fmtDur(new Date(b.last.endedAt) - new Date(b.last.parkedAt)), n: b.last.slot })
      : t('bike.noneSub');
    $('myBikeTimer').textContent = '';
  }
  if (animate) { el.classList.remove('changed'); void el.offsetWidth; el.classList.add('changed'); }
}

// ---- chip link -----------------------------------------------------------------
let pairPoll = null;
async function refreshChip() {
  if (!state.user) return;
  try { state.chip = await api('/api/me/chip'); renderChip(); } catch { /* keep last state */ }
}

function renderChip() {
  const c = state.chip;
  if (!c) return;
  const row = $('chipRow');
  row.classList.toggle('linked', c.linked);
  $('chipTitle').textContent = t(c.linked ? 'chip.linked' : 'chip.none');
  $('chipSub').textContent = c.linked ? t('chip.linkedSub', { uid: c.uidTail }) : t('chip.noneSub');
  $('chipAction').textContent = t(c.linked ? 'chip.unlink' : 'chip.link');
  const pairing = Boolean(c.pairingUntil) && !c.linked;
  $('pairing').hidden = !pairing && !$('pairing').classList.contains('success');
  row.hidden = pairing;
  if (pairing) $('pairCount').textContent = t('chip.pairLeft', { s: Math.max(0, Math.ceil((new Date(c.pairingUntil) - serverNow()) / 1000)) });
}

function stopPairPoll() { clearInterval(pairPoll); pairPoll = null; }

async function startPairing() {
  try {
    state.chip = await api('/api/me/chip/pair', {});
    renderChip();
    stopPairPoll();
    pairPoll = setInterval(async () => {
      const before = state.chip;
      await refreshChip();
      const c = state.chip;
      if (c.linked) {
        stopPairPoll();
        const p = $('pairing');
        p.classList.add('success'); p.hidden = false; $('chipRow').hidden = true;
        $('pairCount').textContent = t('chip.success');
        if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
        toast(t('chip.success'));
        setTimeout(() => { p.classList.remove('success'); renderChip(); }, 2200);
      } else if (!c.pairingUntil && before && before.pairingUntil) {
        stopPairPoll();
        toast(t('chip.timeout'));
      }
    }, 1500);
  } catch (err) { toast(errText(err)); }
}

$('chipAction').addEventListener('click', async () => {
  if (!state.chip) return;
  if (state.chip.linked) {
    if (!confirm(t('chip.unlinkConfirm'))) return;
    try { state.chip = await api('/api/me/chip/unlink', {}); renderChip(); } catch (err) { toast(errText(err)); }
  } else {
    startPairing();
  }
});
$('pairCancel').addEventListener('click', async () => {
  stopPairPoll();
  try { state.chip = await api('/api/me/chip/cancel', {}); } catch { /* ignore */ }
  renderChip();
});

// ---- press & hold to open the gate -------------------------------------------
let gateTimers = [];

function renderGateTexts() {
  const g = state.gate;
  if (!g) return;
  $('gateTitle').textContent = t({ opening: 'gate.opening', open: 'gate.open', closing: 'gate.closing' }[g.phase]);
  $('gateSub').textContent = g.res.action === 'park'
    ? (g.res.slot ? t('gate.slot', { n: g.res.slot }) : t('gate.assign'))
    : t('gate.bye');
}

function showGate(res) {
  gateTimers.forEach(clearTimeout); gateTimers = [];
  const stage = $('gateStage');
  stage.hidden = false; stage.classList.remove('open');
  state.gate = { res, phase: 'opening' };
  renderGateTexts();
  requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('open')));
  gateTimers.push(setTimeout(() => { state.gate.phase = 'open'; renderGateTexts(); }, 700));

  const bar = $('countdownBar');
  bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)';
  void bar.offsetWidth;
  bar.style.transition = `transform ${res.openSeconds}s linear`;
  bar.style.transform = 'scaleX(0)';
  gateTimers.push(setTimeout(() => {
    stage.classList.remove('open');
    state.gate.phase = 'closing'; renderGateTexts();
    gateTimers.push(setTimeout(() => { stage.hidden = true; state.gate = null; }, 1600));
  }, res.openSeconds * 1000));
}

async function triggerGate(btn) {
  const action = btn.dataset.action;
  document.querySelectorAll('.hold-btn').forEach((b) => b.classList.add('busy'));
  if (navigator.vibrate) navigator.vibrate(30);
  try {
    showGate(await api('/api/gate', { action }));
    refreshBike();
  } catch (err) {
    if (err.status === 401) { setUser(null); openAuth('login'); }
    toast(errText(err));
  } finally {
    setTimeout(() => document.querySelectorAll('.hold-btn').forEach((b) => b.classList.remove('busy')), 1200);
  }
}

document.querySelectorAll('.hold-btn').forEach((btn) => {
  let timer = null;
  btn.style.setProperty('--hold', `${HOLD_MS}ms`);
  const start = (e) => {
    if (btn.classList.contains('busy') || timer) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.type === 'keydown') { e.preventDefault(); if (e.repeat) return; }
    btn.classList.add('holding');
    timer = setTimeout(() => { timer = null; btn.classList.remove('holding'); triggerGate(btn); }, HOLD_MS);
  };
  const cancel = () => {
    if (!timer) return;
    clearTimeout(timer); timer = null; btn.classList.remove('holding');
    toast(t('toast.hold'));
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('keydown', start);
  ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur'].forEach((ev) => btn.addEventListener(ev, cancel));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
});

// ---- language ----------------------------------------------------------------
function renderLangButton(animate) {
  const { LANGS, lang } = window.I18N;
  $('langFlag').textContent = LANGS[lang].flag;
  $('langCode').textContent = lang.toUpperCase();
  $('langMenu').innerHTML = Object.entries(LANGS).map(([code, l]) =>
    `<button type="button" role="menuitemradio" aria-checked="${code === lang}" data-lang="${code}">
      <span class="flag">${l.flag}</span><span>${esc(l.name)}</span><span class="code">${code.toUpperCase()}</span></button>`).join('');
  if (animate) { const b = $('langBtn'); b.classList.remove('swap'); void b.offsetWidth; b.classList.add('swap'); }
}

function renderAll() {
  window.I18N.applyStatic();
  renderLangButton(false);
  renderConn();
  setUser(state.user);
  renderAuthTexts();
  renderGateTexts();
  if (state.bike) renderBike(false);
  renderChip();
  if (state.live) { renderHero(state.live); renderSlots(state.live, true); renderActivity(state.live); renderSystem(state.live); }
  renderForecast();
}

function toggleLangMenu(open) {
  const menu = $('langMenu');
  const show = open ?? menu.hidden;
  menu.hidden = !show;
  $('langBtn').setAttribute('aria-expanded', String(show));
  if (show) menu.querySelector('[aria-checked="true"]')?.focus();
}

$('langBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleLangMenu(); });
$('langMenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lang]');
  if (!b) return;
  toggleLangMenu(false);
  if (b.dataset.lang === window.I18N.lang) return;
  window.I18N.setLang(b.dataset.lang);
  const main = document.querySelector('main');
  main.classList.remove('relang'); void main.offsetWidth; main.classList.add('relang');
  renderAll();
  renderLangButton(true);
  $('langBtn').focus();
});
$('langMenu').addEventListener('keydown', (e) => {
  const items = [...$('langMenu').querySelectorAll('button')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  if (e.key === 'Escape') { toggleLangMenu(false); $('langBtn').focus(); }
});
document.addEventListener('click', (e) => { if (!e.target.closest('.lang')) toggleLangMenu(false); });

// ---- boot --------------------------------------------------------------------
renderAll();
(async () => {
  try {
    const [{ user }, cfg] = await Promise.all([api('/api/me'), api('/api/config')]);
    codeRequired = cfg.registrationCodeRequired;
    setUser(user);
  } catch { setUser(null); }
  connect();
})();
