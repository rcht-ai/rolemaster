// GET /api/catalog/:id — one RolePack.

import { json } from '../_helpers.js';

export async function onRequestGet(context) {
  const id = context.params.id;
  const row = await context.env.DB.prepare(
    'SELECT id, supplier_name, data, published_at FROM rolepacks WHERE id = ?'
  ).bind(id).first();
  if (!row) return json({ error: 'not_found' }, 404);
  return json({
    rolepack: {
      id: row.id,
      supplier: row.supplier_name,
      publishedAt: row.published_at,
      ...JSON.parse(row.data),
    },
  });
}
