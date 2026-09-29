# Pitch: Hackabike – Smart Bikestation

The slide deck for the final presentation at the Kalkar Hackathon 2026, by Luca and Tobias.
It follows the jury's evaluation form: innovation, technical implementation, testing & quality,
open source & documentation, and the pitch itself.

- **Slides:** [`slides/`](slides/) holds one HTML file per slide (1920×1080), [`deck.json`](deck.json) the order and fonts.
- **Figures** on the "Live data" and "Open source" slides are from 29 Sep 2026. Refresh them before
  presenting with the queries in [postgres/README.md](../../postgres/README.md#useful-queries) and `git shortlog -sn`.
- **Before presenting:** replace `[Team name]` on the first slide.

Below is the whole deck as text, with the speaker notes.

## 1. Hackabike

- Kalkar Hackathon 2026
- The smart bike station that guides you to a free slot and guards your bike until you come back.
- [Team name] · Group 12 · Luca · Tobias

> 🎤 Open with the one-sentence promise: we guide you to a free slot and guard your bike until you come back. Introduce yourselves: Luca and Tobias. Replace [Team name] with the official team name before presenting.

## 2. A bike rack tells you nothing and protects nothing.

- The problem
- **Where is a free spot?**
- You only find out when you are standing in front of it.
- **Is my bike still safe?**
- A lock slows a thief down, but nobody notices.
- **Who parked here?**
- There is no link between a bike and its owner.

> 🎤 Keep this short. Three questions every cyclist knows: where can I park, is my bike still there, and who does this bike belong to. A normal rack answers none of them.

## 3. One station that knows every slot and every owner.

- Our solution
- **Access**
- NFC chip or phone app. Only accounts get in, one bike each.
- **Guidance**
- Your slot lights up, the LCD greets you, the gate opens.
- **Protection**
- A bike leaves without its owner? Alarm, and the station locks.

> 🎤 Three pillars: access, guidance, protection. Everything that follows is how these three work and how we made them reliable.

## 4. One rider, three moments

- Live demo
- 1 · PARK
- Tap chip or press Park
- LCD: "Park at Slot 2", slot blinks blue
- Gate opens
- Bike in: "Secured", gate closes
- 2 · PICK UP
- Tap again
- Your slot blinks blue
- Gate opens, take your bike
- Slot empty: gate opens 5 s to leave
- 3 · THEFT
- Secured bike leaves, no pickup
- Slot blinks red, gate shuts
- Every chip and app refused
- Admin clears it on the dashboard

> 🎤 Switch to the station now. Demo in this order: park with the chip, show the LCD and the blue slot, push the bike in and watch the gate close. Then pick it up. Finally put a second bike in, take it out without tapping, show the alarm, a refused tap, and clear it on /dashboard/admin. Keep the phone app ready to show that the same rules apply there.

## 5. What makes it different

- Innovation
- **One path for chip and phone**
- The app sends the same tap as a chip, so both follow exactly the same rules.
- **Alarms without false alarms**
- Only bikes secured through a reservation are guarded. Test objects and broken sensors never trigger.
- **The station defends itself**
- A theft locks every entrance until an admin clears it, even across restarts.
- **It learns when it gets busy**
- An hourly occupancy forecast from real sensor history, in German, English and Dutch.

> 🎤 Innovation is 20 points. Stress the ideas, not the parts: one logic path for chip and app, alarms that only guard real parked bikes, a station that locks itself after a theft, and a forecast built from our own data.

## 6. Architecture

- Technical implementation
- Phone
- web app via Pangolin tunnel
- Raspberry Pi 4 · Docker Compose
- Mosquitto
- Node-RED
- PostgreSQL
- Web app
- own Wi-Fi network · MQTT · no route to the LAN
- ESP32 #1
- LED strip for all 4 slots · distance slot 1 + 2
- ESP32 #2
- NFC · LCD · gate servo · distance slot 3 + 4

> 🎤 Technical implementation is the biggest block, 40 points. The Pi runs four containers. Node-RED holds all decisions; the ESPs only measure and execute. The ESPs sit on their own Wi-Fi network with no route to the school LAN, so a compromised ESP can only reach the broker. We split the work across two ESPs so the entrance hardware does not slow down the sensors.

## 7. Hardware

| Part | Model | Job |
|---|---|---|
| Server | Raspberry Pi 4 (4 GB) | broker, logic, database, web, Wi-Fi AP |
| Controllers | 2 × ESP32 DevKit | sensors, LEDs, entrance |
| Slot sensors | 4 × Grove Ultrasonic | bike present, every 200 ms |
| Slot lights | WS2812B LED strip | free · occupied · reserved · alarm |
| Access | PN532 NFC reader | chip taps |
| Display | Grove LCD RGB 16×2 | greeting, slot, colour-coded status |
| Gate | Tower Pro MG90S servo | opens and closes the entrance |

- Technical implementation

> 🎤 All parts are cheap and off the shelf. Firmware is ESPHome, so every ESP is described in one readable YAML file instead of custom C code.

## 8. Every bike has a lifecycle

- Technical implementation
- reserved
- slot blinks blue, 5 min
- parked
- "Secured", gate closes
- done
- picked up by owner
- reserved → expired
- no bike within 5 minutes, slot is free again
- parked → alarm
- bike leaves without pickup, station locks until an admin clears it

> 🎤 Each reservation is one row in Postgres and moves through these states. The Node-RED logic only counts a slot as changed after five equal readings, so a flickering sensor never ends a session or raises an alarm.

## 9. Built for the real world

- Technical implementation
- **Debounced sensors**
- Median filter on the ESP, 5 equal readings in Node-RED.
- **No echo ≠ empty**
- A broken sensor reports 999 and is ignored, never "bike gone".
- **State survives restarts**
- Alarms and reservations are stored on disk; a reboot cannot unlock.
- **Honest app feedback**
- The app waits for the station's answer before it says "open".
- **Isolated ESP network**
- The ESPs reach the broker and nothing else.
- **Load split**
- Two ESPs: every slot reports every 200 ms instead of every second.

> 🎤 This is what "professional and stable" means for us. Each card is a problem we actually hit and fixed: flickering sensors, a sensor without echo, a lost tap during a restart, and slow updates with one ESP.

## 10. It runs, and it records everything

- Live data from the station
- 483k
- sensor readings stored
- 33
- parking sessions, 31 completed
- 84
- taps, 17 of them from the app
- 8.5 s
- average from tap to "Secured"
- Source: the station's PostgreSQL database, 29 Sep 2026, data since 01:18

> 🎤 These numbers come straight from our database during testing today. Refresh them right before the pitch with the queries in postgres/README.md. The 483 thousand readings are about eleven hours of four sensors at five readings per second. 8.5 seconds is the average from the reservation to the bike being secured.

## 11. Tested in code and on the station

- Testing & quality
- **14 logic scenarios, all passing**
- unknown chip is refused
- park, secure, pick up, exit gate 5 s
- second bike per account refused
- sensor without echo: no alarm
- theft: alarm, gate shut, all taps refused
- admin reset reopens the station
- **On the real hardware**
- every firmware validated with ESPHome
- unknown-chip tap and servo 90° → 0° live
- Pi reboot: all services and ESPs back in about a minute
- every deploy: checksum check and backup first
- bugs found from the tap log in the database

> 🎤 Testing is 10 points. The station logic runs in a test harness that replays sensor readings and taps and checks the LEDs, gate and LCD for 14 scenarios, and it ran before every deploy. On the hardware we tested each feature live and used the telemetry table to find a lost tap during a restart, which led to the app waiting for the station's answer.

## 12. Built on open source, documented in the open

- Open source & documentation
- Our stack
- ESPHome
- Node-RED
- Eclipse Mosquitto
- PostgreSQL
- Docker Compose
- Node.js · Express
- FlowFuse Dashboard
- 56
- commits
- 4
- contributors
- 8
- READMEs
- 1,200+
- lines of docs
- github.com/LX-Chrome/Hackabike-system

> 🎤 Every part of the station is open source. The repository has a README for the stack, the ESP firmware, the Wi-Fi access point, the web app, the broker and the database: setup, wiring, MQTT topics, troubleshooting and a security checklist. Anyone can rebuild the station from it.

## 13. What a hackathon build still lacks

- Honest limits
- **Demo security**
- The broker and the Node-RED editor have no login yet. The steps to lock them down are documented.
- **NFC reader after a reset**
- It only recovers after a power cycle. Fine on power-up, annoying after an update.
- **Sound is designed, not built**
- Melody and alarm beep are planned, but we could not get an amplifier.
- **Four slots**
- A prototype size. More slots mean more sensors and LEDs, not a new design.

> 🎤 Being open about limits shows we understand the system. Each of these is known, documented in the repository, and has a clear fix.

## 14. From prototype to product

- Next steps
- 1
- Logins for broker and Node-RED, secrets out of the repository
- 2
- A transistor that power-cycles the NFC reader on boot
- 3
- Entrance sound: welcome melody and alarm beep
- 4
- More slots: one more ESP per two slots, same logic

> 🎤 Close the technical part with a realistic roadmap. None of these needs a redesign: the architecture already separates decisions (Node-RED) from hardware (ESPs).

## 15. Thank you

- Questions? Try it yourself: tap a chip at the station.
- github.com/LX-Chrome/Hackabike-system · Luca · Tobias · Group 12

> 🎤 Invite the jury to the station and hand them a chip. Keep /dashboard/admin open on a laptop in case a demo alarm needs clearing.
