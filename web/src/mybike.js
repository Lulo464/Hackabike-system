// "Mein Rad" and linking a chip to the account.
//
// Linking: the app sets pair_until = now() + 60 s. The next chip tapped at the
// reader that belongs to nobody is linked to this account by Node-RED's tap
// lookup (and that tap does not reserve a slot). The app polls /api/me/chip.
const { pool } = require('./db');

const PAIR_SECONDS = 60;

const tail = (uid) => (uid ? uid.slice(-4) : null);

async function chipStatus(userId) {
  const { rows: [u] } = await pool.query(
    `SELECT rfid_uid, CASE WHEN pair_until > now() THEN pair_until END AS pair_until
     FROM app_users WHERE id = $1`, [userId]);
  return { linked: Boolean(u.rfid_uid), uidTail: tail(u.rfid_uid), pairingUntil: u.pair_until };
}

async function getChip(req, res) {
  res.json(await chipStatus(req.user.id));
}

async function startPairing(req, res) {
  await pool.query(
    'UPDATE app_users SET pair_until = now() + make_interval(secs => $2) WHERE id = $1',
    [req.user.id, PAIR_SECONDS]);
  res.json(await chipStatus(req.user.id));
}

async function cancelPairing(req, res) {
  await pool.query('UPDATE app_users SET pair_until = NULL WHERE id = $1', [req.user.id]);
  res.json(await chipStatus(req.user.id));
}

async function unlinkChip(req, res) {
  await pool.query('UPDATE app_users SET rfid_uid = NULL, pair_until = NULL WHERE id = $1', [req.user.id]);
  res.json(await chipStatus(req.user.id));
}

// sessions of this user: by account, by app uid, or by the linked chip (also
// sessions from before the chip was linked)
const SESSIONS_SQL = `
SELECT s.status, s.slot, s.reserved_at, s.expires_at, s.parked_at, s.ended_at
FROM parking_sessions s, app_users u
WHERE u.id = $1
  AND (s.user_id = u.id OR s.uid = 'APP-' || u.username OR s.uid = u.rfid_uid)
ORDER BY s.reserved_at DESC
LIMIT 20`;

async function getBike(req, res) {
  const { rows } = await pool.query(SESSIONS_SQL, [req.user.id]);
  const now = Date.now();
  const current = rows.find((s) => s.status === 'parked'
    || (s.status === 'reserved' && (!s.expires_at || s.expires_at.getTime() > now))) || null;
  const last = rows.find((s) => s.status === 'done') || null;
  const shape = (s) => s && {
    status: s.status,
    slot: s.slot,
    reservedAt: s.reserved_at,
    expiresAt: s.expires_at,
    parkedAt: s.parked_at,
    endedAt: s.ended_at,
  };
  res.json({
    now: new Date().toISOString(),
    current: shape(current),
    last: shape(last),
    parkedCount: rows.filter((s) => s.parked_at).length,
  });
}

module.exports = { getChip, startPairing, cancelPairing, unlinkChip, getBike };
