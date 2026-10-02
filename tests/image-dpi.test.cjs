const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { importTypeScript } = require("./load-typescript.cjs");

const file = (bytes) => ({ arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

test("reads EXIF DPI from the supplied JPEG", async () => {
  const { readImageDpi } = await importTypeScript("../src/tools/CardPrinter/utils/image-dpi.ts");
  const bytes = readFileSync(path.join(__dirname, "../mocks/dpidpidpidpidpi.jpg"));
  assert.deepEqual(await readImageDpi(file(bytes)), { x: 300, y: 300 });
});

test("reads JFIF density in centimetres", async () => {
  const { readImageDpi } = await importTypeScript("../src/tools/CardPrinter/utils/image-dpi.ts");
  const bytes = Uint8Array.from([0xff,0xd8,0xff,0xe0,0,16,74,70,73,70,0,1,2,2,0,100,0,200,0,0,0xff,0xd9]);
  assert.deepEqual(await readImageDpi(file(bytes)), { x: 254, y: 508 });
});
