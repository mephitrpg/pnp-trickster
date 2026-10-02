import { PDFDocument } from "../../../vendor/pdf-lib.esm.min.js";

const ensureEmbeddablePage = (page) => {
  // pdf-lib cannot embed an otherwise valid blank page without a Contents stream.
  if (!page.node.Contents()) page.drawRectangle({ x: 0, y: 0, width: 0, height: 0, opacity: 0 });
};

export const downloadPdf = (bytes, filename) => {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
};

export async function splitPagesInHalf(file) {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const output = await PDFDocument.create();

  for (const page of source.getPages()) {
    ensureEmbeddablePage(page);
    const { width, height } = page.getSize();
    const left = await output.embedPage(page, { left: 0, bottom: 0, right: width / 2, top: height });
    const right = await output.embedPage(page, { left: width / 2, bottom: 0, right: width, top: height });
    output.addPage([width / 2, height]).drawPage(left, { width: width / 2, height });
    output.addPage([width / 2, height]).drawPage(right, { width: width / 2, height });
  }

  return output.save();
}

export async function joinPagesSideBySide(file) {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const output = await PDFDocument.create();
  const pages = source.getPages();

  for (let index = 0; index < pages.length; index += 2) {
    const first = pages[index];
    const second = pages[index + 1];
    ensureEmbeddablePage(first);
    if (second) ensureEmbeddablePage(second);
    const { width, height } = first.getSize();
    const joined = output.addPage([width * 2, height]);
    joined.drawPage(await output.embedPage(first), { x: 0, y: 0, width, height });
    if (second) {
      const secondSize = second.getSize();
      const scale = Math.min(width / secondSize.width, height / secondSize.height);
      joined.drawPage(await output.embedPage(second), {
        x: width + (width - secondSize.width * scale) / 2,
        y: (height - secondSize.height * scale) / 2,
        width: secondSize.width * scale,
        height: secondSize.height * scale
      });
    }
  }

  return output.save();
}
