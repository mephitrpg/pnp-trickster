import { useEffect, useRef, useState } from "react";
import { withLoading } from "../../loading-overlay.tsx";
import type { Translator } from "../../../localization.ts";
import { clearState, groupCardsByFront, imageDpi, initialState, initializeCards, loadImage, numberItems, orderedCards, prepareImageFile, readState, releaseImage, restoreState, saveState, validImageFiles, type Back, type CardScale, type PrinterState, type Region, type Sprite } from "./model.ts";
import { createPreviewCache } from "./preview-cache.ts";

const spriteWorker = import("../workers/sprite-worker-client.ts");
const detectionWorker = import("../workers/detection-worker-client.ts");
export type EditedRegion = Region & { originalIndex: number | null };

export function useCardPrinter(t: Translator) {
  const [state, setState] = useState<PrinterState>(initialState);
  const stateRef = useRef(state);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const saveVersion = useRef(0);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const preview = useRef(createPreviewCache()).current;
  const [busy, setBusy] = useState(false);
  const [editingSpriteId, setEditingSpriteId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  function queueSave() {
    const version = saveVersion.current;
    writeQueue.current = writeQueue.current.catch(() => {}).then(() => saveState(stateRef.current)).then(() => {
      if (saveVersion.current === version) dirty.current = false;
    }).catch((error) => console.warn("Unable to save sprites", error));
    return writeQueue.current;
  }

  function publish(save = true) {
    if (!mounted.current) return;
    numberItems(stateRef.current);
    stateRef.current.cardOrder = orderedCards(stateRef.current).map((entry) => entry.id);
    setState({ ...stateRef.current });
    if (!save) return;
    dirty.current = true;
    saveVersion.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const current = stateRef.current;
      if (current.sprites.some((sprite) => sprite.isGridLoading || !Array.isArray(sprite.cards) || sprite.cards.length !== sprite.rows * sprite.columns)) return;
      void queueSave();
    }, 250);
  }
  function mutate(change: (current: PrinterState) => void, save = true) { change(stateRef.current); publish(save); }
  function currentSprite(id: string) { return stateRef.current.sprites.find((sprite) => sprite.id === id); }
  function selectedBackTargets() { return orderedCards(stateRef.current).filter(({ sprite, index }) => !sprite.isGridLoading && sprite.cards[index]?.backSelected && !sprite.cards[index]?.isBack); }
  function spriteName(sprite: Sprite) { return sprite.name?.trim() || t("spritePlaceholder").replace("{number}", String(sprite.gridNumber)); }
  function backName(back: Back) { return back.name?.trim() || t("backPlaceholder").replace("{number}", String(back.backNumber)); }

  useEffect(() => {
    mounted.current = true;
    void withLoading(async () => {
      const saved = await readState();
      const restored = await restoreState(saved, await spriteWorker);
      if (mounted.current) { stateRef.current = restored; publish(); }
      else restored.sprites.forEach((sprite) => { releaseImage(sprite.image); sprite.detectedTiles?.forEach((tile) => releaseImage(tile.image)); });
    }).catch((error) => console.warn("Unable to restore sprites", error));
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current && stateRef.current.sprites.every((sprite) => !sprite.isGridLoading && Array.isArray(sprite.cards) && sprite.cards.length === sprite.rows * sprite.columns)) {
        void queueSave();
      }
      stateRef.current.sprites.forEach((sprite) => { releaseImage(sprite.image); sprite.detectedTiles?.forEach((tile) => releaseImage(tile.image)); });
      stateRef.current.backs.forEach((back) => releaseImage(back.image));
      preview.clear();
    };
  }, []);

  async function addSprites(files: FileList | File[]) {
    const images = validImageFiles(files);
    if (!images.length) return;
    await withLoading(async () => {
      const worker = await spriteWorker;
      for (const original of images) {
        const [dpi, source] = await Promise.all([imageDpi(original), prepareImageFile(original)]);
        const image = await loadImage(source);
        const sprite: Sprite = { id: crypto.randomUUID(), name: "", fileName: original.name, source, image, dpi, gridNumber: 0, gridType: "sprite", columns: 1, rows: 1, manualGrid: { columns: 1, rows: 1 }, detectedRects: null, detectedRegions: null, detectedTiles: null, backIndex: null, backFollowsLast: false, cards: [] };
        stateRef.current.sprites.push(sprite);
        await initializeCards(stateRef.current, sprite, worker);
        publish();
      }
    });
  }
  async function addBacks(files: FileList | File[]) {
    const images = validImageFiles(files);
    if (!images.length) return;
    await withLoading(async () => {
      for (const original of images) {
        const source = await prepareImageFile(original);
        stateRef.current.backs.push({ id: crypto.randomUUID(), kind: "file", name: "", fileName: original.name, source, image: await loadImage(source) });
        publish();
      }
    });
  }
  async function recalculate(sprite: Sprite) {
    sprite.isGridLoading = true;
    sprite.loadingStartedAt = Date.now();
    publish(false);
    try { await initializeCards(stateRef.current, sprite, await spriteWorker); }
    finally { sprite.isGridLoading = false; sprite.gridProgress = undefined; sprite.loadingStartedAt = undefined; publish(); }
  }
  function removeSprite(id: string) {
    const sprite = currentSprite(id);
    if (!sprite) return;
    releaseImage(sprite.image);
    sprite.detectedTiles?.forEach((tile) => releaseImage(tile.image));
    preview.clearSprite(id);
    mutate((s) => {
      const removedBacks = new Set(s.backs.filter((back) => back.spriteId === id).map((back) => back.id));
      s.sprites = s.sprites.filter((entry) => entry.id !== id);
      s.backs = s.backs.filter((back) => back.spriteId !== id);
      s.cardOrder = s.cardOrder.filter((cardId) => !cardId.startsWith(`${id}:`));
      s.sprites.forEach((entry) => entry.cards.forEach((card) => { if (removedBacks.has(card.backId)) card.backId = null; }));
    });
  }
  function removeBack(id: string) {
    const back = stateRef.current.backs.find((entry) => entry.id === id);
    releaseImage(back?.image); preview.clearBack(id);
    mutate((s) => { s.backs = s.backs.filter((entry) => entry.id !== id); s.sprites.forEach((sprite) => sprite.cards.forEach((card) => { if (card.backId === id) card.backId = null; })); });
  }
  async function updateGrid(id: string, key: "columns" | "rows", value: number) {
    const sprite = currentSprite(id);
    if (!sprite || sprite.gridType === "detect") return;
    sprite[key] = Math.max(1, Math.min(12, value || 1));
    const total = sprite.rows * sprite.columns;
    if (sprite.backIndex !== null && sprite.backIndex >= total) sprite.backIndex = total - 1;
    sprite.manualGrid = { columns: sprite.columns, rows: sprite.rows };
    groupCardsByFront(stateRef.current);
    preview.clearSprite(id);
    await recalculate(sprite);
  }
  async function updateGridType(id: string, type: "sprite" | "detect") {
    const sprite = currentSprite(id);
    if (!sprite || sprite.isGridLoading) return;
    if (type === "detect") { sprite.manualGrid = { columns: sprite.columns, rows: sprite.rows }; sprite.gridType = "detect"; publish(); }
    else {
      sprite.gridType = "sprite";
      sprite.detectedTiles?.forEach((tile) => releaseImage(tile.image));
      sprite.detectedTiles = null; sprite.detectedRects = null; sprite.detectedRegions = null;
      sprite.columns = sprite.manualGrid?.columns || 1; sprite.rows = sprite.manualGrid?.rows || 1;
      preview.clearSprite(id);
      await recalculate(sprite);
    }
  }
  async function updateAutomaticBack(id: string, index: number | null) {
    const sprite = currentSprite(id);
    if (!sprite) return;
    sprite.backIndex = index === null ? null : Math.max(0, Math.min(sprite.rows * sprite.columns - 1, index));
    sprite.backFollowsLast = sprite.backIndex === sprite.rows * sprite.columns - 1;
    preview.clearSprite(id);
    await recalculate(sprite);
  }
  async function detect(id: string) {
    const sprite = currentSprite(id);
    if (!sprite || sprite.isGridLoading) return;
    groupCardsByFront(stateRef.current);
    setBusy(true); sprite.isGridLoading = true; sprite.gridProgress = 0; sprite.loadingStartedAt = Date.now(); publish(false);
    try {
      const detector = await detectionWorker;
      const previous = sprite.cards.map(({ selected, backSelected, backId }) => ({ selected, backSelected, backId }));
      const { sources, regions } = await detector.detectAndStraighten(sprite.source, (progress) => { if (progress >= 100 || progress - (sprite.gridProgress || 0) >= 2) { sprite.gridProgress = progress; publish(false); } }, (requestId) => { sprite.detectRequestId = requestId; });
      sprite.detectRequestId = undefined;
      const tiles = await Promise.all(sources.map(async (source) => ({ source, image: await loadImage(source) })));
      if (!tiles.length) { window.alert(t("detectNone")); return; }
      sprite.detectedTiles?.forEach((tile) => releaseImage(tile.image));
      sprite.gridType = "detect"; sprite.detectedRegions = regions; sprite.detectedTiles = tiles; sprite.detectedRects = null;
      sprite.columns = tiles.length; sprite.rows = 1; sprite.backIndex = null; sprite.backFollowsLast = false;
      groupCardsByFront(stateRef.current);
      preview.clearSprite(id);
      await initializeCards(stateRef.current, sprite, await spriteWorker);
      previous.forEach((card, index) => { if (sprite.cards[index]) Object.assign(sprite.cards[index], card); });
    } catch (error: any) { if (error?.name !== "AbortError") { console.error("Unable to detect cards", error); window.alert(t("detectionError")); } }
    finally { sprite.detectRequestId = undefined; sprite.gridProgress = undefined; sprite.isGridLoading = false; setBusy(false); publish(); }
  }
  async function cancelDetection(id: string) {
    const sprite = currentSprite(id);
    if (sprite?.detectRequestId) (await detectionWorker).cancelDetection(sprite.detectRequestId);
  }
  async function saveDetectionAreas(id: string, areas: EditedRegion[]) {
    const sprite = currentSprite(id);
    if (!sprite) return;
    const detector = await detectionWorker;
    const { sources, regions } = await detector.straightenRegions(sprite.source, areas.map(({ corners }) => ({ corners })));
    const tiles = await Promise.all(sources.map(async (source) => ({ source, image: await loadImage(source) })));
    const previous = areas.map(({ originalIndex }) => originalIndex === null ? null : sprite.cards[originalIndex]);
    const indices = new Map(areas.flatMap(({ originalIndex }, index) => originalIndex === null ? [] : [[originalIndex, index]]));
    const removedBacks = new Set<string>();
    stateRef.current.backs = stateRef.current.backs.filter((back) => {
      if (back.spriteId !== id || back.kind !== "sprite") return true;
      if (!indices.has(back.index!)) { removedBacks.add(back.id); return false; }
      back.index = indices.get(back.index!); return true;
    });
    stateRef.current.sprites.forEach((entry) => entry.cards.forEach((card) => { if (removedBacks.has(card.backId)) card.backId = null; }));
    stateRef.current.cardOrder = stateRef.current.cardOrder.flatMap((cardId) => {
      if (!cardId.startsWith(`${id}:`)) return [cardId];
      const index = indices.get(Number(cardId.slice(id.length + 1)));
      return index === undefined ? [] : [`${id}:${index}`];
    });
    sprite.backIndex = indices.get(sprite.backIndex!) ?? null; sprite.backFollowsLast = false;
    const oldTiles = sprite.detectedTiles;
    sprite.detectedTiles = tiles; sprite.detectedRegions = regions; sprite.detectedRects = null; sprite.columns = tiles.length; sprite.rows = 1;
    preview.clearSprite(id);
    await recalculate(sprite);
    const availableBacks = new Set(stateRef.current.backs.map((back) => back.id));
    previous.forEach((card, index) => { if (card && sprite.cards[index]) Object.assign(sprite.cards[index], { selected: card.selected, backSelected: card.backSelected, backId: availableBacks.has(card.backId) ? card.backId : null, frontScale: card.frontScale, backScale: card.backScale }); });
    oldTiles?.forEach((tile) => releaseImage(tile.image));
    publish();
  }
  function selectCard(id: string, event: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
    const entries = orderedCards(stateRef.current);
    const target = entries.find((entry) => entry.id === id);
    if (!target || target.sprite.cards[target.index]?.isBack) return;
    const anchor = entries.findIndex((entry) => entry.id === stateRef.current.selectionAnchorId);
    const targetIndex = entries.indexOf(target);
    const additive = event.ctrlKey || event.metaKey;
    const range = event.shiftKey && anchor >= 0 ? [Math.min(anchor, targetIndex), Math.max(anchor, targetIndex)] : null;
    mutate((s) => {
      if (range) {
        if (!additive) entries.forEach(({ sprite, index }) => { sprite.cards[index].backSelected = false; });
        entries.slice(range[0], range[1] + 1).forEach(({ sprite, index }) => { if (!sprite.cards[index].isBack) sprite.cards[index].backSelected = true; });
      } else if (additive) target.sprite.cards[target.index].backSelected = !target.sprite.cards[target.index].backSelected;
      else {
        const selected = entries.filter(({ sprite, index }) => sprite.cards[index].backSelected && !sprite.cards[index].isBack);
        const toggleOff = selected.length === 1 && selected[0] === target;
        entries.forEach(({ sprite, index }) => { sprite.cards[index].backSelected = false; });
        target.sprite.cards[target.index].backSelected = !toggleOff;
      }
      s.selectionAnchorId = id;
    });
  }
  function selectAllCards() {
    mutate((s) => {
      const selectable = orderedCards(s).filter(({ sprite, index }) => sprite.cards[index] && !sprite.cards[index].isBack && (!s.hideNotPrintable || sprite.cards[index].selected));
      const allSelected = selectable.length > 0 && selectable.every(({ sprite, index }) => sprite.cards[index].backSelected);
      selectable.forEach(({ sprite, index }) => { sprite.cards[index].backSelected = !allSelected; });
      s.selectionAnchorId = null;
    });
  }
  function selectGrid(id: string, value: boolean) { mutate((s) => { s.sprites.find((sprite) => sprite.id === id)?.cards.forEach((card) => { card.backSelected = value && !card.isBack; }); s.selectionAnchorId = null; }); }
  function applyBack(id: string) { mutate((s) => { selectedBackTargets().forEach(({ sprite, index }) => { sprite.cards[index].backId = id; }); }); }
  function setCardBack(id: string, backId: string | null) {
    mutate((s) => {
      const targets = selectedBackTargets();
      const [spriteId, index] = id.split(":");
      const own = orderedCards(s).find((entry) => entry.sprite.id === spriteId && entry.index === Number(index));
      (targets.length ? targets : own ? [own] : []).forEach(({ sprite, index }) => { sprite.cards[index].backId = backId; });
    });
  }
  function setCardScale(id: string, side: "front" | "back", scale: CardScale) {
    mutate((s) => {
      const targets = selectedBackTargets();
      const own = orderedCards(s).find((entry) => entry.id === id);
      (targets.length ? targets : own ? [own] : []).forEach(({ sprite, index }) => {
        sprite.cards[index][side === "front" ? "frontScale" : "backScale"] = scale;
      });
    });
  }
  function reorderCards(ids: string[], targetId: string) {
    mutate((s) => {
      const order = orderedCards(s).map((entry) => entry.id).filter((id) => !ids.includes(id));
      const index = order.indexOf(targetId);
      if (index >= 0) s.cardOrder = [...order.slice(0, index), ...ids, ...order.slice(index)];
    });
  }
  async function download() {
    if (busy) return;
    const current = stateRef.current;
    const selected = orderedCards(current).filter(({ sprite, index }) => sprite.cards[index]?.selected && !sprite.cards[index]?.isBack);
    if (!selected.length) return;
    setBusy(true);
    try {
      const bytes = await withLoading(async () => (await spriteWorker).createPdf({
        sprites: current.sprites.filter((sprite) => sprite?.id && sprite.source).map(({ id, source, columns, rows, backIndex, detectedRects, detectedTiles }) => ({ id, source, columns, rows, backIndex, detectedRects, detectedTiles: detectedTiles?.filter((tile) => tile?.source).map((tile) => tile.source) })),
        backs: current.backs.filter((back) => back?.id && typeof back.kind === "string").map(({ id, kind, spriteId, index, source }) => ({ id, kind, spriteId, index, source })),
        selected: selected.map(({ sprite, index }) => ({ spriteId: sprite.id, columns: sprite.columns, rows: sprite.rows, index, backId: sprite.cards[index].backId, frontScale: sprite.cards[index].frontScale, backScale: sprite.cards[index].backScale })),
        mode: current.mode, pageFormat: current.pageFormat, orientation: current.orientation, width: current.width, height: current.height
      })) as Uint8Array;
      if (typeof window.showPdfPreview === "function") await window.showPdfPreview(bytes, t("cardsPdfFilename"));
      else {
        const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
        Object.assign(document.createElement("a"), { href: url, download: t("cardsPdfFilename") }).click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) { console.error("Unable to create PDF", error); window.alert(t("pdfCreateError")); }
    finally { setBusy(false); }
  }
  async function reset() { if (!window.confirm(t("resetConfirm"))) return; if (timer.current) clearTimeout(timer.current); dirty.current = false; await writeQueue.current; await clearState(); window.location.reload(); }

  const entries = orderedCards(state);
  const selected = entries.filter(({ sprite, index }) => sprite.cards[index]?.selected && !sprite.cards[index]?.isBack);
  const selectable = entries.filter(({ sprite, index }) => sprite.cards[index] && !sprite.cards[index].isBack && (!state.hideNotPrintable || sprite.cards[index].selected));
  const allSelected = selectable.length > 0 && selectable.every(({ sprite, index }) => sprite.cards[index].backSelected);
  const selectedTargets = entries.filter(({ sprite, index }) => sprite.cards[index]?.backSelected && !sprite.cards[index]?.isBack);
  const unprintable = entries.filter(({ sprite, index }) => sprite.cards[index] && (sprite.cards[index].isBack || !sprite.cards[index].selected)).length;
  return {
    state, entries, selected, selectable, allSelected, selectedTargets, unprintable, busy, preview,
    spriteName, backName, addSprites, addBacks, removeSprite, removeBack, updateGrid, updateGridType,
    updateAutomaticBack, detect, cancelDetection, saveDetectionAreas, selectCard, selectAllCards,
    selectGrid, applyBack, setCardBack, setCardScale, reorderCards, download, reset,
    editingSpriteId, setEditingSpriteId, lightbox, setLightbox,
    mutate, publish,
  };
}
export type CardPrinterController = ReturnType<typeof useCardPrinter>;
