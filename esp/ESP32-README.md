# ESP32 Bikeslot-Prototyp

Hardware: 2x ESP32 DevKit (ESP-WROOM-32), 4x Grove Ultrasonic Ranger V2.0, WS2812B-Strip.

| ESP | Firmware | Name / MQTT-Client | Aufgabe |
|---|---|---|---|
| ESP 1 | `esp32-esphome.yaml` | `bikeslot-test` | LED-Strip (alle 4 Slots) + Ultrasonic Slot 1/2 |
| ESP 2 | `esp32-esphome-2.yaml` | `bikeslot-2` | Ultrasonic Slot 3/4 + Eingang: RFID-Leser, LCD, Gate-Servo |

Jeder ESP32 verbindet sich mit dem AP des Pi (`Hackabike-ESP`) und spricht MQTT
mit dem Broker `192.168.50.1:1883`.

## Verdrahtung ESP 1

| Bauteil | Pin am Bauteil | ESP32 | Hinweis |
|---|---|---|---|
| Ultrasonic Slot 1 | SIG | D18 | ein Pin fuer Trigger und Echo |
| Ultrasonic Slot 2 | SIG | D19 | |
| alle Ultrasonic | VCC / GND | 3V3 / GND | NC bleibt frei |
| WS2812B | DI (und BI) | D13 ueber 330 Ohm | am **Eingang** des Strips (Pfeile zeigen vom Anschluss weg) |
| | 5V | VIN ueber Diode (1N4001, Ring zum Strip) | Diode senkt Strip auf ca. 4,3 V, damit 3,3 V Datenpegel reichen |
| | GND | GND | gemeinsame Masse |

D21 und D23 sind frei.

## Verdrahtung ESP 2

| Bauteil | Pin am Bauteil | ESP32 | Hinweis |
|---|---|---|---|
| Ultrasonic Slot 3 | SIG | D18 | ein Pin fuer Trigger und Echo |
| Ultrasonic Slot 4 | SIG | D19 | |
| alle Ultrasonic | VCC / GND | 3V3 / GND | NC bleibt frei |
| RFID HW-147 (PN532) | SDA | D21 | I2C, Adresse 0x24 |
| | SCL | D22 | |
| | VCC / GND | 3V3 / GND | **nicht 5V**: die I2C-Pull-ups haengen an VCC |
| | DIP-Schalter | SW1 = ON, SW2 = OFF | I2C-Modus |
| Grove-LCD RGB Backlight | SDA / SCL | D21 / D22 | gleicher I2C-Bus, Adressen 0x3E (Text) + 0x62 (RGB) |
| | VCC / GND | 5V (VIN) / GND | an SDA duerfen max. ca. 3,6 V anliegen, vorher messen |
| Servo MG90S (Gate) | Signal (orange) | D25 | |
| | + (rot) / - (braun) | 5V / GND | besser eigenes 5V-Netzteil (GND verbinden), sonst Elko 470 uF am Servo |

Nach dem Flashen oder einem Reset haengt der PN532, bis ESP 2 einmal ganz stromlos war
(USB-Stecker ziehen). Beim normalen Einschalten startet er sauber.

Nicht verwenden (beide ESPs): D34, D35, VP, VN (nur Eingang), D12, D15, D2, D0 (Strapping), GPIO 6-11 (Flash).

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
| `bikestation/slot{1-4}/state` | Pi -> ESP32 | `free` gruen, `occupied` rot, `reserved` blau blinkend (Reservierung oder Abholung), `alarm` rot schnell blinkend (Diebstahl, Station gesperrt), sonst aus |
| `bikestation/slot{1-4}/distance` | ESP32 -> Pi | Abstand in cm, je Slot alle 200 ms (Median ueber 5 Messungen, nicht retained) |
| `bikestation/slot{1-4}/sensor` | ESP32 -> Pi | `ok` / `no_echo` (nach 3 Fehlmessungen in Folge, retained) |
| `bikestation/bikeslot-test/status` | ESP 1 -> Pi | `online` / `offline` |
| `bikestation/bikeslot-2/status` | ESP 2 -> Pi | `online` / `offline` |
| `bikestation/entrance/nfc/tap` | ESP 2 -> Pi | `{"uid":"A1B2C3D4"}`, einmal pro aufgelegter Karte (gleiche Karte erst wieder nach 2 s weg) |
| `bikestation/entrance/oled/display` | Pi -> ESP 2 | Text fuers LCD (oder `{"text":"..."}`), 2x16 Zeichen, keine Umlaute. Hintergrund rot bei `Full`, `ALARM`, `gesperrt`, `unbekannt`, `Kein Rad`, `schon`; gruen bei `Park at...`/`Secured...`/`Rad in Slot...`; sonst weiss |
| `bikestation/entrance/gate` | Pi -> ESP 2 | Servo-Winkel in Grad `0`-`180`, oder `open` (90) / `close` (0) |
| `bikestation/entrance/gate/angle` | ESP 2 -> Pi | zuletzt angefahrener Winkel (retained) |

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

ESP 2 genauso mit `esp32-esphome-2.yaml` (und dem passenden `/dev/ttyUSB*`).

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
