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

export function ScreenOnboard({ lang, setLang, goNext, submissionId, onLogout }) {
  const { supplier } = useAuth();
  const [parsing, setParsing] = useState(false);
  const [hover, setHover] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');

  // Drives the fake "AI parsing" progress UI after upload completes.
  useEffect(() => {
    if (!parsing) return;
    let p = 0;
    const id = setInterval(() => {
      p += 6 + Math.random() * 12;
      if (p >= 100) { p = 100; clearInterval(id); setTimeout(() => goNext(), 400); }
      setProgress(p);
    }, 180);
    return () => clearInterval(id);
  }, [parsing]);

  const upload = async (files) => {
    if (!files?.length) { setParsing(true); return; }
    if (!submissionId) { setParsing(true); return; } // Skip API call until submission exists; the multi screen creates it.
    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      await subs.uploadFile(submissionId, fd);
      setParsing(true);
    } catch (e) {
      setErr(e.message);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setHover(false);
    upload(Array.from(e.dataTransfer?.files || []));
  };

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

          {!parsing ? (
            <>
              <label
                onDragOver={(e) => { e.preventDefault(); setHover(true); }}
                onDragLeave={() => setHover(false)}
                onDrop={onDrop}
                style={{
                  border: `2px dashed ${hover ? 'var(--navy)' : 'var(--line)'}`,
                  borderRadius: 16,
                  background: hover ? 'rgba(31,58,95,0.04)' : 'white',
                  padding: '56px 32px',
                  cursor: 'pointer',
                  transition: 'all 0.18s',
                  display: 'block',
                }}>
                <input type="file" multiple style={{ display: 'none' }}
                  onChange={(e) => upload(Array.from(e.target.files || []))} />
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
                  {t('s2_drop', lang)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                  {t('s2_drop_sub', lang)}
                </div>
              </label>

              <div style={{ marginTop: 24, fontSize: 13, color: 'var(--ink-2)' }}>{t('s2_or', lang)}</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setParsing(true)}>+ {t('s2_url', lang)}</button>
                <button className="btn btn-secondary" onClick={() => setParsing(true)}>+ {t('s2_text', lang)}</button>
                <button className="btn btn-secondary" onClick={() => setParsing(true)}>+ {t('s2_voice', lang)}</button>
              </div>
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-2)' }}>
                {t('s2_no_materials', lang)}{' '}
                <button onClick={() => setParsing(true)} style={{ color: 'var(--navy-2)', textDecoration: 'underline', padding: 0 }}>
                  {t('s2_qa_instead', lang)}
                </button>
              </div>
              {err && <div style={{ marginTop: 16, color: 'var(--st-empty-ink)', fontSize: 13 }}>{err}</div>}
            </>
          ) : (
            <div style={{
              padding: 40, background: 'white', borderRadius: 16,
              border: '1px solid var(--line)', maxWidth: 480, margin: '0 auto'
            }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--navy-ink)', marginBottom: 6 }}>
                {t('s2_parsing', lang)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>
                {t('s2_parsing_sub', lang)}
              </div>
              <div style={{ height: 6, background: 'var(--line-2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--navy-2), var(--gold))',
                  transition: 'width 0.18s ease-out'
                }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScreenMulti({ lang, setLang, goNext, onLogout }) {
  const { supplier } = useAuth();
  const [checked, setChecked] = useState(PRODUCTS.map(() => true));
  const [mode, setMode] = useState('separate');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const continueFlow = async () => {
    setBusy(true); setErr('');
    try {
      // Pick the first checked product as the active one (TMX is preselected).
      const active = PRODUCTS.find((p, i) => checked[i] && p.id === 'TMX') || PRODUCTS.find((_, i) => checked[i]);
      const created = await subs.create({
        productId: active.id,
        productName: active.name,
        productSubtitle: active.subtitle,
      });
      goNext(created.id);
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
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 600, color: 'var(--st-ai-ink)',
            background: 'var(--st-ai-bg)', padding: '4px 10px', borderRadius: 999, marginBottom: 14
          }}>
            <span>✦</span> {lang === 'zh' ? 'AI 已分析完成' : 'AI analysis complete'}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 22px', letterSpacing: '-0.01em' }}>
            {t('s3_title', lang)}
          </h2>

          <div style={{ display: 'grid', gap: 8, marginBottom: 28 }}>
            {PRODUCTS.map((p, i) => (
              <label key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                border: '1px solid var(--line)', borderRadius: 10,
                background: checked[i] ? 'rgba(46,90,138,0.04)' : 'white',
                cursor: 'pointer', transition: 'background 0.15s'
              }}>
                <input type="checkbox" checked={checked[i]}
                  onChange={(e) => { const next = [...checked]; next[i] = e.target.checked; setChecked(next); }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--navy-ink)' }}>
                    {p.name}
                    <span style={{ fontWeight: 400, color: 'var(--ink-2)', marginLeft: 8, fontSize: 13 }}>
                      — {p.subtitle[lang]}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(75 + ((i * 7) % 20))}% {lang === 'zh' ? '置信度' : 'conf.'}
                </span>
              </label>
            ))}
          </div>

          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 12, fontWeight: 500 }}>
            {lang === 'zh' ? '如何处理:' : 'How would you like to handle them:'}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              ['separate', 's3_setup_all', 's3_recommend'],
              ['combine', 's3_combine', null],
              ['focus_one', 's3_focus_one', null],
            ].map(([val, key, recKey]) => (
              <label key={val} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                border: `1px solid ${mode === val ? 'var(--navy-2)' : 'var(--line)'}`, borderRadius: 10,
                background: mode === val ? 'rgba(46,90,138,0.04)' : 'white',
                cursor: 'pointer'
              }}>
                <input type="radio" checked={mode === val} onChange={() => setMode(val)} />
                <span style={{ flex: 1 }}>
                  <span style={{ color: 'var(--ink)' }}>{t(key, lang)}</span>
                  {recKey && <span style={{ color: 'var(--ink-3)', marginLeft: 6, fontSize: 12 }}>{t(recKey, lang)}</span>}
                </span>
              </label>
            ))}
          </div>

          {err && <div style={{ marginTop: 12, color: 'var(--st-empty-ink)', fontSize: 13 }}>{err}</div>}

          <button className="btn btn-primary" onClick={continueFlow} disabled={busy}
            style={{ width: '100%', marginTop: 28, padding: '12px 18px' }}>
            {busy ? '…' : t('s3_continue', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
