# Smart Bikestation — MQTT Backend

MQTT broker and dashboard for a smart bicycle parking station. A Raspberry Pi
runs Mosquitto and Node-RED; an ESP32-S3 reads the sensors and publishes to the
broker over WiFi.

![architecture](docs/Design_v2.svg)

## Stack

| Service    | Image                | Ports          | Purpose                        |
|------------|----------------------|----------------|--------------------------------|
| Node-RED   | `nodered/node-red`   | `1880`         | Flow engine + FlowFuse UI      |
| Mosquitto  | `mosquitto:2`        | `1883`, `9001` | MQTT broker (TCP + WebSocket)  |

- **Node-RED editor:** `http://<pi>:1880/red/`
- **Dashboard:** `http://<pi>:1880/dashboard` (see Known Issues)
- **MQTT:** `mqtt://<pi>:1883` from the ESP32, `ws://<pi>:9001` from the browser

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

## Security notes

This is a demo configuration. Before any real deployment:

- [ ] **Mosquitto allows anonymous access.** `allow_anonymous true` in
      `mosquitto/config/mosquitto.conf`. Add a `password_file` and create
      broker users.
- [ ] **No broker ACLs.** The commented topic examples are documentation only —
      nothing currently restricts which topics a client may read or write.
- [ ] **Node-RED has no authentication.** Anyone who can reach port 1880 can
      edit flows and reach the broker. Add `adminAuth` in `nodered/settings.js`.
- [ ] **`credentialSecret` is a known placeholder**
      (`nodered/settings.js`). Anyone with it can decrypt `flows_cred.json`.
      Replace it with a random value and keep it out of version control.
- [ ] **`enable-ssh-key.sh` contains a public SSH key.** Public keys are not
      secrets, but this one is machine-specific.

## Known issues

**The dashboard does not currently load.** `http://<pi>:1880/dashboard` returns
404 and the FlowFuse UI nodes fail to register:

```
[ui-page]  Error registering config. No parent ui-base node found for ui-page node
[ui-group] TypeError: Cannot read properties of null (reading 'register')
```

Mosquitto and the Node-RED editor (`/red/`, HTTP 200) are unaffected. Four
likely causes were identified and fixed — Dashboard-1 node type names in the
generator, a missing `path` on `ui-base`, missing `wires` keys on output-less
widgets, and a module version bump (1.30.2 → 1.32.0) — and the failure
persists. The remaining suspect is a `ui-theme` / `ui-base` config-node
resolution problem.

Regenerate the flow after fixing `gen_flows.py`:

```bash
python3 gen_flows.py
docker compose restart nodered
```

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
