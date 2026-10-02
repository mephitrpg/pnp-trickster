const worker = new Worker(new URL("./detection-worker.ts", import.meta.url));
let nextRequestId = 0;
const pending = new Map();

worker.addEventListener("message", ({ data }) => {
  const request = pending.get(data?.id);
  if (!request) return;
  if (Number.isFinite(data.progress)) { request.onProgress(data.progress); return; }
  pending.delete(data.id);
  data.error ? request.reject(new Error(data.error)) : request.resolve(data.result);
});
worker.addEventListener("error", (event) => { pending.forEach(({ reject }) => reject(event.error || new Error("Detection worker failed"))); pending.clear(); });

export type DetectionResult = { sources: Blob[]; regions: Array<{ corners: Array<{ x: number; y: number }> }> };
const request = (type: string, source: Blob, regions?: unknown, onProgress: (progress: number) => void = () => {}, onStart: (id: number) => void = () => {}) => new Promise<DetectionResult>((resolve, reject) => {
  const id = ++nextRequestId;
  pending.set(id, { resolve, reject, onProgress });
  onStart(id);
  createImageBitmap(source).then((bitmap) => {
    if (!pending.has(id)) { bitmap.close(); return; }
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0); bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    worker.postMessage({ id, type, regions, source: { width: canvas.width, height: canvas.height, pixels: pixels.data.buffer } }, [pixels.data.buffer]);
  }).catch((error) => { pending.delete(id); reject(error); });
});
export const detectAndStraighten = (source, onProgress, onStart) => request("detect", source, undefined, onProgress, onStart);
export const straightenRegions = (source, regions) => request("rectify", source, regions);
export const cancelDetection = (id) => { const request = pending.get(id); if (!request) return; pending.delete(id); worker.postMessage({ id, type: "cancel" }); request.reject(new DOMException("Detection cancelled", "AbortError")); };
