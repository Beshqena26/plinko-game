import { getMultiplierColor } from '../utils/multipliers';

export interface BetRecord {
  id: number;
  bet: number;
  multiplier: number;
  payout: number;
  time: number;
}

interface BetHistoryProps {
  records: BetRecord[];
}

export default function BetHistory({ records }: BetHistoryProps) {
  const totalBet = records.reduce((s, r) => s + r.bet, 0);
  const totalWon = records.reduce((s, r) => s + r.payout, 0);
  const profit = totalWon - totalBet;

  return (
    <div className="bg-[#100C1C] h-full flex flex-col p-4">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#73768C] uppercase tracking-wider">History</span>
          {records.length > 0 && (
            <span className={`text-[12px] font-bold ${profit >= 0 ? 'text-[#0ECC68]' : 'text-[#ff003f]'}`}>
              {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
            </span>
          )}
        </div>
        {records.length > 0 && (
          <div className="flex gap-1.5">
            <div className="flex-1 bg-[#000514] rounded-lg px-2 py-2 text-center border border-[#1A1726]">
              <div className="text-[8px] text-[#73768C] mb-0.5">BETS</div>
              <div className="text-[11px] font-bold text-white">{records.length}</div>
            </div>
            <div className="flex-1 bg-[#000514] rounded-lg px-2 py-2 text-center border border-[#1A1726]">
              <div className="text-[8px] text-[#73768C] mb-0.5">WAGERED</div>
              <div className="text-[11px] font-bold text-white">${totalBet.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#73768C]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-30">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span className="text-[11px]">No bets yet</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {records.map(r => {
              const color = getMultiplierColor(r.multiplier);
              const isWin = r.multiplier >= 1;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-[#000514] rounded-lg px-2.5 py-1.5 border border-[#1A1726]"
                >
                  <span className="text-[11px] font-bold" style={{ color }}>
                    {r.multiplier}X
                  </span>
                  <span className={`text-[10px] font-medium ${isWin ? 'text-[#0ECC68]' : 'text-[#ff003f]'}`}>
                    {isWin ? '+' : ''}{(r.payout - r.bet).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
