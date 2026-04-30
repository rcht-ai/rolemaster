// Shared chrome: app header, screen picker, language switcher, stepper.

import { t } from './i18n.js';
import { SUPPLIER } from './data.js';

export const SCREENS = [
  { id: "register", num: 1, side: "supplier", labelKey: "nav_register" },
  { id: "onboard",  num: 2, side: "supplier", labelKey: "nav_onboard" },
  { id: "multi",    num: 3, side: "supplier", labelKey: "nav_multi" },
  { id: "form",     num: 4, side: "supplier", labelKey: "nav_form" },
  { id: "confirm",  num: 5, side: "supplier", labelKey: "nav_confirm" },
  { id: "thanks",   num: 5, side: "supplier", labelKey: "nav_thanks", suffix: "b" },
  { id: "queue",    num: 6, side: "curator",  labelKey: "nav_queue" },
  { id: "workbench",num: 7, side: "curator",  labelKey: "nav_workbench" },
  { id: "publish",  num: 8, side: "curator",  labelKey: "nav_publish" },
  { id: "saleslogin", num: 9, side: "sales",  labelKey: "s9_title" },
  { id: "catalog",    num: 10, side: "sales", labelKey: "s10_title" },
  { id: "rolepack",   num: 11, side: "sales", labelKey: "nav_rolepack" },
];

export function LangSwitcher({ lang, setLang }) {
  return (
    <button
      className="lang-switch"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      title={lang === "zh" ? "Switch to English" : "切换到中文"}
    >
      {lang === "zh" ? "EN" : "中文"}
    </button>
  );
}

export function BrandMark({ size = 22 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size, fontSize: size * 0.6 }}>
      R
    </span>
  );
}

export function PlatformPill({ platform, lang }) {
  const labels = {
    supplier: { zh: "供应商", en: "Supplier" },
    curator:  { zh: "策展人", en: "Curator" },
    sales:    { zh: "销售",   en: "Sales" },
  };
  return (
    <span className="platform-pill">
      <span className="dot" />
      <span className="label">{labels[platform][lang]}</span>
    </span>
  );
}

export function PlatformHeader({ platform, lang, setLang, right, nav, contextLabel, onLogout }) {
  return (
    <header className={"app-header platform-header-" + platform}>
      <div className="brand">
        <BrandMark />
        RoleMaster
      </div>
      <PlatformPill platform={platform} lang={lang} />
      {contextLabel && (
        <span className="supplier-name" style={{ marginLeft: 0 }}>· {contextLabel}</span>
      )}
      {nav && <nav style={{ display: "flex", gap: 4, marginLeft: 16 }}>{nav}</nav>}
      <div style={{ flex: 1 }} />
      <div className="header-right">
        {right}
        {onLogout && (
          <button className="btn-ghost" onClick={onLogout}
            style={{ padding: "5px 10px", fontSize: 12, color: "var(--ink-2)" }}>
            {lang === "zh" ? "退出" : "Sign out"}
          </button>
        )}
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
    </header>
  );
}

export function AppHeader({ lang, setLang, productLabel, savedAt, progress, supplierName, onLogout }) {
  const right = (
    <>
      {typeof progress === "number" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{t("progress_overall", lang)}</span>
          <div style={{ width: 80, height: 5, background: "var(--bg-2)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--plat-supplier)", transition: "width 0.4s ease" }} />
          </div>
          <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink)", fontWeight: 600, fontSize: 12 }}>{progress}%</span>
        </div>
      )}
      {savedAt && (
        <div className="save-status" style={{ fontSize: 12, color: "var(--ink-3)" }}>
          <span className="save-dot" />
          {t("save_state_saved", lang, { time: savedAt })}
        </div>
      )}
    </>
  );
  return (
    <PlatformHeader
      platform="supplier"
      lang={lang} setLang={setLang}
      contextLabel={productLabel || supplierName || SUPPLIER.shortName}
      right={right}
      onLogout={onLogout}
    />
  );
}

export function CuratorHeader({ lang, setLang, activeTab = "subs", curatorName, onLogout }) {
  const nav = (
    <>
      <button className={"nav-link " + (activeTab === "subs" ? "active" : "")}>
        {t("s6_nav_subs", lang)}
      </button>
    </>
  );
  const right = (
    <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
      {lang === "zh" ? `审阅员:${curatorName ?? ""}` : `Curator: ${curatorName ?? ""}`}
    </span>
  );
  return (
    <PlatformHeader platform="curator" lang={lang} setLang={setLang} nav={nav} right={right} onLogout={onLogout} />
  );
}

export function ScreenPicker({ screen, setScreen, lang }) {
  const supplier = SCREENS.filter(s => s.side === "supplier");
  const curator = SCREENS.filter(s => s.side === "curator");
  const sales = SCREENS.filter(s => s.side === "sales");

  const labelFor = (s) => {
    if (s.id === "saleslogin") return lang === "zh" ? "登录" : "Login";
    if (s.id === "catalog") return lang === "zh" ? "目录" : "Catalog";
    if (s.id === "rolepack") return lang === "zh" ? "RolePack" : "RolePack";
    return t(s.labelKey, lang);
  };

  const renderGroup = (list, side) => list.map(s => (
    <button key={s.id} className={screen === s.id ? "active " + side : ""} onClick={() => setScreen(s.id)}>
      <span className="step-num">{s.num}{s.suffix || ""}</span>
      {side === "sales" ? labelFor(s) : t(s.labelKey, lang)}
    </button>
  ));

  return (
    <div className="screen-picker" role="navigation">
      <div className="group-label">{lang === "zh" ? "供应商" : "Supplier"}</div>
      {renderGroup(supplier, "supplier")}
      <div className="divider" />
      <div className="group-label">{lang === "zh" ? "策展人" : "Curator"}</div>
      {renderGroup(curator, "curator")}
      <div className="divider" />
      <div className="group-label">{lang === "zh" ? "销售" : "Sales"}</div>
      {renderGroup(sales, "sales")}
    </div>
  );
}

export function ProcessStepper({ steps, currentScreen, onJump }) {
  const currentIdx = steps.findIndex(
    s => s.screenId === currentScreen || (Array.isArray(s.screenIds) && s.screenIds.includes(currentScreen))
  );
  return (
    <div className="proc-stepper">
      <div className="proc-stepper-inner">
        {steps.map((s, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "pending";
          const clickable = !!onJump && (state === "done" || state === "current");
          const Tag = clickable ? "button" : "div";
          return (
            <Tag key={s.id}
              className={"proc-step " + state + (clickable ? " clickable" : "")}
              onClick={clickable ? () => onJump(s.screenId) : undefined}>
              <div className="proc-step-dot-wrap">
                <span className="proc-dot">{state === "done" ? "✓" : i + 1}</span>
              </div>
              <span className="proc-step-label">{s.label}</span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

export function getPlatformSteps(platform, lang) {
  if (platform === "supplier") {
    return [
      { id: "register", label: lang === "zh" ? "注册" : "Register", screenId: "register" },
      { id: "upload", label: lang === "zh" ? "上传材料" : "Upload", screenId: "onboard" },
      { id: "identify", label: lang === "zh" ? "产品识别" : "Identify", screenId: "multi" },
      { id: "form", label: lang === "zh" ? "填写表单" : "Fill form", screenId: "form" },
      { id: "submit", label: lang === "zh" ? "提交确认" : "Submit", screenIds: ["confirm", "thanks"], screenId: "confirm" },
    ];
  }
  if (platform === "curator") {
    return [
      { id: "inbox", label: lang === "zh" ? "审阅队列" : "Inbox", screenId: "queue" },
      { id: "review", label: lang === "zh" ? "策展审核" : "Review", screenId: "workbench" },
      { id: "publish", label: lang === "zh" ? "发布上线" : "Publish", screenId: "publish" },
    ];
  }
  if (platform === "sales") {
    return [
      { id: "login", label: lang === "zh" ? "登录" : "Sign in", screenId: "saleslogin" },
      { id: "browse", label: lang === "zh" ? "浏览目录" : "Browse catalog", screenId: "catalog" },
      { id: "view", label: lang === "zh" ? "查看 RolePack" : "View RolePack", screenId: "rolepack" },
    ];
  }
  return [];
}
