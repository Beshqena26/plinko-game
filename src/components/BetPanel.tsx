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
  { v: 'medium', l: 'Medium', c: '#FBCE04' },
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

  const riskObj = RISKS.find(r => r.v === risk)!;

  return (
    <div className="max-w-[960px] mx-auto w-full px-6 py-5">
      {/* Main row */}
      <div className="flex items-end gap-6">

        {/* ── Balance ── */}
        <div className="shrink-0">
          <div className="text-[11px] text-[#73768C] font-medium uppercase tracking-wider mb-1.5">Balance</div>
          <div className="h-12 px-4 rounded-xl bg-[#000514] border border-[#1A1726] flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FBCE04] flex items-center justify-center shrink-0">
              <span className="text-[10px] font-black text-[#000514]">$</span>
            </div>
            <span className="text-lg font-bold text-[#FBCE04] tabular-nums">{balance.toFixed(2)}</span>
          </div>
        </div>

        {/* ── Bet Amount ── */}
        <div className="flex-1 min-w-[200px]">
          <div className="text-[11px] text-[#73768C] font-medium uppercase tracking-wider mb-1.5">Bet Amount</div>
          <div className="flex gap-2">
            <div className="flex items-center h-12 flex-1 bg-[#000514] rounded-xl border border-[#1A1726] focus-within:border-[#0ECC68]/40 transition-colors">
              <div className="w-11 flex items-center justify-center shrink-0">
                <div className="w-6 h-6 rounded-full bg-[#FBCE04] flex items-center justify-center">
                  <span className="text-[10px] font-black text-[#000514]">$</span>
                </div>
              </div>
              <input type="number" value={betAmount} step="0.01"
                onChange={e => setBetAmount(Math.max(0, Math.min(10000, +e.target.value || 0)))}
                className="flex-1 h-full bg-transparent text-white text-lg font-semibold outline-none tabular-nums pr-3" />
            </div>
            {[
              { l: 'MIN', fn: () => setBetAmount(0.01) },
              { l: '½', fn: () => setBetAmount(Math.max(0.01, +(betAmount / 2).toFixed(2))) },
              { l: '2X', fn: () => setBetAmount(Math.min(10000, +(betAmount * 2).toFixed(2))) },
              { l: 'MAX', fn: () => setBetAmount(Math.min(10000, balance)) },
            ].map(b => (
              <button key={b.l} onClick={b.fn}
                className="h-12 w-12 rounded-xl bg-[#000514] border border-[#1A1726] text-xs font-bold text-[#73768C]
                  hover:text-white hover:bg-[#1A1726] active:scale-95 transition-all shrink-0"
              >{b.l}</button>
            ))}
          </div>
        </div>

        {/* ── Rows ── */}
        <div className="w-[160px] shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-[#73768C] font-medium uppercase tracking-wider">Rows</span>
            <span className="text-sm font-bold text-white tabular-nums">{rows}</span>
          </div>
          <div className="h-12 rounded-xl bg-[#000514] border border-[#1A1726] flex items-center px-4">
            <input type="range" min={8} max={16} value={rows}
              onChange={e => setRows(+e.target.value)} disabled={isAuto} className="w-full" />
          </div>
        </div>

        {/* ── Risk ── */}
        <div className="shrink-0">
          <div className="text-[11px] text-[#73768C] font-medium uppercase tracking-wider mb-1.5">Risk</div>
          <div className="flex gap-1.5 h-12">
            {RISKS.map(r => {
              const on = risk === r.v;
              return (
                <button key={r.v} onClick={() => setRisk(r.v)} disabled={isAuto}
                  className={`h-12 px-4 rounded-xl text-sm font-bold transition-all disabled:opacity-30
                    ${on ? '' : 'bg-[#000514] border border-[#1A1726] text-[#73768C] hover:text-[#C2C5D6]'}`}
                  style={on ? { background: `${r.c}15`, border: `2px solid ${r.c}40`, color: r.c } : undefined}
                >{r.l}</button>
              );
            })}
          </div>
        </div>

        {/* ── Mode + Drop ── */}
        <div className="shrink-0 flex flex-col gap-1.5">
          <div className="flex h-5 gap-2 items-center">
            <div className="flex gap-0.5">
              {(['manual', 'auto'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wider transition-all
                    ${mode === m ? 'text-[#0ECC68]' : 'text-[#73768C] hover:text-[#C2C5D6]'}`}
                >{m}</button>
              ))}
            </div>
            {mode === 'auto' && (
              <input type="number" value={autoBetCount}
                onChange={e => setAutoBetCount(Math.max(1, Math.min(1000, +e.target.value || 1)))}
                className="h-5 w-10 bg-[#000514] border border-[#1A1726] rounded px-1 text-[10px] text-white font-bold outline-none tabular-nums text-center" />
            )}
          </div>
          {mode === 'manual' ? (
            <button onClick={onDrop} disabled={!canBet}
              className="h-12 w-[140px] rounded-xl font-bold text-base transition-all
                bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78]
                active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed">
              Drop ball
            </button>
          ) : isAuto ? (
            <button onClick={onStopAuto}
              className="h-12 w-[140px] rounded-xl font-bold text-base bg-[#ff003f] text-white hover:bg-[#ff2d5a] active:scale-[0.97] transition-all">
              Stop
            </button>
          ) : (
            <button onClick={onStartAuto} disabled={!canBet}
              className="h-12 w-[140px] rounded-xl font-bold text-base bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78] active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed transition-all">
              Start Auto
            </button>
          )}
        </div>

        {/* Sound */}
        <button onClick={() => setSoundOn(sound.toggle())}
          className="h-12 w-12 rounded-xl bg-[#000514] border border-[#1A1726] flex items-center justify-center text-[#73768C] hover:text-white transition-colors shrink-0">
          {soundOn ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          )}
        </button>
      </div>
    </div>
  );
}
