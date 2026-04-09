import { useRef, useEffect } from 'react';
import { getMultiplierColor } from '../utils/multipliers';

export interface BetRecord {
  id: number;
  bet: number;
  multiplier: number;
  payout: number;
  time: number;
}

export default function BetHistory({ records }: { records: BetRecord[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);
  useEffect(() => {
    if (records.length > prevLen.current && listRef.current) listRef.current.scrollTop = 0;
    prevLen.current = records.length;
  }, [records.length]);

  const totalBet = records.reduce((s, r) => s + r.bet, 0);
  const totalWon = records.reduce((s, r) => s + r.payout, 0);
  const profit = totalWon - totalBet;
  const wins = records.filter(r => r.multiplier >= 1).length;
  const rate = records.length ? Math.round((wins / records.length) * 100) : 0;

  return (
    <div className="bg-[#100C1C] h-full flex flex-col w-full">
      {/* Stats header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#1A1726]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-[#73768C] uppercase tracking-widest">History</span>
          {records.length > 0 && (
            <span className={`text-xs font-bold tabular-nums ${profit >= 0 ? 'text-[#0ECC68]' : 'text-[#ff003f]'}`}>
              {profit >= 0 ? '+' : ''}{profit.toFixed(2)}
            </span>
          )}
        </div>
        {records.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { k: 'Bets', v: records.length },
              { k: 'Won', v: `${rate}%`, c: rate >= 50 ? '#0ECC68' : '#ff003f' },
              { k: 'Wager', v: totalBet.toFixed(0) },
            ].map(s => (
              <div key={s.k} className="py-2 rounded-lg bg-[#000514] border border-[#1A1726] text-center">
                <div className="text-[9px] font-semibold text-[#73768C] uppercase">{s.k}</div>
                <div className="text-xs font-bold tabular-nums mt-0.5" style={{ color: (s as { c?: string }).c || '#fff' }}>{s.v}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[#73768C]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span className="text-xs">No bets yet</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {records.map((r, i) => {
              const color = getMultiplierColor(r.multiplier);
              const isWin = r.multiplier >= 1;
              const pl = r.payout - r.bet;
              return (
                <div key={r.id}
                  className={`flex items-center justify-between h-8 rounded-lg px-3 transition-colors hover:bg-[#1A1726]/40 ${i === 0 ? 'anim-slide' : ''}`}
                  style={{ backgroundColor: i === 0 ? `${color}08` : '#000514', border: `1px solid ${i === 0 ? `${color}20` : '#1A1726'}` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs font-bold tabular-nums" style={{ color }}>{r.multiplier}x</span>
                  </div>
                  <span className={`text-[11px] font-semibold tabular-nums ${isWin ? 'text-[#0ECC68]' : 'text-[#ff003f]'}`}>
                    {isWin ? '+' : ''}{pl.toFixed(2)}
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
