(() => {
  const scriptUrl = document.currentScript?.src || window.location.href;
  const pdfjsModuleUrl = new URL("../vendor/pdfjs/pdf.mjs", scriptUrl).href;
  const pdfjsWorkerUrl = new URL("../vendor/pdfjs/pdf.worker.mjs", scriptUrl).href;
  const strings = () => document.documentElement.lang === "it" ? {
    label: "Anteprima PDF", title: "Il tuo foglio stampabile", close: "Chiudi anteprima", print: "Stampa", download: "Scarica PDF", page: "Pagina", error: "Non è stato possibile creare l’anteprima PDF. Riprova."
  } : {
    label: "PDF preview", title: "Your printable sheet", close: "Close preview", print: "Print", download: "Download PDF", page: "Page", error: "The PDF preview could not be created. Please try again."
  };

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
  const pdfjsReady = Promise.all([loadJavaScript(pdfjsModuleUrl), loadJavaScript(pdfjsWorkerUrl)]).then(async ([moduleUrl, workerUrl]) => {
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
  const showPreview = async (pdfBytes, filename = "carte-da-gioco.pdf") => {
    const text = strings();
    const modal = document.createElement("div");
    modal.className = "pdf-preview-modal";
    modal.innerHTML = `<div class="pdf-preview-dialog" role="dialog" aria-modal="true" aria-label="${text.label}"><header><div><p>${text.label}</p><h2>${text.title}</h2></div><button class="pdf-preview-close" type="button" aria-label="${text.close}">×</button></header><div class="pdf-preview-pages" data-pdf-pages></div><footer><button class="action-button secondary" type="button" data-close-preview>${text.close}</button><button class="action-button secondary" type="button" data-print-preview>${text.print}</button><button class="action-button" type="button" data-download-preview>${text.download}</button></footer></div>`;
    modal.addEventListener("click", (event) => { if (event.target === modal || event.target.closest(".pdf-preview-close, [data-close-preview]")) closePreview(modal); });
    document.body.append(modal);
    try {
      const runWithLoader = window.withLoading || (async (task) => task());
      await runWithLoader(async () => {
      const bytes = pdfBytes instanceof ArrayBuffer
        ? pdfBytes
        : pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
      activeUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const pdfjs = await pdfjsReady;
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
        figure.innerHTML = `<figcaption>${text.page} ${number}</figcaption>`;
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
      modal.querySelector(".pdf-preview-close").focus();
      });
    } catch (error) {
      console.error("Unable to preview PDF", error);
      closePreview(modal);
      modal.remove();
      window.alert(text.error);
    }
  };

  window.showPdfPreview = showPreview;

  const updateToolbar = () => {
    const previewButton = document.querySelector(".sprites-page [data-download-pdf]");
    const resetButton = document.querySelector(".sprites-page [data-reset-tool]");
    const label = document.documentElement.lang === "it" ? "Anteprima PDF" : "Preview PDF";
    // Setting textContent replaces its text node, even when the label is unchanged.
    // Only write when needed so this observer cannot trigger itself indefinitely.
    if (previewButton && previewButton.textContent !== label) previewButton.textContent = label;
    if (resetButton && resetButton.className !== "action-button secondary") resetButton.className = "action-button secondary";
  };
  new MutationObserver(updateToolbar).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") document.querySelectorAll(".pdf-preview-modal:not([hidden])").forEach(closePreview); });
  updateToolbar();
})();
