// Supplier dashboard — list their submissions, empty state, "new submission" CTA.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../chrome.jsx';
import { subs } from '../api.js';
import { t } from '../i18n.js';
import { useAuth } from '../auth.jsx';

export function ScreenSupplierHome({ lang, setLang, onLogout }) {
  const navigate = useNavigate();
  const { supplier } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);

  // Create a draft submission, then route the supplier into the upload flow with the new id.
  const startNew = async () => {
    if (creating) return;
    try {
      setCreating(true); setErr('');
      const res = await subs.create({});  // empty body — backend uses placeholders
      navigate(`/supplier/new/${res.id}/upload`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    let abort = false;
    subs.list()
      .then(({ items }) => { if (!abort) setItems(items); })
      .catch(e => { if (!abort) setErr(e.message); })
      .finally(() => { if (!abort) setLoading(false); });
    return () => { abort = true; };
  }, []);

  const statusBadge = (s) => {
    const map = {
      draft:    { cls: 'empty',  zh: '草稿',     en: 'Draft' },
      new:      { cls: 'ai',     zh: '新提交',   en: 'New' },
      review:   { cls: 'weak',   zh: '审阅中',   en: 'In review' },
      revision: { cls: 'empty',  zh: '需修改',   en: 'Needs revision' },
      approved: { cls: 'filled', zh: '已批准',   en: 'Approved' },
      published:{ cls: 'filled', zh: '已发布',   en: 'Published' },
    };
    const m = map[s] || map.draft;
    return <span className={`status-badge ${m.cls}`}>{lang === 'zh' ? m.zh : m.en}</span>;
  };

  return (
    <div className="platform-supplier" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} onLogout={onLogout}
        supplierName={supplier?.short_name ?? supplier?.name} />

      <main style={{
        flex: 1, padding: '32px 32px 64px',
        maxWidth: 1080, width: '100%', margin: '0 auto',
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          <div>
            <h1 style={{
              fontSize: 26, fontWeight: 700, color: 'var(--ink)',
              margin: 0, letterSpacing: '-0.02em',
            }}>
              {lang === 'zh' ? '我的产品' : 'My Submissions'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '4px 0 0' }}>
              {lang === 'zh'
                ? '把每个 AI 产品打包成一份 RolePack 提交,审阅通过后会出现在销售目录中。'
                : 'Each AI product becomes a RolePack submission. Approved RolePacks land in the sales catalog.'}
            </p>
          </div>
          <button className="btn btn-primary"
            onClick={startNew} disabled={creating}
            style={{ padding: '12px 18px', fontWeight: 600 }}>
            + {lang === 'zh' ? '新提交' : 'New submission'}
          </button>
        </div>

        {loading && <div style={{ padding: 60, color: 'var(--ink-3)', textAlign: 'center' }}>{lang === 'zh' ? '加载中…' : 'Loading…'}</div>}
        {err && <div style={{ padding: 20, color: 'var(--st-empty-ink)' }}>⚠ {err}</div>}

        {!loading && items.length === 0 && (
          <div style={{
            padding: 60, textAlign: 'center',
            background: 'white', border: '1px dashed var(--line)', borderRadius: 14,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'var(--plat-supplier-tint)',
              color: 'var(--plat-supplier)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, marginBottom: 14,
            }}>📦</div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
              {lang === 'zh' ? '还没有提交' : 'No submissions yet'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 18px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
              {lang === 'zh'
                ? '上传一份产品资料,Copilot 会帮你预填大部分字段,通常 5 分钟可以提交一份。'
                : 'Upload your product materials and Copilot will prefill most fields. Five minutes per submission is typical.'}
            </p>
            <button className="btn btn-primary"
              onClick={startNew} disabled={creating}
              style={{ padding: '10px 18px', fontWeight: 600 }}>
              {lang === 'zh' ? '开始第一份提交 →' : 'Start your first submission →'}
            </button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{
            background: 'white', borderRadius: 12, border: '1px solid var(--line)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 1fr 130px 100px 110px',
              gap: 12, padding: '10px 16px',
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--ink-3)', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)',
            }}>
              <div>{lang === 'zh' ? '状态' : 'Status'}</div>
              <div>{lang === 'zh' ? '产品' : 'Product'}</div>
              <div>ID</div>
              <div>{lang === 'zh' ? '更新时间' : 'Updated'}</div>
              <div>{lang === 'zh' ? '完成度' : 'Filled'}</div>
              <div></div>
            </div>
            {items.map((r, i) => {
              const editable = r.status === 'draft' || r.status === 'revision';
              return (
                <div key={r.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 1fr 130px 100px 110px',
                  gap: 12, padding: '14px 16px', fontSize: 13, alignItems: 'center',
                  borderBottom: i < items.length - 1 ? '1px solid var(--line-2)' : 'none',
                }}>
                  <div>{statusBadge(r.status)}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.product}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.productSub?.[lang]}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{r.id}</div>
                  <div style={{ color: 'var(--ink-2)', fontSize: 12 }}>
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : (r.createdAt ? new Date(r.createdAt).toLocaleString() : '—')}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="conf-bar" style={{ width: 36 }}>
                        <div className="conf-bar-fill" style={{ width: `${r.prefill}%`, background: 'var(--plat-supplier)' }} />
                      </div>
                      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}>{r.prefill}%</span>
                    </div>
                  </div>
                  <div>
                    <button className="btn-ghost"
                      onClick={() => navigate(`/supplier/form/${r.id}`)}
                      style={{
                        padding: '5px 10px', fontSize: 12, fontWeight: 600,
                        color: 'var(--plat-supplier)', borderRadius: 6, border: '1px solid var(--line)',
                      }}>
                      {editable ? (lang === 'zh' ? '继续编辑 →' : 'Continue →') : (lang === 'zh' ? '查看 →' : 'View →')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
