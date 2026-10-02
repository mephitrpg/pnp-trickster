import type { Back, PrinterState, Sprite } from "./model.ts";

const MAX_SIDE = 320;
function imageUrl(image: CanvasImageSource & { width: number; height: number }, x = 0, y = 0, width = image.width, height = image.height) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d")!.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function createPreviewCache() {
  const sprites = new Map<string, Map<number, string>>();
  const backs = new Map<string, string>();
  return {
    tile(sprite: Sprite, index: number) {
      let tiles = sprites.get(sprite.id);
      if (!tiles) { tiles = new Map(); sprites.set(sprite.id, tiles); }
      const cached = tiles.get(index);
      if (cached) return cached;
      const detected = sprite.detectedTiles?.[index];
      let url: string;
      if (detected?.image) url = imageUrl(detected.image);
      else {
        const width = Math.floor(sprite.image.width / sprite.columns);
        const height = Math.floor(sprite.image.height / sprite.rows);
        const rect = sprite.detectedRects?.[index] || { x: (index % sprite.columns) * width, y: Math.floor(index / sprite.columns) * height, width, height };
        url = imageUrl(sprite.image, rect.x, rect.y, rect.width, rect.height);
      }
      tiles.set(index, url);
      return url;
    },
    back(state: PrinterState, back?: Back) {
      if (!back) return "";
      if (back.kind === "sprite" || back.kind === "sprite-grid-card") {
        const sprite = state.sprites.find((item) => item.id === back.spriteId);
        return sprite ? this.tile(sprite, back.kind === "sprite-grid-card" ? sprite.backIndex! : back.index!) : "";
      }
      if (!back.image) return "";
      let url = backs.get(back.id);
      if (!url) { url = imageUrl(back.image); backs.set(back.id, url); }
      return url;
    },
    clearSprite(id: string) { sprites.delete(id); },
    clearBack(id: string) { backs.delete(id); },
    clear() { sprites.clear(); backs.clear(); }
  };
}
