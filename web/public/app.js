'use strict';

const $ = (id) => document.getElementById(id);
const HOLD_MS = 800;
const RING = 2 * Math.PI * 52;

const state = { live: null, forecast: null, user: null, day: 0, prevSlots: {}, prevFree: null, seenActivity: new Set() };

// ---- helpers -------------------------------------------------------------
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
function ago(iso) {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 5) return 'gerade eben';
  if (s < 60) return `vor ${s} s`;
  if (s < 3600) return `vor ${Math.round(s / 60)} min`;
  if (s < 86400) return `um ${fmtTime(iso)}`;
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
const num = (n, d = 1) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: d });
const icon = (name) => `<svg><use href="#i-${name}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
}

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Fehler ${res.status}`), { status: res.status });
  return data;
}

// ---- hero ------------------------------------------------------------------
function animateNumber(el, to) {
  const from = Number(el.dataset.v ?? to);
  el.dataset.v = to;
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 500);
    el.textContent = Math.round(from + (to - from) * k);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderHero(l) {
  const hero = $('hero');
  const free = l.free; const total = l.total;
  const share = total ? free / total : 0;
  let level; let pill; let title;
  if (!l.fresh) {
    level = 'stale'; pill = ['', 'alert', 'Sensoren offline'];
    title = l.lastUpdate ? 'Letzter Stand' : 'Noch keine Daten';
  } else if (free === 0) {
    level = 'crit'; pill = ['crit', 'x', 'Voll']; title = 'Gerade kein Platz frei';
  } else if (share <= 0.25) {
    level = 'warn'; pill = ['warn', 'alert', 'Fast voll']; title = free === 1 ? 'Noch 1 Platz frei' : `Noch ${free} Plätze frei`;
  } else {
    level = 'good'; pill = ['good', 'check', 'Viel Platz']; title = `${free} Plätze frei`;
  }
  hero.dataset.level = level;
  $('heroPill').className = `status-pill ${pill[0]}`;
  $('heroPill').innerHTML = `${icon(pill[1])}<span>${pill[2]}</span>`;
  $('heroTitle').textContent = title;
  animateNumber($('heroNum'), free);
  $('heroOf').textContent = `von ${total} frei`;
  $('ringFill').style.strokeDashoffset = String(RING * (1 - share));
  $('ringFill').style.opacity = share > 0 ? '1' : '0';
  $('heroSub').textContent = l.fresh
    ? `Live · aktualisiert ${ago(l.lastUpdate)}`
    : l.lastUpdate ? `Stand ${ago(l.lastUpdate)} – die Sensoren melden gerade nichts.` : 'Warte auf die ersten Messwerte.';

  // a hint from the forecast: when does it get better / worse?
  const f = state.forecast;
  let hint = '';
  if (f && f.best && l.fresh && free <= 1) hint = `Tipp: ${f.best.label.toLowerCase()} gegen ${f.best.hour} Uhr sind ≈${Math.round(f.best.expectedFree)} Plätze frei.`;
  else if (f && f.peak && l.fresh && free > 1) hint = `Am vollsten wird es ${f.peak.label.toLowerCase()} gegen ${f.peak.hour} Uhr (≈${f.peak.occupancy} % belegt).`;
  $('heroHint').textContent = hint;
}

// ---- slots -----------------------------------------------------------------
const SLOT_TEXT = { free: ['Frei', 'p'], occupied: ['Belegt', 'bike'], reserved: ['Reserviert', 'clock'], unknown: ['Unbekannt', 'alert'] };

function renderSlots(l) {
  const wrap = $('slots');
  if (wrap.querySelector('.skeleton')) wrap.innerHTML = '';
  for (const s of l.slots) {
    let el = wrap.querySelector(`[data-slot="${s.slot}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'slot'; el.dataset.slot = s.slot;
      wrap.appendChild(el);
    }
    const [label, ic] = SLOT_TEXT[s.state] || SLOT_TEXT.unknown;
    const changed = state.prevSlots[s.slot] && state.prevSlots[s.slot] !== s.state;
    if (el.dataset.state !== s.state || !el.innerHTML) {
      el.dataset.state = s.state;
      el.innerHTML = `
        <div class="slot-top"><span class="slot-no">SLOT ${s.slot}</span><span class="slot-icon">${icon(ic)}</span></div>
        <div><div class="slot-state">${label}</div><div class="slot-meta"></div></div>`;
      if (changed) { el.classList.remove('changed'); void el.offsetWidth; el.classList.add('changed'); }
    }
    el.classList.toggle('stale', !s.fresh);
    const dist = s.distanceCm !== null ? `${num(s.distanceCm)} cm · ` : '';
    el.querySelector('.slot-meta').textContent = !s.since ? 'keine Daten'
      : s.fresh ? `${dist}live` : `Stand ${ago(s.since)}`;
    state.prevSlots[s.slot] = s.state;
  }
  $('slotsAge').textContent = l.fresh ? 'live' : 'offline';
}

// ---- activity & system -----------------------------------------------------
function renderActivity(l) {
  const ul = $('activity');
  if (!l.activity.length) { ul.innerHTML = '<li class="muted">Noch nichts passiert.</li>'; return; }
  ul.innerHTML = l.activity.map((a) => {
    const key = `${a.ts}|${a.text}`;
    const isNew = state.seenActivity.size && !state.seenActivity.has(key);
    return `<li class="${isNew ? 'new' : ''}"><span class="act-icon ${a.kind}">${icon(a.kind === 'app' ? 'phone' : 'chip')}</span>
      <span>${esc(a.text)}</span><span class="act-time" data-ts="${a.ts}">${ago(a.ts)}</span></li>`;
  }).join('');
  for (const a of l.activity) state.seenActivity.add(`${a.ts}|${a.text}`);
}

function renderSystem(l) {
  const devs = l.devices || [];
  $('devices').innerHTML = devs.length
    ? devs.map((d) => `<span class="device ${d.online ? 'on' : 'off'}">${icon(d.online ? 'check' : 'x')}${esc(d.name)} · ${d.online ? 'online' : 'offline'}</span>`).join('')
    : '<span class="muted small">Keine Geräte gemeldet.</span>';
  const s = l.stats;
  if (!s) return;
  const c = s.last_cleanup;
  $('stats').innerHTML = `
    <dt>Datenbank</dt><dd>${esc(s.db_size)}</dd>
    <dt>Rohdaten</dt><dd>${num(s.raw_rows, 0)} Zeilen (letzte Minuten)</dd>
    <dt>Minutenwerte</dt><dd>${num(s.live_minutes, 0)} live · ${num(s.demo_minutes, 0)} Demo</dd>
    <dt>Aufräumen</dt><dd>${c ? `${ago(c.ts)}: ${num(c.rows_in, 0)} → ${num(c.buckets_out, 0)}` : 'läuft alle 5 min'}</dd>
    <dt>Gate-Steuerung</dt><dd>${l.gateControl?.mqtt ? 'verbunden' : 'getrennt'}</dd>`;
}

// ---- forecast chart ----------------------------------------------------------
function renderForecast() {
  const f = state.forecast;
  if (!f) return;

  $('insights').innerHTML = [
    f.best && `<div class="insight"><div class="k">Beste Zeit</div><div class="v">${f.best.label} ${f.best.hour} Uhr</div><div class="d">≈${Math.round(f.best.expectedFree)} von ${f.slots} frei</div></div>`,
    f.peak && `<div class="insight"><div class="k">Stoßzeit</div><div class="v">${f.peak.label} ${f.peak.hour} Uhr</div><div class="d">≈${f.peak.occupancy} % belegt</div></div>`,
  ].filter(Boolean).join('');

  $('dayTabs').innerHTML = f.days.map((d, i) =>
    `<button role="tab" type="button" data-day="${i}" aria-selected="${i === state.day}">${d.label}</button>`).join('');

  $('forecastNote').textContent = f.trainingDays
    ? `Grundlage: Belegung der letzten ${f.trainingDays} Tage, je Wochentag und Stunde gemittelt${f.liveBlended ? '; die nächsten Stunden sind an den Live-Stand angeglichen' : ''}.${f.includesDemo ? ' Enthält fiktive Demo-Daten.' : ''}`
    : 'Noch zu wenig Verlauf für eine Prognose.';
  drawChart(f.days[state.day]);
  renderTable(f.days[state.day]);
}

function drawChart(day) {
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
      out += `<text class="now-label" x="${x + bw / 2}" y="${padT - 7}" text-anchor="middle">jetzt</text>`;
    }
  });
  svg.innerHTML = out;
  svg.setAttribute('aria-label', `Auslastung ${day.label}, pro Stunde`);

  const tip = $('tooltip');
  const show = (i) => {
    const h = day.hours[i];
    svg.querySelectorAll('.col.active').forEach((c) => c.classList.remove('active'));
    svg.querySelector(`.col[data-i="${i}"]`)?.classList.add('active');
    const kind = { measured: 'Gemessen', now: 'Jetzt', forecast: 'Prognose' }[h.kind];
    tip.innerHTML = h.occupancy === null
      ? `<b>${h.hour}–${h.hour + 1} Uhr</b>keine Daten`
      : `<b>${h.hour}–${h.hour + 1} Uhr · ${kind}</b>${h.occupancy} % belegt · ≈${num(h.expectedFree)} frei`;
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
  $('forecastTable').innerHTML = `<table><thead><tr><th>Stunde</th><th>Art</th><th>Belegt</th><th>Frei (≈)</th></tr></thead><tbody>${
    day.hours.map((h) => `<tr><td>${h.hour}–${h.hour + 1} Uhr</td><td>${{ measured: 'Gemessen', now: 'Jetzt', forecast: 'Prognose' }[h.kind]}</td>
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
function onLive(l) {
  state.live = l;
  renderHero(l); renderSlots(l); renderActivity(l); renderSystem(l);
}

function connect() {
  const es = new EventSource('/api/stream');
  es.addEventListener('live', (e) => onLive(JSON.parse(e.data)));
  es.addEventListener('forecast', (e) => { state.forecast = JSON.parse(e.data); renderForecast(); if (state.live) renderHero(state.live); });
  es.onopen = () => { $('connDot').className = 'pulse on'; $('connText').textContent = 'Live verbunden'; };
  es.onerror = () => { $('connDot').className = 'pulse off'; $('connText').textContent = 'Verbindung unterbrochen …'; };
}

// relative times keep counting between updates
setInterval(() => {
  if (!state.live) return;
  document.querySelectorAll('.act-time[data-ts]').forEach((el) => { el.textContent = ago(el.dataset.ts); });
  renderHero(state.live);
  renderSlots(state.live);
}, 1000);

// ---- account -----------------------------------------------------------------
let authMode = 'login';
let codeRequired = false;

function setUser(user) {
  state.user = user;
  $('accessGuest').hidden = !!user;
  $('accessUser').hidden = !user;
  $('accountLabel').textContent = user ? user.displayName : 'Anmelden';
  if (user) $('userName').textContent = user.displayName;
}

function openAuth(mode) {
  authMode = mode;
  const sheet = $('authSheet');
  sheet.querySelectorAll('.auth-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  sheet.querySelectorAll('[data-only="register"]').forEach((el) => { el.hidden = mode !== 'register' || (el.id === 'codeField' && !codeRequired); });
  $('authTitle').textContent = mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen';
  $('authSubmit').textContent = mode === 'login' ? 'Anmelden' : 'Registrieren';
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
    toast(authMode === 'login' ? `Hallo ${user.displayName}!` : `Konto erstellt – willkommen, ${user.displayName}!`);
  } catch (err) {
    const el = $('authError');
    el.textContent = err.message;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  } finally { btn.disabled = false; }
});

$('logoutBtn').addEventListener('click', async () => {
  await api('/api/logout', {}).catch(() => {});
  setUser(null);
  toast('Abgemeldet.');
});

// ---- press & hold to open the gate -------------------------------------------
let gateTimer;
function showGate(res) {
  const stage = $('gateStage');
  stage.hidden = false; stage.classList.remove('open');
  $('gateTitle').textContent = 'Gate öffnet …';
  $('gateSub').textContent = res.action === 'park'
    ? (res.slot ? `Slot ${res.slot} ist für dich reserviert.` : 'Ein freier Slot wird dir zugewiesen.')
    : 'Viel Spaß mit deinem Rad!';
  requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('open')));
  setTimeout(() => { $('gateTitle').textContent = 'Gate ist offen'; }, 700);

  const bar = $('countdownBar');
  bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)';
  void bar.offsetWidth;
  bar.style.transition = `transform ${res.openSeconds}s linear`;
  bar.style.transform = 'scaleX(0)';
  clearTimeout(gateTimer);
  gateTimer = setTimeout(() => {
    stage.classList.remove('open');
    $('gateTitle').textContent = 'Gate schließt';
    setTimeout(() => { stage.hidden = true; }, 1600);
  }, res.openSeconds * 1000);
}

async function triggerGate(btn) {
  const action = btn.dataset.action;
  document.querySelectorAll('.hold-btn').forEach((b) => b.classList.add('busy'));
  if (navigator.vibrate) navigator.vibrate(30);
  try {
    const res = await api('/api/gate', { action });
    showGate(res);
  } catch (err) {
    if (err.status === 401) { setUser(null); openAuth('login'); }
    toast(err.message);
  } finally {
    setTimeout(() => document.querySelectorAll('.hold-btn').forEach((b) => b.classList.remove('busy')), 1200);
  }
}

document.querySelectorAll('.hold-btn').forEach((btn) => {
  let t = null;
  btn.style.setProperty('--hold', `${HOLD_MS}ms`);
  const start = (e) => {
    if (btn.classList.contains('busy') || t) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.type === 'keydown') { e.preventDefault(); if (e.repeat) return; }
    btn.classList.add('holding');
    t = setTimeout(() => { t = null; btn.classList.remove('holding'); triggerGate(btn); }, HOLD_MS);
  };
  const cancel = () => {
    if (!t) return;
    clearTimeout(t); t = null; btn.classList.remove('holding');
    toast('Gedrückt halten, bis der Balken voll ist.');
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('keydown', start);
  ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur'].forEach((ev) => btn.addEventListener(ev, cancel));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
});

// ---- boot --------------------------------------------------------------------
(async () => {
  try {
    const [{ user }, cfg] = await Promise.all([api('/api/me'), api('/api/config')]);
    codeRequired = cfg.registrationCodeRequired;
    setUser(user);
  } catch { setUser(null); }
  connect();
})();
