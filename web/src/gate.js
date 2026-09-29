// Opening the gate from the app.
//
// The app behaves exactly like a chip: it publishes a tap
// {"uid":"APP-<user>","action":"park"|"pickup"} on bikestation/entrance/nfc/tap.
// The Node-RED station logic then greets the user on the LCD, reserves a slot
// (park), opens the gate and closes it after 8 s, and records the parking
// session. This service only waits briefly to tell the app which slot it got.
const mqtt = require('mqtt');
const { pool } = require('./db');
const live = require('./live');

const TAP_TOPIC = 'bikestation/entrance/nfc/tap';
const OPEN_S = 8; // matches the gate sequence in Node-RED
const COOLDOWN_S = Number(process.env.GATE_COOLDOWN_SECONDS || 10);

const client = mqtt.connect(process.env.MQTT_URL || 'mqtt://mosquitto:1883', {
  clientId: `bikestation-web-${process.pid}`,
  reconnectPeriod: 3000,
});
client.on('connect', () => console.log('mqtt: connected'));
client.on('error', (err) => console.error('mqtt:', err.message));

const lastByUser = new Map();

const publish = (topic, payload) => new Promise((resolve, reject) => {
  client.publish(topic, payload, { qos: 1, retain: false }, (err) => (err ? reject(err) : resolve()));
});

async function logEvent(userId, action, result, detail = null) {
  await pool.query(
    'INSERT INTO gate_events (user_id, action, result, detail) VALUES ($1, $2, $3, $4)',
    [userId, action, result, detail]);
}

// the reservation Node-RED made for this user after t0, if any
async function reservedSlot(user, t0) {
  const { rows } = await pool.query(`
    SELECT slot FROM parking_sessions
    WHERE status = 'reserved' AND (user_id = $1 OR uid = $2)
      AND (reserved_at >= $3 OR expires_at >= $3 + interval '4 minutes')
    ORDER BY reserved_at DESC LIMIT 1`, [user.id, `APP-${user.username}`, t0]);
  return rows[0] ? rows[0].slot : null;
}

async function parkedSlot(user) {
  const { rows } = await pool.query(`
    SELECT s.slot FROM parking_sessions s, app_users u
    WHERE u.id = $1 AND s.status = 'parked'
      AND (s.user_id = u.id OR s.uid = 'APP-' || u.username OR s.uid = u.rfid_uid)
    ORDER BY s.parked_at DESC LIMIT 1`, [user.id]);
  return rows[0] ? rows[0].slot : null;
}

async function open(user, action) {
  if (!['park', 'pickup'].includes(action)) {
    return { status: 400, body: { code: 'bad_action', error: 'Unbekannte Aktion.' } };
  }
  if (!client.connected) {
    return { status: 503, body: { code: 'mqtt_down', error: 'Keine Verbindung zum MQTT-Broker.' } };
  }
  const last = lastByUser.get(user.id) || 0;
  const wait = Math.ceil((last + COOLDOWN_S * 1000 - Date.now()) / 1000);
  if (wait > 0) {
    return { status: 429, body: { code: 'cooldown', wait, error: `Bitte noch ${wait} s warten.` } };
  }

  // Node-RED enforces the same rules; checking here gives the app a clear answer
  const snap = await live.fast();
  if (snap.locked) {
    await logEvent(user.id, action, 'error', 'locked');
    return { status: 423, body: { code: 'locked', error: 'Die Station ist wegen eines Alarms gesperrt.' } };
  }
  const parked = await parkedSlot(user);
  if (action === 'park' && parked) {
    return { status: 409, body: { code: 'has_bike', n: parked, error: `Du hast schon ein Rad in Slot ${parked}.` } };
  }
  if (action === 'pickup' && !parked) {
    return { status: 409, body: { code: 'no_bike', error: 'Du hast kein Rad geparkt.' } };
  }
  if (action === 'park' && snap.fresh && snap.free === 0) {
    await logEvent(user.id, action, 'full');
    return { status: 409, body: { code: 'full', error: 'Die Station ist gerade voll.' } };
  }

  const t0 = new Date();
  lastByUser.set(user.id, Date.now());
  await publish(TAP_TOPIC, JSON.stringify({ uid: `APP-${user.username}`, action, source: 'app' }));

  let slot = null;
  if (action === 'park') {
    // Node-RED looks the user up and writes the session within a few 100 ms
    for (let i = 0; i < 10 && slot === null; i++) {
      await new Promise((r) => setTimeout(r, 250));
      slot = await reservedSlot(user, t0);
    }
  } else {
    slot = parked;
  }
  await logEvent(user.id, action, 'opened', slot ? `slot ${slot}` : null);
  return { status: 200, body: { ok: true, action, slot, openSeconds: OPEN_S } };
}

const state = () => ({ mqtt: client.connected });

module.exports = { open, state };
