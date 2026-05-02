// Build Claude content blocks from an INTAKE's files (replaces _lib/ai/files.js
// which works against the legacy 'files' table).

const MAX_FILES_PER_INTAKE = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

export async function buildIntakeMaterialsBlocks(env, intakeId, intake) {
  const blocks = [];
  if (intake?.free_text && intake.free_text.trim()) {
    blocks.push({
      type: 'text',
      text: 'Supplier-provided description:\n\n' + intake.free_text.trim(),
    });
  }
  if (intake?.industry_hint && intake.industry_hint.trim()) {
    blocks.push({
      type: 'text',
      text: 'Supplier-stated industry: ' + intake.industry_hint.trim(),
    });
  }
  if (intake?.website && intake.website.trim()) {
    blocks.push({
      type: 'text',
      text: 'Company website: ' + intake.website.trim(),
    });
  }

  const { results: rows } = await env.DB.prepare(
    `SELECT id, kind, filename, size_bytes, storage_key, rolepack_id
     FROM intake_files WHERE intake_id = ? AND rolepack_id IS NULL ORDER BY created_at`
  ).bind(intakeId).all();
  const files = (rows || []).slice(0, MAX_FILES_PER_INTAKE);

  for (const f of files.filter(f => f.kind === 'pdf')) {
    if (f.size_bytes > MAX_FILE_BYTES) {
      blocks.push({ type: 'text', text: `[Skipped large PDF: ${f.filename}]` });
      continue;
    }
    const obj = await env.R2.get(f.storage_key);
    if (!obj) continue;
    const buf = await obj.arrayBuffer();
    blocks.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: arrayBufferToBase64(buf) },
      title: f.filename,
    });
  }
  for (const f of files.filter(f => f.kind === 'doc' || f.kind === 'ppt')) {
    blocks.push({
      type: 'text',
      text: `[${f.kind.toUpperCase()} attachment: ${f.filename} — text extraction not implemented in v1]`,
    });
  }
  for (const f of files.filter(f => f.kind === 'voice')) {
    blocks.push({
      type: 'text',
      text: `[Voice note: ${f.filename}, ${(f.size_bytes / 1024).toFixed(0)}KB]`,
    });
  }

  if (blocks.length > 0) blocks[blocks.length - 1].cache_control = { type: 'ephemeral' };
  return { blocks, hasContent: blocks.length > 0, fileCount: files.length };
}
