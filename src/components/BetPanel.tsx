import { useState, useEffect } from 'react';
import type { RiskLevel } from '../utils/multipliers';
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
}

const RISKS: { v: RiskLevel; l: string; c: string }[] = [
  { v: 'low', l: 'Low', c: '#0ECC68' },
  { v: 'medium', l: 'Med', c: '#FBCE04' },
  { v: 'high', l: 'High', c: '#ff003f' },
];

export default function BetPanel({
  balance, betAmount, setBetAmount, rows, setRows, risk, setRisk,
  isAuto, autoBetCount, setAutoBetCount,
  onDrop, onStartAuto, onStopAuto, canBet,
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
    <div className="max-w-[1080px] mx-auto w-full px-4 py-3 flex items-center gap-3">
      {/* Balance */}
      <div className="h-10 px-3 rounded-lg bg-[#000514]/80 border border-[#1A1726] flex items-center gap-2 shrink-0">
        <div className="w-5 h-5 rounded-full bg-[#FBCE04] flex items-center justify-center">
          <span className="text-[8px] font-black text-[#000514]">$</span>
        </div>
        <span className="text-sm font-bold text-[#FBCE04] tabular-nums">{balance.toFixed(2)}</span>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-[#1A1726]" />

      {/* Mode */}
      <div className="flex h-8 rounded-md bg-[#000514] p-0.5 shrink-0">
        {(['manual', 'auto'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-2.5 rounded text-[11px] font-bold capitalize transition-all
              ${mode === m ? 'bg-[#1A1726] text-white' : 'text-[#73768C] hover:text-[#C2C5D6]'}`}
          >{m}</button>
        ))}
      </div>

      {/* Bet input */}
      <div className="flex items-center h-10 bg-[#000514]/80 rounded-lg border border-[#1A1726] focus-within:border-[#0ECC68]/40 transition-colors shrink-0">
        <div className="w-9 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-[#FBCE04] flex items-center justify-center">
            <span className="text-[8px] font-black text-[#000514]">$</span>
          </div>
        </div>
        <input type="number" value={betAmount} step="0.01"
          onChange={e => setBetAmount(Math.max(0, Math.min(10000, +e.target.value || 0)))}
          className="w-[80px] h-full bg-transparent text-white text-sm font-bold outline-none tabular-nums" />
      </div>

      {/* Quick bets */}
      <div className="flex gap-1 shrink-0">
        {[
          { l: '½', fn: () => setBetAmount(Math.max(0.01, +(betAmount / 2).toFixed(2))) },
          { l: '2x', fn: () => setBetAmount(Math.min(10000, +(betAmount * 2).toFixed(2))) },
        ].map(b => (
          <button key={b.l} onClick={b.fn}
            className="h-8 w-8 rounded-md bg-[#000514] border border-[#1A1726] text-[11px] font-bold text-[#73768C]
              hover:text-white hover:bg-[#1A1726] active:scale-90 transition-all"
          >{b.l}</button>
        ))}
      </div>

      <div className="w-px h-6 bg-[#1A1726]" />

      {/* Risk pills */}
      <div className="flex gap-1 shrink-0">
        {RISKS.map(r => {
          const on = risk === r.v;
          return (
            <button key={r.v} onClick={() => setRisk(r.v)} disabled={isAuto}
              className={`h-8 px-3 rounded-md text-[11px] font-bold transition-all disabled:opacity-30
                ${on ? '' : 'text-[#73768C] hover:text-[#C2C5D6]'}`}
              style={on ? { background: `${r.c}15`, color: r.c, boxShadow: `inset 0 0 0 1.5px ${r.c}40` } : undefined}
            >{r.l}</button>
          );
        })}
      </div>

      <div className="w-px h-6 bg-[#1A1726]" />

      {/* Rows */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-[#73768C] font-semibold">Rows</span>
        <input type="range" min={8} max={16} value={rows}
          onChange={e => setRows(+e.target.value)} disabled={isAuto}
          className="w-[72px]" />
        <span className="text-xs font-bold text-white tabular-nums w-5 text-center">{rows}</span>
      </div>

      <div className="w-px h-6 bg-[#1A1726]" />

      {/* Auto count */}
      {mode === 'auto' && (
        <>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-[#73768C] font-semibold">#</span>
            <input type="number" value={autoBetCount}
              onChange={e => setAutoBetCount(Math.max(1, Math.min(1000, +e.target.value || 1)))}
              className="h-8 w-12 bg-[#000514] border border-[#1A1726] rounded-md px-2 text-xs text-white font-bold outline-none tabular-nums text-center" />
          </div>
          <div className="w-px h-6 bg-[#1A1726]" />
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Drop */}
      {mode === 'manual' ? (
        <button onClick={onDrop} disabled={!canBet}
          className="h-10 px-7 rounded-lg font-bold text-sm transition-all shrink-0
            bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78] hover:shadow-[0_0_20px_rgba(14,204,104,0.2)]
            active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:shadow-none">
          Drop ball
        </button>
      ) : isAuto ? (
        <button onClick={onStopAuto}
          className="h-10 px-7 rounded-lg font-bold text-sm bg-[#ff003f] text-white hover:bg-[#ff2d5a] active:scale-95 transition-all shrink-0">
          Stop
        </button>
      ) : (
        <button onClick={onStartAuto} disabled={!canBet}
          className="h-10 px-7 rounded-lg font-bold text-sm bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78] active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed transition-all shrink-0">
          Start
        </button>
      )}

      {/* Sound */}
      <button onClick={() => setSoundOn(sound.toggle())}
        className="h-8 w-8 rounded-md flex items-center justify-center text-[#73768C] hover:text-white transition-colors shrink-0">
        {soundOn ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
        )}
      </button>
    </div>
  );
}
