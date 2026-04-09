import { useState, useEffect, useRef } from 'react';
import type { RiskLevel } from '../utils/multipliers';
import { sound } from '../utils/sound';

interface BetControlsProps {
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
  disabled: boolean;
  stopOnProfit: number;
  setStopOnProfit: (v: number) => void;
  stopOnLoss: number;
  setStopOnLoss: (v: number) => void;
}

const RISKS: { value: RiskLevel; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#0ECC68' },
  { value: 'medium', label: 'Medium', color: '#FBCE04' },
  { value: 'high', label: 'High', color: '#ff003f' },
];

export default function BetControls(props: BetControlsProps) {
  const {
    balance, betAmount, setBetAmount, rows, setRows, risk, setRisk,
    isAuto, autoBetCount, setAutoBetCount,
    onDrop, onStartAuto, onStopAuto, disabled,
    stopOnProfit, setStopOnProfit, stopOnLoss, setStopOnLoss,
  } = props;

  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [soundOn, setSoundOn] = useState(true);
  const [pressed, setPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Space to drop
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (mode === 'manual') onDrop();
        else if (!isAuto) onStartAuto();
        else onStopAuto();
        setPressed(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setPressed(false), 120);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [mode, isAuto, onDrop, onStartAuto, onStopAuto]);

  const fire = () => {
    onDrop();
    setPressed(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPressed(false), 120);
  };

  const canBet = !disabled && balance >= betAmount && betAmount > 0;

  return (
    <div className="px-6 py-5">
      {/* ── Row 1: Mode tabs + main controls ── */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Mode toggle */}
        <div className="flex h-12 rounded-xl bg-[#000514] p-1 gap-1 lg:w-[160px] shrink-0">
          {(['manual', 'auto'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 rounded-lg text-sm font-semibold capitalize transition-all
                ${mode === m ? 'bg-[#1A1726] text-white' : 'text-[#73768C] hover:text-[#C2C5D6]'}`}
            >{m}</button>
          ))}
        </div>

        {/* Bet amount */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center h-12 flex-1 bg-[#000514] rounded-xl border border-[#1A1726] focus-within:border-[#0ECC68]/40 transition-colors">
              <div className="w-12 flex items-center justify-center shrink-0">
                <div className="w-7 h-7 rounded-full bg-[#FBCE04] flex items-center justify-center">
                  <span className="text-xs font-black text-[#000514]">$</span>
                </div>
              </div>
              <input
                type="number" value={betAmount} step="0.01"
                onChange={e => setBetAmount(Math.max(0, Math.min(10000, +e.target.value || 0)))}
                className="flex-1 h-full bg-transparent text-white text-base font-semibold outline-none tabular-nums pr-4"
              />
            </div>

            {/* Quick buttons */}
            <div className="flex gap-2 shrink-0">
              {[
                { label: 'Min', fn: () => setBetAmount(0.01) },
                { label: '½', fn: () => setBetAmount(Math.max(0.01, +(betAmount / 2).toFixed(2))) },
                { label: '2x', fn: () => setBetAmount(Math.min(10000, +(betAmount * 2).toFixed(2))) },
                { label: 'Max', fn: () => setBetAmount(Math.min(10000, balance)) },
              ].map(b => (
                <button key={b.label} onClick={b.fn}
                  className="h-12 w-14 rounded-xl bg-[#000514] border border-[#1A1726] text-sm font-semibold text-[#73768C]
                    hover:text-white hover:bg-[#1A1726] active:scale-95 transition-all"
                >{b.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Risk */}
        <div className="flex gap-2 shrink-0">
          {RISKS.map(r => {
            const active = risk === r.value;
            return (
              <button key={r.value} onClick={() => setRisk(r.value)} disabled={isAuto}
                className={`h-12 px-5 rounded-xl text-sm font-bold transition-all disabled:opacity-30
                  ${active ? '' : 'bg-[#000514] border border-[#1A1726] text-[#73768C] hover:text-[#C2C5D6]'}`}
                style={active ? { backgroundColor: `${r.color}18`, border: `2px solid ${r.color}35`, color: r.color } : undefined}
              >{r.label}</button>
            );
          })}
        </div>

        {/* Rows */}
        <div className="flex items-center gap-3 shrink-0 lg:w-[180px]">
          <span className="text-sm font-medium text-[#C2C5D6] shrink-0">Rows</span>
          <input type="range" min={8} max={16} value={rows}
            onChange={e => setRows(+e.target.value)} disabled={isAuto}
            className="flex-1" />
          <span className="h-8 w-10 rounded-lg bg-[#000514] border border-[#1A1726] text-sm font-bold text-white flex items-center justify-center tabular-nums shrink-0">{rows}</span>
        </div>

        {/* Drop button */}
        {mode === 'manual' ? (
          <button onClick={fire} disabled={!canBet}
            className={`h-12 px-8 rounded-xl font-bold text-base transition-all shrink-0
              bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78]
              active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed
              ${pressed ? 'scale-[0.97]' : ''}`}>
            Drop ball
          </button>
        ) : isAuto ? (
          <button onClick={onStopAuto}
            className="h-12 px-8 rounded-xl font-bold text-base bg-[#ff003f] text-white hover:bg-[#ff2d5a] active:scale-[0.97] transition-all shrink-0">
            Stop
          </button>
        ) : (
          <button onClick={onStartAuto} disabled={!canBet}
            className="h-12 px-8 rounded-xl font-bold text-base bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78] active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed transition-all shrink-0">
            Start Auto
          </button>
        )}
      </div>

      {/* ── Row 2: Auto options (only in auto mode) ── */}
      {mode === 'auto' && (
        <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t border-[#1A1726] anim-slide">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-sm font-medium text-[#C2C5D6] shrink-0">Bets</span>
            <input type="number" value={autoBetCount}
              onChange={e => setAutoBetCount(Math.max(1, Math.min(1000, +e.target.value || 1)))}
              className="h-10 w-24 bg-[#000514] border border-[#1A1726] rounded-lg px-3 text-white text-sm font-semibold outline-none focus:border-[#0ECC68]/40 transition-colors tabular-nums" />
          </div>
          <div className="flex items-center gap-3 flex-1">
            <span className="text-sm font-medium text-[#0ECC68] shrink-0">+$ Profit</span>
            <input type="number" value={stopOnProfit || ''} placeholder="0"
              onChange={e => setStopOnProfit(Math.max(0, +e.target.value || 0))}
              className="h-10 w-24 bg-[#000514] border border-[#1A1726] rounded-lg px-3 text-white text-sm font-semibold outline-none focus:border-[#0ECC68]/30 transition-colors tabular-nums" />
          </div>
          <div className="flex items-center gap-3 flex-1">
            <span className="text-sm font-medium text-[#ff003f] shrink-0">-$ Loss</span>
            <input type="number" value={stopOnLoss || ''} placeholder="0"
              onChange={e => setStopOnLoss(Math.max(0, +e.target.value || 0))}
              className="h-10 w-24 bg-[#000514] border border-[#1A1726] rounded-lg px-3 text-white text-sm font-semibold outline-none focus:border-[#ff003f]/30 transition-colors tabular-nums" />
          </div>
        </div>
      )}

      {/* ── Row 3: Sound + keyboard hint ── */}
      <div className="flex items-center justify-between mt-4 h-8">
        <button onClick={() => { setSoundOn(sound.toggle()); }}
          className="flex items-center gap-2 text-sm text-[#73768C] hover:text-[#C2C5D6] transition-colors">
          {soundOn ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          )}
          {soundOn ? 'Sound On' : 'Sound Off'}
        </button>
        <div className="flex items-center gap-2 text-sm text-[#73768C]/30">
          <kbd className="px-2 h-6 flex items-center rounded-md bg-[#1A1726] border border-[#2a2538] text-xs font-mono text-[#73768C]/50">Space</kbd>
          <span>to drop</span>
        </div>
      </div>
    </div>
  );
}
