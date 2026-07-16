import { useEffect } from 'react';
import type { RiskLevel } from '../utils/multipliers';
import { fmt } from '../App';

interface Props {
  balance: number;
  betStr: string;
  setBetStr: (v: string) => void;
  rows: number;
  setRows: (v: number) => void;
  risk: RiskLevel;
  setRisk: (v: RiskLevel) => void;
  autoRunning: boolean;
  ballsInFlight: number;
  autoPlayed: number;
  autoProfit: number;
  totalAutoRounds: string;
  onDrop: () => void;
  onStopAuto: () => void;
  onOpenAuto: () => void;
}

export const MIN_BET = 0.1;
export const MAX_BET = 1000;

const RISKS: { v: RiskLevel; l: string; c: string }[] = [
  { v: 'low', l: 'Low', c: '#0ECC68' },
  { v: 'medium', l: 'Medium', c: '#F7931A' },
  { v: 'high', l: 'High', c: '#F85F5D' },
];

export default function SidePanel({
  balance, betStr, setBetStr, rows, setRows, risk, setRisk,
  autoRunning, ballsInFlight, autoPlayed, autoProfit, totalAutoRounds,
  onDrop, onStopAuto, onOpenAuto,
}: Props) {
  // Rows/risk changes rebuild the physics world, so they lock while any ball
  // is still falling (each ball's payout is already snapshotted at drop time).
  const boardLocked = autoRunning || ballsInFlight > 0;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (autoRunning) onStopAuto(); else onDrop();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [autoRunning, onDrop, onStopAuto]);

  const bet = Math.max(0, parseFloat(betStr) || 0);
  const stepBet = (dir: 1 | -1) => {
    const v = bet;
    const inc = v < 1 || (dir === -1 && v <= 1) ? 0.1 : v < 10 || (dir === -1 && v <= 10) ? 1 : 10;
    setBetStr(Math.max(MIN_BET, Math.min(MAX_BET, v + dir * inc)).toFixed(2));
  };

  return (
    <>
      <div className="stake-bet">
        <div className="stake-left">
          <label className="risk-label">Bet Amount</label>
          <div className="stake-input">
            <button className="stake-pm" onClick={() => stepBet(-1)} disabled={autoRunning}>−</button>
            <input
              className="stake-amount" type="number" value={betStr}
              onChange={e => setBetStr(e.target.value)}
              disabled={autoRunning} min={MIN_BET} max={MAX_BET} step="0.10"
            />
            <button className="stake-pm" onClick={() => stepBet(1)} disabled={autoRunning}>+</button>
            <span className="stake-bal">{fmt(balance)}</span>
          </div>
          <div className="stake-chips">
            <button className="stake-chip" onClick={() => setBetStr('1.00')} disabled={autoRunning}>1</button>
            <button className="stake-chip" onClick={() => setBetStr('5.00')} disabled={autoRunning}>5</button>
            <button className="stake-chip" onClick={() => setBetStr('10.00')} disabled={autoRunning}>10</button>
            <button className="stake-chip" onClick={() => setBetStr(Math.min(MAX_BET, balance).toFixed(2))} disabled={autoRunning}>Max</button>
          </div>
        </div>
        <button className="place-btn" onClick={onDrop} disabled={bet <= 0 || bet > balance}>
          <span className="stake-bet-label">Drop Ball</span>
          <span className="stake-bet-amount">{fmt(bet)}</span>
        </button>
        <button className="auto-stop-bet-btn" onClick={onStopAuto}>
          <span className="auto-stop-label">STOP AUTO</span>
          <span className="auto-stop-sub">{autoPlayed}/{totalAutoRounds} &middot; {autoProfit >= 0 ? '+' : ''}{fmt(autoProfit)}</span>
        </button>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="risk-label">Risk</label>
          <div className="risk-row">
            {RISKS.map(r => {
              const on = risk === r.v;
              return (
                <button
                  key={r.v} className="risk-btn" onClick={() => setRisk(r.v)} disabled={boardLocked}
                  style={on ? { background: `${r.c}1c`, borderColor: `${r.c}55`, color: r.c } : undefined}
                >{r.l}</button>
              );
            })}
          </div>
        </div>
        <div className="field field-rows">
          <label className="risk-label">Rows</label>
          <div className="stake-input">
            <button className="stake-pm" onClick={() => setRows(Math.max(8, rows - 1))} disabled={boardLocked}>−</button>
            <span className="stake-amount" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{rows}</span>
            <button className="stake-pm" onClick={() => setRows(Math.min(16, rows + 1))} disabled={boardLocked}>+</button>
          </div>
        </div>
      </div>

      <button className="auto-open-btn" onClick={onOpenAuto} disabled={autoRunning}>
        <svg viewBox="0 0 24 24" fill="none" width="15" height="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        Auto
      </button>
    </>
  );
}
