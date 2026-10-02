const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { compileTypeScript, importTypeScript } = require("./load-typescript.cjs");

// Keep pixels in memory so tests exercise the worker's real detection and
// perspective transform without relying on browser PNG encoding.
class ImageData {
  constructor(data, width, height) {
    if (typeof data === "number") { height = width; width = data; data = new Uint8ClampedArray(width * height * 4); }
    Object.assign(this, { data, width, height });
  }
}
class OffscreenCanvas {
  constructor(width, height) { Object.assign(this, { width, height, pixels: new ImageData(width, height) }); }
  getContext() {
    return {
      putImageData: (pixels) => { this.pixels = pixels; },
      getImageData: () => this.pixels,
      drawImage: (image) => { this.pixels = image.pixels; }
    };
  }
  async convertToBlob() { return this.pixels; }
}
const workerSource = compileTypeScript(readFileSync(path.join(__dirname, "../tools/CardPrinter/workers/detection-worker.ts"), "utf8"));
function makeWorker() {
  let handler;
  const messages = [];
  vm.compileFunction(workerSource, ["OffscreenCanvas", "ImageData", "self"])(OffscreenCanvas, ImageData, {
    addEventListener: (_, callback) => { handler = callback; }, postMessage: (message) => messages.push(message)
  });
  return async (type, source, regions) => {
    await handler({ data: { id: 1, type, source, regions } });
    const response = messages.at(-1);
    assert.equal(response.error, undefined);
    return response.result;
  };
}
const rectangle = (x, y, width, height) => ({ corners: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }] });
function imageSource() {
  const width = 60, height = 40, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 5; y < 35; y++) for (let x = 5; x < 55; x++) {
    if (x >= 25 && x < 35) continue;
    const offset = (y * width + x) * 4;
    pixels[offset] = x; pixels[offset + 1] = y; pixels[offset + 2] = 100;
  }
  return { width, height, pixels: pixels.buffer };
}

test("detection returns source-image corners alongside each straightened crop", async () => {
  const { sources, regions } = await makeWorker()("detect", imageSource());
  assert.deepEqual(regions, [rectangle(5, 5, 19, 29), rectangle(35, 5, 19, 29)]);
  assert.equal(sources.length, regions.length);
  assert.deepEqual(sources.map(({ width, height }) => [width, height]), [[19, 29], [19, 29]]);
});

test("editing regenerates crops from supplied corners, preserving area order", async () => {
  const regions = [rectangle(36, 8, 10, 20), rectangle(7, 9, 12, 15)];
  const result = await makeWorker()("rectify", imageSource(), regions);
  assert.deepEqual(result.regions, regions);
  assert.deepEqual(result.sources.map(({ width, height }) => [width, height]), [[10, 20], [12, 15]]);
  assert.deepEqual(Array.from(result.sources[0].data.slice(0, 4)), [36, 8, 100, 255]);
  assert.deepEqual(Array.from(result.sources[1].data.slice(-4)), [19, 24, 100, 255]);
});

test("removing every area produces no crops instead of rerunning detection", async () => {
  assert.deepEqual(await makeWorker()("rectify", imageSource(), []), { sources: [], regions: [] });
});

test("corner edits accept perspective shapes and reject crossed or collapsed borders", async () => {
  const { validCorners } = await importTypeScript("../tools/CardPrinter/utils/geometry.ts");
  assert.equal(validCorners(rectangle(5, 5, 20, 30).corners), true);
  assert.equal(validCorners([{ x: 8, y: 7 }, { x: 25, y: 5 }, { x: 23, y: 35 }, { x: 5, y: 30 }]), true);
  assert.equal(validCorners([{ x: 30, y: 30 }, { x: 25, y: 5 }, { x: 25, y: 35 }, { x: 5, y: 35 }]), false);
  assert.equal(validCorners(rectangle(5, 5, 0, 30).corners), false);
});
