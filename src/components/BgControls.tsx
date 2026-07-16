import { useEffect } from 'react';
import type { RiskLevel } from '../utils/multipliers';
import { fmt } from '../utils/format';

export const MIN_BET = 0.1;
export const MAX_BET = 1000;

interface Props {
  balance: number;
  betStr: string;
  setBetStr: (v: string) => void;
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

// BGaming-style order: High on top.
const RISKS: { v: RiskLevel; l: string; c: string }[] = [
  { v: 'high', l: 'High', c: '#F85F5D' },
  { v: 'medium', l: 'Medium', c: '#F7931A' },
  { v: 'low', l: 'Low', c: '#0ECC68' },
];

// BGaming Plinko control cluster — identical on desktop and mobile:
// Risk card · big round PLAY · Bet Mode card, with the bet stepper row and
// balance beneath.
export default function BgControls({
  balance, betStr, setBetStr, risk, setRisk,
  autoRunning, ballsInFlight, autoPlayed, autoProfit, totalAutoRounds,
  onDrop, onStopAuto, onOpenAuto,
}: Props) {
  const riskLocked = autoRunning || ballsInFlight > 0;
  const bet = Math.max(0, parseFloat(betStr) || 0);

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

  const stepBet = (dir: 1 | -1) => {
    const v = bet;
    const inc = v < 1 || (dir === -1 && v <= 1) ? 0.1 : v < 10 || (dir === -1 && v <= 10) ? 1 : 10;
    setBetStr(Math.max(MIN_BET, Math.min(MAX_BET, v + dir * inc)).toFixed(2));
  };

  return (
    <div className="bgc">
      <div className="bgc-main">
        <div className="bgc-card bgc-risk">
          <span className="bgc-card-label">Risk Level</span>
          {RISKS.map(r => (
            <button
              key={r.v}
              className={`bgc-opt${risk === r.v ? ' active' : ''}`}
              onClick={() => setRisk(r.v)}
              disabled={riskLocked}
              style={risk === r.v ? { color: r.c, borderColor: `${r.c}55`, background: `${r.c}1c` } : undefined}
            >
              <span className="bgc-opt-dot" style={{ background: r.c }} />
              {r.l}
            </button>
          ))}
        </div>

        {autoRunning ? (
          <button className="play-btn stop" onClick={onStopAuto}>
            <span className="play-btn-label">STOP</span>
            <span className="play-btn-sub">{autoPlayed}/{totalAutoRounds} · {autoProfit >= 0 ? '+' : ''}{fmt(autoProfit)}</span>
          </button>
        ) : (
          <button className="play-btn" onClick={onDrop} disabled={bet <= 0 || bet > balance}>
            <span className="play-btn-label">PLAY</span>
          </button>
        )}

        <div className="bgc-card bgc-mode">
          <span className="bgc-card-label">Bet Mode</span>
          <button className={`bgc-opt${!autoRunning ? ' active-mode' : ''}`} onClick={autoRunning ? onStopAuto : undefined}>
            <span className="bgc-opt-ico">M</span>
            Manual
          </button>
          <button className={`bgc-opt${autoRunning ? ' active-mode' : ''}`} onClick={onOpenAuto} disabled={autoRunning}>
            <span className="bgc-opt-ico bgc-opt-ico--a">A</span>
            Auto
          </button>
        </div>
      </div>

      <div className="bgc-bet-row">
        <div className="bgc-bet-side">
          <button className="bgc-pill" disabled={autoRunning} onClick={() => setBetStr(MIN_BET.toFixed(2))}>Min</button>
          <button className="bgc-pill" disabled={autoRunning} onClick={() => stepBet(-1)}>−</button>
        </div>
        <label className="bgc-bet-display">
          <span>Bet</span>
          <input
            type="number" value={betStr} min={MIN_BET} max={MAX_BET} step="0.10"
            disabled={autoRunning}
            onChange={e => setBetStr(e.target.value)}
          />
        </label>
        <div className="bgc-bet-side">
          <button className="bgc-pill" disabled={autoRunning} onClick={() => stepBet(1)}>+</button>
          <button className="bgc-pill" disabled={autoRunning} onClick={() => setBetStr(Math.min(MAX_BET, balance).toFixed(2))}>Max</button>
        </div>
      </div>

      <div className="bgc-balance">Balance <b>{fmt(balance)}</b></div>
    </div>
  );
}
