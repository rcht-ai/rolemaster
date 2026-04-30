// Auth routes: POST /api/auth/register, /login, /logout, GET /me

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import {
  hashPassword, verifyPassword, createSession, destroySession,
  setSessionCookie, clearSessionCookie, requireAuth,
} from '../auth.js';

export const authRoutes = new Hono();

authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email, password, name, company, hq, contact, phone } = body;

  if (!email || !email.includes('@')) return c.json({ error: 'invalid_email' }, 400);
  if (!password || password.length < 4) return c.json({ error: 'weak_password' }, 400);
  if (!company || !hq) return c.json({ error: 'missing_company' }, 400);

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return c.json({ error: 'email_taken' }, 409);

  const supplierId = 'SUP-' + nanoid(8).toUpperCase();
  const userId = nanoid(12);
  const hashed = await hashPassword(password);

  db.prepare(`INSERT INTO suppliers (id, name, short_name, hq, contact, phone) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(supplierId, company, company.split(/\s+/)[0], hq, contact ?? null, phone ?? null);

  db.prepare(`INSERT INTO users (id, email, password, name, role, supplier_id) VALUES (?, ?, ?, ?, 'supplier', ?)`)
    .run(userId, email, hashed, name || contact || email.split('@')[0], supplierId);

  const { token } = createSession(userId);
  setSessionCookie(c, token);
  return c.json({ ok: true, user: { id: userId, email, name, role: 'supplier', supplier_id: supplierId } });
});

authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}));
  if (!email || !password) return c.json({ error: 'missing_credentials' }, 400);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return c.json({ error: 'invalid_credentials' }, 401);

  const ok = await verifyPassword(password, user.password);
  if (!ok) return c.json({ error: 'invalid_credentials' }, 401);

  const { token } = createSession(user.id);
  setSessionCookie(c, token);
  return c.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, supplier_id: user.supplier_id },
  });
});

authRoutes.post('/logout', (c) => {
  const token = c.get('sessionToken');
  if (token) destroySession(token);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAuth, (c) => {
  const u = c.get('user');
  let supplier = null;
  if (u.supplier_id) {
    supplier = db.prepare('SELECT id, name, short_name, hq, contact, phone, founded, team, clients FROM suppliers WHERE id = ?').get(u.supplier_id);
  }
  return c.json({
    user: { id: u.id, email: u.email, name: u.name, role: u.role, supplier_id: u.supplier_id },
    supplier,
  });
});
