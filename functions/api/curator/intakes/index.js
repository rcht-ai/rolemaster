// GET /api/curator/intakes — list intakes by status
// Query params: ?status=submitted|published|all (default: submitted)

import { json } from '../../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const url = new URL(context.request.url);
  const status = url.searchParams.get('status') || 'submitted';

  let where = '';
  const args = [];
  if (status !== 'all') {
    where = ' WHERE i.status = ?';
    args.push(status);
  }

  const { results } = await context.env.DB.prepare(`
    SELECT i.id, i.status, i.website, i.industry_hint, i.created_at, i.updated_at, i.finalized_at,
           s.name AS supplier_name, s.short_name AS supplier_short_name,
           (SELECT COUNT(*) FROM rolepacks_v2 rp WHERE rp.intake_id = i.id) AS rolepack_count,
           (SELECT COUNT(*) FROM rolepacks_v2 rp WHERE rp.intake_id = i.id AND rp.generated_json IS NOT NULL) AS rolepack_ready
    FROM intakes i
    JOIN suppliers s ON s.id = i.supplier_id
    ${where}
    ORDER BY i.finalized_at DESC NULLS LAST, i.updated_at DESC
  `).bind(...args).all();
  return json({ items: results || [] });
}
