// Auth: bcrypt password hashing, opaque session tokens stored in DB,
// 30-day expiry. Cookie is HttpOnly + SameSite=Lax.

import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db } from './db.js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

const SESSION_COOKIE = 'rm_session';
const SESSION_DAYS = 30;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function createSession(userId) {
  const token = nanoid(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
    .run(token, userId, expires);
  return { token, expires };
}

export function getUserFromToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.* FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token);
  return row || null;
}

export function destroySession(token) {
  if (!token) return;
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

// Hono helpers — Secure flag on in production so cookies aren't sent over HTTP.
const IS_PROD = process.env.NODE_ENV === 'production';

export function setSessionCookie(c, token) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: IS_PROD,
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export function clearSessionCookie(c) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export async function authMiddleware(c, next) {
  const token = getCookie(c, SESSION_COOKIE);
  const user = getUserFromToken(token);
  c.set('user', user);
  c.set('sessionToken', token);
  return next();
}

export function requireAuth(c, next) {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  return next();
}

export function requireRole(...roles) {
  return (c, next) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'unauthorized' }, 401);
    if (!roles.includes(user.role)) return c.json({ error: 'forbidden' }, 403);
    return next();
  };
}
