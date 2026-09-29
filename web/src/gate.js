// Opening the gate from the app.
//
// "park" goes through the same path as an RFID card: a tap is published on
// bikestation/entrance/nfc/tap, so Node-RED reserves a slot and shows it on
// the LCD exactly as for a chip. Nothing in the flow drives the servo, so
// the gate itself is opened and closed here.
// "pickup" only opens the gate - no slot is reserved for someone leaving.
const mqtt = require('mqtt');
const { pool } = require('./db');
const live = require('./live');

const GATE_TOPIC = 'bikestation/entrance/gate';
const TAP_TOPIC = 'bikestation/entrance/nfc/tap';
const OPEN_S = Number(process.env.GATE_OPEN_SECONDS || 8);
const COOLDOWN_S = Number(process.env.GATE_COOLDOWN_SECONDS || 10);

const client = mqtt.connect(process.env.MQTT_URL || 'mqtt://mosquitto:1883', {
  clientId: `bikestation-web-${process.pid}`,
  reconnectPeriod: 3000,
});
client.on('connect', () => console.log('mqtt: connected'));
client.on('error', (err) => console.error('mqtt:', err.message));

let closeTimer = null;
let closesAt = null;
const lastByUser = new Map();

const publish = (topic, payload) => new Promise((resolve, reject) => {
  // never retained: a reconnecting ESP must not replay an old "open"
  client.publish(topic, payload, { qos: 1, retain: false }, (err) => (err ? reject(err) : resolve()));
});

async function logEvent(userId, action, result, detail = null) {
  await pool.query(
    'INSERT INTO gate_events (user_id, action, result, detail) VALUES ($1, $2, $3, $4)',
    [userId, action, result, detail]);
}

async function reservedSlotSince(t0) {
  const { rows } = await pool.query(`
    SELECT substring(topic FROM 'slot([0-9]+)')::int AS slot FROM telemetry
    WHERE topic ~ '^bikestation/slot[0-9]+/state$' AND payload = 'reserved' AND ts >= $1
    ORDER BY ts DESC LIMIT 1`, [t0]);
  return rows[0] ? rows[0].slot : null;
}

async function open(user, action) {
  if (!['park', 'pickup'].includes(action)) {
    return { status: 400, body: { error: 'Unbekannte Aktion.' } };
  }
  if (!client.connected) {
    return { status: 503, body: { error: 'Keine Verbindung zum MQTT-Broker.' } };
  }
  const last = lastByUser.get(user.id) || 0;
  const wait = Math.ceil((last + COOLDOWN_S * 1000 - Date.now()) / 1000);
  if (wait > 0) {
    return { status: 429, body: { error: `Bitte noch ${wait} s warten.` } };
  }

  const t0 = new Date();
  if (action === 'park') {
    const snap = await live.fast();
    if (snap.fresh && snap.free === 0) {
      await logEvent(user.id, action, 'full');
      return { status: 409, body: { error: 'Die Station ist gerade voll.' } };
    }
    await publish(TAP_TOPIC, JSON.stringify({ uid: `APP-${user.username}`, source: 'app' }));
  }

  lastByUser.set(user.id, Date.now());
  await publish(GATE_TOPIC, 'open');
  clearTimeout(closeTimer);
  closesAt = new Date(Date.now() + OPEN_S * 1000);
  closeTimer = setTimeout(() => {
    publish(GATE_TOPIC, 'close').catch((err) => console.error('gate close failed:', err.message));
    closesAt = null;
  }, OPEN_S * 1000);

  // Node-RED answers the tap within a few hundred ms; the ingest lands it in
  // the db right after. Look for it briefly so the app can name the slot.
  let slot = null;
  if (action === 'park') {
    for (let i = 0; i < 8 && slot === null; i++) {
      await new Promise((r) => setTimeout(r, 250));
      slot = await reservedSlotSince(t0);
    }
  }
  await logEvent(user.id, action, 'opened', slot ? `slot ${slot}` : null);
  return { status: 200, body: { ok: true, action, slot, openSeconds: OPEN_S, closesAt } };
}

const state = () => ({ mqtt: client.connected, closesAt });

module.exports = { open, state };
