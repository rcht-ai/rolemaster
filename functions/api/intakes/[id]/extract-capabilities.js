// POST /api/intakes/:id/extract-capabilities — supplier-only.
// AI Surface A. Reads intake materials, produces a list of capabilities (RC-NN),
// wipes any prior unconfirmed capabilities, inserts new ones.

import { json, shortId } from '../../_helpers.js';
import { callClaude } from '../../_lib/ai/client.js';
import { parseStrictJson } from '../../_lib/ai/parse.js';
import { logEvent } from '../../_lib/ai/logging.js';
import { buildIntakeMaterialsBlocks } from '../../_lib/ai/intake-files.js';
import {
  EXTRACT_CAPABILITIES_SYSTEM_PROMPT,
  EXTRACT_CAPABILITIES_OUTPUT_SCHEMA,
} from '../../_lib/ai/prompts/extract-capabilities.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  const id = context.params.id;
  const { env } = context;

  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const intake = await env.DB.prepare('SELECT * FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  if (!env.ANTHROPIC_API_KEY) return json({ ok: false, reason: 'no_api_key' });

  const { blocks, hasContent, fileCount } = await buildIntakeMaterialsBlocks(env, id, intake);
  if (!hasContent) return json({ ok: false, reason: 'no_materials' });

  await env.DB.prepare(`UPDATE intakes SET status = 'analyzing_capabilities', updated_at = datetime('now') WHERE id = ?`).bind(id).run();

  const ai = await callClaude(env, {
    surface: 'extract-capabilities',
    submissionId: id,
    system: EXTRACT_CAPABILITIES_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Identify the atomic capabilities present in these materials. Output strict JSON.' },
        ...blocks,
      ],
    }],
    outputSchema: EXTRACT_CAPABILITIES_OUTPUT_SCHEMA,
    maxTokens: 3000,
    model: 'claude-haiku-4-5',
    timeoutMs: 70_000,
  });
  if (!ai.ok) {
    await env.DB.prepare(`UPDATE intakes SET status = 'draft' WHERE id = ?`).bind(id).run();
    return json({ ok: false, reason: ai.reason || 'error', error: ai.error });
  }

  const parsed = parseStrictJson(ai.text);
  if (!parsed?.capabilities?.length) {
    await logEvent(env, 'error', 'extract_caps_parse_failed', { surface: 'extract-capabilities', submissionId: id, sample: (ai.text || '').slice(0, 300) });
    await env.DB.prepare(`UPDATE intakes SET status = 'draft' WHERE id = ?`).bind(id).run();
    return json({ ok: false, reason: 'parse_failed' });
  }

  // Wipe unconfirmed capabilities (preserve any supplier has already confirmed-edited).
  await env.DB.prepare('DELETE FROM capabilities WHERE intake_id = ? AND confirmed = 0').bind(id).run();

  const writes = [];
  parsed.capabilities.forEach((c, i) => {
    const capId = shortId('CAP-', 8);
    const label = c.rc_label || `RC-${String(i + 1).padStart(2, '0')}`;
    writes.push(env.DB.prepare(`
      INSERT INTO capabilities (id, intake_id, rc_label, name_zh, name_en, description_zh, description_en, source_quote, position, source, confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', 0)
    `).bind(
      capId, id, label,
      c.name?.zh || '', c.name?.en || '',
      c.description?.zh || '', c.description?.en || '',
      c.source_quote || '', i,
    ));
  });
  if (writes.length) await env.DB.batch(writes);

  await env.DB.prepare(
    `UPDATE intakes SET status = 'capabilities_ready', updated_at = datetime('now') WHERE id = ?`
  ).bind(id).run();

  return json({ ok: true, count: parsed.capabilities.length, file_count: fileCount });
}
