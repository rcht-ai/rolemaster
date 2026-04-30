// GET /api/auth/me — current user + supplier record (if applicable).
// Auth is enforced by _middleware.js; we just read context.data.user here.

import { json } from '../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  let supplier = null;
  if (u.supplier_id) {
    supplier = await context.env.DB.prepare(
      'SELECT id, name, short_name, hq, contact, phone, founded, team, clients FROM suppliers WHERE id = ?'
    ).bind(u.supplier_id).first();
  }
  return json({
    user: { id: u.id, email: u.email, name: u.name, role: u.role, supplier_id: u.supplier_id },
    supplier,
  });
}
