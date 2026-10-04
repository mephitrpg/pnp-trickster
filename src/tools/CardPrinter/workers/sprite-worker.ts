import { PDFDocument, rgb } from "../../../../vendor/pdf-lib.esm.min.js";

const bitmapFor = (source) => createImageBitmap(source);
const tileBounds = (bitmap, columns, rows, index, detectedRects) => {
  if (detectedRects?.[index]) return detectedRects[index];
  const width = Math.floor(bitmap.width / columns), height = Math.floor(bitmap.height / rows);
  return { x: (index % columns) * width, y: Math.floor(index / columns) * height, width, height };
};
const tileCanvas = (bitmap, columns, rows, index, detectedRects?) => {
  const bounds = tileBounds(bitmap, columns, rows, index, detectedRects);
  const canvas = new OffscreenCanvas(bounds.width, bounds.height);
  canvas.getContext("2d").drawImage(bitmap, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
  return canvas;
};
const fitTile = (tile, scale, aspect) => {
  if (scale === "stretch") return tile;
  const maxSide = Math.min(2400, Math.max(tile.width, tile.height));
  const width = Math.max(1, Math.round(aspect >= 1 ? maxSide : maxSide * aspect));
  const height = Math.max(1, Math.round(aspect >= 1 ? maxSide / aspect : maxSide));
  const canvas = new OffscreenCanvas(width, height), context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  const factor = scale === "fit-width" ? width / tile.width : scale === "fit-height" ? height / tile.height : scale === "cover" ? Math.max(width / tile.width, height / tile.height) : Math.min(width / tile.width, height / tile.height);
  const drawWidth = tile.width * factor, drawHeight = tile.height * factor;
  context.drawImage(tile, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  return canvas;
};
const isMonochrome = (canvas) => {
  const { data } = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  let count = 0, red = 0, green = 0, blue = 0;
  for (let i = 0; i < data.length; i += 16) { count++; red += data[i]; green += data[i + 1]; blue += data[i + 2]; }
  red /= count; green /= count; blue /= count;
  let distance = 0;
  for (let i = 0; i < data.length; i += 16) distance += Math.abs(data[i] - red) + Math.abs(data[i + 1] - green) + Math.abs(data[i + 2] - blue);
  return distance / count < 24;
};
const pngBytes = async (canvas) => new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
const drawCutGuides = (page, placements, originX, originY, width, height) => {
  if (!placements.length) return;
  // Detached crop ticks: 5 mm long with roughly 2 mm of clearance.
  const guide = 5 * 72 / 25.4, gap = 6, color = rgb(.28, .28, .28);
  const line = (start, end) => page.drawLine({ start, end, color, thickness: .35 });
  const columns = placements.map(({ column }) => column), rows = placements.map(({ row }) => row);
  const firstColumn = Math.min(...columns), lastColumn = Math.max(...columns);
  const firstRow = Math.min(...rows), lastRow = Math.max(...rows);
  const left = originX + firstColumn * width, right = originX + (lastColumn + 1) * width;
  const top = originY - firstRow * height, bottom = originY - (lastRow + 1) * height;
  // Put every cut position in the surrounding margin. The gap ensures no mark
  // reaches the card edge, and no guide is drawn between neighbouring cards.
  for (let column = firstColumn; column <= lastColumn + 1; column++) {
    const x = originX + column * width;
    line({ x, y: top + gap }, { x, y: top + gap + guide });
    line({ x, y: bottom - gap }, { x, y: bottom - gap - guide });
  }
  for (let row = firstRow; row <= lastRow + 1; row++) {
    const y = originY - row * height;
    line({ x: left - gap, y }, { x: left - gap - guide, y });
    line({ x: right + gap, y }, { x: right + gap + guide, y });
  }
};
// pdf-lib's complete set of predefined page sizes, expressed in PDF points.
const PAGE_SIZES = { "4A0": [4767.87, 6740.79], "2A0": [3370.39, 4767.87], A0: [2383.94, 3370.39], A1: [1683.78, 2383.94], A2: [1190.55, 1683.78], A3: [841.89, 1190.55], A4: [595.28, 841.89], A5: [419.53, 595.28], A6: [297.64, 419.53], A7: [209.76, 297.64], A8: [147.4, 209.76], A9: [104.88, 147.4], A10: [73.7, 104.88], B0: [2834.65, 4008.19], B1: [2004.09, 2834.65], B2: [1417.32, 2004.09], B3: [1000.63, 1417.32], B4: [708.66, 1000.63], B5: [498.9, 708.66], B6: [354.33, 498.9], B7: [249.45, 354.33], B8: [175.75, 249.45], B9: [124.72, 175.75], B10: [87.87, 124.72], C0: [2599.37, 3676.54], C1: [1836.85, 2599.37], C2: [1298.27, 1836.85], C3: [918.43, 1298.27], C4: [649.13, 918.43], C5: [459.21, 649.13], C6: [323.15, 459.21], C7: [229.61, 323.15], C8: [161.57, 229.61], C9: [113.39, 161.57], C10: [79.37, 113.39], RA0: [2437.8, 3458.27], RA1: [1729.13, 2437.8], RA2: [1218.9, 1729.13], RA3: [864.57, 1218.9], RA4: [609.45, 864.57], SRA0: [2551.18, 3628.35], SRA1: [1814.17, 2551.18], SRA2: [1275.59, 1814.17], SRA3: [907.09, 1275.59], SRA4: [637.8, 907.09], Executive: [521.86, 756], Folio: [612, 936], Legal: [612, 1008], Letter: [612, 792], Tabloid: [792, 1224] };

const handlers = {
  async "initial-selection"({ source, columns, rows, backIndex, detectedRects, detectedTiles }) {
    const selected = [];
    if (detectedTiles?.length) {
      for (let index = 0; index < detectedTiles.length; index++) { const bitmap = await bitmapFor(detectedTiles[index]); selected.push(index !== backIndex && !isMonochrome(tileCanvas(bitmap, 1, 1, 0))); bitmap.close(); }
      return selected;
    }
    const bitmap = await bitmapFor(source);
    for (let index = 0; index < columns * rows; index++) selected.push(index !== backIndex && !isMonochrome(tileCanvas(bitmap, columns, rows, index, detectedRects)));
    bitmap.close();
    return selected;
  },
  async monochrome({ source, columns, rows, index }) {
    const bitmap = await bitmapFor(source), result = isMonochrome(tileCanvas(bitmap, columns, rows, index));
    bitmap.close();
    return result;
  },
  async "create-pdf"({ sprites = [], backs = [], selected = [], mode, orientation, pageFormat, width, height }: { sprites?: any[]; backs?: any[]; selected?: any[]; mode?: string; orientation?: string; pageFormat?: string; width?: number; height?: number } = {}) {
    // The UI normally sends only complete entries, but workers must also tolerate
    // stale persisted state from earlier versions of the tool.
    sprites = Array.isArray(sprites) ? sprites.filter((sprite) => sprite?.id && sprite.source) : [];
    backs = Array.isArray(backs) ? backs.filter((back) => back?.id && typeof back.kind === "string") : [];
    selected = Array.isArray(selected) ? selected.filter((item) => item?.spriteId && Number.isInteger(item.index)) : [];
    const images = new Map();
    await Promise.all(sprites.map(async (sprite) => { images.set(sprite.id, await bitmapFor(sprite.source)); await Promise.all((sprite.detectedTiles || []).map(async (tile, index) => images.set(`${sprite.id}:${index}`, await bitmapFor(tile)))); }));
    await Promise.all(backs.filter((back) => back.kind === "file").map(async (back) => images.set(back.id, await bitmapFor(back.source))));
    const spriteById = new Map(sprites.map((sprite) => [sprite.id, sprite]));
    // A sprite card used as a back is source material, never a printable card.
    selected = selected.filter((item) => spriteById.get(item.spriteId)?.backIndex !== item.index);
    const backById = new Map(backs.map((back) => [back.id, back]));
    const pdf = await PDFDocument.create(), selectedPageSize = PAGE_SIZES[pageFormat] || PAGE_SIZES.A4, pageSize = orientation === "landscape" ? [selectedPageSize[1], selectedPageSize[0]] : selectedPageSize, margin = 24, mm = 72 / 25.4, cardWidth = width * mm, cardHeight = height * mm;
    const imageFor = (item, face) => {
      if (face === "front") { const sprite = spriteById.get(item.spriteId); if (!sprite) return null; return sprite.detectedTiles?.[item.index] ? { bitmap: images.get(`${item.spriteId}:${item.index}`), columns: 1, rows: 1, index: 0 } : { bitmap: images.get(item.spriteId), columns: item.columns, rows: item.rows, index: item.index, detectedRects: sprite.detectedRects }; }
      const back = backById.get(item.backId);
      if (!back) return null;
      if (back.kind === "file") return { bitmap: images.get(back.id), columns: 1, rows: 1, index: 0 };
      const sprite = spriteById.get(back.spriteId);
      if (!sprite) return null;
      const index = back.kind === "sprite-grid-card" ? sprite.backIndex : back.index; return sprite.detectedTiles?.[index] ? { bitmap: images.get(`${sprite.id}:${index}`), columns: 1, rows: 1, index: 0 } : { bitmap: images.get(sprite.id), columns: sprite.columns, rows: sprite.rows, index, detectedRects: sprite.detectedRects };
    };
    const columns = Math.max(1, Math.floor((pageSize[0] - margin * 2) / cardWidth)), rows = Math.max(1, Math.floor((pageSize[1] - margin * 2) / cardHeight)), cardsPerPage = columns * rows;
    const addSide = async (face, first = 0, count = selected.length - first) => {
      const end = Math.min(selected.length, first + count);
      for (let start = first; start < end;) {
        const page = pdf.addPage(pageSize), countOnPage = Math.min(cardsPerPage, end - start);
        const originX = (pageSize[0] - columns * cardWidth) / 2, originY = (pageSize[1] + rows * cardHeight) / 2;
        const placements = Array.from({ length: countOnPage }, (_, slot) => ({
          column: face === "back" ? columns - 1 - (slot % columns) : slot % columns,
          row: Math.floor(slot / columns)
        }));
        for (let slot = 0; slot < countOnPage; slot++) {
          const item = selected[start + slot], image = imageFor(item, face);
          const { column, row } = placements[slot], x = originX + column * cardWidth, y = originY - (row + 1) * cardHeight;
          if (image) {
            const tile = tileCanvas(image.bitmap, image.columns, image.rows, image.index, image.detectedRects);
            const png = await pdf.embedPng(await pngBytes(fitTile(tile, face === "front" ? item.frontScale : item.backScale, cardWidth / cardHeight)));
            page.drawImage(png, { x, y, width: cardWidth, height: cardHeight });
          } else {
            page.drawRectangle({ x, y, width: cardWidth, height: cardHeight, color: rgb(1, 1, 1) });
          }
        }
        drawCutGuides(page, placements, originX, originY, cardWidth, cardHeight);
        start += countOnPage;
      }
    };
    if (mode === "both") {
      for (let first = 0; first < selected.length; first += cardsPerPage) {
        await addSide("front", first, cardsPerPage);
        await addSide("back", first, cardsPerPage);
      }
    } else if (mode === "back") await addSide("back");
    else await addSide("front");
    images.forEach((bitmap) => bitmap.close());
    return await pdf.save();
  }
};

self.addEventListener("message", async ({ data: { id, type, payload } }) => {
  try {
    const result = await handlers[type](payload);
    self.postMessage({ id, result }, { transfer: result instanceof Uint8Array ? [result.buffer] : [] });
  }
  catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
      errorStack: error instanceof Error ? error.stack : undefined
    });
  }
});
