# Postgres – database

The station's memory: accounts, linked chips, parking sessions, and every MQTT
message that ever went over the broker.

| | |
|---|---|
| Image | `postgres:16-alpine` |
| Container | `bikestation-postgres` |
| Database / user | `bikestation` / `nodered` |
| Password | `POSTGRES_PASSWORD`, default `hackathon2026` (override it in `.env`) |
| Port | **5432** (LAN) · `postgres:5432` inside Docker |
| Data | Docker volume `postgres_data`, **not** a folder in this repo |

## Connect

```bash
# on the Pi
docker compose exec postgres psql -U nodered -d bikestation

# from a laptop on the LAN
psql -h <pi> -U nodered -d bikestation
```

## Where the schema comes from

Two places create tables, and both are safe to run more than once:

| Source | When | Creates |
|---|---|---|
| [`init/01_schema.sql`](init/01_schema.sql) | **only** on the very first start, with an empty volume | `telemetry`, `v_occupancy`, `v_occupancy_transitions` |
| [`web/src/db.js`](../web/src/db.js) (`SCHEMA`) | every time the web container starts | all other tables |

> [!IMPORTANT]
> Put new tables and columns into `web/src/db.js` (`CREATE … IF NOT EXISTS`,
> `ALTER TABLE … ADD COLUMN IF NOT EXISTS`). A change in `init/01_schema.sql`
> never reaches an existing database.

## Tables

| Table | Written by | Contents |
|---|---|---|
| `telemetry` | Node-RED (every `bikestation/#` message) | `ts`, `topic`, `payload`, raw |
| `telemetry_1m` | web (cleanup job, demo seeder) | one row per topic and minute: `samples`, `value_avg/min/max`, `last_payload`, `source` (`live`/`demo`) |
| `app_users` | web (register), Node-RED (chip linking) | `username`, `display_name`, `password_hash` (scrypt), `rfid_uid`, `pair_until` |
| `app_sessions` | web | login sessions (`token_hash`, `expires_at`) |
| `parking_sessions` | Node-RED station logic | one row per reservation: `uid`, `user_id`, `slot`, `status`, times |
| `gate_events` | web | every gate request from the app: `action` (`park`/`pickup`), `result` (`opened`/`full`/`error`), `detail` |
| `maintenance_runs` | web | one row per cleanup run |

| View | Contents |
|---|---|
| `v_occupancy` | slot state messages with the previous value |
| `v_occupancy_transitions` | only the real state changes (`free` → `reserved` → `occupied` …) |

### Parking session lifecycle

```
reserved ──(bike arrives)──► parked ──(bike leaves / alarm cleared)──► done
    └──(5 min, no bike)──► expired
```

`uid` is the chip uid (e.g. `F362DD0B`) or `APP-<username>` for app requests.

## Data lifecycle

- **Slot telemetry** (`slotN/state`, `distance`, `sensor`, several messages
  per second and slot) is folded into `telemetry_1m` after 5 minutes and then deleted
  from `telemetry`.
- **Everything else** (taps, LCD, gate, status, alerts) stays in `telemetry` for good.
- **Demo data:** on first start the web app writes 4 weeks of simulated history
  into `telemetry_1m` (`source = 'demo'`) so the forecast has something to work with.

Size check:

```sql
SELECT relname, n_live_tup AS rows, pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC;
```

## Useful queries

```sql
-- who is parked or has a reservation right now
SELECT s.slot, s.status, u.display_name, s.uid, s.reserved_at, s.parked_at
FROM parking_sessions s LEFT JOIN app_users u ON u.id = s.user_id
WHERE s.status IN ('reserved', 'parked') ORDER BY s.slot;

-- accounts and their chips
SELECT id, username, display_name, rfid_uid FROM app_users ORDER BY id;

-- the last 20 taps, LCD texts and gate commands
SELECT ts, topic, payload FROM telemetry
WHERE topic LIKE 'bikestation/entrance/%' ORDER BY ts DESC LIMIT 20;

-- theft alarms
SELECT ts, payload FROM telemetry
WHERE topic = 'bikestation/system/alerts' ORDER BY ts DESC;

-- slot changes today
SELECT * FROM v_occupancy_transitions WHERE ts > current_date ORDER BY ts;

-- unlink a chip
UPDATE app_users SET rfid_uid = NULL WHERE username = '<name>';

-- remove the demo history
DELETE FROM telemetry_1m WHERE source = 'demo';
```

## Backup and restore

```bash
# backup
docker compose exec -T postgres pg_dump -U nodered -Fc bikestation > bikestation_$(date +%F).dump

# restore into the running database (overwrites existing objects)
docker compose exec -T postgres pg_restore -U nodered -d bikestation --clean --if-exists < bikestation_2026-09-29.dump
```

## Start from scratch

> [!CAUTION]
> This deletes **all** accounts, sessions and history.

```bash
docker compose down
docker volume rm "$(basename "$PWD")_postgres_data"
docker compose up -d        # init/01_schema.sql runs again, web recreates the rest
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Node-RED or web start before the database is ready | Both wait: compose waits for the healthcheck (`pg_isready`), and web retries for 60 s. |
| `relation "…" does not exist` | The web container was not started yet; it creates the tables (`docker compose up -d web`). |
| Changed `init/01_schema.sql` has no effect | It only runs on an empty volume. Put the change into `web/src/db.js`. |
| Database keeps growing | Check the size query above; non-slot telemetry is never deleted. |
