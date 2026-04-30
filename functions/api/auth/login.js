// POST /api/auth/login

import { json, jsonWithCookie, signJWT, verifyPassword } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const { email, password } = body;
  if (!email || !password) return json({ error: 'missing_credentials' }, 400);

  const user = await env.DB.prepare(
    'SELECT id, email, password, salt, name, role, supplier_id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();
  if (!user) return json({ error: 'invalid_credentials' }, 401);

  const ok = await verifyPassword(password, user.password, user.salt);
  if (!ok) return json({ error: 'invalid_credentials' }, 401);

  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const token = await signJWT(
    { sub: user.id, email: user.email, name: user.name, role: user.role, sup: user.supplier_id, exp },
    env.JWT_SECRET,
  );

  return jsonWithCookie({
    ok: true,
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role, supplier_id: user.supplier_id,
    },
  }, token);
}
