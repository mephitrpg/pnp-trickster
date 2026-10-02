export type Point = { x: number; y: number };

// Corners are stored in source-image pixels, independent of the displayed size.
export const validCorners = (corners: Point[]) => corners.every((point, index) => {
  const next = corners[(index + 1) % 4], after = corners[(index + 2) % 4];
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    && Math.hypot(next.x - point.x, next.y - point.y) >= 2
    && (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x) > 0;
});
