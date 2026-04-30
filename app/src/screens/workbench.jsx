// Screen 7 — Curator workbench. Loads submission from API; decision writes back.

import { useState, useEffect } from 'react';
import { t } from '../i18n.js';
import { LAYERS, AI_REC, SALES, AUDIT_LOG } from '../data.js';
import { CuratorHeader } from '../chrome.jsx';
import { subs, curator } from '../api.js';

function SubHead({ num, title, caption }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', background: 'var(--bg)', padding: '1px 6px', borderRadius: 4 }}>{num}</span>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)', margin: 0 }}>{title}</h3>
      {caption && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{caption}</span>}
    </div>
  );
}

function CompareItem({ label, value, path, ai }) {
  return (
    <div>
      <div style={{
        fontSize: 10, color: ai ? 'var(--st-ai-ink)' : 'var(--ink-3)',
        fontFamily: ai ? 'var(--font-mono)' : 'inherit',
        textTransform: ai ? 'lowercase' : 'none',
        marginBottom: 2, fontWeight: ai ? 500 : 400
      }}>
        {label || path}
      </div>
      <div style={{ color: 'var(--ink)', fontSize: 12.5, lineHeight: 1.45 }}>{value}</div>
    </div>
  );
}

function SalesBlock({ title, children, lang }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>{title}</div>
        <button style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, color: 'var(--cop-border)', border: '1px solid #D8C9EC', background: 'var(--cop-bg)', fontWeight: 500 }}>
          ✦ {t('s7_regen', lang)}
        </button>
      </div>
      {children}
    </div>
  );
}

export function ScreenWorkbench({ lang, setLang, goNext, goBack, submissionId, curatorName, onLogout }) {
  const [tab, setTab] = useState('decompose');
  const [layerTab, setLayerTab] = useState('capabilities');
  const [recChoice, setRecChoice] = useState('primary');
  const [decision, setDecision] = useState('approve');
  const [checks, setChecks] = useState([true, true, true, true, false, true, false]);
  const [comments, setComments] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState(0);
  const [submission, setSubmission] = useState(null);
  const [audit, setAudit] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!submissionId) return;
    subs.get(submissionId).then(({ submission: s, audit: a }) => {
      setSubmission(s);
      setAudit(a);
    }).catch(e => setErr(e.message));
  }, [submissionId]);

  const allChecked = checks.every(Boolean);
  const cards = LAYERS[layerTab];

  const submitDecision = async () => {
    if (!submissionId) return goNext();
    try {
      setBusy(true); setErr('');
      await curator.decide(submissionId, decision, comments);
      goNext();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-anim platform-curator" style={{ minHeight: '100vh' }}>
      <CuratorHeader lang={lang} setLang={setLang} curatorName={curatorName} onLogout={onLogout} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '10px 24px', background: 'white', borderBottom: '1px solid var(--line)', fontSize: 13
      }}>
        <button className="btn-ghost" onClick={goBack} style={{ padding: '4px 10px', fontSize: 12, color: 'var(--ink-2)' }}>
          {t('s7_back', lang)}
        </button>
        <div style={{ height: 16, width: 1, background: 'var(--line)' }} />
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{submission?.id ?? submissionId ?? '—'}</span>
          <span style={{ margin: '0 10px', color: 'var(--ink-3)' }}>·</span>
          <strong style={{ color: 'var(--navy-ink)' }}>{submission?.supplier ?? ''}</strong>
          <span style={{ margin: '0 8px', color: 'var(--ink-3)' }}>›</span>
          <span>{submission?.productName ?? ''}</span>
          <span style={{ marginLeft: 8, color: 'var(--ink-3)', fontSize: 12 }}>({submission?.productSub?.[lang] ?? ''})</span>
        </div>
        <span className="status-badge ai" style={{ marginLeft: 'auto' }}>
          {submission?.status === 'new' ? t('s6_status_new', lang) : (submission?.status ?? '')}
        </span>
      </div>

      <div className="curator-shell">
        <aside className="curator-pane">
          <div className="curator-section-head">{t('s7_pane_left', lang)}</div>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>{t('s7_uploads', lang)}</div>
            <div style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
              {(submission?.materials ?? ['pdf', 'ppt', 'url']).map((m, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', background: 'var(--bg)',
                  border: '1px solid var(--line)', borderRadius: 6,
                  fontSize: 12
                }}>
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '2px 5px', borderRadius: 3,
                    background: 'white', border: '1px solid var(--line)',
                    color: { pdf: '#DC2626', ppt: '#EA580C', url: '#2563EB', voice: '#7C3AED', doc: '#0F766E' }[m] ?? '#666'
                  }}>{m.toUpperCase()}</span>
                  <span style={{ flex: 1, color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                    Material #{i + 1}
                  </span>
                </div>
              ))}
            </div>

            <div style={{
              padding: 10, background: 'var(--st-ai-bg)',
              border: '1px solid var(--st-ai-border)', borderRadius: 8,
              fontSize: 12, color: 'var(--st-ai-ink)', marginBottom: 18
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>✦ {t('s7_extract_conf', lang)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="conf-bar" style={{ width: 60, height: 5 }}>
                  <div className="conf-bar-fill" style={{ width: `${submission?.prefill ?? 65}%`, background: 'var(--st-ai-ink)' }} />
                </div>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{submission?.prefill ?? 65}%</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="curator-pane">
          <div className="curator-section-head" style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setTab('decompose')} style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
              color: tab === 'decompose' ? 'var(--navy)' : 'var(--ink-3)',
              background: tab === 'decompose' ? 'white' : 'transparent',
              border: tab === 'decompose' ? '1px solid var(--line)' : '1px solid transparent',
              textTransform: 'uppercase', letterSpacing: '0.06em'
            }}>{t('s7_pane_center', lang)}</button>
            <button onClick={() => setTab('sales')} style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
              color: tab === 'sales' ? 'var(--navy)' : 'var(--ink-3)',
              background: tab === 'sales' ? 'white' : 'transparent',
              border: tab === 'sales' ? '1px solid var(--line)' : '1px solid transparent',
              textTransform: 'uppercase', letterSpacing: '0.06em'
            }}>{t('s7_sales', lang)}</button>
          </div>

          <div style={{ padding: 16 }}>
            {tab === 'decompose' ? (
              <>
                <SubHead num="A" title={lang === 'zh' ? '供应商填写 vs. AI 结构化提取' : 'Supplier said vs. AI extracted'} />
                <SubHead num="B" title={t('s7_three_layer', lang)} caption={lang === 'zh' ? '(策展人内部视角)' : '(curator-internal view)'} />
                <div style={{ display: 'flex', gap: 4, marginBottom: 12, fontSize: 12 }}>
                  {[
                    ['capabilities', '🛠️', t('s7_capabilities', lang), LAYERS.capabilities.length],
                    ['knowledge', '📚', t('s7_knowledge', lang), LAYERS.knowledge.length],
                    ['interfaces', '🔌', t('s7_interfaces', lang), LAYERS.interfaces.length],
                  ].map(([k, ic, lab, n]) => (
                    <button key={k} onClick={() => setLayerTab(k)} style={{
                      padding: '8px 12px', borderRadius: 8,
                      background: layerTab === k ? 'var(--navy)' : 'white',
                      color: layerTab === k ? 'white' : 'var(--ink-2)',
                      border: layerTab === k ? '1px solid var(--navy)' : '1px solid var(--line)',
                      fontWeight: 500, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6
                    }}>
                      {ic} {lab}
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: layerTab === k ? 'rgba(255,255,255,0.2)' : 'var(--bg)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'grid', gap: 6, marginBottom: 24 }}>
                  {cards.map(c => {
                    const cname = typeof c.name === 'string' ? c.name : c.name[lang];
                    const cdesc = typeof c.desc === 'string' ? c.desc : c.desc[lang];
                    return (
                      <div key={c.id} className="layer-card">
                        <span className="layer-id">{c.id}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--navy-ink)', marginBottom: 2 }}>{cname}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{cdesc}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <div className="conf-bar">
                            <div className="conf-bar-fill" style={{ width: `${c.conf * 100}%`, background: c.conf > 0.85 ? 'var(--st-fill-ink)' : c.conf > 0.75 ? 'var(--st-weak-ink)' : 'var(--st-empty-ink)' }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(c.conf * 100)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <SubHead num="C" title={lang === 'zh' ? '组装建议' : 'Assembly recommendation'} />
                <div style={{
                  border: '2px solid var(--cop-border)', borderRadius: 12, padding: 16,
                  background: 'linear-gradient(180deg, rgba(107,63,160,0.05), rgba(107,63,160,0.01))',
                  marginBottom: 12
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cop-border)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--cop-border)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✦</span>
                    🤖 {t('s7_ai_rec', lang)}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cop-ink)', marginBottom: 8 }}>{AI_REC.primary[lang]}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{AI_REC.reasoning[lang]}</div>
                </div>
              </>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                <SalesBlock title={t('s7_onepager', lang)} lang={lang}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-ink)', marginBottom: 6 }}>{SALES.onepager_headline[lang]}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{SALES.onepager_body[lang]}</div>
                </SalesBlock>
                <SalesBlock title={t('s7_pitch_outline', lang)} lang={lang}>
                  <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'grid', gap: 4, fontSize: 13 }}>
                    {SALES.pitch_outline.map((p, i) => <li key={i}>{p[lang]}</li>)}
                  </ol>
                </SalesBlock>
                <SalesBlock title={t('s7_faq', lang) + ` (${SALES.faq.length})`} lang={lang}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {SALES.faq.map((f, i) => (
                      <div key={i}>
                        <button onClick={() => setExpandedFAQ(expandedFAQ === i ? -1 : i)}
                          style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: expandedFAQ === i ? 'var(--bg)' : 'transparent', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, fontWeight: 500, color: 'var(--navy-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ transform: expandedFAQ === i ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.18s', color: 'var(--ink-3)' }}>›</span>
                          {f.q[lang]}
                        </button>
                        {expandedFAQ === i && (
                          <div style={{ padding: '10px 14px 10px 26px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{f.a[lang]}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </SalesBlock>
              </div>
            )}
          </div>
        </main>

        <aside className="curator-pane" style={{ background: 'white' }}>
          <div className="curator-section-head">{t('s7_pane_right', lang)}</div>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>{t('s7_status', lang)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 18 }}>
              {[
                ['approve', t('s7_approve', lang), 'var(--st-fill-ink)'],
                ['request', t('s7_request', lang), 'var(--st-empty-ink)'],
                ['hold', t('s7_hold', lang), 'var(--ink-3)'],
              ].map(([v, lab, color]) => (
                <button key={v} onClick={() => setDecision(v)} style={{
                  padding: '8px 6px', fontSize: 12, fontWeight: 600,
                  border: `1px solid ${decision === v ? color : 'var(--line)'}`,
                  background: decision === v ? `${color}15` : 'white',
                  color: decision === v ? color : 'var(--ink-2)',
                  borderRadius: 6
                }}>{lab}</button>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>{t('s7_checks', lang)}</div>
            <div style={{ display: 'grid', gap: 4, marginBottom: 18 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((n, i) => (
                <label key={n} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                  background: checks[i] ? 'var(--st-fill-bg)' : 'var(--bg)',
                  fontSize: 12.5, lineHeight: 1.4
                }}>
                  <input type="checkbox" checked={checks[i]}
                    onChange={(e) => { const next = [...checks]; next[i] = e.target.checked; setChecks(next); }} style={{ marginTop: 2 }} />
                  <span style={{ color: checks[i] ? 'var(--st-fill-ink)' : 'var(--ink-2)', flex: 1 }}>{t(`s7_check${n}`, lang)}</span>
                </label>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>{t('s7_comments', lang)}</div>
            <textarea className="text-input" rows={3} value={comments} onChange={(e) => setComments(e.target.value)}
              placeholder={lang === 'zh' ? '可在此与供应商沟通...' : 'Message to supplier...'}
              style={{ fontSize: 13, marginBottom: 18, resize: 'vertical' }} />

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>{t('s7_audit', lang)}</div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontSize: 11.5, color: 'var(--ink-2)', display: 'grid', gap: 6, fontFamily: 'var(--font-mono)', marginBottom: 18 }}>
              {(audit.length ? audit : AUDIT_LOG).map((a, i) => {
                const action = a.action_zh ? (lang === 'zh' ? a.action_zh : a.action_en) : (typeof a.action === 'string' ? a.action : a.action?.[lang]);
                const time = a.created_at ?? a.time;
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8, lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--ink-3)' }}>{(time || '').slice(5, 16)}</span>
                    <span><strong style={{ color: 'var(--navy-ink)' }}>{a.who}</strong> {action}</span>
                  </div>
                );
              })}
            </div>

            {err && <div style={{ marginBottom: 10, color: 'var(--st-empty-ink)', fontSize: 12 }}>⚠ {err}</div>}
            <button className="btn btn-gold" disabled={!allChecked || busy} onClick={submitDecision}
              style={{ width: '100%', padding: '12px 16px', fontWeight: 600 }}
              title={!allChecked ? t('s7_publish_disabled', lang) : ''}>
              {allChecked ? t('s7_publish', lang) + ' →' : t('s7_publish_disabled', lang)}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
