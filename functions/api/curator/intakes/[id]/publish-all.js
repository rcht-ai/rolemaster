// POST /api/curator/intakes/:id/publish-all — publish every ready rolepack
// in one go. One in-app notification per role (so each is clickable), but a
// single consolidated email to the supplier so the inbox stays clean.

import { json, notify } from '../../../_helpers.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const id = context.params.id;
  const { env } = context;

  const intake = await env.DB.prepare(
    'SELECT id, supplier_id, name FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);

  const supplierUser = await env.DB.prepare(
    'SELECT id, email FROM users WHERE supplier_id = ? LIMIT 1'
  ).bind(intake.supplier_id).first();

  const { results: rolepacks } = await env.DB.prepare(`
    SELECT id, status, generated_json, rp_label, name_zh, name_en
    FROM rolepacks_v2
    WHERE intake_id = ?
    ORDER BY position
  `).bind(id).all();

  const ready = (rolepacks || []).filter(r => r.generated_json && r.status !== 'published');
  const skipped = (rolepacks || []).filter(r => !r.generated_json || r.status === 'published')
    .map(r => ({
      id: r.id, rp_label: r.rp_label,
      reason: r.status === 'published' ? 'already_published' : 'not_generated',
    }));

  if (ready.length === 0) {
    return json({ ok: false, reason: 'no_ready_rolepacks', skipped });
  }

  // Flip all ready rolepacks to published in one batch.
  const stmts = ready.map(r => env.DB.prepare(
    `UPDATE rolepacks_v2 SET status = 'published', updated_at = datetime('now') WHERE id = ?`
  ).bind(r.id));
  await env.DB.batch(stmts);

  // One in-app notification per published role (so each is independently clickable).
  if (supplierUser?.id) {
    for (const r of ready) {
      await notify(env, supplierUser.id, 'rolepack_published', {
        rolepack_id: r.id,
        rp_label: r.rp_label,
        role_name_zh: r.name_zh,
        role_name_en: r.name_en,
        intake_id: id,
        product_name: intake.name,
      });
    }
  }

  // One consolidated email summarizing all newly-published roles.
  if (supplierUser?.email && ready.length > 0) {
    sendBulkPublishedEmail(supplierUser.email, intake, ready).catch(() => {});
  }

  return json({
    ok: true,
    published: ready.map(r => ({ id: r.id, rp_label: r.rp_label, name_zh: r.name_zh, name_en: r.name_en })),
    skipped,
  });
}

async function sendBulkPublishedEmail(to, intake, ready) {
  const productLabel = intake.name || intake.id;
  const roleListHtml = ready.map(r => {
    const label = r.name_zh || r.name_en || r.rp_label;
    return `<li><strong>${escapeHtml(label)}</strong> <span style="color:#9CA3AF;font-size:11px;">(${r.rp_label})</span></li>`;
  }).join('');
  const subject = `RoleMaster: ${ready.length} 个岗位已发布 / ${ready.length} role${ready.length === 1 ? '' : 's'} published`;
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1F2937;">
      <p>恭喜!您在 RoleMaster 提交的产品 <strong>${escapeHtml(productLabel)}</strong> 已通过审阅,以下 ${ready.length} 个岗位已全部发布到销售库:</p>
      <ul style="padding-left:20px;">${roleListHtml}</ul>
      <p>销售团队现在可以浏览并使用这些岗位包。如需修改任何内容,请联系策展人 <a href="mailto:hello@rolemaster.io">hello@rolemaster.io</a>。</p>
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0;" />
      <p>Congratulations — your product <strong>${escapeHtml(productLabel)}</strong> has passed review. The following ${ready.length} role${ready.length === 1 ? '' : 's'} ${ready.length === 1 ? 'has' : 'have'} been published to the sales library:</p>
      <ul style="padding-left:20px;">${roleListHtml}</ul>
      <p>Sales reps can now browse and use these role packs. To request edits, email <a href="mailto:hello@rolemaster.io">hello@rolemaster.io</a>.</p>
    </div>`;
  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'noreply@rolemaster.io', name: 'RoleMaster' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
