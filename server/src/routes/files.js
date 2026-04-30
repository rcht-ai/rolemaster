// File upload routes — accepts multipart, stores under server/uploads/<submissionId>/.

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const fileRoutes = new Hono();
fileRoutes.use('*', requireAuth);

// Detect a file's "kind" for the badge in the UI.
function kindFor(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  if (['pdf'].includes(ext)) return 'pdf';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return 'doc';
  if (['m4a', 'mp3', 'wav', 'ogg'].includes(ext)) return 'voice';
  return 'doc';
}

fileRoutes.post('/submissions/:id/files', async (c) => {
  const u = c.get('user');
  const id = c.req.param('id');
  const sub = db.prepare(`SELECT supplier_id, materials FROM submissions WHERE id = ?`).get(id);
  if (!sub) return c.json({ error: 'not_found' }, 404);
  if (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id) return c.json({ error: 'forbidden' }, 403);

  const body = await c.req.parseBody({ all: true });
  const incoming = [].concat(body['files'] || body['file'] || []).filter(Boolean);
  if (incoming.length === 0) return c.json({ error: 'no_files' }, 400);

  const subDir = path.join(UPLOAD_DIR, id);
  fs.mkdirSync(subDir, { recursive: true });

  const stored = [];
  for (const f of incoming) {
    if (!f || typeof f === 'string') continue;
    const fid = 'F-' + nanoid(8);
    // Sanitize filename — strip path separators.
    const safeName = path.basename(f.name || 'upload').replace(/[\\/]/g, '_');
    const storagePath = path.join(subDir, `${fid}_${safeName}`);
    const buf = Buffer.from(await f.arrayBuffer());
    fs.writeFileSync(storagePath, buf);

    db.prepare(`INSERT INTO files (id, submission_id, kind, filename, size_bytes, storage_path)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run(fid, id, kindFor(safeName), safeName, buf.length, storagePath);

    stored.push({ id: fid, filename: safeName, size: buf.length, kind: kindFor(safeName) });
  }

  // Update materials list (deduped by kind) — used by the queue badges.
  const existing = JSON.parse(sub.materials || '[]');
  const next = Array.from(new Set([...existing, ...stored.map(s => s.kind)]));
  db.prepare(`UPDATE submissions SET materials = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(next), id);

  return c.json({ files: stored });
});

fileRoutes.get('/submissions/:id/files', (c) => {
  const u = c.get('user');
  const id = c.req.param('id');
  const sub = db.prepare(`SELECT supplier_id FROM submissions WHERE id = ?`).get(id);
  if (!sub) return c.json({ error: 'not_found' }, 404);
  if (u.role !== 'curator' && (u.role !== 'supplier' || sub.supplier_id !== u.supplier_id)) {
    return c.json({ error: 'forbidden' }, 403);
  }
  const rows = db.prepare(`SELECT id, kind, filename, size_bytes, created_at FROM files WHERE submission_id = ? ORDER BY created_at`).all(id);
  return c.json({ files: rows.map(r => ({ id: r.id, kind: r.kind, filename: r.filename, size: r.size_bytes, createdAt: r.created_at })) });
});
