import { readImageDpi } from "../utils/image-dpi.ts";

export type CardScale = "stretch" | "cover" | "contain";
export type Card = { selected: boolean; backSelected: boolean; isBack: boolean; backId: string | null; frontScale: CardScale; backScale: CardScale };
export const cardScale = (value: unknown): CardScale => value === "cover" || value === "contain" ? value : "stretch";
export type Region = { corners: Array<{ x: number; y: number }> };
export type Sprite = {
  id: string; name: string; fileName: string; source: Blob; image: HTMLImageElement;
  dpi: { x: number; y: number } | null; gridNumber: number; gridType: "sprite" | "detect";
  columns: number; rows: number; manualGrid: { columns: number; rows: number };
  detectedRects: any[] | null; detectedRegions: Region[] | null;
  detectedTiles: Array<{ source: Blob; image: HTMLImageElement }> | null;
  backIndex: number | null; backFollowsLast: boolean; cards: Card[];
  isGridLoading?: boolean; gridProgress?: number; detectRequestId?: number; loadingStartedAt?: number;
};
export type Back = {
  id: string; kind: "file" | "sprite" | "sprite-grid-card" | "sprite-last-card"; name: string;
  fileName?: string; source?: Blob; image?: HTMLImageElement; spriteId?: string;
  index?: number; cardBack?: boolean; customName?: boolean; backNumber?: number;
};
export type PrinterState = {
  sprites: Sprite[]; backs: Back[]; cardOrder: string[];
  mode: "front" | "back" | "both"; pageFormat: string;
  orientation: "portrait" | "landscape"; width: number; height: number;
  hideNotPrintable: boolean; view: "two-columns" | "single-column";
  selectionAnchorId: string | null;
};

export const PAGE_FORMATS = ["4A0", "2A0", "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "B0", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "RA0", "RA1", "RA2", "RA3", "RA4", "SRA0", "SRA1", "SRA2", "SRA3", "SRA4", "Executive", "Folio", "Legal", "Letter", "Tabloid"];
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,image/tiff,.tif,.tiff,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif";
const SPRITE_STORE = "pnp-trickster-sprites";
export const initialState = (): PrinterState => ({ sprites: [], backs: [], cardOrder: [], mode: "both", pageFormat: "A4", orientation: "portrait", width: 63, height: 88, hideNotPrintable: true, view: "two-columns", selectionAnchorId: null });

export function validImageFiles(files: FileList | File[] | null): File[] {
  return Array.from(files || []).filter((file) => file.type.startsWith("image/") || /\.(?:png|jpe?g|webp|gif|bmp|avif|tiff?)$/i.test(file.name));
}
export async function prepareImageFile(file: File): Promise<File> {
  if (!(["image/tiff", "image/tif"].includes(file.type.toLowerCase()) || /\.tiff?$/i.test(file.name))) return file;
  if (!window.UTIF) throw new Error("TIFF decoder unavailable");
  const bytes = await file.arrayBuffer();
  const pages = window.UTIF.decode(bytes);
  if (!pages.length) throw new Error("Invalid TIFF file");
  window.UTIF.decodeImage(bytes, pages[0]);
  const canvas = document.createElement("canvas");
  canvas.width = pages[0].width; canvas.height = pages[0].height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(window.UTIF.toRGBA8(pages[0])), canvas.width, canvas.height), 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("TIFF conversion failed")), "image/png"));
  return new File([blob], file.name.replace(/\.tiff?$/i, ".png"), { type: "image/png" });
}
export const loadImage = (source: Blob) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  const url = URL.createObjectURL(source);
  image.onload = () => resolve(image);
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Unable to load image")); };
  image.src = url;
});
export function releaseImage(image?: HTMLImageElement) { if (image?.src.startsWith("blob:")) URL.revokeObjectURL(image.src); }
export const imageDpi = readImageDpi;

const openStore = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(SPRITE_STORE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore("state");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function readState(): Promise<any> {
  const db = await openStore();
  try {
    const request = db.transaction("state", "readonly").objectStore("state").get("current");
    return await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  } finally { db.close(); }
}
export async function saveState(state: PrinterState) {
  const db = await openStore();
  try {
    const transaction = db.transaction("state", "readwrite");
    transaction.objectStore("state").put({
      mode: state.mode, orientation: state.orientation, pageFormat: state.pageFormat,
      width: state.width, height: state.height, hideNotPrintable: state.hideNotPrintable,
      view: state.view, cardOrder: state.cardOrder,
      sprites: state.sprites.map(({ id, name, fileName, source, dpi, gridNumber, gridType, columns, rows, manualGrid, detectedRects, detectedRegions, detectedTiles, backIndex, backFollowsLast, cards }) => ({
        id, name, fileName, source, dpi, gridNumber, gridType, columns, rows, manualGrid,
        detectedRects, detectedRegions, detectedTiles: detectedTiles?.map((tile) => tile.source),
        backIndex, backFollowsLast, cards: cards.map(({ backSelected, ...card }) => card)
      })),
      backs: state.backs.filter((back) => back?.id && typeof back.kind === "string").map(({ id, name, fileName, kind, spriteId, index, source, cardBack, customName, backNumber }) => ({ id, name, fileName, kind, spriteId, index, source, cardBack, customName, backNumber }))
    }, "current");
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
  } finally { db.close(); }
}
export async function clearState() {
  const db = await openStore();
  try {
    const transaction = db.transaction("state", "readwrite");
    transaction.objectStore("state").delete("current");
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
  } finally { db.close(); }
}

export type CardEntry = { sprite: Sprite; index: number; id: string };
export function orderedCards(state: PrinterState): CardEntry[] {
  const natural = state.sprites.flatMap((sprite) => Array.from({ length: sprite.rows * sprite.columns }, (_, index) => ({ sprite, index, id: `${sprite.id}:${index}` })));
  const entries = new Map(natural.map((entry) => [entry.id, entry]));
  const ordered = state.cardOrder.flatMap((id) => entries.has(id) ? [entries.get(id)!] : []);
  const known = new Set(ordered.map((entry) => entry.id));
  natural.forEach((entry) => { if (!known.has(entry.id)) ordered.push(entry); });
  return ordered;
}
export function groupCardsByFront(state: PrinterState) {
  const groups = new Map<string, string[]>();
  orderedCards(state).forEach(({ sprite, id }) => {
    if (!groups.has(sprite.id)) groups.set(sprite.id, []);
    groups.get(sprite.id)!.push(id);
  });
  state.cardOrder = [...groups.values()].flat();
}
export function numberItems(state: PrinterState) {
  let grid = Math.max(0, ...state.sprites.filter((sprite) => Number.isInteger(sprite.gridNumber) && sprite.gridNumber > 0).map((sprite) => sprite.gridNumber));
  state.sprites.forEach((sprite) => { if (!Number.isInteger(sprite.gridNumber) || sprite.gridNumber < 1) sprite.gridNumber = ++grid; });
  let back = Math.max(0, ...state.backs.filter((entry) => Number.isInteger(entry.backNumber) && entry.backNumber! > 0).map((entry) => entry.backNumber!));
  state.backs.forEach((entry) => { if (!Number.isInteger(entry.backNumber) || entry.backNumber! < 1) entry.backNumber = ++back; });
}
export function ensureAutomaticBack(state: PrinterState, sprite: Sprite): Back | null {
  const total = sprite.rows * sprite.columns;
  if (typeof sprite.backFollowsLast !== "boolean") sprite.backFollowsLast = !Number.isInteger(sprite.backIndex) || sprite.backIndex === total - 1;
  const automatic = state.backs.filter((back) => back.kind === "sprite-grid-card" && back.spriteId === sprite.id);
  const legacy = state.backs.filter((back) => back.kind === "sprite" && back.cardBack && back.spriteId === sprite.id);
  if (sprite.backIndex === null) {
    const removed = new Set([...automatic, ...legacy].map((back) => back.id));
    state.backs = state.backs.filter((back) => !removed.has(back.id));
    state.sprites.forEach((entry) => entry.cards?.forEach((card) => { if (removed.has(card.backId)) card.backId = null; }));
    return null;
  }
  sprite.backIndex = Math.max(0, Math.min(total - 1, sprite.backIndex));
  const back = automatic[0] || { id: crypto.randomUUID(), kind: "sprite-grid-card" as const, spriteId: sprite.id, cardBack: true, name: "" };
  if (!automatic.length) state.backs.push(back);
  const duplicate = new Set([...automatic.slice(1), ...legacy].map((entry) => entry.id));
  state.sprites.forEach((entry) => entry.cards?.forEach((card) => { if (duplicate.has(card.backId)) card.backId = back.id; }));
  state.backs = state.backs.filter((entry) => !duplicate.has(entry.id));
  if (!back.customName) back.name = "";
  return back;
}
export async function initializeCards(state: PrinterState, sprite: Sprite, worker: typeof import("../workers/sprite-worker-client.ts")) {
  const backId = ensureAutomaticBack(state, sprite)?.id || null;
  const previous = sprite.cards || [];
  let selected: boolean[];
  try { selected = await worker.initialSelection(sprite.source, sprite.columns, sprite.rows, sprite.backIndex, sprite.detectedRects, sprite.detectedTiles?.map((tile) => tile.source)) as boolean[]; }
  catch (error) { console.warn("Unable to determine printable sprite cards", error); selected = Array.from({ length: sprite.columns * sprite.rows }, (_, index) => index !== sprite.backIndex); }
  sprite.cards = selected.map((value, index) => ({ selected: value, backSelected: false, isBack: index === sprite.backIndex, backId: state.backs.some((back) => back.id === previous[index]?.backId) ? previous[index].backId : backId, frontScale: cardScale(previous[index]?.frontScale), backScale: cardScale(previous[index]?.backScale) }));
}
export async function restoreState(saved: any, worker: typeof import("../workers/sprite-worker-client.ts")): Promise<PrinterState> {
  const state = initialState();
  if (!saved) return state;
  state.hideNotPrintable = saved.hideNotPrintable !== false;
  if (!saved.sprites?.length) return state;
  state.mode = ["front", "back", "both"].includes(saved.mode) ? saved.mode : "both";
  state.pageFormat = PAGE_FORMATS.includes(saved.pageFormat) ? saved.pageFormat : "A4";
  state.orientation = saved.orientation === "landscape" ? "landscape" : "portrait";
  state.view = saved.view === "single-column" ? "single-column" : "two-columns";
  state.width = saved.width || 63; state.height = saved.height || 88;
  state.cardOrder = Array.isArray(saved.cardOrder) ? saved.cardOrder.filter((id: unknown) => typeof id === "string") : [];
  state.sprites = await Promise.all(saved.sprites.map(async (sprite: any) => ({
    ...sprite, dpi: sprite.dpi || await imageDpi(sprite.source),
    gridType: sprite.gridType === "detect" ? "detect" : "sprite",
    manualGrid: sprite.manualGrid || { columns: sprite.columns, rows: sprite.rows },
    detectedRects: Array.isArray(sprite.detectedRects) ? sprite.detectedRects : null,
    detectedTiles: sprite.gridType === "detect" ? await Promise.all((sprite.detectedTiles || []).map(async (source: Blob) => ({ source, image: await loadImage(source) }))) : null,
    cards: Array.isArray(sprite.cards) ? sprite.cards.map((card: Card | null) => card ? { ...card, backSelected: false, backId: typeof card.backId === "string" ? card.backId : null, frontScale: cardScale(card.frontScale ?? sprite.scale), backScale: cardScale(card.backScale) } : null) : [],
    image: await loadImage(sprite.source)
  })));
  state.backs = await Promise.all((Array.isArray(saved.backs) ? saved.backs : []).filter((back: any) => back && typeof back.kind === "string").map(async (back: any) => back.kind === "file" ? { ...back, image: await loadImage(back.source) } : back));
  state.backs.forEach((back) => {
    if (!back.customName) back.name = "";
    const sprite = state.sprites.find((entry) => entry.id === back.spriteId);
    const legacy = back.kind === "sprite-last-card" || (back.kind === "sprite" && sprite && back.name === `${sprite.name} · ultima carta`);
    if (sprite && legacy) { if (!Number.isInteger(sprite.backIndex)) sprite.backIndex = Number.isInteger(back.index) ? back.index : sprite.rows * sprite.columns - 1; delete back.index; back.kind = "sprite-grid-card"; back.cardBack = true; }
  });
  for (const sprite of state.sprites) sprite.cards.forEach((card, index) => {
    if (!card || saved.sprites.find((entry: any) => entry.id === sprite.id)?.cards?.[index]?.backScale) return;
    const back = state.backs.find((entry) => entry.id === card.backId);
    card.backScale = cardScale(saved.sprites.find((entry: any) => entry.id === back?.spriteId)?.scale);
  });
  for (const sprite of state.sprites) {
    if (!Array.isArray(sprite.cards) || sprite.cards.length !== sprite.rows * sprite.columns || sprite.cards.some((card) => !card)) await initializeCards(state, sprite, worker);
    else {
      ensureAutomaticBack(state, sprite);
      sprite.cards.forEach((card, index) => { card.isBack = sprite.backIndex !== null && index === sprite.backIndex; if (card.isBack) { card.selected = false; card.backSelected = false; } });
    }
  }
  numberItems(state);
  return state;
}
