// PATCH/DELETE /api/intakes/:id/capabilities/:capId

import { json } from '../../../_helpers.js';

export async function onRequestPatch(context) {
  const u = context.data.user;
  const { id, capId } = context.params;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const intake = await context.env.DB.prepare('SELECT supplier_id FROM intakes WHERE id = ?').bind(id).first();
  if (!intake || intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const sets = [];
  const vals = [];
  if (body.name) {
    sets.push('name_zh = ?', 'name_en = ?');
    vals.push(body.name.zh || '', body.name.en || '');
  }
  if (body.description) {
    sets.push('description_zh = ?', 'description_en = ?');
    vals.push(body.description.zh || '', body.description.en || '');
  }
  if (typeof body.position === 'number') {
    sets.push('position = ?');
    vals.push(body.position);
  }
  if (sets.length === 0) return json({ ok: true, noop: true });

  await context.env.DB.prepare(
    `UPDATE capabilities SET ${sets.join(', ')} WHERE id = ? AND intake_id = ?`
  ).bind(...vals, capId, id).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const u = context.data.user;
  const { id, capId } = context.params;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const intake = await context.env.DB.prepare('SELECT supplier_id FROM intakes WHERE id = ?').bind(id).first();
  if (!intake || intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  await context.env.DB.prepare(
    'DELETE FROM capabilities WHERE id = ? AND intake_id = ?'
  ).bind(capId, id).run();
  return json({ ok: true });
}
