import { createContext, useContext, useMemo, type ReactNode } from "react";
import { locales, translate, type Locale, type Route, type Translator } from "./localization";

type LocalizationContextValue = { locale: Locale; language: "en" | "it"; route: Route; t: Translator };
const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export function LocalizationProvider({ locale, route, children }: { locale: Locale; route: Route; children: ReactNode }) {
  const value = useMemo(() => ({
    locale,
    language: locales[locale],
    route,
    t: (key: string, values?: Record<string, string | number>) => translate(locale, route, key, values)
  }), [locale, route]);
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error("LocalizationProvider is missing");
  return context;
}
