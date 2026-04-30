// GET /api/catalog — list all published RolePacks.

import { json } from '../_helpers.js';

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(
    'SELECT id, supplier_name, data, published_at FROM rolepacks ORDER BY published_at DESC'
  ).all();
  return json({
    items: (results || []).map(r => ({
      id: r.id,
      supplier: r.supplier_name,
      publishedAt: r.published_at,
      ...JSON.parse(r.data),
    })),
  });
}
