# Wi-Fi access point for the ESP32s

The ESP32s do **not** join the school LAN. The Pi runs its own Wi-Fi network
on `wlan0`, the ESPs join it and reach Mosquitto at a fixed address.

```
  school LAN     eth0    192.168.91.67    laptops, dashboards, SSH
  Hackabike AP   wlan0   192.168.50.1     ESP32s, MQTT only
  Mosquitto      0.0.0.0:1883             answers on both
```

The two networks are separate: no bridging, no NAT, no IP forwarding. The ESPs
get **no route to the school network** on purpose. All they can reach is the broker.

## Settings

| Setting | Value |
|---|---|
| SSID | `Hackabike-ESP` |
| Security | WPA2-PSK, AES only |
| Password | `hackabike2026` |
| Band / channel | 2.4 GHz, channel 6 (the ESP32 has no 5 GHz) |
| AP address | `192.168.50.1/24` |
| DHCP range | `192.168.50.100`–`150` (standalone `dnsmasq`) |
| Broker | `mqtt://192.168.50.1:1883` |

## Install

```bash
./ap/install-ap.sh
```

This unblocks the radio, enables Wi-Fi, creates the NetworkManager profile,
writes the netplan file, sets up `dnsmasq` and starts the AP. It is safe to
run again.

## Check that it works

```bash
# the AP is broadcasting
sudo /usr/sbin/iw dev wlan0 info | grep -E 'ssid|type|channel'
#     ssid Hackabike-ESP
#     type AP
#     channel 6 (2437 MHz), width: 20 MHz

# both networks are up
ip -br addr show wlan0 eth0

# it advertises pure WPA2 (not "WPA1 WPA2")
nmcli -f SSID,SECURITY,RSN-FLAGS dev wifi list | grep Hackabike

# the broker answers on the AP address (the ESPs' path)
docker compose exec mosquitto mosquitto_pub -h 192.168.50.1 -t bikestation/test -m hello
```

## Uninstall

```bash
sudo ./ap/remove-ap.sh
```

This takes the AP down and removes the NetworkManager profile, the netplan
file and the dnsmasq config. `eth0` is not touched.

## How it stays up after a reboot

Three layers, all installed by `install-ap.sh`:

| Layer | What it does |
|---|---|
| NetworkManager profile `hackabike-ap` | autoconnect, static `192.168.50.1/24`, AP mode, and the **WPA2-AES-only pin** (`proto rsn`, `group ccmp`, `pairwise ccmp`). Only this layer can hold the pin. |
| `/etc/netplan/90-hackabike-ap.yaml` | stops netplan from switching `wlan0` back on reboot |
| `dnsmasq` with `/etc/dnsmasq.d/hackabike-ap.conf` | DHCP for the AP network, enabled at boot |

## Troubleshooting

These cost real time on this Pi. Check them in this order.

<details>
<summary><b>The ESP32 never connects, laptops do</b>: mixed WPA mode</summary>

NetworkManager's AP mode advertises mixed `WPA1 WPA2` (`tkip ccmp`) by default.
The ESP32 rejects that beacon with reason 201, *"No AP found in auth mode
threshold"*. Laptops accept mixed mode, so they connect fine.

`install-ap.sh` pins the profile to `wifi-sec.proto rsn`, `group ccmp` and
`pairwise ccmp`. Check with
`nmcli -f SSID,SECURITY,RSN-FLAGS dev wifi list | grep Hackabike`.
</details>

<details>
<summary><b>A second, unpinned profile appears after a restart</b>: netplan sync</summary>

Restarting NetworkManager can make netplan copy the AP profile into
`/etc/netplan/90-NM-<uuid>.yaml` as `netplan-wlan0-Hackabike-ESP`, with
`ipv4.method shared` and **without the cipher pin**. If that one wins `wlan0`,
mixed-mode WPA is back and the ESPs drop off.

Remove it: `sudo nmcli con delete netplan-wlan0-Hackabike-ESP`.
</details>

<details>
<summary><b><code>wlan0</code> stays "unavailable"</b>: Wi-Fi radio switched off</summary>

Not rfkill, not the driver: the switch is in NetworkManager.

```
nmcli radio wifi          -> disabled
sudo nmcli radio wifi on  -> wlan0: connecting
```
</details>

<details>
<summary><b>The AP comes up with <code>10.42.0.1</code></b>: <code>ipv4.method shared</code></summary>

`shared` makes NetworkManager run its own dnsmasq, but it also gives `wlan0` a
default route and the address `10.42.0.1/24`. Use a **static** address plus the
**standalone dnsmasq** service instead. `install-ap.sh` does this.
</details>

<details>
<summary><b><code>wlan0</code> keeps acting as a client</b>: leftover netplan entry</summary>

The image had a `netplan-wlan0-Printers` entry for a network that did not
exist. It kept `wlan0` in station mode. It has been removed. Look for similar
leftovers with `nmcli con show`.
</details>

<details>
<summary><b>Configuration errors</b>: nmcli, netplan, dnsmasq</summary>

- **nmcli:** needs `wifi.band bg` as soon as `wifi.channel` is set.
- **netplan:** must have **no** `band:` key, because this release rejects both
  `bg` and `2g`. netplan also cannot express the cipher pin, so it lives only
  in the NetworkManager profile.
- **dnsmasq:** `bind-interfaces` and `bind-dynamic` exclude each other. Use
  `bind-dynamic`, because `wlan0` has no address until a client joins.
- **dnsmasq:** `log-facility=/dev/stdout` makes the unit fail with
  `NOTIMPLEMENTED`. Leave it out and read `journalctl -u dnsmasq`.
</details>

## Notes

- `iw` is at `/usr/sbin/iw` and not on the normal user's PATH.
- On the Pi 4, Wi-Fi and Ethernet share one antenna. That is fine for a
  handful of ESPs.
- `txpower 31 dBm` is the legal limit. Don't raise it.
- **No internet for the ESPs, on purpose.** If they ever need it (NTP, online
  OTA), add a MASQUERADE rule for `192.168.50.0/24`. IP forwarding is already
  enabled on the Pi.
- The ESPHome files in this folder (`esp32-esphome.yaml`, `publish-*.yaml`,
  `handle-led.yaml`) are from the **original single ESP32-S3 plan** and were
  never used. The current firmware is in [`../esp`](../esp/README.md).
