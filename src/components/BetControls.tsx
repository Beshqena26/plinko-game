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

const RISK_OPTIONS: { value: RiskLevel; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#0ECC68' },
  { value: 'medium', label: 'Medium', color: '#FBCE04' },
  { value: 'high', label: 'High', color: '#ff003f' },
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
  const [btnPressed, setBtnPressed] = useState(false);
  const btnTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const riskIndex = RISK_OPTIONS.findIndex(r => r.value === risk);
  const riskColor = RISK_OPTIONS[riskIndex].color;

  // Keyboard: Space to drop
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (mode === 'manual') onDrop();
        else if (!isAuto) onStartAuto();
        else onStopAuto();

        setBtnPressed(true);
        clearTimeout(btnTimeoutRef.current);
        btnTimeoutRef.current = setTimeout(() => setBtnPressed(false), 150);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, isAuto, onDrop, onStartAuto, onStopAuto]);

  const handleDrop = () => {
    onDrop();
    setBtnPressed(true);
    clearTimeout(btnTimeoutRef.current);
    btnTimeoutRef.current = setTimeout(() => setBtnPressed(false), 150);
  };

  return (
    <div className="flex flex-col h-full bg-[#100C1C] overflow-y-auto">
      {/* Mode tabs */}
      <div className="p-3 pb-0">
        <div className="flex rounded-xl overflow-hidden bg-[#000514] p-[3px] border border-[#1A1726]/50">
          {(['manual', 'auto'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-[10px] text-[12px] font-bold uppercase tracking-wider transition-all duration-200
                ${mode === m
                  ? 'bg-[#1A1726] text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                  : 'text-[#73768C] hover:text-[#C2C5D6]'
                }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 p-3 flex-1">
        {/* Bet Amount */}
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[12px] font-medium text-[#C2C5D6]">Bet Amount</label>
            <div className="flex items-center gap-1.5">
              <div className="w-[14px] h-[14px] rounded-full bg-[#FBCE04] flex items-center justify-center">
                <span className="text-[7px] font-black text-[#000514]">$</span>
              </div>
              <span className="text-[12px] font-bold text-[#FBCE04] tabular-nums">{balance.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center bg-[#000514] rounded-xl border border-[#1A1726] focus-within:border-[#0ECC68]/40 focus-within:shadow-[0_0_0_2px_rgba(14,204,104,0.06)] transition-all duration-200">
            <span className="pl-3.5 flex items-center">
              <div className="w-[18px] h-[18px] rounded-full bg-[#FBCE04] flex items-center justify-center">
                <span className="text-[8px] font-black text-[#000514]">$</span>
              </div>
            </span>
            <input
              type="number"
              value={betAmount}
              onChange={e => setBetAmount(Math.max(0, Math.min(10000, +e.target.value || 0)))}
              className="flex-1 bg-transparent py-3 px-2.5 text-white text-[15px] font-semibold outline-none tabular-nums"
              step="0.01"
            />
          </div>

          <div className="flex gap-1 mt-1.5">
            {[
              { label: 'MIN', action: () => setBetAmount(0.01) },
              { label: '½', action: () => setBetAmount(Math.max(0.01, +(betAmount / 2).toFixed(2))) },
              { label: '2X', action: () => setBetAmount(Math.min(10000, +(betAmount * 2).toFixed(2))) },
              { label: 'MAX', action: () => setBetAmount(Math.min(10000, balance)) },
            ].map(btn => (
              <button
                key={btn.label}
                onClick={btn.action}
                className="flex-1 py-[7px] bg-[#000514] border border-[#1A1726] rounded-lg
                  text-[10px] font-bold text-[#73768C]
                  hover:text-white hover:bg-[#1A1726] hover:border-[#2a2538]
                  active:scale-[0.94] transition-all duration-150"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="bg-[#000514] border border-[#1A1726] rounded-xl p-3.5 transition-all hover:border-[#2a2538]">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[12px] font-medium text-[#C2C5D6]">Rows</label>
            <div className="bg-[#1A1726] px-2.5 py-1 rounded-lg">
              <span className="text-[14px] font-bold text-white tabular-nums">{rows}</span>
            </div>
          </div>
          <input
            type="range" min={8} max={16} value={rows}
            onChange={e => setRows(+e.target.value)}
            disabled={isAuto}
            className="w-full"
          />
          <div className="flex justify-between mt-1.5 px-[1px]">
            {[8, 10, 12, 14, 16].map(n => (
              <span key={n} className={`text-[9px] font-medium transition-colors ${rows === n ? 'text-[#0ECC68]' : 'text-[#73768C]/50'}`}>{n}</span>
            ))}
          </div>
        </div>

        {/* Risk */}
        <div className="bg-[#000514] border border-[#1A1726] rounded-xl p-3.5 transition-all hover:border-[#2a2538]">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[12px] font-medium text-[#C2C5D6]">Risk</label>
            <div className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${riskColor}15`, border: `1px solid ${riskColor}25` }}>
              <span className="text-[12px] font-bold" style={{ color: riskColor }}>{RISK_OPTIONS[riskIndex].label}</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            {RISK_OPTIONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setRisk(r.value)}
                disabled={isAuto}
                className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all duration-200
                  ${risk === r.value
                    ? 'text-white shadow-sm'
                    : 'text-[#73768C] hover:text-[#C2C5D6] bg-transparent'
                  } disabled:opacity-35`}
                style={risk === r.value ? {
                  backgroundColor: `${r.color}18`,
                  border: `1px solid ${r.color}35`,
                  color: r.color,
                } : {
                  backgroundColor: '#100C1C',
                  border: '1px solid #1A1726',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-bet options */}
        {mode === 'auto' && (
          <div className="flex flex-col gap-3 animate-slide-up">
            <div>
              <label className="text-[12px] font-medium text-[#C2C5D6] mb-1.5 block">Number of Bets</label>
              <input
                type="number"
                value={autoBetCount}
                onChange={e => setAutoBetCount(Math.max(1, Math.min(1000, +e.target.value || 1)))}
                className="w-full bg-[#000514] border border-[#1A1726] rounded-xl py-2.5 px-3.5 text-white text-sm font-semibold outline-none focus:border-[#0ECC68]/40 focus:shadow-[0_0_0_2px_rgba(14,204,104,0.06)] transition-all"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-medium text-[#73768C] uppercase tracking-wider mb-1 block">Stop on Profit</label>
                <div className="flex items-center bg-[#000514] border border-[#1A1726] rounded-xl focus-within:border-[#0ECC68]/30 transition-all">
                  <span className="pl-2.5 text-[#0ECC68] text-[10px] font-bold">+$</span>
                  <input
                    type="number" value={stopOnProfit || ''} placeholder="0"
                    onChange={e => setStopOnProfit(Math.max(0, +e.target.value || 0))}
                    className="w-full bg-transparent py-2 px-1.5 text-white text-xs font-semibold outline-none tabular-nums"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-medium text-[#73768C] uppercase tracking-wider mb-1 block">Stop on Loss</label>
                <div className="flex items-center bg-[#000514] border border-[#1A1726] rounded-xl focus-within:border-[#ff003f]/30 transition-all">
                  <span className="pl-2.5 text-[#ff003f] text-[10px] font-bold">-$</span>
                  <input
                    type="number" value={stopOnLoss || ''} placeholder="0"
                    onChange={e => setStopOnLoss(Math.max(0, +e.target.value || 0))}
                    className="w-full bg-transparent py-2 px-1.5 text-white text-xs font-semibold outline-none tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-4" />

        {/* Action Button */}
        {mode === 'manual' ? (
          <button
            onClick={handleDrop}
            disabled={disabled || balance < betAmount || betAmount <= 0}
            className={`w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-150
              bg-[#0ECC68] text-[#000514]
              hover:bg-[#1cdf78] hover:shadow-[0_6px_30px_rgba(14,204,104,0.25)]
              active:scale-[0.97] active:shadow-[0_2px_12px_rgba(14,204,104,0.2)]
              disabled:opacity-25 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:shadow-none
              ${btnPressed ? 'scale-[0.97] shadow-[0_2px_12px_rgba(14,204,104,0.3)]' : ''}`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity="0.3"/><circle cx="12" cy="12" r="4"/></svg>
              Drop ball
            </span>
            <span className="block text-[9px] opacity-40 font-medium mt-0.5 tracking-wider">PRESS SPACE</span>
          </button>
        ) : isAuto ? (
          <button
            onClick={onStopAuto}
            className="w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-150
              bg-[#ff003f] text-white
              hover:bg-[#ff2d5a] hover:shadow-[0_6px_30px_rgba(255,0,63,0.2)]
              active:scale-[0.97] animate-pulse-ring"
          >
            <span className="flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
              Stop Autobet
            </span>
          </button>
        ) : (
          <button
            onClick={onStartAuto}
            disabled={disabled || balance < betAmount || betAmount <= 0}
            className="w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-150
              bg-[#0ECC68] text-[#000514]
              hover:bg-[#1cdf78] hover:shadow-[0_6px_30px_rgba(14,204,104,0.25)]
              active:scale-[0.97]
              disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Start Autobet
            </span>
            <span className="block text-[9px] opacity-40 font-medium mt-0.5 tracking-wider">PRESS SPACE</span>
          </button>
        )}

        {/* Sound toggle */}
        <button
          onClick={() => { const s = sound.toggle(); setSoundOn(s); }}
          className="flex items-center justify-center gap-2 py-1.5 text-[10px] font-medium text-[#73768C] hover:text-[#C2C5D6] transition-all duration-200 rounded-lg hover:bg-[#1A1726]/30"
          data-tooltip={soundOn ? 'Mute sounds' : 'Enable sounds'}
        >
          {soundOn ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          )}
          {soundOn ? 'Sound On' : 'Sound Off'}
        </button>
      </div>
    </div>
  );
}
