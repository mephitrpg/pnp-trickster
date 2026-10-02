import { lazy, Suspense, useEffect, useState } from "react";
import Home from "./home/Home";
import { LocalizationProvider, useLocalization } from "./LocalizationProvider";
import { locales, normalizeLocation, setActiveLocalization, type Locale, type Location, type Route } from "./localization";

const PdfBooklet = lazy(() => import("./tools/PdfBooklet/PdfBooklet"));
const CardPrinter = lazy(() => import("./tools/CardPrinter/CardPrinter"));

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;
const SIDEBAR_STATE_KEY = "pnp-trickster-sidebar-collapsed";
function readLocation() {
  const location = normalizeLocation(window.location.hash);
  const canonical = `#${location.locale}/${location.route}`;
  if (window.location.hash !== canonical) window.history.replaceState(null, "", canonical);
  return location;
}

function CardIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg>;
}

function Workspace({ route, locale }: { route: Route; locale: Locale }) {
  const { t } = useLocalization();
  return <Suspense fallback={<div className="tool-page" role="status">{t("processing")}</div>}>
    {route === "pdf-booklet" ? <PdfBooklet />
      : route === "card-printer" ? <CardPrinter key={locale} /> : <Home />}
  </Suspense>;
}

function Shell({ location, onNavigate }: { location: Location; onNavigate: (route: Route, locale?: Locale) => void }) {
  const { locale, route, language, t } = useLocalization();
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem(SIDEBAR_STATE_KEY) === "true"; }
    catch { return false; }
  });
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    try { window.localStorage.setItem(SIDEBAR_STATE_KEY, String(next)); } catch { /* Browser storage may be unavailable. */ }
  }
  return <div className={`shell${collapsed ? " sidebar-is-collapsed" : ""}`}>
    <aside className="sidebar" aria-label={t("sidebarTools")}>
      <div className="sidebar-header">
        <a className="brand" href={`#${locale}/home`} aria-label={t("brandHome")}
          onClick={() => onNavigate("home")}>
          <span className="brand-mark"><img src={asset("trickster-icon.png")} alt="" /></span>
          <span>PnP Trickster</span>
        </a>
        <div className="sidebar-actions">
          <div className="language-switcher" aria-label={t("sidebarLanguage")}>
            <button type="button" className={language === "it" ? "is-active" : ""}
              aria-pressed={language === "it"} onClick={() => onNavigate(route, "it-IT")}>IT</button>
            <button type="button" className={language === "en" ? "is-active" : ""}
              aria-pressed={language === "en"} onClick={() => onNavigate(route, "en-GB")}>EN</button>
          </div>
          <button className="sidebar-toggle" type="button" onClick={toggleSidebar}
            aria-label={t(collapsed ? "expandSidebar" : "collapseSidebar")}
            aria-expanded={!collapsed}><span aria-hidden="true">☰</span></button>
        </div>
      </div>
      <p className="sidebar-label">{t("tools")}</p>
      <nav className="tool-nav" aria-label={t("sidebarTools")}>
        <button type="button" className={`tool-link${route === "home" ? " is-active" : ""}`}
          onClick={() => onNavigate("home")}><span className="tool-icon">⌂</span><span>{t("home")}</span></button>
        <button type="button" className={`tool-link${route === "card-printer" ? " is-active" : ""}`}
          onClick={() => onNavigate("card-printer")}><span className="tool-icon"><CardIcon /></span><span>{t("cardPrinter")}</span></button>
      </nav>
      <div className="sidebar-footer"><span className="status-dot" /> {t("ready")}</div>
    </aside>
    <main className="workspace"><Workspace route={location.route} locale={location.locale} /></main>
  </div>;
}

export default function App() {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const onHashChange = () => setLocation(readLocation());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  setActiveLocalization(location);
  document.documentElement.lang = locales[location.locale];
  function navigate(route: Route, locale: Locale = location.locale) {
    const next = `#${locale}/${route}`;
    if (window.location.hash !== next) window.location.hash = next;
  }
  return <LocalizationProvider locale={location.locale} route={location.route}>
    <Shell location={location} onNavigate={navigate} />
  </LocalizationProvider>;
}
