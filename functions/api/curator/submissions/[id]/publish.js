// POST /api/curator/submissions/:id/publish — produces a RolePack from the submission.
// Curator only.

import { json } from '../../../_helpers.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);

  const id = context.params.id;
  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  const sub = await context.env.DB.prepare(
    'SELECT * FROM submissions WHERE id = ?'
  ).bind(id).first();
  if (!sub) return json({ error: 'not_found' }, 404);

  const rolepackId = body.rolepackId || ('RP-' + sub.product_id.toUpperCase());

  const { results: fieldRows } = await context.env.DB.prepare(
    'SELECT * FROM submission_fields WHERE submission_id = ?'
  ).bind(id).all();
  const fields = fieldRows || [];
  const f = (fid) => fields.find(x => x.field_id === fid);
  const get = (fid) => {
    const r = f(fid); if (!r) return { zh: '', en: '' };
    return { zh: r.value_zh || '', en: r.value_en || '' };
  };

  const supplier = await context.env.DB.prepare(
    'SELECT name FROM suppliers WHERE id = ?'
  ).bind(sub.supplier_id).first();

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

  await context.env.DB.batch([
    context.env.DB.prepare(`
      INSERT INTO rolepacks (id, supplier_id, supplier_name, data, published_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, published_at = datetime('now')
    `).bind(rolepackId, sub.supplier_id, supplier?.name || '', JSON.stringify(data)),
    context.env.DB.prepare(
      `UPDATE submissions SET status = 'published', rolepack_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(rolepackId, id),
    context.env.DB.prepare(
      `INSERT INTO audit_log (submission_id, who, action_zh, action_en)
       VALUES (?, ?, '批准并发布', 'Approved and published')`
    ).bind(id, u.name),
  ]);

  return json({ ok: true, rolepackId });
}
