// POST /api/auth/register
// Self-service supplier registration. Creates a supplier record + user, signs them in.

import { json, jsonWithCookie, signJWT, hashPassword, shortId } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const { email, password, name, company, hq, contact, phone } = body;

  if (!email || !email.includes('@')) return json({ error: 'invalid_email' }, 400);
  if (!password || password.length < 4) return json({ error: 'weak_password' }, 400);
  if (!company || !hq) return json({ error: 'missing_company' }, 400);

  const lcEmail = email.toLowerCase();
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(lcEmail).first();
  if (existing) return json({ error: 'email_taken' }, 409);

  const supplierId = shortId('SUP-', 8);
  const userId = shortId('U-', 10);
  const { hash, salt } = await hashPassword(password);
  const shortName = company.split(/\s+/)[0];

  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO suppliers (id, name, short_name, hq, contact, phone) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(supplierId, company, shortName, hq, contact ?? null, phone ?? null),
    env.DB.prepare(
      `INSERT INTO users (id, email, password, salt, name, role, supplier_id)
       VALUES (?, ?, ?, ?, ?, 'supplier', ?)`
    ).bind(userId, lcEmail, hash, salt, name || contact || lcEmail.split('@')[0], supplierId),
  ]);

  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const token = await signJWT(
    { sub: userId, email: lcEmail, name: name || contact, role: 'supplier', sup: supplierId, exp },
    env.JWT_SECRET,
  );

  return jsonWithCookie({
    ok: true,
    user: { id: userId, email: lcEmail, name, role: 'supplier', supplier_id: supplierId },
  }, token);
}
