import { useState, useEffect } from 'react';
import type { RiskLevel } from '../utils/multipliers';
import type { BetResult } from '../App';
import { sound } from '../utils/sound';
import { getMultiplierColor } from '../utils/multipliers';

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

  // Space to drop
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
    <div className="flex flex-col h-full">
      {/* ── Logo + Balance ── */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-5">
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-[#0ECC68] to-[#0ba854] bg-clip-text text-transparent">PLINKO</span>
          <button onClick={() => setSoundOn(sound.toggle())}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#73768C] hover:text-white transition-colors">
            {soundOn ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            )}
          </button>
        </div>

        {/* Balance */}
        <div className="flex items-center gap-3 bg-[#000514] rounded-xl px-5 py-4 border border-[#1A1726]">
          <div className="w-8 h-8 rounded-full bg-[#FBCE04] flex items-center justify-center shrink-0">
            <span className="text-sm font-black text-[#000514]">$</span>
          </div>
          <div>
            <div className="text-[11px] text-[#73768C] font-medium">Balance</div>
            <div className="text-xl font-bold text-[#FBCE04] tabular-nums">${balance.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Mode toggle */}
        <div className="flex h-11 rounded-xl bg-[#000514] p-1 gap-1 mb-6">
          {(['manual', 'auto'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 rounded-lg text-sm font-semibold capitalize transition-all
                ${mode === m ? 'bg-[#1A1726] text-white' : 'text-[#73768C] hover:text-[#C2C5D6]'}`}
            >{m}</button>
          ))}
        </div>

        {/* Bet amount */}
        <div className="mb-5">
          <label className="text-sm text-[#C2C5D6] font-medium mb-2 block">Your Bet</label>
          <div className="flex items-center h-12 bg-[#000514] rounded-xl border border-[#1A1726] focus-within:border-[#0ECC68]/40 transition-colors">
            <div className="w-12 flex items-center justify-center shrink-0">
              <div className="w-6 h-6 rounded-full bg-[#FBCE04] flex items-center justify-center">
                <span className="text-[10px] font-black text-[#000514]">$</span>
              </div>
            </div>
            <input type="number" value={betAmount} step="0.01"
              onChange={e => setBetAmount(Math.max(0, Math.min(10000, +e.target.value || 0)))}
              className="flex-1 h-full bg-transparent text-white text-lg font-semibold outline-none tabular-nums pr-4" />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[
              { l: 'MIN', fn: () => setBetAmount(0.01) },
              { l: '1/2', fn: () => setBetAmount(Math.max(0.01, +(betAmount / 2).toFixed(2))) },
              { l: 'X2', fn: () => setBetAmount(Math.min(10000, +(betAmount * 2).toFixed(2))) },
              { l: 'MAX', fn: () => setBetAmount(Math.min(10000, balance)) },
            ].map(b => (
              <button key={b.l} onClick={b.fn}
                className="h-10 rounded-xl bg-[#000514] border border-[#1A1726] text-sm font-semibold text-[#73768C]
                  hover:text-white hover:bg-[#1A1726] active:scale-95 transition-all"
              >{b.l}</button>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-[#C2C5D6] font-medium">Rows</label>
            <span className="text-lg font-bold text-white tabular-nums">{rows}</span>
          </div>
          <div className="bg-[#000514] rounded-xl border border-[#1A1726] px-4 py-3">
            <input type="range" min={8} max={16} value={rows}
              onChange={e => setRows(+e.target.value)} disabled={isAuto} className="w-full" />
          </div>
        </div>

        {/* Risk */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-[#C2C5D6] font-medium">Risk</label>
            <span className="text-sm font-bold" style={{ color: risk === 'low' ? '#0ECC68' : risk === 'medium' ? '#FBCE04' : '#ff003f' }}>
              {risk === 'low' ? 'Low' : risk === 'medium' ? 'Medium' : 'High'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: 'low' as RiskLevel, l: 'Low', c: '#0ECC68' },
              { v: 'medium' as RiskLevel, l: 'Medium', c: '#FBCE04' },
              { v: 'high' as RiskLevel, l: 'High', c: '#ff003f' },
            ]).map(r => {
              const on = risk === r.v;
              return (
                <button key={r.v} onClick={() => setRisk(r.v)} disabled={isAuto}
                  className={`h-11 rounded-xl text-sm font-bold transition-all disabled:opacity-30
                    ${on ? '' : 'bg-[#000514] border border-[#1A1726] text-[#73768C] hover:text-[#C2C5D6]'}`}
                  style={on ? { background: `${r.c}15`, border: `2px solid ${r.c}40`, color: r.c } : undefined}
                >{r.l}</button>
              );
            })}
          </div>
        </div>

        {/* Auto options */}
        {mode === 'auto' && (
          <div className="mb-6 anim-slide">
            <label className="text-sm text-[#C2C5D6] font-medium mb-2 block">Number of Bets</label>
            <input type="number" value={autoBetCount}
              onChange={e => setAutoBetCount(Math.max(1, Math.min(1000, +e.target.value || 1)))}
              className="w-full h-12 bg-[#000514] border border-[#1A1726] rounded-xl px-4 text-white text-lg font-semibold outline-none focus:border-[#0ECC68]/40 transition-colors tabular-nums" />
          </div>
        )}

        {/* Drop button */}
        {mode === 'manual' ? (
          <button onClick={onDrop} disabled={!canBet}
            className="w-full h-14 rounded-xl font-bold text-lg transition-all
              bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78]
              active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed">
            Drop ball
          </button>
        ) : isAuto ? (
          <button onClick={onStopAuto}
            className="w-full h-14 rounded-xl font-bold text-lg bg-[#ff003f] text-white hover:bg-[#ff2d5a] active:scale-[0.97] transition-all">
            Stop Autobet
          </button>
        ) : (
          <button onClick={onStartAuto} disabled={!canBet}
            className="w-full h-14 rounded-xl font-bold text-lg bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78] active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed transition-all">
            Start Autobet
          </button>
        )}

        {/* Recent results */}
        {history.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[#1A1726]">
            <div className="text-[11px] text-[#73768C] font-semibold uppercase tracking-widest mb-3">Recent</div>
            <div className="flex flex-wrap gap-1.5">
              {history.slice(0, 20).map(r => (
                <div key={r.id} className="h-7 px-2.5 rounded-lg text-xs font-bold tabular-nums flex items-center"
                  style={{ background: `${r.color}12`, border: `1px solid ${r.color}20`, color: r.color }}>
                  {r.mult}x
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
