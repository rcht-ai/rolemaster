// Submission lifecycle: list mine, get one, create, patch field, submit, delete.

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { DEFAULT_FIELD_TEMPLATE, loadFields } from '../lib/fields.js';

export const submissionRoutes = new Hono();

submissionRoutes.use('*', requireAuth);

// List submissions visible to the current user.
// Suppliers see their own; curators see all; sales never list submissions.
submissionRoutes.get('/', (c) => {
  const u = c.get('user');
  if (u.role === 'sales') return c.json({ error: 'forbidden' }, 403);
  const rows = u.role === 'curator'
    ? db.prepare(`
        SELECT s.*, sup.name AS supplier_name, sup.contact AS supplier_contact
        FROM submissions s JOIN suppliers sup ON sup.id = s.supplier_id
        ORDER BY s.created_at DESC
      `).all()
    : db.prepare(`
        SELECT s.*, sup.name AS supplier_name, sup.contact AS supplier_contact
        FROM submissions s JOIN suppliers sup ON sup.id = s.supplier_id
        WHERE s.supplier_id = ?
        ORDER BY s.created_at DESC
      `).all(u.supplier_id);
  return c.json({
    items: rows.map(r => ({
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
    }))
  });
});

submissionRoutes.get('/:id', (c) => {
  const u = c.get('user');
  const id = c.req.param('id');
  const row = db.prepare(`
    SELECT s.*, sup.name AS supplier_name, sup.contact AS supplier_contact
    FROM submissions s JOIN suppliers sup ON sup.id = s.supplier_id
    WHERE s.id = ?
  `).get(id);
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (u.role === 'supplier' && row.supplier_id !== u.supplier_id) return c.json({ error: 'forbidden' }, 403);
  if (u.role === 'sales') return c.json({ error: 'forbidden' }, 403);

  return c.json({
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
    fields: loadFields(db, id),
    audit: db.prepare(`SELECT who, action_zh, action_en, created_at FROM audit_log WHERE submission_id = ? ORDER BY created_at`).all(id),
  });
});

// Create a new draft submission for a supplier — used in the S2 → S3 → S4 flow.
submissionRoutes.post('/', async (c) => {
  const u = c.get('user');
  if (u.role !== 'supplier') return c.json({ error: 'forbidden' }, 403);

  const body = await c.req.json().catch(() => ({}));
  const productId = body.productId || ('P-' + nanoid(6).toUpperCase());
  const productName = body.productName || productId;
  const subtitleZh = body.productSubtitle?.zh || '';
  const subtitleEn = body.productSubtitle?.en || '';
  const materials = Array.isArray(body.materials) ? body.materials : [];

  const id = 'S-' + Date.now().toString().slice(-4) + nanoid(2).toUpperCase();
  db.prepare(`INSERT INTO submissions (id, supplier_id, product_id, product_name, product_subtitle_zh, product_subtitle_en, status, prefill, materials)
              VALUES (?, ?, ?, ?, ?, ?, 'draft', 0, ?)`)
    .run(id, u.supplier_id, productId, productName, subtitleZh, subtitleEn, JSON.stringify(materials));

  // Pre-populate company-basics fields from the supplier record.
  const sup = db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(u.supplier_id);
  const seedFields = (fid, status, vz, ve) => {
    const f = DEFAULT_FIELD_TEMPLATE[fid];
    db.prepare(`INSERT INTO submission_fields (submission_id, field_id, section, label_zh, label_en, value_zh, value_en, status, optional)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, fid, f.section, f.label.zh, f.label.en, vz, ve, status, f.optional ? 1 : 0);
  };
  seedFields('company_name', 'filled', sup.name, sup.name);
  seedFields('company_hq', 'filled', sup.hq, sup.hq);
  if (sup.founded) seedFields('company_founded', 'filled', String(sup.founded), String(sup.founded));
  if (sup.team)    seedFields('company_team',    'filled', sup.team, sup.team);
  if (sup.clients) seedFields('company_clients', 'filled', String(sup.clients), String(sup.clients));

  // Other fields start empty.
  for (const [fid, f] of Object.entries(DEFAULT_FIELD_TEMPLATE)) {
    if (f.section === 1) continue;
    db.prepare(`INSERT INTO submission_fields (submission_id, field_id, section, label_zh, label_en, value_zh, value_en, status, optional)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'empty', ?)`)
      .run(id, fid, f.section, f.label.zh, f.label.en, '', '', f.optional ? 1 : 0);
  }

  db.prepare(`INSERT INTO audit_log (submission_id, who, action_zh, action_en) VALUES (?, ?, '创建提交', 'Created submission')`)
    .run(id, u.name);

  return c.json({ id });
});

// Update a single field's value/status.
submissionRoutes.patch('/:id/fields/:fid', async (c) => {
  const u = c.get('user');
  const id = c.req.param('id');
  const fid = c.req.param('fid');
  const body = await c.req.json().catch(() => ({}));

  const sub = db.prepare(`SELECT supplier_id, status FROM submissions WHERE id = ?`).get(id);
  if (!sub) return c.json({ error: 'not_found' }, 404);
  if (u.role !== 'curator' && (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id)) {
    return c.json({ error: 'forbidden' }, 403);
  }

  // Frontend may send value as a plain string (single-locale) or {zh,en}.
  let vz = '', ve = '';
  if (typeof body.value === 'string') { vz = body.value; ve = body.value; }
  else if (body.value && typeof body.value === 'object') {
    vz = body.value.zh ?? ''; ve = body.value.en ?? '';
  }
  const status = body.status || (vz || ve ? 'filled' : 'empty');

  db.prepare(`UPDATE submission_fields SET value_zh = ?, value_en = ?, status = ?
              WHERE submission_id = ? AND field_id = ?`)
    .run(vz, ve, status, id, fid);

  db.prepare(`UPDATE submissions SET updated_at = datetime('now') WHERE id = ?`).run(id);
  return c.json({ ok: true });
});

// Bulk update — used by the Copilot fill flow. Body: { updates: [{id, value:{zh,en}, status}] }
submissionRoutes.patch('/:id/fields', async (c) => {
  const u = c.get('user');
  const id = c.req.param('id');
  const { updates } = await c.req.json().catch(() => ({ updates: [] }));

  const sub = db.prepare(`SELECT supplier_id FROM submissions WHERE id = ?`).get(id);
  if (!sub) return c.json({ error: 'not_found' }, 404);
  if (u.role !== 'curator' && (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id)) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const stmt = db.prepare(`UPDATE submission_fields SET value_zh = ?, value_en = ?, status = ?
                           WHERE submission_id = ? AND field_id = ?`);
  for (const upd of (updates || [])) {
    let vz = '', ve = '';
    if (typeof upd.value === 'string') { vz = upd.value; ve = upd.value; }
    else if (upd.value && typeof upd.value === 'object') {
      vz = upd.value.zh ?? ''; ve = upd.value.en ?? '';
    }
    stmt.run(vz, ve, upd.status || 'filled', id, upd.id);
  }
  db.prepare(`UPDATE submissions SET updated_at = datetime('now') WHERE id = ?`).run(id);
  return c.json({ ok: true, count: updates?.length ?? 0 });
});

// Submit a draft → becomes 'new' for curator review.
submissionRoutes.post('/:id/submit', (c) => {
  const u = c.get('user');
  const id = c.req.param('id');
  const sub = db.prepare(`SELECT supplier_id, status FROM submissions WHERE id = ?`).get(id);
  if (!sub) return c.json({ error: 'not_found' }, 404);
  if (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id) return c.json({ error: 'forbidden' }, 403);

  // Compute prefill % from current field statuses (% non-empty).
  const stats = db.prepare(`SELECT status, COUNT(*) AS n FROM submission_fields WHERE submission_id = ? GROUP BY status`).all(id);
  const total = stats.reduce((s, r) => s + r.n, 0) || 1;
  const filled = stats.filter(r => r.status === 'filled' || r.status === 'ai').reduce((s, r) => s + r.n, 0);
  const prefill = Math.round((filled / total) * 100);

  db.prepare(`UPDATE submissions SET status = 'new', prefill = ?, submitted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .run(prefill, id);
  db.prepare(`INSERT INTO audit_log (submission_id, who, action_zh, action_en) VALUES (?, ?, '确认并提交', 'Confirmed and submitted')`)
    .run(id, u.name);
  return c.json({ ok: true, prefill });
});
