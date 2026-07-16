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
  /* Bucket row: rows+1 slots of width exactly `gap`, one in each gap of the
     bottom pin row — the only positions a ball can land in. */
  bucketLeftX: number;
  bucketRightX: number;
  bucketTopY: number;
  pinR: number;
  ballR: number;
}

// Radii scale with pin spacing so balls always fit between pins, whatever
// size the board area gets. Ball ≈ 2× pin, like Stake.
export const pinRadiusFor = (gap: number) => Math.max(2.5, Math.min(4, gap * 0.13));
export const ballRadiusFor = (gap: number) => Math.max(4.5, Math.min(8, gap * 0.22));

// The ball makes exactly `rows` bounces, one per pin row — so the board has
// pin rows r = 0..rows-1 (row r has r+3 pins). The bottom row has rows+2 pins
// spanning (rows+1)·gap, and the rows+1 buckets sit exactly in its gaps:
// a ball with k rights lands at x = w/2 + (k − rows/2)·gap, the center of
// bottom-row gap k.
export function getGeometry(w: number, h: number, rows: number): BoardGeometry {
  const bottomSpan = rows + 1; // bottom pin row span, in gap units

  // Everything is sized in gap units so the board keeps identical proportions
  // on any screen: (rows-1) gaps of pyramid + 1.2 of spawn room on top +
  // 2.4 for the bucket cups and labels below.
  const TOP_UNITS = 2.6; // spawn room + entry hole + floating title clearance
  const BOTTOM_UNITS = 2.2;
  const maxGapW = (w * 0.92) / (bottomSpan + 1);
  const maxGapH = h / (rows - 1 + TOP_UNITS + BOTTOM_UNITS);
  const gap = Math.min(38, maxGapW, maxGapH);

  const contentH = gap * (rows - 1 + TOP_UNITS + BOTTOM_UNITS);
  const startY = (h - contentH) / 2 + gap * TOP_UNITS;

  const pins: Pin[] = [];
  for (let r = 0; r < rows; r++) {
    const count = r + 3;
    const y = startY + r * gap;
    const totalW = (count - 1) * gap;
    const sx = (w - totalW) / 2;
    for (let c = 0; c < count; c++) {
      pins.push({ x: sx + c * gap, y, row: r, col: c });
    }
  }

  const endY = startY + (rows - 1) * gap; // last pin row

  const bottomTotalW = bottomSpan * gap;
  const bottomLeftX = (w - bottomTotalW) / 2;
  const bottomRightX = bottomLeftX + bottomTotalW;

  const topTotalW = 2 * gap;
  const topLeftX = (w - topTotalW) / 2;
  const topRightX = topLeftX + topTotalW;

  // Bucket edges sit exactly on the bottom-row pins.
  const bucketLeftX = bottomLeftX;
  const bucketRightX = bottomRightX;
  const bucketTopY = endY + gap * 0.7;

  return {
    gap, startY, endY, pins, bottomLeftX, bottomRightX, topLeftX, topRightX,
    bucketLeftX, bucketRightX, bucketTopY,
    pinR: pinRadiusFor(gap), ballR: ballRadiusFor(gap),
  };
}

// Bucket index under a canvas point, or null when outside the bucket band.
export function bucketAt(geo: BoardGeometry, numBuckets: number, x: number, y: number): number | null {
  if (y < geo.bucketTopY - 4 || y > geo.bucketTopY + 55) return null;
  const i = Math.floor((x - geo.bucketLeftX) / geo.gap);
  return i >= 0 && i < numBuckets ? i : null;
}
