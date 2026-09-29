// The live picture, read from the database only. Raw telemetry holds the last
// few minutes (the cleanup job moves older rows into telemetry_1m), so every
// "latest value" lookup checks both and keeps the newer one.
const { pool } = require('./db');

const SLOTS = Number(process.env.SLOT_COUNT || 4);
const STALE_S = Number(process.env.STALE_AFTER_S || 20);

// one index lookup per slot and table, instead of scanning the topic range
const SLOTS_SQL = `
SELECT s.n,
       rs.payload AS state,  rs.ts AS state_ts,
       ms.last_payload AS state_1m, ms.bucket + interval '1 minute' AS state_1m_ts,
       rd.payload AS distance, rd.ts AS distance_ts
FROM generate_series(1, $1) AS s(n)
LEFT JOIN LATERAL (SELECT payload, ts FROM telemetry
                   WHERE topic = 'bikestation/slot' || s.n || '/state'
                   ORDER BY ts DESC LIMIT 1) rs ON true
LEFT JOIN LATERAL (SELECT last_payload, bucket FROM telemetry_1m
                   WHERE topic = 'bikestation/slot' || s.n || '/state' AND source = 'live'
                   ORDER BY bucket DESC LIMIT 1) ms ON true
LEFT JOIN LATERAL (SELECT payload, ts FROM telemetry
                   WHERE topic = 'bikestation/slot' || s.n || '/distance'
                   ORDER BY ts DESC LIMIT 1) rd ON true
ORDER BY s.n`;

const GATE_SQL = `
SELECT payload, ts FROM telemetry
WHERE topic = 'bikestation/entrance/gate/angle' ORDER BY ts DESC LIMIT 1`;

const TAPS_SQL = `
SELECT ts, payload FROM telemetry
WHERE topic = 'bikestation/entrance/nfc/tap' ORDER BY ts DESC LIMIT 12`;

const GATE_EVENTS_SQL = `
SELECT ts, action, result FROM gate_events ORDER BY ts DESC LIMIT 8`;

// the slow tier: fine to refresh every 30 s
const DEVICES_SQL = `
SELECT DISTINCT ON (topic) topic, payload, ts FROM telemetry
WHERE topic LIKE 'bikestation/%/status' ORDER BY topic, ts DESC`;

const STATS_SQL = `
SELECT (SELECT count(*) FROM telemetry)::bigint                                   AS raw_rows,
       (SELECT count(*) FROM telemetry_1m WHERE source = 'live')::bigint          AS live_minutes,
       (SELECT count(*) FROM telemetry_1m WHERE source = 'demo')::bigint          AS demo_minutes,
       pg_size_pretty(pg_database_size(current_database()))                       AS db_size,
       (SELECT row_to_json(m) FROM (SELECT ts, rows_in, buckets_out, ms
          FROM maintenance_runs ORDER BY ts DESC LIMIT 1) m)                      AS last_cleanup`;

function maskUid(payload) {
  let uid = '';
  try { uid = JSON.parse(payload).uid || ''; } catch { uid = String(payload || ''); }
  return uid;
}

async function slots() {
  const { rows } = await pool.query(SLOTS_SQL, [SLOTS]);
  const now = Date.now();
  return rows.map((r) => {
    // newer of raw and minute data
    let state = r.state; let ts = r.state_ts;
    if (r.state_1m && (!ts || r.state_1m_ts > ts)) { state = r.state_1m; ts = r.state_1m_ts; }
    const ageS = ts ? Math.round((now - ts.getTime()) / 1000) : null;
    return {
      slot: r.n,
      state: ['free', 'occupied', 'reserved', 'alarm'].includes(state) ? state : 'unknown',
      since: ts,
      ageS,
      fresh: ageS !== null && ageS <= STALE_S,
      distanceCm: r.distance_ts && now - r.distance_ts.getTime() < STALE_S * 1000
        ? Number(r.distance) : null,
    };
  });
}

async function fast() {
  const [slotList, gate, taps, events] = await Promise.all([
    slots(),
    pool.query(GATE_SQL),
    pool.query(TAPS_SQL),
    pool.query(GATE_EVENTS_SQL),
  ]);
  const known = slotList.filter((s) => s.state !== 'unknown');
  const fresh = slotList.some((s) => s.fresh);
  const lastUpdate = slotList.reduce((m, s) => (s.since && (!m || s.since > m) ? s.since : m), null);

  // app openings are logged in gate_events; their synthetic taps are skipped
  const activity = [
    ...taps.rows
      .map((t) => ({ ts: t.ts, uid: maskUid(t.payload) }))
      .filter((t) => !t.uid.startsWith('APP-'))
      .filter((t, i, all) => !(i > 0 && all[i - 1].uid === t.uid && all[i - 1].ts - t.ts < 2000))
      .map((t) => ({ ts: t.ts, kind: 'chip', uid: t.uid.slice(-4) })),
    // the browser words these in the chosen language
    ...events.rows.map((e) => ({ ts: e.ts, kind: 'app', action: e.action, result: e.result })),
  ].sort((a, b) => b.ts - a.ts).slice(0, 8);

  const g = gate.rows[0];
  return {
    now: new Date().toISOString(),
    fresh,
    lastUpdate,
    total: SLOTS,
    known: known.length,
    free: slotList.filter((s) => s.state === 'free').length,
    // a theft alarm on any slot locks the whole station until an admin resets it
    locked: slotList.some((s) => s.state === 'alarm'),
    occupied: slotList.filter((s) => s.state === 'occupied' || s.state === 'reserved').length,
    slots: slotList,
    gate: g ? { angle: Number(g.payload), ts: g.ts } : null,
    activity,
  };
}

async function slow() {
  const [devices, stats] = await Promise.all([pool.query(DEVICES_SQL), pool.query(STATS_SQL)]);
  return {
    devices: devices.rows.map((d) => ({
      name: d.topic.split('/')[1],
      online: d.payload === 'online',
      ts: d.ts,
    })),
    stats: stats.rows[0],
  };
}

module.exports = { fast, slow, STALE_S };
