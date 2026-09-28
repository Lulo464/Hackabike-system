#!/usr/bin/env python3
"""Generate Node-RED flows.json for the Smart Bikestation dashboard.

Targets @flowfuse/node-red-dashboard v1.30.2 (Dashboard 2.x), whose node types
and property schemas were read out of the installed module rather than guessed:

  ui-page / ui-group / ui-dropdown / ui-text / ui-gauge / ui-chart
  ui-switch / ui-text-input / ui-button

Schema notes that matter (all verified against the module's `defaults`):
  * ui-page needs `ui` (ui-base) + `theme` (ui-theme) + `layout`.
  * ui-group references its page via `page` (type ui-page), not `z` alone.
  * ui-gauge uses `segments: [{color, from}]` - NOT the old `gseg`/`label`.
  * ui-gauge/ui-chart read msg.payload; there is no `topic` property.
  * ui-text uses `format: "{{msg.payload}}"`, not prop/propType/topic.
  * ui-dropdown options are `[{value, label}]`; no `datatype`/`valueInit`.

Wiring model: factories return node ids and wires are attached afterwards by
mutating node["wires"], so every connection is explicit - no placeholders.
"""
import json
from itertools import count

_ids = count(1)


def nid(prefix="n"):
    return f"{prefix}{next(_ids):04d}"


TAB = "tab_bikestation"
BROKER = "broker_local"

SLOTS = [1, 2, 3, 4]
SLOT_COLORS = {1: "#0094CE", 2: "#3a9e3a", 3: "#ff7f0e", 4: "#845ef7"}
COLOR_OPTS = ["green", "blue", "red", "yellow", "purple", "white", "off"]

nodes = []


def add(n):
    nodes.append(n)
    return n["id"]


def _wire(src, dsts, replace=False):
    for n in nodes:
        if n["id"] == src:
            n["wires"] = [list(dsts)] if replace else [list(n.get("wires", [[]])[0]) + list(dsts)]
            return
    raise KeyError(f"unknown node {src}")


def point(src, *dsts):
    _wire(src, dsts, replace=True)


def connect(src, *dsts):
    _wire(src, dsts)


# ---------------------------------------------------------------- config nodes
add({"id": TAB, "type": "tab", "label": "Smart Bikestation",
     "disabled": False,
     "info": "MQTT dashboard for the 4-slot Smart Bikestation.",
     "env": []})

UI_BASE = "ui_base_1"
UI_THEME = "ui_theme_1"
UI_PAGE = "ui_page_main"

# ui-base owns the URL path itself (its own `path` property, default
# /dashboard). ui-page does NOT carry the path; giving it one made ui-base
# register with a null path, which cascaded into every ui-group failing.
add({"id": UI_BASE, "type": "ui-base", "name": "Bikestation",
     "path": "/dashboard", "appIcon": "",
     "includeClientData": True,
     "acceptsClientConfig": ["ui-notification", "ui-control"],
     "showPathInSidebar": False, "headerContent": "page",
     "navigationStyle": "default", "titleBarStyle": "default",
     "showReconnectNotification": True, "notificationDisplayTime": 1,
     "showDisconnectNotification": True, "allowInstall": False,
     "theme": UI_THEME, "x": 320, "y": 40})

UI_THEME_SIZES = {
    "baseFontSize": "16px",
    "headerFontSize": "28px",
    "widgetFontSize": "18px",
    "widgetBorderRadius": "6px",
    "widgetFontWeight": "bold",
    "widgetTextColor": "#E4E7EB",
    "widgetBorder": "none",
    "widgetShadow": "none",
    "widgetPadding": "10px",
    "widgetMargin": "8px",
    "widgetBackground": "#2b3244",
    "groupBackground": "#161b26",
    "groupBorder": "2px solid #3d475c",
    "groupBorderRadius": "8px",
    "tabBackground": "#161b26",
    "tabBorder": "2px solid #3d475c",
    "tabBorderRadius": "8px",
    "tabSelectedBackground": "#3d475c",
    "tabSelectedBorderColor": "#4a90d9",
    "groupTitleFontSize": "20px",
    "groupTitleColor": "#ffffff",
    "groupTitleAlign": "left",
}

add({"id": UI_THEME, "type": "ui-theme", "name": "Bikestation Dark",
     "default": {
         "baseColor": "#1f2430",
         "baseFont": "Verdana,Geneva,DejaVu Sans,sans-serif",
         "theme": "dark",
         "sizes": UI_THEME_SIZES,
     },
     "x": 520, "y": 80})

add({"id": UI_PAGE, "type": "ui-page", "z": TAB, "name": "Bikestation",
     "ui": UI_BASE, "theme": UI_THEME, "layout": "grid",
     "order": 0, "className": "", "visible": True, "disabled": False,
     "breakpoints": [
         {"name": "Default", "px": 0, "cols": 3},
         {"name": "Tablet", "px": 576, "cols": 6},
         {"name": "Small Desktop", "px": 768, "cols": 9},
         {"name": "Desktop", "px": 1024, "cols": 12},
     ]})

add({"id": BROKER, "type": "mqtt-broker", "name": "bikestation-broker",
     "broker": "mosquitto", "port": "1883",
     "clientid": "nodered-bikestation", "autoConnect": True, "usetls": False,
     "protocolVersion": "4", "keepalive": "60", "cleansession": True,
     "autoUnsubscribe": True, "birthTopic": "", "birthQos": "0",
     "birthPayload": "", "birthMsg": {}, "closeTopic": "",
     "closeQos": "0", "closePayload": "", "closeMsg": {},
     "willTopic": "", "willQos": "0", "willPayload": "", "willMsg": {},
     "userProps": "", "sessionExpiry": ""})

GRP = {}
for key, label, order in [
    ("status", "System", 0),
    ("slots", "Slots", 1),
    ("led", "LED Control", 2),
    ("oled", "OLED Display", 3),
    ("charts", "History", 4),
    ("nfc", "NFC Check-in / out", 5),
]:
    gid = f"grp_{key}"
    GRP[key] = gid
    add({"id": gid, "type": "ui-group", "z": TAB, "name": label,
         "page": UI_PAGE, "style": {"label": True}, "order": order,
         "width": 12, "height": 1, "showTitle": True, "className": "",
         "visible": True, "disabled": False, "groupType": "default",
         "wires": [[]]})


# ---------------------------------------------------------------- factories
def mqtt_in(name, topic, y):
    return add({
        "id": nid("in"), "type": "mqtt in", "z": TAB, "name": name,
        "topic": topic, "qos": "0", "datatype": "auto-detect",
        "broker": BROKER, "nl": False, "rap": True, "rh": 0, "inputs": 0,
        "x": 170, "y": y, "wires": [[]],
    })


def mqtt_out(name, x=820, y=400):
    return add({
        "id": nid("out"), "type": "mqtt out", "z": TAB, "name": name,
        "topic": "", "qos": "0", "retain": "false", "respTopic": "",
        "contentType": "", "userProps": "", "correl": "", "expiry": "",
        "broker": BROKER, "x": x, "y": y, "wires": [],
    })


def fn(name, code, x, y):
    return add({
        "id": nid("fn"), "type": "function", "z": TAB, "name": name,
        "func": code, "outputs": 1, "timeout": 0, "noerr": 0,
        "initialize": "", "finalize": "", "libs": [],
        "x": x, "y": y, "wires": [[]],
    })


def text(name, group, order, width, height, value, color, font=18, wrap=True):
    """ui-text: rendered purely from msg.payload via the `format` property.

    NOTE the explicit "wires": []. A widget with no output still needs the
    key present - without it Node-RED treats the node as a config node, which
    breaks ui-page/ui-group registration and trips "Circular config node
    dependency detected".
    """
    return add({
        "id": nid("t"), "type": "ui-text", "z": TAB, "name": name,
        "group": group, "order": order, "width": width, "height": height,
        "wrapText": wrap, "tooltip": "", "valueType": "msg",
        "className": "", "format": "{{msg.payload}}",
        "layout": "row-spread", "style": False,
        "font": "", "fontSize": font, "color": color, "value": value,
        "wires": [[]],
    })


def gauge(name, group, order, gmin, gmax, units, segments, width=3, height=6):
    return add({
        "id": nid("g"), "type": "ui-gauge", "z": TAB, "name": name,
        "group": group, "order": order, "width": width, "height": height,
        "gtype": "gauge-half", "gstyle": "needle", "title": "",
        "alwaysShowTitle": False, "floatingTitlePosition": 0,
        "value": "payload", "valueType": "msg",
        "units": units, "icon": "", "prefix": "", "suffix": "",
        "segments": segments, "min": gmin, "max": gmax,
        "sizeThickness": 6, "sizeGap": 2, "sizeKeyThickness": 6,
        "styleRounded": True, "styleGlow": False, "className": "",
        "wires": [[]],
    })


def chart(name, group, order, ymin, ymax, yaxis, width=12, height=9):
    return add({
        "id": nid("c"), "type": "ui-chart", "z": TAB, "name": name,
        "group": group, "order": order, "width": width, "height": height,
        "chartType": "line", "category": "line", "categoryType": "line",
        "xAxisLabel": "", "xAxisProperty": "payload", "xAxisPropertyType": "msg",
        "xAxisType": "time", "xAxisFormat": "", "xAxisFormatType": "auto",
        "xmin": "", "xmax": "",
        "yAxisLabel": yaxis, "yAxisProperty": "payload",
        "yAxisPropertyType": "msg", "ymin": ymin, "ymax": ymax,
        "bins": 20, "action": "", "stackSeries": False,
        "pointShape": "circle", "pointRadius": 4,
        "showLegend": True, "removeOlder": 1, "removeOlderUnit": 3600,
        "removeOlderPoints": "", "colors": [], "textColorDefault": True,
        "textColor": "#ffffff", "gridColorDefault": True, "gridColor": "#555555",
        "className": "", "interpolation": "linear",
        "wires": [[]],
    })


def dropdown(name, group, order, topic, value, width=3):
    return add({
        "id": nid("dd"), "type": "ui-dropdown", "z": TAB, "name": name,
        "group": group, "order": order, "width": width, "height": 1,
        "tooltip": "", "passthru": False, "multiple": False, "chips": False,
        "clearable": False,
        "options": [{"label": o, "value": o} for o in COLOR_OPTS],
        "payload": "true", "topic": topic, "topicType": "str",
        "className": "", "typeIsComboBox": True, "msgTrigger": "onChange",
    })


def switch(name, group, order, topic, width=3):
    return add({
        "id": nid("sw"), "type": "ui-switch", "z": TAB, "name": name,
        "group": group, "order": order, "width": width, "height": 1,
        "passthru": False, "decouple": False, "topic": topic,
        "topicType": "str", "style": "", "className": "",
        "layout": "row-spread", "clickableArea": "switch",
        "onvalue": True, "onvalueType": "bool", "onicon": "", "oncolor": "#4a90d9",
        "offvalue": False, "offvalueType": "bool", "officon": "", "offcolor": "",
    })


def button(name, group, order, label, topic, width=3):
    return add({
        "id": nid("b"), "type": "ui-button", "z": TAB, "name": name,
        "group": group, "order": order, "width": width, "height": 1,
        "emulateClick": False, "tooltip": "", "color": "", "bgcolor": "",
        "className": "", "icon": "", "iconPosition": "left",
        "payload": "true", "payloadType": "str", "topic": topic,
        "topicType": "str", "buttonColor": "", "textColor": "",
        "iconColor": "", "enableClick": True, "enablePointerdown": False,
        "pointerdownPayload": "", "pointerdownPayloadType": "str",
        "enablePointerup": False, "pointerupPayload": "", "pointerupPayloadType": "str",
        "label": label,
    })


def text_input(name, group, order, topic, width=9):
    return add({
        "id": nid("ti"), "type": "ui-text-input", "z": TAB, "name": name,
        "group": group, "order": order, "width": width, "height": 1,
        "topic": topic, "topicType": "str", "mode": "text", "tooltip": "",
        "delay": 300, "passthru": True, "sendOnDelay": False,
        "sendOnBlur": True, "sendOnEnter": True, "className": "",
        "clearable": False, "sendOnClear": False, "icon": "",
        "iconPosition": "left", "iconInnerPosition": "inside",
    })


# ---------------------------------------------------------------- system
s_in = mqtt_in("system/status", "bikestation/system/status", 60)
s_fn = fn("parse status",
          "let p; try { p = JSON.parse(msg.payload); } catch (e) { return null; }\n"
          "msg.payload = (p.status || '?') + '   |   last seen ' + (p.timestamp || '-');\n"
          "return msg;", 400, 60)
s_ui = text("System Status", GRP["status"], 1, 12, 1,
            "waiting for ESP32...", "#8be9a8", font=18)
point(s_in, s_fn)
point(s_fn, s_ui)

a_in = mqtt_in("system/alerts", "bikestation/system/alerts", 120)
a_fn = fn("parse alert",
          "let p; try { p = JSON.parse(msg.payload); } catch (e) { return null; }\n"
          "msg.payload = (p.type || 'alert').toUpperCase()"
          " + (p.slot ? ' - slot ' + p.slot : '')"
          " + '   @ ' + (p.timestamp || '-');\nreturn msg;", 400, 120)
a_ui = text("Latest Alert", GRP["status"], 2, 12, 1,
            "no alerts", "#ff6b6b", font=16)
point(a_in, a_fn)
point(a_fn, a_ui)


# ---------------------------------------------------------------- slots
SEG_DIST = [{"color": "#2b8a3e", "from": 0},
            {"color": "#f0b429", "from": 60},
            {"color": "#c92a2a", "from": 120}]
SEG_VIB = [{"color": "#2b8a3e", "from": 0},
           {"color": "#f0b429", "from": 0.3},
           {"color": "#c92a2a", "from": 0.7}]

ch_d = chart("Distance History", GRP["charts"], 1, 0, 200, "cm")
ch_v = chart("Vibration History", GRP["charts"], 2, 0, 1, "g")

order = 1
for s in SLOTS:
    col = SLOT_COLORS[s]
    y = 200 + s * 90

    p_in = mqtt_in(f"slot{s}/proximity", f"bikestation/slot/{s}/proximity", y)
    p_fn = fn(f"parse slot{s} proximity",
              "let p; try { p = JSON.parse(msg.payload); }"
              " catch (e) { return null; }\n"
              f"msg.payload = 'Slot {s}:  ' + (p.occupied ? 'OCCUPIED' : 'FREE')"
              f" + '   (' + p.distance_cm + ' cm)';\nreturn msg;", 400, y)
    p_ui = text(f"Slot {s} state", GRP["slots"], order, 6, 1,
                f"Slot {s}: --", col, font=18)
    point(p_in, p_fn)
    point(p_fn, p_ui)
    order += 1

    d_g = gauge(f"Slot {s} distance", GRP["slots"], order, 0, 200, "cm", SEG_DIST)
    order += 1

    v_in = mqtt_in(f"slot{s}/vibration", f"bikestation/slot/{s}/vibration", y + 40)
    v_fn = fn(f"parse slot{s} vibration",
              "let p; try { p = JSON.parse(msg.payload); }"
              " catch (e) { return null; }\n"
              f"msg.payload = (p.alert ? 'ALERT' : 'OK');\nreturn msg;", 400, y + 40)
    v_ui = text(f"Slot {s} vibration state", GRP["slots"], order, 3, 1,
                "OK", "#e4e7eb", font=14)
    point(v_in, v_fn)
    point(v_fn, v_ui)
    order += 1

    g_g = gauge(f"Slot {s} vibration", GRP["slots"], order, 0, 1, "g", SEG_VIB)
    order += 1

    # feed the history charts from the raw mqtt-in messages
    connect(p_in, d_g, ch_d)
    connect(v_in, g_g, ch_v)


# ---------------------------------------------------------------- LED control
led_build = fn("build LED payload",
               "const seg = (msg.topic || '').split('/');\n"
               "// inbound topic: bikestation/set/<slot>/<color|blink>\n"
               "const slot = seg[2];\n"
               "const what = seg[3];\n"
               "if (what === 'color') { flow.set('color' + slot, msg.payload); }\n"
               "else { flow.set('blink' + slot, msg.payload === true "
               "|| msg.payload === 'true'); }\n"
               "msg.topic = 'bikestation/slot/' + slot + '/led';\n"
               "msg.payload = JSON.stringify({\n"
               "  slot: Number(slot),\n"
               "  color: flow.get('color' + slot) || 'green',\n"
               "  blink: flow.get('blink' + slot) || false\n"
               "});\n"
               "msg.qos = 0;\nmsg.retain = true;\nreturn msg;", 600, 700)
led_out = mqtt_out("LED out", 860, 700)
point(led_build, led_out)

order = 1
for s in SLOTS:
    dd = dropdown(f"Slot {s} colour", GRP["led"], order,
                  f"bikestation/set/{s}/color", "green")
    sw = switch(f"Slot {s} blink", GRP["led"], order + 1,
                f"bikestation/set/{s}/blink")
    lbl = text(f"Slot {s} LED", GRP["led"], order + 2, 3, 1,
               f"Slot {s}", SLOT_COLORS[s], font=14)
    point(dd, led_build)
    point(sw, led_build)
    order += 3


# ---------------------------------------------------------------- OLED
oi = text_input("OLED text", GRP["oled"], 1, "bikestation/entrance/oled/display")
ob = button("Send to OLED", GRP["oled"], 2, "Send to OLED",
            "bikestation/entrance/oled/display")
oint = fn("wrap OLED text", "msg.payload = String(msg.payload);\nreturn msg;",
          600, 800)
oo = mqtt_out("OLED out", 860, 800)
point(oi, oint)
point(ob, oint)
point(oint, oo)


# ---------------------------------------------------------------- NFC
n_in = mqtt_in("nfc/tap", "bikestation/entrance/nfc/tap", 760)
n_fn = fn("parse nfc",
          "let p; try { p = JSON.parse(msg.payload); }"
          " catch (e) { return null; }\n"
          "msg.payload = (p.timestamp || '-') + '   tag=' + (p.uid || '?');\n"
          "return msg;", 400, 760)
n_ui = text("Last Tap", GRP["nfc"], 1, 12, 1, "no tag tapped", "#74c0fc", font=16)
point(n_in, n_fn)
point(n_fn, n_ui)


# ---------------------------------------------------------------- save
with open("nodered/flows.json", "w", encoding="utf-8") as f:
    json.dump(nodes, f, indent=2, ensure_ascii=False)

by_type = {}
for n in nodes:
    by_type[n["type"]] = by_type.get(n["type"], 0) + 1
print(f"wrote {len(nodes)} nodes")
for k in sorted(by_type):
    print(f"  {k:14s} {by_type[k]}")
