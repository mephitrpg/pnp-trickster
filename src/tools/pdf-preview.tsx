import { tr } from "../localization.ts";
import { withLoading } from "./loading-overlay.tsx";
import { renderToStaticMarkup } from "react-dom/server";

(() => {
  const pdfjsModuleUrl = new URL(`${import.meta.env.BASE_URL}vendor/pdfjs/pdf.mjs`, window.location.origin).href;
  const pdfjsWorkerUrl = new URL(`${import.meta.env.BASE_URL}vendor/pdfjs/pdf.worker.mjs`, window.location.origin).href;
  const strings = () => ({
    label: tr("pdfPreviewLabel"), title: tr("pdfPreviewTitle"),
    close: tr("pdfPreviewClose"), print: tr("pdfPreviewPrint"),
    download: tr("pdfPreviewDownload"), page: tr("pdfPreviewPage"),
    error: tr("pdfPreviewError")
  });

  // The lightweight local server used by the app serves `.mjs` files as
  // text/plain. Browsers reject those URLs when they are imported directly,
  // even though the source itself is valid JavaScript. Loading the same-origin
  // source first and giving each blob the correct MIME type keeps PDF.js and
  // its module worker usable without requiring a server configuration change.
  const loadJavaScript = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load ${url}: ${response.status}`);
    return URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
  };
  let pdfjsReady;
  const loadPdfJs = () => pdfjsReady ||= Promise.all([loadJavaScript(pdfjsModuleUrl), loadJavaScript(pdfjsWorkerUrl)]).then(async ([moduleUrl, workerUrl]) => {
    const pdfjs = await import(moduleUrl);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  });
  let activeUrl;

  const closePreview = (modal) => {
    modal.hidden = true;
    modal.querySelector("[data-pdf-pages]").replaceChildren();
    if (activeUrl) URL.revokeObjectURL(activeUrl);
    activeUrl = null;
  };
  const showPreview = async (pdfBytes, filename = "document.pdf") => {
    const text = strings();
    const modal = document.createElement("div");
    modal.className = "pdf-preview-modal";
    modal.innerHTML = renderToStaticMarkup(<div className="pdf-preview-dialog" role="dialog" aria-modal="true" aria-label={text.label}>
      <header>
        <div className="pdf-preview-heading"><p>{text.label}</p><h2>{text.title}</h2></div>
        <div className="pdf-preview-actions">
          <button className="action-button secondary" type="button" data-print-preview="">{text.print}</button>
          <button className="action-button" type="button" data-download-preview="">{text.download}</button>
        </div>
        <button className="pdf-preview-close" type="button" aria-label={text.close}>×</button>
      </header>
      <div className="pdf-preview-pages" data-pdf-pages="" />
    </div>);
    modal.addEventListener("click", (event) => { if (event.target === modal || (event.target as Element).closest(".pdf-preview-close")) closePreview(modal); });
    document.body.append(modal);
    try {
      await withLoading(async () => {
      const bytes = pdfBytes instanceof ArrayBuffer
        ? pdfBytes
        : pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
      activeUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const pdfjs = await loadPdfJs();
      const documentProxy = await pdfjs.getDocument({ data: bytes }).promise;
      const pages = modal.querySelector("[data-pdf-pages]");
      for (let number = 1; number <= documentProxy.numPages; number++) {
        const page = await documentProxy.getPage(number);
        const viewport = page.getViewport({ scale: 1.25 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        const figure = document.createElement("figure");
        figure.innerHTML = renderToStaticMarkup(<figcaption>{text.page} {number}</figcaption>);
        figure.prepend(canvas);
        pages.append(figure);
      }
      modal.querySelector("[data-download-preview]").addEventListener("click", () => {
        const anchor = document.createElement("a");
        anchor.href = activeUrl;
        anchor.download = filename;
        anchor.click();
      });
      modal.querySelector("[data-print-preview]").addEventListener("click", () => {
        const frame = document.createElement("iframe");
        frame.hidden = true;
        frame.src = activeUrl;
        frame.addEventListener("load", () => {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
          window.addEventListener("afterprint", () => frame.remove(), { once: true });
        }, { once: true });
        document.body.append(frame);
      });
      modal.querySelector<HTMLElement>(".pdf-preview-close")?.focus();
      });
    } catch (error) {
      console.error("Unable to preview PDF", error);
      closePreview(modal);
      modal.remove();
      window.alert(text.error);
    }
  };

  window.showPdfPreview = showPreview;

  document.addEventListener("keydown", (event) => { if (event.key === "Escape") document.querySelectorAll(".pdf-preview-modal:not([hidden])").forEach(closePreview); });
})();
