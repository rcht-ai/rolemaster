// Sales 9 (real login), 10 (catalog from API), 11 (rolepack detail from API), + asset gen overlay.

import { useState, useEffect, useMemo, useRef } from 'react';
import { t } from '../i18n.js';
import { LangSwitcher, PlatformHeader } from '../chrome.jsx';
import { useAuth } from '../auth.jsx';
import { catalog as catalogApi } from '../api.js';

function useToast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (msg) {
      const tm = setTimeout(() => setMsg(null), 1800);
      return () => clearTimeout(tm);
    }
  }, [msg]);
  return [msg, setMsg];
}

export function AssetGenerationOverlay({ lang, onDone, rolepackName }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= 4) {
      const tm = setTimeout(() => onDone(), 700);
      return () => clearTimeout(tm);
    }
    const tm = setTimeout(() => setStep(s => s + 1), 750);
    return () => clearTimeout(tm);
  }, [step]);

  const tags = lang === 'zh' ? '银行 / SVF / 证券' : 'Banking / SVF / Securities';
  const steps = [t('gen_step1', lang), t('gen_step2', lang), t('gen_step3', lang, { tags }), t('gen_step4', lang)];

  return (
    <div className="gen-overlay">
      <div className="gen-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--cop-bg)', color: 'var(--cop-border)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700
          }}>✦</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{t('gen_title', lang)}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{t('gen_for', lang, { name: rolepackName })}</div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          {steps.map((s, i) => {
            const state = i < step ? 'done' : i === step ? 'active' : 'pending';
            return (
              <div key={i} className={'gen-step ' + state}>
                <span className="check">{state === 'done' ? '✓' : state === 'active' ? '◐' : ''}</span>
                <span style={{ flex: 1 }}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ScreenSalesLogin({ lang, setLang, goNext }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('sales@rolemaster.io');
  const [password, setPassword] = useState('demo');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!email.includes('@')) { setErr(lang === 'zh' ? '请输入有效邮箱' : 'Enter a valid email'); return; }
    try {
      setBusy(true);
      await login(email, password);
      goNext();
    } catch (e2) {
      setErr(e2.data?.error === 'invalid_credentials'
        ? (lang === 'zh' ? '邮箱或密码错误' : 'Invalid email or password')
        : (e2.message || 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sales-login platform-sales">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--plat-sales)' }} />
      <div className="sales-login-card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--plat-sales)', color: 'white',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 22, marginBottom: 14,
            boxShadow: '0 4px 14px rgba(0,0,0,0.08)'
          }}>R</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>RoleMaster</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '6px 0 6px', letterSpacing: '-0.01em' }}>{t('s9_title', lang)}</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, lineHeight: 1.5 }}>{t('s9_sub', lang)}</p>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <div>
            <label className="field-label">{t('s9_email', lang)}</label>
            <input className="text-input" type="email" value={email}
              onChange={e => { setEmail(e.target.value); setErr(''); }} autoFocus />
          </div>
          <div>
            <label className="field-label">{t('s9_password', lang)}</label>
            <input className="text-input" type="password" value={password}
              onChange={e => { setPassword(e.target.value); setErr(''); }} />
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
              {lang === 'zh' ? '演示帐号:sales@rolemaster.io / demo' : 'Demo: sales@rolemaster.io / demo'}
            </div>
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--st-empty-ink)' }}>{err}</div>}
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ marginTop: 4, padding: '12px 18px' }}>
            {busy ? '…' : t('s9_signin', lang)} →
          </button>
        </form>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'center' }}>
          <LangSwitcher lang={lang} setLang={setLang} />
        </div>
      </div>
    </div>
  );
}

function SalesHeader({ lang, setLang, onSignOut, showBack, onBack }) {
  const right = (
    <>
      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{lang === 'zh' ? '销售网络' : 'Sales network'}</span>
      <button className="btn-ghost" onClick={onSignOut} style={{ padding: '5px 10px', fontSize: 12, color: 'var(--ink-2)' }}>{t('s10_signout', lang)}</button>
    </>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PlatformHeader platform="sales" lang={lang} setLang={setLang} right={right}
        contextLabel={showBack ? null : t('s10_title', lang)} />
      {showBack && (
        <div style={{ padding: '8px 24px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: '4px 8px', fontSize: 13, color: 'var(--ink-2)' }}>
            ← {t('s11_back', lang)}
          </button>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, options, selected, setSelected }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  const toggle = (id) => setSelected(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  const count = selected.length;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={'filter-chip ' + (count ? 'active ' : '') + (open ? 'open' : '')} onClick={() => setOpen(!open)}>
        {label}
        {count > 0 && <span className="count">{count}</span>}
        <span className="chev">▾</span>
      </button>
      {open && (
        <div className="filter-popover">
          {options.map(o => (
            <label key={o.id}>
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
              <span>{o.label}</span>
              <span className="opt-count">{o.count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScreenCatalog({ lang, setLang, openRolepack, signOut }) {
  // Wrap signOut so the SalesHeader's onSignOut prop is consistent across screens.
  const [search, setSearch] = useState('');
  const [industries, setIndustries] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [sort, setSort] = useState('relevant');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    catalogApi.list().then(({ items: list }) => { if (!abort) setItems(list); })
      .catch(() => {})
      .finally(() => { if (!abort) setLoading(false); });
    return () => { abort = true; };
  }, []);

  const indOpts = useMemo(() => {
    const map = {};
    items.forEach(r => (r.industries || []).forEach(i => map[i] = (map[i] || 0) + 1));
    const labelMap = {
      banking: { zh: '银行', en: 'Banking' }, svf: { zh: 'SVF', en: 'SVF' },
      securities: { zh: '证券', en: 'Securities' }, insurance: { zh: '保险', en: 'Insurance' },
      retail: { zh: '零售', en: 'Retail' }, sme: { zh: '中小企业', en: 'SME' },
      brand: { zh: '品牌', en: 'Brand' }, legal: { zh: '法务', en: 'Legal' },
    };
    return Object.keys(map).map(k => ({ id: k, label: labelMap[k]?.[lang] ?? k, count: map[k] }));
  }, [items, lang]);

  const personaOpts = useMemo(() => {
    const m = {};
    items.forEach(r => { const p = r.persona?.[lang]; if (p) m[p] = (m[p] || 0) + 1; });
    return Object.keys(m).map(p => ({ id: p, label: p, count: m[p] }));
  }, [items, lang]);

  const filtered = useMemo(() => {
    let list = items.filter(r => {
      if (search) {
        const hay = [(r.name?.[lang] ?? ''), (r.pitch?.[lang] ?? ''), (r.persona?.[lang] ?? '')].join(' ').toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      if (industries.length && !(r.industries || []).some(i => industries.includes(i))) return false;
      if (personas.length && !personas.includes(r.persona?.[lang])) return false;
      return true;
    });
    if (sort === 'industry') list = [...list].sort((a, b) => (a.industryLabels?.[lang]?.[0] ?? '').localeCompare(b.industryLabels?.[lang]?.[0] ?? ''));
    else if (sort === 'price') list = [...list].sort((a, b) => parseInt(String(a.fromPrice || '0').replace(/\D/g, '')) - parseInt(String(b.fromPrice || '0').replace(/\D/g, '')));
    return list;
  }, [items, search, industries, personas, sort, lang]);

  const resetAll = () => { setIndustries([]); setPersonas([]); setSearch(''); };

  return (
    <div className="platform-sales" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SalesHeader lang={lang} setLang={setLang} onSignOut={signOut} />
      <div style={{ padding: '24px 32px 80px', maxWidth: 1240, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>{t('s10_title', lang)}</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '4px 0 0' }}>
            {lang === 'zh' ? '为客户挑选合适的 AI RolePack — 用搜索或筛选缩小范围,点击卡片查看详情。' : 'Find the right AI RolePack for your customer — search or filter to narrow down, click into any card for materials.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', fontSize: 14 }}>🔍</span>
            <input className="text-input" placeholder={t('s10_search_ph', lang)} value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38, height: 42, fontSize: 14 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterChip label={t('s10_filter_industry', lang)} options={indOpts} selected={industries} setSelected={setIndustries} />
          <FilterChip label={t('s10_filter_persona', lang)} options={personaOpts} selected={personas} setSelected={setPersonas} />
          {(industries.length || personas.length || search) ? (
            <button className="btn-ghost" onClick={resetAll} style={{ padding: '6px 10px', fontSize: 12, color: 'var(--primary-deep)', fontWeight: 500 }}>{t('s10_reset', lang)}</button>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 14px', borderBottom: '1px solid var(--line)', marginBottom: 18, fontSize: 13, color: 'var(--ink-2)' }}>
          <span>{t('s10_showing', lang, { n: filtered.length })}</span>
          <select value={sort} onChange={e => setSort(e.target.value)} className="text-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
            <option value="relevant">{t('s10_sort_relevant', lang)}</option>
            <option value="recent">{t('s10_sort_recent', lang)}</option>
            <option value="industry">{t('s10_sort_industry', lang)}</option>
            <option value="price">{t('s10_sort_price', lang)}</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'zh' ? '加载中…' : 'Loading…'}</div>
        ) : items.length === 0 ? (
          <div style={{
            padding: 60, textAlign: 'center',
            background: 'white', border: '1px dashed var(--line)', borderRadius: 14,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'var(--plat-sales-tint)', color: 'var(--plat-sales)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, marginBottom: 14,
            }}>📚</div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
              {lang === 'zh' ? '目录为空' : 'Catalog is empty'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
              {lang === 'zh'
                ? '一旦策展团队批准并发布 RolePack,就会出现在这里。'
                : 'Approved RolePacks will appear here once the curator team publishes them.'}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
            {t('s10_empty', lang)}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={resetAll}>{t('s10_reset', lang)}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 16 }}>
            {filtered.map(r => (
              <button key={r.id} className="rp-card" onClick={() => openRolepack(r.id)}>
                <div className="rp-id-line"><span>{r.id}</span></div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1.3, letterSpacing: '-0.01em' }}>{r.name?.[lang]}</h3>
                <p style={{
                  fontSize: 13, color: 'var(--ink-2)', margin: 0, lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>{r.pitch?.[lang]}</p>
                <div className="tag-row">
                  {(r.industries || []).map((i, idx) => (
                    <span key={i} className={'rp-tag ind-' + i}>{r.industryLabels?.[lang]?.[idx] ?? i}</span>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, color: 'var(--ink-2)', marginTop: 6 }}>
                  <div>
                    <div style={{ color: 'var(--ink-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>{t('s10_persona_label', lang)}</div>
                    <div style={{ fontWeight: 500 }}>{r.persona?.[lang]}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--ink-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>{t('s10_region_label', lang)}</div>
                    <div style={{ fontWeight: 500 }}>{r.region?.[lang]}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--line-2)' }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400, marginRight: 4 }}>{t('s10_from', lang)}</span>
                    {r.fromPrice}
                  </div>
                  <span style={{ color: 'var(--primary-deep)', fontSize: 13, fontWeight: 600 }}>{t('s10_view', lang)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={{ minWidth: 86, fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
      <span style={{ flex: 1, color: 'var(--ink)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function Section({ title, children, compact }) {
  return (
    <div style={{ marginBottom: compact ? 0 : 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px', paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>{title}</h2>
      <div>{children}</div>
    </div>
  );
}

export function ScreenRolepackDetail({ lang, setLang, rolepackId, goBack, signOut }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useToast();

  useEffect(() => {
    if (!rolepackId) return;
    catalogApi.get(rolepackId).then(({ rolepack }) => setR(rolepack)).catch(e => setErr(e.message));
  }, [rolepackId]);

  const download = (kind) => setToast(`${t('s11_downloading', lang)} ${kind === 'deck' ? t('s11_pitch_deck', lang) : t('s11_manual', lang)}`);
  const share = () => setToast(t('s11_link_copied', lang));

  if (err) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--st-empty-ink)' }}>⚠ {err}</div>;
  if (!r) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'zh' ? '加载中…' : 'Loading…'}</div>;

  const hasFullData = !!r.pain;

  return (
    <div className="platform-sales" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SalesHeader lang={lang} setLang={setLang} onSignOut={signOut} showBack onBack={goBack} />
      <div style={{ padding: '32px 32px 24px', maxWidth: 1080, margin: '0 auto', width: '100%', flex: 1 }}>
        <div className="rp-id-line" style={{ marginBottom: 8 }}><span>{r.id}</span></div>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{r.name?.[lang]}</h1>
        <blockquote style={{
          fontSize: 17, color: 'var(--ink)', lineHeight: 1.5, margin: '16px 0 18px',
          padding: '10px 0 10px 16px', borderLeft: '3px solid var(--accent)',
          fontStyle: 'italic', fontWeight: 400
        }}>"{r.pitch?.[lang]}"</blockquote>
        <div className="tag-row" style={{ marginBottom: 28 }}>
          {(r.industries || []).map((i, idx) => (
            <span key={i} className={'rp-tag ind-' + i}>{r.industryLabels?.[lang]?.[idx] ?? i}</span>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, marginBottom: 32 }}>
          <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ color: 'var(--accent)' }}>📥</span>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('s11_materials', lang)}</h3>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <button className="asset-card" onClick={() => download('deck')}>
                <div className="asset-icon ppt">PPT</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>{t('s11_pitch_deck', lang)}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {t('s11_slides', lang, { n: r.deck?.slides ?? 7 })} · {(r.deck?.sizeMB ?? 2.4)} MB
                  </div>
                </div>
                <span style={{ color: 'var(--primary-deep)', fontSize: 18 }}>↓</span>
              </button>
              <button className="asset-card" onClick={() => download('manual')}>
                <div className="asset-icon pdf">PDF</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>{t('s11_manual', lang)}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {t('s11_pages', lang, { n: r.manual?.pages ?? 4 })} · {(r.manual?.sizeMB ?? 1.1)} MB
                  </div>
                </div>
                <span style={{ color: 'var(--primary-deep)', fontSize: 18 }}>↓</span>
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--primary-tint)', border: '1px solid var(--primary-line)', borderRadius: 14, padding: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-deep)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('s11_quick_facts', lang)}</h3>
            <div style={{ display: 'grid', gap: 9, fontSize: 13 }}>
              <Fact label={t('s11_persona', lang)} value={r.persona?.[lang]} />
              <Fact label={t('s11_decision', lang)} value={r.decisionMaker?.[lang]} />
              <Fact label={t('s11_orgsize', lang)} value={r.orgSize?.[lang]} />
              <Fact label={t('s11_region', lang)} value={r.region?.[lang]} />
              <Fact label={t('s11_languages', lang)} value={r.languages?.[lang]} />
              <Fact label={t('s11_compliance', lang)} value={r.compliance} />
            </div>
          </div>
        </div>

        {hasFullData ? (
          <>
            {r.overview && (
              <Section title={t('s11_overview', lang)}>
                <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7, padding: '16px 20px', background: 'white', border: '1px solid var(--line)', borderRadius: 12 }}>
                  {r.overview[lang]}
                </div>
              </Section>
            )}
            <Section title={t('s11_pain', lang)}>
              <blockquote style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7, margin: 0, padding: '16px 22px', background: 'white', border: '1px solid var(--line)', borderRadius: 12, fontStyle: 'italic' }}>
                {r.pain[lang]}
              </blockquote>
            </Section>
            <Section title={t('s11_outcome', lang)}>
              <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 14, color: 'var(--ink)', lineHeight: 1.8 }}>
                {(r.outcomes?.[lang] ?? []).map((o, i) => <li key={i}>{o}</li>)}
              </ul>
              {r.proof?.[lang] && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--st-fill-bg)', color: 'var(--st-fill-ink)', border: '1px solid var(--st-fill-border)', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                  <span style={{ opacity: 0.7, marginRight: 6 }}>{t('s11_proof', lang)}:</span>
                  {r.proof[lang]}
                </div>
              )}
            </Section>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 28 }}>
              <Section title={t('s11_what', lang)} compact>
                <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>
                  {(r.capabilities?.[lang] ?? []).map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </Section>
              <Section title={t('s11_prereqs', lang)} compact>
                <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>
                  {(r.prereqs?.[lang] ?? []).map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </Section>
            </div>
            <Section title={t('s11_pricing', lang)}>
              <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>{r.pricing?.[lang]?.model}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{r.pricing?.[lang]?.from}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>{r.pricing?.[lang]?.custom}</div>
              </div>
            </Section>
          </>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', background: 'white', borderRadius: 12, border: '1px solid var(--line)' }}>
            {lang === 'zh' ? '更多详情即将上线 — 请下载销售素材了解完整内容。' : 'More detail coming soon — please download the sales materials for the full content.'}
          </div>
        )}
      </div>

      <div className="sticky-footer">
        <button className="btn btn-ghost" onClick={goBack}>{t('s11_back', lang)}</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={share}>↗ {t('s11_share', lang)}</button>
          <button className="btn btn-secondary" onClick={() => download('manual')}>📋 {t('s11_manual', lang)}</button>
          <button className="btn btn-primary" onClick={() => download('deck')}>📊 {t('s11_pitch_deck', lang)}</button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
