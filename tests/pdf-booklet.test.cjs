const assert = require("node:assert/strict");
const test = require("node:test");
const { importTypeScript } = require("./load-typescript.cjs");

test("booklet transforms accept valid blank PDF pages", async () => {
  const { PDFDocument } = await import("../vendor/pdf-lib.esm.min.js");
  const { joinPagesSideBySide, splitPagesInHalf } = await importTypeScript("../tools/PdfBooklet/operations.ts");
  const source = await PDFDocument.create();
  source.addPage([200, 300]);
  source.addPage([200, 300]);
  const bytes = await source.save();
  const file = { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };

  const joined = await PDFDocument.load(await joinPagesSideBySide(file));
  assert.equal(joined.getPageCount(), 1);
  assert.deepEqual(joined.getPage(0).getSize(), { width: 400, height: 300 });

  const split = await PDFDocument.load(await splitPagesInHalf(file));
  assert.equal(split.getPageCount(), 4);
  assert.deepEqual(split.getPage(0).getSize(), { width: 100, height: 300 });
});
