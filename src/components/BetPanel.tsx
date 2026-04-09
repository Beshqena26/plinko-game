import { useState, useEffect } from 'react';
import type { RiskLevel } from '../utils/multipliers';
import type { BetResult } from '../App';
import { sound } from '../utils/sound';

interface Props {
  balance: number;
  betAmount: number;
  setBetAmount: (v: number) => void;
  rows: number;
  setRows: (v: number) => void;
  risk: RiskLevel;
  setRisk: (v: RiskLevel) => void;
  isAuto: boolean;
  autoBetCount: number;
  setAutoBetCount: (v: number) => void;
  onDrop: () => void;
  onStartAuto: () => void;
  onStopAuto: () => void;
  canBet: boolean;
  history: BetResult[];
}

export default function BetPanel({
  balance, betAmount, setBetAmount, rows, setRows, risk, setRisk,
  isAuto, autoBetCount, setAutoBetCount,
  onDrop, onStartAuto, onStopAuto, canBet, history,
}: Props) {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (mode === 'manual') onDrop();
        else if (!isAuto) onStartAuto();
        else onStopAuto();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [mode, isAuto, onDrop, onStartAuto, onStopAuto]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06]">
        <span className="text-lg font-black tracking-tight bg-gradient-to-r from-[#0ECC68] to-[#0aa050] bg-clip-text text-transparent">PLINKO</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setSoundOn(sound.toggle())}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#73768C] hover:text-white transition-colors">
            {soundOn ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        {/* Mode */}
        <div className="flex h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] p-1 gap-1">
          {(['manual', 'auto'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 rounded-md text-[13px] font-semibold capitalize transition-all
                ${mode === m ? 'bg-white/[0.08] text-white' : 'text-[#73768C] hover:text-[#C2C5D6]'}`}
            >{m}</button>
          ))}
        </div>

        {/* Bet amount */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[13px] text-[#C2C5D6]">Your Bet</span>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-[#FBCE04] flex items-center justify-center">
                <span className="text-[7px] font-black text-[#000514]">$</span>
              </div>
              <span className="text-[13px] font-bold text-white tabular-nums">{balance.toFixed(2)}</span>
            </div>
          </div>

          <div className="h-11 flex items-center bg-white/[0.03] rounded-lg border border-white/[0.06] focus-within:border-[#0ECC68]/30 transition-colors">
            <div className="w-10 flex items-center justify-center shrink-0">
              <div className="w-5 h-5 rounded-full bg-[#FBCE04] flex items-center justify-center">
                <span className="text-[8px] font-black text-[#000514]">$</span>
              </div>
            </div>
            <input type="number" value={betAmount} step="0.01"
              onChange={e => setBetAmount(Math.max(0, Math.min(10000, +e.target.value || 0)))}
              className="flex-1 h-full bg-transparent text-white text-[15px] font-semibold outline-none tabular-nums" />
          </div>

          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {[
              { l: 'MIN', fn: () => setBetAmount(0.01) },
              { l: '1/2', fn: () => setBetAmount(Math.max(0.01, +(betAmount / 2).toFixed(2))) },
              { l: 'X2', fn: () => setBetAmount(Math.min(10000, +(betAmount * 2).toFixed(2))) },
              { l: 'MAX', fn: () => setBetAmount(Math.min(10000, balance)) },
            ].map(b => (
              <button key={b.l} onClick={b.fn}
                className="h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[12px] font-semibold text-[#73768C]
                  hover:text-white hover:bg-white/[0.06] active:scale-[0.96] transition-all"
              >{b.l}</button>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[13px] text-[#C2C5D6]">Rows</span>
            <span className="text-[15px] font-bold text-white tabular-nums">{rows}</span>
          </div>
          <div className="h-10 flex items-center bg-white/[0.03] rounded-lg border border-white/[0.06] px-4">
            <input type="range" min={8} max={16} value={rows}
              onChange={e => setRows(+e.target.value)} disabled={isAuto} className="w-full" />
          </div>
        </div>

        {/* Risk */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[13px] text-[#C2C5D6]">Risk</span>
            <span className="text-[13px] font-bold"
              style={{ color: risk === 'low' ? '#0ECC68' : risk === 'medium' ? '#FBCE04' : '#ff003f' }}>
              {risk === 'low' ? 'Low' : risk === 'medium' ? 'Medium' : 'High'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { v: 'low' as RiskLevel, l: 'Low', c: '#0ECC68' },
              { v: 'medium' as RiskLevel, l: 'Medium', c: '#FBCE04' },
              { v: 'high' as RiskLevel, l: 'High', c: '#ff003f' },
            ]).map(r => {
              const on = risk === r.v;
              return (
                <button key={r.v} onClick={() => setRisk(r.v)} disabled={isAuto}
                  className={`h-10 rounded-lg text-[13px] font-bold transition-all disabled:opacity-30
                    ${on ? '' : 'bg-white/[0.03] border border-white/[0.06] text-[#73768C] hover:text-[#C2C5D6]'}`}
                  style={on ? { background: `${r.c}12`, border: `1.5px solid ${r.c}30`, color: r.c } : undefined}
                >{r.l}</button>
              );
            })}
          </div>
        </div>

        {/* Auto bet count */}
        {mode === 'auto' && (
          <div className="anim-slide">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[13px] text-[#C2C5D6]">Number of Bets</span>
            </div>
            <input type="number" value={autoBetCount}
              onChange={e => setAutoBetCount(Math.max(1, Math.min(1000, +e.target.value || 1)))}
              className="w-full h-11 bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 text-white text-[15px] font-semibold outline-none focus:border-[#0ECC68]/30 transition-colors tabular-nums" />
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1 min-h-3" />

        {/* Drop button */}
        {mode === 'manual' ? (
          <button onClick={onDrop} disabled={!canBet}
            className="w-full h-12 rounded-xl font-bold text-[15px] transition-all
              bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78] hover:shadow-[0_0_24px_rgba(14,204,104,0.15)]
              active:scale-[0.97] disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:shadow-none">
            Drop ball
          </button>
        ) : isAuto ? (
          <button onClick={onStopAuto}
            className="w-full h-12 rounded-xl font-bold text-[15px] bg-[#ff003f] text-white hover:bg-[#ff2d5a] active:scale-[0.97] transition-all">
            Stop Autobet
          </button>
        ) : (
          <button onClick={onStartAuto} disabled={!canBet}
            className="w-full h-12 rounded-xl font-bold text-[15px] bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78] active:scale-[0.97] disabled:opacity-20 disabled:cursor-not-allowed transition-all">
            Start Autobet
          </button>
        )}
      </div>

      {/* Recent results */}
      {history.length > 0 && (
        <div className="px-5 py-3 border-t border-white/[0.06]">
          <div className="flex flex-wrap gap-1.5">
            {history.slice(0, 14).map((r, i) => (
              <div key={r.id}
                className={`h-6 px-2 rounded text-[11px] font-bold tabular-nums flex items-center ${i === 0 ? 'anim-slide' : ''}`}
                style={{ background: `${r.color}12`, color: r.color }}>
                {r.mult}x
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/[0.06] flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-[#0ECC68]/10 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#0ECC68"><path d="M12 2L2 19h20L12 2z"/></svg>
        </div>
        <span className="text-[11px] text-[#73768C]/50">Plinko</span>
      </div>
    </div>
  );
}
