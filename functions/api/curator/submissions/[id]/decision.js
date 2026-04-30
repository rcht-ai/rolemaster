// POST /api/curator/submissions/:id/decision — approve / request-changes / hold.
// Curator only.

import { json } from '../../../_helpers.js';

const MAP = { approve: 'approved', request: 'revision', hold: 'review' };

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);

  const id = context.params.id;
  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const { decision, comments } = body;
  const newStatus = MAP[decision];
  if (!newStatus) return json({ error: 'bad_decision' }, 400);

  const az = decision === 'approve' ? '批准' : decision === 'request' ? '请求修改' : '暂缓';
  const ae = decision === 'approve' ? 'Approved' : decision === 'request' ? 'Requested changes' : 'Held';

  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE submissions SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(newStatus, id),
    context.env.DB.prepare(
      `INSERT INTO audit_log (submission_id, who, action_zh, action_en) VALUES (?, ?, ?, ?)`
    ).bind(id, u.name, az + (comments ? `: ${comments}` : ''), ae + (comments ? `: ${comments}` : '')),
  ]);

  return json({ ok: true, status: newStatus });
}
