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
  { value: 'medium', label: 'Med', color: '#FBCE04' },
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
    <div className="px-4 py-3">
      {/* Main row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mode */}
        <div className="flex h-9 rounded-lg bg-[#000514] p-[3px] gap-[3px] shrink-0">
          {(['manual', 'auto'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 rounded-md text-xs font-semibold capitalize transition-all
                ${mode === m ? 'bg-[#1A1726] text-white' : 'text-[#73768C] hover:text-[#C2C5D6]'}`}
            >{m}</button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-[#1A1726] shrink-0 hidden sm:block" />

        {/* Bet input */}
        <div className="flex items-center h-9 bg-[#000514] rounded-lg border border-[#1A1726] focus-within:border-[#0ECC68]/40 transition-colors min-w-[120px] shrink-0">
          <div className="w-8 flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded-full bg-[#FBCE04] flex items-center justify-center">
              <span className="text-[8px] font-black text-[#000514]">$</span>
            </div>
          </div>
          <input type="number" value={betAmount} step="0.01"
            onChange={e => setBetAmount(Math.max(0, Math.min(10000, +e.target.value || 0)))}
            className="w-20 h-full bg-transparent text-white text-sm font-semibold outline-none tabular-nums pr-2" />
        </div>

        {/* Quick bet */}
        <div className="flex gap-1 shrink-0">
          {[
            { l: '½', fn: () => setBetAmount(Math.max(0.01, +(betAmount / 2).toFixed(2))) },
            { l: '2x', fn: () => setBetAmount(Math.min(10000, +(betAmount * 2).toFixed(2))) },
            { l: 'Max', fn: () => setBetAmount(Math.min(10000, balance)) },
          ].map(b => (
            <button key={b.l} onClick={b.fn}
              className="h-9 px-3 rounded-lg bg-[#000514] border border-[#1A1726] text-xs font-semibold text-[#73768C]
                hover:text-white hover:bg-[#1A1726] active:scale-95 transition-all"
            >{b.l}</button>
          ))}
        </div>

        <div className="w-px h-6 bg-[#1A1726] shrink-0 hidden sm:block" />

        {/* Risk */}
        <div className="flex gap-1 shrink-0">
          {RISKS.map(r => {
            const on = risk === r.value;
            return (
              <button key={r.value} onClick={() => setRisk(r.value)} disabled={isAuto}
                className={`h-9 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-30
                  ${on ? '' : 'bg-[#000514] border border-[#1A1726] text-[#73768C] hover:text-[#C2C5D6]'}`}
                style={on ? { backgroundColor: `${r.color}18`, border: `1.5px solid ${r.color}35`, color: r.color } : undefined}
              >{r.label}</button>
            );
          })}
        </div>

        <div className="w-px h-6 bg-[#1A1726] shrink-0 hidden sm:block" />

        {/* Rows */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-[#73768C]">Rows</span>
          <input type="range" min={8} max={16} value={rows}
            onChange={e => setRows(+e.target.value)} disabled={isAuto}
            className="w-20" />
          <span className="w-7 h-7 rounded-md bg-[#000514] border border-[#1A1726] text-xs font-bold text-white flex items-center justify-center tabular-nums">{rows}</span>
        </div>

        <div className="w-px h-6 bg-[#1A1726] shrink-0 hidden sm:block" />

        {/* Drop button */}
        {mode === 'manual' ? (
          <button onClick={fire} disabled={!canBet}
            className={`h-9 px-6 rounded-lg font-bold text-sm transition-all shrink-0
              bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78]
              active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed
              ${pressed ? 'scale-[0.97]' : ''}`}>
            Drop
          </button>
        ) : isAuto ? (
          <button onClick={onStopAuto}
            className="h-9 px-6 rounded-lg font-bold text-sm bg-[#ff003f] text-white hover:bg-[#ff2d5a] active:scale-[0.97] transition-all shrink-0">
            Stop
          </button>
        ) : (
          <button onClick={onStartAuto} disabled={!canBet}
            className="h-9 px-6 rounded-lg font-bold text-sm bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78] active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed transition-all shrink-0">
            Start
          </button>
        )}

        {/* Sound */}
        <button onClick={() => setSoundOn(sound.toggle())}
          className="h-9 w-9 rounded-lg bg-[#000514] border border-[#1A1726] flex items-center justify-center text-[#73768C] hover:text-[#C2C5D6] transition-colors shrink-0 ml-auto">
          {soundOn ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          )}
        </button>
      </div>

      {/* Auto options */}
      {mode === 'auto' && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#1A1726] anim-slide flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#73768C]">Bets</span>
            <input type="number" value={autoBetCount}
              onChange={e => setAutoBetCount(Math.max(1, Math.min(1000, +e.target.value || 1)))}
              className="h-8 w-16 bg-[#000514] border border-[#1A1726] rounded-lg px-2 text-white text-xs font-semibold outline-none focus:border-[#0ECC68]/40 tabular-nums" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#0ECC68]">+Profit</span>
            <input type="number" value={stopOnProfit || ''} placeholder="0"
              onChange={e => setStopOnProfit(Math.max(0, +e.target.value || 0))}
              className="h-8 w-16 bg-[#000514] border border-[#1A1726] rounded-lg px-2 text-white text-xs font-semibold outline-none focus:border-[#0ECC68]/30 tabular-nums" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#ff003f]">-Loss</span>
            <input type="number" value={stopOnLoss || ''} placeholder="0"
              onChange={e => setStopOnLoss(Math.max(0, +e.target.value || 0))}
              className="h-8 w-16 bg-[#000514] border border-[#1A1726] rounded-lg px-2 text-white text-xs font-semibold outline-none focus:border-[#ff003f]/30 tabular-nums" />
          </div>
        </div>
      )}
    </div>
  );
}
