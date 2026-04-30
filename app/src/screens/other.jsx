// Screens 5a (confirm), 5b (thanks), 6 (queue), 8 (publish) — wired to API.

import { useState, useEffect } from 'react';
import { t } from '../i18n.js';
import { PRODUCTS, AI_GENERATED } from '../data.js';
import { AppHeader, CuratorHeader, LangSwitcher } from '../chrome.jsx';
import { SECTION_META } from './form.jsx';
import { subs, curator } from '../api.js';

function valueOfConfirm(v, lang) {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v[lang] || v.en || '';
  return String(v);
}

function GenBlock({ title, children, accent }) {
  const accentColor = accent === 'gold' ? 'var(--gold)' : 'var(--cop-border)';
  return (
    <div style={{
      background: 'white', border: '1px solid var(--line)',
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 8, padding: '12px 14px', marginBottom: 12
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

export function ScreenConfirm({ lang, setLang, goNext, goBack, submissionId, supplierName, onLogout }) {
  const [fields, setFields] = useState({});
  useEffect(() => {
    if (!submissionId) return;
    subs.get(submissionId).then(({ fields: f }) => setFields(f)).catch(() => {});
  }, [submissionId]);

  return (
    <div className="screen-anim" style={{
      minHeight: '100vh', background: 'rgba(15,36,64,0.45)', padding: 24,
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)'
    }}>
      <div style={{
        maxWidth: 1080, width: '100%', maxHeight: '92vh', overflow: 'auto',
        background: 'white', borderRadius: 16, boxShadow: '0 30px 80px rgba(15,36,64,0.3)'
      }}>
        <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy-ink)', margin: 0 }}>{t('s5_title', lang)}</h2>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              {submissionId ?? 'TMX'}
            </div>
          </div>
          <LangSwitcher lang={lang} setLang={setLang} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ padding: '24px 28px', borderRight: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 14 }}>
              {t('s5_left', lang)}
            </div>
            {[2, 3, 4, 5, 6, 7, 8].map(secNum => {
              const meta = SECTION_META.find(m => m.num === secNum);
              const list = Object.entries(fields).filter(([, f]) => f.section === secNum);
              return (
                <div key={secNum} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>
                    {meta.icon} {t(meta.key, lang)}
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'grid', gap: 4 }}>
                    {list.slice(0, 3).map(([id, f]) => (
                      <li key={id} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                        <span style={{ color: 'var(--ink-3)' }}>{f.label[lang]}: </span>
                        {valueOfConfirm(f.value, lang) || <em style={{ color: 'var(--ink-3)' }}>{lang === 'zh' ? '暂无' : 'no data'}</em>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '24px 28px', background: 'linear-gradient(180deg, rgba(107,63,160,0.04), transparent)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cop-border)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--cop-border)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✦</span>
              {t('s5_right', lang)}
            </div>
            <GenBlock title={t('s5_pain', lang)} accent="purple">
              <em style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{AI_GENERATED.pain_narrative[lang]}</em>
            </GenBlock>
            <GenBlock title={t('s5_value', lang)} accent="purple">
              <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6 }}>{AI_GENERATED.value_position[lang]}</div>
            </GenBlock>
            <GenBlock title={t('s5_caps', lang)} accent="purple">
              <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'grid', gap: 4, fontSize: 13 }}>
                {AI_GENERATED.capabilities_summary[lang].map((c, i) => <li key={i} style={{ color: 'var(--ink)' }}>{c}</li>)}
              </ul>
            </GenBlock>
            <GenBlock title={t('s5_pitch', lang)} accent="gold">
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-ink)', lineHeight: 1.5 }}>
                "{AI_GENERATED.one_liner[lang]}"
              </div>
            </GenBlock>
          </div>
        </div>

        <div style={{ padding: '18px 28px', borderTop: '1px solid var(--line)', display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={goBack}>← {t('s5_edit', lang)}</button>
          <button className="btn btn-primary" onClick={goNext} style={{ padding: '12px 24px' }}>{t('s5_confirm', lang)} →</button>
        </div>
      </div>
    </div>
  );
}

export function ScreenThanks({ lang, setLang, goNext, supplierName, onLogout }) {
  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplierName} onLogout={onLogout} />
      <div style={{ flex: 1, padding: '60px 24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: 560, width: '100%' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--st-fill-bg)', color: 'var(--st-fill-ink)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 16
          }}>✓</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            {t('s5_thanks', lang)}
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 32px' }}>{t('s5_thanks_sub', lang)}</p>

          <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-ink)', marginBottom: 12 }}>{t('s5_progress_title', lang)}</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {PRODUCTS.map(p => {
                const isTMX = p.id === 'TMX';
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, background: isTMX ? 'var(--st-fill-bg)' : 'var(--bg)' }}>
                    <span style={{ width: 16, color: isTMX ? 'var(--st-fill-ink)' : 'var(--ink-3)', fontWeight: 700 }}>{isTMX ? '✓' : '○'}</span>
                    <span style={{ fontWeight: 600, color: 'var(--navy-ink)', minWidth: 50 }}>{p.name}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1 }}>{p.subtitle[lang]}</span>
                    <span style={{ fontSize: 12, color: isTMX ? 'var(--st-fill-ink)' : 'var(--ink-3)', fontWeight: isTMX ? 600 : 400 }}>
                      {isTMX ? t('s5_progress_submitted', lang) : '0%'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary">{t('s5_later', lang)}</button>
            <button className="btn btn-primary" onClick={goNext}>{lang === 'zh' ? '查看队列 →' : 'View queue →'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScreenQueue({ lang, setLang, openSubmission, curatorName, onLogout }) {
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const { items: list } = await subs.list();
        if (!abort) setItems(list);
      } catch (e) {
        if (!abort) setErr(e.message);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  const rows = filter === 'all' ? items : items.filter(r => r.status === filter);
  const hasAny = items.length > 0;

  const statusBadge = (s) => {
    const map = {
      new: { cls: 'ai', key: 's6_status_new' },
      review: { cls: 'weak', key: 's6_status_review' },
      revision: { cls: 'empty', key: 's6_status_revision' },
      approved: { cls: 'filled', key: 's6_status_approved' },
      published: { cls: 'filled', key: 's6_status_approved' },
      draft: { cls: 'empty', key: 's6_status_new' },
    };
    const m = map[s] || map.draft;
    return <span className={`status-badge ${m.cls}`}>{t(m.key, lang)}</span>;
  };

  const matIcon = (m) => {
    const M = { pdf: 'PDF', ppt: 'PPT', url: 'URL', voice: 'VOX', doc: 'DOC' };
    const colors = { pdf: '#DC2626', ppt: '#EA580C', url: '#2563EB', voice: '#7C3AED', doc: '#0F766E' };
    return (
      <span key={m} style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
        color: colors[m] ?? '#666', padding: '2px 5px',
        background: 'white', border: `1px solid ${colors[m] ?? '#999'}40`, borderRadius: 3
      }}>{M[m] ?? m.toUpperCase()}</span>
    );
  };

  return (
    <div className="screen-anim platform-curator" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CuratorHeader lang={lang} setLang={setLang} activeTab="subs" curatorName={curatorName} onLogout={onLogout} />
      <div style={{ padding: '20px 24px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy-ink)', margin: 0 }}>
            {t('s6_title', lang)}
            <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 10, fontSize: 14 }}>
              {rows.length} {lang === 'zh' ? '条' : 'items'}
            </span>
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="text-input" placeholder={t('s6_search', lang)} style={{ width: 240, fontSize: 13, padding: '7px 10px' }} />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="text-input" style={{ width: 'auto', padding: '7px 10px', fontSize: 13 }}>
              <option value="all">{lang === 'zh' ? '全部状态' : 'All status'}</option>
              <option value="new">{t('s6_status_new', lang)}</option>
              <option value="review">{t('s6_status_review', lang)}</option>
              <option value="revision">{t('s6_status_revision', lang)}</option>
              <option value="approved">{t('s6_status_approved', lang)}</option>
            </select>
          </div>
        </div>

        {loading && <div style={{ padding: 40, color: 'var(--ink-3)' }}>{lang === 'zh' ? '加载中…' : 'Loading…'}</div>}
        {err && <div style={{ padding: 20, color: 'var(--st-empty-ink)' }}>⚠ {err}</div>}

        {!loading && !hasAny && (
          <div style={{
            padding: 60, textAlign: 'center',
            background: 'white', border: '1px dashed var(--line)', borderRadius: 14,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'var(--plat-curator-tint)', color: 'var(--plat-curator)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, marginBottom: 14,
            }}>📭</div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
              {lang === 'zh' ? '暂无待审提交' : 'Nothing to review yet'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
              {lang === 'zh'
                ? '当供应商完成提交后,新条目会出现在这里。'
                : 'New submissions will appear here when suppliers finish their forms.'}
            </p>
          </div>
        )}

        {!loading && hasAny && (
          <div style={{ background: 'white', borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '100px 1.6fr 1.4fr 100px 90px 110px 100px',
              gap: 12, padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--ink-3)', borderBottom: '1px solid var(--line)', background: '#FAFAF7'
            }}>
              <div>{t('s6_col_status', lang)}</div>
              <div>{t('s6_col_supplier', lang)}</div>
              <div>{t('s6_col_product', lang)}</div>
              <div>{t('s6_col_submitted', lang)}</div>
              <div>{t('s6_col_prefill', lang)}</div>
              <div>{t('s6_col_materials', lang)}</div>
              <div></div>
            </div>
            {rows.map((r, i) => (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '100px 1.6fr 1.4fr 100px 90px 110px 100px',
                gap: 12, padding: '12px 16px', fontSize: 13, alignItems: 'center',
                borderBottom: i < rows.length - 1 ? '1px solid var(--line-2)' : 'none'
              }}>
                <div>{statusBadge(r.status)}</div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--navy-ink)' }}>{r.supplier}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{r.contact}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>{r.product}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.productSub?.[lang]}</div>
                </div>
                <div style={{ color: 'var(--ink-2)', fontSize: 12 }}>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="conf-bar" style={{ width: 32 }}>
                      <div className="conf-bar-fill" style={{ width: `${r.prefill}%`, background: r.prefill > 70 ? 'var(--st-fill-ink)' : r.prefill > 50 ? 'var(--st-weak-ink)' : 'var(--st-empty-ink)' }} />
                    </div>
                    <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)', fontWeight: 500 }}>{r.prefill}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>{r.materials.map(matIcon)}</div>
                <div>
                  <button className="btn-ghost" onClick={() => openSubmission(r.id)}
                    style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600, color: 'var(--navy-2)', borderRadius: 6, border: '1px solid var(--line)' }}>
                    {t('s6_review', lang)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ScreenPublish({ lang, setLang, goBack, onPublish, submissionId, curatorName, onLogout }) {
  const [published, setPublished] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const doPublish = async () => {
    if (!submissionId) { setPublished(true); return; }
    try {
      setBusy(true); setErr('');
      await curator.publish(submissionId);
      setPublished(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (published) {
    return (
      <div className="screen-anim platform-curator" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <CuratorHeader lang={lang} setLang={setLang} curatorName={curatorName} onLogout={onLogout} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--st-fill-bg)', color: 'var(--st-fill-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 18 }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 10px', letterSpacing: '-0.01em' }}>{t('s8_published', lang)}</h2>
            <p style={{ color: 'var(--ink-2)', margin: '0 0 24px' }}>{t('s8_notified', lang)}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={goBack}>{t('s8_back_queue', lang)}</button>
              <button className="btn btn-primary" onClick={onPublish}>{t('s8_view_listing', lang)}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-anim" style={{ minHeight: '100vh', background: 'rgba(15,36,64,0.45)', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <CuratorHeader lang={lang} setLang={setLang} curatorName={curatorName} onLogout={onLogout} />
      </div>
      <div style={{ maxWidth: 580, width: '100%', background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 30px 80px rgba(15,36,64,0.3)' }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 18px', letterSpacing: '-0.01em' }}>{t('s8_title', lang)}</h2>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{t('s8_will', lang)}</div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.7 }}>
            <li>{t('s8_will1', lang)}</li>
            <li>{t('s8_will2', lang)}</li>
            <li>{t('s8_will3', lang)}</li>
          </ul>
        </div>
        <button onClick={() => setShowPreview(!showPreview)} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>{t('s8_preview_notif', lang)}</span>
          <span style={{ transform: showPreview ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.18s' }}>›</span>
        </button>
        {showPreview && (
          <div style={{ marginTop: 12, padding: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>{lang === 'zh' ? '邮件预览' : 'Email preview'}</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {lang === 'zh' ? '你好,你的产品已通过审核 🎉' : 'Your product has been approved 🎉'}
            </div>
          </div>
        )}
        {err && <div style={{ marginTop: 12, color: 'var(--st-empty-ink)', fontSize: 13 }}>⚠ {err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={goBack}>{t('s8_cancel', lang)}</button>
          <button className="btn btn-gold" onClick={doPublish} disabled={busy} style={{ padding: '12px 24px' }}>
            {busy ? '…' : t('s8_confirm_pub', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
