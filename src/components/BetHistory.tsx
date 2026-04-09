import { BetResult } from '../hooks/useGameEngine';
import { getMultiplierColor } from '../utils/multipliers';

interface BetHistoryProps {
  results: BetResult[];
}

export default function BetHistory({ results }: BetHistoryProps) {
  if (results.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">Bet History</h3>
        <div className="text-center text-text-secondary text-xs py-6">
          No bets yet. Drop a ball to start!
        </div>
      </div>
    );
  }

  const totalWagered = results.reduce((sum, r) => sum + r.betAmount, 0);
  const totalPayout = results.reduce((sum, r) => sum + r.payout, 0);
  const profit = totalPayout - totalWagered;

  return (
    <div className="bg-bg-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-secondary">Bet History</h3>
        <span className={`text-sm font-bold ${profit >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
          {profit >= 0 ? '+' : ''}{profit.toFixed(2)}
        </span>
      </div>

      {/* Stats Row */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 bg-bg-input rounded-lg p-2 text-center">
          <div className="text-[10px] text-text-secondary">Bets</div>
          <div className="text-xs font-semibold">{results.length}</div>
        </div>
        <div className="flex-1 bg-bg-input rounded-lg p-2 text-center">
          <div className="text-[10px] text-text-secondary">Wagered</div>
          <div className="text-xs font-semibold">${totalWagered.toFixed(2)}</div>
        </div>
        <div className="flex-1 bg-bg-input rounded-lg p-2 text-center">
          <div className="text-[10px] text-text-secondary">Won</div>
          <div className="text-xs font-semibold">${totalPayout.toFixed(2)}</div>
        </div>
      </div>

      {/* Recent Results */}
      <div className="flex flex-wrap gap-1">
        {results.slice(0, 20).map(result => (
          <div
            key={result.id}
            className="px-2 py-1 rounded text-[10px] font-bold"
            style={{
              color: getMultiplierColor(result.multiplier),
              backgroundColor: `${getMultiplierColor(result.multiplier)}15`,
              border: `1px solid ${getMultiplierColor(result.multiplier)}25`,
            }}
          >
            {result.multiplier}x
          </div>
        ))}
      </div>
    </div>
  );
}
