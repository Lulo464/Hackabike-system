# Smart Bikestation — Hackathon

> [!NOTE]
> This is the **original plan** from the start of the hackathon. The station as
> built differs: two ESP32 DevKits instead of one ESP32-S3, ultrasonic sensors
> instead of VL53L1X, a 16×2 RGB LCD instead of the OLED, no vibration sensors,
> a Raspberry Pi 4, and a different MQTT topic scheme. For the current state see
> the [main README](README.md) and [esp/README.md](esp/README.md).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   RASPBERRY PI 5 4GB                     │
│  Role: Server (MQTT broker + DB + API + Dashboard)      │
│  Network: Ethernet | Power: USB-C wall outlet            │
└──────────────────────┬──────────────────────────────────┘
                       │ WiFi (MQTT)
┌──────────────────────┴──────────────────────────────────┐
│               ESP32-S3 (Single brain for all)           │
│                                                         │
│  I2C Bus (shared SDA/SCL):                              │
│    0x20 — PCF8574 #1  (slot proximity sensors — INPUT)  │
│    0x24 — PN532 NFC Reader  (check-in/out)              │
│    0x3C — SSD1306 OLED 1.3"  (user display)            │
│    0x53 — ADXL345 Vibration  (sabotage detect)          │
│                                                         │
│  GPIO (direct):                                         │
│    GPIO 8 — WS2812B LED Strip Data (1m, 60 LEDs)       │
│      Cut into 4 segments (~15 LEDs per slot)            │
│      Slot 1: LEDs 0-14 | Slot 2: 15-29                 │
│      Slot 3: LEDs 30-44 | Slot 4: 45-59                │
│                                                         │
│  Power: USB-C wall outlet | Network: WiFi to Pi         │
└─────────────────────────────────────────────────────────┘
```

## MQTT Topic Schema

```
bikestation/
├── entrance/
│   ├── nfc/tap              ← ESP32 publishes on card tap {"uid":"A1B2","timestamp":"..."}
│   └── oled/display         → ESP32 subscribes (dashboard pushes text to display)
├── slot/{1-4}/
│   ├── proximity            ← ESP32 publishes {"distance_cm":45.2, "occupied":true}
│   ├── vibration            ← ESP32 publishes {"g_force":0.02, "alert":false}
│   └── led                  → ESP32 subscribes {"slot":1,"color":"green","blink":false}
│                              (controls WS2812B segment for this slot)
├── system/
│   ├── alerts               ← ESP32 publishes {"type":"sabotage","slot":2,"timestamp":"..."}
│   └── status               ← ESP32 LWT (online/offline)
```

## Parts List

### Core

| Component          | Model                  | Qty |
| ------------------ | ---------------------- | --- |
| Raspberry Pi 5 4GB | RASPBERRY PI 5 B 4GB   | 1   |
| Pi 5 Power Supply  | Raspberry Pi 27W USB-C | 1   |
| MicroSD Card       | SanDisk 32GB Class 10  | 1   |

### Entrance (NFC Station)

| Component       | Model                        | Qty |
| --------------- | ---------------------------- | --- |
| ESP32 Dev Board | ESP32-S3-DevKitC N16R8       | 1   |
| NFC Reader      | PN532 V3 (I2C/SPI/UART)      | 1   |
| OLED Display    | 1.3" SSD1306 128×64 I2C      | 1   |
| NFC Cards/Tags  | NTAG213 stickers (10er Pack) | 1   |

### Parking Slots (×4)

| Component        | Model              | Qty |
| ---------------- | ------------------ | --- |
| Proximity Sensor | VL53L1X ToF I2C    | 4   |
| Vibration Sensor | ADXL345 GY-291 I2C | 4   |
| I/O Expander     | PCF8574 5er Set    | 2   |
| LED Strip        | WS2812B 1m 60LED/m | 1   |

### Wiring & Prototyping

| Component      | Model                               | Qty |
| -------------- | ----------------------------------- | --- |
| Breadboard Kit | AZDelivery MB 102 (830pt + jumpers) | 1   |
| Jumper Wires   | ELEGOO 3er Set (120 pcs)            | 1   |
| USB-C Cables   | LISEN USB-C 4er Pack                | 1   |
| Ethernet Cable | Cat6 2m SFTP                        | 1   |
| Perfboard Set  | AZDelivery 16× PCB                  | 1   |
| Resistors      | 220Ω 10er Set                       | 1   |
