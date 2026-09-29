// Every few minutes the 5 Hz slot topics are folded into one row per topic and
// minute (telemetry_1m) and the raw rows are deleted. Events that matter one
// by one - NFC taps, gate commands, ESP status - stay raw in telemetry.
const { pool } = require('./db');

const INTERVAL_MS = Number(process.env.CLEANUP_INTERVAL_MIN || 5) * 60_000;
// raw rows younger than this stay untouched, so live views still see seconds
const KEEP_RAW_MIN = Number(process.env.CLEANUP_KEEP_RAW_MIN || 5);

// The cutoff is minute-aligned, so a minute is never split across two runs.
// DELETE ... RETURNING feeds the aggregate, in one statement, so a row can
// neither be aggregated twice nor lost between the two steps.
const DOWNSAMPLE_SQL = `
WITH moved AS (
  DELETE FROM telemetry
  WHERE ts < date_trunc('minute', now() - make_interval(mins => $1))
    AND topic ~ '^bikestation/slot[0-9]+/(state|distance|sensor)$'
  RETURNING ts, topic, payload
), valued AS (
  SELECT ts, topic, payload,
         CASE
           WHEN payload ~ '^-?[0-9]+(\\.[0-9]+)?$'   THEN payload::double precision
           WHEN payload IN ('occupied', 'reserved')  THEN 1
           WHEN payload IN ('free', 'ok')            THEN 0
           WHEN payload = 'no_echo'                  THEN 1
         END AS v
  FROM moved
), ins AS (
  INSERT INTO telemetry_1m AS t (bucket, topic, samples, value_avg, value_min, value_max, last_payload, source)
  SELECT date_trunc('minute', ts), topic, count(*), avg(v), min(v), max(v),
         (array_agg(payload ORDER BY ts DESC))[1], 'live'
  FROM valued
  GROUP BY 1, 2
  ON CONFLICT (topic, bucket) DO UPDATE SET
    samples      = t.samples + EXCLUDED.samples,
    value_avg    = CASE
                     WHEN t.value_avg IS NULL THEN EXCLUDED.value_avg
                     WHEN EXCLUDED.value_avg IS NULL THEN t.value_avg
                     ELSE (t.value_avg * t.samples + EXCLUDED.value_avg * EXCLUDED.samples)
                          / (t.samples + EXCLUDED.samples)
                   END,
    value_min    = LEAST(t.value_min, EXCLUDED.value_min),
    value_max    = GREATEST(t.value_max, EXCLUDED.value_max),
    last_payload = EXCLUDED.last_payload,
    source       = 'live'
  RETURNING 1
)
SELECT (SELECT count(*) FROM moved)::int AS rows_in,
       (SELECT count(*) FROM ins)::int   AS buckets_out
`;

let running = false;

async function runOnce() {
  if (running) return null;
  running = true;
  const t0 = Date.now();
  try {
    const { rows } = await pool.query(DOWNSAMPLE_SQL, [KEEP_RAW_MIN]);
    const { rows_in, buckets_out } = rows[0];
    const ms = Date.now() - t0;
    await pool.query(
      'INSERT INTO maintenance_runs (rows_in, buckets_out, ms) VALUES ($1, $2, $3)',
      [rows_in, buckets_out, ms],
    );
    console.log(`cleanup: ${rows_in} raw rows -> ${buckets_out} minute rows in ${ms} ms`);
    return { rows_in, buckets_out, ms };
  } catch (err) {
    console.error('cleanup failed:', err.message);
    return null;
  } finally {
    running = false;
  }
}

function start() {
  setTimeout(runOnce, 20_000); // first pass shortly after boot
  setInterval(runOnce, INTERVAL_MS);
}

module.exports = { start, runOnce };
