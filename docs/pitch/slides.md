---
marp: true
title: Hackabike – Smart Bikestation
author: Luca, Tobias
paginate: true
size: 16:9
style: |
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;600&family=JetBrains+Mono:wght@500&display=swap');
  section {
    background: #F2F5EF; color: #17241F;
    font-family: 'IBM Plex Sans', Arial, sans-serif; font-size: 26px;
    padding: 64px 80px; justify-content: flex-start;
  }
  h1, h2, h3 { font-family: 'Space Grotesk', Arial, sans-serif; font-weight: 700; color: inherit; }
  h1 { font-size: 104px; letter-spacing: -2px; margin: 0; }
  h2 { font-size: 50px; line-height: 1.1; margin: 0 0 32px; }
  h6 { font-family: 'IBM Plex Sans', sans-serif; font-size: 18px; font-weight: 600; letter-spacing: 3px;
       text-transform: uppercase; color: #1B7F4B; margin: 0 0 8px; }
  strong { font-family: 'Space Grotesk', Arial, sans-serif; }
  code { font-family: 'JetBrains Mono', monospace; background: none; color: inherit; }
  section::after { font-size: 16px; color: #6B7C73; }
  table { font-size: 22px; border-collapse: collapse; width: 100%; }
  th { color: #1B7F4B; text-align: left; }
  th, td { padding: 8px 14px; border-bottom: 1px solid #D9E2DB; background: none; }
  blockquote { border: none; color: #4A5A52; font-size: 24px; }
  pre { background: #FFFFFF; border: 1px solid #D9E2DB; border-radius: 12px; font-size: 18px; color: #17241F; }

  section.dark { background: #12201B; color: #EEF3EC; }
  section.dark h6 { color: #3DDC84; }
  section.dark th { color: #3DDC84; }
  section.dark th, section.dark td { border-bottom-color: #2E5443; }
  section.dark::after { color: #8FA89A; }

  section.title { justify-content: center; background: linear-gradient(110deg, #12201B 62%, #1C3A2E 100%); }
  section.title p { font-size: 34px; color: #C9D6CE; max-width: 820px; }
  section.title footer { font-size: 18px; color: #8FA89A; }

  section.accent { background: #3DDC84; color: #0E1A15; }
  section.accent h6 { color: #0E1A15; }

  /* a list of "**Title**<br>text" items becomes a row or grid of cards */
  section.cards > ul, section.cards2 > ul, section.cards3 > ul, section.numbers > ul {
    list-style: none; padding: 0; margin: 0; display: grid; gap: 22px; align-items: stretch;
  }
  section.cards > ul  { grid-template-columns: repeat(3, 1fr); }
  section.cards2 > ul { grid-template-columns: repeat(2, 1fr); }
  section.cards3 > ul { grid-template-columns: repeat(3, 1fr); }
  section.cards > ul > li, section.cards2 > ul > li, section.cards3 > ul > li {
    margin: 0; background: #FFFFFF; border: 1px solid #D9E2DB; border-radius: 16px; padding: 24px 26px;
    color: #4A5A52; line-height: 1.4;
  }
  section.cards > ul > li > strong, section.cards2 > ul > li > strong, section.cards3 > ul > li > strong {
    display: block; font-size: 30px; color: #17241F; margin-bottom: 8px;
  }
  section.dark.cards > ul > li, section.dark.cards2 > ul > li, section.dark.cards3 > ul > li { background: #1A2E26; border-color: #2E5443; color: #C9D6CE; }
  section.dark.cards > ul > li > strong, section.dark.cards2 > ul > li > strong, section.dark.cards3 > ul > li > strong { color: #3DDC84; }
  section li ol, section li ul { margin: 4px 0 0; padding-left: 1.2em; font-size: 23px; }
  section li li { margin: 4px 0 0; }
  section li ol { list-style: decimal; }
  section.accent footer, section.accent::after { color: #1D3B2E; }
  section.numbers > ul { grid-template-columns: repeat(4, 1fr); }
  section.numbers > ul > li { margin: 0; font-size: 24px; line-height: 1.35; }
  section.numbers > ul > li > strong { display: block; font-size: 72px; line-height: 1; margin-bottom: 10px; }
  section.dark.numbers > ul > li > strong { color: #3DDC84; }
---

<!-- _class: title dark -->
<!-- _paginate: false -->

###### Kalkar Hackathon 2026

# Hackabike

The smart bike station that guides you to a free slot and guards your bike until you come back.

<footer>[Team name] · Group 12 · Luca · Tobias</footer>

<!--
Open with the one-sentence promise: we guide you to a free slot and guard your bike until you come back. Introduce yourselves: Luca and Tobias. Replace [Team name] with the official team name before presenting.
-->

---

<!-- _class: cards -->

###### The problem

## A bike rack tells you nothing and protects nothing.

- **Where is a free spot?** You only find out when you are standing in front of it.
- **Is my bike still safe?** A lock slows a thief down, but nobody notices.
- **Who parked here?** There is no link between a bike and its owner.

<!--
Keep this short. Three questions every cyclist knows: where can I park, is my bike still there, and who does this bike belong to. A normal rack answers none of them.
-->

---

<!-- _class: dark cards -->

###### Our solution

## One station that knows every slot and every owner.

- **🔑 Access** NFC chip or phone app. Only accounts get in, one bike each.
- **💡 Guidance** Your slot lights up, the LCD greets you, the gate opens.
- **🚨 Protection** A bike leaves without its owner? Alarm, and the station locks.

<!--
Three pillars: access, guidance, protection. Everything that follows is how these three work and how we made them reliable.
-->

---

<!-- _class: cards -->

###### Live demo

## One rider, three moments

- **1 · Park**
  1. Tap chip or press *Park*
  2. LCD "Park at Slot 2", slot blinks blue
  3. Gate opens
  4. Bike in: "Secured", gate closes
- **2 · Pick up**
  1. Tap again
  2. Your slot blinks blue
  3. Gate opens, take your bike
  4. Slot empty: gate opens 5 s to leave
- **3 · Theft**
  1. Secured bike leaves, no pickup
  2. Slot blinks red, gate shuts
  3. Every chip and app refused
  4. Admin clears it on the dashboard

<!--
Switch to the station now. Demo in this order: park with the chip, show the LCD and the blue slot, push the bike in and watch the gate close. Then pick it up. Finally put a second bike in, take it out without tapping, show the alarm, a refused tap, and clear it on /dashboard/admin. Keep the phone app ready to show that the same rules apply there.
-->

---

<!-- _class: dark cards2 -->

###### Innovation

## What makes it different

- **One path for chip and phone** The app sends the same tap as a chip, so both follow exactly the same rules.
- **Alarms without false alarms** Only bikes secured through a reservation are guarded. Test objects and broken sensors never trigger.
- **The station defends itself** A theft locks every entrance until an admin clears it, even across restarts.
- **It learns when it gets busy** An hourly occupancy forecast from real sensor history, in German, English and Dutch.

<!--
Innovation is 20 points. Stress the ideas, not the parts: one logic path for chip and app, alarms that only guard real parked bikes, a station that locks itself after a theft, and a forecast built from our own data.
-->

---

<!-- _class: cards3 -->

###### Technical implementation

## Architecture

- **📱 Phone** Web app, reached through a Pangolin tunnel
- **🖥️ Raspberry Pi 4** Mosquitto · Node-RED · PostgreSQL · web app, in Docker Compose
- **📶 Own Wi-Fi network** ESPs talk MQTT to the Pi, with no route to the school LAN
- **ESP32 #1** LED strip for all 4 slots, distance sensors slot 1 + 2
- **ESP32 #2** NFC reader, LCD, gate servo, distance sensors slot 3 + 4
- **🧠 Node-RED decides** The ESPs only measure and execute

<!--
Technical implementation is the biggest block, 40 points. The Pi runs four containers. Node-RED holds all decisions; the ESPs only measure and execute. The ESPs sit on their own Wi-Fi network with no route to the school LAN, so a compromised ESP can only reach the broker. We split the work across two ESPs so the entrance hardware does not slow down the sensors.
-->

---

<!-- _class: dark -->

###### Technical implementation

## Hardware

| Part | Model | Job |
|---|---|---|
| Server | Raspberry Pi 4 (4 GB) | broker, logic, database, web, Wi-Fi AP |
| Controllers | 2 × ESP32 DevKit | sensors, LEDs, entrance |
| Slot sensors | 4 × Grove Ultrasonic | bike present, every 200 ms |
| Slot lights | WS2812B LED strip | free · occupied · reserved · alarm |
| Access | PN532 NFC reader | chip taps |
| Display | Grove LCD RGB 16×2 | greeting, slot, colour-coded status |
| Gate | Tower Pro MG90S servo | opens and closes the entrance |

<!--
All parts are cheap and off the shelf. Firmware is ESPHome, so every ESP is described in one readable YAML file instead of custom C code.
-->

---

<!-- _class: cards3 -->

###### Technical implementation

## Every bike has a lifecycle

- **`reserved`** slot blinks blue, 5 min to arrive
- **`parked`** "Secured", gate closes
- **`done`** picked up by its owner
- **`reserved → expired`** no bike within 5 minutes, the slot is free again
- **`parked → alarm`** bike leaves without pickup, the station locks until an admin clears it
- **Debounced** a slot only changes after 5 equal readings

<!--
Each reservation is one row in Postgres and moves through these states. The Node-RED logic only counts a slot as changed after five equal readings, so a flickering sensor never ends a session or raises an alarm.
-->

---

<!-- _class: dark cards3 -->

###### Technical implementation

## Built for the real world

- **Debounced sensors** Median filter on the ESP, 5 equal readings in Node-RED.
- **No echo ≠ empty** A broken sensor reports 999 and is ignored, never "bike gone".
- **State survives restarts** Alarms and reservations are stored on disk; a reboot cannot unlock.
- **Honest app feedback** The app waits for the station's answer before it says "open".
- **Isolated ESP network** The ESPs reach the broker and nothing else.
- **Load split** Two ESPs: every slot reports every 200 ms instead of every second.

<!--
This is what "professional and stable" means for us. Each card is a problem we actually hit and fixed: flickering sensors, a sensor without echo, a lost tap during a restart, and slow updates with one ESP.
-->

---

<!-- _class: accent numbers -->

###### Live data from the station

## It runs, and it records everything

- **483k** sensor readings stored
- **33** parking sessions, 31 completed
- **84** taps, 17 of them from the app
- **8.5 s** average from tap to "Secured"

<footer>Source: the station's PostgreSQL database, 29 Sep 2026, data since 01:18</footer>

<!--
These numbers come straight from our database during testing today. Refresh them right before the pitch with the queries in postgres/README.md. The 483 thousand readings are about eleven hours of four sensors at five readings per second. 8.5 seconds is the average from the reservation to the bike being secured.
-->

---

<!-- _class: cards2 -->

###### Testing & quality

## Tested in code and on the station

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
  - Pi reboot: everything back in about a minute
  - every deploy: checksum check and backup first
  - bugs found from the tap log in the database

<!--
Testing is 10 points. The station logic runs in a test harness that replays sensor readings and taps and checks the LEDs, gate and LCD for 14 scenarios, and it ran before every deploy. On the hardware we tested each feature live and used the telemetry table to find a lost tap during a restart, which led to the app waiting for the station's answer.
-->

---

<!-- _class: dark numbers -->

###### Open source & documentation

## Built on open source, documented in the open

ESPHome · Node-RED · Eclipse Mosquitto · PostgreSQL · Docker Compose · Node.js / Express · FlowFuse Dashboard

- **56** commits
- **4** contributors
- **8** READMEs
- **1,200+** lines of docs

<footer>github.com/LX-Chrome/Hackabike-system</footer>

<!--
Every part of the station is open source. The repository has a README for the stack, the ESP firmware, the Wi-Fi access point, the web app, the broker and the database: setup, wiring, MQTT topics, troubleshooting and a security checklist. Anyone can rebuild the station from it.
-->

---

<!-- _class: cards2 -->

###### Honest limits

## What a hackathon build still lacks

- **Demo security** The broker and the Node-RED editor have no login yet. The steps to lock them down are documented.
- **NFC reader after a reset** It only recovers after a power cycle. Fine on power-up, annoying after an update.
- **Sound is designed, not built** Melody and alarm beep are planned, but we could not get an amplifier.
- **Four slots** A prototype size. More slots mean more sensors and LEDs, not a new design.

<!--
Being open about limits shows we understand the system. Each of these is known, documented in the repository, and has a clear fix.
-->

---

<!-- _class: dark -->

###### Next steps

## From prototype to product

1. Logins for broker and Node-RED, secrets out of the repository
2. A transistor that power-cycles the NFC reader on boot
3. Entrance sound: welcome melody and alarm beep
4. More slots: one more ESP per two slots, same logic

<!--
Close the technical part with a realistic roadmap. None of these needs a redesign: the architecture already separates decisions (Node-RED) from hardware (ESPs).
-->

---

<!-- _class: title dark -->
<!-- _paginate: false -->

# Thank you

Questions? Try it yourself: tap a chip at the station.

<footer>github.com/LX-Chrome/Hackabike-system · Luca · Tobias · Group 12</footer>

<!--
Invite the jury to the station and hand them a chip. Keep /dashboard/admin open on a laptop in case a demo alarm needs clearing.
-->
