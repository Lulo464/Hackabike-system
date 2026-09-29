const path = require('path');
const express = require('express');
const { pool, migrate, waitForDb } = require('./db');
const auth = require('./auth');
const live = require('./live');
const forecast = require('./forecast');
const gate = require('./gate');
const maintenance = require('./maintenance');
const { seedIfEmpty } = require('./seed');

const PORT = Number(process.env.PORT || 8080);
const app = express();
app.set('trust proxy', false);
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '5m' }));
app.use('/api', auth.loadUser);

// ---- cached snapshots, shared by every client ------------------------------
let fastSnap = null; let slowSnap = null; let forecastSnap = null;

async function refreshFast() {
  try { fastSnap = await live.fast(); } catch (err) { console.error('live:', err.message); }
}
async function refreshSlow() {
  try { slowSnap = await live.slow(); } catch (err) { console.error('stats:', err.message); }
}
async function refreshForecast() {
  try { forecastSnap = await forecast.build(fastSnap); } catch (err) { console.error('forecast:', err.message); }
}

const snapshot = () => ({ ...fastSnap, ...slowSnap, gateControl: gate.state() });

// ---- server-sent events ----------------------------------------------------
const clients = new Set();
let lastSent = '';

function broadcast(force = false) {
  if (!fastSnap) return;
  const body = JSON.stringify(snapshot());
  if (!force && body === lastSent) return;
  lastSent = body;
  for (const res of clients) res.write(`event: live\ndata: ${body}\n\n`);
}

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  if (fastSnap) res.write(`event: live\ndata: ${JSON.stringify(snapshot())}\n\n`);
  if (forecastSnap) res.write(`event: forecast\ndata: ${JSON.stringify(forecastSnap)}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// ---- REST ------------------------------------------------------------------
app.get('/api/live', (_req, res) => res.json(snapshot()));
app.get('/api/forecast', (_req, res) => res.json(forecastSnap));
app.get('/api/config', (_req, res) => res.json({
  registrationCodeRequired: auth.registrationCodeRequired(),
}));
app.get('/api/me', (req, res) => res.json({ user: req.user ? auth.publicUser(req.user) : null }));
app.post('/api/register', auth.rateLimit, auth.register);
app.post('/api/login', auth.rateLimit, auth.login);
app.post('/api/logout', auth.logout);

app.post('/api/gate', auth.requireUser, async (req, res) => {
  const r = await gate.open(req.user, req.body?.action);
  res.status(r.status).json(r.body);
  refreshFast().then(() => broadcast());
});

app.get('/healthz', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ code: 'internal', error: 'Interner Fehler.' });
});

// ---- boot --------------------------------------------------------------------
(async () => {
  await waitForDb();
  await migrate();
  await seedIfEmpty();
  await refreshFast(); await refreshSlow(); await refreshForecast();

  setInterval(async () => { await refreshFast(); broadcast(); }, 2000);
  setInterval(async () => { await refreshSlow(); broadcast(); }, 30_000);
  setInterval(async () => {
    await refreshForecast();
    const body = JSON.stringify(forecastSnap);
    for (const res of clients) res.write(`event: forecast\ndata: ${body}\n\n`);
  }, 5 * 60_000);
  // keep proxies and phones from dropping an idle stream
  setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 15_000);
  setInterval(() => auth.purgeExpired().catch(() => {}), 60 * 60_000);
  maintenance.start();

  app.listen(PORT, () => console.log(`bikestation-web listening on :${PORT}`));
})().catch((err) => {
  console.error('startup failed:', err);
  process.exit(1);
});
