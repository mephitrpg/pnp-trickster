import homeEn from "./pages/Home/lang/en.ts";
import homeIt from "./pages/Home/lang/it.ts";
import bookletEn from "./tools/PdfBooklet/lang/en.ts";
import bookletIt from "./tools/PdfBooklet/lang/it.ts";
import cardsEn from "./tools/CardPrinter/lang/en.ts";
import cardsIt from "./tools/CardPrinter/lang/it.ts";
import boardEn from "./tools/BoardGenerator/lang/en.ts";
import boardIt from "./tools/BoardGenerator/lang/it.ts";

export const locales = { "en-GB": "en", "it-IT": "it" } as const;
export type Locale = keyof typeof locales;
export type Route = "home" | "pdf-booklet" | "card-printer" | "board-generator";
export type Location = { locale: Locale; route: Route };
export type TranslationValues = Record<string, string | number>;
export type Translator = (key: string, values?: TranslationValues) => string;
export const routes: Route[] = ["home", "pdf-booklet", "card-printer", "board-generator"];

const shared: Record<"en" | "it", Record<string, string>> = {
  en: {
    home: "Home", tools: "Tools", tricks: "Tricks", ready: "Ready to create",
    reset: "Reset tool", resetConfirm: "Delete the data saved for this tool?",
    sidebarTools: "Tools", sidebarLanguage: "Language",
    expandSidebar: "Expand sidebar", collapseSidebar: "Collapse sidebar",
    processing: "Processing…", pdfBooklet: "PDF Booklet",
    cardPrinter: "Card Printer", boardGenerator: "Board Generator", brandHome: "Trickster home",
    previewPdf: "Preview PDF", pdfPreviewLabel: "PDF preview",
    pdfPreviewTitle: "Your printable sheet", pdfPreviewClose: "Close preview",
    pdfPreviewPrint: "Print", pdfPreviewDownload: "Download PDF",
    pdfPreviewPage: "Page", pdfPreviewError: "The PDF preview could not be created. Please try again."
  },
  it: {
    home: "Home", tools: "Strumenti", tricks: "Trucchi", ready: "Pronto a creare",
    reset: "Reinizializza strumento", resetConfirm: "Vuoi eliminare i dati salvati per questo strumento?",
    sidebarTools: "Strumenti", sidebarLanguage: "Lingua",
    expandSidebar: "Espandi barra laterale", collapseSidebar: "Comprimi barra laterale",
    processing: "Elaborazione in corso…", pdfBooklet: "PDF Booklet",
    cardPrinter: "Stampa carte", boardGenerator: "Generatore di plance", brandHome: "Pagina iniziale di PnPTrickster",
    previewPdf: "Anteprima PDF", pdfPreviewLabel: "Anteprima PDF",
    pdfPreviewTitle: "Il tuo foglio stampabile", pdfPreviewClose: "Chiudi anteprima",
    pdfPreviewPrint: "Stampa", pdfPreviewDownload: "Scarica PDF",
    pdfPreviewPage: "Pagina", pdfPreviewError: "Non è stato possibile creare l’anteprima PDF. Riprova."
  }
};

const dictionaries: Record<Route, Record<"en" | "it", Record<string, string>>> = {
  home: { en: homeEn, it: homeIt },
  "pdf-booklet": { en: bookletEn, it: bookletIt },
  "card-printer": { en: cardsEn, it: cardsIt },
  "board-generator": { en: boardEn, it: boardIt }
};

export function normalizeLocation(hash: string): Location {
  const [locale, route] = hash.replace(/^#/, "").split("/");
  return {
    locale: locale in locales ? locale as Locale : "en-GB",
    route: routes.includes(route as Route) ? route as Route : "home"
  };
}

export function translate(locale: Locale, route: Route, key: string, values: TranslationValues = {}): string {
  const language = locales[locale] || "en";
  const message = dictionaries[route]?.[language]?.[key]
    ?? shared[language]?.[key]
    ?? dictionaries[route]?.en?.[key]
    ?? shared.en[key]
    ?? key;
  return String(message).replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match);
}

let active: Location = { locale: "en-GB", route: "home" };
export function setActiveLocalization(location: Location) { active = location; }
export function tr(key: string, values?: TranslationValues) { return translate(active.locale, active.route, key, values); }
