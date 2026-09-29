# bikestation-web

Mobile dashboard for the bikestation, served on port **8080** by its own
container. Everything it shows is read from Postgres; MQTT is used only to
open and close the gate.

- **Languages**: German, English, Dutch via the flag button in the header;
  the choice is kept in the browser, the first visit follows the browser
  language. Texts live in `public/i18n.js`; the API returns error `code`s
  that the page translates.
- **Free slots first**: live count, per-slot state, "sensors offline" when no
  slot has reported for 20 s (`STALE_AFTER_S`).
- **Forecast**: expected occupancy per hour for today and the next two days,
  from the weekday/hour average of the last 6 weeks (recent days weigh more),
  pulled toward the live state for the next ~2 hours.
- **Accounts**: register / log in (scrypt hashes, session cookie, 30 days).
  Creating an account needs the registration code (`REGISTRATION_CODE`,
  default `Hack-a-bike` in `docker-compose.yml`) because the dashboard is
  published on the internet through Pangolin.
- **Gate from the phone** (press and hold): publishes a tap
  `{"uid":"APP-<user>","action":"park"|"pickup"}` on
  `bikestation/entrance/nfc/tap`. Node-RED handles it exactly like a chip -
  LCD greeting, slot reservation, gate open/close (see the main README,
  "Station logic"). Refused while the station is full (when the sensors are
  live), 10 s cooldown per user; every attempt is logged in `gate_events`.
- **Mein Rad**: the current reservation with a 5-minute countdown, or the
  parked bike with a running parking time, and the last parking duration.
  Your slot is marked in the slot grid. Read from `parking_sessions` (by
  account, app uid and linked chip).
- **Link a chip**: "Verknüpfen" opens a 60 s window; the next unknown chip
  tapped at the reader is linked to the account (Node-RED does the linking in
  its tap lookup). Afterwards the station greets you by name for chip taps.

## Data housekeeping

Every 5 minutes (`CLEANUP_INTERVAL_MIN`) raw rows of
`bikestation/slotN/{state,distance,sensor}` older than 5 minutes are folded
into `telemetry_1m` (one row per topic and minute: sample count, avg/min/max,
last payload) and deleted. For slot state, `value_avg` is the share of the
minute the slot was not free. Taps, gate and status messages stay raw. Runs
are logged in `maintenance_runs`.

## Demo data

On first start, 4 weeks of simulated parking sessions are written to
`telemetry_1m` with `source = 'demo'`, ending where real data begins, so the
forecast has a history. Remove them with

    DELETE FROM telemetry_1m WHERE source = 'demo';

(they are regenerated on the next start unless `SEED_DEMO=0`).
