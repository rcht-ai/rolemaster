// v2 Capabilities review — list AI-extracted RC-NN, supplier edits + confirms.

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { AppHeader } from '../../chrome.jsx';
import { intakes } from '../../api.js';
import { KnowledgeCardCarousel } from './KnowledgeCards.jsx';
import { UnderReviewBanner, PublishedBanner, isLocked } from './StatusBanner.jsx';

export function ScreenV2Capabilities({ lang, setLang, onLogout }) {
  const { supplier } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [phase, setPhase] = useState('loading');  // loading | review | error
  const [caps, setCaps] = useState([]);
  const [intake, setIntake] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fired = useRef(false);
  const locked = isLocked(intake?.status);

  // Load capabilities, run extraction if absent.
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const det = await intakes.get(id);
        if (abort) return;
        setIntake(det.intake);
        if (det.capabilities?.length) {
          setCaps(det.capabilities);
          setPhase('review');
        } else if (!fired.current) {
          fired.current = true;
          setPhase('loading');
          const res = await intakes.extractCapabilities(id);
          if (abort) return;
          if (!res.ok) { setErr(res.reason || ''); setPhase('error'); return; }
          const det2 = await intakes.get(id);
          if (abort) return;
          setCaps(det2.capabilities || []);
          setPhase('review');
        }
      } catch (e) { setErr(e.message); setPhase('error'); }
    })();
    return () => { abort = true; };
  }, [id]);

  const updateLocal = (capId, patch) => setCaps(prev => prev.map(c => c.id === capId ? { ...c, ...patch } : c));

  const saveCap = async (cap, patch) => {
    updateLocal(cap.id, patch);
    try {
      const body = {};
      if ('name_zh' in patch || 'name_en' in patch) {
        body.name = { zh: patch.name_zh ?? cap.name_zh, en: patch.name_en ?? cap.name_en };
      }
      if ('description_zh' in patch || 'description_en' in patch) {
        body.description = { zh: patch.description_zh ?? cap.description_zh, en: patch.description_en ?? cap.description_en };
      }
      if (Object.keys(body).length) await intakes.patchCapability(id, cap.id, body);
    } catch (e) { setErr(e.message); }
  };

  const removeCap = async (cap) => {
    if (!confirm(lang === 'zh' ? `删除 ${cap.rc_label}?` : `Delete ${cap.rc_label}?`)) return;
    try {
      await intakes.deleteCapability(id, cap.id);
      setCaps(prev => prev.filter(c => c.id !== cap.id));
    } catch (e) { setErr(e.message); }
  };

  const addCap = async () => {
    try {
      setBusy(true);
      const res = await intakes.addCapability(id, {
        name: { zh: '', en: '' },
        description: { zh: '', en: '' },
      });
      // Re-fetch so we have the new row + label.
      const det = await intakes.get(id);
      setCaps(det.capabilities || []);
      // Scroll to the new one
      setTimeout(() => {
        const el = document.querySelector(`[data-cap-id="${res.id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const reextract = async () => {
    if (!confirm(lang === 'zh' ? '重新分析会覆盖所有 AI 生成的能力(你手动添加的会保留)。继续?' : 'Re-analyze overwrites AI-generated capabilities (your manual additions are kept). Continue?')) return;
    fired.current = true;
    setPhase('loading');
    try {
      const res = await intakes.extractCapabilities(id);
      if (!res.ok) { setErr(res.reason || ''); setPhase('error'); return; }
      const det = await intakes.get(id);
      setCaps(det.capabilities || []);
      setPhase('review');
    } catch (e) { setErr(e.message); setPhase('error'); }
  };

  const confirmAndContinue = async () => {
    const missing = caps.filter(c => !((lang === 'zh' ? c.name_zh : c.name_en) || '').trim());
    if (missing.length > 0) {
      setErr(lang === 'zh'
        ? `还有 ${missing.length} 项能力没有填名称(红色框标出)。`
        : `${missing.length} capabilit${missing.length === 1 ? 'y is' : 'ies are'} missing a name (highlighted in red).`);
      setTimeout(() => {
        const el = document.querySelector(`[data-cap-id="${missing[0].id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }
    try {
      setBusy(true); setErr('');
      await intakes.confirmCapabilities(id);
      navigate(`/supplier/intake/${id}/roles`);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="screen-anim platform-supplier v2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />

      {phase === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ maxWidth: 560, width: '100%', textAlign: 'left' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              {lang === 'zh' ? 'AI 正在阅读你的材料…' : 'AI is reading your materials…'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 24px' }}>
              {lang === 'zh' ? '大约 30–60 秒,等待时了解一下整体流程。' : 'About 30–60 seconds. Here\'s a quick primer while you wait.'}
            </p>
            <KnowledgeCardCarousel stage="capabilities" lang={lang} etaSeconds={45} />
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ maxWidth: 460, textAlign: 'center' }}>
            <p style={{ color: 'var(--st-empty-ink)', marginBottom: 16 }}>⚠ {err || (lang === 'zh' ? '分析失败' : 'Analysis failed')}</p>
            <button className="btn btn-primary" onClick={reextract}>
              {lang === 'zh' ? '重试分析' : 'Retry analysis'}
            </button>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="v2-page">
          <div className="v2-eyebrow">{lang === 'zh' ? '步骤 3 · 能力梳理' : 'Step 3 · Capabilities'}</div>
          <div className="v2-title-row">
            <h1 className="v2-display">{lang === 'zh' ? '请确认你产品的能力' : 'Confirm your product\'s capabilities'}</h1>
            {locked
              ? (intake.status === 'published'
                  ? <span className="v2-status-pill v2-status-pill--ok">✓ {lang === 'zh' ? '已发布' : 'Published'}</span>
                  : <span className="v2-status-pill v2-status-pill--review">✦ {lang === 'zh' ? '审阅中' : 'In review'}</span>)
              : <span className="v2-status-pill v2-status-pill--ai">✦ {lang === 'zh' ? `AI 识别到 ${caps.length} 项能力` : `AI identified ${caps.length} capabilit${caps.length === 1 ? 'y' : 'ies'}`}</span>}
          </div>
          <p className="v2-lede" style={{ maxWidth: 'none' }}>
            {lang === 'zh'
              ? '一项能力 = 产品能独立完成的一件事。你可以编辑、增删,确认后我们会帮你匹配岗位角色。'
              : 'A capability = one thing your product can do independently. Edit/add/remove freely. Once confirmed, we match these to Roles.'}
          </p>

          <div style={{ marginTop: 8 }}>
            <div className="v2-section__head--actions" style={{ marginBottom: 14, padding: '0 4px' }}>
              <div className="v2-section__head-left">
                <h2 className="v2-h2--sm">{lang === 'zh' ? '能力清单' : 'Capabilities'}</h2>
                <span className="v2-meta">{caps.length} {lang === 'zh' ? '项' : (caps.length === 1 ? 'item' : 'items')}</span>
              </div>
              {!locked && (
                <div className="v2-section__head-actions">
                  <button onClick={addCap} disabled={busy} className="v2-btn-quiet">
                    + {lang === 'zh' ? '添加能力' : 'Add capability'}
                  </button>
                  <button onClick={reextract} className="v2-btn-quiet">
                    ↻ {lang === 'zh' ? 'AI 重新分析' : 'Re-analyze'}
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {caps.map((c, idx) => (
                <CapabilityCard key={c.id} cap={c} index={idx + 1} lang={lang} locked={locked}
                  onChange={(patch) => saveCap(c, patch)}
                  onDelete={() => removeCap(c)} />
              ))}
            </div>
          </div>

          {err && <div className="v2-banner-error" style={{ marginTop: 14 }}>⚠ {err}</div>}

          <div className="v2-cluster">
            <button className="btn btn-ghost" onClick={() => navigate(locked ? '/supplier' : '/supplier/onboard')}>
              ← {lang === 'zh' ? (locked ? '返回主页' : '返回') : (locked ? 'Back to home' : 'Back')}
            </button>
            <div className="v2-grow"></div>
            {!locked && (
              <button className="btn btn-primary" onClick={confirmAndContinue} disabled={busy || caps.length === 0}
                style={{ padding: '12px 18px', fontSize: 14, fontWeight: 600 }}>
                {busy ? '…' : (lang === 'zh' ? `确认 ${caps.length} 项能力,匹配岗位 →` : `Confirm ${caps.length} capabilities, match Roles →`)}
              </button>
            )}
            {locked && (
              <button className="btn btn-primary" onClick={() => navigate(`/supplier/intake/${id}/roles`)}
                style={{ padding: '12px 18px', fontSize: 14, fontWeight: 600 }}>
                {lang === 'zh' ? `查看 ${caps.length} 项能力对应的岗位 →` : `View Roles using these ${caps.length} capabilities →`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CapabilityCard({ cap, index, lang, locked, onChange, onDelete }) {
  const [name, setName] = useState(lang === 'zh' ? (cap.name_zh || '') : (cap.name_en || ''));
  const [desc, setDesc] = useState(lang === 'zh' ? (cap.description_zh || '') : (cap.description_en || ''));
  useEffect(() => {
    setName(lang === 'zh' ? (cap.name_zh || '') : (cap.name_en || ''));
    setDesc(lang === 'zh' ? (cap.description_zh || '') : (cap.description_en || ''));
  }, [lang, cap.name_zh, cap.name_en, cap.description_zh, cap.description_en]);

  const nameError = !locked && !name.trim();
  return (
    <div data-cap-id={cap.id} className="v2-input-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span className="v2-code-label">{cap.rc_label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-ink)' }}>
            {lang === 'zh' ? `能力 ${index}` : `Capability ${index}`}
          </span>
        </div>
        {!locked && (
          <button onClick={onDelete}
            title={lang === 'zh' ? '删除' : 'Delete'}
            style={{ padding: '4px 10px', fontSize: 18, lineHeight: 1, color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--st-empty-ink)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--st-empty-ink) 8%, transparent)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent'; }}
          >×</button>
        )}
      </div>
      <input className={`text-input${nameError ? ' error' : ''}`} value={name} readOnly={locked}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !locked && onChange(lang === 'zh' ? { name_zh: name } : { name_en: name })}
        placeholder={lang === 'zh' ? '能力名称(动词+对象)' : 'Capability name (verb + object)'}
        style={{ fontSize: 14, fontWeight: 600, padding: '8px 12px', marginBottom: nameError ? 4 : 8, background: locked ? 'var(--bg)' : 'white' }} />
      {nameError && (
        <div className="field-error" style={{ marginBottom: 8 }}>
          ⚠ {lang === 'zh' ? '请填写能力名称' : 'Capability name is required'}
        </div>
      )}
      <textarea className="text-input" value={desc} rows={4} readOnly={locked}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => !locked && onChange(lang === 'zh' ? { description_zh: desc } : { description_en: desc })}
        placeholder={lang === 'zh' ? '一句话描述这项能力是怎么工作的' : 'One sentence: how this capability works'}
        style={{ fontSize: 13, padding: '8px 12px', resize: 'vertical', minHeight: 88, lineHeight: 1.55, background: locked ? 'var(--bg)' : 'white' }} />
      {cap.source_quote && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 10 }}>
          {lang === 'zh' ? '来源: ' : 'Source: '}"{cap.source_quote.slice(0, 120)}"
        </div>
      )}
    </div>
  );
}
