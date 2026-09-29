# bikestation-web

The mobile dashboard for riders: how many slots are free right now, when it
gets busy, and a button that opens the gate. It runs in its own container on
port **8080**, reads everything from Postgres, and uses MQTT only to send
gate requests.

## Features

- **Free slots, live.** The count and the state of every slot. The page shows
  "sensors offline" when no slot has reported for 20 s.
- **Forecast.** Expected occupancy per hour for today and the next two days.
  It is based on the last 6 weeks (recent days weigh more) and pulled toward
  the live state for the next ~2 hours.
- **Accounts.** Register and log in: scrypt password hashes, a session cookie
  that lasts 30 days, and a registration code because the page is public.
- **Open the gate from your phone** (press and hold) to **park** or **pick up**.
- **"Mein Rad".** Your reservation with a 5-minute countdown, or your parked
  bike with the parking time. Your slot is marked in the grid.
- **Link a chip.** *Verknüpfen* opens a 60 s window; the next unknown chip
  tapped at the reader is linked to your account.
- **Alarm aware.** When the station is locked by a theft alarm, the page says so
  and gate requests are refused.
- **Three languages.** German, English and Dutch via the flag button. The first
  visit follows the browser language.

## Run it

It is part of the main stack:

```bash
docker compose up -d --build web
```

Then open `http://<pi>:8080`. Health check: `GET /healthz`.

## How "open the gate" works

The app acts exactly like an NFC chip. It publishes a tap on
`bikestation/entrance/nfc/tap`:

```json
{"uid": "APP-<username>", "action": "park", "source": "app"}
```

Node-RED then applies the station rules (see the
[main README](../README.md#station-logic)).

1. **Checks first.** Before publishing, the app refuses the request when the
   station is locked, full, or the user already has a bike (park) or has none
   (pickup). There is also a 10 s cooldown per user.
2. **It waits for the station.** For up to 3 s the app looks for the station's
   answer (gate `open` or an LCD message) in the telemetry.
3. **Result:**
   - gate opened → success, together with the reserved slot;
   - the station answered but did not open → the refusal reason from the LCD
     (`refused`);
   - no answer (e.g. Node-RED is restarting) → `no_answer`, and the user may
     retry right away.

Every attempt is logged in `gate_events`.

## Configuration

Environment variables (set in `docker-compose.yml`):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `PGHOST` / `PGPORT` / `PGDATABASE` | `postgres` / `5432` / `bikestation` | database |
| `PGUSER` / `PGPASSWORD` | – | database login |
| `MQTT_URL` | `mqtt://mosquitto:1883` | broker for gate requests |
| `REGISTRATION_CODE` | empty (no code needed) | code required to create an account; compose sets `Hack-a-bike` |
| `GATE_COOLDOWN_SECONDS` | `10` | minimum time between two gate requests per user |
| `SLOT_COUNT` | `4` | number of slots |
| `STALE_AFTER_S` | `20` | seconds without data before a slot counts as offline |
| `CLEANUP_INTERVAL_MIN` | `5` | how often raw telemetry is rolled up |
| `CLEANUP_KEEP_RAW_MIN` | `5` | how long raw slot telemetry is kept |
| `SEED_DEMO` | on | `0` disables the demo history |
| `DEMO_DAYS` | `28` | days of demo history |

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/live` | – | live snapshot: slots, free count, lock, gate, activity |
| `GET` | `/api/stream` | – | the same as server-sent events |
| `GET` | `/api/forecast` | – | occupancy forecast |
| `GET` | `/api/config` | – | e.g. whether a registration code is needed |
| `GET` | `/api/me` | – | the logged-in user or `null` |
| `POST` | `/api/register` · `/api/login` · `/api/logout` | – | accounts |
| `GET` | `/api/me/bike` | user | current reservation / parked bike |
| `GET` | `/api/me/chip` | user | linked chip |
| `POST` | `/api/me/chip/pair` · `/cancel` · `/unlink` | user | link a chip |
| `POST` | `/api/gate` | user | `{"action":"park"\|"pickup"}` |

Errors come back as `{"code": "...", "error": "..."}`. The page translates the
`code` (texts are in `public/i18n.js`).

## Data housekeeping

Every 5 minutes, raw rows of `bikestation/slotN/{state,distance,sensor}` that are
older than 5 minutes are folded into `telemetry_1m` and then deleted.
`telemetry_1m` holds one row per topic and minute: sample count, avg/min/max
and the last payload. For slot state, `value_avg` is the share of the minute
the slot was not free.

Taps, gate and status messages stay raw. Every run is logged in
`maintenance_runs`.

## Demo data

On first start, 4 weeks of simulated parking are written to `telemetry_1m`
with `source = 'demo'`, so the forecast has a history. Remove them with:

```sql
DELETE FROM telemetry_1m WHERE source = 'demo';
```

They are generated again on the next start unless `SEED_DEMO=0`.
