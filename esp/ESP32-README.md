# ESP32 Bikeslot-Prototyp

Hardware: ESP32 DevKit (ESP-WROOM-32), 4x Grove Ultrasonic Ranger V2.0, WS2812B-Strip.
Firmware: `esp32-esphome.yaml` (ESPHome, eine Datei, keine Zusatzdateien).
Der ESP32 verbindet sich mit dem AP des Pi (`Hackabike-ESP`) und spricht MQTT
mit dem Broker `192.168.50.1:1883`.

## Verdrahtung

| Bauteil | Pin am Bauteil | ESP32 | Hinweis |
|---|---|---|---|
| Ultrasonic Slot 1 | SIG | D18 | ein Pin fuer Trigger und Echo |
| Ultrasonic Slot 2 | SIG | D19 | |
| Ultrasonic Slot 3 | SIG | D21 | |
| Ultrasonic Slot 4 | SIG | D22 | |
| alle Ultrasonic | VCC / GND | 3V3 / GND | NC bleibt frei |
| WS2812B | DI (und BI) | D13 ueber 330 Ohm | am **Eingang** des Strips (Pfeile zeigen vom Anschluss weg) |
| | 5V | VIN ueber Diode (1N4001, Ring zum Strip) | Diode senkt Strip auf ca. 4,3 V, damit 3,3 V Datenpegel reichen |
| | GND | GND | gemeinsame Masse |

Nicht verwenden: D34, D35, VP, VN (nur Eingang), D12, D15, D2, D0 (Strapping), GPIO 6-11 (Flash).

## LED-Layout

2 LEDs pro Slot, 4 LEDs Luecke dazwischen (`num_leds: 20`):

| Slot | LEDs (ab 0) |
|---|---|
| 1 | 0-1 |
| 2 | 6-7 |
| 3 | 12-13 |
| 4 | 18-19 |

Anpassen ueber `LEDS_PER_SLOT` und `GAP` im Effekt; `num_leds = 4*LEDS_PER_SLOT + 3*GAP`.

## MQTT

| Topic | Richtung | Payload |
|---|---|---|
| `bikestation/slot{1-4}/state` | Pi -> ESP32 | `free` gruen, `occupied` rot, `reserved` blau blinkend, `alarm` rot schnell blinkend, sonst aus |
| `bikestation/slot{1-4}/distance` | ESP32 -> Pi | Abstand in cm (ca. 1 s, Sensoren zeitlich versetzt) |
| `bikestation/bikeslot-test/status` | ESP32 -> Pi | `online` / `offline` |

Alle Slots auf `free` (retained, damit der ESP32 den Zustand nach Neustart direkt bekommt):

```bash
for i in 1 2 3 4; do
  mosquitto_pub -h 192.168.50.1 -t bikestation/slot$i/state -m free -r
done
```

Mitlesen: `mosquitto_sub -h 192.168.50.1 -t 'bikestation/#' -v`

## Flashen

Der Web-Flasher (web.esphome.io) schreibt nur eine fertige `.bin`; die YAML muss vorher
kompiliert werden. Vom Pi aus, ESP32 per USB:

```bash
docker run --rm -it -v "$PWD":/config --device /dev/ttyUSB0 \
  ghcr.io/esphome/esphome run esp32-esphome.yaml --device /dev/ttyUSB0
```

Danach per WLAN (OTA), IP aus dem DHCP-Bereich `192.168.50.100-150`:

```bash
docker run --rm -it -v "$PWD":/config ghcr.io/esphome/esphome run esp32-esphome.yaml --device <ESP32-IP>
```

Serielle Konsole: 115200 Baud.

## Bekannte Punkte

- Der Strip hat keinen Weisskanal (RGBW-Test hat nicht funktioniert): bei `WS2812` / RGB bleiben.
- Flash-Probleme ("Invalid head of packet"): Board nackt (ohne Strip/Sensoren) flashen,
  BOOT-Taste beim Verbinden halten, anderes Datenkabel/USB-Port. Notfalls 10 uF zwischen EN und GND.
- WLAN-Passwort steht im Klartext in der YAML; bei Bedarf auf `!secret` umstellen.
- Belegt/frei-Entscheidung (Schwellwert auf `distance`) trifft der Pi; Sabotage-Erkennung,
  Keypad-Check-in und QR/NFC sind noch offen.
