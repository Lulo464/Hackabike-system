# Mosquitto – MQTT broker

Every part of the station talks through this broker: the ESP32s publish
sensor readings and NFC taps, Node-RED answers with slot states, LCD texts and
gate commands, and the web app sends gate requests.

| | |
|---|---|
| Image | `eclipse-mosquitto:2` (see [`dockerfiles/mosquitto/Dockerfile`](../dockerfiles/mosquitto/Dockerfile)) |
| Container | `bikestation-mosquitto` |
| MQTT | port **1883** – `192.168.50.1:1883` for the ESPs, `<pi>:1883` on the LAN, `mosquitto:1883` inside Docker |
| WebSockets | port **9001** |
| Auth | none (anonymous) – see [Securing the broker](#securing-the-broker) |

## Files

```
mosquitto/
├── config/mosquitto.conf   the config that is actually used (mounted into the container)
├── data/                   persistence: retained messages and sessions (mosquitto.db)
├── log/                    mosquitto.log
└── mosquitto.conf          old copy, not used by the container
```

`data/` and `log/` are created on the Pi and are not in git. They must belong
to uid `1883`; [`install.sh`](../install.sh) takes care of that.

## Who is connected

| Client | Client ID | Publishes | Subscribes |
|---|---|---|---|
| ESP 1 | `bikeslot-test` | `slot1-2/distance`, `slot1-2/sensor`, status | `slot1-4/state` |
| ESP 2 | `bikeslot-2` | `slot3-4/distance`, `slot3-4/sensor`, `entrance/nfc/tap`, `entrance/gate/angle`, status | `entrance/oled/display`, `entrance/gate` |
| Node-RED (logic) | `nodered-bikestation-unified` | `slotN/state`, LCD, gate, `system/alerts` | taps, distances, states |
| Node-RED (database) | `nodered-bikestation-ingest` | – | `bikestation/#`, written to Postgres |
| Web app | `bikestation-web-<pid>` | `entrance/nfc/tap` (app taps) | – |

The full topic list is in the [main README](../README.md#mqtt-topics).

> [!NOTE]
> Node-RED uses **two connections** on purpose. With a single connection the
> broker delivered each message once per matching subscription, so every tap
> was processed twice.

### Retained messages

The broker keeps the last value of these topics and hands it to every new
subscriber. That way an ESP gets its LED state right after a reboot.

- `bikestation/slot{1-4}/state`
- `bikestation/slot{1-4}/sensor`
- `bikestation/entrance/gate/angle`
- `bikestation/<esp>/status` (birth message)

## Everyday commands

Run these on the Pi, in the project directory:

```bash
# watch everything
docker compose exec mosquitto mosquitto_sub -v -t 'bikestation/#'

# only the entrance (taps, LCD, gate)
docker compose exec mosquitto mosquitto_sub -v -t 'bikestation/entrance/#'

# send something
docker compose exec mosquitto mosquitto_pub -t bikestation/entrance/gate -m 90

# delete a retained message
docker compose exec mosquitto mosquitto_pub -t bikestation/slot1/state -r -n

# broker status
docker compose exec mosquitto mosquitto_sub -v -C 2 -t '$SYS/broker/version' -t '$SYS/broker/clients/connected'
```

From a laptop on the LAN, the same works with a local client:
`mosquitto_sub -h <pi> -v -t 'bikestation/#'`.

> [!TIP]
> Stop test subscribers with **Ctrl+C**. If you wrap them in `timeout`
> instead, the process inside the container keeps running.

## Configuration

[`config/mosquitto.conf`](config/mosquitto.conf):

| Setting | Value | Why |
|---|---|---|
| `persistence` | `true` → `/mosquitto/data/` | retained messages survive a restart |
| `log_type` | `error`, `warning` | `all` logs every message and filled 500 MB within a day |
| `allow_anonymous` | `true` | ESPs connect without credentials (demo) |
| `listener 1883` | MQTT | ESPs, Node-RED, web |
| `listener 9001` | WebSockets | browser clients |

After changing the config: `docker compose restart mosquitto`. Clients reconnect
by themselves; the ESPs show `offline` → `online` for a moment.

## Securing the broker

> [!CAUTION]
> Anyone who reaches port 1883 can read everything and open the gate. Never
> publish 1883 or 9001 through Pangolin.

1. Create users:
   ```bash
   docker compose exec mosquitto mosquitto_passwd -c /mosquitto/config/passwd esp32
   docker compose exec mosquitto mosquitto_passwd    /mosquitto/config/passwd nodered
   docker compose exec mosquitto mosquitto_passwd    /mosquitto/config/passwd web
   ```
2. In `config/mosquitto.conf`, set `allow_anonymous false` and `password_file /mosquitto/config/passwd`.
3. Add the credentials to the clients:
   - ESP firmware: `mqtt: username/password`
   - Node-RED: both broker nodes
   - web: `MQTT_URL=mqtt://user:pass@mosquitto:1883`
4. Optional: an `acl_file` so that, for example, only Node-RED may publish `entrance/gate`.
5. `docker compose restart mosquitto`.

## Troubleshooting

| Problem | Fix |
|---|---|
| ESPs don't show up | Check the Wi-Fi AP first ([ap/README.md](../ap/README.md)), then `nc -zv 192.168.50.1 1883` from a device on that network. |
| Container restarts, `Permission denied` in the logs | `sudo chown -R 1883:1883 mosquitto/data mosquitto/log` |
| A slot shows an old state after a reboot | A stale retained message; delete it (see above). Node-RED republishes within a second. |
| `log/mosquitto.log` is huge | Left over from when `log_type all` was on. It can be deleted: `sudo truncate -s 0 mosquitto/log/mosquitto.log` |
| Every tap is handled twice | Node-RED logic and ingest must stay on separate broker connections (see above). |
