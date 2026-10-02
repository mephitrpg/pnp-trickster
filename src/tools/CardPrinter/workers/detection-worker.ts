const MAX_ANALYSIS_SIDE = 1200;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// The scanner bed is not necessarily white.  Sample its border instead of
// assuming a fixed light background; the median also ignores the occasional
// card that reaches an edge of the scan.
const backgroundFromBorder = (pixels, width, height) => {
  const samples = [[], [], []], inset = Math.max(1, Math.round(Math.min(width, height) * .015)), step = Math.max(1, Math.floor(Math.max(width, height) / 500));
  const add = (x, y) => { const pixel = (y * width + x) * 4; for (let channel = 0; channel < 3; channel++) samples[channel].push(pixels[pixel + channel]); };
  for (let x = inset; x < width - inset; x += step) { add(x, inset); add(x, height - inset - 1); }
  for (let y = inset; y < height - inset; y += step) { add(inset, y); add(width - inset - 1, y); }
  const median = (values) => { values.sort((a, b) => a - b); return values[Math.floor(values.length / 2)] || 0; };
  const colour = samples.map(median), deviations = [];
  for (let sample = 0; sample < samples[0].length; sample++) deviations.push(Math.abs(samples[0][sample] - colour[0]) + Math.abs(samples[1][sample] - colour[1]) + Math.abs(samples[2][sample] - colour[2]));
  deviations.sort((a, b) => a - b);
  // Allow natural scanner noise and gentle illumination changes, while still
  // retaining enough contrast to separate a card from any solid-colour bed.
  const variation = deviations[Math.floor(deviations.length * .9)] || 0;
  return { colour, threshold: Math.min(120, Math.max(36, variation * 2.5 + 12)) };
};

const findRegions = (image, report) => {
  const scale = Math.min(1, MAX_ANALYSIS_SIDE / Math.max(image.width, image.height)), width = Math.max(1, Math.round(image.width * scale)), height = Math.max(1, Math.round(image.height * scale));
  const canvas = new OffscreenCanvas(width, height), context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data, length = width * height, mask = new Uint8Array(length), seen = new Uint8Array(length), stack = new Int32Array(length), regions = [], background = backgroundFromBorder(pixels, width, height);
  for (let index = 0, pixel = 0; index < length; index++, pixel += 4) mask[index] = Math.abs(pixels[pixel] - background.colour[0]) + Math.abs(pixels[pixel + 1] - background.colour[1]) + Math.abs(pixels[pixel + 2] - background.colour[2]) > background.threshold ? 1 : 0;
  report(20);
  for (let start = 0; start < length; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0, count = 0, minX = width, minY = height, maxX = 0, maxY = 0, tl = null, tr = null, br = null, bl = null;
    stack[top++] = start; seen[start] = 1;
    while (top) {
      const point = stack[--top], x = point % width, y = Math.floor(point / width), current = { x, y }; count++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (!tl || x + y < tl.x + tl.y) tl = current; if (!tr || x - y > tr.x - tr.y) tr = current; if (!br || x + y > br.x + br.y) br = current; if (!bl || x - y < bl.x - bl.y) bl = current;
      for (const next of [point - 1, point + 1, point - width, point + width]) { if (next < 0 || next >= length || seen[next] || !mask[next]) continue; const nx = next % width, ny = Math.floor(next / width); if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue; seen[next] = 1; stack[top++] = next; }
    }
    if (count > length * .012 && maxX - minX + 1 > width * .12 && maxY - minY + 1 > height * .08) regions.push({ tl, tr, br, bl });
  }
  report(70);
  return regions.sort((a, b) => a.tl.y - b.tl.y || a.tl.x - b.tl.x).map((region) => ({ ...region, corners: [region.tl, region.tr, region.br, region.bl].map((point) => ({ x: point.x / scale, y: point.y / scale })) }));
};

const rectify = (input, corners) => {
  const [p0, p1, p2, p3] = corners, outputWidth = Math.max(1, Math.round((distance(p0, p1) + distance(p3, p2)) / 2)), outputHeight = Math.max(1, Math.round((distance(p0, p3) + distance(p1, p2)) / 2));
  const a11 = p1.x - p2.x, a12 = p3.x - p2.x, b1 = p2.x - p1.x - p3.x + p0.x, a21 = p1.y - p2.y, a22 = p3.y - p2.y, b2 = p2.y - p1.y - p3.y + p0.y, determinant = a11 * a22 - a12 * a21;
  const g = Math.abs(determinant) < 1e-6 ? 0 : (b1 * a22 - a12 * b2) / determinant, h = Math.abs(determinant) < 1e-6 ? 0 : (a11 * b2 - b1 * a21) / determinant;
  const a = p1.x * (g + 1) - p0.x, b = p3.x * (h + 1) - p0.x, c = p0.x, d = p1.y * (g + 1) - p0.y, e = p3.y * (h + 1) - p0.y, f = p0.y;
  const output = new ImageData(outputWidth, outputHeight), source = input.data;
  for (let y = 0; y < outputHeight; y++) for (let x = 0; x < outputWidth; x++) { const u = x / Math.max(1, outputWidth - 1), v = y / Math.max(1, outputHeight - 1), divisor = g * u + h * v + 1, sx = Math.round((a * u + b * v + c) / divisor), sy = Math.round((d * u + e * v + f) / divisor), out = (y * outputWidth + x) * 4; if (sx >= 0 && sx < input.width && sy >= 0 && sy < input.height) { const sourceIndex = (sy * input.width + sx) * 4; output.data[out] = source[sourceIndex]; output.data[out + 1] = source[sourceIndex + 1]; output.data[out + 2] = source[sourceIndex + 2]; output.data[out + 3] = source[sourceIndex + 3]; } }
  const canvas = new OffscreenCanvas(outputWidth, outputHeight); canvas.getContext("2d").putImageData(output, 0, 0); return canvas;
};

const detect = async (source, report, editedRegions) => {
  report(1); const image = new OffscreenCanvas(source.width, source.height), context = image.getContext("2d", { willReadFrequently: true }); context.putImageData(new ImageData(new Uint8ClampedArray(source.pixels), source.width, source.height), 0, 0);
  const regions = editedRegions || findRegions(image, report), pixels = context.getImageData(0, 0, source.width, source.height), tiles = [];
  for (let index = 0; index < regions.length; index++) { tiles.push(await rectify(pixels, regions[index].corners).convertToBlob({ type: "image/png" })); report(70 + (index + 1) / Math.max(1, regions.length) * 30); }
  if (!regions.length) report(100); return { sources: tiles, regions: regions.map(({ corners }) => ({ corners })) };
};

self.addEventListener("message", async ({ data }) => { if (!data?.id || !["detect", "rectify"].includes(data.type)) return; try { const result = await detect(data.source, (progress) => self.postMessage({ id: data.id, progress: Math.round(progress) }), data.type === "rectify" ? data.regions : undefined); self.postMessage({ id: data.id, result }); } catch (error) { self.postMessage({ id: data.id, error: error.message || String(error) }); } });
