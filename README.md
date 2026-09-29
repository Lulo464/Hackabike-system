# Hackabike – Smart Bikestation

A smart bicycle parking station built at a hackathon. Riders tap an NFC chip
(or use their phone), the station assigns them a slot, opens the gate and
watches the bike until its owner picks it up. Remove a bike without
permission and the whole station locks down.

![Design](docs/Design_v2.svg)

**Features**

- 🔑 **Chip or phone access** – NFC chips linked to an account, or the mobile web app
- 🅿️ **Slot guidance** – the first free slot is reserved and lights up on the LED strip
- 🚲 **One bike per account**, with pickup that shows the owner which slot is theirs
- 🚨 **Theft alarm** – a secured bike that leaves without pickup locks the station
- 📊 **Dashboards** – Node-RED control room, a kiosk view and a mobile app with a forecast
- 🗄️ **History** – every MQTT message lands in Postgres

---

## Contents

- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Using the station](#using-the-station)
- [MQTT topics](#mqtt-topics)
- [Project layout](#project-layout)
- [Development](#development)
- [Remote access](#remote-access)
- [Security](#security)
- [Known issues](#known-issues)

## How it works

```
                        ┌──────────────── Raspberry Pi 4 ────────────────┐
  phone ── Pangolin ──► │  web (8080)     Node-RED (1880)    Postgres    │
                        │        │             │                 ▲       │
                        │        └──── Mosquitto (1883) ─────────┘       │
                        └──────────────────┬────────────────────────────┘
                                           │ own Wi-Fi "Hackabike-ESP" (192.168.50.0/24)
                         ┌─────────────────┴─────────────────┐
                    ESP32 #1                              ESP32 #2
              LED strip (all 4 slots)          NFC reader · LCD · gate servo
              distance slot 1 + 2              distance slot 3 + 4
```

| Part | What it does | Docs |
|---|---|---|
| **Mosquitto** | MQTT broker, the bus everything talks over | – |
| **Node-RED** | Station logic (access, reservations, alarm), control-room dashboard | [Station logic](#station-logic) |
| **Postgres** | Accounts, parking sessions, all telemetry | – |
| **web** | Mobile dashboard: free slots, forecast, "open gate" by phone | [web/README.md](web/README.md) |
| **ESP32 ×2** | Sensors, LEDs, NFC, LCD and gate (ESPHome) | [esp/README.md](esp/README.md) |
| **Wi-Fi AP** | The Pi runs its own network for the ESPs | [ap/README.md](ap/README.md) |

## Quick start

On a Raspberry Pi (Raspberry Pi OS / Ubuntu) with this repository checked out:

```bash
./install.sh             # one time: installs Docker, fixes permissions, starts the stack
./ap/install-ap.sh       # one time: Wi-Fi access point for the ESP32s
```

Day to day:

```bash
docker compose up -d     # start
docker compose logs -f   # follow the logs
docker compose down      # stop
```

Then flash the two ESP32s as described in [esp/README.md](esp/README.md).

| Open | URL |
|---|---|
| Mobile dashboard | `http://<pi>:8080` |
| Node-RED dashboard | `http://<pi>:1880/dashboard` |
| Kiosk view (entrance screen) | `http://<pi>:1880/dashboard/kiosk` |
| Admin (clear alarms) | `http://<pi>:1880/dashboard/admin` |
| Node-RED editor | `http://<pi>:1880/red/` |
| Postgres | `psql -h <pi> -U nodered -d bikestation` |

## Using the station

### Park

1. Tap your chip at the reader (or press **Park** in the app).
2. The LCD greets you and shows your slot: `Park at Slot 2`. That slot blinks blue.
3. The gate opens for **20 s**. Push the bike in.
4. Once the sensor sees the bike, the LCD shows `Secured: Slot 2` and the slot turns red (occupied).

A reservation expires after **5 minutes** if no bike arrives.

### Pick up

1. Tap your chip again (or press **Pick up** in the app).
2. Your slot blinks blue and the gate opens.
3. Take the bike out. As soon as the slot is empty, the gate **opens again** so you can leave.

The pickup permission is valid for **2 minutes**.

### Rules

| Situation | What happens |
|---|---|
| Chip without an account | Refused, LCD `Karte unbekannt / In App koppeln` (red) |
| Account already has a bike parked | Refused, LCD `Du hast schon / ein Rad: Slot N` |
| Station full | Refused, LCD `Station Full!` |
| Secured bike leaves without pickup | **Alarm**: slot blinks red fast, gate closes, station locked |
| Station locked | Every chip and app request is refused (`Station gesperrt`) |

Link a chip to your account in the app: **Verknüpfen**, then tap the chip within 60 s.

### Alarm

An alarm is only raised for bikes that were parked through a reservation
(`Secured: Slot N`). Objects in front of a sensor, or a sensor without echo,
never trigger it.

To clear an alarm, open **`/dashboard/admin`** and press *Alarm zurücksetzen*.
Alarms survive a Node-RED restart, so a restart does not unlock the station.

### Station logic

Chip and app requests take the same path through the Node-RED flow
(`nodered/flows.json`, tab *Smart Bikestation*):

1. **Lookup** – the tap's uid is looked up in Postgres (`app_users.rfid_uid`,
   or `APP-<username>` for the app). If an account is waiting to link a chip,
   the chip is linked instead.
2. **Station logic** (`fn_smart_logic`) applies the rules above, reserves
   slots, and drives LCD, gate and slot states.
3. **Sessions** – every reservation is a row in `parking_sessions`:
   `reserved → parked → done`, or `reserved → expired`.
4. **Debouncing** – a slot only counts as changed after 5 equal readings
   (about 1 s), so sensor flicker does not end a session.

The Postgres ingest (`bikestation/#`) uses its **own MQTT connection**. On a
shared connection the broker delivered each message once per matching
subscription, so taps arrived twice.

## MQTT topics

Everything lives under `bikestation/`. The broker is `192.168.50.1:1883` on the
ESP network and `<pi>:1883` on the LAN.

| Topic | From → to | Payload |
|---|---|---|
| `slot{1-4}/distance` | ESP → Pi | distance in cm, every 200 ms; `999` = no echo |
| `slot{1-4}/sensor` | ESP → Pi | `ok` / `no_echo` (retained) |
| `slot{1-4}/state` | Node-RED → ESP 1 | `free` green · `occupied` red · `reserved` blue blink · `alarm` fast red blink (retained) |
| `entrance/nfc/tap` | ESP 2 / app → Pi | `{"uid":"A1B2C3D4"}`; the app sends `{"uid":"APP-<user>","action":"park"\|"pickup"}` |
| `entrance/oled/display` | Node-RED → ESP 2 | text for the 16×2 LCD |
| `entrance/gate` | Node-RED → ESP 2 | servo angle `0`–`180`, or `open` (90°) / `close` (0°) |
| `entrance/gate/angle` | ESP 2 → Pi | last angle (retained) |
| `system/alerts` | Node-RED → any | `{"type":"theft"\|"alarm_cleared","slot":N,"at":"…"}` |
| `bikeslot-test/status`, `bikeslot-2/status` | ESP → Pi | `online` / `offline` (last will) |

Watch everything:

```bash
docker compose exec mosquitto mosquitto_sub -v -t 'bikestation/#'
```

Move the gate by hand, e.g. to calibrate the servo:

```bash
docker compose exec mosquitto mosquitto_pub -t bikestation/entrance/gate -m 90
```

## Project layout

```
├── docker-compose.yml          the stack: Node-RED, Mosquitto, Postgres, web
├── install.sh                  one-time host setup
├── enable-ssh-key.sh           adds a team member's SSH key on the Pi
├── nodered/
│   ├── flows.json              the flow (station logic + dashboards)
│   └── settings.js             editor at /red, flow context stored on disk
├── web/                        mobile dashboard              → web/README.md
├── esp/                        ESP32 firmware (ESPHome)      → esp/README.md
├── ap/                         Wi-Fi access point for the ESPs → ap/README.md
├── mosquitto/config/           broker config (listeners, persistence)
├── postgres/init/              telemetry table + views, runs on first start
├── dockerfiles/                images for Node-RED and Mosquitto
├── newt/                       template for the Pangolin tunnel
├── docs/                       original hackathon plan and design drawing
├── gen_flows.py                outdated flow generator – do not run
└── version prototype/          separate Next.js dashboard prototype (not deployed)
```

## Development

### Changing the Node-RED flow

`nodered/flows.json` is edited by hand: either in the editor on the Pi
(`/red`), then commit the file, or directly in the JSON.

> [!WARNING]
> `gen_flows.py` builds the very first flow with an old topic scheme. Running
> it overwrites the whole flow.

After changing `flows.json` on the Pi:

```bash
docker compose restart nodered
```

Taps sent while Node-RED restarts (about 20 s) are lost. The app notices
this and asks the user to try again.

### Changing the web app

```bash
docker compose up -d --build web
```

### Flashing the ESP32s

See [esp/README.md](esp/README.md#flashen).

## Remote access

The Pi can be reached from outside the LAN in two ways. Neither is set up by
`docker compose up`, because both need secrets.

### Pangolin / Newt (public internet)

A **Newt** container keeps a tunnel open to the Pangolin server at
`https://app.heppner.site`. Everything added as a resource for this site in
the Pangolin UI is **published on the internet**, with no port forwarding.

- It runs from `~/newt/docker-compose.yml` on the Pi, which holds `NEWT_SECRET`
  and is not in this repo. Template: [newt/docker-compose.example.yml](newt/docker-compose.example.yml).
- Check it: `docker logs newt` should show `Tunnel connection to server established successfully!`
- Targets to enter in Pangolin:
  - mobile dashboard: `192.168.91.67:8080`
  - Node-RED dashboard: `192.168.91.67:1880` (**the editor has no login**)

Because the mobile dashboard is public, creating an account needs the
registration code `Hack-a-bike` (`REGISTRATION_CODE` in `docker-compose.yml`).
Anyone with an account can open the gate.

### WireGuard (team VPN)

The Pi is a WireGuard peer at **`10.50.10.51`** (`ssh group12@10.50.10.51`
from a device on the VPN).

- Config: `/etc/wireguard/wg0.conf` (root only, holds the private key, not in git).
- Started on boot by `wg-quick@wg0`.
- Only `10.10.10.0/24`, `10.20.10.0/24` and `10.50.10.0/24` go through the tunnel; the LAN is untouched.

After editing the config: `sudo systemctl restart wg-quick@wg0`.

## Security

> [!CAUTION]
> This is a hackathon demo. Do not run it like this anywhere real.

- [ ] **Only publish the mobile dashboard through Pangolin.** Never Mosquitto
      (`1883`/`9001`) or Postgres (`5432`): neither has a real password.
- [ ] **Node-RED has no login.** Anyone who reaches port 1880 can edit flows,
      clear alarms on `/dashboard/admin` and talk to the broker. Add
      `adminAuth` in `nodered/settings.js`.
- [ ] **Mosquitto allows anonymous access** and has no ACLs. Add a
      `password_file` in `mosquitto/config/mosquitto.conf`.
- [ ] **Demo secrets are in the repo:** Postgres password `hackathon2026`,
      registration code `Hack-a-bike`, the Wi-Fi password in the ESP firmware.
      Override the first two in a `.env` on the Pi.
- [ ] **`credentialSecret` in `nodered/settings.js` is a placeholder.** Anyone
      with it can decrypt `flows_cred.json`.
- [ ] **`enable-ssh-key.sh` contains a machine-specific public key.** Public keys
      are not secret, but this one belongs to a single laptop.

## Known issues

- **The docs describe the original plan, not the built station.**
  `docs/Hackathon.md` and `docs/Design_v2.svg` show one ESP32-S3, VL53L1X
  distance sensors, an OLED, vibration sensors and a Pi 5. The station as
  built uses two ESP32 DevKits, ultrasonic sensors, a 16×2 RGB LCD and a
  Pi 4 (4 GB).
- **The NFC reader hangs after an ESP32 reset.** It only recovers when ESP 2
  loses power, e.g. by unplugging USB. See [esp/README.md](esp/README.md#fehlersuche).
- **Bikes parked before the theft alarm existed** are not marked as secured and
  will not raise an alarm.
