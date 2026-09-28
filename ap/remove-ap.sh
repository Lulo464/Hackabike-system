#!/bin/bash
# Remove the Hackabike AP. Restores wlan0 to unmanaged.
# Leaves eth0 (school LAN) and the Docker stack alone.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "run as root: sudo $0" >&2
    exit 1
fi

CONN="hackabike-ap"
NETPLAN_FILE="/etc/netplan/90-hackabike-ap.yaml"

echo "==> down: $CONN"
nmcli con down "$CONN" 2>/dev/null || echo "    not active"

echo "==> delete profile"
nmcli con delete "$CONN" 2>/dev/null || echo "    no such profile"

# NM's netplan sync can auto-generate a second AP profile
# (netplan-wlan0-Hackabike-ESP) with shared DHCP and no WPA2 cipher pin.
# Remove it too so wlan0 doesn't come back up wrong on a later reboot.
DUP="netplan-wlan0-Hackabike-ESP"
if nmcli -t -f NAME con show | grep -qx "$DUP"; then
    echo "==> delete auto-synced duplicate: $DUP"
    nmcli con delete "$DUP" 2>/dev/null || echo "    could not delete $DUP"
fi

echo "==> remove $NETPLAN_FILE"
rm -f "$NETPLAN_FILE"
netplan generate 2>/dev/null || true

echo "==> remove dnsmasq AP config and stop DHCP"
if [ -f /etc/dnsmasq.d/hackabike-ap.conf ]; then
    rm -f /etc/dnsmasq.d/hackabike-ap.conf
    systemctl restart dnsmasq 2>/dev/null || true
    echo "    removed; dnsmasq restarted (it may still be installed for other uses)"
else
    echo "    no dnsmasq AP config present"
fi

echo
echo "remaining wifi profiles:"
nmcli -t -f NAME,TYPE con show | grep 802-11 || echo "  (none)"
echo
echo "wlan0 state:"
ip -br addr show wlan0 2>/dev/null || echo "  (interface gone)"
echo
echo "AP removed. eth0 untouched:"
ip -br addr show eth0
