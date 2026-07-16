export interface Pin { x: number; y: number; row: number; col: number }

export interface BoardGeometry {
  gap: number;
  startY: number;
  endY: number;
  pins: Pin[];
  bottomLeftX: number;
  bottomRightX: number;
  topLeftX: number;
  topRightX: number;
  pinR: number;
  ballR: number;
}

// Radii scale with pin spacing so balls always fit between pins, whatever
// size the board area gets. Ball ≈ 2× pin, like Stake.
export const pinRadiusFor = (gap: number) => Math.max(2.5, Math.min(4, gap * 0.13));
export const ballRadiusFor = (gap: number) => Math.max(4.5, Math.min(8, gap * 0.22));

// Row r has (r+3) pins spaced by `gap`; buckets are the rows+1 slots aligned
// to the bottom pin row.
export function getGeometry(w: number, h: number, rows: number): BoardGeometry {
  const bottomPinCount = rows + 3;
  const bottomSpan = bottomPinCount - 1; // in gap units

  const maxGapW = (w - 60) / (bottomSpan + 1);
  const maxGapH = (h - 130) / (rows + 2);
  const gap = Math.min(38, maxGapW, maxGapH);

  const boardH = gap * rows;
  const startY = (h - boardH) / 2 - 10;

  const pins: Pin[] = [];
  for (let r = 0; r <= rows; r++) {
    const count = r + 3;
    const y = startY + r * gap;
    const totalW = (count - 1) * gap;
    const sx = (w - totalW) / 2;
    for (let c = 0; c < count; c++) {
      pins.push({ x: sx + c * gap, y, row: r, col: c });
    }
  }

  const endY = startY + rows * gap;

  const bottomTotalW = bottomSpan * gap;
  const bottomLeftX = (w - bottomTotalW) / 2;
  const bottomRightX = bottomLeftX + bottomTotalW;

  const topTotalW = 2 * gap;
  const topLeftX = (w - topTotalW) / 2;
  const topRightX = topLeftX + topTotalW;

  return {
    gap, startY, endY, pins, bottomLeftX, bottomRightX, topLeftX, topRightX,
    pinR: pinRadiusFor(gap), ballR: ballRadiusFor(gap),
  };
}

// Bucket index under a canvas point, or null when outside the bucket band.
export function bucketAt(geo: BoardGeometry, numBuckets: number, x: number, y: number): number | null {
  const bucketTopY = geo.endY + geo.gap * 0.3;
  if (y < bucketTopY - 4 || y > bucketTopY + 55) return null;
  const bw = (geo.bottomRightX - geo.bottomLeftX) / numBuckets;
  const i = Math.floor((x - geo.bottomLeftX) / bw);
  return i >= 0 && i < numBuckets ? i : null;
}
