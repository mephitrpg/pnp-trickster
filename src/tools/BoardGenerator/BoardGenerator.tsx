import { useEffect, useRef, useState } from "react";
import { useLocalization } from "../../LocalizationProvider.js";
import { translate, type Locale } from "../../localization.js";
import { localizeMarkup } from "./localizeMarkup.js";
import BoardMarkup from "./BoardMarkup.js";
import { initializeBoardGenerator } from "./runtime.js";
import jsPdfUrl from "./vendor/jspdf.umd.min.js?url";

const imageBaseUrl = `${import.meta.env.BASE_URL}board-generator/`;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.body.append(script);
  });
}

export default function BoardGenerator() {
  const { locale, t } = useLocalization();
  const host = useRef<HTMLDivElement>(null);
  const localeRef = useRef<Locale>(locale);
  localeRef.current = locale;
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (host.current) localizeMarkup(host.current, t);
    window.boardGeneratorRefreshStatus?.();
  }, [locale, t]);

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | undefined;
    async function mount() {
      try {
        if (!host.current) return;
        window.boardGeneratorTranslate = (key, values) => translate(localeRef.current, "board-generator", key, values);
        localizeMarkup(host.current, window.boardGeneratorTranslate);
        observer = new MutationObserver(() => {
          if (host.current) localizeMarkup(host.current, window.boardGeneratorTranslate);
        });
        observer.observe(host.current, { childList: true, subtree: true });
        (window as Window & { boardGeneratorBaseUrl?: string }).boardGeneratorBaseUrl = new URL(imageBaseUrl, document.baseURI).href;
        await loadScript(jsPdfUrl);
        if (cancelled) return;
        initializeBoardGenerator();
        if (host.current) localizeMarkup(host.current, window.boardGeneratorTranslate);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    }
    void mount();
    return () => { cancelled = true; observer?.disconnect(); };
  }, []);

  return <div ref={host} className="board-generator" role="region" aria-label={t("boardGenerator")}>
    <BoardMarkup />
    {error && <p role="alert">{error}</p>}
  </div>;
}
