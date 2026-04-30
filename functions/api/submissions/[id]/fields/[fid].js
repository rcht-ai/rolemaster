// PATCH /api/submissions/:id/fields/:fid — single field update (debounced edits).

import { json } from '../../../_helpers.js';

export async function onRequestPatch(context) {
  const u = context.data.user;
  const { id, fid } = context.params;

  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  const sub = await context.env.DB.prepare(
    'SELECT supplier_id FROM submissions WHERE id = ?'
  ).bind(id).first();
  if (!sub) return json({ error: 'not_found' }, 404);
  if (u.role !== 'curator' && (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id)) {
    return json({ error: 'forbidden' }, 403);
  }

  let vz = '', ve = '';
  if (typeof body.value === 'string') { vz = body.value; ve = body.value; }
  else if (body.value && typeof body.value === 'object') {
    vz = body.value.zh ?? ''; ve = body.value.en ?? '';
  }
  const status = body.status || (vz || ve ? 'filled' : 'empty');

  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE submission_fields SET value_zh = ?, value_en = ?, status = ?
       WHERE submission_id = ? AND field_id = ?`
    ).bind(vz, ve, status, id, fid),
    context.env.DB.prepare(`UPDATE submissions SET updated_at = datetime('now') WHERE id = ?`).bind(id),
  ]);

  return json({ ok: true });
}
