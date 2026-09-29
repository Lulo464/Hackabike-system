// Postgres pool plus the schema this service owns. The init script under
// postgres/init only runs on an empty volume, so everything added after the
// first start is created here, idempotently, on every boot.
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'postgres',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'bikestation',
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 8,
});

const SCHEMA = `
-- one row per topic and minute; filled by the cleanup job from telemetry,
-- and by the demo seeder (source = 'demo')
CREATE TABLE IF NOT EXISTS telemetry_1m (
  bucket       timestamptz      NOT NULL,
  topic        text             NOT NULL,
  samples      integer          NOT NULL,
  value_avg    double precision,          -- numeric payloads; slot state: share of samples not free
  value_min    double precision,
  value_max    double precision,
  last_payload text,
  source       text             NOT NULL DEFAULT 'live',
  PRIMARY KEY (topic, bucket)
);
CREATE INDEX IF NOT EXISTS telemetry_1m_bucket ON telemetry_1m (bucket);

CREATE TABLE IF NOT EXISTS app_users (
  id            bigserial   PRIMARY KEY,
  username      text        NOT NULL UNIQUE,
  display_name  text        NOT NULL,
  password_hash text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash text        PRIMARY KEY,
  user_id    bigint      NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS gate_events (
  id      bigserial   PRIMARY KEY,
  ts      timestamptz NOT NULL DEFAULT now(),
  user_id bigint      REFERENCES app_users (id) ON DELETE SET NULL,
  action  text        NOT NULL,   -- park | pickup
  result  text        NOT NULL,   -- opened | full | error
  detail  text
);

CREATE TABLE IF NOT EXISTS maintenance_runs (
  id          bigserial   PRIMARY KEY,
  ts          timestamptz NOT NULL DEFAULT now(),
  rows_in     integer     NOT NULL,
  buckets_out integer     NOT NULL,
  ms          integer     NOT NULL
);
`;

async function migrate() {
  await pool.query(SCHEMA);
}

// Postgres may still be starting when compose brings us up after a reboot.
async function waitForDb(tries = 30) {
  for (let i = 1; ; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i >= tries) throw err;
      console.log(`db not ready (${err.code || err.message}), retry ${i}/${tries}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

module.exports = { pool, migrate, waitForDb };
