import { withLoading } from "../loading-overlay.js";
import { lockPageScroll } from "../scroll-lock.js";
import en from "./lang/en.js?v=2";
import it from "./lang/it.js?v=2";
import { openDetectionEditor } from "./detection-editor.js";
import { readImageDpi } from "./image-dpi.mjs";

const spriteWorker = import("./sprite-worker-client.js?v=2");
const detectionWorker = import("./detection-worker-client.js?v=9");
const spritesTranslations = { en, it };
const loadImage = (file) => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = URL.createObjectURL(file); });
// Image dimensions alone do not describe a physical size. Read the density stored
// by formats that support it, keeping the two axes separate for scanned images.
const imageDpi = readImageDpi;
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,image/tiff,.tif,.tiff,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif";
const TIFF_TYPES = new Set(["image/tiff", "image/tif"]);
const isTiff = (file) => TIFF_TYPES.has(file.type.toLowerCase()) || /\.tiff?$/i.test(file.name);
const isSupportedImage = (file) => file.type.startsWith("image/") || /\.(?:png|jpe?g|webp|gif|bmp|avif|tiff?)$/i.test(file.name);
const tiffToPng = async (file) => {
  if (!window.UTIF) throw new Error("TIFF decoder unavailable");
  const bytes = await file.arrayBuffer(), pages = window.UTIF.decode(bytes);
  if (!pages.length) throw new Error("Invalid TIFF file");
  window.UTIF.decodeImage(bytes, pages[0]);
  const rgba = window.UTIF.toRGBA8(pages[0]), canvas = document.createElement("canvas");
  canvas.width = pages[0].width; canvas.height = pages[0].height;
  canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba), canvas.width, canvas.height), 0, 0);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("TIFF conversion failed")), "image/png"));
  return new File([blob], file.name.replace(/\.tiff?$/i, ".png"), { type: "image/png" });
};
const prepareImageFile = async (file) => isTiff(file) ? tiffToPng(file) : file;
const SPRITE_STORE = "pnp-trickster-sprites";
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const openSpriteStore = () => new Promise((resolve, reject) => { const request = indexedDB.open(SPRITE_STORE, 1); request.onupgradeneeded = () => request.result.createObjectStore("state"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const PAGE_FORMATS = ["4A0", "2A0", "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "B0", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "RA0", "RA1", "RA2", "RA3", "RA4", "SRA0", "SRA1", "SRA2", "SRA3", "SRA4", "Executive", "Folio", "Legal", "Letter", "Tabloid"];
const saveSpriteState = async (state) => { const db = await openSpriteStore(); const transaction = db.transaction("state", "readwrite"); transaction.objectStore("state").put({ mode: state.mode, orientation: state.orientation, pageFormat: state.pageFormat, width: state.width, height: state.height, hideNotPrintable: state.hideNotPrintable, view: state.view, cardOrder: state.cardOrder, sprites: state.sprites.map(({ id, name, fileName, source, dpi, gridNumber, gridType, columns, rows, manualGrid, detectedRects, detectedRegions, detectedTiles, backIndex, backFollowsLast, cards }) => ({ id, name, fileName, source, dpi, gridNumber, gridType, columns, rows, manualGrid, detectedRects, detectedRegions, detectedTiles: detectedTiles?.map((tile) => tile.source), backIndex, backFollowsLast, cards: cards.map(({ backSelected, ...card }) => card) })), backs: state.backs.filter((back) => back?.id && typeof back.kind === "string").map(({ id, name, fileName, kind, spriteId, index, source, cardBack, defaultName, customName, backNumber }) => ({ id, name, fileName, kind, spriteId, index, source, cardBack, defaultName, customName, backNumber })) }, "current"); await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); }); db.close(); };
const readSpriteState = async () => { const db = await openSpriteStore(); const transaction = db.transaction("state", "readonly"), request = transaction.objectStore("state").get("current"); const value = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close(); return value; };
const clearSpriteState = async () => { const db = await openSpriteStore(); const transaction = db.transaction("state", "readwrite"); transaction.objectStore("state").delete("current"); await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); }); db.close(); };


const tileRect = (sprite, index) => sprite.detectedRects?.[index] || (() => { const width = Math.floor(sprite.image.width / sprite.columns), height = Math.floor(sprite.image.height / sprite.rows); return { x: (index % sprite.columns) * width, y: Math.floor(index / sprite.columns) * height, width, height }; })();
const cropTile = (sprite, index) => { const tile = sprite.detectedTiles?.[index]; if (tile?.image) { const canvas = document.createElement("canvas"); canvas.width = tile.image.width; canvas.height = tile.image.height; canvas.getContext("2d").drawImage(tile.image, 0, 0); return canvas; } const rect = tileRect(sprite, index), canvas = document.createElement("canvas"); canvas.width = rect.width; canvas.height = rect.height; canvas.getContext("2d").drawImage(sprite.image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height); return canvas; };
const sourceCardSize = (sprite) => {
  if (!sprite.dpi) return null;
  const width = sprite.image.naturalWidth / sprite.columns / sprite.dpi.x * 25.4;
  const height = sprite.image.naturalHeight / sprite.rows / sprite.dpi.y * 25.4;
  return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : null;
};
const ASSUMED_SCAN_DPIS = [72, 75, 100, 150, 200, 240, 300];
const sourceCardSizeAtDpi = (sprite, dpi) => {
  const width = sprite.image.naturalWidth / sprite.columns / dpi * 25.4;
  const height = sprite.image.naturalHeight / sprite.rows / dpi * 25.4;
  return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : null;
};
// A fast, dependency-free detector for flatbed scans. It finds large connected regions
// whose colour differs from the sampled scanner background; crops remain full resolution.
const detectPhotos = (image) => {
  const maxSide = 1100, scale = Math.min(1, maxSide / Math.max(image.width, image.height)), width = Math.max(1, Math.round(image.width * scale)), height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const data = canvas.getContext("2d", { willReadFrequently: true }); data.drawImage(image, 0, 0, width, height);
  const pixels = data.getImageData(0, 0, width, height).data, sample = (x, y) => { const i = (y * width + x) * 4; return [pixels[i], pixels[i + 1], pixels[i + 2]]; };
  const corners = [sample(2, 2), sample(width - 3, 2), sample(2, height - 3), sample(width - 3, height - 3)], background = corners.reduce((total, colour) => total.map((v, i) => v + colour[i] / corners.length), [0, 0, 0]);
  const mask = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) mask[p] = Math.abs(pixels[i] - background[0]) + Math.abs(pixels[i + 1] - background[1]) + Math.abs(pixels[i + 2] - background[2]) > 66 ? 1 : 0;
  const seen = new Uint8Array(mask.length), regions = [], stack = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    seen[start] = 1; stack.push(start); let count = 0, minX = width, maxX = 0, minY = height, maxY = 0;
    while (stack.length) { const point = stack.pop(), x = point % width, y = Math.floor(point / width); count++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const next of [point - 1, point + 1, point - width, point + width]) if (next >= 0 && next < mask.length && mask[next] && !seen[next] && (Math.abs((next % width) - x) + Math.abs(Math.floor(next / width) - y) === 1)) { seen[next] = 1; stack.push(next); }
    }
    const regionWidth = maxX - minX + 1, regionHeight = maxY - minY + 1;
    if (count > width * height * .012 && regionWidth > width * .09 && regionHeight > height * .09 && regionWidth / regionHeight > .35 && regionWidth / regionHeight < 3.2) regions.push({ x: minX, y: minY, width: regionWidth, height: regionHeight });
  }
  return regions.sort((a, b) => a.y - b.y || a.x - b.x).map((rect) => ({ x: Math.max(0, Math.floor(rect.x / scale) - 3), y: Math.max(0, Math.floor(rect.y / scale) - 3), width: Math.min(image.width, Math.ceil(rect.width / scale) + 6), height: Math.min(image.height, Math.ceil(rect.height / scale) + 6) }));
};
// A single-card change remains synchronous so the selection UI can update immediately.
const isMonochrome = (canvas) => { const data = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data; let count = 0, red = 0, green = 0, blue = 0; for (let i = 0; i < data.length; i += 16) { count++; red += data[i]; green += data[i + 1]; blue += data[i + 2]; } red /= count; green /= count; blue /= count; let distance = 0; for (let i = 0; i < data.length; i += 16) distance += Math.abs(data[i] - red) + Math.abs(data[i + 1] - green) + Math.abs(data[i + 2] - blue); return distance / count < 24; };
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

export const spritesTool = {
  id: "card-printer", name: "Card Printer", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
  translations: spritesTranslations,
  render: () => `<section class="tool-page sprites-page"><div class="panel sprites-panel"><div data-workspace data-view="two-columns"><label class="workspace-view-selector">${window.tr("view")}<select data-workspace-view><option value="two-columns" selected>${window.tr("twoColumns")}</option><option value="single-column">${window.tr("singleColumn")}</option></select></label><div class="workspace-columns"><div class="workflow-column"><p class="eyebrow">${window.tr("spritesEyebrow")}</p><h1>Card Printer</h1><p class="lede">${window.tr("spritesLede")}</p><aside class="how-it-works" aria-label="${escapeHtml(window.tr("howItWorks"))}"><h2>${window.tr("howItWorks")}</h2><p>${window.tr("howItWorksText")}</p></aside><div class="drop-zone" data-drop-zone><div><div class="sprite-grid">${"<i class=\"sprite-cell\"></i>".repeat(24)}</div><h2>${window.tr("dropSprites")}</h2><p>${window.tr("imageTypes")}</p><label class="browse-button" for="sprite-file-input">${window.tr("addSprites")}</label><p class="file-note" data-file-name>${window.tr("selectImages")}</p><input class="file-picker-input" data-file-input id="sprite-file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple /></div></div><div data-workspace-content hidden><div class="sprite-section-title"><div><h2>${window.tr("spriteGrids")}</h2><p>${window.tr("spriteGridsHelp")}</p></div></div><div class="sprite-editors" data-sprite-editors></div><div class="sprite-section-title"><div><h2>${window.tr("cardBacks")}</h2><p>${window.tr("cardBacksHelp")}</p></div></div><div class="backs-setup" data-backs-setup></div><div class="sprite-section-title"><div><h2>${window.tr("printSettings")}</h2><p>${window.tr("printSettingsHelp")}</p></div></div><div class="print-toolbar"><label>${window.tr("print")}<select data-print-mode><option value="front">${window.tr("frontOnly")}</option><option value="back">${window.tr("backOnly")}</option><option value="both" selected>${window.tr("bothSides")}</option></select></label><label>${window.tr("pageFormat")}<select data-page-format>${PAGE_FORMATS.map((format) => `<option value="${format}"${format === "A4" ? " selected" : ""}>${format}</option>`).join("")}</select></label><label>${window.tr("orientation")}<select data-page-orientation><option value="portrait" selected>${window.tr("portrait")}</option><option value="landscape">${window.tr("landscape")}</option></select></label><label>${window.tr("cardWidth")}<span class="dimension-input"><input data-card-width type="number" min="10" value="63" /><span>mm</span></span></label><label>${window.tr("cardHeight")}<span class="dimension-input"><input data-card-height type="number" min="10" value="88" /><span>mm</span></span></label><strong data-selection-count></strong><button class="action-button" type="button" data-download-pdf>${window.tr("downloadPdf")}</button><button class="reset-button" type="button" data-reset-tool>${window.tr("reset")}</button></div></div></div><div class="workflow-column" data-cards-column hidden><div class="sprite-section-title cards-section-title"><div><h2>${window.tr("cards")}</h2><p>${window.tr("cardsHelp")}</p></div><button class="action-button secondary select-all-cards" type="button" data-toggle-all-cards>${window.tr("selectAllCards")}</button></div><div class="cards-preview" data-cards-preview></div></div></div></div></div></section>`,
  mount: async (root) => {
    const [worker, detector] = await Promise.all([spriteWorker, detectionWorker]);
    const input = root.querySelector("[data-file-input]"), zone = root.querySelector("[data-drop-zone]"), workspace = root.querySelector("[data-workspace]"), workspaceContent = root.querySelector("[data-workspace-content]"), cardsColumn = root.querySelector("[data-cards-column]"), state = { sprites: [], backs: [], cardOrder: [], mode: "both", pageFormat: "A4", orientation: "portrait", width: 63, height: 88, hideNotPrintable: true, view: "two-columns", selectionAnchorId: null, shiftHeld: false, isDraggingCards: false }, t = window.tr;
    const workspaceColumn = workspace.querySelector(".workflow-column"), workspaceHeader = document.createElement("div"), eyebrow = workspaceColumn.querySelector(".eyebrow");
    workspaceHeader.className = "workspace-header-row";
    eyebrow.before(workspaceHeader);
    workspaceHeader.append(eyebrow, root.querySelector(".workspace-view-selector"));
    input.accept = IMAGE_ACCEPT;
    const validImageFiles = (files) => {
      const images = [...files].filter(isSupportedImage);
      const oversized = images.filter((file) => file.size > MAX_IMAGE_SIZE_BYTES);
      return images;
    };
    const printableFilter = document.createElement("label");
    printableFilter.className = "printable-filter";
    printableFilter.innerHTML = '<input data-hide-not-printable type="checkbox" checked /> <span></span>';
    const selectAllCards = root.querySelector("[data-toggle-all-cards]"), cardActions = document.createElement("div");
    selectAllCards.addEventListener("animationend", () => selectAllCards.classList.remove("is-confirmed"));
    cardActions.className = "cards-section-actions";
    selectAllCards.before(cardActions);
    cardActions.append(printableFilter, selectAllCards);
    const updatePrintableFilterLabel = () => {
      const unprintable = cards().filter(({ sprite, index }) => {
        const card = sprite.cards[index];
        return card && (card.isBack || !card.selected);
      }).length;
      printableFilter.querySelector("span").textContent = t(state.hideNotPrintable ? "hideUnprintableCards" : "showUnprintableCards").replace("{count}", unprintable);
    };
    const applyPrintableFilter = () => { updatePrintableFilterLabel(); root.querySelectorAll(".card-preview").forEach((card) => { if (card.classList.contains("card-preview-loading")) { card.hidden = state.hideNotPrintable && card.classList.contains("is-back"); return; } const selection = card.querySelector("[data-select-card]"); card.hidden = state.hideNotPrintable && (!selection?.checked || selection.disabled); }); };
    printableFilter.querySelector("[data-hide-not-printable]").addEventListener("change", (event) => { state.hideNotPrintable = event.target.checked; persist(); preview(); });
    root.addEventListener("dragover", (event) => {
      if (!state.isDraggingCards) return;
      const edge = 96, distanceFromTop = event.clientY, distanceFromBottom = window.innerHeight - event.clientY;
      if (distanceFromTop < edge) window.scrollBy({ top: -Math.ceil((edge - distanceFromTop) / 7), behavior: "auto" });
      else if (distanceFromBottom < edge) window.scrollBy({ top: Math.ceil((edge - distanceFromBottom) / 7), behavior: "auto" });
    });
    document.addEventListener("wheel", (event) => {
      if (!state.isDraggingCards) return;
      event.preventDefault();
      const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 18 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
      window.scrollBy({ top: event.deltaY * multiplier, left: event.deltaX * multiplier, behavior: "auto" });
    }, { passive: false });
    const selectionCount = (selected, all) => `${selected.length} / ${all.length} ${t("selectedCards")} · ${selected.filter(({ sprite, index }) => sprite.cards[index].backId).length} ${t("withBack")}`;
    const backInput = document.createElement("input"); backInput.type = "file"; backInput.id = "back-file-input"; backInput.accept = IMAGE_ACCEPT; backInput.multiple = true; backInput.className = "file-picker-input"; root.append(backInput);
    // The regular change listener below handles browser-native formats. Intercept
    // TIFF files first, because they need conversion before any Image is created.
    backInput.addEventListener("change", (event) => {
      const files = [...backInput.files];
      if (!files.some(isTiff)) return;
      event.stopImmediatePropagation();
      backInput.value = "";
      void withLoading(async () => {
        for (const originalFile of validImageFiles(files)) {
          const file = await prepareImageFile(originalFile);
          state.backs.push({ id: crypto.randomUUID(), kind: "file", name: "", fileName: originalFile.name, source: file, image: await loadImage(file) });
        }
      }).then(() => { persist(); renderBacks(); preview(); });
    }, true);
    const lightbox = document.createElement("div");
    lightbox.className = "image-lightbox";
    lightbox.hidden = true;
    lightbox.innerHTML = `<button type="button" class="image-lightbox-close" aria-label="${escapeHtml(t("closePreview"))}">×</button><img alt=""/>`;
    root.append(lightbox);
    const lightboxImage = lightbox.querySelector("img");
    let releaseLightboxScrollLock = null;
    const closeLightbox = () => { lightbox.hidden = true; lightboxImage.removeAttribute("src"); releaseLightboxScrollLock?.(); releaseLightboxScrollLock = null; };
    const openLightbox = (image) => { lightboxImage.src = image.currentSrc || image.src; lightboxImage.alt = image.alt; lightbox.hidden = false; releaseLightboxScrollLock = lockPageScroll(); lightbox.querySelector("button").focus(); };
    lightbox.addEventListener("click", (event) => { if (event.target === lightbox || event.target.closest(".image-lightbox-close")) closeLightbox(); });
    root.addEventListener("click", (event) => { const image = event.target.closest(".sprite-thumbnail img, .back-thumbnail img, .card-faces img"); if (image) openLightbox(image); });
    root.addEventListener("click", (event) => { const fileName = event.target.closest(".sprite-file-name"); if (fileName) fileName.parentElement.classList.toggle("has-expanded-file"); });
    root.addEventListener("click", (event) => { const button = event.target.closest("[data-scroll-grid]"); if (!button) return; const spriteIndex = state.sprites.findIndex((sprite) => sprite.id === button.dataset.scrollGrid), editor = root.querySelectorAll(".sprite-editor")[spriteIndex]; if (!editor) return; editor.scrollIntoView({ behavior: "smooth", block: "center" }); editor.classList.remove("sprite-editor-highlight"); void editor.offsetWidth; editor.classList.add("sprite-editor-highlight"); setTimeout(() => editor.classList.remove("sprite-editor-highlight"), 1400); });
    document.addEventListener("keydown", (event) => { if (event.key === "Shift") state.shiftHeld = true; if (event.key === "Escape" && !lightbox.hidden) closeLightbox(); });
    document.addEventListener("keyup", (event) => { if (event.key === "Shift") state.shiftHeld = false; });
    window.addEventListener("blur", () => { state.shiftHeld = false; });
    let saveTimer;
    // Previews are visual aids only: rendering the original, often multi-megapixel,
    // tiles repeatedly made an unrelated action (such as deleting a grid) expensive.
    const PREVIEW_MAX_SIDE = 320;
    const spritePreviewCache = new Map();
    const fileBackPreviewCache = new Map();
    const previewDataUrl = (image, sourceX = 0, sourceY = 0, sourceWidth = image.width, sourceHeight = image.height) => {
      const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      canvas.getContext("2d").drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    };
    const previewTileUrl = (sprite, index) => {
      let tiles = spritePreviewCache.get(sprite.id);
      if (!tiles) spritePreviewCache.set(sprite.id, tiles = new Map());
      if (tiles.has(index)) return tiles.get(index);
      const tile = sprite.detectedTiles?.[index];
      const url = tile?.image ? previewDataUrl(tile.image) : (() => { const rect = tileRect(sprite, index); return previewDataUrl(sprite.image, rect.x, rect.y, rect.width, rect.height); })();
      tiles.set(index, url);
      return url;
    };
    const previewBackUrl = (back) => {
      if (back?.kind === "sprite" || back?.kind === "sprite-grid-card") {
        const sprite = state.sprites.find((entry) => entry.id === back.spriteId);
        return sprite ? previewTileUrl(sprite, back.kind === "sprite-grid-card" ? sprite.backIndex : back.index) : "";
      }
      if (fileBackPreviewCache.has(back.id)) return fileBackPreviewCache.get(back.id);
      const url = previewDataUrl(back.image);
      fileBackPreviewCache.set(back.id, url);
      return url;
    };
    const clearSpritePreviewCache = (id) => spritePreviewCache.delete(id);
    const enhanceNumberInput = (input) => {
      if (input.parentElement?.classList.contains("number-stepper")) return;
      const stepper = document.createElement("span");
      stepper.className = "number-stepper";
      const increase = document.createElement("button");
      const decrease = document.createElement("button");
      increase.type = decrease.type = "button";
      increase.className = "number-stepper-button number-stepper-up";
      decrease.className = "number-stepper-button number-stepper-down";
      increase.setAttribute("aria-label", t("increaseValue"));
      decrease.setAttribute("aria-label", t("decreaseValue"));
      increase.textContent = "⌃";
      decrease.textContent = "⌄";
      [increase, decrease].forEach((button) => button.addEventListener("mousedown", (event) => event.preventDefault()));
      increase.addEventListener("click", () => { input.stepUp(); input.dispatchEvent(new Event("change", { bubbles: true })); });
      decrease.addEventListener("click", () => { input.stepDown(); input.dispatchEvent(new Event("change", { bubbles: true })); });
      input.before(stepper);
      stepper.append(input, increase, decrease);
    };
    const enhanceNumberInputs = () => root.querySelectorAll('input[type="number"]').forEach(enhanceNumberInput);
    enhanceNumberInputs();
    const hasCompleteCards = (sprite) => Array.isArray(sprite.cards) && sprite.cards.length === sprite.rows * sprite.columns && sprite.cards.every((card) => card && typeof card === "object");
    const persist = () => { assignBackNumbers(); clearTimeout(saveTimer); saveTimer = setTimeout(() => { if (state.sprites.some((sprite) => sprite.isGridLoading || !hasCompleteCards(sprite))) return; saveSpriteState(state).catch((error) => console.warn("Unable to save sprites", error)); }, 250); };
    const cards = () => {
      const natural = state.sprites.flatMap((sprite) => Array.from({ length: sprite.rows * sprite.columns }, (_, index) => ({ sprite, index, id: `${sprite.id}:${index}` })));
      const entries = new Map(natural.map((entry) => [entry.id, entry]));
      const ordered = state.cardOrder.filter((id) => entries.has(id)).map((id) => entries.get(id));
      const known = new Set(ordered.map((entry) => entry.id));
      natural.forEach((entry) => { if (!known.has(entry.id)) ordered.push(entry); });
      state.cardOrder = ordered.map((entry) => entry.id);
      return ordered;
    };
    const assignSpriteGridNumbers = () => { let highest = Math.max(0, ...state.sprites.filter((sprite) => Number.isInteger(sprite.gridNumber) && sprite.gridNumber > 0).map((sprite) => sprite.gridNumber)); state.sprites.forEach((sprite) => { if (!Number.isInteger(sprite.gridNumber) || sprite.gridNumber < 1) sprite.gridNumber = ++highest; }); };
    const spritePlaceholder = (index) => t("spritePlaceholder").replace("{number}", state.sprites[index].gridNumber);
    const assignBackNumbers = () => { let highest = Math.max(0, ...state.backs.filter((back) => Number.isInteger(back.backNumber) && back.backNumber > 0).map((back) => back.backNumber)); state.backs.forEach((back) => { if (!Number.isInteger(back.backNumber) || back.backNumber < 1) back.backNumber = ++highest; }); };
    const spriteDisplayName = (sprite) => sprite.name?.trim() || spritePlaceholder(state.sprites.indexOf(sprite));
    const ensureAutomaticBack = (sprite) => { const total = sprite.rows * sprite.columns; if (typeof sprite.backFollowsLast !== "boolean") sprite.backFollowsLast = !Number.isInteger(sprite.backIndex) || sprite.backIndex === total - 1; const automaticBacks = state.backs.filter((back) => back.kind === "sprite-grid-card" && back.spriteId === sprite.id), legacyCardBacks = state.backs.filter((back) => back.kind === "sprite" && back.cardBack && back.spriteId === sprite.id); if (sprite.backIndex === null) { const removedIds = new Set([...automaticBacks, ...legacyCardBacks].map((back) => back.id)); state.backs = state.backs.filter((back) => !removedIds.has(back.id)); cards().forEach(({ sprite: current, index }) => { const card = current.cards?.[index]; if (card && removedIds.has(card.backId)) card.backId = null; }); return null; } sprite.backIndex = Math.max(0, Math.min(total - 1, Number.isInteger(sprite.backIndex) ? sprite.backIndex : total - 1)); const back = automaticBacks[0] || (() => { const entry = { id: crypto.randomUUID(), kind: "sprite-grid-card", spriteId: sprite.id, cardBack: true, name: "" }; state.backs.push(entry); return entry; })(); const duplicateIds = new Set([...automaticBacks.slice(1), ...legacyCardBacks].map((entry) => entry.id)); if (duplicateIds.size) { cards().forEach(({ sprite: current, index }) => { const card = current.cards?.[index]; if (card && duplicateIds.has(card.backId)) card.backId = back.id; }); state.backs = state.backs.filter((entry) => !duplicateIds.has(entry.id)); } if (!back.customName) back.name = ""; return back; };
    const initialize = async (sprite) => {
      const backId = ensureAutomaticBack(sprite)?.id || null;
      let selected;
      try {
        selected = await worker.initialSelection(sprite.source, sprite.columns, sprite.rows, sprite.backIndex, sprite.detectedRects, sprite.detectedTiles?.map((tile) => tile.source));
      } catch (error) {
        console.warn("Unable to determine printable sprite cards", error);
        selected = Array.from({ length: sprite.columns * sprite.rows }, (_, index) => index !== sprite.backIndex);
      }
      sprite.cards = selected.map((isSelected, index) => ({ selected: isSelected, backSelected: false, isBack: index === sprite.backIndex, backId }));
    };
    const restoreCardSettings = (sprite, previousCards) => {
      previousCards.forEach((previous, index) => {
        const card = sprite.cards[index];
        if (!card || !previous) return;
        card.selected = previous.selected;
        card.backSelected = previous.backSelected;
        card.backId = previous.backId;
      });
    };
    const showDetectionProgress = (sprite) => {
      const editor = root.querySelector(`.sprite-editor:has([data-grid-type][data-id="${sprite.id}"])`);
      if (!editor || !Number.isFinite(sprite.gridProgress)) return;
      const now = Date.now();
      let indicator = editor.querySelector("[data-detect-message]");
      if (!indicator) {
        indicator = document.createElement("small");
        indicator.className = "detect-message";
        indicator.dataset.detectMessage = sprite.id;
        editor.querySelector(".sprite-editor-top-bar").after(indicator);
      }
      if (indicator.dataset.progress !== String(sprite.gridProgress)) {
        indicator.dataset.progress = String(sprite.gridProgress);
        sprite.detectProgressAt = now;
      }
      const idleMilliseconds = now - (sprite.detectProgressAt || sprite.loadingStartedAt || now);
      const status = editor.querySelector(`[data-detect-status="${sprite.id}"]`), message = idleMilliseconds >= 30000 ? t("detectStalled") : idleMilliseconds >= 10000 ? t("detectSlow") : "";
      if (status) { status.textContent = t("detecting").replace("{percent}", sprite.gridProgress); indicator.textContent = message; } else indicator.textContent = [t("detecting").replace("{percent}", sprite.gridProgress), message].filter(Boolean).join(" · ");
    };
    const withCardsLoading = async (sprite, task) => {
      sprite.isGridLoading = true;
      const backField = root.querySelector(`[data-back-index][data-id="${sprite.id}"]`);
      if (backField) backField.disabled = true;
      sprite.loadingStartedAt = Date.now();
      preview();
      const updateProgress = () => { if (sprite.isGridLoading) { showDetectionProgress(sprite); requestAnimationFrame(updateProgress); } };
      requestAnimationFrame(updateProgress);
      try {
        return await task();
      } finally {
        sprite.isGridLoading = false;
        if (backField) backField.disabled = false;
        delete sprite.gridProgress;
        delete sprite.detectProgressAt;
        delete sprite.loadingStartedAt;
        preview();
      }
    };
    const editors = () => {
      const markup = state.sprites.map((sprite, index) => {
        const fileName = sprite.fileName || sprite.source?.name || sprite.name;
        const name = escapeHtml(sprite.name);
        const displayName = escapeHtml(spriteDisplayName(sprite));
        const id = escapeHtml(sprite.id);
        const backOptions = `<option value="">${t("none")}</option>${Array.from({ length: sprite.columns * sprite.rows }, (_, cardIndex) => `<option value="${cardIndex}" ${sprite.backIndex === cardIndex ? "selected" : ""}>${t("card")} ${cardIndex + 1}</option>`).join("")}`;
        const estimatedSize = sourceCardSize(sprite), dpi = estimatedSize ? Math.round((sprite.dpi.x + sprite.dpi.y) / 2) : null;
        const translated = (key, fallback) => { const value = t(key); return value === key ? fallback : value; };
        const formatEstimate = (size, density) => translated("estimatedCardSize", "{dpi} DPI ≈ {width} mm × {height} mm").replace("{dpi}", density).replace("{width}", size.width.toFixed(1)).replace("{height}", size.height.toFixed(1));
        const assumedEstimates = ASSUMED_SCAN_DPIS.map((density) => {
          const size = sourceCardSizeAtDpi(sprite, density);
          return formatEstimate(size, density);
        }).join("\n");
        const cardSizeEstimate = estimatedSize ? formatEstimate(estimatedSize, dpi) : assumedEstimates;
        const widthEstimate = cardSizeEstimate, heightEstimate = "";
        return `<article class="sprite-editor"><div class="sprite-editor-top-bar"><span>${t("spriteGrid")} ${index + 1}</span><button type="button" class="remove-sprite" data-remove-sprite="${id}" aria-label="${escapeHtml(t("removeSprite"))}: ${displayName}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6 2.5h4M5 4.5l.6 8h4.8l.6-8M7 7v3M9 7v3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35"/></svg></button></div><div class="sprite-thumbnail"><img src="${escapeHtml(sprite.image.src)}" alt="${displayName}"/></div><div><div class="sprite-editor-heading"><label>${t("spriteName")}<input data-sprite-name data-id="${id}" value="${name}" placeholder="${escapeHtml(spritePlaceholder(index))}"/></label><label class="grid-type-field">${t("gridType")}<select data-grid-type data-id="${id}" aria-label="${t("gridType")}"><option value="sprite" ${sprite.gridType === "detect" ? "" : "selected"}>${t("sprite")}</option><option value="detect" ${sprite.gridType === "detect" ? "selected" : ""}>${t("detect")}</option></select></label></div><div class="grid-inputs"><label>${t("horizontalCards")}<input data-grid="columns" data-id="${id}" type="number" min="1" max="12" value="${sprite.columns}"/><small class="card-size-estimate"><span class="card-size-estimate-title">${t("cardWidthEstimation")}</span>${escapeHtml(widthEstimate)}</small></label><label>${t("verticalCards")}<input data-grid="rows" data-id="${id}" type="number" min="1" max="12" value="${sprite.rows}"/><small class="card-size-estimate"><span class="card-size-estimate-title">${t("cardHeightEstimation")}</span>${escapeHtml(heightEstimate)}</small></label><label>${t("automaticBack")}<select data-back-index data-id="${id}" aria-label="${t("automaticBack")}">${backOptions}</select></label></div><div class="grid-card-actions"><button class="action-button secondary deselect-grid-cards" type="button" data-deselect-grid-cards="${id}">${t("deselectCards")}</button><button class="action-button secondary select-grid-cards" type="button" data-select-grid-cards="${id}">${t("selectCards")}</button></div><small><span>${sprite.columns * sprite.rows} ${t("totalCards")}</span><span class="sprite-file-name" title="${escapeHtml(fileName)}">${t("file")}: ${escapeHtml(fileName)}</span></small></div></article>`;
      }).join("");
      root.querySelector("[data-sprite-editors]").innerHTML = markup;
      root.querySelectorAll(".sprite-editor").forEach((editor, index) => {
        const [estimate, ...unusedEstimates] = editor.querySelectorAll(".card-size-estimate");
        if (!estimate) return;
        const sprite = state.sprites[index], metadataSize = sourceCardSize(sprite), metadataDpi = metadataSize ? Math.round((sprite.dpi.x + sprite.dpi.y) / 2) : null;
        const gridInputs = editor.querySelector(".grid-inputs"), backControl = gridInputs.querySelector("[data-back-index]").closest("label");
        if (sprite.gridType === "detect") { estimate.remove(); unusedEstimates.forEach((unused) => unused.remove()); return; }
        if (metadataSize) {
          estimate.innerHTML = `<span class="card-size-estimate-title">${escapeHtml(t("cardSize"))}</span><strong>${metadataSize.width.toFixed(1)} × ${metadataSize.height.toFixed(1)} mm</strong><small>${metadataDpi} ${escapeHtml(t("dpi"))}</small>`;
          gridInputs.insertBefore(estimate, backControl);
          unusedEstimates.forEach((unused) => unused.remove());
          return;
        }
        const sizes = ASSUMED_SCAN_DPIS.map((density) => ({ dpi: density, ...sourceCardSizeAtDpi(sprite, density) }));
        estimate.innerHTML = `<span class="card-size-estimate-title">${escapeHtml(t("cardSizeEstimation"))}</span><table><thead><tr><th>${escapeHtml(t("dpi"))}</th><th>${escapeHtml(t("widthMm"))}</th><th>${escapeHtml(t("heightMm"))}</th></tr></thead><tbody>${sizes.map((size) => `<tr><td>${size.dpi}</td><td>${size.width.toFixed(1)}</td><td>${size.height.toFixed(1)}</td></tr>`).join("")}</tbody></table>`;
        const button = document.createElement("button"), table = estimate.querySelector("table");
        button.className = "action-button secondary show-card-size-estimate";
        button.type = "button";
        button.textContent = t("viewCardSizeEstimation");
        button.addEventListener("click", () => {
          const dialog = document.createElement("dialog");
          dialog.className = "card-size-estimate-dialog";
          dialog.innerHTML = `<h2>${escapeHtml(t("cardSizeEstimation"))}</h2>${table.outerHTML}<div><button type="button" class="action-button secondary">${escapeHtml(t("close"))}</button></div>`;
          dialog.querySelector("button").addEventListener("click", () => dialog.close());
          root.append(dialog); dialog.showModal();
          const releaseScrollLock = lockPageScroll(dialog);
          dialog.addEventListener("close", () => { releaseScrollLock(); dialog.remove(); }, { once: true });
        });
        estimate.remove();
        gridInputs.insertBefore(button, backControl);
        unusedEstimates.forEach((unused) => unused.remove());
      });
      root.querySelectorAll(".sprite-editor").forEach((editor, index) => {
        const button = document.createElement("button");
        button.className = "action-button secondary apply-grid-back";
        button.type = "button";
        button.dataset.applyGridBack = state.sprites[index].id;
        button.textContent = t("applyBackToSelectedCards");
        editor.querySelector(".grid-card-actions").append(button);
      });
      root.querySelectorAll(".sprite-editor-top-bar span").forEach((label, index) => { label.textContent = `${t("spriteGrid")} ${state.sprites[index].gridNumber}`; });
      root.querySelectorAll("[data-grid]").forEach((field) => field.addEventListener("change", async () => { const sprite = state.sprites.find((entry) => entry.id === field.dataset.id); if (sprite.gridType === "detect") { field.value = sprite[field.dataset.grid]; return; } sprite[field.dataset.grid] = Math.max(1, Math.min(12, Number(field.value) || 1)); const total = sprite.rows * sprite.columns; if (Number.isInteger(sprite.backIndex) && (sprite.backIndex < 0 || sprite.backIndex >= total)) sprite.backIndex = total - 1; sprite.manualGrid = { columns: sprite.columns, rows: sprite.rows }; clearSpritePreviewCache(sprite.id); await withCardsLoading(sprite, () => initialize(sprite)); persist(); editors(); renderBacks(); preview(); }));
      root.querySelectorAll("[data-grid-type]").forEach((field) => field.addEventListener("change", async () => {
        const sprite = state.sprites.find((entry) => entry.id === field.dataset.id);
        if (!sprite || sprite.isGridLoading) return;
        if (field.value === "detect") {
          sprite.manualGrid = { columns: sprite.columns, rows: sprite.rows };
          sprite.gridType = "detect";
        } else {
          sprite.gridType = "sprite"; sprite.detectedTiles = null; sprite.detectedRects = null; sprite.detectedRegions = null;
          sprite.columns = sprite.manualGrid?.columns || 1; sprite.rows = sprite.manualGrid?.rows || 1;
          clearSpritePreviewCache(sprite.id);
          await withCardsLoading(sprite, () => initialize(sprite));
        }
        persist(); editors(); renderBacks(); preview();
      }));
      root.querySelectorAll("[data-back-index]").forEach((field) => field.addEventListener("change", async () => { const sprite = state.sprites.find((entry) => entry.id === field.dataset.id), total = sprite.rows * sprite.columns; sprite.backIndex = field.value === "" ? null : Math.max(0, Math.min(total - 1, Number(field.value))); sprite.backFollowsLast = sprite.backIndex === total - 1; await withCardsLoading(sprite, () => initialize(sprite)); persist(); editors(); renderBacks(); preview(); }));
      root.querySelectorAll("[data-sprite-name]").forEach((field) => field.addEventListener("change", () => { const sprite = state.sprites.find((entry) => entry.id === field.dataset.id); sprite.name = field.value.trim(); field.value = sprite.name; persist(); editors(); preview(); }));
      root.querySelectorAll("[data-select-grid-cards]").forEach((button) => {
        button.addEventListener("animationend", () => button.classList.remove("is-confirmed"));
        button.addEventListener("click", () => {
          const sprite = state.sprites.find((entry) => entry.id === button.dataset.selectGridCards);
          if (!sprite) return;
          sprite.cards.forEach((card) => { if (!card.isBack) card.backSelected = true; });
          persist(); renderBacks(); preview();
          button.classList.remove("is-confirmed");
          void button.offsetWidth;
          button.classList.add("is-confirmed");
        });
      });
      root.querySelectorAll("[data-deselect-grid-cards]").forEach((button) => {
        button.addEventListener("animationend", () => button.classList.remove("is-confirmed"));
        button.addEventListener("click", () => {
          const sprite = state.sprites.find((entry) => entry.id === button.dataset.deselectGridCards);
          if (!sprite) return;
          sprite.cards.forEach((card) => { card.backSelected = false; });
          state.selectionAnchorId = null;
          persist(); renderBacks(); preview();
          button.classList.remove("is-confirmed");
          void button.offsetWidth;
          button.classList.add("is-confirmed");
        });
      });
      root.querySelectorAll("[data-apply-grid-back]").forEach((button) => {
        button.addEventListener("animationend", () => button.classList.remove("is-confirmed"));
        button.addEventListener("click", () => {
          const back = state.backs.find((entry) => entry.kind === "sprite-grid-card" && entry.spriteId === button.dataset.applyGridBack);
          if (!back) return;
          selectedBackTargets().forEach(({ sprite, index }) => { sprite.cards[index].backId = back.id; });
          persist(); preview();
          button.classList.remove("is-confirmed");
          void button.offsetWidth;
          button.classList.add("is-confirmed");
        });
      });
      root.querySelectorAll("[data-remove-sprite]").forEach((button) => button.addEventListener("click", () => { const id = button.dataset.removeSprite; clearSpritePreviewCache(id); state.cardOrder = state.cardOrder.filter((cardId) => !cardId.startsWith(`${id}:`)); state.sprites = state.sprites.filter((sprite) => sprite.id !== id); state.backs = state.backs.filter((back) => back.spriteId !== id); persist(); if (!state.sprites.length) { workspaceContent.hidden = true; cardsColumn.hidden = true; root.querySelector(".sprites-panel").classList.remove("has-sprites"); root.querySelector("[data-file-name]").textContent = t("selectImages"); return; } showWorkspace(); }));
      enhanceNumberInputs();
      state.sprites.filter((sprite) => sprite.gridType === "detect").forEach((sprite) => { const select = root.querySelector(`[data-grid-type][data-id="${sprite.id}"]`); if (select) showDetectControls(sprite, select.closest(".sprite-editor"), select); });
    };
    const showDetectControls = (sprite, editor, select) => {
      editor.classList.add("sprite-editor-detect");
      editor.querySelectorAll("[data-grid]").forEach((field) => { field.closest("label").hidden = true; });
      editor.querySelector(".detect-controls")?.remove();
      const controls = document.createElement("div");
      controls.className = "detect-controls";
      controls.innerHTML = `<button class="action-button secondary" type="button" data-toggle-detect>${t("startDetect")}</button><button class="action-button secondary" type="button" data-edit-detect ${sprite.isGridLoading ? "disabled" : ""}>${t("editDetectedAreas")}</button><span class="detect-status" data-detect-status="${sprite.id}" aria-live="polite">${t("detectIdle")}</span><small class="detect-message" data-detect-message="${sprite.id}"></small>`;
      editor.querySelector(".grid-inputs").before(controls);
      controls.querySelector("[data-edit-detect]").addEventListener("click", () => {
        if (sprite.isGridLoading) return;
        openDetectionEditor({ root, sprite, t, onSave: async (areas) => {
          const { sources, regions } = await detector.straightenRegions(sprite.image, areas.map(({ corners }) => ({ corners })));
          const tiles = await Promise.all(sources.map(async (source) => ({ source, image: await loadImage(source) })));
          const previousCards = areas.map(({ originalIndex }) => originalIndex === null ? null : sprite.cards[originalIndex]);
          const indices = new Map(areas.flatMap(({ originalIndex }, index) => originalIndex === null ? [] : [[originalIndex, index]]));
          const removedBacks = new Set();
          state.backs = state.backs.filter((back) => {
            if (back.spriteId !== sprite.id || back.kind !== "sprite") return true;
            if (!indices.has(back.index)) { removedBacks.add(back.id); return false; }
            back.index = indices.get(back.index); return true;
          });
          state.sprites.forEach((entry) => entry.cards.forEach((card) => { if (removedBacks.has(card.backId)) card.backId = null; }));
          state.cardOrder = state.cardOrder.flatMap((id) => {
            if (!id.startsWith(`${sprite.id}:`)) return [id];
            const index = indices.get(Number(id.slice(sprite.id.length + 1)));
            return index === undefined ? [] : [`${sprite.id}:${index}`];
          });
          const previousTiles = sprite.detectedTiles;
          sprite.backIndex = indices.get(sprite.backIndex) ?? null;
          sprite.backFollowsLast = false;
          sprite.detectedTiles = tiles; sprite.detectedRegions = regions; sprite.detectedRects = null;
          sprite.columns = tiles.length; sprite.rows = 1;
          clearSpritePreviewCache(sprite.id);
          await withCardsLoading(sprite, () => initialize(sprite));
          const availableBacks = new Set(state.backs.map((back) => back.id));
          restoreCardSettings(sprite, previousCards.map((card) => card ? { ...card, backId: availableBacks.has(card.backId) ? card.backId : null } : null));
          previousTiles?.forEach((tile) => URL.revokeObjectURL(tile.image.src));
          persist(); editors(); renderBacks(); preview();
        } });
      });
      const reset = () => { select.value = "detect"; const button = controls.querySelector("[data-toggle-detect]"); button.disabled = false; select.disabled = false; controls.querySelector("[data-edit-detect]").disabled = false; button.textContent = t("startDetect"); controls.querySelector("[data-detect-status]").textContent = t("detectIdle"); controls.querySelector("[data-detect-message]").textContent = ""; };
      controls.querySelector("[data-toggle-detect]").addEventListener("click", async () => {
        const button = controls.querySelector("[data-toggle-detect]");
        if (sprite.detectRequestId) { button.disabled = true; detector.cancelDetection(sprite.detectRequestId); return; }
        if (sprite.isGridLoading) return;
        button.textContent = t("stopDetect");
        select.disabled = true;
        controls.querySelector("[data-edit-detect]").disabled = true;
        try {
          await withCardsLoading(sprite, async () => {
            const previousCards = sprite.cards?.map(({ selected, backSelected, backId }) => ({ selected, backSelected, backId })) || [];
            sprite.gridProgress = 0;
            const { sources, regions } = await detector.detectAndStraighten(sprite.image, (progress) => { if (progress < 100 && progress - sprite.gridProgress < 2) return; sprite.gridProgress = progress; preview(); }, (id) => { sprite.detectRequestId = id; });
            delete sprite.detectRequestId;
            const tiles = await Promise.all(sources.map(async (source) => ({ source, image: await loadImage(source) })));
            if (!tiles.length) { window.alert(t("detectNone")); return; }
            sprite.gridType = "detect"; sprite.detectedRegions = regions; sprite.detectedTiles = tiles; sprite.detectedRects = null; sprite.columns = tiles.length; sprite.rows = 1; sprite.backIndex = null; sprite.backFollowsLast = false;
            clearSpritePreviewCache(sprite.id);
            await initialize(sprite);
            restoreCardSettings(sprite, previousCards);
          });
          persist(); editors(); renderBacks(); preview();
        } catch (error) {
          if (error?.name !== "AbortError") { console.error("Unable to detect cards", error); window.alert(t("detectionError")); }
          delete sprite.detectRequestId;
          reset();
        }
      });
    };
    const cardSelectionIcon = (selected) => selected ? '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="currentColor" stroke="currentColor"/><path d="m4.25 8 2.25 2.25 5.25-5" fill="none" stroke="#171c30" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"/></svg>' : '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
    const backPlaceholder = (back) => t("backPlaceholder").replace("{number}", back.backNumber);
    const backDisplayName = (back) => back.name?.trim() || backPlaceholder(back);
    const backLabel = (back) => escapeHtml(backDisplayName(back));
    const selectedBackTargets = () => cards().filter(({ sprite, index }) => !sprite.isGridLoading && sprite.cards[index]?.backSelected && !sprite.cards[index].isBack);
    const syncApplyBackButtons = () => {
      const disabled = selectedBackTargets().length === 0;
      root.querySelectorAll("[data-apply-back]").forEach((button) => { button.disabled = disabled; });
      root.querySelectorAll("[data-apply-grid-back]").forEach((button) => {
        button.disabled = disabled || !state.backs.some((back) => back.kind === "sprite-grid-card" && back.spriteId === button.dataset.applyGridBack);
      });
    };
    const renderBacks = () => {
      assignBackNumbers();
      const backs = state.backs.map((back) => {
        const spriteIndex = state.sprites.findIndex((sprite) => sprite.id === back.spriteId), sprite = state.sprites[spriteIndex], spriteNumber = spriteIndex + 1;
        const fileName = back.kind === "file" ? back.fileName || back.source?.name || back.name : sprite?.fileName || sprite?.source?.name || sprite?.name;
        const id = escapeHtml(back.id), name = backLabel(back), canvas = previewBackUrl(back), placeholder = escapeHtml(backPlaceholder(back));
        return `<article class="back-item"><div class="back-selection-bar"><span class="back-select-label">${placeholder}</span><button class="back-remove-button" type="button" data-remove-back="${id}" aria-label="${escapeHtml(t("removeBack"))}: ${name}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6 2.5h4M5 4.5l.6 8h4.8l.6-8M7 7v3M9 7v3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35"/></svg></button></div><div class="back-thumbnail"><img src="${canvas}" alt="${name}"/></div><div class="back-details"><label>${t("backName")}<input data-back-name="${id}" value="${escapeHtml(back.name || "")}" placeholder="${placeholder}"/>${back.kind === "sprite-grid-card" ? `<small class="last-card-badge">${t("auto")}</small>` : back.kind === "file" ? `<small class="last-card-badge">${t("image")}</small>` : ""}${back.spriteId ? `<button class="back-grid-link" type="button" data-scroll-grid="${escapeHtml(back.spriteId)}">${t("sprite")} ${spriteNumber}</button>` : ""}</label><button class="action-button secondary apply-back" type="button" data-apply-back="${id}">${t("applyToSelectedCards")}</button>${fileName ? `<small class="back-file-info"><span class="sprite-file-name" title="${escapeHtml(fileName)}">${t("file")}: ${escapeHtml(fileName)}</span></small>` : ""}</div></article>`;
      }).join("");
      root.querySelector("[data-backs-setup]").innerHTML = `<div class="back-file-add back-drop-zone" data-back-drop-zone><h3>${t("separateFileBack")}</h3><p>${t("backDropHint")}</p><button class="browse-button" type="button" data-file-picker-target="back-file-input">${t("addFile")}</button></div><div class="back-list" role="radiogroup">${backs || `<p class="back-empty">${t("noBacks")}</p>`}</div>`;
      root.querySelectorAll(".back-item [data-scroll-grid]").forEach((link) => { const sprite = state.sprites.find((entry) => entry.id === link.dataset.scrollGrid); if (sprite) link.textContent = `${t("sprite")} ${sprite.gridNumber}`; });
      syncApplyBackButtons();
      root.querySelectorAll("[data-apply-back]").forEach((button) => {
        button.addEventListener("animationend", () => button.classList.remove("is-confirmed"));
        button.addEventListener("click", () => {
          const backId = button.dataset.applyBack;
          if (!state.backs.some((back) => back.id === backId)) return;
          selectedBackTargets().forEach(({ sprite, index }) => { sprite.cards[index].backId = backId; });
          persist(); preview();
          button.classList.remove("is-confirmed");
          void button.offsetWidth;
          button.classList.add("is-confirmed");
        });
      });
      const backDropZone = root.querySelector("[data-back-drop-zone]");
      const addBackFiles = async (files) => { const images = validImageFiles(files); if (!images.length) return; await withLoading(async () => { for (const originalFile of images) { const file = await prepareImageFile(originalFile); state.backs.push({ id: crypto.randomUUID(), kind: "file", name: "", fileName: originalFile.name, source: file, image: await loadImage(file) }); } }); persist(); renderBacks(); preview(); };
      ["dragenter", "dragover"].forEach((type) => backDropZone.addEventListener(type, (event) => { event.preventDefault(); backDropZone.classList.add("dragging"); }));
      ["dragleave", "drop"].forEach((type) => backDropZone.addEventListener(type, (event) => { event.preventDefault(); backDropZone.classList.remove("dragging"); }));
      backDropZone.addEventListener("drop", (event) => addBackFiles(event.dataTransfer.files));
      root.querySelectorAll("[data-back-name]").forEach((field) => field.addEventListener("change", () => { const back = state.backs.find((entry) => entry.id === field.dataset.backName); back.name = field.value.trim(); back.customName = Boolean(back.name); field.value = back.name; persist(); preview(); }));
      root.querySelectorAll("[data-remove-back]").forEach((button) => button.addEventListener("click", () => { const id = button.dataset.removeBack; state.backs = state.backs.filter((back) => back.id !== id); cards().forEach(({ sprite, index }) => { if (sprite.cards[index].backId === id) sprite.cards[index].backId = null; }); persist(); renderBacks(); preview(); }));
    };
    const preview = () => {
      syncApplyBackButtons();
      const all = cards();
      const selected = all.filter(({ sprite, index }) => sprite.cards[index]?.selected && !sprite.cards[index]?.isBack);
      const syncSelectAllCardsToggle = () => {
        const button = root.querySelector("[data-toggle-all-cards]");
        const selectable = all.filter(({ sprite, index }) => sprite.cards[index] && !sprite.cards[index].isBack && (!state.hideNotPrintable || sprite.cards[index].selected));
        const allSelected = selectable.length > 0 && selectable.every(({ sprite, index }) => sprite.cards[index].backSelected);
        button.disabled = selectable.length === 0;
        button.textContent = t(allSelected ? "deselectAllCards" : "selectAllCards");
        button.setAttribute("aria-pressed", String(allSelected));
      };
      syncSelectAllCardsToggle();
      root.querySelector("[data-selection-count]").textContent = selectionCount(selected, all);
      root.querySelector("[data-cards-preview]").innerHTML = all.map(({ sprite, index, id }) => {
        if (sprite.isGridLoading || !sprite.cards[index]) { const progress = Number.isFinite(sprite.gridProgress) ? sprite.gridProgress : null, label = progress === null ? t("processing") : t("detecting").replace("{percent}", progress); return `<article class="card-preview card-preview-loading ${sprite.backIndex === index ? "is-back" : ""}" aria-busy="true"><div class="card-selection-bar" aria-hidden="true"></div><div class="card-flags"><span></span><span></span></div><div class="card-faces"><figure><div class="card-loading-face"></div><span class="card-loading-control"></span></figure><figure><div class="card-loading-face"></div><span class="card-loading-control"></span></figure></div><div class="card-loading-indicator"><span class="card-loading-spinner" aria-hidden="true"></span><span>${label}</span>${progress === null ? "" : `<progress value="${progress}" max="100">${progress}%</progress>`}</div></article>`; }
        const card = sprite.cards[index], selectedBack = state.backs.find((back) => back.id === card.backId), options = `<option value="">${t("noBack")}</option>${state.backs.map((back) => `<option value="${back.id}" ${back.id === card.backId ? "selected" : ""}>${backLabel(back)}</option>`).join("")}`, front = previewTileUrl(sprite, index), back = selectedBack ? previewBackUrl(selectedBack) : "";
        const spriteName = escapeHtml(spriteDisplayName(sprite));
        return `<article class="card-preview ${card.selected && !card.isBack ? "" : "is-off"} ${card.backSelected && !card.isBack ? "is-selected" : ""}" data-card-selectable="${id}"><div class="card-preview-actions"><div class="card-selection-bar"><button class="card-selection-button" type="button" data-select-card-bar="${id}" aria-pressed="${card.backSelected && !card.isBack}" ${card.isBack ? "disabled" : ""}>${t("selectCard")}</button><button class="card-drag-handle" type="button" data-drag-card="${id}" aria-label="${t("dragCards")}" title="${t("dragCards")}" ${card.backSelected && !card.isBack ? "" : "hidden"}>⠿</button></div></div><div class="card-flags"><strong class="sprite-card-label"><button class="back-grid-link sprite-card-link" type="button" data-scroll-grid="${escapeHtml(sprite.id)}" title="${spriteName}">${spriteName}</button><span>, ${t("card")} ${index + 1}</span></strong><label class="card-check"${card.isBack ? ` title="${escapeHtml(t("printDisabledBack"))}"` : ""}><input data-select-card="${id}" type="checkbox" ${card.selected ? "checked" : ""} ${card.isBack ? "disabled" : ""}/> ${t("print")}</label></div><div class="card-faces"><figure><img src="${front}" alt="${t("front")} ${t("card")} ${index + 1}"/><select class="card-is-back" data-is-back="${id}" aria-label="${t("front")} / ${t("back")}" ${card.backSelected && !card.isBack ? "disabled" : ""}><option value="front" ${card.isBack ? "" : "selected"}>${t("front")}</option><option value="back" ${card.isBack ? "selected" : ""}>${t("back")}</option></select></figure><figure>${back ? `<img src="${back}" alt="${t("back")} ${backLabel(selectedBack)}"/>` : `<div class="missing-back">${t("noBack")}</div>`}<select class="card-back-select" data-back-card="${id}" aria-label="${t("back")}" ${card.isBack ? "disabled" : ""}>${options}</select></figure></div></article>`;
      }).join("");
      const refreshSelectionUi = () => {
        syncApplyBackButtons();
        const all = cards(), entries = new Map(all.map((entry) => [entry.id, entry]));
        root.querySelectorAll("[data-card-selectable]").forEach((element) => { const entry = entries.get(element.dataset.cardSelectable), isSelected = Boolean(entry && entry.sprite.cards[entry.index].backSelected && !entry.sprite.cards[entry.index].isBack), button = element.querySelector("[data-select-card-bar]"), faceSelect = element.querySelector("[data-is-back]"), dragHandle = element.querySelector("[data-drag-card]"); element.classList.toggle("is-selected", isSelected); button.setAttribute("aria-pressed", String(isSelected)); button.textContent = t("selectCard"); faceSelect.disabled = isSelected; dragHandle.hidden = !isSelected; });
        const selected = all.filter(({ sprite, index }) => sprite.cards[index].selected && !sprite.cards[index].isBack);
        root.querySelector("[data-selection-count]").textContent = selectionCount(selected, all);
        syncSelectAllCardsToggle();
      };
      const selectCard = (id, event) => { const selected = cards(), target = selected.find((entry) => entry.id === id), anchorIndex = selected.findIndex((entry) => entry.id === state.selectionAnchorId), targetIndex = selected.indexOf(target), additive = event.ctrlKey || event.metaKey, range = (event.shiftKey || state.shiftHeld) && anchorIndex >= 0 ? [anchorIndex, targetIndex].sort((a, b) => a - b) : null; if (!target || target.sprite.cards[target.index].isBack) return; if (range) { if (!additive) selected.forEach(({ sprite, index }) => { sprite.cards[index].backSelected = false; }); selected.slice(range[0], range[1] + 1).forEach(({ sprite, index }) => { if (!sprite.cards[index].isBack) sprite.cards[index].backSelected = true; }); } else if (additive) { target.sprite.cards[target.index].backSelected = !target.sprite.cards[target.index].backSelected; state.selectionAnchorId = target.id; } else { const selectedCards = selected.filter(({ sprite, index }) => sprite.cards[index].backSelected && !sprite.cards[index].isBack); if (selectedCards.length === 1 && selectedCards[0] === target) target.sprite.cards[target.index].backSelected = false; else { selected.forEach(({ sprite, index }) => { sprite.cards[index].backSelected = false; }); target.sprite.cards[target.index].backSelected = true; } state.selectionAnchorId = target.id; } persist(); refreshSelectionUi(); };
      root.querySelector("[data-toggle-all-cards]").onclick = () => {
        const selectable = cards().filter(({ sprite, index }) => sprite.cards[index] && !sprite.cards[index].isBack && (!state.hideNotPrintable || sprite.cards[index].selected));
        const allSelected = selectable.length > 0 && selectable.every(({ sprite, index }) => sprite.cards[index].backSelected);
        selectable.forEach(({ sprite, index }) => { sprite.cards[index].backSelected = !allSelected; });
        state.selectionAnchorId = null;
        persist();
        preview();
        selectAllCards.classList.remove("is-confirmed");
        void selectAllCards.offsetWidth;
        selectAllCards.classList.add("is-confirmed");
      };
      const selectFromPointer = (event, id) => { if (event.button !== 0) return; event.preventDefault(); selectCard(id, event); };
      root.querySelectorAll("[data-card-selectable]").forEach((card) => card.addEventListener("pointerdown", (event) => { if (event.target.closest("button, select, input, label, img")) return; selectFromPointer(event, card.dataset.cardSelectable); }));
      root.querySelectorAll("[data-select-card-bar]").forEach((button) => { button.addEventListener("pointerdown", (event) => selectFromPointer(event, button.dataset.selectCardBar)); button.addEventListener("click", (event) => { if (event.detail === 0) selectCard(button.dataset.selectCardBar, event); }); });
      root.querySelectorAll("[data-select-card]").forEach((checkbox) => checkbox.addEventListener("click", (event) => { event.preventDefault(); const target = cards().find((entry) => entry.id === checkbox.dataset.selectCard); if (!target || target.sprite.cards[target.index].isBack) return; target.sprite.cards[target.index].selected = !target.sprite.cards[target.index].selected; persist(); preview(); }));
      let draggedIds = [], dragTargetId = null;
      const finishDrag = () => { draggedIds = []; dragTargetId = null; state.isDraggingCards = false; root.querySelectorAll("[data-card-selectable]").forEach((card) => card.classList.remove("is-dragging", "is-drop-target")); };
      const updateDragTarget = (x, y) => { const target = document.elementFromPoint(x, y)?.closest("[data-card-selectable]"), id = target?.dataset.cardSelectable; root.querySelectorAll("[data-card-selectable]").forEach((card) => card.classList.toggle("is-drop-target", card.dataset.cardSelectable === id && !draggedIds.includes(id))); dragTargetId = id && !draggedIds.includes(id) ? id : null; };
      root.querySelectorAll("[data-drag-card]").forEach((handle) => {
        handle.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          const all = cards(), entry = all.find((card) => card.id === handle.dataset.dragCard);
          if (!entry || entry.sprite.cards[entry.index].isBack || !entry.sprite.cards[entry.index].backSelected) return;
          event.preventDefault();
          const selected = all.filter(({ sprite, index }) => sprite.cards[index].backSelected && !sprite.cards[index].isBack);
          draggedIds = (selected.some((card) => card.id === entry.id) ? selected : [entry]).map((card) => card.id);
          state.isDraggingCards = true;
          handle.setPointerCapture(event.pointerId);
          root.querySelectorAll("[data-card-selectable]").forEach((card) => card.classList.toggle("is-dragging", draggedIds.includes(card.dataset.cardSelectable)));
          updateDragTarget(event.clientX, event.clientY);
        });
        handle.addEventListener("pointermove", (event) => { if (state.isDraggingCards) updateDragTarget(event.clientX, event.clientY); });
        handle.addEventListener("pointerup", () => { if (dragTargetId) { const order = cards().map((card) => card.id), withoutDragged = order.filter((id) => !draggedIds.includes(id)), targetIndex = withoutDragged.indexOf(dragTargetId); state.cardOrder = [...withoutDragged.slice(0, targetIndex), ...draggedIds, ...withoutDragged.slice(targetIndex)]; finishDrag(); persist(); preview(); } else finishDrag(); });
        handle.addEventListener("lostpointercapture", () => { if (state.isDraggingCards) finishDrag(); });
      });
      root.querySelectorAll("[data-is-back]").forEach((field) => field.addEventListener("change", async () => { const [spriteId, value] = field.dataset.isBack.split(":"), sprite = state.sprites.find((entry) => entry.id === spriteId), index = Number(value); if (!sprite) return; if (field.value === "back") { sprite.backIndex = index; sprite.backFollowsLast = index === sprite.rows * sprite.columns - 1; await withCardsLoading(sprite, () => initialize(sprite)); } else if (sprite.backIndex === index) { sprite.backIndex = null; await withCardsLoading(sprite, () => initialize(sprite)); } persist(); editors(); renderBacks(); preview(); }));
      root.querySelectorAll("[data-back-card]").forEach((f) => f.addEventListener("change", () => { const [sid, i] = f.dataset.backCard.split(":"), sprite = state.sprites.find((s) => s.id === sid), index = Number(i); if (!sprite || sprite.cards[index]?.isBack) return; const selected = cards().filter(({ sprite: selectedSprite, index }) => selectedSprite.cards[index].backSelected && !selectedSprite.cards[index].isBack), targets = selected.length ? selected : [{ sprite, index }]; targets.forEach(({ sprite: targetSprite, index }) => { targetSprite.cards[index].backId = f.value || null; }); persist(); preview(); }));
      applyPrintableFilter();
    };
    const showWorkspace = () => { assignSpriteGridNumbers(); root.querySelector("[data-file-name]").textContent = t("spritesLoaded").replace("{count}", state.sprites.length); root.querySelector(".sprites-panel").classList.add("has-sprites"); workspaceContent.hidden = false; cardsColumn.hidden = false; editors(); renderBacks(); preview(); };
    const addFiles = async (files) => { const images = validImageFiles(files); if (!images.length) return; await withLoading(async () => { for (const originalFile of images) { const [dpi, file] = await Promise.all([imageDpi(originalFile), prepareImageFile(originalFile)]), image = await loadImage(file), grid = { columns: 1, rows: 1 }, s = { id: crypto.randomUUID(), name: "", fileName: originalFile.name, source: file, image, dpi, gridType: "sprite", manualGrid: grid, ...grid, detectedRects: null, backIndex: null, backFollowsLast: false }; state.sprites.push(s); await initialize(s); } }); if (state.sprites.length) { showWorkspace(); persist(); } };
    const download = async () => {
      const button = root.querySelector("[data-download-pdf]");
      if (button.disabled) return;
      const selected = cards().filter(({ sprite, index }) => sprite.cards[index].selected && !sprite.cards[index].isBack);
      if (!selected.length) return;
      button.disabled = true;
      try {
        const bytes = await withLoading(() => worker.createPdf({
          sprites: state.sprites.filter((sprite) => sprite?.id && sprite.source).map(({ id, source, columns, rows, backIndex, detectedRects, detectedTiles }) => ({ id, source, columns, rows, backIndex, detectedRects, detectedTiles: detectedTiles?.filter((tile) => tile?.source).map((tile) => tile.source) })),
          backs: state.backs.filter((back) => back?.id && typeof back.kind === "string").map(({ id, kind, spriteId, index, source }) => ({ id, kind, spriteId, index, source })),
          selected: selected.map(({ sprite, index }) => ({ spriteId: sprite.id, columns: sprite.columns, rows: sprite.rows, index, backId: sprite.cards[index].backId })),
          mode: state.mode, pageFormat: state.pageFormat, orientation: state.orientation, width: state.width, height: state.height
        }));
        if (typeof window.showPdfPreview === "function") {
          await window.showPdfPreview(bytes, "carte-da-gioco.pdf");
        } else {
          const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
          Object.assign(document.createElement("a"), { href: url, download: "carte-da-gioco.pdf" }).click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } catch (error) {
        console.error("Unable to create PDF", error);
        window.alert(t("pdfCreateError"));
      } finally {
        button.disabled = false;
      }
    };
    const openFilePicker = (fileInput) => { fileInput.multiple = true; try { if (typeof fileInput.showPicker === "function") fileInput.showPicker(); else fileInput.click(); } catch { fileInput.click(); } };
    root.addEventListener("click", (event) => { const button = event.target.closest("[data-file-picker-target]"); if (!button) return; openFilePicker(button.dataset.filePickerTarget === "sprite-file-input" ? input : backInput); });
    input.addEventListener("change", () => { const files = [...input.files]; input.value = ""; void addFiles(files); }); backInput.addEventListener("change", async () => { const images = validImageFiles(backInput.files); if (images.length) await withLoading(async () => { for (const file of images) state.backs.push({ id: crypto.randomUUID(), kind: "file", name: "", fileName: file.name, source: file, image: await loadImage(file) }); }); backInput.value = ""; persist(); renderBacks(); preview(); }); ["dragenter", "dragover"].forEach((e) => zone.addEventListener(e, (event) => { event.preventDefault(); zone.classList.add("dragging"); })); ["dragleave", "drop"].forEach((e) => zone.addEventListener(e, (event) => { event.preventDefault(); zone.classList.remove("dragging"); })); zone.addEventListener("drop", (e) => addFiles(e.dataTransfer.files)); root.querySelector("[data-workspace-view]").addEventListener("change", (e) => { state.view = e.target.value; workspace.dataset.view = state.view; persist(); }); root.querySelector("[data-print-mode]").addEventListener("change", (e) => { state.mode = e.target.value; persist(); }); root.querySelector("[data-page-format]").addEventListener("change", (e) => { state.pageFormat = e.target.value; persist(); }); root.querySelector("[data-page-orientation]").addEventListener("change", (e) => { state.orientation = e.target.value; persist(); }); [["width", "[data-card-width]", 63], ["height", "[data-card-height]", 88]].forEach(([key, selector, fallback]) => root.querySelector(selector).addEventListener("change", (e) => { state[key] = Math.max(10, Number(e.target.value) || fallback); e.target.value = state[key]; persist(); })); root.querySelector("[data-download-pdf]").addEventListener("click", () => { void download(); }); root.querySelector("[data-reset-tool]").addEventListener("click", async () => { if (!window.confirm(window.tr("resetConfirm"))) return; clearTimeout(saveTimer); await clearSpriteState(); window.location.reload(); });
    readSpriteState().then((saved) => { state.hideNotPrintable = saved?.hideNotPrintable !== false; printableFilter.querySelector("[data-hide-not-printable]").checked = state.hideNotPrintable; applyPrintableFilter(); }).catch((error) => console.warn("Unable to restore print settings", error));
    await readSpriteState().then(async (saved) => {
      if (!saved?.sprites?.length) return;
      state.mode = saved.mode || "both";
      state.pageFormat = PAGE_FORMATS.includes(saved.pageFormat) ? saved.pageFormat : "A4";
      state.orientation = saved.orientation === "landscape" ? "landscape" : "portrait";
      state.view = saved.view === "single-column" ? "single-column" : "two-columns";
      state.width = saved.width || 63;
      state.height = saved.height || 88;
      state.cardOrder = Array.isArray(saved.cardOrder) ? saved.cardOrder.filter((id) => typeof id === "string") : [];
      state.sprites = await Promise.all(saved.sprites.map(async (sprite) => ({
        ...sprite,
        dpi: sprite.dpi || await imageDpi(sprite.source),
        gridType: sprite.gridType === "detect" ? "detect" : "sprite",
        manualGrid: sprite.manualGrid || { columns: sprite.columns, rows: sprite.rows },
        detectedRects: Array.isArray(sprite.detectedRects) ? sprite.detectedRects : null,
        detectedTiles: sprite.gridType === "detect"
          ? await Promise.all((sprite.detectedTiles || []).map(async (source) => ({ source, image: await loadImage(source) })))
          : null,
        cards: Array.isArray(sprite.cards) ? sprite.cards.map((card) => card ? { ...card, backSelected: false, backId: typeof card.backId === "string" ? card.backId : null } : null) : [],
        image: await loadImage(sprite.source)
      })));
      // Older/corrupted saved states can contain empty entries. Drop those before
      // rendering or sending them to the PDF worker, where they have no usable kind.
      state.backs = await Promise.all((Array.isArray(saved.backs) ? saved.backs : []).filter((back) => back && typeof back.kind === "string").map(async (back) => back.kind === "file" ? { ...back, image: await loadImage(back.source) } : back));
      state.backs.forEach((back) => {
        if (!back.customName) back.name = "";
        const sprite = state.sprites.find((entry) => entry.id === back.spriteId);
        const isLegacyAutomatic = back.kind === "sprite-last-card" || (back.kind === "sprite" && sprite && back.name === `${sprite.name} · ultima carta`);
        if (sprite && isLegacyAutomatic) {
          if (!Number.isInteger(sprite.backIndex)) sprite.backIndex = Number.isInteger(back.index) ? back.index : sprite.rows * sprite.columns - 1;
          delete back.index;
          back.kind = "sprite-grid-card";
          back.cardBack = true;
        }
      });
      let repaired = false;
      for (const sprite of state.sprites) {
        if (!hasCompleteCards(sprite)) {
          await initialize(sprite);
          repaired = true;
        } else {
          ensureAutomaticBack(sprite);
          sprite.cards.forEach((card, index) => {
            const isBack = sprite.backIndex !== null && index === sprite.backIndex;
            card.isBack = isBack;
            if (isBack) {
              card.selected = false;
              card.backSelected = false;
            }
          });
        }
      }
      root.querySelector("[data-print-mode]").value = state.mode;
      root.querySelector("[data-page-format]").value = state.pageFormat;
      root.querySelector("[data-page-orientation]").value = state.orientation;
      workspace.dataset.view = state.view;
      root.querySelector("[data-workspace-view]").value = state.view;
      root.querySelector("[data-card-width]").value = state.width;
      root.querySelector("[data-card-height]").value = state.height;
      showWorkspace();
      persist();
    }).catch((error) => console.warn("Unable to restore sprites", error));
  }
};
