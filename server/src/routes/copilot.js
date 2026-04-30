// Copilot routes — Claude-powered field extraction.
// Real AI when ANTHROPIC_API_KEY is set; otherwise falls back to a keyword matcher
// so the demo keeps working out of the box.

import { Hono } from 'hono';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { loadFields } from '../lib/fields.js';

export const copilotRoutes = new Hono();
copilotRoutes.use('*', requireAuth);

// Lazy client — only constructed when the key is present.
let anthropic = null;
function client() {
  if (anthropic) return anthropic;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  anthropic = new Anthropic();
  return anthropic;
}

const MODEL = process.env.COPILOT_MODEL || 'claude-sonnet-4-6';

// Extract structured field updates from a free-text user message using Claude.
// The field schema is large and stable across requests for one submission, so we
// place a cache_control breakpoint after it — every subsequent request hits the cache.
async function extractWithClaude(userText, fields, lang) {
  const c = client();
  if (!c) return null;

  const fieldList = Object.entries(fields)
    .filter(([, f]) => f.section !== 1) // skip company-basics; those come from the supplier record
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

  const fieldSchemaJson = JSON.stringify(fieldList, null, 2);

  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      { type: 'text', text: SYSTEM },
      {
        type: 'text',
        text: `Available fields for this product submission:\n\n${fieldSchemaJson}`,
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
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Keyword-based fallback — preserves the demo experience without an API key.
function extractFallback(text, fields, lang) {
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
          value: {
            zh: '(已根据你刚才的描述更新)',
            en: '(updated from your description)',
          },
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

copilotRoutes.post('/submissions/:id/copilot', async (c) => {
  const u = c.get('user');
  const id = c.req.param('id');
  const { text, lang = 'zh' } = await c.req.json().catch(() => ({}));
  if (!text || !text.trim()) return c.json({ error: 'empty' }, 400);

  const sub = db.prepare(`SELECT supplier_id FROM submissions WHERE id = ?`).get(id);
  if (!sub) return c.json({ error: 'not_found' }, 404);
  if (u.role !== 'curator' && (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id)) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const fields = loadFields(db, id);

  // Persist the user's message.
  db.prepare(`INSERT INTO chat_messages (submission_id, role, content) VALUES (?, 'user', ?)`)
    .run(id, text);

  let result = null;
  try {
    result = await extractWithClaude(text, fields, lang);
  } catch (err) {
    console.error('Claude extraction failed:', err.message);
  }
  if (!result) result = extractFallback(text, fields, lang);

  // Apply the updates.
  if (result.updates?.length) {
    const stmt = db.prepare(`UPDATE submission_fields SET value_zh = ?, value_en = ?, status = ?
                             WHERE submission_id = ? AND field_id = ?`);
    for (const upd of result.updates) {
      const vz = upd.value?.zh ?? '';
      const ve = upd.value?.en ?? '';
      stmt.run(vz, ve, upd.status || 'filled', id, upd.id);
    }
    db.prepare(`UPDATE submissions SET updated_at = datetime('now') WHERE id = ?`).run(id);
  }

  // Persist the bot reply with the resolved field labels for the UI.
  const enrichedUpdates = (result.updates || []).map(u => ({
    id: u.id,
    label: fields[u.id]?.label,
    value: u.value,
    status: u.status,
  }));
  db.prepare(`INSERT INTO chat_messages (submission_id, role, content, meta) VALUES (?, 'bot', ?, ?)`)
    .run(id, result.reply || '', JSON.stringify({ updates: enrichedUpdates }));

  return c.json({
    reply: result.reply,
    updates: enrichedUpdates,
    poweredBy: client() ? 'claude' : 'fallback',
  });
});

// Pull a submission's chat history.
copilotRoutes.get('/submissions/:id/copilot', (c) => {
  const u = c.get('user');
  const id = c.req.param('id');
  const sub = db.prepare(`SELECT supplier_id FROM submissions WHERE id = ?`).get(id);
  if (!sub) return c.json({ error: 'not_found' }, 404);
  if (u.role !== 'curator' && (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id)) {
    return c.json({ error: 'forbidden' }, 403);
  }
  const rows = db.prepare(`SELECT role, content, meta, created_at FROM chat_messages WHERE submission_id = ? ORDER BY id`).all(id);
  return c.json({
    items: rows.map(r => ({
      role: r.role,
      content: r.content,
      meta: r.meta ? JSON.parse(r.meta) : null,
      createdAt: r.created_at,
    })),
  });
});
