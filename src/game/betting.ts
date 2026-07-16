export const MIN_BET = 0.1;
export const MAX_BET = 1000;

// BGaming steps the bet through a fixed 1-2-3-5 ladder (observed in the
// demo: 1 → 2 → 3 → 5 → 10 → 15…) — no free typing.
export const BET_STEPS = [
  0.1, 0.2, 0.3, 0.5, 1, 2, 3, 5, 10, 15, 20, 30, 50, 100, 150, 200, 300, 500, 1000,
];

// Highest ladder step affordable with the given balance (min step if broke).
export function clampBetToBalance(bet: number, balance: number): number {
  if (bet <= balance) return bet;
  const affordable = [...BET_STEPS].reverse().find(s => s <= balance);
  return affordable ?? MIN_BET;
}
