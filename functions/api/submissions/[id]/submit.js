// POST /api/submissions/:id/submit — flips status from 'draft' to 'new' for review.

import { json } from '../../_helpers.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  const id = context.params.id;

  const sub = await context.env.DB.prepare(
    'SELECT supplier_id FROM submissions WHERE id = ?'
  ).bind(id).first();
  if (!sub) return json({ error: 'not_found' }, 404);
  if (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  // Compute prefill % from current field statuses (% non-empty).
  const { results: stats } = await context.env.DB.prepare(
    'SELECT status, COUNT(*) AS n FROM submission_fields WHERE submission_id = ? GROUP BY status'
  ).bind(id).all();
  const total = (stats || []).reduce((s, r) => s + r.n, 0) || 1;
  const filled = (stats || []).filter(r => r.status === 'filled' || r.status === 'ai').reduce((s, r) => s + r.n, 0);
  const prefill = Math.round((filled / total) * 100);

  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE submissions SET status = 'new', prefill = ?, submitted_at = datetime('now'),
       updated_at = datetime('now') WHERE id = ?`
    ).bind(prefill, id),
    context.env.DB.prepare(
      `INSERT INTO audit_log (submission_id, who, action_zh, action_en)
       VALUES (?, ?, '确认并提交', 'Confirmed and submitted')`
    ).bind(id, u.name),
  ]);

  return json({ ok: true, prefill });
}
