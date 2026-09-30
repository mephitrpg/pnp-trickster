import { appStore, configureTranslations, tr } from "./app-core.js";
import { homePage } from "./home/index.js";
import homeEn from "./home/lang/en.js";
import homeIt from "./home/lang/it.js";
import { bookletTool } from "./tools/pdf-booklet/index.js";
import { spritesTool } from "./tools/sprites-printer/index.js";
import { withLoading } from "./tools/loading-overlay.js";

const tools = [bookletTool, spritesTool];
// Transitional aliases for tool internals that still call these helpers while mounting.
window.appStore = appStore;
window.tr = tr;
const routeIds = ["home", ...tools.map((tool) => tool.id)];
const locales = { "it-IT": "it", "en-GB": "en" };
const SIDEBAR_STATE_KEY = "pnp-trickster-sidebar-collapsed";
const isSidebarCollapsed = () => window.localStorage.getItem(SIDEBAR_STATE_KEY) === "true";
const sharedTranslations = {
  it: { home: "Home", tools: "Strumenti", ready: "Pronto a creare", reset: "Reinizializza strumento", resetConfirm: "Vuoi eliminare i dati salvati per questo strumento?", sidebarTools: "Strumenti", sidebarLanguage: "Lingua", expandSidebar: "Espandi barra laterale", collapseSidebar: "Comprimi barra laterale", processing: "Elaborazione in corso…" },
  en: { home: "Home", tools: "Tools", ready: "Ready to create", reset: "Reset tool", resetConfirm: "Delete the data saved for this tool?", sidebarTools: "Tools", sidebarLanguage: "Language", expandSidebar: "Expand sidebar", collapseSidebar: "Collapse sidebar", processing: "Processing…" }
};
const homeTranslations = { en: homeEn, it: homeIt };
const stateFromHash = () => {
  const [nextLocale, route] = window.location.hash.slice(1).split("/");
  return { locale: locales[nextLocale] ? nextLocale : "en-GB", route: routeIds.includes(route) ? route : "home" };
};
if (!window.location.hash || !locales[window.location.hash.slice(1).split("/")[0]]) window.history.replaceState(null, "", "#en-GB/home");
let { locale, route: activeToolId } = stateFromHash();
let language = locales[locale];
const setRoute = (route, nextLocale = locale) => { window.location.hash = `${nextLocale}/${route}`; };

function render() {
  const activeTool = tools.find((tool) => tool.id === activeToolId);
  configureTranslations(language, activeTool?.translations || homeTranslations, sharedTranslations);
  document.documentElement.lang = language;
  document.querySelector("#app").innerHTML = `
    <div class="shell${isSidebarCollapsed() ? " sidebar-is-collapsed" : ""}">
      <aside class="sidebar" aria-label="${tr("sidebarTools")}">
        <div class="sidebar-header">
          <a class="brand" href="#${locale}/home" data-home aria-label="Trickster home"><span class="brand-mark"><img src="assets/trickster-icon.png" alt="" /></span><span>PnP Trickster</span></a>
          <div class="sidebar-actions"><div class="language-switcher" aria-label="${tr("sidebarLanguage")}"><button type="button" class="${language === "it" ? "is-active" : ""}" data-language="it" aria-pressed="${language === "it"}">IT</button><button type="button" class="${language === "en" ? "is-active" : ""}" data-language="en" aria-pressed="${language === "en"}">EN</button></div><button class="sidebar-toggle" type="button" data-sidebar-toggle aria-label="${isSidebarCollapsed() ? tr("expandSidebar") : tr("collapseSidebar")}" aria-expanded="${!isSidebarCollapsed()}"><span aria-hidden="true">☰</span></button></div>
        </div>
        <p class="sidebar-label">${tr("tools")}</p>
        <nav class="tool-nav" aria-label="${tr("sidebarTools")}">
          <button class="tool-link ${activeToolId === "home" ? "is-active" : ""}" data-home><span class="tool-icon">⌂</span><span>${tr("home")}</span></button>
          ${tools.map((tool) => `<button class="tool-link ${tool.id === activeToolId ? "is-active" : ""}" data-tool-id="${tool.id}"><span class="tool-icon">${tool.icon}</span><span>${tool.name}</span></button>`).join("")}
        </nav>
        <div class="sidebar-footer"><span class="status-dot"></span> ${tr("ready")}</div>
      </aside>
      <main class="workspace">${activeTool ? activeTool.render() : homePage()}</main>
    </div>`;
  document.querySelectorAll("[data-tool-id]").forEach((button) => button.addEventListener("click", () => setRoute(button.dataset.toolId)));
  document.querySelectorAll("[data-home]").forEach((element) => element.addEventListener("click", (event) => { event.preventDefault(); window.location.hash === `#${locale}/home` ? render() : setRoute("home"); }));
  document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => setRoute(activeToolId, button.dataset.language === "it" ? "it-IT" : "en-GB")));
  document.querySelector("[data-sidebar-toggle]").addEventListener("click", () => { window.localStorage.setItem(SIDEBAR_STATE_KEY, String(!isSidebarCollapsed())); render(); });
  const mounting = activeTool?.mount?.(document.querySelector(".workspace"));
  if (mounting && typeof mounting.then === "function") withLoading(() => mounting);
}

window.addEventListener("hashchange", () => { ({ locale, route: activeToolId } = stateFromHash()); language = locales[locale]; render(); });
render();
