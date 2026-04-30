// Sales catalog: list RolePacks (public-ish but require auth), get one.

import { Hono } from 'hono';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

export const catalogRoutes = new Hono();
catalogRoutes.use('*', requireAuth);

catalogRoutes.get('/', (c) => {
  const rows = db.prepare(`SELECT id, supplier_name, data, published_at FROM rolepacks ORDER BY published_at DESC`).all();
  return c.json({
    items: rows.map(r => ({
      id: r.id,
      supplier: r.supplier_name,
      publishedAt: r.published_at,
      ...JSON.parse(r.data),
    })),
  });
});

catalogRoutes.get('/:id', (c) => {
  const row = db.prepare(`SELECT id, supplier_name, data, published_at FROM rolepacks WHERE id = ?`).get(c.req.param('id'));
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json({
    rolepack: {
      id: row.id,
      supplier: row.supplier_name,
      publishedAt: row.published_at,
      ...JSON.parse(row.data),
    }
  });
});
