// Fictional history so the forecast has something to learn from on day one.
// Rows go into telemetry_1m with source = 'demo', only for the time before the
// first real data, and only once. Remove them with:
//   DELETE FROM telemetry_1m WHERE source = 'demo';
//
// Instead of flipping a coin per minute (which looks like noise), each slot is
// simulated as a sequence of parking sessions: a bike arrives with a rate that
// depends on weekday and hour, then stays for a duration that depends on when
// it arrived (commuters all day, shoppers an hour or two).
const { pool } = require('./db');

const SLOTS = Number(process.env.SLOT_COUNT || 4);
const DAYS = Number(process.env.DEMO_DAYS || 28);

// arrivals per hour while a slot is free, index = local hour
const WEEKDAY = [0.02, 0.02, 0.01, 0.01, 0.02, 0.06, 0.2, 0.45, 0.4, 0.2, 0.15, 0.18,
  0.35, 0.3, 0.15, 0.18, 0.25, 0.3, 0.22, 0.18, 0.1, 0.06, 0.04, 0.03];
const WEEKEND = [0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.02, 0.04, 0.08, 0.15, 0.3, 0.35,
  0.4, 0.38, 0.35, 0.32, 0.28, 0.22, 0.16, 0.12, 0.08, 0.06, 0.04, 0.03];
// some slots are simply more popular (closest to the entrance)
const POPULARITY = [1.25, 1.1, 0.95, 0.8];

// small seeded PRNG so every Pi gets the same demo history
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stayMinutes(rand, date) {
  const h = date.getHours();
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5; // ~N(0, 0.5)
  if (!weekend && h >= 6 && h <= 9 && rand() < 0.55) {
    return Math.round(Math.min(660, Math.max(240, 510 + gauss() * 120))); // commuter
  }
  if (weekend) return Math.round(45 + rand() * rand() * 240);
  return Math.round(25 + rand() * rand() * 200);
}

async function seedIfEmpty() {
  if (process.env.SEED_DEMO === '0') return;
  const { rows: [{ n }] } = await pool.query(
    "SELECT count(*)::int AS n FROM telemetry_1m WHERE source = 'demo'");
  if (n > 0) return;

  // stop where real data begins, so demo rows never overlap live rows
  const { rows: [{ first }] } = await pool.query(`
    SELECT least(
      (SELECT min(ts) FROM telemetry WHERE topic ~ '^bikestation/slot[0-9]+/state$'),
      (SELECT min(bucket) FROM telemetry_1m WHERE source = 'live')
    ) AS first`);
  const end = new Date(Math.floor((first ? first.getTime() : Date.now()) / 60000) * 60000);
  const start = new Date(end.getTime() - DAYS * 86400000);

  const rand = mulberry32(20260929);
  const buckets = []; const topics = []; const values = []; const payloads = [];

  for (let s = 0; s < SLOTS; s++) {
    const pop = POPULARITY[s] ?? 1;
    let busyUntil = 0;
    for (let t = start.getTime(); t < end.getTime(); t += 60000) {
      const d = new Date(t);
      if (t >= busyUntil) {
        const weekend = d.getDay() === 0 || d.getDay() === 6;
        const rate = (weekend ? WEEKEND : WEEKDAY)[d.getHours()] * pop;
        if (rand() < rate / 60) busyUntil = t + stayMinutes(rand, d) * 60000;
      }
      const occ = t < busyUntil ? 1 : 0;
      buckets.push(d); topics.push(`bikestation/slot${s + 1}/state`);
      values.push(occ); payloads.push(occ ? 'occupied' : 'free');
    }
  }

  const BATCH = 10000;
  for (let i = 0; i < buckets.length; i += BATCH) {
    await pool.query(`
      INSERT INTO telemetry_1m (bucket, topic, samples, value_avg, value_min, value_max, last_payload, source)
      SELECT b, t, 300, v, v, v, p, 'demo'
      FROM unnest($1::timestamptz[], $2::text[], $3::float8[], $4::text[]) AS x(b, t, v, p)
      ON CONFLICT (topic, bucket) DO NOTHING`,
    [buckets.slice(i, i + BATCH), topics.slice(i, i + BATCH),
      values.slice(i, i + BATCH), payloads.slice(i, i + BATCH)]);
  }
  console.log(`seed: ${buckets.length} demo minute rows, ${start.toISOString()} .. ${end.toISOString()}`);
}

module.exports = { seedIfEmpty };
