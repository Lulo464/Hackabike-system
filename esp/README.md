# ESP32-Firmware

Firmware für die beiden ESP32 der Bikestation, geschrieben mit
[ESPHome](https://esphome.io). Beide ESPs verbinden sich mit dem WLAN des Pi
(`Hackabike-ESP`, siehe [ap/README.md](../ap/README.md)) und sprechen MQTT mit
dem Broker auf `192.168.50.1:1883`. Entscheidungen trifft Node-RED auf dem Pi,
die ESPs messen und führen aus.

| | ESP 1 | ESP 2 |
|---|---|---|
| **Firmware** | [`esp32-esphome.yaml`](esp32-esphome.yaml) | [`esp32-esphome-2.yaml`](esp32-esphome-2.yaml) |
| **Name / MQTT-Client** | `bikeslot-test` | `bikeslot-2` |
| **Aufgabe** | LED-Strip für alle 4 Slots, Abstand Slot 1 + 2 | Abstand Slot 3 + 4, Eingang: NFC-Leser, LCD, Gate-Servo |

## Inhalt

- [Hardware](#hardware)
- [Verkabelung ESP 1](#verkabelung-esp-1)
- [Verkabelung ESP 2](#verkabelung-esp-2)
- [Flashen](#flashen)
- [MQTT](#mqtt)
- [Fehlersuche](#fehlersuche)
- [Idee: Sound am Eingang (nicht umgesetzt)](#idee-sound-am-eingang-nicht-umgesetzt)

## Hardware

| Bauteil | Modell | Anzahl |
|---|---|---|
| Mikrocontroller | ESP32 DevKit (ESP-WROOM-32) | 2 |
| Abstandssensor | Grove Ultrasonic Ranger V2.0 | 4 |
| LED-Strip | WS2812B (RGB, kein Weißkanal) | 1 |
| NFC-Leser | HW-147 (PN532 V3), per I²C | 1 |
| Display | Grove LCD RGB Backlight (16×2) | 1 |
| Gate-Servo | Tower Pro MG90S | 1 |

## Verkabelung ESP 1

| Bauteil | Pin am Bauteil | ESP32 | Hinweis |
|---|---|---|---|
| Ultraschall Slot 1 | SIG | D18 | ein Pin für Trigger und Echo |
| Ultraschall Slot 2 | SIG | D19 | |
| alle Ultraschall | VCC / GND | 3V3 / GND | NC bleibt frei |
| WS2812B | DI (und BI) | D13 über 330 Ω | am **Eingang** des Strips (die Pfeile zeigen vom Anschluss weg) |
| | 5V | VIN über Diode 1N4001 (Ring zum Strip) | senkt den Strip auf ca. 4,3 V, damit 3,3 V Datenpegel reichen |
| | GND | GND | gemeinsame Masse |

Frei: D21, D23.

### LED-Layout

2 LEDs pro Slot, 4 LEDs Lücke dazwischen (`num_leds: 20`):

| Slot | LEDs (ab 0) |
|---|---|
| 1 | 0–1 |
| 2 | 6–7 |
| 3 | 12–13 |
| 4 | 18–19 |

Anpassen über `LEDS_PER_SLOT` und `GAP` im Effekt „Slots“; es gilt
`num_leds = 4 × LEDS_PER_SLOT + 3 × GAP`.

## Verkabelung ESP 2

| Bauteil | Pin am Bauteil | ESP32 | Hinweis |
|---|---|---|---|
| Ultraschall Slot 3 | SIG | D18 | ein Pin für Trigger und Echo |
| Ultraschall Slot 4 | SIG | D19 | |
| alle Ultraschall | VCC / GND | 3V3 / GND | NC bleibt frei |
| NFC HW-147 (PN532) | SDA / SCL | D21 / D22 | I²C, Adresse `0x24` |
| | VCC / GND | 3V3 / GND | **nicht 5V**, die I²C-Pull-ups hängen an VCC |
| | DIP-Schalter | SW1 = ON, SW2 = OFF | I²C-Modus, wird nur beim Einschalten gelesen |
| Grove LCD RGB | SDA / SCL | D21 / D22 | gleicher I²C-Bus, Adressen `0x3E` (Text) und `0x62` (Farbe) |
| | VCC / GND | 5V (VIN) / GND | vorher messen: an SDA dürfen höchstens ca. 3,6 V liegen |
| Servo MG90S (Gate) | Signal (orange) | D27 | |
| | + (rot) / − (braun) | 5V / GND | am besten eigenes 5V-Netzteil (GND verbinden), sonst 470 µF Elko am Servo |

Frei: D25 (für die [Sound-Idee](#idee-sound-am-eingang-nicht-umgesetzt) vorgesehen).

> [!WARNING]
> Der PN532 hängt nach jedem Neustart des ESP ohne Stromunterbrechung (Flashen,
> Reset-Taste, Absturz). Danach ESP 2 einmal ganz vom Strom trennen.

**Auf beiden ESPs nicht verwenden:** D34, D35, VP, VN (nur Eingang), D0, D2,
D12, D15 (Strapping-Pins), GPIO 6–11 (Flash).

### Was ESP 2 am Eingang tut

- **NFC:** Jede aufgelegte Karte wird einmal als Tap gemeldet. Dieselbe Karte
  zählt erst wieder, wenn sie 2 s weg war.
- **LCD:** zeigt den Text von Node-RED auf 2 × 16 Zeichen (nur ASCII) und färbt
  den Hintergrund:
  - rot bei `Full`, `ALARM`, `gesperrt`, `unbekannt`, `Kein Rad` und `schon`;
  - grün bei `Park at…`, `Secured…` und `Rad in Slot…`;
  - sonst weiß.
- **Gate:** Der Servo fährt auf den Winkel von Node-RED und schaltet das Signal
  1 s danach ab. Das verhindert Zittern und spart Strom.

## Flashen

Mit ESPHome auf dem Rechner, der ESP hängt per USB dran:

```bash
pipx install esphome                       # einmalig
cd esp
esphome run esp32-esphome.yaml   --device /dev/ttyUSB0    # ESP 1
esphome run esp32-esphome-2.yaml --device /dev/ttyUSB0    # ESP 2
```

Ohne lokale Installation geht es auch per Docker:

```bash
docker run --rm -it -v "$PWD":/config --device /dev/ttyUSB0 \
  ghcr.io/esphome/esphome run esp32-esphome-2.yaml --device /dev/ttyUSB0
```

Danach geht auch ein Update per WLAN (OTA): `--device <IP des ESP>`. Die IPs
kommen aus dem Bereich `192.168.50.100–150`.

> [!TIP]
> Welche Firmware auf einem angeschlossenen ESP läuft, verrät der Flash:
> ```bash
> esptool --port /dev/ttyUSB0 read-flash 0x10000 0x100000 app.bin && grep -ao 'bikeslot-[a-z0-9]*' app.bin | sort -u
> ```

Live-Log (115200 Baud):

```bash
esphome logs esp32-esphome-2.yaml --device /dev/ttyUSB0
# oder
screen /dev/ttyUSB0 115200        # beenden: Strg+A, K, y
```

Nach dem Flashen von **ESP 2** den USB-Stecker einmal ziehen, damit der NFC-Leser startet.

## MQTT

| Topic | Richtung | Payload |
|---|---|---|
| `bikestation/slot{1-4}/state` | Pi → ESP 1 | `free` grün, `occupied` rot, `reserved` blau blinkend (Reservierung oder Abholung), `alarm` rot schnell blinkend, sonst aus |
| `bikestation/slot{1-4}/distance` | ESP → Pi | Abstand in cm, je Slot alle 200 ms (Median über 5 Messungen, nicht retained) |
| `bikestation/slot{1-4}/sensor` | ESP → Pi | `ok` / `no_echo` (nach 3 Fehlmessungen in Folge, retained) |
| `bikestation/bikeslot-test/status` | ESP 1 → Pi | `online` / `offline` |
| `bikestation/bikeslot-2/status` | ESP 2 → Pi | `online` / `offline` |
| `bikestation/entrance/nfc/tap` | ESP 2 → Pi | `{"uid":"A1B2C3D4"}` |
| `bikestation/entrance/oled/display` | Pi → ESP 2 | Text fürs LCD (oder `{"text":"…"}`) |
| `bikestation/entrance/gate` | Pi → ESP 2 | Winkel in Grad `0`–`180`, oder `open` (90) / `close` (0) |
| `bikestation/entrance/gate/angle` | ESP 2 → Pi | zuletzt angefahrener Winkel (retained) |

Zum Testen vom Pi aus:

```bash
mosquitto_sub -h 192.168.50.1 -v -t 'bikestation/#'                 # alles mitlesen
mosquitto_pub -h 192.168.50.1 -t bikestation/slot1/state -m free -r  # LED Slot 1 grün
mosquitto_pub -h 192.168.50.1 -t bikestation/entrance/gate -m 90     # Gate auf
```

## Fehlersuche

| Problem | Ursache / Lösung |
|---|---|
| NFC-Leser meldet `pn532 is marked FAILED` | ESP 2 wurde ohne Stromunterbrechung neu gestartet. USB-Stecker ziehen und wieder einstecken. |
| I²C-Scan findet keine Geräte | DIP-Schalter auf I²C (SW1 ON, SW2 OFF), danach Strom ganz weg. Verkabelung SDA → D21, SCL → D22 prüfen. |
| Betriebs-LED am ESP wird dunkel, ESP startet neu | Kurzschluss oder VCC/GND vertauscht. Sofort abstecken und die Beschriftung am Modul prüfen. |
| Servo lässt den ESP abstürzen | Anlaufstrom zu hoch: eigenes 5V-Netzteil oder Elko am Servo. |
| Flashen scheitert („Invalid head of packet“) | Board ohne Strip und Sensoren flashen, BOOT-Taste beim Verbinden halten, anderes Datenkabel oder anderen USB-Port nehmen. Notfalls 10 µF zwischen EN und GND. |
| Erster WLAN-Versuch nach dem Start schlägt fehl | Normal (der AP hält die alte Verbindung noch). Der zweite Versuch klappt. |
| LEDs zeigen falsche Farben | Der Strip ist RGB ohne Weißkanal: bei `WS2812` / `GRB` bleiben. |

## Idee: Sound am Eingang (nicht umgesetzt)

> [!NOTE]
> Nur eine Idee. Der nötige Verstärker ist nicht verfügbar, nichts davon steckt
> in Firmware oder Flow.

**Ziel:** eine Hintergrundmelodie am Eingang und ein Piepen bei einem Diebstahl-Alarm.

**Nur Melodien, keine echte Musik.** Gemeint sind einstimmige
Klingelton-Melodien (RTTTL). MP3 oder Streams bräuchten ein I²S-Modul (z. B.
MAX98357A) und ESP-IDF statt Arduino, und sie würden neben NFC, LCD, Servo und
Sensoren ruckeln.

**Hardware:** passiver Lautsprecher und ein PAM8403-Verstärker an ESP 2. Den
Lautsprecher nie direkt an einen GPIO hängen, der Strom zerstört den Pin.

| Von | Nach | Hinweis |
|---|---|---|
| ESP D25 | PAM8403 L (Eingang) | über 1 kΩ, ideal zusätzlich 1–10 µF in Reihe |
| ESP GND | PAM8403 GND (Eingang) | gemeinsame Masse |
| 5V (VIN oder Servo-Netzteil) | PAM8403 5V | |
| GND | PAM8403 GND (Versorgung) | |
| Lautsprecher | PAM8403 L+ / L− | L− **nicht** auf GND, der PAM8403 ist ein Brückenverstärker |

Notlösung ohne Verstärker: NPN-Transistor (BC337 / 2N2222) mit 1 kΩ an der
Basis von D25, Lautsprecher mit 22–47 Ω in Reihe zwischen 5V und Kollektor.
Das ist leiser und klingt kratziger.

**Firmware (Skizze):**

```yaml
output:
  - platform: ledc
    id: sound_pwm
    pin: GPIO25

rtttl:
  id: sound
  output: sound_pwm
```

**Steuerung** per MQTT `bikestation/entrance/sound`:

- `music`: Hintergrundmelodie in Schleife (bei `on_finished_playback` neu starten)
- `alarm`: Piepen bis `stop`
- `stop`: Ruhe
- alles andere wird als RTTTL abgespielt, z. B. `beep:d=8,o=6,b=200:c,p,c,p,c`

**Node-RED:** bei einem `theft`-Alarm `alarm` senden, nach dem Zurücksetzen auf
`/dashboard/admin` wieder `music`.

## Hinweise

- Das WLAN-Passwort steht im Klartext in den YAMLs. Bei Bedarf auf `!secret` umstellen.
- Ob ein Slot belegt ist (Abstand < 5 cm), entscheidet Node-RED, nicht der ESP.
- Ohne Home Assistant würde ESPHome alle 15 min neu starten. Deshalb steht
  `api: reboot_timeout: 0s` in beiden Firmwares.
