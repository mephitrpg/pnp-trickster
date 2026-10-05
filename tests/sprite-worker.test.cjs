const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { compileTypeScript } = require("./load-typescript.cjs");
let PDFDocument, PDFDict, PDFName, rgb;

test.before(async () => {
  const library = readFileSync(path.join(__dirname, "../vendor/pdf-lib.esm.min.js"));
  ({ PDFDocument, PDFDict, PDFName, rgb } = await import(`data:text/javascript;base64,${library.toString("base64")}`));
});

const workerPath = path.join(__dirname, "../src/tools/CardPrinter/workers/sprite-worker.ts");
// Run the actual worker handler with the vendored pdf-lib library. Only the
// browser image APIs are replaced; PDF encoding and parsing remain real.
const workerSource = compileTypeScript(readFileSync(workerPath, "utf8")).replace(/^import .*\r?\n/, "\n");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aoyoAAAAASUVORK5CYII=", "base64");

function makeWorker() {
  let messageHandler;
  let response;
  const drawCalls = [];
  const bitmaps = [];
  class OffscreenCanvas {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }
    getContext() {
      return {
        fillRect() {},
        drawImage(bitmap, x, y, width, height) {
          if (bitmap.name) drawCalls.push({ source: bitmap.name, x, y, width, height });
        }
      };
    }
    async convertToBlob() {
      return { arrayBuffer: async () => Uint8Array.from(png).buffer };
    }
  }
  // Compile in this realm so pdf-lib's instanceof checks see native arrays.
  vm.compileFunction(workerSource, ["PDFDocument", "rgb", "OffscreenCanvas", "createImageBitmap", "self"], { filename: workerPath })(
    PDFDocument, rgb, OffscreenCanvas,
    async (source) => {
      assert.ok(source, "Image decoding requires a source");
      const bitmap = { ...source, closed: false, close() { this.closed = true; } };
      bitmaps.push(bitmap);
      return bitmap;
    },
    {
      addEventListener(type, handler) {
        assert.equal(type, "message");
        messageHandler = handler;
      },
      postMessage(message) { response = message; }
    }
  );
  return {
    drawCalls, bitmaps,
    async send(type, payload) {
      response = undefined;
      await messageHandler({ data: { id: 1, type, payload } });
      assert.equal(response?.id, 1, "Worker responds to the original request");
      return response;
    }
  };
}

function payloadFor(backId = null, backs = []) {
  return {
    sprites: [{
      id: "sheet", source: { name: "sheet", width: 4, height: 2 },
      columns: 2, rows: 1, backIndex: 1
    }],
    backs,
    selected: [{ spriteId: "sheet", columns: 2, rows: 1, index: 0, backId }],
    mode: "both", width: 63, height: 88
  };
}

async function exportedImageCounts(worker, payload) {
  const response = await worker.send("create-pdf", payload);
  assert.equal(response.error, undefined, response.error);
  assert.ok(response.result instanceof Uint8Array);
  const pdf = await PDFDocument.load(response.result);
  assert.ok(worker.bitmaps.every((bitmap) => bitmap.closed), "Export releases decoded images");
  return pdf.getPages().map((page) => {
    const images = page.node.Resources().lookupMaybe(PDFName.of("XObject"), PDFDict);
    return images?.keys().length || 0;
  });
}

for (const { name, backId, backs } of [
  { name: "an unassigned back", backId: null, backs: [] },
  { name: "a deleted back", backId: "deleted", backs: [] },
  { name: "undefined and null saved backs", backId: "deleted", backs: [undefined, null] },
  { name: "a back whose sprite was deleted", backId: "back", backs: [{ id: "back", kind: "sprite-grid-card", spriteId: "deleted" }] }
]) {
  test(`exports a front and a blank reverse for ${name}`, async () => {
    const worker = makeWorker();
    assert.deepEqual(await exportedImageCounts(worker, payloadFor(backId, backs)), [1, 0]);
    assert.deepEqual(worker.drawCalls, [{ source: "sheet", x: 0, y: 0, width: 2, height: 2 }]);
  });
}

test("exports a file back after ignoring invalid saved entries", async () => {
  const worker = makeWorker();
  const back = { id: "back", kind: "file", source: { name: "back-file", width: 3, height: 5 } };
  assert.deepEqual(await exportedImageCounts(worker, payloadFor("back", [undefined, null, back])), [1, 1]);
  assert.deepEqual(worker.drawCalls[1], { source: "back-file", x: 0, y: 0, width: 3, height: 5 });
});

test("alternates each back page with its matching front page", async () => {
  const worker = makeWorker();
  const selected = Array.from({ length: 7 }, (_, index) => ({ spriteId: "sheet", columns: 2, rows: 1, index: 0, backId: "back" }));
  const payload = { ...payloadFor("back", [{ id: "back", kind: "file", source: { name: "back-file", width: 3, height: 5 } }]), selected, width: 100, height: 100 };
  assert.deepEqual(await exportedImageCounts(worker, payload), [2, 2, 2, 2, 2, 2, 1, 1]);
  assert.deepEqual(worker.drawCalls.map(({ source }) => source), ["sheet", "sheet", "back-file", "back-file", "sheet", "sheet", "back-file", "back-file", "sheet", "sheet", "back-file", "back-file", "sheet", "back-file"]);
});

test("uses landscape A4 pages when requested", async () => {
  const worker = makeWorker();
  const response = await worker.send("create-pdf", { ...payloadFor(), orientation: "landscape" });
  assert.equal(response.error, undefined, response.error);
  const [page] = (await PDFDocument.load(response.result)).getPages();
  assert.ok(page.getWidth() > page.getHeight());
});

test("uses the requested page format and defaults to A4", async () => {
  for (const [pageFormat, expected] of [["Letter", [612, 792]], [undefined, [595.28, 841.89]]]) {
    const response = await makeWorker().send("create-pdf", { ...payloadFor(), pageFormat });
    assert.equal(response.error, undefined, response.error);
    const [page] = (await PDFDocument.load(response.result)).getPages();
    assert.ok(Math.abs(page.getWidth() - expected[0]) < .01);
    assert.ok(Math.abs(page.getHeight() - expected[1]) < .01);
  }
});

for (const back of [
  { id: "back", kind: "sprite-grid-card", spriteId: "sheet" },
  { id: "back", kind: "sprite", spriteId: "sheet", index: 1 }
]) {
  test(`exports the selected tile for a ${back.kind} back`, async () => {
    const worker = makeWorker();
    assert.deepEqual(await exportedImageCounts(worker, payloadFor("back", [back])), [1, 1]);
    assert.deepEqual(worker.drawCalls[1], { source: "sheet", x: 2, y: 0, width: 2, height: 2 });
  });
}

for (const [mode, expectedImages] of [["front", [1]], ["back", [0]]]) {
  test(`exports only the requested ${mode} side without an assigned back`, async () => {
    const worker = makeWorker();
    assert.deepEqual(await exportedImageCounts(worker, { ...payloadFor(), mode }), expectedImages);
  });
}

test("serializes the original worker error name and stack", async () => {
  const response = await makeWorker().send("unknown-request", {});
  assert.match(response.error, /is not a function/);
  assert.equal(response.errorName, "TypeError");
  assert.match(response.errorStack, /^TypeError: /);
  assert.ok(response.errorStack.includes(workerPath), "Stack identifies the worker source");
  assert.equal(response.result, undefined);
});
