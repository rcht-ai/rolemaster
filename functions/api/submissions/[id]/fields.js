// PATCH /api/submissions/:id/fields — bulk update used by the Copilot fill flow.
// Body: { updates: [{id, value:{zh,en}|string, status}] }

import { json } from '../../_helpers.js';

export async function onRequestPatch(context) {
  const u = context.data.user;
  const id = context.params.id;

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const updates = Array.isArray(body.updates) ? body.updates : [];

  const sub = await context.env.DB.prepare(
    'SELECT supplier_id FROM submissions WHERE id = ?'
  ).bind(id).first();
  if (!sub) return json({ error: 'not_found' }, 404);
  if (u.role !== 'curator' && (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id)) {
    return json({ error: 'forbidden' }, 403);
  }

  const stmt = context.env.DB.prepare(
    `UPDATE submission_fields SET value_zh = ?, value_en = ?, status = ?
     WHERE submission_id = ? AND field_id = ?`
  );
  const batch = [];
  for (const upd of updates) {
    let vz = '', ve = '';
    if (typeof upd.value === 'string') { vz = upd.value; ve = upd.value; }
    else if (upd.value && typeof upd.value === 'object') {
      vz = upd.value.zh ?? ''; ve = upd.value.en ?? '';
    }
    batch.push(stmt.bind(vz, ve, upd.status || 'filled', id, upd.id));
  }
  batch.push(context.env.DB.prepare(
    `UPDATE submissions SET updated_at = datetime('now') WHERE id = ?`
  ).bind(id));

  if (batch.length) await context.env.DB.batch(batch);
  return json({ ok: true, count: updates.length });
}
