#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Smart Bikestation — stack installer
# Run as the group12 user on the Raspberry Pi, from the project
# directory that contains docker-compose.yml.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
ok()  { printf '    \033[1;32mOK\033[0m  %s\n' "$1"; }
die() { printf '\n\033[1;31mFAILED: %s\033[0m\n' "$1" >&2; exit 1; }

# ── 1. Docker ───────────────────────────────────────────────
say "Checking Docker"
if ! command -v docker >/dev/null 2>&1; then
    ok "docker not found - installing"
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker.io docker-compose-v2
    sudo usermod -aG docker "$USER"
    die "docker was just installed. Log out and back in, then re-run this script."
else
    ok "docker present: $(docker --version)"
fi

docker compose version >/dev/null 2>&1 \
    || die "'docker compose' (v2 plugin) is unavailable. Install docker-compose-v2."

# ── 2. Ownership of the bind-mounted broker dirs ───────────
say "Fixing mosquitto directory ownership (uid 1883)"
mkdir -p mosquitto/data mosquitto/log
sudo chown -R 1883:1883 mosquitto/data mosquitto/log
sudo chmod -R 775 mosquitto/data mosquitto/log
ok "mosquitto/data and mosquitto/log owned by 1883:1883"

# ── 3. Build + start ────────────────────────────────────────
say "Building and starting the stack"
docker compose up --build -d
ok "containers requested"

say "Waiting for the broker to accept connections"
for i in $(seq 1 30); do
    if docker compose exec -T mosquitto mosquitto_sub -t 'bikestation/#' -C 1 -W 1 >/dev/null 2>&1; then
        ok "broker responding after ${i}s"
        break
    fi
    sleep 1
    [ "$i" = 30 ] && die "broker did not become ready within 30s"
done

# ── 4. Round-trip test ──────────────────────────────────────
say "MQTT publish/subscribe round-trip"
TEST_TOPIC="bikestation/system/status"
docker compose exec -T mosquitto mosquitto_sub -t "$TEST_TOPIC" -C 1 -W 10 > /tmp/bike_sub.txt &
SUB_PID=$!
sleep 1
docker compose exec -T mosquitto mosquitto_pub -t "$TEST_TOPIC" \
    -m '{"status":"online","timestamp":"install-test"}'
wait $SUB_PID || true

if grep -q 'install-test' /tmp/bike_sub.txt 2>/dev/null; then
    ok "round-trip OK: published and received on $TEST_TOPIC"
else
    die "round-trip failed - broker accepted no message"
fi

# ── 5. Report ───────────────────────────────────────────────
IP=$(hostname -I | awk '{print $1}')
say "Stack is up"
cat <<EOF

    Node-RED editor : http://${IP}:1880/red
    Dashboard       : http://${IP}:1880/dashboard/
    MQTT broker     : ${IP}:1883   (TCP)
    MQTT over WS    : ${IP}:9001

    ESP32 config: broker ${IP}  port 1883

    Logs:
      docker compose logs -f nodered
      docker compose logs -f mosquitto

EOF
