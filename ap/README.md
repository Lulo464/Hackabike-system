# Hackabike AP — Pi as WiFi access point for the ESP32

The ESP32 does **not** join the school LAN. The Pi hosts its own WiFi network
on `wlan0`; the ESP32 joins that and reaches Mosquitto at a fixed address.

```
  school LAN   eth0    192.168.91.67     laptop, Docker ports
  Hackabike AP wlan0   192.168.50.1      ESP32-S3, MQTT only
  mosquitto    0.0.0.0:1883             answers on both interfaces
```

The two segments are independent — no bridging, no NAT, no IP forwarding. The
ESP32 gets **no route to the school network**, which is deliberate: it can only
reach the broker.

## Details

| Setting     | Value            |
|-------------|------------------|
| SSID        | `Hackabike-ESP`  |
| Security    | WPA2-PSK         |
| Passphrase  | `hackabike2026`  |
| Band        | 2.4 GHz only (ESP32-S3 has no 5 GHz) |
| Channel     | 6                 |
| AP address  | `192.168.50.1/24`|
| DHCP range  | `192.168.50.100`–`.150` (standalone `dnsmasq`) |
| Broker URL  | `mqtt://192.168.50.1:1883` |

## Install

```bash
./ap/install-ap.sh
```

Unblocks the radio, enables WiFi, creates the NM profile, writes the netplan
file, and activates the AP. Idempotent — safe to re-run.

## Verify

```bash
# AP is broadcasting
sudo iw dev wlan0 info | grep -E 'ssid|type|channel'

# both networks coexist
ip -br addr show wlan0 eth0

# broker answers on the AP address (this is the ESP32's path)
cd ~/bikestation
sudo docker compose exec mosquitto mosquitto_pub \
  -h 192.168.50.1 -t 'bikestation/system/status' -m '{"status":"online"}'
```

Expected from `iw dev wlan0 info`:

```
    ssid Hackabike-ESP
    type AP
    channel 6 (2437 MHz), width: 20 MHz
```

## Two gotchas that cost time on this Pi

**1. `nmcli radio wifi` was `disabled`.** This — not rfkill, not the driver —
was what kept `wlan0` in state `unavailable`. `rfkill` reported `soft=1` and
the interface looked dead, but the actual switch was in NetworkManager:

```
nmcli radio wifi          -> disabled
sudo nmcli radio wifi on  -> wlan0:connecting
```

If the AP won't come up, check this first.

**2. A stale netplan block pinned `wlan0` to a client profile.** The image had
a `netplan-wlan0-Printers` entry with a WPA passphrase for a network called
"Printers" that didn't exist. It kept NM managing `wlan0` as a station and
blocked AP activation. Removed; the `netplan-wlan0-Printers` profile was
deleted too.

**3. `ipv4.method shared` is wrong here.** It made NM run its built-in dnsmasq,
but it also gave `wlan0` a default route and assigned `10.42.0.1/24` instead
of the intended `192.168.50.1/24`. The AP went live under the wrong address.
The fix is a **static** address on `wlan0` plus a **standalone `dnsmasq`**
service for DHCP. This is what `install-ap.sh` does now.

**4. nmcli `wifi.band bg` is required** when `wifi.channel` is set ("channel
requires setting band"). But the **netplan** file must NOT have a `band:` key —
on this release netplan rejects both `bg` and `2g`. The two persistence layers
deliberately differ.

**5. dnsmasq `bind-interfaces` and `bind-dynamic` are mutually exclusive.**
Use `bind-dynamic` for an AP: `wlan0` has no carrier until a client associates,
so the address isn't bound when dnsmasq starts. Also, `log-facility=/dev/stdout`
makes the systemd unit fail with `NOTIMPLEMENTED` — omit it and rely on syslog
(`journalctl -u dnsmasq`).

**6. `iw` is at `/usr/sbin/iw`**, not on the unprivileged PATH.

## Persistence

Three layers, deliberately:

- `nmcli` profile `hackabike-ap` — `connection.autoconnect yes`, static
  `192.168.50.1/24`, `wifi.mode ap`.
- `/etc/netplan/90-hackabike-ap.yaml` — keeps the netplan renderer from
  reverting `wlan0` to something else on reboot.
- `dnsmasq` service with `/etc/dnsmasq.d/hackabike-ap.conf` — DHCP for the AP
  subnet, enabled at boot.

All three are installed by `install-ap.sh`.

## Rollback

```bash
sudo ./ap/remove-ap.sh
```

Downs the AP, deletes the NM profile, removes the netplan file, deletes the
dnsmasq config and restarts the service. `eth0` is untouched.

## Manual notes

- `iw` is not on the unprivileged PATH on this image. Use `sudo /usr/sbin/iw`.
- The Pi 4's WiFi and Ethernet share a single antenna and can't both saturate.
  Irrelevant at this scale, but it explains why the AP is limited to a handful
  of clients.
- `txpower 31 dBm` is regulatory-limited; don't raise it.
- **No internet to the ESP32, by design.** No NAT or IP forwarding is
  configured for the AP subnet, so a compromised ESP32 cannot reach the school
  LAN. If it ever needs internet (OTA, NTP), add a MASQUERADE rule for
  `192.168.50.0/24` — the Pi already has IP forwarding enabled.
- The `esp32-esphome.yaml` and its `!include` scripts are **not
  machine-verified** (ESPHome wasn't installed to run `esphome config`). The
  hardware section — especially the I2C topology — still depends on decisions
  from `docs/Hackathon.md` (see the Known Issues in the root README).
