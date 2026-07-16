import { useState, useEffect } from 'react';
import type { RiskLevel } from '../utils/multipliers';

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
  autoPlayed: number;
  onDrop: () => void;
  onStartAuto: () => void;
  onStopAuto: () => void;
  canBet: boolean;
}

const MIN_BET = 0.1;
const MAX_BET = 1000;

const RISKS: { v: RiskLevel; l: string; c: string }[] = [
  { v: 'low', l: 'Low', c: '#0ECC68' },
  { v: 'medium', l: 'Medium', c: '#F7931A' },
  { v: 'high', l: 'High', c: '#F85F5D' },
];

const label = 'text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-mid)]';
const fieldBox = 'bg-[var(--board)] border border-[var(--hairline)] rounded-[10px]';
const chipBtn = `h-7 ${fieldBox} rounded-md text-[11px] font-semibold text-[var(--text-mid)] hover:text-[var(--accent)] hover:border-[var(--accent-border)] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer`;

export default function BetPanel({
  balance, betAmount, setBetAmount, rows, setRows, risk, setRisk,
  isAuto, autoBetCount, setAutoBetCount, autoPlayed,
  onDrop, onStartAuto, onStopAuto, canBet,
}: Props) {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

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

  const clampBet = (v: number) => Math.max(0, Math.min(MAX_BET, v));
  const step = (dir: 1 | -1) => {
    const v = betAmount || 0;
    const inc = v < 1 || (dir === -1 && v <= 1) ? 0.1 : v < 10 || (dir === -1 && v <= 10) ? 1 : 10;
    setBetAmount(+(clampBet(Math.max(MIN_BET, v + dir * inc))).toFixed(2));
  };

  const locked = isAuto;

  return (
    <>
      {/* Mode toggle */}
      <div className={`h-10 shrink-0 flex p-1 gap-1 ${fieldBox}`}>
        {(['manual', 'auto'] as const).map(m => (
          <button
            key={m}
            onClick={() => !isAuto && setMode(m)}
            disabled={isAuto}
            className={`flex-1 rounded-lg text-[12px] font-bold uppercase tracking-[0.04em] transition-all cursor-pointer disabled:cursor-not-allowed
              ${mode === m ? 'mode-tab-active' : 'text-[var(--text-mid)] hover:text-white'}`}
          >{m}</button>
        ))}
      </div>

      {/* Bet amount — RGS stake-input */}
      <div className="flex flex-col gap-1">
        <span className={label}>Bet Amount</span>
        <div className={`h-[38px] flex items-center overflow-hidden ${fieldBox} focus-within:border-[var(--accent-border)] transition-colors ${locked ? 'opacity-60 pointer-events-none' : ''}`}>
          <button onClick={() => step(-1)} disabled={locked} aria-label="Decrease bet"
            className="w-9 h-full text-lg text-[var(--text-mid)] hover:text-white transition-colors cursor-pointer">−</button>
          <input
            type="number" min={MIN_BET} max={MAX_BET} step="0.01" value={betAmount} disabled={locked}
            onChange={e => setBetAmount(clampBet(+e.target.value || 0))}
            className="flex-1 min-w-0 h-full bg-transparent text-center text-white text-[14px] font-semibold outline-none mono"
          />
          <button onClick={() => step(1)} disabled={locked} aria-label="Increase bet"
            className="w-9 h-full text-lg text-[var(--text-mid)] hover:text-white transition-colors cursor-pointer">+</button>
          <span className="h-full items-center px-2.5 border-l border-[var(--hairline)] text-[10px] font-semibold text-[var(--accent)] mono whitespace-nowrap hidden min-[861px]:flex">
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          <button className={chipBtn} disabled={locked} onClick={() => setBetAmount(1)}>1</button>
          <button className={chipBtn} disabled={locked} onClick={() => setBetAmount(5)}>5</button>
          <button className={chipBtn} disabled={locked} onClick={() => setBetAmount(10)}>10</button>
          <button className={chipBtn} disabled={locked} onClick={() => setBetAmount(+Math.min(MAX_BET, balance).toFixed(2))}>Max</button>
        </div>
      </div>

      {/* Risk */}
      <div className="flex flex-col gap-1">
        <span className={label}>Risk</span>
        <div className="grid grid-cols-3 gap-1">
          {RISKS.map(r => {
            const on = risk === r.v;
            return (
              <button
                key={r.v} onClick={() => setRisk(r.v)} disabled={locked}
                className={`h-9 rounded-[10px] text-[12px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                  ${on ? '' : `${fieldBox} text-[var(--text-mid)] hover:text-white`}`}
                style={on ? { background: `${r.c}1c`, border: `1px solid ${r.c}55`, color: r.c } : undefined}
              >{r.l}</button>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className={label}>Rows</span>
          <span className="text-[13px] font-bold text-white mono">{rows}</span>
        </div>
        <div className={`h-[38px] flex items-center px-3.5 ${fieldBox} ${locked ? 'opacity-60' : ''}`}>
          <input type="range" min={8} max={16} value={rows}
            onChange={e => setRows(+e.target.value)} disabled={locked} />
        </div>
      </div>

      {/* Auto: number of rounds */}
      {mode === 'auto' && (
        <div className="flex flex-col gap-1 anim-slide">
          <span className={label}>Number of Rounds</span>
          <div className={`h-[38px] flex items-center overflow-hidden ${fieldBox} focus-within:border-[var(--accent-border)] transition-colors ${locked ? 'opacity-60 pointer-events-none' : ''}`}>
            <input
              type="number" min={0} max={1000} value={autoBetCount === 0 ? '' : autoBetCount} placeholder="∞" disabled={locked}
              onChange={e => setAutoBetCount(Math.max(0, Math.min(1000, Math.floor(+e.target.value || 0))))}
              className="flex-1 min-w-0 h-full bg-transparent text-center text-white text-[14px] font-semibold outline-none mono placeholder:text-[var(--text-dim)]"
            />
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[10, 50, 100, 0].map(n => (
              <button key={n} className={chipBtn} disabled={locked} onClick={() => setAutoBetCount(n)}>
                {n === 0 ? '∞' : n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-1 max-[860px]:hidden" />

      {/* Primary button */}
      {mode === 'manual' ? (
        <button className="place-btn shrink-0" onClick={onDrop} disabled={!canBet}>
          <span className="stake-bet-label">Drop Ball</span>
          <span className="stake-bet-amount mono">${betAmount.toFixed(2)}</span>
        </button>
      ) : isAuto ? (
        <button className="place-btn stop-mode shrink-0" onClick={onStopAuto}>
          <span className="stake-bet-label">Stop Auto</span>
          <span className="text-[11px] font-semibold text-white/80 mono">
            {autoPlayed}{autoBetCount ? ` / ${autoBetCount}` : ''} rounds
          </span>
        </button>
      ) : (
        <button className="place-btn shrink-0" onClick={onStartAuto} disabled={!canBet}>
          <span className="stake-bet-label">Start Auto Play</span>
          <span className="stake-bet-amount mono">${betAmount.toFixed(2)}</span>
        </button>
      )}
    </>
  );
}
