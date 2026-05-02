// Curator screens: Queue (S6 inbox redesign) + Publish (S8). The legacy
// supplier-side ScreenConfirm / ScreenThanks were removed when the v2
// supplier flow replaced them.

import { useState, useEffect, useMemo, useRef } from 'react';
import { t } from '../i18n.js';
import { CuratorHeader } from '../chrome.jsx';
import { curator } from '../api.js';

// Demo submissions used to populate the kanban when the live API returns
// fewer than ~8 items, so the prototype always has enough cards for layout.
// Stays inline (curator-lane-owned) rather than living in the shared data.js.
const QUEUE = [
  { id: "S-2418", supplier: "Vigil Advisory Limited", contact: "wilson@vigil.hk", product: "TMX", productSub: { zh: "AML 交易监控", en: "AML Monitoring" }, prefill: 65, materials: ["pdf", "ppt", "url"], status: "new" },
  { id: "S-2417", supplier: "Aselo Inc.", contact: "ops@aselo.io", product: "Aselo Sales Copilot", productSub: { zh: "零售门店导购助手", en: "Retail SME sales assistant" }, prefill: 72, materials: ["pdf", "ppt"], status: "review" },
  { id: "S-2416", supplier: "Lumon AI", contact: "harmony@lumon.ai", product: "Severance Workflow", productSub: { zh: "工作流自动化", en: "Workflow automation" }, prefill: 48, materials: ["pdf", "voice"], status: "revision" },
  { id: "S-2415", supplier: "Anthropic Edge", contact: "deploy@aedge.ai", product: "Claude Sales Coach", productSub: { zh: "B2B 销售训练", en: "B2B sales training" }, prefill: 88, materials: ["pdf", "url", "voice"], status: "review" },
  { id: "S-2414", supplier: "Helix Compliance", contact: "team@helix.cn", product: "Helix KYC", productSub: { zh: "客户尽调", en: "KYC due diligence" }, prefill: 70, materials: ["pdf", "ppt", "url"], status: "approved" },
  { id: "S-2413", supplier: "MarketBase", contact: "founders@marketbase.io", product: "MB Insights", productSub: { zh: "市场情报", en: "Market intelligence" }, prefill: 55, materials: ["url", "voice"], status: "new" },
  { id: "S-2412", supplier: "Stratify HK", contact: "sales@stratify.hk", product: "Stratify Risk", productSub: { zh: "风险建模", en: "Risk modeling" }, prefill: 81, materials: ["pdf", "ppt"], status: "approved" },
  { id: "S-2411", supplier: "Cobalt Labs", contact: "biz@cobaltlabs.ai", product: "Cobalt Eval", productSub: { zh: "模型评测平台", en: "Model evaluation" }, prefill: 60, materials: ["pdf"], status: "review" },
];

// Map a curator-side intake from /api/curator/intakes onto the card shape
// ScreenQueue expects. Lets the kanban consume real data alongside the QUEUE
// demo fallback.
function adaptIntake(it) {
  const totalRolepacks = it.rolepack_count || 0;
  const ready = it.rolepack_ready || 0;
  const prefill = totalRolepacks > 0 ? Math.round((ready / totalRolepacks) * 100) : 0;
  return {
    id: it.id,
    supplier: it.supplier_short_name || it.supplier_name || '—',
    contact: '',
    product: it.industry_hint || it.id,
    productSub: { zh: it.industry_hint || '', en: it.industry_hint || '' },
    status: it.status === 'submitted' ? 'review'
      : it.status === 'published' ? 'published'
      : it.status,
    prefill,
    materials: [],
    submittedAt: it.finalized_at || it.updated_at,
    createdAt: it.created_at,
  };
}


// ─── Curator inbox helpers ─────────────────────────────────────────────

const PHASES = ['new', 'review', 'disc', 'final', 'pub'];

const DEMO_CURATORS = [
  { id: 'cur-grace',  name: 'Grace Ho',     short: 'GH', color: '#8E7AB5' },
  { id: 'cur-mei',    name: 'Mei Chan',     short: 'MC', color: '#6E9CC9' },
  { id: 'cur-daniel', name: 'Daniel Kim',   short: 'DK', color: '#6FA577' },
  { id: 'cur-priya',  name: 'Priya Singh',  short: 'PS', color: '#C9A961' },
];

const SUPPLIER_INDUSTRY = {
  'Vigil Advisory Limited': 'banking',
  'Aselo Inc.': 'retail',
  'Lumon AI': 'prosvc',
  'Anthropic Edge': 'prosvc',
  'Helix Compliance': 'insurance',
  'MarketBase': 'prosvc',
  'Stratify HK': 'banking',
  'Cobalt Labs': 'prosvc',
};

const INDUSTRY_LABEL = {
  banking:   { zh: '银行',     en: 'Banking' },
  insurance: { zh: '保险',     en: 'Insurance' },
  retail:    { zh: '零售',     en: 'Retail' },
  prosvc:    { zh: '专业服务', en: 'Pro services' },
  other:     { zh: '其他',     en: 'Other' },
};

// Stable, deterministic hash from id → bucket index.
function hashIdx(id, n) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % n;
}

// LocalStorage helpers — namespace per submission so the demo state survives reloads.
function readMap(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function writeMap(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

function defaultPhaseFor(item) {
  // Map server status → kanban phase, with a deterministic spread for variety.
  const s = item.status;
  if (s === 'published' || s === 'approved') return 'pub';
  if (s === 'revision') return 'disc';
  if (s === 'review')   return ['review', 'disc', 'final'][hashIdx(item.id, 3)];
  return 'new';
}

function defaultAssigneeFor(item, curators) {
  return curators[hashIdx(item.id + '-a', curators.length)].id;
}

function ageDays(item) {
  const ts = item.submittedAt || item.createdAt;
  if (!ts) return 0;
  const ms = Date.now() - new Date(ts).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}
function ageLabel(item, lang) {
  const ts = item.submittedAt || item.createdAt;
  if (!ts) return '—';
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 60 * 60 * 1000) return t('s6_age_just', lang);
  if (ms < 24 * 60 * 60 * 1000) return t('s6_age_today', lang);
  if (ms < 48 * 60 * 60 * 1000) return t('s6_age_yesterday', lang);
  return t('s6_age_days', lang, { n: Math.floor(ms / 86400000) });
}

function fmtDate(ymd, lang) {
  if (!ymd) return '—';
  const d = new Date(ymd + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
}

function callRelative(ymd, lang) {
  if (!ymd) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(ymd + 'T00:00:00');
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0)  return { label: t('s6_call_today', lang), kind: 'today' };
  if (diff === 1)  return { label: t('s6_call_tomorrow', lang), kind: 'soon' };
  if (diff > 1)    return { label: t('s6_call_on', lang, { date: fmtDate(ymd, lang) }), kind: 'upcoming' };
  // Past — return null (caller renders the post-call notes chip instead)
  return null;
}

function notesChipFor(callDate, lang) {
  if (!callDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(callDate + 'T00:00:00');
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diff < 1) return null; // not past yet
  return {
    overdue: diff >= 3,
    label: diff >= 3 ? t('s6_notes_overdue', lang) : t('s6_notes_pending', lang),
    when: t('s6_notes_call_was', lang, { date: fmtDate(callDate, lang) }),
  };
}

function MatChip({ m }) {
  const M = { pdf: 'PDF', ppt: 'PPT', url: 'URL', voice: 'VOX', doc: 'DOC' };
  return <span className={`mat-chip ${m}`}>{M[m] || m.toUpperCase()}</span>;
}

function Avatar({ curator, size }) {
  const cls = 'avatar' + (size ? ' ' + size : '');
  return (
    <span className={cls} style={{ background: curator.color }} title={curator.name}>
      {curator.short}
    </span>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────

function KanbanCard({ item, lang, phase, callDate, assignee, curators, onOpen, onDragStart, onDragEnd, isLead, scope, showAssignee, currentCuratorId }) {
  const cur = curators.find(c => c.id === assignee) || curators[0];
  const callRel = phase === 'disc' ? callRelative(callDate, lang) : null;
  const notes   = phase === 'disc' ? notesChipFor(callDate, lang) : null;
  const indKey = SUPPLIER_INDUSTRY[item.supplier] || 'other';
  const capCount = 10 + hashIdx(item.id + '-c', 6); // demo only — fake but stable
  const isCallToday = callRel?.kind === 'today';
  const isMine = assignee === currentCuratorId;

  return (
    <div
      className={'kanban-card' + (isCallToday ? ' call-day' : '')}
      draggable={!isLead || scope !== 'team' ? true : true}
      onDragStart={(e) => onDragStart(e, item.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(item.id)}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(item.id); }}
    >
      <div className="row-1">
        <span className="supplier" title={item.supplier}>{item.supplier}</span>
        <span className="product-id">{item.product}</span>
      </div>
      <div className="product-name">{item.productSub?.[lang] || ''}</div>

      <div className="meta">
        <span>{capCount} {lang === 'zh' ? '项能力' : 'caps'}</span>
        <span className="dot">·</span>
        <span>{ageLabel(item, lang)}</span>
        {item.prefill != null && (
          <>
            <span className="dot">·</span>
            <div className="conf-bar" style={{ width: 24 }}>
              <div className="conf-bar-fill" style={{ width: `${item.prefill}%` }} />
            </div>
            <span style={{ color: 'var(--ink-3)' }}>{item.prefill}%</span>
          </>
        )}
      </div>

      <div className="row-3">
        <div className="materials">
          {(item.materials || []).slice(0, 4).map(m => <MatChip key={m} m={m} />)}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {INDUSTRY_LABEL[indKey][lang]}
        </span>
      </div>

      {phase === 'disc' && (callRel || notes || cur) && (
        <div className="call-row">
          {notes ? (
            <span className={'notes-chip' + (notes.overdue ? ' overdue' : '')} title={notes.when}>
              {notes.label}
            </span>
          ) : callRel ? (
            <span className={'call-when' + (callRel.kind === 'today' ? ' today' : '')}>
              {callRel.label}
            </span>
          ) : null}
          {showAssignee && cur && (
            <span className="assignee">
              <Avatar curator={cur} size="sm" />
              <span className="assignee-name">{isMine && lang === 'zh' ? '我' : isMine ? 'me' : cur.name.split(' ')[0]}</span>
            </span>
          )}
        </div>
      )}

      {phase !== 'disc' && showAssignee && cur && (
        <div className="call-row" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
          <span className="assignee" style={{ marginLeft: 'auto' }}>
            <Avatar curator={cur} size="sm" />
            <span className="assignee-name">{isMine && lang === 'zh' ? '我' : isMine ? 'me' : cur.name.split(' ')[0]}</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Filter chip dropdown ──────────────────────────────────────────────

function FilterDropdown({ label, value, options, onChange, lang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const active = value && value !== 'all';
  const cur = options.find(o => o.value === value);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={'filter-chip' + (active ? ' active' : '') + (open ? ' open' : '')}
        onClick={() => setOpen(o => !o)}
      >
        <span>{label}{active ? `: ${cur?.label || value}` : ''}</span>
        <span className="chev">▾</span>
      </button>
      {open && (
        <div className="filter-popover">
          {options.map(o => (
            <label key={o.value}>
              <input
                type="radio"
                name={label}
                checked={value === o.value}
                onChange={() => { onChange(o.value); setOpen(false); }}
                style={{ accentColor: 'var(--plat-curator)' }}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sticky progress line — sits below the RoleMaster header ──────────

function CuratorProgressLine({ lang, current = 'inbox' }) {
  const steps = [
    { id: 'inbox',   label: lang === 'zh' ? '审阅队列' : 'Inbox' },
    { id: 'review',  label: lang === 'zh' ? '策展审核' : 'Review' },
    { id: 'publish', label: lang === 'zh' ? '发布上线' : 'Publish' },
  ];
  const currentIdx = steps.findIndex(s => s.id === current);
  return (
    <div className="curator-progress" role="navigation" aria-label="Curator workflow">
      {steps.map((s, i) => {
        const state = i < currentIdx ? 'done' : i === currentIdx ? 'active' : '';
        return (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 22 }}>
            <span className={'step ' + state}>
              <span className="num">{state === 'done' ? '✓' : i + 1}</span>
              <span>{s.label}</span>
            </span>
            {i < steps.length - 1 && <span className="arrow">›</span>}
          </span>
        );
      })}
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────

export function ScreenQueue({ lang, setLang, openSubmission, curatorName, onLogout }) {
  // Toggle a body-class while this screen is mounted so the global stepper
  // (rendered above the header in App.jsx) is hidden and the purple hero
  // gradient is applied. Restored on unmount.
  useEffect(() => {
    document.documentElement.classList.add('curator-inbox-page');
    return () => document.documentElement.classList.remove('curator-inbox-page');
  }, []);

  // Live API + demo augmentation. The live API may return only a couple of
  // submissions in demo deployments; pad with QUEUE samples so the kanban view
  // has enough cards to feel real. Demo items use the same id format so per-id
  // localStorage state survives across reloads.
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const { items: liveRaw } = await curator.listIntakes('all');
        if (abort) return;
        const live = (liveRaw || []).map(adaptIntake);
        const haveIds = new Set(live.map(x => x.id));
        const demoFill = QUEUE.filter(q => !haveIds.has(q.id)).map(q => ({
          id: q.id,
          supplier: q.supplier,
          contact: q.contact,
          product: q.product,
          productSub: q.productSub,
          status: q.status,
          prefill: q.prefill,
          materials: q.materials,
          // Spread fake submitted dates over recent days so age sorting + "Past 24h" filter work
          submittedAt: new Date(Date.now() - (1 + hashIdx(q.id, 9)) * 86400000).toISOString(),
        }));
        setItems([...live, ...demoFill]);
      } catch (e) {
        if (!abort) {
          // If API isn't reachable fall back to QUEUE directly so the prototype
          // still shows the redesigned UI rather than an error wall.
          setErr(e.message);
          setItems(QUEUE.map(q => ({
            id: q.id,
            supplier: q.supplier,
            contact: q.contact,
            product: q.product,
            productSub: q.productSub,
            status: q.status,
            prefill: q.prefill,
            materials: q.materials,
            submittedAt: new Date(Date.now() - (1 + hashIdx(q.id, 9)) * 86400000).toISOString(),
          })));
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  // Demo lead toggle (persists in localStorage for the prototype). The proposal
  // gates Team view on a server-side role; here a checkbox simulates that.
  const [isLead, setIsLead] = useState(() => {
    try { return localStorage.getItem('rm_curator_lead') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('rm_curator_lead', isLead ? '1' : '0'); } catch {}
    if (!isLead && scope === 'team') setScope('my');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLead]);

  // Per-item demo state (phase / assignee / callDate). Persisted so the demo
  // feels alive between reloads.
  const [phaseMap, setPhaseMap]       = useState(() => readMap('rm_phaseMap'));
  const [assignMap, setAssignMap]     = useState(() => readMap('rm_assignMap'));
  const [callDateMap, setCallDateMap] = useState(() => readMap('rm_callDateMap'));
  useEffect(() => writeMap('rm_phaseMap', phaseMap),     [phaseMap]);
  useEffect(() => writeMap('rm_assignMap', assignMap),   [assignMap]);
  useEffect(() => writeMap('rm_callDateMap', callDateMap), [callDateMap]);

  // View mode + scope.
  const [view,  setView]  = useState('kanban');   // kanban | groups
  const [scope, setScope] = useState('my');       // my | team

  // Filters.
  const [search,    setSearch]    = useState('');
  const [filterInd, setFilterInd] = useState('all');
  const [filterSup, setFilterSup] = useState('all');
  const [filterAge, setFilterAge] = useState('all');
  const [filterAss, setFilterAss] = useState('all');
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Drag state.
  const [dragId, setDragId]   = useState(null);
  const [dropCol, setDropCol] = useState(null);
  const [dropRow, setDropRow] = useState(null);

  // Pending call-date prompt (when dropping into Discussion).
  const [callPrompt, setCallPrompt] = useState(null); // { id, defaultDate }

  // Identify the current user as a demo curator (so "My queue" works).
  const currentCurator = useMemo(() => {
    if (!curatorName) return DEMO_CURATORS[0];
    const match = DEMO_CURATORS.find(c =>
      c.name.toLowerCase() === curatorName.toLowerCase() ||
      c.name.split(' ')[0].toLowerCase() === curatorName.split(' ')[0].toLowerCase()
    );
    return match || { ...DEMO_CURATORS[0], name: curatorName, short: initials(curatorName) };
  }, [curatorName]);

  function initials(n) {
    return (n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') || 'C';
  }

  // Resolve phase / assignee / callDate for an item — override or default.
  const phaseOf = (it) => phaseMap[it.id] || defaultPhaseFor(it);
  const assigneeOf = (it) => assignMap[it.id] || defaultAssigneeFor(it, DEMO_CURATORS);
  const callDateOf = (it) => callDateMap[it.id] || (() => {
    // Deterministic demo date — only used when phase is disc and no override.
    if (phaseOf(it) !== 'disc') return null;
    const offset = -3 + hashIdx(it.id + '-d', 9); // -3 .. +5 days
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  })();

  // Apply filters (used by both views).
  const filtered = useMemo(() => items.filter(it => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!(it.supplier.toLowerCase().includes(q) ||
            it.product?.toLowerCase().includes(q) ||
            (it.productSub?.[lang] || '').toLowerCase().includes(q))) return false;
    }
    if (filterInd !== 'all' && (SUPPLIER_INDUSTRY[it.supplier] || 'other') !== filterInd) return false;
    if (filterSup !== 'all' && it.supplier !== filterSup) return false;
    if (filterAge !== 'all') {
      const age = ageDays(it);
      if (filterAge === 'recent' && age > 1) return false;
      if (filterAge === 'week'   && age > 7) return false;
      if (filterAge === 'old'    && age <= 7) return false;
    }
    if (filterAss !== 'all' && assigneeOf(it) !== filterAss) return false;
    return true;
  }), [items, search, filterInd, filterSup, filterAge, filterAss, lang, assignMap, phaseMap]);

  // Apply scope (My queue vs Team view) — only relevant in kanban for cards.
  const inScope = (it) => scope === 'team' ? true : assigneeOf(it) === currentCurator.id;

  // Distribute items across phases.
  const byPhase = useMemo(() => {
    const map = { new: [], review: [], disc: [], final: [], pub: [] };
    filtered.filter(inScope).forEach(it => {
      const p = phaseOf(it);
      if (map[p]) map[p].push(it);
    });
    // Sort: discussion column bubbles "notes pending" cards to top, then upcoming calls.
    map.disc.sort((a, b) => {
      const pa = notesChipFor(callDateOf(a), 'en') ? -1 : 0;
      const pb = notesChipFor(callDateOf(b), 'en') ? -1 : 0;
      return pa - pb;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, scope, currentCurator.id, phaseMap, assignMap, callDateMap]);

  const allInScope = filtered.filter(inScope);
  const totalCount = allInScope.length;

  // Aggregate counters strip (lead + team scope).
  const stats = useMemo(() => {
    const counts = { review: byPhase.review.length, disc: byPhase.disc.length, final: byPhase.final.length };
    const ages   = allInScope.filter(it => phaseOf(it) !== 'pub').map(ageDays);
    const avg    = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    const oldest = ages.length ? Math.max(...ages) : 0;
    return { ...counts, avg, oldest };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byPhase, allInScope]);

  // Team load distribution per curator (lead + team scope only).
  const teamLoad = useMemo(() => DEMO_CURATORS.map(c => {
    const mine = filtered.filter(it => assigneeOf(it) === c.id && phaseOf(it) !== 'pub');
    const dist = { new: 0, review: 0, disc: 0, final: 0 };
    mine.forEach(it => { const p = phaseOf(it); if (dist[p] != null) dist[p]++; });
    return { curator: c, count: mine.length, dist };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filtered, phaseMap, assignMap]);

  // Drag handlers.
  const onCardDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const onCardDragEnd = () => { setDragId(null); setDropCol(null); setDropRow(null); };

  const onColDragOver = (e, phase) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropCol(phase);
  };
  const onColDrop = (e, phase) => {
    e.preventDefault();
    const id = dragId || e.dataTransfer.getData('text/plain');
    if (!id) return;
    if (phase === 'disc') {
      // Discussion phase needs a call date — open the prompt before committing.
      const today = new Date(); today.setHours(0, 0, 0, 0);
      today.setDate(today.getDate() + 1);
      setCallPrompt({ id, defaultDate: today.toISOString().slice(0, 10) });
    } else {
      setPhaseMap(m => ({ ...m, [id]: phase }));
    }
    setDragId(null); setDropCol(null);
  };
  const confirmCallPrompt = (date) => {
    if (!callPrompt) return;
    setPhaseMap(m => ({ ...m, [callPrompt.id]: 'disc' }));
    setCallDateMap(m => ({ ...m, [callPrompt.id]: date }));
    setCallPrompt(null);
  };

  const onTeamRowDragOver = (e, curId) => {
    if (!dragId || !isLead || scope !== 'team') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropRow(curId);
  };
  const onTeamRowDrop = (e, curId) => {
    e.preventDefault();
    const id = dragId || e.dataTransfer.getData('text/plain');
    if (!id) return;
    setAssignMap(m => ({ ...m, [id]: curId }));
    setDragId(null); setDropRow(null);
  };

  // Open via observe-mode hint when lead is in Team view.
  const handleOpen = (id) => {
    if (isLead && scope === 'team') {
      // Lead in Team view → still navigate, the workbench will show observe banner if needed.
      try { sessionStorage.setItem('rm_observe', '1'); } catch {}
    } else {
      try { sessionStorage.removeItem('rm_observe'); } catch {}
    }
    openSubmission(id);
  };

  const supplierOptions = useMemo(() => {
    const set = new Map();
    items.forEach(it => set.set(it.supplier, true));
    return [{ value: 'all', label: lang === 'zh' ? '全部' : 'All' },
      ...Array.from(set.keys()).map(s => ({ value: s, label: s }))];
  }, [items, lang]);

  const industryOptions = [
    { value: 'all', label: lang === 'zh' ? '全部' : 'All' },
    ...Object.entries(INDUSTRY_LABEL).map(([k, v]) => ({ value: k, label: v[lang] })),
  ];
  const ageOptions = [
    { value: 'all',    label: t('s6_age_all', lang) },
    { value: 'recent', label: t('s6_age_recent', lang) },
    { value: 'week',   label: t('s6_age_week', lang) },
    { value: 'old',    label: t('s6_age_old', lang) },
  ];
  const assigneeOptions = [
    { value: 'all', label: lang === 'zh' ? '全部' : 'All' },
    ...DEMO_CURATORS.map(c => ({ value: c.id, label: c.name })),
  ];

  const showRail = isLead && scope === 'team' && view === 'kanban';
  const showTeamStrip = isLead && scope === 'team';

  return (
    <div className="screen-anim platform-curator" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CuratorHeader lang={lang} setLang={setLang} activeTab="subs" curatorName={curatorName} onLogout={onLogout} />
      <CuratorProgressLine lang={lang} current="inbox" />

      <div className={'curator-inbox' + (showRail ? ' with-rail' : '')}>
        <div>
          {/* Title + toggles */}
          <div className="curator-inbox-head">
            <div>
              <h1>
                {t('s6_title', lang)}
                <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 10, fontSize: 16 }}>
                  {t('s6_count_items', lang, { n: totalCount })}
                </span>
              </h1>
              <p className="sub">
                {scope === 'team' && isLead
                  ? (lang === 'zh' ? '团队全局视图,可拖动卡片调整阶段或负责人。' : 'Team-wide view — drag cards to move phase or reassign.')
                  : (lang === 'zh' ? '审阅、会议、整理、发布 — 拖动卡片即可推进。' : 'Review, meet, finalize, publish — drag cards across to move them.')}
              </p>
            </div>
            <div className="toggles">
              <div className="seg-ctrl">
                <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}>
                  {t('s6_view_kanban', lang)}
                </button>
                <button className={view === 'groups' ? 'active' : ''} onClick={() => setView('groups')}>
                  {t('s6_view_groups', lang)}
                </button>
              </div>
              {isLead && (
                <div className="seg-ctrl lead-only">
                  <button className={scope === 'my' ? 'active' : ''} onClick={() => setScope('my')}>
                    {t('s6_scope_my', lang)}
                  </button>
                  <button className={scope === 'team' ? 'active' : ''} onClick={() => setScope('team')}>
                    {t('s6_scope_team', lang)}
                  </button>
                </div>
              )}
              <button
                type="button"
                className={'demo-toggle' + (isLead ? ' on' : '')}
                onClick={() => setIsLead(v => !v)}
                title={lang === 'zh' ? '原型切换:策展人 / 主管' : 'Prototype toggle: curator / lead'}
              >
                {isLead ? t('s6_demo_lead_off', lang) : t('s6_demo_lead', lang)}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="curator-filter-bar">
            <FilterDropdown label={t('s6_filter_industry', lang)} value={filterInd} onChange={setFilterInd} options={industryOptions} lang={lang} />
            <FilterDropdown label={t('s6_filter_supplier', lang)} value={filterSup} onChange={setFilterSup} options={supplierOptions} lang={lang} />
            <FilterDropdown label={t('s6_filter_age', lang)}      value={filterAge} onChange={setFilterAge} options={ageOptions} lang={lang} />
            <FilterDropdown label={t('s6_filter_assignee', lang)} value={filterAss} onChange={setFilterAss} options={assigneeOptions} lang={lang} />
            <div className="grow">
              <input
                className="text-input"
                placeholder={t('s6_search', lang)}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(filterInd !== 'all' || filterSup !== 'all' || filterAge !== 'all' || filterAss !== 'all' || search) && (
              <button className="clear" onClick={() => {
                setFilterInd('all'); setFilterSup('all'); setFilterAge('all'); setFilterAss('all'); setSearch('');
              }}>{t('s6_clear_filters', lang)}</button>
            )}
          </div>

          {/* Lead aggregate strip */}
          {showTeamStrip && (
            <div className="lead-strip">
              <div className="stat"><div className="num">{stats.review}</div><div className="lbl">{t('s6_lead_strip_review', lang, { n: '' }).replace(/\{n\}|\d+/g, '').trim() || (lang === 'zh' ? '审阅中' : 'in review')}</div></div>
              <div className="stat"><div className="num">{stats.disc}</div><div className="lbl">{lang === 'zh' ? '会议中' : 'in meeting'}</div></div>
              <div className="stat"><div className="num">{stats.final}</div><div className="lbl">{lang === 'zh' ? '收尾中' : 'finalizing'}</div></div>
              <div className="stat"><div className="num">{stats.avg}d</div><div className="lbl">{lang === 'zh' ? '平均周期' : 'avg cycle'}</div></div>
              <div className={'stat' + (stats.oldest > 10 ? ' warn' : '')}><div className="num">{stats.oldest}d</div><div className="lbl">{lang === 'zh' ? '最久' : 'oldest'}</div></div>
            </div>
          )}

          {loading && (
            <div style={{ padding: 60, color: 'var(--ink-3)', textAlign: 'center' }}>
              {lang === 'zh' ? '加载中…' : 'Loading…'}
            </div>
          )}

          {!loading && allInScope.length === 0 && (
            <div style={{
              padding: 60, textAlign: 'center', background: 'white',
              border: '1px dashed var(--line)', borderRadius: 14,
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
              <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, maxWidth: 380, marginInline: 'auto' }}>
                {items.length > 0 ? t('s6_empty_filtered', lang) :
                 (lang === 'zh' ? '当供应商完成提交后,新条目会出现在这里。'
                                : 'New submissions will appear here when suppliers finish their forms.')}
              </p>
            </div>
          )}

          {/* Kanban */}
          {!loading && allInScope.length > 0 && view === 'kanban' && (
            <div className={'kanban-board' + (archiveOpen || byPhase.pub.length === 0 ? '' : '')}>
              {[
                { phase: 'new',    titleKey: 's6_phase_new' },
                { phase: 'review', titleKey: 's6_phase_review' },
                { phase: 'disc',   titleKey: 's6_phase_disc' },
                { phase: 'final',  titleKey: 's6_phase_final' },
              ].map(({ phase, titleKey }) => (
                <div
                  key={phase}
                  className={'kanban-col' + (dropCol === phase ? ' drop-target' : '')}
                  data-phase={phase}
                  onDragOver={(e) => onColDragOver(e, phase)}
                  onDragLeave={() => setDropCol(null)}
                  onDrop={(e) => onColDrop(e, phase)}
                >
                  <div className="kanban-col-head">
                    <span className="dot" />
                    <span className="title">{t(titleKey, lang)}</span>
                    <span className="count">{byPhase[phase].length}</span>
                  </div>
                  <div className="kanban-col-body">
                    {byPhase[phase].length === 0 && (
                      <div className="kanban-col-empty">{t('s6_empty_kanban', lang)}</div>
                    )}
                    {byPhase[phase].map(it => (
                      <KanbanCard
                        key={it.id}
                        item={it}
                        lang={lang}
                        phase={phase}
                        callDate={callDateOf(it)}
                        assignee={assigneeOf(it)}
                        curators={DEMO_CURATORS}
                        currentCuratorId={currentCurator.id}
                        showAssignee={scope === 'team' || phase === 'disc'}
                        isLead={isLead}
                        scope={scope}
                        onOpen={handleOpen}
                        onDragStart={onCardDragStart}
                        onDragEnd={onCardDragEnd}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Published archive — collapsed sidecar */}
              <div
                className={'kanban-col archive' + (archiveOpen ? ' expanded' : '') + (dropCol === 'pub' ? ' drop-target' : '')}
                data-phase="pub"
                onClick={() => !archiveOpen && setArchiveOpen(true)}
                onDragOver={(e) => onColDragOver(e, 'pub')}
                onDragLeave={() => setDropCol(null)}
                onDrop={(e) => onColDrop(e, 'pub')}
              >
                {!archiveOpen && (
                  <div className="col-collapsed-label">
                    ▶ {t('s6_phase_pub', lang)} · {byPhase.pub.length}
                  </div>
                )}
                {archiveOpen && (
                  <>
                    <div className="kanban-col-head">
                      <span className="dot" />
                      <span className="title">{t('s6_phase_pub', lang)}</span>
                      <span className="count">{byPhase.pub.length}</span>
                      <button
                        className="btn-ghost"
                        onClick={(e) => { e.stopPropagation(); setArchiveOpen(false); }}
                        style={{ padding: '2px 8px', fontSize: 11, marginLeft: 4 }}
                      >×</button>
                    </div>
                    <div className="kanban-col-body">
                      {byPhase.pub.length === 0 && (
                        <div className="kanban-col-empty">{t('s6_empty_kanban', lang)}</div>
                      )}
                      {byPhase.pub.map(it => (
                        <KanbanCard
                          key={it.id}
                          item={it}
                          lang={lang}
                          phase="pub"
                          callDate={null}
                          assignee={assigneeOf(it)}
                          curators={DEMO_CURATORS}
                          currentCuratorId={currentCurator.id}
                          showAssignee={scope === 'team'}
                          isLead={isLead}
                          scope={scope}
                          onOpen={handleOpen}
                          onDragStart={onCardDragStart}
                          onDragEnd={onCardDragEnd}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Supplier groups */}
          {!loading && allInScope.length > 0 && view === 'groups' && (
            <SupplierGroupsView
              items={allInScope}
              lang={lang}
              phaseOf={phaseOf}
              onOpen={handleOpen}
            />
          )}
        </div>

        {/* Lead team-load rail */}
        {showRail && (
          <aside className="team-rail">
            <h3>{t('s6_team_load', lang)}</h3>
            <p className="hint">
              {lang === 'zh'
                ? '点击负责人筛选板面。把卡片拖到头像上即可重新分配。'
                : 'Click an avatar to filter the board. Drag a card onto an avatar to reassign.'}
            </p>
            {teamLoad.map(({ curator, count, dist }) => {
              const total = count || 1;
              const segs = ['new', 'review', 'disc', 'final'].map(p => ({
                p,
                pct: (dist[p] / total) * 100,
              }));
              return (
                <div
                  key={curator.id}
                  className={'team-row'
                    + (filterAss === curator.id ? ' active' : '')
                    + (dropRow === curator.id ? ' drop-target' : '')}
                  onClick={() => setFilterAss(prev => prev === curator.id ? 'all' : curator.id)}
                  onDragOver={(e) => onTeamRowDragOver(e, curator.id)}
                  onDragLeave={() => setDropRow(null)}
                  onDrop={(e) => onTeamRowDrop(e, curator.id)}
                >
                  <Avatar curator={curator} size="lg" />
                  <div className="team-row-stack">
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span className="name">{curator.name}</span>
                      <span className="count">{count}</span>
                    </div>
                    <div className="mini-phase-bar">
                      {segs.map(s => (
                        <span key={s.p} className={'seg ' + s.p} style={{ width: s.pct + '%' }} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </aside>
        )}
      </div>

      {/* Call-date prompt modal */}
      {callPrompt && (
        <CallDatePrompt
          lang={lang}
          defaultDate={callPrompt.defaultDate}
          onCancel={() => setCallPrompt(null)}
          onConfirm={confirmCallPrompt}
        />
      )}

      {err && !loading && (
        <div style={{
          position: 'fixed', bottom: 16, left: 16,
          background: 'white', border: '1px solid var(--line)',
          borderRadius: 8, padding: '8px 12px', fontSize: 11,
          color: 'var(--ink-3)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
        }}>
          {lang === 'zh' ? '使用演示数据' : 'Showing demo data'}
        </div>
      )}
    </div>
  );
}

// ─── Supplier groups ───────────────────────────────────────────────────

function SupplierGroupsView({ items, lang, phaseOf, onOpen }) {
  const [openSup, setOpenSup] = useState(null);

  const groups = useMemo(() => {
    const map = new Map();
    items.forEach(it => {
      if (!map.has(it.supplier)) map.set(it.supplier, []);
      map.get(it.supplier).push(it);
    });
    return Array.from(map.entries()).map(([supplier, its]) => {
      const dist = { new: 0, review: 0, disc: 0, final: 0, pub: 0 };
      its.forEach(it => { const p = phaseOf(it); if (dist[p] != null) dist[p]++; });
      const totalCaps = its.reduce((s, it) => s + (10 + hashIdx(it.id + '-c', 6)), 0);
      return { supplier, its, dist, totalCaps };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  if (groups.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', background: 'white', border: '1px dashed var(--line)', borderRadius: 14 }}>
        <p style={{ color: 'var(--ink-2)', margin: 0 }}>{t('s6_empty_groups', lang)}</p>
      </div>
    );
  }

  return (
    <div className="supplier-groups">
      {groups.map(({ supplier, its, dist, totalCaps }) => {
        const total = its.length || 1;
        const isOpen = openSup === supplier;
        return (
          <div key={supplier}>
            <div
              className={'supplier-group-row' + (isOpen ? ' open' : '')}
              onClick={() => setOpenSup(o => o === supplier ? null : supplier)}
            >
              <div className="name">
                <span className="chev">▶</span>
                {supplier}
              </div>
              <div className="meta">
                {t('s6_groups_subs', lang, { n: its.length })} · {t('s6_groups_caps', lang, { n: totalCaps })}
              </div>
              <div className="mini-phase-bar">
                {['new', 'review', 'disc', 'final', 'pub'].map(p => (
                  <span key={p} className={'seg ' + p} style={{ width: (dist[p] / total) * 100 + '%' }} />
                ))}
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink-3)' }}>
                {its.length} {lang === 'zh' ? '条' : 'items'}
              </div>
            </div>
            {isOpen && (
              <div className="supplier-group-children">
                {its.map(it => {
                  const p = phaseOf(it);
                  return (
                    <div key={it.id} className="supplier-group-child">
                      <span className="pid">{it.product || it.id}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.productSub?.[lang] || ''}
                      </span>
                      <span className={'status-badge ' + (p === 'new' ? 'ai' : p === 'review' ? 'weak' : p === 'final' ? 'filled' : p === 'pub' ? 'filled' : 'empty')}>
                        {t('s6_phase_' + p, lang)}
                      </span>
                      <span className="age">{ageLabel(it, lang)}</span>
                      <button className="open-btn" onClick={() => onOpen(it.id)}>{t('s6_open', lang)}</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Call-date prompt ──────────────────────────────────────────────────

function CallDatePrompt({ lang, defaultDate, onCancel, onConfirm }) {
  const [date, setDate] = useState(defaultDate);
  return (
    <div className="cura-modal" onClick={onCancel}>
      <div className="cura-modal-card" onClick={e => e.stopPropagation()}>
        <h3>{t('s6_call_prompt_title', lang)}</h3>
        <p>{t('s6_call_prompt_sub', lang)}</p>
        <input
          type="date"
          value={date}
          autoFocus
          onChange={e => setDate(e.target.value)}
        />
        <div className="cura-modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>{t('s6_call_prompt_cancel', lang)}</button>
          <button className="btn btn-primary" onClick={() => onConfirm(date)} disabled={!date}>
            {t('s6_call_prompt_save', lang)}
          </button>
        </div>
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
      await curator.publishAll(submissionId);
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
