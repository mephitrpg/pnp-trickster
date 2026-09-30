// Read physical pixel density without decoding the image.  Browser image APIs
// expose dimensions, but intentionally do not expose this metadata.
const ascii = (bytes, start, length) => String.fromCharCode(...bytes.slice(start, start + length));
const valid = (x, y) => Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0 ? { x, y } : null;
const u16 = (view, offset, little) => offset + 2 <= view.byteLength ? view.getUint16(offset, little) : 0;
const u32 = (view, offset, little) => offset + 4 <= view.byteLength ? view.getUint32(offset, little) : 0;

// TIFF is also the metadata payload used by EXIF in JPEG, WebP, PNG and AVIF.
export const tiffDpi = (bytes, start = 0) => {
  if (start + 8 > bytes.length) return null;
  const little = bytes[start] === 0x49 && bytes[start + 1] === 0x49;
  if (!little && !(bytes[start] === 0x4d && bytes[start + 1] === 0x4d)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (u16(view, start + 2, little) !== 42) return null;
  const ifd = start + u32(view, start + 4, little);
  if (ifd + 2 > bytes.length) return null;
  const values = new Map(), entries = u16(view, ifd, little);
  for (let index = 0; index < entries; index++) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > bytes.length) break;
    const tag = u16(view, entry, little), type = u16(view, entry + 2, little), count = u32(view, entry + 4, little);
    if (![282, 283, 296].includes(tag) || count !== 1) continue;
    const value = entry + 8, offset = start + u32(view, value, little);
    if (type === 5 && offset + 8 <= bytes.length) {
      const denominator = u32(view, offset + 4, little);
      values.set(tag, denominator ? u32(view, offset, little) / denominator : 0);
    } else if (type === 3) values.set(tag, u16(view, value, little));
  }
  const factor = values.get(296) === 3 ? 2.54 : 1;
  return valid(values.get(282) * factor, values.get(283) * factor);
};

const exifDpi = (bytes, start, end = bytes.length) => {
  for (let index = start; index + 14 <= end; index++) if (ascii(bytes, index, 6) === "Exif\0\0") return tiffDpi(bytes, index + 6);
  return null;
};

const jpegDpi = (bytes) => {
  for (let offset = 2; offset + 4 <= bytes.length;) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) { offset += 2; continue; }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3], end = offset + 2 + length;
    if (length < 2 || end > bytes.length) break;
    const payload = offset + 4;
    if (marker === 0xe0 && length >= 16 && ascii(bytes, payload, 5) === "JFIF\0") {
      const unit = bytes[payload + 7], x = (bytes[payload + 8] << 8) | bytes[payload + 9], y = (bytes[payload + 10] << 8) | bytes[payload + 11];
      const dpi = unit === 1 ? valid(x, y) : unit === 2 ? valid(x * 2.54, y * 2.54) : null;
      if (dpi) return dpi;
    }
    if (marker === 0xe1) { const dpi = exifDpi(bytes, payload, end); if (dpi) return dpi; }
    offset = end;
  }
  return null;
};

const pngDpi = (bytes) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = u32(view, offset, false), type = ascii(bytes, offset + 4, 4), data = offset + 8, end = data + length;
    if (end + 4 > bytes.length) break;
    if (type === "pHYs" && length >= 9 && bytes[data + 8] === 1) return valid(u32(view, data, false) / 39.37007874, u32(view, data + 4, false) / 39.37007874);
    if (type === "eXIf") { const dpi = tiffDpi(bytes, data) || exifDpi(bytes, data, end); if (dpi) return dpi; }
    offset = end + 4;
  }
  return null;
};

const webpDpi = (bytes) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = ascii(bytes, offset, 4), length = u32(view, offset + 4, true), data = offset + 8, end = data + length;
    if (end > bytes.length) break;
    if (type === "EXIF") return tiffDpi(bytes, data) || exifDpi(bytes, data, end);
    offset = end + (length & 1);
  }
  return null;
};

// AVIF stores EXIF in a HEIF item.  Its payload is usually a four-byte TIFF
// offset, but some encoders include the conventional Exif header instead.
const avifDpi = (bytes) => {
  for (let index = 0; index + 8 <= bytes.length; index++) {
    const dpi = exifDpi(bytes, index, Math.min(bytes.length, index + 16));
    if (dpi) return dpi;
    if ((bytes[index] === 0x49 && bytes[index + 1] === 0x49) || (bytes[index] === 0x4d && bytes[index + 1] === 0x4d)) {
      const dpi = tiffDpi(bytes, index); if (dpi) return dpi;
    }
  }
  return null;
};

export const readImageDpi = async (file) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length >= 8 && ascii(bytes, 1, 3) === "PNG") return pngDpi(bytes);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegDpi(bytes);
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return webpDpi(bytes);
  if (bytes.length >= 54 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return valid(u32(view, 38, true) / 39.37007874, u32(view, 42, true) / 39.37007874);
  }
  if (bytes.length >= 8 && ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4d && bytes[1] === 0x4d))) return tiffDpi(bytes);
  if (bytes.length >= 16 && ascii(bytes, 4, 4) === "ftyp") return avifDpi(bytes);
  // GIF has no standard pixel-density field.  Its aspect-ratio byte is not DPI.
  return null;
};
