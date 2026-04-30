// Screen 4 — intake form + real Copilot. Pulls submission state from the API.

import { useState, useEffect, useRef } from 'react';
import { t } from '../i18n.js';
import { PRODUCTS } from '../data.js';
import { AppHeader } from '../chrome.jsx';
import { subs } from '../api.js';

export const SECTION_META = [
  { num: 2, key: 'sec2', icon: '👤' },
  { num: 3, key: 'sec3', icon: '💼' },
  { num: 4, key: 'sec4', icon: '🎯' },
  { num: 5, key: 'sec5', icon: '⚙' },
  { num: 6, key: 'sec6', icon: '🌐' },
  { num: 7, key: 'sec7', icon: '🤝' },
  { num: 8, key: 'sec8', icon: '💰' },
];

export function valueOf(v, lang) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v[lang] || v.en || '';
  return String(v);
}

function FieldRow({ id, field, lang, onUpdate, isPulsing, scrollTo }) {
  const ref = useRef(null);
  useEffect(() => {
    if (scrollTo === id && ref.current) {
      const top = ref.current.getBoundingClientRect().top + window.scrollY - 200;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }, [scrollTo, id]);

  const display = valueOf(field.value, lang);
  const isLong = display.length > 50;
  const sharedProps = {
    className: `text-input field-input ${field.status} ${isPulsing ? 'field-pulse' : ''}`,
    value: display,
    placeholder: field.status === 'empty' ? (lang === 'zh' ? '(暂无内容)' : '(no content yet)') : '',
    onChange: (e) => onUpdate(id, e.target.value),
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label className="field-label" style={{ marginBottom: 0 }}>{field.label[lang]}</label>
        <span className={`status-badge ${field.status}`}>
          {field.status === 'ai' && '✦ '}{field.status === 'filled' && '✓ '}
          {t('status_' + (field.status === 'ai' ? 'ai' : field.status === 'filled' ? 'filled' : field.status === 'empty' ? 'empty' : 'weak'), lang)}
        </span>
      </div>
      {isLong
        ? <textarea {...sharedProps} rows={2} style={{ resize: 'vertical', minHeight: 56, fontSize: 13.5 }} />
        : <input {...sharedProps} style={{ fontSize: 13.5 }} />
      }
      {field.hint && field.status === 'weak' && (
        <div style={{ fontSize: 11, color: 'var(--st-weak-ink)', marginTop: 4, fontStyle: 'italic' }}>
          💡 {field.hint[lang]}
        </div>
      )}
    </div>
  );
}

function SectionCard({ meta, lang, fieldsState, onUpdate, pulseSet, scrollTo }) {
  const [open, setOpen] = useState(true);
  const sectionFields = Object.entries(fieldsState).filter(([, f]) => f.section === meta.num);
  const filled = sectionFields.filter(([, f]) => f.status === 'filled' || f.status === 'ai').length;
  const total = sectionFields.length;
  const hasWeak = sectionFields.some(([, f]) => f.status === 'weak');
  const hasEmpty = sectionFields.some(([, f]) => f.status === 'empty');
  const status = total === 0 ? 'notstarted' : (hasWeak || hasEmpty ? 'attention' : 'complete');

  useEffect(() => {
    const target = scrollTo && fieldsState[scrollTo];
    if (target && target.section === meta.num) setOpen(true);
  }, [scrollTo]);

  return (
    <div className="section-card">
      <div className="section-header" onClick={() => setOpen(!open)}>
        <div className="section-icon">{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="section-title">{t(meta.key, lang)}</h3>
          <div className="section-desc">{t(meta.key + '_desc', lang)}</div>
        </div>
        <div className="section-meta">
          <span className={`status-badge ${status === 'complete' ? 'filled' : status === 'attention' ? 'weak' : 'empty'}`}>
            {status === 'complete' && '✓ '}{t('status_' + status, lang)}
          </span>
          <span className="section-count">{filled}/{total}</span>
          <span style={{ color: 'var(--ink-3)', fontSize: 13, transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.18s' }}>›</span>
        </div>
      </div>
      {open && (
        <div className="section-body">
          {sectionFields.map(([id, field]) => (
            <FieldRow key={id} id={id} field={field} lang={lang}
              onUpdate={onUpdate}
              isPulsing={pulseSet && pulseSet.has(id)}
              scrollTo={scrollTo} />
          ))}
        </div>
      )}
    </div>
  );
}

function CopilotPanel({ lang, submissionId, fieldsState, onCopilotFill, onScrollTo }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);

  // Hydrate chat history. New session → seed greeting locally.
  useEffect(() => {
    let abort = false;
    (async () => {
      const emptyCount = Object.values(fieldsState).filter(f => f.status === 'empty' || f.status === 'weak').length;
      if (!submissionId) {
        setMessages([{ role: 'bot', content: t('copilot_greet', lang, { n: emptyCount }), chips: ['copilot_walk', 'copilot_scan'] }]);
        return;
      }
      try {
        const { items } = await subs.copilotHistory(submissionId);
        if (abort) return;
        if (items.length === 0) {
          setMessages([{ role: 'bot', content: t('copilot_greet', lang, { n: emptyCount }), chips: ['copilot_walk', 'copilot_scan'] }]);
        } else {
          setMessages(items.map(i => ({
            role: i.role,
            content: i.content,
            fillList: i.meta?.updates?.map(u => ({ id: u.id, name: u.label?.[lang] ?? u.id })),
          })));
        }
      } catch {
        setMessages([{ role: 'bot', content: t('copilot_greet', lang, { n: emptyCount }), chips: ['copilot_walk', 'copilot_scan'] }]);
      }
    })();
    return () => { abort = true; };
  }, [submissionId, lang]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const handleSend = async (text) => {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: 'user', content: text }]);
    setInput('');
    setThinking(true);

    try {
      const res = submissionId
        ? await subs.copilot(submissionId, text, lang)
        : { reply: lang === 'zh' ? '(请先创建提交)' : '(create a submission first)', updates: [] };
      setMessages(m => [...m, {
        role: 'bot',
        content: res.reply,
        fillList: res.updates?.map(u => ({ id: u.id, name: u.label?.[lang] ?? u.id })),
      }]);
      if (res.updates?.length) {
        onCopilotFill(res.updates);
        setMessages(m => [...m, { role: 'system', content: t('copilot_updated_n', lang, { n: res.updates.length }) }]);
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'system', content: '⚠ ' + e.message }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div style={{
      width: 380, flexShrink: 0, background: 'white',
      borderLeft: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column', height: '100%'
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--cop-border)', color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14
        }}>✦</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--cop-ink)' }}>Copilot</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {lang === 'zh' ? '我会帮你边聊边填' : "I'll fill fields as we chat"}
          </div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => {
          if (m.role === 'system') return <div key={i} className="system-msg">{m.content}</div>;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'bot' ? 'flex-start' : 'flex-end', gap: 6 }}>
              {m.role === 'bot' && (
                <div style={{ fontSize: 10, color: 'var(--cop-border)', fontWeight: 600, marginLeft: 4, letterSpacing: '0.04em' }}>COPILOT</div>
              )}
              <div className={`bubble ${m.role}`}>
                {m.content}
                {m.fillList && m.fillList.length > 0 && (
                  <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                    {m.fillList.map((f, j) => (
                      <li key={j} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: 'var(--st-fill-ink)' }}>✓</span>
                        <button className="field-link" onClick={() => onScrollTo(f.id)}>{f.name}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {m.chips && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {m.chips.map(c => (
                    <button key={c} onClick={() => handleSend(t(c, lang))}
                      style={{
                        fontSize: 12, padding: '5px 10px', background: 'white',
                        border: '1px solid #D8C9EC', borderRadius: 999, color: 'var(--cop-border)', fontWeight: 500
                      }}>
                      {t(c, lang)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {thinking && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--cop-border)', fontWeight: 600, marginLeft: 4, letterSpacing: '0.04em' }}>COPILOT</div>
            <div className="bubble bot" style={{ padding: '10px 14px' }}>
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--cop-ink)', opacity: 0.7 }}>{t('copilot_thinking', lang)}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: 14, borderTop: '1px solid var(--line)', background: 'white' }}>
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #D8C9EC', padding: 10, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); } }}
            placeholder={t('copilot_input_ph', lang)}
            rows={2}
            style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 13, lineHeight: 1.4, fontFamily: 'inherit', background: 'transparent' }}
          />
          <button onClick={() => handleSend(input)} disabled={!input.trim() || thinking}
            style={{ background: 'var(--cop-border)', color: 'white', padding: '8px 14px', borderRadius: 8, fontWeight: 500, fontSize: 12 }}>
            {t('copilot_send', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScreenForm({ lang, setLang, goNext, submissionId, supplierName, onLogout }) {
  const [activeProduct, setActiveProduct] = useState('TMX');
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [scrollTo, setScrollTo] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [pulseAll, setPulseAll] = useState(null);
  const [fieldsState, setFieldsState] = useState({});
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Hydrate from API.
  useEffect(() => {
    if (!submissionId) {
      setLoading(false);
      return;
    }
    let abort = false;
    (async () => {
      try {
        const { submission: s, fields } = await subs.get(submissionId);
        if (abort) return;
        setSubmission(s);
        setFieldsState(fields);
      } catch (e) {
        if (!abort) setErr(e.message);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [submissionId]);

  // Sync field edits to backend (debounced via setTimeout per id).
  const pendingTimers = useRef({});
  const handleUpdate = (id, newValue) => {
    setFieldsState(prev => ({
      ...prev,
      [id]: { ...prev[id], value: newValue, status: newValue ? 'filled' : 'empty' }
    }));
    if (!submissionId) return;
    clearTimeout(pendingTimers.current[id]);
    pendingTimers.current[id] = setTimeout(() => {
      subs.patchField(submissionId, id, { value: newValue }).catch(() => {});
    }, 400);
  };

  const handleCopilotFill = (updates) => {
    const ids = updates.map(u => u.id);
    setPulseAll(ids);
    setFieldsState(prev => {
      const next = { ...prev };
      updates.forEach(u => {
        next[u.id] = { ...next[u.id], value: u.value, status: u.status || 'filled' };
      });
      return next;
    });
    setTimeout(() => setPulseAll(null), 1500);
    if (ids.length) setScrollTo(ids[0]);
  };

  const handleSubmit = async () => {
    if (!submissionId) return goNext();
    try {
      await subs.submit(submissionId);
      goNext();
    } catch (e) {
      setErr(e.message);
    }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'zh' ? '加载中...' : 'Loading...'}</div>;
  }
  if (err) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--st-empty-ink)' }}>⚠ {err}</div>;

  const productFields = Object.values(fieldsState).filter(f => f.section !== 1);
  const totalFields = productFields.length || 1;
  const filledCount = productFields.filter(f => f.status === 'filled' || f.status === 'ai').length;
  const progress = Math.round(filledCount / totalFields * 100);

  const [companyOpen, setCompanyOpen] = [false, () => {}]; // simplified — company section collapsed by default
  const companyFields = Object.entries(fieldsState).filter(([, f]) => f.section === 1);
  const companyFilled = companyFields.filter(([, f]) => f.status === 'filled' || f.status === 'ai').length;

  const productLabel = submission
    ? `${submission.productName} — ${submission.productSub?.[lang] ?? ''}`
    : (() => {
        const p = PRODUCTS.find(x => x.id === activeProduct);
        return p ? `${p.name} — ${p.subtitle[lang]}` : '';
      })();

  return (
    <div className="screen-anim platform-supplier" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="gold-line" />
      <AppHeader lang={lang} setLang={setLang} productLabel={productLabel}
        savedAt={lang === 'zh' ? '刚刚' : 'just now'} progress={progress}
        supplierName={supplierName} onLogout={onLogout} />

      <div style={{ margin: '16px 24px 0', maxWidth: 1280, alignSelf: 'center', width: 'calc(100% - 48px)' }}>
        <div style={{
          background: 'linear-gradient(180deg, rgba(31,58,95,0.04), rgba(31,58,95,0.01))',
          border: '1px solid var(--line)', borderLeft: '3px solid var(--navy)',
          borderRadius: 10, overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: 'var(--navy)', color: 'white',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
            }}>🏢</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)' }}>
                {t('sec1', lang)}
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', background: 'white', padding: '2px 8px', borderRadius: 999, border: '1px solid var(--line)' }}>
                  {lang === 'zh' ? '全公司共用' : 'Company-wide'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                {companyFields.map(([id, f]) => valueOf(f.value, lang)).filter(Boolean).slice(0, 3).join(' · ')}
              </div>
            </div>
            <span className="status-badge filled">✓ {companyFilled}/{companyFields.length}</span>
          </div>
        </div>
      </div>

      <div className="sub-status">
        <span style={{ fontWeight: 600, color: 'var(--navy-ink)' }}>
          {lang === 'zh' ? '正在编辑:' : 'Currently:'} {productLabel}
        </span>
        <div className="progress-strip">
          <span className="strip-item active">{submission?.productName ?? activeProduct} {progress}%</span>
        </div>
        <button onClick={() => setCopilotOpen(!copilotOpen)} className="btn"
          style={{
            background: copilotOpen ? 'white' : 'var(--cop-border)',
            color: copilotOpen ? 'var(--cop-border)' : 'white',
            border: `1px solid ${copilotOpen ? 'var(--cop-border)' : 'transparent'}`,
            padding: '6px 12px', fontSize: 12, fontWeight: 600
          }}>
          {copilotOpen ? '✕ ' + t('copilot_close', lang) : '✦ ' + t('copilot_btn', lang)}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 80px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            {SECTION_META.map(meta => (
              <SectionCard key={meta.num} meta={meta} lang={lang}
                fieldsState={fieldsState} onUpdate={handleUpdate}
                pulseSet={pulseAll ? new Set(pulseAll) : (pulse ? new Set([pulse]) : null)}
                scrollTo={scrollTo} />
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {filledCount} / {totalFields} {lang === 'zh' ? '已完成' : 'complete'}
              </span>
              <button className="btn btn-primary" onClick={handleSubmit}
                style={{ padding: '12px 24px', fontWeight: 600 }}>
                {t('submit_btn', lang)} →
              </button>
            </div>
          </div>
        </div>

        {copilotOpen && (
          <CopilotPanel
            lang={lang}
            submissionId={submissionId}
            fieldsState={fieldsState}
            onCopilotFill={handleCopilotFill}
            onScrollTo={(id) => { setScrollTo(id); setPulse(id); setTimeout(() => setPulse(null), 1500); }}
          />
        )}
      </div>
    </div>
  );
}
