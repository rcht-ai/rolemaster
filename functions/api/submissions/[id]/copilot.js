// POST /api/submissions/:id/copilot — Claude-powered field extraction from a free-text user msg.
// GET  /api/submissions/:id/copilot — chat history.
//
// Real AI when env.ANTHROPIC_API_KEY is set; otherwise a keyword-matcher fallback
// keeps the demo working out of the box.

import Anthropic from '@anthropic-ai/sdk';
import { json, rowToField } from '../../_helpers.js';

const MODEL = 'claude-sonnet-4-6';

async function loadFields(db, submissionId) {
  const { results } = await db.prepare(
    'SELECT * FROM submission_fields WHERE submission_id = ? ORDER BY section, field_id'
  ).bind(submissionId).all();
  const out = {};
  for (const r of (results || [])) out[r.field_id] = rowToField(r);
  return out;
}

async function extractWithClaude(apiKey, userText, fields, lang) {
  const client = new Anthropic({ apiKey });

  const fieldList = Object.entries(fields)
    .filter(([, f]) => f.section !== 1)
    .map(([id, f]) => ({
      id,
      label: f.label,
      currentValue: typeof f.value === 'object' ? f.value : { zh: f.value, en: f.value },
      status: f.status,
      hint: f.hint,
      section: f.section,
    }));

  const SYSTEM = `You are RoleMaster Copilot, helping AI consulting firms describe their products to enterprise clients. Your job: read the user's message and extract values for any fields it covers.

Rules:
- Only emit updates for fields the user's message clearly addresses.
- Keep values concise (one or two sentences max per field).
- Provide BOTH zh (Simplified Chinese) and en (English) values for every update — translate the user's message into the other language naturally.
- Status: use "filled" for confident updates, "weak" if the user was vague.
- Do not invent facts. If a field isn't covered, omit it.
- Reply in the user's language (zh if they wrote Chinese, otherwise en).`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      { type: 'text', text: SYSTEM },
      {
        type: 'text',
        text: `Available fields for this product submission:\n\n${JSON.stringify(fieldList, null, 2)}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `User message (lang=${lang}):\n${userText}\n\nReturn a JSON object: {"reply": "short conversational acknowledgement in user's language", "updates": [{"id": "field_id", "value": {"zh": "...", "en": "..."}, "status": "filled"|"weak"}]}`,
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
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
                  status: { type: 'string', enum: ['filled', 'weak'] },
                },
                required: ['id', 'value', 'status'],
                additionalProperties: false,
              },
            },
          },
          required: ['reply', 'updates'],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find(b => b.type === 'text')?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function extractFallback(text, fields) {
  const isZh = /[一-龥]/.test(text);
  const lower = text.toLowerCase();
  const updates = [];
  const tryFill = (id, vz, ve, status = 'filled') => {
    if (!fields[id]) return;
    if (fields[id].status === 'filled' || fields[id].status === 'ai') return;
    updates.push({ id, value: { zh: vz, en: ve }, status });
  };

  if (lower.includes('demo') || lower.includes('演示') || text.length > 30) {
    tryFill('svc_demo',
      '线上 30 分钟产品演示;客户感兴趣后可安排 90 分钟深度 POC 走查',
      '30-min online product demo; deeper 90-min POC walkthrough on request');
  }
  if (lower.includes('response') || lower.includes('响应') || lower.includes('sla') || text.length > 30) {
    tryFill('svc_response',
      '工作日 4 小时内首次响应;P1 故障 1 小时内',
      'First response within 4 business hours; P1 incidents within 1 hour');
  }
  if (lower.includes('budget') || lower.includes('预算') || lower.includes('price') || lower.includes('价格')) {
    tryFill('buyer_budget',
      '中型机构年化 80-150 万 HKD,大行可至 300 万+',
      'HKD 800K-1.5M annually for mid-tier; HKD 3M+ for large banks');
  }
  if (updates.length === 0) {
    for (const [id, f] of Object.entries(fields)) {
      if (updates.length >= 2) break;
      if (f.section === 1) continue;
      if (f.status === 'empty' || f.status === 'weak') {
        updates.push({
          id,
          value: { zh: '(已根据你刚才的描述更新)', en: '(updated from your description)' },
          status: 'filled',
        });
      }
    }
  }

  const reply = isZh
    ? `好的,我从你这段话里整理出了 ${updates.length} 处更新:`
    : `Got it — I parsed ${updates.length} updates from that:`;
  return { reply, updates };
}

export async function onRequestPost(context) {
  const u = context.data.user;
  const id = context.params.id;
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const { text, lang = 'zh' } = body;
  if (!text || !text.trim()) return json({ error: 'empty' }, 400);

  const sub = await env.DB.prepare(
    'SELECT supplier_id FROM submissions WHERE id = ?'
  ).bind(id).first();
  if (!sub) return json({ error: 'not_found' }, 404);
  if (u.role !== 'curator' && (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id)) {
    return json({ error: 'forbidden' }, 403);
  }

  const fields = await loadFields(env.DB, id);

  // Persist user's message.
  await env.DB.prepare(
    `INSERT INTO chat_messages (submission_id, role, content) VALUES (?, 'user', ?)`
  ).bind(id, text).run();

  let result = null;
  if (env.ANTHROPIC_API_KEY) {
    try { result = await extractWithClaude(env.ANTHROPIC_API_KEY, text, fields, lang); }
    catch (err) { console.error('Claude failed:', err.message); }
  }
  if (!result) result = extractFallback(text, fields);

  // Apply updates.
  if (result.updates?.length) {
    const stmt = env.DB.prepare(
      `UPDATE submission_fields SET value_zh = ?, value_en = ?, status = ?
       WHERE submission_id = ? AND field_id = ?`
    );
    const batch = [];
    for (const upd of result.updates) {
      const vz = upd.value?.zh ?? '';
      const ve = upd.value?.en ?? '';
      batch.push(stmt.bind(vz, ve, upd.status || 'filled', id, upd.id));
    }
    batch.push(env.DB.prepare(`UPDATE submissions SET updated_at = datetime('now') WHERE id = ?`).bind(id));
    await env.DB.batch(batch);
  }

  const enriched = (result.updates || []).map(u => ({
    id: u.id,
    label: fields[u.id]?.label,
    value: u.value,
    status: u.status,
  }));
  await env.DB.prepare(
    `INSERT INTO chat_messages (submission_id, role, content, meta) VALUES (?, 'bot', ?, ?)`
  ).bind(id, result.reply || '', JSON.stringify({ updates: enriched })).run();

  return json({
    reply: result.reply,
    updates: enriched,
    poweredBy: env.ANTHROPIC_API_KEY ? 'claude' : 'fallback',
  });
}

export async function onRequestGet(context) {
  const u = context.data.user;
  const id = context.params.id;

  const sub = await context.env.DB.prepare(
    'SELECT supplier_id FROM submissions WHERE id = ?'
  ).bind(id).first();
  if (!sub) return json({ error: 'not_found' }, 404);
  if (u.role !== 'curator' && (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id)) {
    return json({ error: 'forbidden' }, 403);
  }

  const { results } = await context.env.DB.prepare(
    'SELECT role, content, meta, created_at FROM chat_messages WHERE submission_id = ? ORDER BY id'
  ).bind(id).all();

  return json({
    items: (results || []).map(r => ({
      role: r.role,
      content: r.content,
      meta: r.meta ? JSON.parse(r.meta) : null,
      createdAt: r.created_at,
    })),
  });
}
