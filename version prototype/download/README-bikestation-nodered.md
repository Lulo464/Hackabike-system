# EcoHub Smart Bikestation — Node-RED Flow (v2)

Redesigned Node-RED Dashboard 2.0 flow that matches the look & feel of the EcoHub web dashboard (dark theme, emerald + cyan accents, KPI cards, rich bike cards, Pi health, environment, charts, activity log).

## Import

1. Open Node-RED → menu → **Import**
2. Paste the contents of `ecohub-bikestation-nodered.json` (or upload the file)
3. Click **Import**

The flow replaces your existing bikestation tab. All your **existing MQTT topics are kept intact** — your Pi keeps working without any code changes.

## What changed

### Visual
- Darker, richer theme (`#0a0c0f` page bg, `#15181c` group bg, `#1f2429` outlines)
- Larger group border radius (`12px`) and widget gap (`12px`)
- Pulsing live status dot
- EcoHub gradient header (emerald → cyan) with live clock

### Layout (7 groups, 70 nodes total)
| Group | Width × Height | Contents |
|---|---|---|
| STATION | 12 × 1 | Header template with station name, status pill, live clock, uptime |
| KEY METRICS | 12 × 2 | 6 KPI cards: Status · Available · In Use · Rides Today · Maintenance · Last Alert |
| BIKE FLEET (4 Units) | 8 × 4 | 4 bikes × (status text + distance gauge) — color-coded |
| RASPBERRY PI HEALTH | 4 × 4 | CPU temp · CPU load · Memory · Disk · Solar Power · Battery Voltage |
| ENVIRONMENTAL SENSORS | 4 × 4 | Temperature · Humidity · Air Quality · Solar Irradiance |
| LIVE CHARTS | 8 × 5 | 2 line charts: Slot Distance History (4 series) + Environment & Solar Trends |
| ACTIVITY LOG | 4 × 5 | NFC tap history table + alert popup notification |

### Logic
- **Computed KPIs**: `Available` and `In Use` are derived from all 4 slot topics (function maintains state in `flow.slotState`)
- **Rides Today**: counts NFC taps with `action: "rent"` today (resets at midnight)
- **Maintenance counter**: counts alerts with `type: "maintenance"`
- **Color-coded status**: green = available, yellow = in use, orange = maintenance, red = alert
- **Per-bike color segments on distance gauge**: 0–60cm green, 60–120cm yellow, 120–200cm red

### New optional MQTT topics
If you wire these up later, the dashboard lights up automatically. If not, widgets stay at 0 — nothing breaks.

| Topic | Unit | What to publish from your Pi |
|---|---|---|
| `bikestation/system/cpu_temp` | °C | `vcgencmd measure_temp` → strip `temp=` and `'C` |
| `bikestation/system/cpu_load` | % | `top -bn1 \| grep "Cpu(s)"` → parse idle % |
| `bikestation/system/memory` | % | `free \| awk '/Mem/{printf "%.0f", $3/$2*100}'` |
| `bikestation/system/disk` | % | `df / \| awk 'NR==2{print $5}' \| tr -d %` |
| `bikestation/system/solar` | W | INA219 reading from your solar panel |
| `bikestation/system/battery_voltage` | V | INA219 reading from your station battery |
| `bikestation/environment/temp` | °C | BMP280 / BME280 / DHT22 reading |
| `bikestation/environment/humidity` | % | BME280 / DHT22 reading |
| `bikestation/environment/air` | AQI | MQ-135 ADC reading mapped to AQI |
| `bikestation/environment/solar` | W/m² | LDR or BH1750 light sensor |

## Example Pi-side Python snippet (for the new topics)

```python
import paho.mqtt.client as mqtt
import subprocess, re

client = mqtt.Client()
client.connect("192.168.50.1", 1883)

# CPU temp — every 5s
def publish_cpu_temp():
    out = subprocess.check_output(["vcgencmd", "measure_temp"]).decode()
    temp = re.search(r"temp=(\d+\.\d+)'C", out).group(1)
    client.publish("bikestation/system/cpu_temp", temp)

# Memory usage — every 5s
def publish_memory():
    out = subprocess.check_output(["free"]).decode()
    line = [l for l in out.splitlines() if l.startswith("Mem:")][0]
    parts = line.split()
    used_pct = int(parts[2]) / int(parts[1]) * 100
    client.publish("bikestation/system/memory", f"{used_pct:.1f}")

# Disk usage — every 60s
def publish_disk():
    out = subprocess.check_output(["df", "/"]).decode()
    pct = out.splitlines()[1].split()[4].rstrip("%")
    client.publish("bikestation/system/disk", pct)
```

## What to do at the hackathon

1. **Import** this JSON into Node-RED on your Pi.
2. **Verify** the dashboard at `http://<pi-ip>:1880/ui` — you should see the dark EcoHub dashboard.
3. **Tap a bike in/out of a slot** — the corresponding card should flip AVAILABLE ↔ IN USE, and the KPI counters should update.
4. **Tap an NFC tag** at the entrance — a new row appears in the activity log, and `Rides Today` increments if the action is `rent`.
5. **Bonus**: add `vcgencmd` publishing (5 lines of Python) — the Pi Health gauges light up.
