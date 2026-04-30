// Curator-only: workbench decision/checks/comments + publish.

import { Hono } from 'hono';
import { db } from '../db.js';
import { requireRole } from '../auth.js';

export const curatorRoutes = new Hono();
curatorRoutes.use('*', requireRole('curator'));

// Approve & publish a submission → create a RolePack from its data.
curatorRoutes.post('/submissions/:id/publish', async (c) => {
  const u = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const sub = db.prepare(`SELECT * FROM submissions WHERE id = ?`).get(id);
  if (!sub) return c.json({ error: 'not_found' }, 404);

  // Generate a deterministic RolePack id from the product code.
  const rolepackId = body.rolepackId || ('RP-' + sub.product_id.toUpperCase());

  // Pull fields → bilingual content for the RolePack.
  const fields = db.prepare(`SELECT * FROM submission_fields WHERE submission_id = ?`).all(id);
  const f = (fid) => fields.find(x => x.field_id === fid);
  const get = (fid, k = 'value') => {
    const r = f(fid); if (!r) return { zh: '', en: '' };
    return { zh: r[k + '_zh'] || '', en: r[k + '_en'] || '' };
  };

  const supplier = db.prepare(`SELECT name FROM suppliers WHERE id = ?`).get(sub.supplier_id);

  const data = body.data || {
    name: { zh: sub.product_name, en: sub.product_name },
    pitch: get('pain_main'),
    industries: ['banking'],
    industryLabels: { zh: ['银行'], en: ['Banking'] },
    persona: get('user_role'),
    decisionMaker: get('buyer_role'),
    orgSize: get('user_orgsize'),
    region: get('deploy_regions'),
    languages: get('deploy_lang'),
    compliance: f('deploy_reg')?.value_en || '—',
    fromPrice: f('price_retail')?.value_en || '—',
    overview: get('do_capabilities'),
    pain: get('pain_main'),
    outcomes: { zh: [(f('pain_outcome')?.value_zh || '')], en: [(f('pain_outcome')?.value_en || '')] },
    proof: { zh: '', en: '' },
    capabilities: { zh: [(f('do_capabilities')?.value_zh || '')], en: [(f('do_capabilities')?.value_en || '')] },
    prereqs: { zh: [], en: [] },
    deployment: get('deploy_mode'),
    pricing: {
      zh: { model: f('price_model')?.value_zh || '', from: f('price_retail')?.value_zh || '', custom: f('price_custom')?.value_zh || '' },
      en: { model: f('price_model')?.value_en || '', from: f('price_retail')?.value_en || '', custom: f('price_custom')?.value_en || '' },
    },
    deck: { slides: 7, sizeMB: 2.4 },
    manual: { pages: 4, sizeMB: 1.1 },
    pitchScript: get('pain_main'),
    discovery: { zh: [], en: [] },
  };

  // Upsert the RolePack and mark submission published.
  db.prepare(`INSERT INTO rolepacks (id, supplier_id, supplier_name, data, published_at)
              VALUES (?, ?, ?, ?, datetime('now'))
              ON CONFLICT(id) DO UPDATE SET data = excluded.data, published_at = datetime('now')`)
    .run(rolepackId, sub.supplier_id, supplier?.name || '', JSON.stringify(data));

  db.prepare(`UPDATE submissions SET status = 'published', rolepack_id = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(rolepackId, id);

  db.prepare(`INSERT INTO audit_log (submission_id, who, action_zh, action_en) VALUES (?, ?, '批准并发布', 'Approved and published')`)
    .run(id, u.name);

  return c.json({ ok: true, rolepackId });
});

// Curator-only state changes: approve/request-changes/hold (without full publish).
curatorRoutes.post('/submissions/:id/decision', async (c) => {
  const u = c.get('user');
  const id = c.req.param('id');
  const { decision, comments } = await c.req.json().catch(() => ({}));
  const map = {
    approve: 'approved', request: 'revision', hold: 'review',
  };
  const newStatus = map[decision];
  if (!newStatus) return c.json({ error: 'bad_decision' }, 400);

  db.prepare(`UPDATE submissions SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newStatus, id);
  const az = decision === 'approve' ? '批准' : decision === 'request' ? '请求修改' : '暂缓';
  const ae = decision === 'approve' ? 'Approved' : decision === 'request' ? 'Requested changes' : 'Held';
  db.prepare(`INSERT INTO audit_log (submission_id, who, action_zh, action_en) VALUES (?, ?, ?, ?)`)
    .run(id, u.name, az + (comments ? `: ${comments}` : ''), ae + (comments ? `: ${comments}` : ''));

  return c.json({ ok: true, status: newStatus });
});
