// GET    /api/intakes/:id  — full state (intake + capabilities + rolepacks + files)
// PATCH  /api/intakes/:id  — update name, industry_hint, free_text, service_pricing_json, status
// DELETE /api/intakes/:id  — supplier removes a product. Only allowed before publication.

import { json } from '../../_helpers.js';

async function loadIntake(env, id, supplierId) {
  const row = await env.DB.prepare(
    'SELECT * FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!row) return { error: 'not_found', status: 404 };
  if (row.supplier_id !== supplierId) return { error: 'forbidden', status: 403 };
  return { intake: row };
}

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'supplier' && u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const r = await loadIntake(context.env, context.params.id, u.supplier_id);
  if (r.error && u.role !== 'curator') return json({ error: r.error }, r.status);

  const intake = r.intake || (await context.env.DB.prepare('SELECT * FROM intakes WHERE id = ?').bind(context.params.id).first());
  if (!intake) return json({ error: 'not_found' }, 404);

  const { results: caps } = await context.env.DB.prepare(
    'SELECT id, rc_label, name_zh, name_en, description_zh, description_en, source_quote, position, source, confirmed FROM capabilities WHERE intake_id = ? ORDER BY position'
  ).bind(intake.id).all();

  const { results: rps } = await context.env.DB.prepare(
    `SELECT id, rp_label, name_zh, name_en, industry_json, company_size_json, department_json,
            position, questionnaire_json, generated_json, materials_draft_json, status
     FROM rolepacks_v2 WHERE intake_id = ? ORDER BY position`
  ).bind(intake.id).all();
  const rolepacks = (rps || []).map(r => ({
    ...r,
    industry: safeParse(r.industry_json),
    company_size: safeParse(r.company_size_json),
    department: safeParse(r.department_json),
    questionnaire: safeParse(r.questionnaire_json),
    generated: safeParse(r.generated_json),
    materials_draft: safeParse(r.materials_draft_json),
  }));

  const { results: links } = await context.env.DB.prepare(
    'SELECT rolepack_id, capability_id, position FROM rolepack_capabilities WHERE rolepack_id IN (SELECT id FROM rolepacks_v2 WHERE intake_id = ?)'
  ).bind(intake.id).all();
  for (const rp of rolepacks) {
    rp.capability_ids = (links || []).filter(l => l.rolepack_id === rp.id).map(l => l.capability_id);
  }

  const { results: files } = await context.env.DB.prepare(
    'SELECT id, kind, filename, display_name, size_bytes, rolepack_id, created_at FROM intake_files WHERE intake_id = ? ORDER BY created_at'
  ).bind(intake.id).all();

  return json({
    intake: {
      id: intake.id,
      name: intake.name,
      status: intake.status,
      website: intake.website,
      industry_hint: intake.industry_hint,
      free_text: intake.free_text,
      service_pricing: safeParse(intake.service_pricing_json),
      created_at: intake.created_at,
      updated_at: intake.updated_at,
      finalized_at: intake.finalized_at,
    },
    capabilities: caps || [],
    rolepacks,
    files: files || [],
  });
}

export async function onRequestPatch(context) {
  const u = context.data.user;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const r = await loadIntake(context.env, context.params.id, u.supplier_id);
  if (r.error) return json({ error: r.error }, r.status);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  const sets = [];
  const vals = [];
  if (typeof body.name === 'string') { sets.push('name = ?'); vals.push(body.name); }
  if (typeof body.industry_hint === 'string') { sets.push('industry_hint = ?'); vals.push(body.industry_hint); }
  if (typeof body.free_text === 'string') { sets.push('free_text = ?'); vals.push(body.free_text); }
  if (body.service_pricing != null) { sets.push('service_pricing_json = ?'); vals.push(JSON.stringify(body.service_pricing)); }
  if (typeof body.status === 'string') { sets.push('status = ?'); vals.push(body.status); }
  if (sets.length === 0) return json({ ok: true, noop: true });
  sets.push("updated_at = datetime('now')");

  await context.env.DB.prepare(
    `UPDATE intakes SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...vals, context.params.id).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const u = context.data.user;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const id = context.params.id;
  const intake = await context.env.DB.prepare(
    'SELECT supplier_id, status FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  // Block deletion once a curator has published any rolepack from this intake.
  const published = await context.env.DB.prepare(
    `SELECT 1 FROM rolepacks_v2 WHERE intake_id = ? AND status = 'published' LIMIT 1`
  ).bind(id).first();
  if (published) return json({ ok: false, reason: 'published' }, 400);

  // Best-effort R2 cleanup for materials.
  const { results: files } = await context.env.DB.prepare(
    'SELECT storage_key FROM intake_files WHERE intake_id = ?'
  ).bind(id).all();
  for (const f of files || []) {
    try { await context.env.R2.delete(f.storage_key); } catch {}
  }

  // Cascading deletes via FKs handle capabilities, rolepacks_v2, intake_files,
  // rolepack_chat_messages, rolepack_capabilities. Just drop the intake row.
  await context.env.DB.prepare('DELETE FROM intakes WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
