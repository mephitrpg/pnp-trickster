// Load the worker with missing-back guards even if an older URL is cached.
const worker = new Worker(new URL("./sprite-worker.ts", import.meta.url), { type: "module" });
let nextRequestId = 0;
const pending = new Map();

worker.addEventListener("message", ({ data }) => {
  // Ignore messages that are not responses from this worker. This prevents an
  // unexpected event from hiding the actual PDF-generation error below.
  if (!data || typeof data.id !== "number") return;
  const request = pending.get(data.id);
  if (!request) return;
  pending.delete(data.id);
  if (data.error) {
    const error = new Error(data.error);
    if (data.errorName) error.name = data.errorName;
    if (data.errorStack) error.stack = data.errorStack;
    request.reject(error);
  } else {
    request.resolve(data.result);
  }
});

worker.addEventListener("error", (event) => {
  const error = event.error || new Error(event.message || "Sprite worker failed");
  pending.forEach(({ reject }) => reject(error));
  pending.clear();
});

const request = (type, payload) => new Promise((resolve, reject) => {
  const id = ++nextRequestId;
  pending.set(id, { resolve, reject });
  worker.postMessage({ id, type, payload });
});

export const initialSelection = (source, columns, rows, backIndex, detectedRects, detectedTiles) => request("initial-selection", { source, columns, rows, backIndex, detectedRects, detectedTiles });
export const monochrome = (source, columns, rows, index) => request("monochrome", { source, columns, rows, index });
export const createPdf = (payload) => request("create-pdf", payload);
