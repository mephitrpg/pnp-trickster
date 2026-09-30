import { PDFDocument } from "../../vendor/pdf-lib.esm.min.js";
import { appStore, tr } from "../../app-core.js";
import { withLoading } from "../loading-overlay.js";
import en from "./lang/en.js";
import it from "./lang/it.js";

const bookletTranslations = { en, it };

const downloadPdf = (bytes, filename) => {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
};

async function splitPagesInHalf(file) {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const output = await PDFDocument.create();

  for (const page of source.getPages()) {
    const { width, height } = page.getSize();
    const left = await output.embedPage(page, { left: 0, bottom: 0, right: width / 2, top: height });
    const right = await output.embedPage(page, { left: width / 2, bottom: 0, right: width, top: height });
    output.addPage([width / 2, height]).drawPage(left, { width: width / 2, height });
    output.addPage([width / 2, height]).drawPage(right, { width: width / 2, height });
  }

  return output.save();
}

async function joinPagesSideBySide(file) {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const output = await PDFDocument.create();
  const pages = source.getPages();

  for (let index = 0; index < pages.length; index += 2) {
    const first = pages[index];
    const second = pages[index + 1];
    const { width, height } = first.getSize();
    const joined = output.addPage([width * 2, height]);
    joined.drawPage(await output.embedPage(first), { x: 0, y: 0, width, height });
    if (second) {
      const secondSize = second.getSize();
      const scale = Math.min(width / secondSize.width, height / secondSize.height);
      joined.drawPage(await output.embedPage(second), {
        x: width + (width - secondSize.width * scale) / 2,
        y: (height - secondSize.height * scale) / 2,
        width: secondSize.width * scale,
        height: secondSize.height * scale
      });
    }
  }

  return output.save();
}

export const bookletTool = {
  id: "pdf-booklet",
  name: "PDF Booklet",
  translations: bookletTranslations,
  icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.3C9.85 4.45 7.52 4.1 4 4.1v13.25c3.52 0 5.85.35 8 2.2m0-13.25c2.15-1.85 4.48-2.2 8-2.2v13.25c-3.52 0-5.85.35-8 2.2V6.3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 8.15c1.15.08 2.06.3 3 .76m-3 3.05c1.15.08 2.06.3 3 .76m3-4.57c.94-.46 1.85-.68 3-.76m-3 5.33c.94-.46 1.85-.68 3-.76" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/></svg>`,
  render: () => `
    <section class="tool-page pdf-booklet-page">
      <p class="eyebrow">${window.tr("bookletEyebrow")}</p>
      <h1>PDF Booklet</h1>
      <p class="lede">${window.tr("bookletLede")}</p>
      <div class="panel">
        <div class="drop-zone" data-drop-zone>
          <div>
            <div class="upload-icon">↥</div>
            <h2>${window.tr("dropPdf")}</h2>
            <p>${window.tr("orChoose")}</p>
            <button class="browse-button" type="button" data-file-picker>${window.tr("choosePdf")}</button>
            <p class="file-note" data-file-name>${window.tr("pdfNote")}</p>
            <input data-file-input type="file" accept="application/pdf" hidden />
          </div>
        </div>
        <div class="options">
          <div class="option"><span>${window.tr("paper")}</span><strong>A4</strong></div>
          <div class="option"><span>${window.tr("layout")}</span><strong>${window.tr("twoPages")}</strong></div>
          <div class="option"><span>${window.tr("binding")}</span><strong>${window.tr("shortEdge")}</strong></div>
        </div>
        <div class="pdf-actions" hidden data-pdf-actions>
          <button class="action-button" type="button" data-split>${window.tr("split")}</button>
          <button class="action-button secondary" type="button" data-join>${window.tr("join")}</button>
          <button class="reset-button" type="button" data-reset-tool>${window.tr("reset")}</button>
        </div>
        <div class="empty-preview" data-pdf-status>${window.tr("uploadPreview")}</div>
      </div>
    </section>`,
  mount: async (root) => {
    const input = root.querySelector("[data-file-input]");
    const zone = root.querySelector("[data-drop-zone]");
    const status = root.querySelector("[data-pdf-status]");
    const actions = root.querySelector("[data-pdf-actions]");
    let selectedFile;
    const persist = () => window.appStore.set("pdf-booklet", selectedFile ? { file: selectedFile } : null).catch((error) => console.warn("Unable to save PDF", error));
    const update = (file) => {
      if (!file || file.type !== "application/pdf") return;
      selectedFile = file;
      root.querySelector("[data-file-name]").textContent = file.name;
      status.textContent = window.tr("chooseTransform");
      actions.hidden = false;
      persist();
    };
    const process = async (operation, suffix) => {
      if (!selectedFile) return;
      const buttons = actions.querySelectorAll("button");
      buttons.forEach((button) => { button.disabled = true; });
      status.textContent = window.tr("preparing");
      try {
        const bytes = await withLoading(() => operation(selectedFile));
        downloadPdf(bytes, `${selectedFile.name.replace(/\.pdf$/i, "")}-${suffix}.pdf`);
        status.textContent = window.tr("downloaded");
      } catch (error) {
        console.error(error);
        status.textContent = window.tr("pdfError");
      } finally {
        buttons.forEach((button) => { button.disabled = false; });
      }
    };
    root.querySelector("[data-file-picker]").addEventListener("click", () => input.click());
    input.addEventListener("change", () => update(input.files[0]));
    ["dragenter", "dragover"].forEach((event) => zone.addEventListener(event, (e) => { e.preventDefault(); zone.classList.add("dragging"); }));
    ["dragleave", "drop"].forEach((event) => zone.addEventListener(event, (e) => { e.preventDefault(); zone.classList.remove("dragging"); }));
    zone.addEventListener("drop", (e) => update(e.dataTransfer.files[0]));
    root.querySelector("[data-split]").addEventListener("click", () => process(splitPagesInHalf, "split"));
    root.querySelector("[data-join]").addEventListener("click", () => process(joinPagesSideBySide, "joined"));
    root.querySelector("[data-reset-tool]").addEventListener("click", async () => {
      if (!window.confirm(window.tr("resetConfirm"))) return;
      await window.appStore.set("pdf-booklet", null);
      selectedFile = undefined;
      input.value = "";
      root.querySelector("[data-file-name]").textContent = window.tr("pdfNote");
      status.textContent = window.tr("uploadPreview");
      actions.hidden = true;
    });
    await window.appStore.get("pdf-booklet").then((saved) => {
      if (saved?.file) update(saved.file);
    }).catch((error) => console.warn("Unable to restore PDF", error));
  }
};
