# bikestation-web

Mobile dashboard for the bikestation, served on port **8080** by its own
container. Everything it shows is read from Postgres; MQTT is used only to
open and close the gate.

- **Free slots first**: live count, per-slot state, "sensors offline" when no
  slot has reported for 20 s (`STALE_AFTER_S`).
- **Forecast**: expected occupancy per hour for today and the next two days,
  from the weekday/hour average of the last 6 weeks (recent days weigh more),
  pulled toward the live state for the next ~2 hours.
- **Accounts**: register / log in (scrypt hashes, session cookie, 30 days).
  Set `REGISTRATION_CODE` in the compose environment to require a code.
- **Gate from the phone** (press and hold):
  - *Einparken* publishes a tap `{"uid":"APP-<user>"}` on
    `bikestation/entrance/nfc/tap`, so Node-RED reserves a slot and shows it on
    the LCD like for a chip, then sends `open`, and `close` after
    `GATE_OPEN_SECONDS`, to `bikestation/entrance/gate`.
  - *Abholen* only opens and closes the gate.
  - Refused while the station is full (when the sensors are live), 10 s
    cooldown per user; every attempt is logged in `gate_events`.

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
