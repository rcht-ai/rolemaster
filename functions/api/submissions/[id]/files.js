// GET  /api/submissions/:id/files — list uploaded files for a submission.
// POST /api/submissions/:id/files — multipart upload to R2; metadata to D1.

import { json, shortId } from '../../_helpers.js';

function kindFor(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  if (['pdf'].includes(ext)) return 'pdf';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return 'doc';
  if (['m4a', 'mp3', 'wav', 'ogg'].includes(ext)) return 'voice';
  return 'doc';
}

export async function onRequestPost(context) {
  const u = context.data.user;
  const id = context.params.id;
  const { request, env } = context;

  const sub = await env.DB.prepare(
    'SELECT supplier_id, materials FROM submissions WHERE id = ?'
  ).bind(id).first();
  if (!sub) return json({ error: 'not_found' }, 404);
  if (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  const form = await request.formData();
  const incoming = [].concat(form.getAll('files'), form.getAll('file')).filter(f => f && typeof f !== 'string');
  if (incoming.length === 0) return json({ error: 'no_files' }, 400);

  const stored = [];
  for (const f of incoming) {
    const fid = 'F-' + shortId('', 8);
    const safeName = (f.name || 'upload').replace(/[\\/]/g, '_');
    const key = `${id}/${fid}_${safeName}`;
    const bytes = await f.arrayBuffer();

    await env.R2.put(key, bytes, { httpMetadata: { contentType: f.type || 'application/octet-stream' } });

    await env.DB.prepare(`
      INSERT INTO files (id, submission_id, kind, filename, size_bytes, storage_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(fid, id, kindFor(safeName), safeName, bytes.byteLength, key).run();

    stored.push({ id: fid, filename: safeName, size: bytes.byteLength, kind: kindFor(safeName) });
  }

  // Update materials list (deduped by kind) — used by the queue badges.
  const existing = JSON.parse(sub.materials || '[]');
  const next = Array.from(new Set([...existing, ...stored.map(s => s.kind)]));
  await env.DB.prepare(
    `UPDATE submissions SET materials = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(JSON.stringify(next), id).run();

  return json({ files: stored });
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
    'SELECT id, kind, filename, size_bytes, created_at FROM files WHERE submission_id = ? ORDER BY created_at'
  ).bind(id).all();

  return json({
    files: (results || []).map(r => ({
      id: r.id, kind: r.kind, filename: r.filename, size: r.size_bytes, createdAt: r.created_at,
    })),
  });
}
