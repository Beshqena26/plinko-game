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

const inputCls = 'w-full h-10 bg-[#000514] border border-[#1A1726] rounded-lg px-3 text-white text-sm font-medium outline-none focus:border-[#0ECC68]/40 transition-colors tabular-nums';

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
  const pressTimer = useRef<ReturnType<typeof setTimeout>>();

  const riskIdx = RISKS.findIndex(r => r.value === risk);

  // Space to drop
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (mode === 'manual') onDrop();
        else if (!isAuto) onStartAuto();
        else onStopAuto();
        setPressed(true);
        clearTimeout(pressTimer.current);
        pressTimer.current = setTimeout(() => setPressed(false), 120);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [mode, isAuto, onDrop, onStartAuto, onStopAuto]);

  const fire = () => {
    onDrop();
    setPressed(true);
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setPressed(false), 120);
  };

  const canBet = !disabled && balance >= betAmount && betAmount > 0;

  return (
    <div className="flex flex-col h-full bg-[#100C1C]">
      {/* Tabs */}
      <div className="p-4 pb-0">
        <div className="flex h-10 rounded-lg bg-[#000514] p-1 gap-1">
          {(['manual', 'auto'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 rounded-md text-12 font-semibold capitalize transition-all
                ${mode === m ? 'bg-[#1A1726] text-white' : 'text-[#73768C] hover:text-[#C2C5D6]'}`}
            >{m}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
        {/* Bet Amount */}
        <div>
          <div className="flex items-center justify-between h-8">
            <span className="text-12 font-medium text-[#C2C5D6]">Bet Amount</span>
            <span className="text-12 font-semibold text-[#C2C5D6] tabular-nums">${balance.toFixed(2)}</span>
          </div>
          <div className="flex items-center h-10 bg-[#000514] rounded-lg border border-[#1A1726] focus-within:border-[#0ECC68]/40 transition-colors">
            <div className="w-10 flex items-center justify-center shrink-0">
              <div className="w-5 h-5 rounded-full bg-[#FBCE04] flex items-center justify-center">
                <span className="text-[9px] font-black text-[#000514]">$</span>
              </div>
            </div>
            <input
              type="number" value={betAmount} step="0.01"
              onChange={e => setBetAmount(Math.max(0, Math.min(10000, +e.target.value || 0)))}
              className="flex-1 h-full bg-transparent text-white text-sm font-semibold outline-none tabular-nums pr-2"
            />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[
              { label: 'Min', fn: () => setBetAmount(0.01) },
              { label: '½', fn: () => setBetAmount(Math.max(0.01, +(betAmount / 2).toFixed(2))) },
              { label: '2x', fn: () => setBetAmount(Math.min(10000, +(betAmount * 2).toFixed(2))) },
              { label: 'Max', fn: () => setBetAmount(Math.min(10000, balance)) },
            ].map(b => (
              <button key={b.label} onClick={b.fn}
                className="h-8 rounded-lg bg-[#000514] border border-[#1A1726] text-12 font-semibold text-[#73768C]
                  hover:text-white hover:bg-[#1A1726] active:scale-95 transition-all"
              >{b.label}</button>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="rounded-lg bg-[#000514] border border-[#1A1726] p-3">
          <div className="flex items-center justify-between h-8">
            <span className="text-12 font-medium text-[#C2C5D6]">Rows</span>
            <span className="h-6 px-2 rounded bg-[#1A1726] text-12 font-bold text-white flex items-center tabular-nums">{rows}</span>
          </div>
          <input type="range" min={8} max={16} value={rows}
            onChange={e => setRows(+e.target.value)} disabled={isAuto} />
        </div>

        {/* Risk */}
        <div className="rounded-lg bg-[#000514] border border-[#1A1726] p-3">
          <div className="flex items-center justify-between h-8 mb-1">
            <span className="text-12 font-medium text-[#C2C5D6]">Risk</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {RISKS.map(r => {
              const active = risk === r.value;
              return (
                <button key={r.value} onClick={() => setRisk(r.value)} disabled={isAuto}
                  className={`h-8 rounded-lg text-12 font-bold transition-all disabled:opacity-30
                    ${active ? 'text-white' : 'bg-[#100C1C] border border-[#1A1726] text-[#73768C] hover:text-[#C2C5D6]'}`}
                  style={active ? { backgroundColor: `${r.color}20`, border: `1px solid ${r.color}40`, color: r.color } : undefined}
                >{r.label}</button>
              );
            })}
          </div>
        </div>

        {/* Auto options */}
        {mode === 'auto' && (
          <div className="flex flex-col gap-4 anim-slide">
            <div>
              <span className="text-12 font-medium text-[#C2C5D6] block h-8 leading-8">Number of Bets</span>
              <input type="number" value={autoBetCount}
                onChange={e => setAutoBetCount(Math.max(1, Math.min(1000, +e.target.value || 1)))}
                className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-10 font-semibold text-[#73768C] uppercase tracking-wider block h-6 leading-6">Stop Profit</span>
                <div className="flex items-center h-10 bg-[#000514] border border-[#1A1726] rounded-lg focus-within:border-[#0ECC68]/30 transition-colors">
                  <span className="w-8 text-center text-10 font-bold text-[#0ECC68]">+$</span>
                  <input type="number" value={stopOnProfit || ''} placeholder="0"
                    onChange={e => setStopOnProfit(Math.max(0, +e.target.value || 0))}
                    className="flex-1 h-full bg-transparent text-white text-12 font-semibold outline-none tabular-nums pr-2" />
                </div>
              </div>
              <div>
                <span className="text-10 font-semibold text-[#73768C] uppercase tracking-wider block h-6 leading-6">Stop Loss</span>
                <div className="flex items-center h-10 bg-[#000514] border border-[#1A1726] rounded-lg focus-within:border-[#ff003f]/30 transition-colors">
                  <span className="w-8 text-center text-10 font-bold text-[#ff003f]">-$</span>
                  <input type="number" value={stopOnLoss || ''} placeholder="0"
                    onChange={e => setStopOnLoss(Math.max(0, +e.target.value || 0))}
                    className="flex-1 h-full bg-transparent text-white text-12 font-semibold outline-none tabular-nums pr-2" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-4" />

        {/* Action */}
        {mode === 'manual' ? (
          <button onClick={fire} disabled={!canBet}
            className={`h-12 w-full rounded-lg font-bold text-14 transition-all
              bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78]
              active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed
              ${pressed ? 'scale-[0.97]' : ''}`}>
            Drop ball
          </button>
        ) : isAuto ? (
          <button onClick={onStopAuto}
            className="h-12 w-full rounded-lg font-bold text-14 bg-[#ff003f] text-white hover:bg-[#ff2d5a] active:scale-[0.97] transition-all">
            Stop
          </button>
        ) : (
          <button onClick={onStartAuto} disabled={!canBet}
            className="h-12 w-full rounded-lg font-bold text-14 bg-[#0ECC68] text-[#000514] hover:bg-[#1cdf78] active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed transition-all">
            Start Autobet
          </button>
        )}

        {/* Sound + shortcut hint */}
        <div className="flex items-center justify-between h-8">
          <button onClick={() => { setSoundOn(sound.toggle()); }}
            className="flex items-center gap-1.5 text-10 font-medium text-[#73768C] hover:text-[#C2C5D6] transition-colors">
            {soundOn ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            )}
            {soundOn ? 'On' : 'Off'}
          </button>
          <div className="flex items-center gap-1 text-10 text-[#73768C]/40">
            <kbd className="px-1.5 h-5 flex items-center rounded bg-[#1A1726] border border-[#2a2538] text-[9px] font-mono text-[#73768C]/60">Space</kbd>
            <span>to drop</span>
          </div>
        </div>
      </div>
    </div>
  );
}
