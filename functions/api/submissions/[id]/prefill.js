// POST /api/submissions/:id/prefill — read uploaded files from R2, send to Claude,
// extract structured field values, apply them to the submission.
//
// Falls back to a no-op (returns 200 with reason) when ANTHROPIC_API_KEY isn't set
// or no readable files are present.
//
// Currently sends PDF files as native Claude document blocks. Other file types
// (DOCX, PPTX) are listed but not parsed; a future job can add text extraction.

import Anthropic from '@anthropic-ai/sdk';
import { json, rowToField } from '../../_helpers.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  // chunked to avoid stack overflow on large buffers
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

export async function onRequestPost(context) {
  const u = context.data.user;
  const id = context.params.id;
  const { env } = context;

  const sub = await env.DB.prepare(
    'SELECT supplier_id FROM submissions WHERE id = ?'
  ).bind(id).first();
  if (!sub) return json({ error: 'not_found' }, 404);
  if (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  if (!env.ANTHROPIC_API_KEY) {
    return json({ ok: false, reason: 'no_api_key', updated: 0 });
  }

  const { results: fileRows } = await env.DB.prepare(
    'SELECT id, kind, filename, size_bytes, storage_key FROM files WHERE submission_id = ? ORDER BY created_at'
  ).bind(id).all();
  const files = (fileRows || []).filter(f => f.kind === 'pdf').slice(0, MAX_FILES);
  if (files.length === 0) {
    return json({ ok: false, reason: 'no_pdf_files', updated: 0 });
  }

  // Pull each PDF from R2 and base64 it.
  const docs = [];
  for (const f of files) {
    if (f.size_bytes > MAX_FILE_BYTES) continue;
    const obj = await env.R2.get(f.storage_key);
    if (!obj) continue;
    const buf = await obj.arrayBuffer();
    docs.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: arrayBufferToBase64(buf) },
      title: f.filename,
    });
  }
  if (docs.length === 0) {
    return json({ ok: false, reason: 'files_too_large_or_missing', updated: 0 });
  }

  // Pull the empty (and weak) fields so we know which to ask Claude to fill.
  const { results: fieldRows } = await env.DB.prepare(
    'SELECT * FROM submission_fields WHERE submission_id = ? AND section != 1 ORDER BY section, field_id'
  ).bind(id).all();
  const candidates = (fieldRows || []).map(r => ({
    id: r.field_id,
    label: { zh: r.label_zh, en: r.label_en },
    section: r.section,
    currentStatus: r.status,
  }));

  const SYSTEM = `You are a product analyst at RoleMaster. You receive product materials uploaded by an AI consulting firm and extract structured field values that describe the product to enterprise buyers.

Your job: read every attached PDF and produce values for as many of the listed fields as the documents support.

Rules:
- Only emit updates for fields the documents support. Do not invent.
- Keep each value concise (one or two sentences max).
- Provide BOTH zh (Simplified Chinese) and en (English) values for every update — translate the document content into the other language naturally.
- Status: "ai" if you extracted it from the documents (typical case); "weak" if the documents only hint at it.
- Skip section-1 fields (company basics) — those are auto-populated from the supplier record.`;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: [
      { type: 'text', text: SYSTEM },
      {
        type: 'text',
        text: `Available fields (extract values for as many as the documents support):\n\n${JSON.stringify(candidates, null, 2)}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          ...docs,
          {
            type: 'text',
            text: `Read the attached document(s) and extract structured product info. Return JSON: {"summary": "1-sentence description of what the product is", "updates": [{"id": "field_id", "value": {"zh": "...", "en": "..."}, "status": "ai"|"weak"}]}`,
          },
        ],
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            updates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  value: {
                    type: 'object',
                    properties: { zh: { type: 'string' }, en: { type: 'string' } },
                    required: ['zh', 'en'],
                    additionalProperties: false,
                  },
                  status: { type: 'string', enum: ['ai', 'weak'] },
                },
                required: ['id', 'value', 'status'],
                additionalProperties: false,
              },
            },
          },
          required: ['summary', 'updates'],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find(b => b.type === 'text')?.text;
  let parsed = null;
  try { parsed = JSON.parse(text || '{}'); } catch { parsed = null; }
  if (!parsed || !Array.isArray(parsed.updates)) {
    return json({ ok: false, reason: 'parse_failed', updated: 0 });
  }

  // Apply updates.
  const stmt = env.DB.prepare(
    `UPDATE submission_fields SET value_zh = ?, value_en = ?, status = ?
     WHERE submission_id = ? AND field_id = ?`
  );
  const batch = [];
  for (const upd of parsed.updates) {
    const vz = upd.value?.zh ?? '';
    const ve = upd.value?.en ?? '';
    if (!vz && !ve) continue;
    batch.push(stmt.bind(vz, ve, upd.status || 'ai', id, upd.id));
  }

  // Recompute prefill % from the new state.
  if (batch.length) {
    await env.DB.batch(batch);
  }
  const { results: stats } = await env.DB.prepare(
    'SELECT status, COUNT(*) AS n FROM submission_fields WHERE submission_id = ? GROUP BY status'
  ).bind(id).all();
  const total = (stats || []).reduce((s, r) => s + r.n, 0) || 1;
  const filled = (stats || []).filter(r => r.status === 'filled' || r.status === 'ai')
    .reduce((s, r) => s + r.n, 0);
  const prefill = Math.round((filled / total) * 100);

  await env.DB.batch([
    env.DB.prepare(`UPDATE submissions SET prefill = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(prefill, id),
    env.DB.prepare(
      `INSERT INTO audit_log (submission_id, who, action_zh, action_en)
       VALUES (?, 'AI', ?, ?)`
    ).bind(id, `完成材料解析,预填 ${prefill}%`, `Parsed materials, prefilled ${prefill}% of fields`),
  ]);

  return json({
    ok: true,
    summary: parsed.summary,
    updated: parsed.updates.length,
    prefill,
  });
}
