// Screens 1-3: Register (real auth), Upload (real), Multi-product.

import { useState, useEffect } from 'react';
import { t } from '../i18n.js';
import { PRODUCTS } from '../data.js';
import { AppHeader } from '../chrome.jsx';
import { useAuth } from '../auth.jsx';
import { subs } from '../api.js';

export function ScreenRegister({ lang, setLang, goNext, onLogout }) {
  const { register } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverErr, setServerErr] = useState('');
  const [form, setForm] = useState({
    company: '', hq: '', contact: '', email: '', phone: '', password: '', terms: false,
  });
  const [errors, setErrors] = useState({});

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.company) errs.company = true;
    if (!form.hq) errs.hq = true;
    if (!form.contact) errs.contact = true;
    if (!form.email || !form.email.includes('@')) errs.email = true;
    if (!form.password || form.password.length < 4) errs.password = true;
    if (!form.terms) errs.terms = true;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      setBusy(true); setServerErr('');
      await register({
        email: form.email,
        password: form.password,
        name: form.contact,
        company: form.company,
        hq: form.hq,
        contact: form.contact,
        phone: form.phone,
      });
      setSubmitted(true);
    } catch (err) {
      setServerErr(err.data?.error === 'email_taken'
        ? (lang === 'zh' ? '该邮箱已注册' : 'Email already registered')
        : (err.message || 'Registration failed'));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="screen-anim platform-supplier" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppHeader lang={lang} setLang={setLang} onLogout={onLogout} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{
            maxWidth: 460, textAlign: 'center', padding: 40,
            background: 'white', border: '1px solid var(--line)', borderRadius: 16
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--st-fill-bg)', color: 'var(--st-fill-ink)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, marginBottom: 16
            }}>✓</div>
            <h2 style={{ fontSize: 22, margin: '0 0 8px', color: 'var(--navy-ink)' }}>
              {lang === 'zh' ? '账号已创建' : 'Account created'}
            </h2>
            <p style={{ color: 'var(--ink-2)', margin: '0 0 24px', lineHeight: 1.6 }}>
              {lang === 'zh' ? `欢迎,${form.contact}!继续添加你的产品资料。` : `Welcome, ${form.contact}! Let's add your product materials.`}
            </p>
            <button className="btn btn-primary" onClick={goNext}>
              {lang === 'zh' ? '继续 →' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} onLogout={onLogout} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <form onSubmit={onSubmit} style={{
          maxWidth: 480, width: '100%',
          background: 'white', border: '1px solid var(--line)',
          borderRadius: 16, padding: 36
        }}>
          <h1 style={{
            fontSize: 24, fontWeight: 700, color: 'var(--navy-ink)',
            margin: '0 0 6px', letterSpacing: '-0.01em'
          }}>{t('s1_heading', lang)}</h1>
          <p style={{ color: 'var(--ink-2)', margin: '0 0 28px', fontSize: 14 }}>
            {t('s1_sub', lang)}
          </p>

          {[
            ['company', 's1_company', 's1_company_ph'],
            ['hq', 's1_hq', 's1_hq_ph'],
            ['contact', 's1_contact', 's1_contact_ph'],
            ['email', 's1_email', null, 'email'],
            ['phone', 's1_phone', null, 'tel', true],
            ['password', null, null, 'password'],
          ].map(([key, labKey, phKey, type = 'text', optional]) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label className="field-label">
                {labKey ? t(labKey, lang) : (lang === 'zh' ? '密码' : 'Password')}
                {!optional && <span style={{ color: 'var(--st-empty-ink)', marginLeft: 4 }}>*</span>}
              </label>
              <input
                type={type}
                className="text-input"
                placeholder={phKey ? t(phKey, lang) : (key === 'password' ? (lang === 'zh' ? '至少 4 位' : 'min 4 chars') : '')}
                value={form[key]}
                onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                autoComplete={key === 'password' ? 'new-password' : 'off'}
                style={errors[key] ? { borderColor: 'var(--st-empty-ink)' } : {}}
              />
              {errors[key] && (
                <div style={{ fontSize: 11, color: 'var(--st-empty-ink)', marginTop: 4 }}>
                  {lang === 'zh' ? '请填写此项' : 'Required'}
                </div>
              )}
            </div>
          ))}

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 20,
            fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer'
          }}>
            <input
              type="checkbox" checked={form.terms}
              onChange={(e) => setForm(f => ({ ...f, terms: e.target.checked }))}
              style={{ marginTop: 2 }}
            />
            <span>{t('s1_terms', lang)} <a href="#">{t('s1_terms_link', lang)}</a></span>
          </label>
          {errors.terms && (
            <div style={{ fontSize: 11, color: 'var(--st-empty-ink)', marginTop: 4, marginLeft: 24 }}>
              {lang === 'zh' ? '请勾选同意条款' : 'Please agree to the terms'}
            </div>
          )}
          {serverErr && (
            <div style={{ fontSize: 12, color: 'var(--st-empty-ink)', marginTop: 12 }}>{serverErr}</div>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary"
            style={{ width: '100%', marginTop: 24, padding: '12px 18px' }}>
            {busy ? '…' : t('s1_continue', lang)}
          </button>
        </form>
      </div>
    </div>
  );
}

// Multi-file upload screen. Files persist to R2 immediately on drop/select.
// User can keep adding files, then click "Continue" to advance.
export function ScreenOnboard({ lang, setLang, goNext, submissionId, onLogout }) {
  const { supplier } = useAuth();
  const [files, setFiles] = useState([]);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Hydrate the list from any prior uploads to this submission.
  useEffect(() => {
    if (!submissionId) return;
    subs.listFiles(submissionId).then(({ files }) => setFiles(files || [])).catch(() => {});
  }, [submissionId]);

  const upload = async (incoming) => {
    if (!incoming?.length || !submissionId) return;
    try {
      setBusy(true); setErr('');
      const fd = new FormData();
      for (const f of incoming) fd.append('files', f);
      const res = await subs.uploadFile(submissionId, fd);
      setFiles(prev => [...prev, ...(res.files || [])]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setHover(false);
    upload(Array.from(e.dataTransfer?.files || []));
  };

  const fmt = (n) => n < 1024 ? `${n} B` : n < 1024*1024 ? `${(n/1024).toFixed(1)} KB` : `${(n/1024/1024).toFixed(1)} MB`;
  const KIND_COLOR = { pdf: '#DC2626', ppt: '#EA580C', doc: '#0F766E', voice: '#7C3AED', url: '#2563EB' };

  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} onLogout={onLogout}
        supplierName={supplier?.short_name ?? supplier?.name} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px 80px' }}>
        <div style={{ maxWidth: 640, width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            {t('s2_welcome', lang)}{supplier?.short_name ? `, ${supplier.short_name}` : ''}
          </h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 15, margin: '0 0 36px', lineHeight: 1.55 }}>
            {t('s2_sub', lang)}
          </p>

          <label
            onDragOver={(e) => { e.preventDefault(); setHover(true); }}
            onDragLeave={() => setHover(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${hover ? 'var(--plat-supplier)' : 'var(--line)'}`,
              borderRadius: 16,
              background: hover ? 'var(--plat-supplier-tint)' : 'white',
              padding: files.length > 0 ? '32px' : '56px 32px',
              cursor: 'pointer',
              transition: 'all 0.18s',
              display: 'block',
            }}>
            <input type="file" multiple style={{ display: 'none' }}
              onChange={(e) => { upload(Array.from(e.target.files || [])); e.target.value = ''; }} />
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'var(--st-ai-bg)', color: 'var(--st-ai-ink)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--navy-ink)', marginBottom: 6 }}>
              {files.length === 0
                ? t('s2_drop', lang)
                : (lang === 'zh' ? '继续添加更多材料 →' : 'Add more materials →')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              {t('s2_drop_sub', lang)}
            </div>
            {busy && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-3)' }}>{lang === 'zh' ? '上传中…' : 'Uploading…'}</div>}
          </label>

          {/* Uploaded files list */}
          {files.length > 0 && (
            <div style={{
              marginTop: 24, padding: 16,
              background: 'white', border: '1px solid var(--line)', borderRadius: 12,
              textAlign: 'left',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {lang === 'zh' ? '已上传' : 'Uploaded'} ({files.length})
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {files.map((f) => (
                  <div key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', background: 'var(--bg)',
                    border: '1px solid var(--line-2)', borderRadius: 6, fontSize: 13,
                  }}>
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '2px 6px', borderRadius: 3,
                      background: 'white', border: '1px solid var(--line)',
                      color: KIND_COLOR[f.kind] ?? '#666',
                    }}>{(f.kind || 'doc').toUpperCase()}</span>
                    <span style={{ flex: 1, color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {f.filename}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{fmt(f.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {err && <div style={{ marginTop: 16, color: 'var(--st-empty-ink)', fontSize: 13 }}>⚠ {err}</div>}

          {/* Continue button — always visible. Skipping is fine; AI prefill just won't fire. */}
          <div style={{ marginTop: 28, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={goNext}>
              {lang === 'zh' ? '跳过' : 'Skip'}
            </button>
            <button className="btn btn-primary" onClick={goNext}
              style={{ padding: '12px 24px', fontWeight: 600 }}>
              {files.length > 0
                ? (lang === 'zh' ? `分析这 ${files.length} 份材料 →` : `Analyse ${files.length} file${files.length === 1 ? '' : 's'} →`)
                : (lang === 'zh' ? '继续' : 'Continue →')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// "Identify" screen — runs the real AI prefill against the uploaded files,
// shows progress, then advances to the form which renders the prefilled fields.
// User can also rename the product (the AI suggests one if it could).
export function ScreenMulti({ lang, setLang, goNext, submissionId, onLogout }) {
  const { supplier } = useAuth();
  const [phase, setPhase] = useState('idle');     // idle → running → done | empty | error
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState('');
  const [updated, setUpdated] = useState(0);
  const [productName, setProductName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Kick off the prefill on mount.
  useEffect(() => {
    if (!submissionId) return;
    let alive = true;
    let p = 0;
    const tick = setInterval(() => { p = Math.min(95, p + 4 + Math.random() * 6); if (alive) setProgress(p); }, 220);
    setPhase('running');

    subs.prefill(submissionId).then((res) => {
      if (!alive) return;
      clearInterval(tick);
      setProgress(100);
      if (res.ok) {
        setPhase('done');
        setSummary(res.summary || '');
        setUpdated(res.updated || 0);
      } else {
        setPhase(res.reason === 'no_pdf_files' ? 'empty' : 'empty');
      }
    }).catch((e) => {
      if (!alive) return;
      clearInterval(tick);
      setProgress(100);
      setPhase('error');
      setErr(e.message);
    });
    return () => { alive = false; clearInterval(tick); };
  }, [submissionId]);

  const continueFlow = async () => {
    setBusy(true); setErr('');
    try {
      if (productName.trim()) {
        await subs.patch(submissionId, { productName: productName.trim() });
      }
      goNext();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} onLogout={onLogout}
        supplierName={supplier?.short_name ?? supplier?.name} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px 80px' }}>
        <div style={{ maxWidth: 600, width: '100%', background: 'white', border: '1px solid var(--line)', borderRadius: 16, padding: 36 }}>
          {phase === 'running' && (
            <>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 600, color: 'var(--cop-border)',
                background: 'var(--cop-bg)', padding: '4px 10px', borderRadius: 999, marginBottom: 14
              }}>
                <span>✦</span> {lang === 'zh' ? 'Copilot 正在分析' : 'Copilot is analysing'}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                {lang === 'zh' ? '正在阅读你上传的材料…' : 'Reading your materials…'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 24px' }}>
                {lang === 'zh' ? 'Claude 正在从 PDF 里提取产品信息,大约 20 秒。' : 'Claude is extracting product info from your PDFs — about 20 seconds.'}
              </p>
              <div style={{ height: 6, background: 'var(--line-2)', borderRadius: 3, overflow: 'hidden', marginBottom: 18 }}>
                <div style={{
                  height: '100%', width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--cop-border), var(--plat-supplier))',
                  transition: 'width 0.22s ease-out',
                }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(progress)}%
              </div>
            </>
          )}

          {(phase === 'done' || phase === 'empty' || phase === 'error') && (
            <>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 600,
                color: phase === 'done' ? 'var(--st-fill-ink)' : 'var(--ink-3)',
                background: phase === 'done' ? 'var(--st-fill-bg)' : 'var(--bg-2)',
                padding: '4px 10px', borderRadius: 999, marginBottom: 14
              }}>
                <span>{phase === 'done' ? '✓' : '○'}</span>{' '}
                {phase === 'done'
                  ? (lang === 'zh' ? `AI 已预填 ${updated} 个字段` : `AI prefilled ${updated} field${updated === 1 ? '' : 's'}`)
                  : (lang === 'zh' ? '未做 AI 预填' : 'No AI prefill')}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                {lang === 'zh' ? '请确认产品名称' : 'Confirm the product name'}
              </h2>
              {summary && (
                <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 18px', lineHeight: 1.55, fontStyle: 'italic' }}>
                  {summary}
                </p>
              )}
              {phase === 'empty' && (
                <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 18px' }}>
                  {lang === 'zh' ? '没有可解析的 PDF。你可以直接在表单里手动填写,或返回上一步上传。' : 'No PDFs to parse. You can fill the form manually or go back to upload.'}
                </p>
              )}
              {phase === 'error' && (
                <p style={{ fontSize: 12, color: 'var(--st-empty-ink)', margin: '0 0 18px' }}>⚠ {err}</p>
              )}

              <label className="field-label">{lang === 'zh' ? '产品名称' : 'Product name'}</label>
              <input
                className="text-input" value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder={lang === 'zh' ? '例如:TMX' : 'e.g. TMX'}
                style={{ marginBottom: 18 }}
              />

              {err && <div style={{ marginTop: 12, color: 'var(--st-empty-ink)', fontSize: 13 }}>⚠ {err}</div>}

              <button className="btn btn-primary" onClick={continueFlow} disabled={busy}
                style={{ width: '100%', marginTop: 8, padding: '12px 18px' }}>
                {busy ? '…' : (lang === 'zh' ? '查看预填结果 →' : 'Open the form →')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
