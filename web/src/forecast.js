// Expected occupancy per hour for today and the next two days.
//
// 1. Profile: for every (weekday, hour) the mean share of occupied slots over
//    the last 6 weeks of minute data, weighted so recent days count more
//    (half-life ~10 days).
// 2. Past hours of today show what was actually measured.
// 3. The next few hours are pulled toward the live occupancy right now,
//    fading out over ~2 h - the current state is the best predictor of the
//    near future, the weekly pattern of the far one.
const { pool } = require('./db');

const TZ = 'Europe/Berlin';
const SLOTS = Number(process.env.SLOT_COUNT || 4);
const STATE_RE = '^bikestation/slot[0-9]+/state$';

const PROFILE_SQL = `
SELECT extract(isodow FROM bucket AT TIME ZONE '${TZ}')::int AS dow,
       extract(hour   FROM bucket AT TIME ZONE '${TZ}')::int AS hour,
       sum(value_avg * w) / nullif(sum(w), 0)                  AS occ
FROM (
  SELECT bucket, value_avg,
         exp(-extract(epoch FROM now() - bucket) / 86400 / 14) AS w
  FROM telemetry_1m
  WHERE topic ~ '${STATE_RE}' AND value_avg IS NOT NULL
    AND bucket > now() - interval '42 days'
) s
GROUP BY 1, 2`;

const DAYS_SQL = `
SELECT count(DISTINCT (bucket AT TIME ZONE '${TZ}')::date)::int AS days,
       bool_or(source = 'demo') AS has_demo
FROM telemetry_1m
WHERE topic ~ '${STATE_RE}' AND bucket > now() - interval '42 days'`;

// what was measured today, per local hour: minute rows plus not yet
// downsampled raw rows
const TODAY_SQL = `
WITH day AS (SELECT date_trunc('day', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}' AS start),
v AS (
  SELECT bucket AS ts, value_avg AS v, samples AS n FROM telemetry_1m, day
  WHERE topic ~ '${STATE_RE}' AND bucket >= day.start AND value_avg IS NOT NULL AND source = 'live'
  UNION ALL
  SELECT ts, CASE WHEN payload IN ('occupied','reserved') THEN 1 ELSE 0 END, 1 FROM telemetry, day
  WHERE topic ~ '${STATE_RE}' AND ts >= day.start AND payload IN ('occupied','reserved','free')
)
SELECT extract(hour FROM ts AT TIME ZONE '${TZ}')::int AS hour,
       sum(v * n) / sum(n) AS occ
FROM v GROUP BY 1`;

function localParts(date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, weekday: 'short', hour: '2-digit', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t) => f.find((p) => p.type === t).value;
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1;
  return { dow, hour: Number(get('hour')), date: `${get('year')}-${get('month')}-${get('day')}` };
}

const pct = (x) => Math.round(Math.max(0, Math.min(1, x)) * 100);

async function build(live) {
  const [{ rows: prof }, { rows: today }, { rows: [span] }] = await Promise.all([
    pool.query(PROFILE_SQL), pool.query(TODAY_SQL), pool.query(DAYS_SQL),
  ]);
  const profile = new Map(prof.map((r) => [`${r.dow}-${r.hour}`, r]));
  const measured = new Map(today.map((r) => [r.hour, Number(r.occ)]));

  // live occupancy only counts if the sensors are actually reporting
  const liveOcc = live && live.fresh && live.known > 0 ? live.occupied / live.known : null;

  const now = new Date();
  const nowParts = localParts(now);
  const days = [];
  for (let d = 0; d < 3; d++) {
    const dayDate = new Date(now.getTime() + d * 86400000);
    const p = localParts(dayDate);
    const hours = [];
    for (let h = 0; h < 24; h++) {
      const prof = profile.get(`${p.dow}-${h}`);
      const base = prof ? Number(prof.occ) : null;
      const offset = d * 24 + h - nowParts.hour; // hours from now
      let kind; let occ;
      if (offset < 0) {
        kind = 'measured';
        occ = measured.has(h) ? measured.get(h) : null;
      } else {
        kind = offset === 0 ? 'now' : 'forecast';
        occ = base;
        if (liveOcc !== null) {
          const a = Math.exp(-offset / 2);
          occ = base === null ? liveOcc : a * liveOcc + (1 - a) * base;
        }
      }
      hours.push({
        hour: h,
        kind,
        occupancy: occ === null ? null : pct(occ),
        expectedFree: occ === null ? null : Math.round(SLOTS * (1 - occ) * 10) / 10,
      });
    }
    days.push({ date: p.date, dow: p.dow, label: ['Heute', 'Morgen', 'Übermorgen'][d], hours });
  }

  // best / busiest hour in the next 24 h, only when people actually ride (7-20 local)
  const upcoming = days.flatMap((day, di) => day.hours.map((h) => ({ ...h, day: di, label: day.label })))
    .filter((h) => h.kind !== 'measured' && h.occupancy !== null && h.hour >= 7 && h.hour <= 20)
    .slice(0, 14);
  const pick = (cmp) => upcoming.reduce((a, b) => (a === null || cmp(b, a) ? b : a), null);
  const best = pick((b, a) => b.occupancy < a.occupancy);
  const peak = pick((b, a) => b.occupancy > a.occupancy);

  return {
    generatedAt: now.toISOString(),
    slots: SLOTS,
    trainingDays: span.days,
    includesDemo: Boolean(span.has_demo),
    liveBlended: liveOcc !== null,
    best, peak, days,
  };
}

module.exports = { build };
