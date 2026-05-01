// RoleMaster — three role-separated portals: supplier / curator / sales.
// No shared screen-picker dock. Each portal has its own entry, login, and home.

import { useEffect, useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation, Navigate, Link } from 'react-router-dom';
import { ProcessStepper, getPlatformSteps } from './chrome.jsx';
import { ScreenLanding } from './screens/landing.jsx';
import { ScreenPortalLogin } from './screens/portal-login.jsx';
import { ScreenSupplierHome } from './screens/supplier-home.jsx';
import { ScreenRegister, ScreenOnboard, ScreenMulti } from './screens/onboard.jsx';
import { ScreenForm } from './screens/form.jsx';
import { ScreenConfirm, ScreenThanks, ScreenQueue, ScreenPublish } from './screens/other.jsx';
import { ScreenWorkbench } from './screens/workbench.jsx';
import { AssetGenerationOverlay, ScreenCatalog, ScreenRolepackDetail } from './screens/sales.jsx';
import { TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakSelect, TweakToggle, useTweaks } from './tweaks.jsx';
import { AuthProvider, useAuth } from './auth.jsx';

const TWEAK_DEFAULTS = {
  supplierColor: '#6FA577',
  curatorColor: '#8E7AB5',
  salesColor: '#6E9CC9',
  density: 'normal',
  warmth: 'neutral',
  roundness: 'soft',
  font: 'inter',
  showStepper: true,
};

function tint(hex, amt) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const m = (c) => Math.round(c + (255 - c) * amt);
  const x = (n) => n.toString(16).padStart(2, '0');
  return '#' + x(m(r)) + x(m(g)) + x(m(b));
}
function shade(hex, amt) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const m = (c) => Math.round(c * (1 - amt));
  const x = (n) => n.toString(16).padStart(2, '0');
  return '#' + x(m(r)) + x(m(g)) + x(m(b));
}

// Map a route to (platform, screenId, showStepper).
// Stepper appears only on workflow steps — not on dashboards or login pages.
function routeMeta(pathname) {
  // Supplier intake flow
  if (pathname === '/supplier/register')              return { platform: 'supplier', screen: 'register', stepper: true, requiresAuth: false };
  if (/^\/supplier\/new\/[^/]+\/upload$/.test(pathname))   return { platform: 'supplier', screen: 'onboard',  stepper: true, requiresAuth: 'supplier' };
  if (/^\/supplier\/new\/[^/]+\/identify$/.test(pathname)) return { platform: 'supplier', screen: 'multi',    stepper: true, requiresAuth: 'supplier' };
  if (pathname.startsWith('/supplier/form/'))         return { platform: 'supplier', screen: 'form',     stepper: true, requiresAuth: 'supplier' };
  if (pathname.startsWith('/supplier/confirm/'))      return { platform: 'supplier', screen: 'confirm',  stepper: true, requiresAuth: 'supplier' };
  if (pathname.startsWith('/supplier/thanks/'))       return { platform: 'supplier', screen: 'thanks',   stepper: true, requiresAuth: 'supplier' };
  // Supplier dashboard (or portal-login when logged out)
  if (pathname === '/supplier')                        return { platform: 'supplier', screen: null,      stepper: false, requiresAuth: false };
  // Curator
  if (pathname === '/curator')                         return { platform: 'curator', screen: 'queue',     stepper: true, requiresAuth: false };
  if (pathname.startsWith('/curator/workbench/'))      return { platform: 'curator', screen: 'workbench', stepper: true, requiresAuth: 'curator' };
  if (pathname.startsWith('/curator/publish/'))        return { platform: 'curator', screen: 'publish',   stepper: true, requiresAuth: 'curator' };
  // Sales
  if (pathname === '/sales')                           return { platform: 'sales', screen: null, stepper: false, requiresAuth: false };
  if (pathname.startsWith('/sales/rolepack/'))         return { platform: 'sales', screen: null, stepper: false, requiresAuth: 'sales' };
  // Public
  return { platform: null, screen: null, stepper: false, requiresAuth: false };
}

function AppShell() {
  const [lang, setLang] = useState('zh');
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Apply CSS variables for the platform theme.
  useEffect(() => {
    const root = document.documentElement;
    const sup = tweaks.supplierColor || '#6FA577';
    const cur = tweaks.curatorColor || '#8E7AB5';
    const sal = tweaks.salesColor || '#6E9CC9';
    root.style.setProperty('--plat-supplier', sup);
    root.style.setProperty('--plat-supplier-2', shade(sup, 0.18));
    root.style.setProperty('--plat-supplier-tint', tint(sup, 0.92));
    root.style.setProperty('--plat-curator', cur);
    root.style.setProperty('--plat-curator-2', shade(cur, 0.18));
    root.style.setProperty('--plat-curator-tint', tint(cur, 0.92));
    root.style.setProperty('--plat-sales', sal);
    root.style.setProperty('--plat-sales-2', shade(sal, 0.18));
    root.style.setProperty('--plat-sales-tint', tint(sal, 0.92));

    document.body.className = [
      'density-' + (tweaks.density || 'normal'),
      'warm-' + (tweaks.warmth || 'neutral'),
      'round-' + (tweaks.roundness || 'soft'),
      tweaks.showStepper ? '' : 'no-stepper',
    ].filter(Boolean).join(' ');

    const fonts = {
      inter: '"Inter", "Noto Sans SC", system-ui, sans-serif',
      ibm: '"IBM Plex Sans", "Noto Sans SC", system-ui, sans-serif',
      serif: '"Source Serif 4", "Noto Sans SC", Georgia, serif',
      system: 'system-ui, -apple-system, "Noto Sans SC", sans-serif',
    };
    root.style.setProperty('--font-sans', fonts[tweaks.font] || fonts.inter);
  }, [tweaks]);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const meta = routeMeta(location.pathname);
  const stepperVisible = tweaks.showStepper && meta.stepper && (
    !meta.requiresAuth || (user && user.role === meta.requiresAuth)
  );
  const steps = meta.platform ? getPlatformSteps(meta.platform, lang) : [];

  const jumpToStep = (sid) => {
    const route = {
      register: '/supplier/register',
      onboard: '/supplier/new/upload',
      multi: '/supplier/new/identify',
      form: '/supplier',  // pick an existing draft from the dashboard
      confirm: '/supplier',
      thanks: '/supplier',
      queue: '/curator',
      workbench: '/curator',
      publish: '/curator',
    }[sid];
    if (route) navigate(route);
  };

  return (
    <>
      <div className={meta.platform ? 'platform-' + meta.platform : ''}>
        {stepperVisible && (
          <ProcessStepper
            steps={steps}
            currentScreen={meta.screen}
            onJump={jumpToStep}
          />
        )}
        <Routes>
          <Route path="/" element={<ScreenLanding lang={lang} setLang={setLang} />} />

          {/* Supplier portal */}
          <Route path="/supplier" element={<SupplierLanding lang={lang} setLang={setLang} />} />
          <Route path="/supplier/register" element={<RegisterRoute lang={lang} setLang={setLang} />} />
          <Route path="/supplier/new/:id/upload" element={<RoleGate role="supplier" portal="/supplier"><UploadRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/new/:id/identify" element={<RoleGate role="supplier" portal="/supplier"><MultiRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/form/:id" element={<RoleGate role="supplier" portal="/supplier"><FormRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/confirm/:id" element={<RoleGate role="supplier" portal="/supplier"><ConfirmRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/thanks/:id" element={<RoleGate role="supplier" portal="/supplier"><ThanksRoute lang={lang} setLang={setLang} /></RoleGate>} />

          {/* Curator portal */}
          <Route path="/curator" element={<CuratorLanding lang={lang} setLang={setLang} />} />
          <Route path="/curator/workbench/:id" element={<RoleGate role="curator" portal="/curator"><WorkbenchRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/curator/publish/:id" element={<RoleGate role="curator" portal="/curator"><PublishRoute lang={lang} setLang={setLang} /></RoleGate>} />

          {/* Sales portal */}
          <Route path="/sales" element={<SalesLanding lang={lang} setLang={setLang} />} />
          <Route path="/sales/rolepack/:id" element={<RoleGate role="sales" portal="/sales"><RolepackRoute lang={lang} setLang={setLang} /></RoleGate>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title={lang === 'zh' ? '平台配色' : 'Platform colors'}>
          <TweakColor label={lang === 'zh' ? '供应商' : 'Supplier'} value={tweaks.supplierColor} onChange={(v) => setTweak('supplierColor', v)} />
          <TweakColor label={lang === 'zh' ? '策展人' : 'Curator'} value={tweaks.curatorColor} onChange={(v) => setTweak('curatorColor', v)} />
          <TweakColor label={lang === 'zh' ? '销售' : 'Sales'} value={tweaks.salesColor} onChange={(v) => setTweak('salesColor', v)} />
        </TweakSection>
        <TweakSection title={lang === 'zh' ? '外观' : 'Appearance'}>
          <TweakRadio label={lang === 'zh' ? '密度' : 'Density'} value={tweaks.density} onChange={(v) => setTweak('density', v)}
            options={[{ value: 'compact', label: lang === 'zh' ? '紧凑' : 'Compact' }, { value: 'normal', label: lang === 'zh' ? '标准' : 'Normal' }, { value: 'comfortable', label: lang === 'zh' ? '宽松' : 'Comfy' }]} />
          <TweakRadio label={lang === 'zh' ? '圆角' : 'Roundness'} value={tweaks.roundness} onChange={(v) => setTweak('roundness', v)}
            options={[{ value: 'sharp', label: lang === 'zh' ? '锐利' : 'Sharp' }, { value: 'soft', label: lang === 'zh' ? '柔和' : 'Soft' }, { value: 'pill', label: lang === 'zh' ? '胶囊' : 'Pill' }]} />
          <TweakSelect label={lang === 'zh' ? '字体' : 'Font'} value={tweaks.font} onChange={(v) => setTweak('font', v)}
            options={[{ value: 'inter', label: 'Inter' }, { value: 'ibm', label: 'IBM Plex Sans' }, { value: 'serif', label: 'Source Serif 4' }, { value: 'system', label: lang === 'zh' ? '系统字体' : 'System UI' }]} />
        </TweakSection>
        <TweakSection title={lang === 'zh' ? '语言' : 'Language'}>
          <TweakRadio label={lang === 'zh' ? '默认语言' : 'Default'} value={lang} onChange={setLang}
            options={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'EN' }]} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// ── Auth gates ────────────────────────────────────

function RoleGate({ role, portal, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user || user.role !== role) return <Navigate to={portal} replace />;
  return children;
}

// ── Per-platform landings (login or dashboard depending on auth) ──

function SupplierLanding({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user) {
    return <ScreenPortalLogin platform="supplier" lang={lang} setLang={setLang}
      onSuccess={() => navigate('/supplier')} />;
  }
  if (user.role !== 'supplier') {
    return <WrongRole expected="supplier" actual={user.role} lang={lang} onLogout={async () => { await logout(); navigate('/'); }} />;
  }
  return <ScreenSupplierHome lang={lang} setLang={setLang} onLogout={async () => { await logout(); navigate('/'); }} />;
}

function CuratorLanding({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user) {
    return <ScreenPortalLogin platform="curator" lang={lang} setLang={setLang}
      onSuccess={() => navigate('/curator')} />;
  }
  if (user.role !== 'curator') {
    return <WrongRole expected="curator" actual={user.role} lang={lang} onLogout={async () => { await logout(); navigate('/'); }} />;
  }
  return <ScreenQueue lang={lang} setLang={setLang}
    curatorName={user.name}
    openSubmission={(id) => navigate(`/curator/workbench/${id}`)}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function SalesLanding({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user) {
    return <ScreenPortalLogin platform="sales" lang={lang} setLang={setLang}
      onSuccess={() => navigate('/sales')} />;
  }
  if (user.role !== 'sales') {
    return <WrongRole expected="sales" actual={user.role} lang={lang} onLogout={async () => { await logout(); navigate('/'); }} />;
  }
  return <ScreenCatalog lang={lang} setLang={setLang}
    openRolepack={(id) => navigate(`/sales/rolepack/${id}`)}
    signOut={async () => { await logout(); navigate('/'); }} />;
}

function WrongRole({ expected, actual, lang, onLogout }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 32, background: 'var(--bg)',
    }}>
      <div style={{
        background: 'white', border: '1px solid var(--line)',
        borderRadius: 14, padding: 40, maxWidth: 480, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--st-empty-bg)', color: 'var(--st-empty-ink)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, marginBottom: 14,
        }}>!</div>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 8px' }}>
          {lang === 'zh' ? '门户不匹配' : 'Wrong portal'}
        </h2>
        <p style={{ color: 'var(--ink-2)', margin: '0 0 18px', fontSize: 14 }}>
          {lang === 'zh'
            ? `你的账号是「${actual}」,但当前门户是「${expected}」。请退出后用对应账号登录。`
            : `You're signed in as "${actual}", but this is the "${expected}" portal. Sign out and use a matching account.`}
        </p>
        <button className="btn btn-primary" onClick={onLogout}>
          {lang === 'zh' ? '退出' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}

// ── Route components ──────────────────────────────

function RegisterRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  useEffect(() => {
    if (user?.role === 'supplier') navigate('/supplier');
  }, [user]);
  return <ScreenRegister lang={lang} setLang={setLang}
    goNext={() => navigate('/supplier/new/upload')} />;
}

function UploadRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { logout } = useAuth();
  return <ScreenOnboard lang={lang} setLang={setLang} submissionId={id}
    goNext={() => navigate(`/supplier/new/${id}/identify`)}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function MultiRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { logout } = useAuth();
  return <ScreenMulti lang={lang} setLang={setLang} submissionId={id}
    goNext={() => navigate(`/supplier/form/${id}`)}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function FormRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { logout, supplier } = useAuth();
  return <ScreenForm lang={lang} setLang={setLang} submissionId={id}
    supplierName={supplier?.short_name ?? supplier?.name}
    goNext={() => navigate(`/supplier/confirm/${id}`)}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function ConfirmRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { id } = useParams();
  return <ScreenConfirm lang={lang} setLang={setLang} submissionId={id}
    goNext={() => navigate(`/supplier/thanks/${id}`)}
    goBack={() => navigate(`/supplier/form/${id}`)} />;
}

function ThanksRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout, supplier } = useAuth();
  return <ScreenThanks lang={lang} setLang={setLang}
    supplierName={supplier?.short_name ?? supplier?.name}
    goNext={() => navigate('/supplier')}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function WorkbenchRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, logout } = useAuth();
  return <ScreenWorkbench lang={lang} setLang={setLang} submissionId={id}
    curatorName={user?.name}
    goNext={() => navigate(`/curator/publish/${id}`)}
    goBack={() => navigate('/curator')}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function PublishRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, logout } = useAuth();
  const [showOverlay, setShowOverlay] = useState(false);
  return (
    <>
      <ScreenPublish lang={lang} setLang={setLang} submissionId={id}
        curatorName={user?.name}
        goBack={() => navigate('/curator')}
        onPublish={() => setShowOverlay(true)}
        onLogout={async () => { await logout(); navigate('/'); }} />
      {showOverlay && (
        <AssetGenerationOverlay
          lang={lang}
          rolepackName={lang === 'zh' ? '产品 RolePack' : 'Product RolePack'}
          onDone={() => { setShowOverlay(false); navigate('/curator'); }}
        />
      )}
    </>
  );
}

function RolepackRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { logout } = useAuth();
  return <ScreenRolepackDetail lang={lang} setLang={setLang} rolepackId={id}
    goBack={() => navigate('/sales')}
    signOut={async () => { await logout(); navigate('/'); }} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
