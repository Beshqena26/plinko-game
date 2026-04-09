import { useRef, useEffect } from 'react';
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
  const listRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);

  // Auto-scroll to top on new result
  useEffect(() => {
    if (records.length > prevLenRef.current && listRef.current) {
      listRef.current.scrollTop = 0;
    }
    prevLenRef.current = records.length;
  }, [records.length]);

  const totalBet = records.reduce((s, r) => s + r.bet, 0);
  const totalWon = records.reduce((s, r) => s + r.payout, 0);
  const profit = totalWon - totalBet;
  const winRate = records.length > 0
    ? Math.round((records.filter(r => r.multiplier >= 1).length / records.length) * 100)
    : 0;

  return (
    <div className="bg-[#100C1C] h-full flex flex-col">
      {/* Header */}
      <div className="p-3.5 pb-2 border-b border-[#1A1726]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#73768C" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span className="text-[10px] font-bold text-[#73768C] uppercase tracking-[0.1em]">History</span>
          </div>
          {records.length > 0 && (
            <span className={`text-[12px] font-bold tabular-nums ${profit >= 0 ? 'text-[#0ECC68]' : 'text-[#ff003f]'}`}>
              {profit >= 0 ? '+' : ''}{profit.toFixed(2)}
            </span>
          )}
        </div>

        {/* Stats */}
        {records.length > 0 && (
          <div className="grid grid-cols-3 gap-1">
            <div className="bg-[#000514] rounded-lg px-1.5 py-2 text-center border border-[#1A1726]">
              <div className="text-[8px] text-[#73768C] font-medium uppercase tracking-wider">Bets</div>
              <div className="text-[11px] font-bold text-white tabular-nums mt-0.5">{records.length}</div>
            </div>
            <div className="bg-[#000514] rounded-lg px-1.5 py-2 text-center border border-[#1A1726]">
              <div className="text-[8px] text-[#73768C] font-medium uppercase tracking-wider">Wagered</div>
              <div className="text-[11px] font-bold text-white tabular-nums mt-0.5">{totalBet.toFixed(0)}</div>
            </div>
            <div className="bg-[#000514] rounded-lg px-1.5 py-2 text-center border border-[#1A1726]">
              <div className="text-[8px] text-[#73768C] font-medium uppercase tracking-wider">Win %</div>
              <div className="text-[11px] font-bold tabular-nums mt-0.5" style={{ color: winRate >= 50 ? '#0ECC68' : '#ff003f' }}>
                {winRate}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-[#73768C]">
            <div className="w-10 h-10 rounded-xl bg-[#1A1726]/50 flex items-center justify-center mb-2.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <span className="text-[11px] font-medium">No bets yet</span>
            <span className="text-[9px] text-[#73768C]/60 mt-0.5">Drop a ball to start</span>
          </div>
        ) : (
          <div className="flex flex-col gap-[3px]">
            {records.map((r, idx) => {
              const color = getMultiplierColor(r.multiplier);
              const isWin = r.multiplier >= 1;
              const profitAmt = r.payout - r.bet;
              const isNew = idx === 0;

              return (
                <div
                  key={r.id}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-[7px] transition-all duration-300
                    ${isNew ? 'animate-slide-up' : ''}
                    hover:bg-[#1A1726]/50`}
                  style={{
                    backgroundColor: isNew ? `${color}08` : '#000514',
                    border: `1px solid ${isNew ? `${color}20` : '#1A1726'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-[6px] h-[6px] rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
                      {r.multiplier}x
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold tabular-nums ${isWin ? 'text-[#0ECC68]' : 'text-[#ff003f]'}`}>
                    {isWin ? '+' : ''}{profitAmt.toFixed(2)}
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
