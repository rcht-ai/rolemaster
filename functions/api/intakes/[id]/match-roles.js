// POST /api/intakes/:id/match-roles — supplier-only.
// AI Surface B. Reads confirmed capabilities + materials, derives Roles.

import { json, shortId } from '../../_helpers.js';
import { callClaude } from '../../_lib/ai/client.js';
import { parseStrictJson } from '../../_lib/ai/parse.js';
import { logEvent } from '../../_lib/ai/logging.js';
import { buildIntakeMaterialsBlocks } from '../../_lib/ai/intake-files.js';
import {
  MATCH_ROLES_SYSTEM_PROMPT,
  MATCH_ROLES_OUTPUT_SCHEMA,
} from '../../_lib/ai/prompts/match-roles.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  const id = context.params.id;
  const { env } = context;

  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const intake = await env.DB.prepare('SELECT * FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);
  if (!env.ANTHROPIC_API_KEY) return json({ ok: false, reason: 'no_api_key' });

  const { results: capRows } = await env.DB.prepare(
    'SELECT id, rc_label, name_zh, name_en, description_zh, description_en FROM capabilities WHERE intake_id = ? ORDER BY position'
  ).bind(id).all();
  if (!capRows?.length) return json({ ok: false, reason: 'no_capabilities' });

  const capListForPrompt = capRows.map(c => ({
    rc_label: c.rc_label,
    name: { zh: c.name_zh, en: c.name_en },
    description: { zh: c.description_zh, en: c.description_en },
  }));

  const { blocks } = await buildIntakeMaterialsBlocks(env, id, intake);

  await env.DB.prepare(`UPDATE intakes SET status = 'matching_roles', updated_at = datetime('now') WHERE id = ?`).bind(id).run();

  const ai = await callClaude(env, {
    surface: 'match-roles',
    submissionId: id,
    system: MATCH_ROLES_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Capabilities:\n' + JSON.stringify(capListForPrompt, null, 2) + '\n\nMaterials follow:' },
        ...blocks,
      ],
    }],
    outputSchema: MATCH_ROLES_OUTPUT_SCHEMA,
    maxTokens: 3000,
    model: 'claude-haiku-4-5',
    timeoutMs: 70_000,
  });
  if (!ai.ok) return json({ ok: false, reason: ai.reason || 'error', error: ai.error });

  const parsed = parseStrictJson(ai.text);
  if (!parsed?.roles?.length) {
    await logEvent(env, 'error', 'match_roles_parse_failed', { surface: 'match-roles', submissionId: id, sample: (ai.text || '').slice(0, 300) });
    return json({ ok: false, reason: 'parse_failed' });
  }

  // Replace existing rolepacks for this intake (re-match wipes).
  await env.DB.prepare('DELETE FROM rolepacks_v2 WHERE intake_id = ?').bind(id).run();

  // Build a map: RC-label → capability.id (for the m-to-m link table)
  const capByLabel = Object.fromEntries(capRows.map(c => [c.rc_label, c.id]));

  for (let i = 0; i < parsed.roles.length; i++) {
    const r = parsed.roles[i];
    const rpId = shortId('RP-', 8);
    const label = r.rp_label || `RP-${String(i + 1).padStart(2, '0')}`;
    await env.DB.prepare(`
      INSERT INTO rolepacks_v2 (id, intake_id, rp_label, name_zh, name_en, industry_json, company_size_json, department_json, position, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).bind(
      rpId, id, label,
      r.name?.zh || '', r.name?.en || '',
      JSON.stringify(r.industry || []),
      JSON.stringify(r.company_size || []),
      JSON.stringify(r.department || { zh: '', en: '' }),
      i,
    ).run();
    // Link capabilities (skip unknown labels)
    const caps = (r.capability_ids || [])
      .map(rcLabel => capByLabel[rcLabel])
      .filter(Boolean);
    for (let j = 0; j < caps.length; j++) {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO rolepack_capabilities (rolepack_id, capability_id, position) VALUES (?, ?, ?)'
      ).bind(rpId, caps[j], j).run();
    }
  }

  await env.DB.prepare(
    `UPDATE intakes SET status = 'roles_ready', updated_at = datetime('now') WHERE id = ?`
  ).bind(id).run();

  return json({ ok: true, count: parsed.roles.length });
}
