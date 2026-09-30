// Corners are stored in source-image pixels, independent of the displayed size.
export const validCorners = (corners) => corners.every((point, index) => {
  const next = corners[(index + 1) % 4], after = corners[(index + 2) % 4];
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    && Math.hypot(next.x - point.x, next.y - point.y) >= 2
    && (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x) > 0;
});

export const openDetectionEditor = ({ root, sprite, t, onSave }) => {
  const regions = (sprite.detectedRegions || []).map(({ corners }, originalIndex) => ({
    originalIndex, corners: corners.map((point) => ({ ...point }))
  }));
  const width = sprite.image.naturalWidth, height = sprite.image.naturalHeight;
  let selected = regions.length ? 0 : -1, dragging = null, busy = false, zoom = 1;
  const dialog = document.createElement("dialog");
  dialog.className = "detection-editor";
  dialog.setAttribute("aria-labelledby", "detection-editor-title");
  dialog.innerHTML = `<h2 id="detection-editor-title"></h2><p class="detection-editor-help"></p>
    <fieldset class="detection-editor-toolbar"><label><span></span><select data-area></select></label>
    <button type="button" class="action-button secondary" data-add-area></button>
    <button type="button" class="action-button secondary" data-remove-area></button><span class="detection-editor-zoom"><button type="button" class="action-button secondary" data-zoom-out></button><button type="button" class="action-button secondary" data-zoom-reset></button><button type="button" class="action-button secondary" data-zoom-in></button></span></fieldset>
    <div class="detection-editor-viewport"><div class="detection-editor-stage"><img alt="" draggable="false"/><svg xmlns="http://www.w3.org/2000/svg"></svg></div></div>
    <p class="detection-editor-error" role="alert"></p>
    <div class="detection-editor-actions"><button type="button" class="action-button secondary" data-cancel></button><button type="button" class="action-button" data-save></button></div>`;
  dialog.querySelector("h2").textContent = t("editDetection");
  dialog.querySelector(".detection-editor-help").textContent = t("editDetectionHelp");
  dialog.querySelector("label span").textContent = t("detectedArea");
  for (const [selector, key] of [["[data-add-area]", "addArea"], ["[data-remove-area]", "removeArea"], ["[data-zoom-out]", "zoomOut"], ["[data-zoom-reset]", "resetZoom"], ["[data-zoom-in]", "zoomIn"], ["[data-cancel]", "cancelDetectionEdits"], ["[data-save]", "saveDetectionEdits"]]) dialog.querySelector(selector).textContent = t(key);
  const svg = dialog.querySelector("svg"), areaSelect = dialog.querySelector("[data-area]"), image = dialog.querySelector("img"), viewport = dialog.querySelector(".detection-editor-viewport");
  const save = dialog.querySelector("[data-save]"), cancel = dialog.querySelector("[data-cancel]");
  const error = dialog.querySelector(".detection-editor-error");
  image.src = sprite.image.src;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("aria-label", t("editDetection"));
  const element = (name, attributes) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };
  const render = () => {
    const scale = width / (svg.getBoundingClientRect().width || width);
    svg.replaceChildren();
    areaSelect.replaceChildren();
    regions.forEach(({ corners }, index) => {
      const option = new Option(`${t("detectedArea")} ${index + 1}`, index);
      areaSelect.add(option);
      const polygon = element("polygon", { points: corners.map(({ x, y }) => `${x},${y}`).join(" "), "data-area-index": index, class: index === selected ? "is-selected" : "" });
      svg.append(polygon);
      const label = element("text", { x: corners[0].x + 12 * scale, y: corners[0].y + 24 * scale, "font-size": 16 * scale });
      label.textContent = index + 1;
      svg.append(label);
    });
    // Selected handles stay above all polygons, including overlapping regions.
    if (selected >= 0) regions[selected].corners.forEach(({ x, y }, corner) => {
      svg.append(element("circle", { cx: x, cy: y, r: 8 * scale, "data-corner": corner,
        tabindex: "0", role: "button", "aria-label": t("areaCorner").replace("{area}", selected + 1).replace("{corner}", corner + 1) }));
    });
    areaSelect.value = String(selected);
    areaSelect.disabled = !regions.length;
    dialog.querySelector("[data-remove-area]").disabled = selected < 0;
  };
  const applyZoom = () => {
    const availableWidth = viewport.clientWidth || width, availableHeight = viewport.clientHeight || height;
    const baseWidth = Math.min(width, availableWidth, availableHeight * width / height);
    image.style.width = `${baseWidth * zoom}px`;
    render();
  };
  const changeZoom = (amount) => { zoom = Math.max(.5, Math.min(4, Math.round((zoom + amount) * 10) / 10)); applyZoom(); };
  dialog.querySelector("[data-zoom-out]").addEventListener("click", () => changeZoom(-.25));
  dialog.querySelector("[data-zoom-in]").addEventListener("click", () => changeZoom(.25));
  dialog.querySelector("[data-zoom-reset]").addEventListener("click", () => { zoom = 1; applyZoom(); });
  viewport.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? .25 : -.25);
  }, { passive: false });
  const moveCorner = (corner, point) => {
    const corners = regions[selected].corners.map((entry) => ({ ...entry }));
    corners[corner] = { x: Math.max(0, Math.min(width - 1, point.x)), y: Math.max(0, Math.min(height - 1, point.y)) };
    if (validCorners(corners)) { regions[selected].corners = corners; render(); }
  };
  svg.addEventListener("pointerdown", (event) => {
    if (busy || event.button !== 0) return;
    if (event.target.hasAttribute("data-corner")) {
      dragging = { corner: Number(event.target.dataset.corner), pointerId: event.pointerId };
      svg.setPointerCapture(event.pointerId);
      event.preventDefault();
    } else if (event.target.hasAttribute("data-area-index")) {
      selected = Number(event.target.dataset.areaIndex); render();
    }
  });
  svg.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== dragging.pointerId || busy) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    moveCorner(dragging.corner, point);
  });
  const stopDragging = () => { dragging = null; };
  svg.addEventListener("pointerup", stopDragging);
  svg.addEventListener("pointercancel", stopDragging);
  svg.addEventListener("lostpointercapture", stopDragging);
  svg.addEventListener("keydown", (event) => {
    const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (busy || !event.target.hasAttribute("data-corner") || !offsets[event.key]) return;
    event.preventDefault();
    const corner = Number(event.target.dataset.corner), point = regions[selected].corners[corner];
    const [dx, dy] = offsets[event.key], step = event.shiftKey ? 10 : 1;
    moveCorner(corner, { x: point.x + dx * step, y: point.y + dy * step });
    svg.querySelector(`[data-corner="${corner}"]`).focus();
  });
  areaSelect.addEventListener("change", () => { selected = Number(areaSelect.value); render(); });
  dialog.querySelector("[data-add-area]").addEventListener("click", () => {
    const x = width * .3, y = height * .3, right = width * .7, bottom = height * .7;
    regions.push({ originalIndex: null, corners: [{ x, y }, { x: right, y }, { x: right, y: bottom }, { x, y: bottom }] });
    selected = regions.length - 1; render();
  });
  const removeSelectedArea = () => {
    if (busy || selected < 0) return;
    const restoreFocus = svg.contains(document.activeElement);
    dragging = null;
    regions.splice(selected, 1); selected = Math.min(selected, regions.length - 1); render();
    if (restoreFocus) (selected >= 0 ? areaSelect : dialog.querySelector("[data-add-area]")).focus();
  };
  dialog.querySelector("[data-remove-area]").addEventListener("click", removeSelectedArea);
  dialog.addEventListener("keydown", (event) => {
    if (busy || selected < 0 || event.isComposing || (event.key !== "Delete" && event.key !== "Backspace")) return;
    if (event.target.closest("input, textarea") || event.target.isContentEditable) return;
    event.preventDefault();
    removeSelectedArea();
  });
  cancel.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => { if (busy) event.preventDefault(); });
  save.addEventListener("click", async () => {
    busy = true; dragging = null; error.textContent = "";
    dialog.querySelector("fieldset").disabled = true; save.disabled = true; cancel.disabled = true;
    dialog.setAttribute("aria-busy", "true"); save.textContent = t("processing");
    try { await onSave(regions); dialog.close(); }
    catch (cause) { console.error("Unable to save detection areas", cause); error.textContent = t("saveDetectionError"); }
    finally {
      busy = false; dialog.querySelector("fieldset").disabled = false; save.disabled = false; cancel.disabled = false;
      dialog.removeAttribute("aria-busy"); save.textContent = t("saveDetectionEdits");
    }
  });
  const observer = new ResizeObserver(() => applyZoom());
  root.append(dialog); dialog.showModal();
  const releaseScrollLock = window.lockPageScroll?.(dialog) || (() => {});
  dialog.addEventListener("close", () => { releaseScrollLock(); observer.disconnect(); dialog.remove(); }, { once: true });
  requestAnimationFrame(applyZoom); observer.observe(viewport);
};
