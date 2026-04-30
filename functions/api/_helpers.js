// Shared helpers for RoleMaster Pages Functions.
// Web Crypto-based PBKDF2 + JWT (no Node deps).

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

export function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extraHeaders },
  });
}

// ── Session cookie (JWT) ──────────────────────────────────────────
export const TOKEN_COOKIE = 'rm_token';
export const TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function jsonWithCookie(obj, token, status = 200) {
  const headers = new Headers({ 'Content-Type': 'application/json', ...CORS });
  headers.append('Set-Cookie', [
    `${TOKEN_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${TOKEN_MAX_AGE}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; '));
  return new Response(JSON.stringify(obj), { status, headers });
}

export function jsonClearCookie(obj, status = 200) {
  const headers = new Headers({ 'Content-Type': 'application/json', ...CORS });
  headers.append('Set-Cookie', `${TOKEN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return new Response(JSON.stringify(obj), { status, headers });
}

export function readTokenCookie(request) {
  const c = request.headers.get('Cookie') || '';
  for (const part of c.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === TOKEN_COOKIE) return rest.join('=');
  }
  return null;
}

// ── JWT (HS256) ───────────────────────────────────────────────────
function base64UrlEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getSigningKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signJWT(payload, secret) {
  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getSigningKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

export async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Bad token');
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getSigningKey(secret);
  const sig = base64UrlDecode(sigB64);
  const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(signingInput));
  if (!valid) throw new Error('Bad signature');
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Expired');
  return payload;
}

// ── PBKDF2 password hashing ───────────────────────────────────────
function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBuf(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) out[i / 2] = parseInt(hex.substr(i, 2), 16);
  return out;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const buf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, km, 256);
  return { hash: bufToHex(buf), salt: bufToHex(salt) };
}

export async function verifyPassword(password, hash, salt) {
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const buf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBuf(salt), iterations: 100000, hash: 'SHA-256' }, km, 256);
  return bufToHex(buf) === hash;
}

// ── Tiny ID helpers ───────────────────────────────────────────────
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function shortId(prefix = '', n = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let id = prefix;
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}

// ── Bilingual field row ↔ object mapping ─────────────────────────
export function rowToField(row) {
  const value = (row.value_zh || row.value_en)
    ? { zh: row.value_zh ?? '', en: row.value_en ?? '' }
    : '';
  const out = {
    section: row.section,
    label: { zh: row.label_zh, en: row.label_en },
    status: row.status,
    value,
  };
  if (row.hint_zh || row.hint_en) out.hint = { zh: row.hint_zh, en: row.hint_en };
  if (row.optional) out.optional = true;
  return out;
}
