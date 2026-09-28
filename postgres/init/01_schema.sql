-- Runs once, when the postgres container starts with an empty data volume.
-- Every message under bikestation/# lands in one generic table; the views
-- turn the 5 Hz republished slot state into real transitions at query time.

CREATE TABLE IF NOT EXISTS telemetry (
    id      bigserial   PRIMARY KEY,
    ts      timestamptz NOT NULL DEFAULT now(),
    topic   text        NOT NULL,
    payload text
);

CREATE INDEX IF NOT EXISTS telemetry_topic_ts ON telemetry (topic, ts);

CREATE OR REPLACE VIEW v_occupancy AS
SELECT topic,
       ts,
       payload,
       LAG(payload) OVER (PARTITION BY topic ORDER BY ts) AS prev
FROM telemetry
WHERE topic LIKE 'bikestation/slot%/state';

CREATE OR REPLACE VIEW v_occupancy_transitions AS
SELECT topic, ts, payload AS state
FROM v_occupancy
WHERE payload IS DISTINCT FROM prev;
