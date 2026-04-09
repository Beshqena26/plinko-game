import { RiskLevel } from '../utils/multipliers';
import { soundManager } from '../utils/sound';
import { useState } from 'react';

interface BetControlsProps {
  balance: number;
  betAmount: number;
  setBetAmount: (amount: number) => void;
  rows: number;
  setRows: (rows: number) => void;
  risk: RiskLevel;
  setRisk: (risk: RiskLevel) => void;
  isAutoBetting: boolean;
  autoBetCount: number;
  setAutoBetCount: (count: number) => void;
  onDrop: () => void;
  onStartAutoBet: () => void;
  onStopAutoBet: () => void;
  onHalf: () => void;
  onDouble: () => void;
}

export default function BetControls({
  balance,
  betAmount,
  setBetAmount,
  rows,
  setRows,
  risk,
  setRisk,
  isAutoBetting,
  autoBetCount,
  setAutoBetCount,
  onDrop,
  onStartAutoBet,
  onStopAutoBet,
  onHalf,
  onDouble,
}: BetControlsProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  const handleSoundToggle = () => {
    const enabled = soundManager.toggle();
    setSoundEnabled(enabled);
  };

  return (
    <div className="bg-bg-card rounded-xl p-5 flex flex-col gap-4 h-full">
      {/* Mode Toggle */}
      <div className="flex rounded-lg overflow-hidden border border-border">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
            mode === 'manual'
              ? 'bg-accent-green/20 text-accent-green'
              : 'bg-bg-input text-text-secondary hover:text-text-primary'
          }`}
        >
          Manual
        </button>
        <button
          onClick={() => setMode('auto')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
            mode === 'auto'
              ? 'bg-accent-green/20 text-accent-green'
              : 'bg-bg-input text-text-secondary hover:text-text-primary'
          }`}
        >
          Auto
        </button>
      </div>

      {/* Balance Display */}
      <div className="bg-bg-input rounded-lg p-3 border border-border">
        <div className="text-xs text-text-secondary mb-1">Balance</div>
        <div className="text-xl font-bold text-accent-green">
          ${balance.toFixed(2)}
        </div>
      </div>

      {/* Bet Amount */}
      <div>
        <label className="text-xs text-text-secondary mb-1.5 block">Bet Amount</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-sm">$</span>
            <input
              type="number"
              value={betAmount}
              onChange={e => setBetAmount(Math.max(0.01, Math.min(10000, +e.target.value)))}
              className="w-full bg-bg-input border border-border rounded-lg py-2.5 pl-7 pr-3 text-text-primary text-sm focus:outline-none focus:border-accent-green/50"
              min={0.01}
              max={10000}
              step={0.01}
            />
          </div>
          <button onClick={onHalf} className="bg-bg-input border border-border rounded-lg px-3 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-accent-green/30 transition-colors">
            ½
          </button>
          <button onClick={onDouble} className="bg-bg-input border border-border rounded-lg px-3 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-accent-green/30 transition-colors">
            2×
          </button>
        </div>
      </div>

      {/* Risk Level */}
      <div>
        <label className="text-xs text-text-secondary mb-1.5 block">Risk</label>
        <div className="flex gap-1.5">
          {(['low', 'medium', 'high'] as RiskLevel[]).map(r => (
            <button
              key={r}
              onClick={() => setRisk(r)}
              disabled={isAutoBetting}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                risk === r
                  ? r === 'low'
                    ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                    : r === 'medium'
                    ? 'bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/30'
                    : 'bg-accent-red/20 text-accent-red border border-accent-red/30'
                  : 'bg-bg-input text-text-secondary border border-border hover:text-text-primary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div>
        <label className="text-xs text-text-secondary mb-1.5 block">Rows: {rows}</label>
        <input
          type="range"
          min={8}
          max={16}
          value={rows}
          onChange={e => setRows(+e.target.value)}
          disabled={isAutoBetting}
          className="w-full accent-accent-green"
        />
        <div className="flex justify-between text-[10px] text-text-secondary mt-1">
          <span>8</span>
          <span>12</span>
          <span>16</span>
        </div>
      </div>

      {/* Auto Bet Count */}
      {mode === 'auto' && (
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Number of Bets</label>
          <input
            type="number"
            value={autoBetCount}
            onChange={e => setAutoBetCount(Math.max(1, Math.min(100, +e.target.value)))}
            className="w-full bg-bg-input border border-border rounded-lg py-2.5 px-3 text-text-primary text-sm focus:outline-none focus:border-accent-green/50"
            min={1}
            max={100}
          />
        </div>
      )}

      {/* Drop Button */}
      {mode === 'manual' ? (
        <button
          onClick={onDrop}
          disabled={balance < betAmount}
          className="w-full py-3.5 rounded-lg font-bold text-sm transition-all bg-accent-green text-bg-primary hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed mt-auto"
        >
          Drop Ball
        </button>
      ) : isAutoBetting ? (
        <button
          onClick={onStopAutoBet}
          className="w-full py-3.5 rounded-lg font-bold text-sm transition-all bg-accent-red text-white hover:brightness-110 active:scale-[0.98] mt-auto"
        >
          Stop Auto
        </button>
      ) : (
        <button
          onClick={onStartAutoBet}
          disabled={balance < betAmount}
          className="w-full py-3.5 rounded-lg font-bold text-sm transition-all bg-accent-green text-bg-primary hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed mt-auto"
        >
          Start Auto ({autoBetCount})
        </button>
      )}

      {/* Sound Toggle */}
      <button
        onClick={handleSoundToggle}
        className="flex items-center justify-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors py-1"
      >
        {soundEnabled ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
        )}
        {soundEnabled ? 'Sound On' : 'Sound Off'}
      </button>
    </div>
  );
}
