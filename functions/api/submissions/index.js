// GET  /api/submissions       — list (suppliers see their own; curators see all)
// POST /api/submissions       — create a new draft (supplier only)

import { json, shortId } from '../_helpers.js';
import { DEFAULT_FIELD_TEMPLATE } from '../_fields-template.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role === 'sales') return json({ error: 'forbidden' }, 403);

  const stmt = u.role === 'curator'
    ? context.env.DB.prepare(`
        SELECT s.*, sup.name AS supplier_name, sup.contact AS supplier_contact
        FROM submissions s JOIN suppliers sup ON sup.id = s.supplier_id
        ORDER BY s.created_at DESC
      `)
    : context.env.DB.prepare(`
        SELECT s.*, sup.name AS supplier_name, sup.contact AS supplier_contact
        FROM submissions s JOIN suppliers sup ON sup.id = s.supplier_id
        WHERE s.supplier_id = ?
        ORDER BY s.created_at DESC
      `).bind(u.supplier_id);

  const { results } = await stmt.all();
  return json({
    items: (results || []).map(r => ({
      id: r.id,
      supplier: r.supplier_name,
      contact: r.supplier_contact,
      product: r.product_name,
      productSub: { zh: r.product_subtitle_zh, en: r.product_subtitle_en },
      status: r.status,
      prefill: r.prefill,
      materials: JSON.parse(r.materials || '[]'),
      submittedAt: r.submitted_at,
      createdAt: r.created_at,
    })),
  });
}

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const productId = body.productId || shortId('P-', 6);
  const productName = body.productName || productId;
  const subZh = body.productSubtitle?.zh || '';
  const subEn = body.productSubtitle?.en || '';
  const materials = Array.isArray(body.materials) ? body.materials : [];

  const id = 'S-' + Date.now().toString().slice(-4) + shortId('', 2);

  // Pull supplier so we can pre-fill company-basics fields.
  const sup = await context.env.DB.prepare(
    'SELECT * FROM suppliers WHERE id = ?'
  ).bind(u.supplier_id).first();
  if (!sup) return json({ error: 'supplier_missing' }, 400);

  // Build the batch: insert submission, all fields, audit row.
  const stmts = [
    context.env.DB.prepare(`
      INSERT INTO submissions
        (id, supplier_id, product_id, product_name, product_subtitle_zh, product_subtitle_en, status, prefill, materials)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', 0, ?)
    `).bind(id, u.supplier_id, productId, productName, subZh, subEn, JSON.stringify(materials)),
  ];

  // Section 1 = company basics, filled from supplier record.
  const seedField = (fid, status, vz, ve) => {
    const f = DEFAULT_FIELD_TEMPLATE[fid];
    stmts.push(context.env.DB.prepare(`
      INSERT INTO submission_fields
        (submission_id, field_id, section, label_zh, label_en, value_zh, value_en, status, optional)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, fid, f.section, f.label.zh, f.label.en, vz, ve, status, f.optional ? 1 : 0));
  };
  seedField('company_name', 'filled', sup.name, sup.name);
  seedField('company_hq',   'filled', sup.hq, sup.hq);
  if (sup.founded) seedField('company_founded', 'filled', String(sup.founded), String(sup.founded));
  if (sup.team)    seedField('company_team',    'filled', sup.team, sup.team);
  if (sup.clients) seedField('company_clients', 'filled', String(sup.clients), String(sup.clients));

  // Other sections start empty.
  for (const [fid, f] of Object.entries(DEFAULT_FIELD_TEMPLATE)) {
    if (f.section === 1) continue;
    stmts.push(context.env.DB.prepare(`
      INSERT INTO submission_fields
        (submission_id, field_id, section, label_zh, label_en, value_zh, value_en, status, optional)
      VALUES (?, ?, ?, ?, ?, '', '', 'empty', ?)
    `).bind(id, fid, f.section, f.label.zh, f.label.en, f.optional ? 1 : 0));
  }

  stmts.push(context.env.DB.prepare(
    `INSERT INTO audit_log (submission_id, who, action_zh, action_en) VALUES (?, ?, '创建提交', 'Created submission')`
  ).bind(id, u.name));

  await context.env.DB.batch(stmts);
  return json({ id });
}
