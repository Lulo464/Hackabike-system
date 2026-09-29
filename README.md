# Smart Bikestation — MQTT Backend

MQTT broker and dashboard for a smart bicycle parking station. A Raspberry Pi
runs Mosquitto and Node-RED; an ESP32-S3 reads the sensors and publishes to the
broker over WiFi.

![architecture](docs/Design_v2.svg)

## Stack

| Service    | Image                | Ports          | Purpose                                         |
|------------|----------------------|----------------|-------------------------------------------------|
| Node-RED   | `nodered/node-red`   | `1880`         | Flow engine + FlowFuse UI                       |
| Mosquitto  | `mosquitto:2`        | `1883`, `9001` | MQTT broker (TCP + WebSocket)                   |
| Postgres   | `postgres:16-alpine` | `5432`         | Every `bikestation/#` message, minute rollups   |
| Web        | `./web` (Node 22)    | `8080`         | Mobile dashboard, forecast, gate by phone       |
| Newt       | `fosrl/newt`         | –              | Pangolin tunnel, **separate compose in `~/newt`** |

- **Mobile dashboard:** `http://<pi>:8080` (see [web/README.md](web/README.md))
- **Node-RED editor:** `http://<pi>:1880/red/`
- **Node-RED dashboard:** `http://<pi>:1880/dashboard`
- **MQTT:** `mqtt://<pi>:1883` from the ESP32, `ws://<pi>:9001` from the browser
- **Postgres:** `psql -h <pi> -U nodered -d bikestation` (password in `docker-compose.yml`)

## Quick start

```bash
# one-time setup on a clean Raspberry Pi OS
./install.sh

# start the stack
docker compose up -d

# follow logs
docker compose logs -f

# stop
docker compose down
```

Both services bind to all interfaces, so they are reachable from the LAN as
soon as the stack is up.

## Layout

```
docker-compose.yml
install.sh                     one-time host setup (Docker + SSH key)
enable-ssh-key.sh              push this machine's public key to the Pi
gen_flows.py                   generator for nodered/flows.json
dockerfiles/
  mosquitto/Dockerfile
  nodered/Dockerfile
  nodered/start.sh             installs the dashboard module, then starts Node-RED
mosquitto/
  config/mosquitto.conf        listeners, persistence, anonymous access (demo)
postgres/
  init/01_schema.sql           telemetry table + occupancy views (first start only)
web/                           mobile dashboard container, see web/README.md
newt/
  docker-compose.example.yml   template for the Pangolin tunnel (real file on the Pi)
nodered/
  settings.js                  /red editor root, credential secret
  flows.json                   generated flow — edit gen_flows.py, not this
docs/
  Hackathon.md                 architecture, topic schema, BOM
  Design_v2.svg                physical design
```

`nodered/flows.json` is generated. Change `gen_flows.py` and re-run:

```bash
python3 gen_flows.py
```

## MQTT topics

All under the `bikestation/` root.

| Topic                              | Direction      | Payload                     |
|------------------------------------|----------------|-----------------------------|
| `bikestation/entrance/nfc/tap`      | ESP32 → broker | `{"uid":"A1B2","timestamp":…}` |
| `bikestation/entrance/oled/display` | broker → ESP32 | `{"text":"Welcome!"}`       |
| `bikestation/slot/{1-4}/proximity`  | ESP32 → broker | distance + occupancy        |
| `bikestation/slot/{1-4}/vibration`  | ESP32 → broker | g-force + sabotage alert    |
| `bikestation/slot/{1-4}/led`        | broker → ESP32 | slot, colour, blink         |
| `bikestation/system/alerts`        | ESP32 → broker | alert text                  |
| `bikestation/system/status`        | ESP32 → broker | LWT online/offline          |

Publish a test message:

```bash
docker compose exec mosquitto mosquitto_pub \
  -t 'bikestation/system/status' -m '{"status":"online"}'
```

## Hardware

`docs/Hackathon.md` has the full architecture. Short version — ESP32-S3 as the
single controller, Pi as server:

| Peripheral              | Bus  | Address |
|-------------------------|------|---------|
| PCF8574 GPIO expander    | I²C  | `0x20`  |
| PN532 NFC reader        | I²C  | `0x24`  |
| SSD1306 OLED 1.3"       | I²C  | `0x3C`  |
| ADXL345 accelerometer   | I²C  | `0x53`  |
| WS2812B strip (60 LEDs) | GPIO 8 | —     |

## Station logic (Node-RED)

Chip and app taps take the same path through the flow:

1. `tap -> lookup params` / `who tapped?` looks the uid up in Postgres
   (`app_users.rfid_uid`, or `APP-<username>` for the app). If an account is
   waiting to link a chip (`pair_until`), the chip is linked instead and the
   tap does nothing else.
2. `Station logic` decides: a known chip with a parked bike means **pickup**,
   otherwise **park** (the app says which). Park reserves the first free slot
   for **5 minutes**; several reservations can exist at once.
3. LCD (16x2, ASCII only): `Hallo <Name> / Willkommen!` -> after 2 s
   `Park at Slot N / Gate ist offen` (or `Rad in Slot N / Gute Fahrt!`,
   `Station Full!`) -> after 10 s more `Willkommen! / Bitte scannen`.
4. The gate opens and closes again after 8 s.
5. Every reservation is a row in `parking_sessions`:
   `reserved -> parked` (bike arrives) `-> done` (bike leaves), or
   `reserved -> expired`. A slot only counts as changed after 5 equal readings
   (~1 s), so sensor flicker does not end a session.

The Postgres ingest (`bikestation/#`) uses its **own MQTT connection**
(`bikestation-broker (db ingest)`): on the shared connection the broker
delivered every message once per matching subscription, so taps arrived
twice.

## Remote access

The Pi is reachable from outside the LAN in two ways. Neither is configured
by `docker compose up` in this repo, because both need secrets.

### Pangolin / Newt - public internet

A **Newt** container connects out to the Pangolin server at
`https://app.heppner.site` and keeps a tunnel open. Whatever is added as a
resource for this site in the **Pangolin UI** is then **published on the
internet** - no port forwarding on the router needed.

- Runs from `~/newt/docker-compose.yml` on the Pi (not in this repo, it holds
  `NEWT_SECRET`). Template: [`newt/docker-compose.example.yml`](newt/docker-compose.example.yml).
- Status: `docker logs newt` should show
  `Tunnel connection to server established successfully!`
- Targets to enter in Pangolin (both reachable from inside the Newt container):
  - mobile dashboard: `192.168.91.67:8080`
  - Node-RED dashboard: `192.168.91.67:1880` - **editor has no login**, see below
- Which services are actually public is decided in the Pangolin UI, not here.

Because the mobile dashboard is public, **creating an account needs the
registration code `Hack-a-bike`** (`REGISTRATION_CODE` in
`docker-compose.yml`). Anyone with an account can open the gate.

### WireGuard - team VPN

The Pi is a WireGuard peer with address **`10.50.10.51`**
(`ssh group12@10.50.10.51` from a device on the VPN). Config in
`/etc/wireguard/wg0.conf` (root only, holds the private key, not in git),
started by `wg-quick@wg0` on boot. It routes only `10.10.10.0/24`,
`10.20.10.0/24` and `10.50.10.0/24` through the tunnel; the LAN stays
untouched. After editing the config: `sudo systemctl restart wg-quick@wg0`.

## Security notes

This is a demo configuration. Before any real deployment:

- [ ] **Services are published on the internet through Pangolin.** Only add
      the mobile dashboard as a resource, never Mosquitto (`1883`/`9001`) or
      Postgres (`5432`) - neither has a real password.
- [ ] **The registration code `Hack-a-bike` is in the repo.** Fine for the
      hackathon; for anything longer set `REGISTRATION_CODE` in a `.env`
      on the Pi instead and remove the default.
- [ ] **Postgres uses the demo password `hackathon2026`**, from
      `docker-compose.yml`. Override `POSTGRES_PASSWORD` in `.env`.

- [ ] **Mosquitto allows anonymous access.** `allow_anonymous true` in
      `mosquitto/config/mosquitto.conf`. Add a `password_file` and create
      broker users.
- [ ] **No broker ACLs.** The commented topic examples are documentation only —
      nothing currently restricts which topics a client may read or write.
- [ ] **Node-RED has no authentication.** Anyone who can reach port 1880 can
      edit flows and reach the broker - including through Pangolin if 1880 is
      published there. Add `adminAuth` in `nodered/settings.js`.
- [ ] **`credentialSecret` is a known placeholder**
      (`nodered/settings.js`). Anyone with it can decrypt `flows_cred.json`.
      Replace it with a random value and keep it out of version control.
- [ ] **`enable-ssh-key.sh` contains a public SSH key.** Public keys are not
      secrets, but this one is machine-specific.

## Known issues


**Hardware is unsettled.** `docs/Design_v2.svg` and the current documentation
disagree:

- The SVG shows **three** slots; the documentation targets **four**.
- The SVG includes a battery and solar panel; the design is wall-powered only.
- The SVG shows per-slot vibration sensors; the documentation has one shared
  ADXL345.
- Four `VL53L1X` distance sensors normally share I²C address `0x29` and need a
  TCA9548A multiplexer, separate buses, or configurable-address sensors. The
  PCF8574 is a digital GPIO expander and cannot read I²C distance sensors.

`docs/Hackathon.md` says Raspberry Pi 5; the target hardware is a Pi 4 Model B
Rev 1.5, 4 GB.
