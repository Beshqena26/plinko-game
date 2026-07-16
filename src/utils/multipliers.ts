export type RiskLevel = 'low' | 'medium' | 'high';

export const MULTIPLIER_MAP: Record<RiskLevel, Record<number, number[]>> = {
  low: {
    8:  [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    9:  [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
    10: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
    11: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    13: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
    14: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    15: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8:  [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    9:  [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    10: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    11: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    13: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    14: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
    15: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8:  [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    9:  [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
    10: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    13: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
    14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

export function getMultipliers(risk: RiskLevel, rows: number): number[] {
  return MULTIPLIER_MAP[risk][rows] || MULTIPLIER_MAP[risk][16];
}

// Exact RTP for a risk/rows combination: EV = Σ C(n,k)/2ⁿ × mult_k.
export function getRtp(risk: RiskLevel, rows: number): number {
  const arr = getMultipliers(risk, rows);
  const n = arr.length - 1;
  let ev = 0;
  let c = 1; // C(n,0)
  for (let k = 0; k <= n; k++) {
    ev += (c / 2 ** n) * arr[k];
    c = (c * (n - k)) / (k + 1);
  }
  return ev;
}

// Binomial probability of landing in slot k of an n-row board.
export function slotProbability(rows: number, k: number): number {
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (rows - i)) / (i + 1);
  return c / 2 ** rows;
}

// Stake-style position gradient for the bucket row: hot red at the edges
// through the brand orange to warm yellow at the center, regardless of the
// multiplier values in the slot.
const BUCKET_STOPS: [number, string][] = [
  [0, '#FFD24D'],   // center
  [0.45, '#F7931A'],
  [0.75, '#FF6B44'],
  [1, '#F8385D'],   // edge
];
function hexLerp(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export function getBucketColor(index: number, count: number): string {
  const center = (count - 1) / 2;
  const t = center === 0 ? 0 : Math.abs(index - center) / center;
  for (let i = 1; i < BUCKET_STOPS.length; i++) {
    if (t <= BUCKET_STOPS[i][0]) {
      const [t0, c0] = BUCKET_STOPS[i - 1];
      const [t1, c1] = BUCKET_STOPS[i];
      return hexLerp(c0, c1, (t - t0) / (t1 - t0));
    }
  }
  return BUCKET_STOPS[BUCKET_STOPS.length - 1][1];
}

// MYBC brand heat scale: red at the hot edges, through the accent
// orange, down to muted purple for the losing center slots.
export function getMultiplierColor(multiplier: number): string {
  if (multiplier >= 100) return '#F85F5D';
  if (multiplier >= 25)  return '#FF7052';
  if (multiplier >= 10)  return '#FF8A3D';
  if (multiplier >= 5)   return '#F7931A';
  if (multiplier >= 3)   return '#FFA426';
  if (multiplier >= 2)   return '#FFB833';
  if (multiplier >= 1)   return '#FFD24D';
  if (multiplier >= 0.5) return '#A29BD9';
  return '#736DAF';
}
