// Accounts and sessions. Passwords are hashed with scrypt (Node built-in, no
// native module to compile on the Pi); session tokens are random and only
// their SHA-256 is stored, so a leaked table cannot be replayed as cookies.
const crypto = require('crypto');
const { promisify } = require('util');
const { pool } = require('./db');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'bs_session';
const SESSION_DAYS = 30;
const REGISTRATION_CODE = process.env.REGISTRATION_CODE || '';

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(pw, stored) {
  const [alg, salt, key] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64');
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), expected.length);
  return crypto.timingSafeEqual(got, expected);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setSessionCookie(res, token, maxAgeS) {
  // no Secure flag: the Pi serves plain http on the LAN / VPN
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}`);
}

async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO app_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [sha256(token), userId, SESSION_DAYS]);
  setSessionCookie(res, token, SESSION_DAYS * 86400);
}

// attaches req.user when the cookie belongs to a live session
async function loadUser(req, _res, next) {
  const token = readCookie(req, COOKIE);
  req.user = null;
  if (token) {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.display_name
       FROM app_sessions s JOIN app_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha256(token)]);
    if (rows[0]) req.user = rows[0];
  }
  next();
}

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ code: 'auth_required', error: 'Bitte zuerst anmelden.' });
  next();
}

// simple fixed-window limit per IP for login/register
const attempts = new Map();
function rateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.start > 10 * 60_000) attempts.set(key, { start: now, n: 1 });
  else if (++a.n > 15) {
    return res.status(429).json({ code: 'rate_limited', error: 'Zu viele Versuche. Bitte in ein paar Minuten erneut probieren.' });
  }
  next();
}

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

async function register(req, res) {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || '').trim().slice(0, 40) || username;
  if (REGISTRATION_CODE && req.body?.code !== REGISTRATION_CODE) {
    return res.status(403).json({ code: 'bad_code', error: 'Der Registrierungscode stimmt nicht.' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ code: 'bad_username', error: 'Benutzername: 3–32 Zeichen, nur a–z, 0–9, Punkt, Minus, Unterstrich.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ code: 'short_password', error: 'Das Passwort braucht mindestens 8 Zeichen.' });
  }
  const hash = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO app_users (username, display_name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (username) DO NOTHING RETURNING id, username, display_name`,
    [username, displayName, hash]);
  if (!rows[0]) return res.status(409).json({ code: 'username_taken', error: 'Diesen Benutzernamen gibt es schon.' });
  await createSession(res, rows[0].id);
  res.status(201).json({ user: publicUser(rows[0]) });
}

async function login(req, res) {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const { rows } = await pool.query(
    'SELECT id, username, display_name, password_hash FROM app_users WHERE username = $1', [username]);
  const ok = rows[0] && await verifyPassword(password, rows[0].password_hash);
  if (!ok) return res.status(401).json({ code: 'bad_login', error: 'Benutzername oder Passwort falsch.' });
  await createSession(res, rows[0].id);
  res.json({ user: publicUser(rows[0]) });
}

async function logout(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) await pool.query('DELETE FROM app_sessions WHERE token_hash = $1', [sha256(token)]);
  setSessionCookie(res, '', 0);
  res.json({ ok: true });
}

const publicUser = (u) => ({ username: u.username, displayName: u.display_name });

async function purgeExpired() {
  await pool.query('DELETE FROM app_sessions WHERE expires_at < now()');
}

module.exports = {
  loadUser, requireUser, rateLimit, register, login, logout, publicUser, purgeExpired,
  registrationCodeRequired: () => Boolean(REGISTRATION_CODE),
};
