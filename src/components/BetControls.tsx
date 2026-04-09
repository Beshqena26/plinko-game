import { useState, useEffect } from 'react';
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

const RISK_LABELS: { value: RiskLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export default function BetControls({
  balance,
  betAmount,
  setBetAmount,
  rows,
  setRows,
  risk,
  setRisk,
  isAuto,
  autoBetCount,
  setAutoBetCount,
  onDrop,
  onStartAuto,
  onStopAuto,
  disabled,
  stopOnProfit,
  setStopOnProfit,
  stopOnLoss,
  setStopOnLoss,
}: BetControlsProps) {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [soundOn, setSoundOn] = useState(true);
  const riskIndex = RISK_LABELS.findIndex(r => r.value === risk);

  // Keyboard shortcut: Space to drop
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (mode === 'manual') {
          onDrop();
        } else if (!isAuto) {
          onStartAuto();
        } else {
          onStopAuto();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, isAuto, onDrop, onStartAuto, onStopAuto]);

  return (
    <div className="flex flex-col h-full bg-[#100C1C] p-5 gap-4">
      {/* Mode tabs */}
      <div className="flex rounded-full overflow-hidden bg-[#000514] p-1">
        {(['manual', 'auto'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-full text-[13px] font-semibold capitalize transition-all
              ${mode === m
                ? 'bg-[#1A1726] text-white shadow-sm'
                : 'text-[#73768C] hover:text-[#C2C5D6]'
              }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Your Bet */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[13px] text-[#C2C5D6]">Your Bet</label>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-[#FBCE04] flex items-center justify-center text-[8px] font-bold text-[#000514]">$</span>
            <span className="text-[13px] font-bold text-white">${balance.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex items-center bg-[#000514] rounded-lg border border-[#1A1726] focus-within:border-[#0ECC68]/40 transition-colors">
          <span className="pl-3 flex items-center">
            <span className="w-5 h-5 rounded-full bg-[#FBCE04] flex items-center justify-center text-[9px] font-bold text-[#000514]">$</span>
          </span>
          <input
            type="number"
            value={betAmount}
            onChange={e => setBetAmount(Math.max(0, Math.min(10000, +e.target.value || 0)))}
            className="flex-1 bg-transparent py-2.5 px-2.5 text-white text-[15px] font-medium outline-none"
            step="0.01"
          />
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {[
            { label: 'MIN', action: () => setBetAmount(0.01) },
            { label: '1/2', action: () => setBetAmount(Math.max(0.01, +(betAmount / 2).toFixed(2))) },
            { label: 'X2', action: () => setBetAmount(Math.min(10000, +(betAmount * 2).toFixed(2))) },
            { label: 'MAX', action: () => setBetAmount(Math.min(10000, balance)) },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="flex-1 py-1.5 bg-[#000514] border border-[#1A1726] rounded-lg text-[11px] font-bold text-[#73768C] hover:text-[#C2C5D6] hover:border-[#0ECC68]/30 transition-all active:scale-95"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="bg-[#000514] border border-[#1A1726] rounded-lg p-3">
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-[13px] text-[#C2C5D6]">Rows</label>
          <span className="text-[15px] font-bold text-white">{rows}</span>
        </div>
        <input
          type="range" min={8} max={16} value={rows}
          onChange={e => setRows(+e.target.value)}
          disabled={isAuto}
          className="w-full disabled:opacity-40"
        />
      </div>

      {/* Risk */}
      <div className="bg-[#000514] border border-[#1A1726] rounded-lg p-3">
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-[13px] text-[#C2C5D6]">Risk</label>
          <span className="text-[15px] font-bold text-white">{RISK_LABELS[riskIndex].label}</span>
        </div>
        <input
          type="range" min={0} max={2} value={riskIndex}
          onChange={e => setRisk(RISK_LABELS[+e.target.value].value)}
          disabled={isAuto}
          className="w-full disabled:opacity-40"
        />
        <div className="flex justify-between px-[2px] mt-1.5">
          {RISK_LABELS.map((r, i) => (
            <div key={r.value} className={`w-2 h-2 rounded-full transition-colors ${i <= riskIndex ? 'bg-[#0ECC68]' : 'bg-[#1A1726]'}`} />
          ))}
        </div>
      </div>

      {/* Auto-bet options */}
      {mode === 'auto' && (
        <>
          <div>
            <label className="text-[13px] text-[#C2C5D6] mb-1.5 block">Number of Bets</label>
            <input
              type="number"
              value={autoBetCount}
              onChange={e => setAutoBetCount(Math.max(1, Math.min(1000, +e.target.value || 1)))}
              className="w-full bg-[#000514] border border-[#1A1726] rounded-lg py-2.5 px-3 text-white text-sm font-medium outline-none focus:border-[#0ECC68]/40 transition-colors"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-[#73768C] mb-1 block">Stop Profit</label>
              <div className="flex items-center bg-[#000514] border border-[#1A1726] rounded-lg focus-within:border-[#0ECC68]/30">
                <span className="pl-2 text-[#73768C] text-xs">$</span>
                <input
                  type="number"
                  value={stopOnProfit || ''}
                  onChange={e => setStopOnProfit(Math.max(0, +e.target.value || 0))}
                  placeholder="0"
                  className="w-full bg-transparent py-2 px-1.5 text-white text-xs font-medium outline-none"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-[#73768C] mb-1 block">Stop Loss</label>
              <div className="flex items-center bg-[#000514] border border-[#1A1726] rounded-lg focus-within:border-[#ff003f]/30">
                <span className="pl-2 text-[#73768C] text-xs">$</span>
                <input
                  type="number"
                  value={stopOnLoss || ''}
                  onChange={e => setStopOnLoss(Math.max(0, +e.target.value || 0))}
                  placeholder="0"
                  className="w-full bg-transparent py-2 px-1.5 text-white text-xs font-medium outline-none"
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Bet button */}
      {mode === 'manual' ? (
        <button
          onClick={onDrop}
          disabled={disabled || balance < betAmount || betAmount <= 0}
          className="w-full py-3.5 rounded-xl font-bold text-[16px] transition-all
            bg-[#0ECC68] text-[#000514] hover:bg-[#2cda7f] active:scale-[0.97]
            disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100
            shadow-[0_4px_24px_rgba(14,204,104,0.2)]"
        >
          Drop ball
          <span className="ml-2 text-[11px] opacity-60 font-medium">[Space]</span>
        </button>
      ) : isAuto ? (
        <button
          onClick={onStopAuto}
          className="w-full py-3.5 rounded-xl font-bold text-[16px] transition-all
            bg-[#ff003f] text-white hover:bg-[#ff2d5a] active:scale-[0.97]
            shadow-[0_4px_24px_rgba(255,0,63,0.15)]"
        >
          Stop Autobet
          <span className="ml-2 text-[11px] opacity-60 font-medium">[Space]</span>
        </button>
      ) : (
        <button
          onClick={onStartAuto}
          disabled={disabled || balance < betAmount || betAmount <= 0}
          className="w-full py-3.5 rounded-xl font-bold text-[16px] transition-all
            bg-[#0ECC68] text-[#000514] hover:bg-[#2cda7f] active:scale-[0.97]
            disabled:opacity-30 disabled:cursor-not-allowed
            shadow-[0_4px_24px_rgba(14,204,104,0.2)]"
        >
          Start Autobet
          <span className="ml-2 text-[11px] opacity-60 font-medium">[Space]</span>
        </button>
      )}

      {/* Sound */}
      <button
        onClick={() => { const s = sound.toggle(); setSoundOn(s); }}
        className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-[#73768C] hover:text-[#C2C5D6] transition-colors"
      >
        {soundOn ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
        )}
        {soundOn ? 'Sound On' : 'Sound Off'}
      </button>
    </div>
  );
}
