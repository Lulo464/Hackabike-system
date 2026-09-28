#!/bin/bash
# Turn this Raspberry Pi into a WiFi access point for the ESP32-S3.
#
# The ESP32 does not join the school LAN. It joins this AP and reaches
# Mosquitto at 192.168.50.1:1883. The two segments stay independent: no
# bridging, no NAT, no IP forwarding, so the ESP32 has no route to the LAN.
#
# Idempotent - safe to re-run. Leaves eth0 (school LAN) untouched.
#
# Usage:  ./ap/install-ap.sh [ssid] [passphrase] [channel]

set -euo pipefail

SSID="${1:-Hackabike-ESP}"
PSK="${2:-hackabike2026}"
CHANNEL="${3:-6}"
CONN="hackabike-ap"
AP_IP="192.168.50.1/24"
NETPLAN_FILE="/etc/netplan/90-hackabike-ap.yaml"

if [ "$(id -u)" -ne 0 ]; then
    echo "run as root: sudo $0" >&2
    exit 1
fi

# WPA2 needs >= 8 chars; nmcli fails cryptically on short ones.
if [ "${#PSK}" -lt 8 ]; then
    echo "passphrase must be at least 8 characters (got ${#PSK})" >&2
    exit 1
fi

echo "==> unblocking wifi"
rfkill unblock wifi 2>/dev/null || true

# This is the step that actually matters on this image. rfkill reports the
# radio as soft-blocked, but NetworkManager is the real switch: with
# "nmcli radio wifi" = disabled, wlan0 sits in state "unavailable" and no AP
# profile can activate. Unblocking rfkill alone is not enough.
echo "==> enabling NetworkManager wifi radio"
STATE="$(nmcli radio wifi)"
if [ "$STATE" = "disabled" ]; then
    nmcli radio wifi on
    sleep 2
fi
echo "    nmcli radio wifi -> $(nmcli radio wifi)"

echo "==> removing stale wifi client profiles"
# A leftover client profile (e.g. "netplan-wlan0-Printers") makes NM manage
# wlan0 as a station and blocks AP activation. Skip the AP profile itself.
# NB: nmcli 1.52 renamed the UUID/TYPE columns to connection, and the
# accepted -f fields are lowercase category names.
while read -r name; do
    [ -z "$name" ] && continue
    [ "$name" = "$CONN" ] && continue
    echo "    deleting $name"
    nmcli con delete "$name" 2>/dev/null || true
done < <(nmcli -t -f NAME,TYPE con show 2>/dev/null \
         | awk -F: '$2 ~ /802-11-wireless/ {print $1}')

echo "==> creating AP profile: $SSID (channel $CHANNEL)"
nmcli con delete "$CONN" 2>/dev/null || true
nmcli con add type wifi ifname wlan0 con-name "$CONN" ssid "$SSID" \
    wifi.mode ap \
    wifi.band bg \
    wifi.channel "$CHANNEL" \
    wifi-sec.key-mgmt wpa-psk \
    wifi-sec.psk "$PSK" \
    ipv4.method manual \
    ipv4.addresses "$AP_IP" \
    ipv4.never-default yes \
    ipv6.method disabled \
    connection.autoconnect yes

# NB: ipv4.method shared would give the AP a default route (it assigned
# 10.42.0.1/24 and claimed the default), which breaks the intended static
# addressing. Static wlan0 + a standalone dnsmasq is the correct combination.
#
# wifi.band is required by nmcli when wifi.channel is set ("channel requires
# setting band"). It is NOT valid in the netplan file - that parser rejects
# both "bg" and "2g" - which is why the two layers differ.
echo "==> activating"
nmcli con up "$CONN"

# Second persistence layer. Without this, the netplan renderer may revert
# wlan0 on reboot and drop the AP.
echo "==> writing $NETPLAN_FILE"
cat > "$NETPLAN_FILE" <<YAML
network:
  version: 2
  wifis:
    wlan0:
      renderer: NetworkManager
      access-points:
        "$SSID":
          mode: ap
          channel: $CHANNEL
          auth:
            key-management: psk
            password: "$PSK"
      dhcp4: false
      dhcp6: false
      addresses:
        - $AP_IP
YAML
chmod 600 "$NETPLAN_FILE"

# NB: no "band:" key. This netplan release rejects both "bg" and "2g";
# mode: ap + a 2.4 GHz channel already implies the band.
netplan generate 2>/dev/null || true

# DHCP for the ESP32. NetworkManager's built-in dnsmasq only runs in shared
# mode, which is unusable here, so this is a separate service.
DNSMASQ_SRC="$(dirname "$(readlink -f "$0")")/dnsmasq-ap.conf"
if [ -f "$DNSMASQ_SRC" ]; then
    echo "==> installing dnsmasq config for the AP subnet"
    apt-get install -y -qq dnsmasq >/dev/null 2>&1 || true
    cp "$DNSMASQ_SRC" /etc/dnsmasq.d/hackabike-ap.conf
    chmod 644 /etc/dnsmasq.d/hackabike-ap.conf
    systemctl enable dnsmasq >/dev/null 2>&1 || true
    systemctl restart dnsmasq
    sleep 2
    if systemctl is-active --quiet dnsmasq; then
        echo "    dnsmasq active, DHCP on 192.168.50.100-192.168.50.150"
    else
        echo "    !! dnsmasq failed - the ESP32 would not get an address" >&2
        journalctl -u dnsmasq --no-pager -n 10 >&2 || true
    fi
else
    echo "    !! $DNSMASQ_SRC not found; DHCP will not be served" >&2
fi

echo
echo "==> result"
/usr/sbin/iw dev wlan0 info 2>/dev/null | grep -E 'ssid|type|channel' | sed 's/^/    /'
ip -br addr show wlan0 | sed 's/^/    /'
ip -br addr show eth0  | sed 's/^/    /'
echo "    default route: $(ip route | awk '/^default/{print $0}')"
ss -lun 2>/dev/null | grep -q ':67 ' && echo "    DHCP: listening on port 67" || echo "    DHCP: NOT LISTENING"

AP_ADDR="${AP_IP%%/*}"
cat <<EOF

AP is up.

  SSID       : $SSID
  passphrase : $PSK
  AP address : $AP_ADDR
  broker URL : mqtt://$AP_ADDR:1883
  DHCP range : 192.168.50.100 - 192.168.50.150

ESP32 side: see ap/esp32-esphome.yaml
Rollback  : ./ap/remove-ap.sh
EOF
