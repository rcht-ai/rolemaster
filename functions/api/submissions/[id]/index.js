// GET /api/submissions/:id — full submission + fields + audit log.

import { json, rowToField } from '../../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  const id = context.params.id;

  const row = await context.env.DB.prepare(`
    SELECT s.*, sup.name AS supplier_name, sup.contact AS supplier_contact
    FROM submissions s JOIN suppliers sup ON sup.id = s.supplier_id
    WHERE s.id = ?
  `).bind(id).first();
  if (!row) return json({ error: 'not_found' }, 404);
  if (u.role === 'supplier' && row.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);
  if (u.role === 'sales') return json({ error: 'forbidden' }, 403);

  const { results: fieldRows } = await context.env.DB.prepare(
    'SELECT * FROM submission_fields WHERE submission_id = ? ORDER BY section, field_id'
  ).bind(id).all();
  const fields = {};
  for (const f of (fieldRows || [])) fields[f.field_id] = rowToField(f);

  const { results: audit } = await context.env.DB.prepare(
    'SELECT who, action_zh, action_en, created_at FROM audit_log WHERE submission_id = ? ORDER BY created_at'
  ).bind(id).all();

  return json({
    submission: {
      id: row.id,
      supplierId: row.supplier_id,
      supplier: row.supplier_name,
      contact: row.supplier_contact,
      productId: row.product_id,
      productName: row.product_name,
      productSub: { zh: row.product_subtitle_zh, en: row.product_subtitle_en },
      status: row.status,
      prefill: row.prefill,
      materials: JSON.parse(row.materials || '[]'),
      rolepackId: row.rolepack_id,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    fields,
    audit: audit || [],
  });
}
