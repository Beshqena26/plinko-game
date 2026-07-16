import { useEffect } from 'react';
import type { RiskLevel } from '../utils/multipliers';
import { fmt } from '../utils/format';

export const MIN_BET = 0.1;
export const MAX_BET = 1000;

// BGaming steps the bet through a fixed ladder — no free typing.
const BET_STEPS = [
  0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7.5, 10, 15, 20,
  25, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000,
];

export type BetMode = 'manual' | 'auto';

interface Props {
  balance: number;
  betStr: string;
  setBetStr: (v: string) => void;
  risk: RiskLevel;
  setRisk: (v: RiskLevel) => void;
  mode: BetMode;
  setMode: (m: BetMode) => void;
  autoRunning: boolean;
  ballsInFlight: number;
  autoPlayed: number;
  autoProfit: number;
  onPlay: () => void;
  onStopAuto: () => void;
}

// BGaming-style order: High on top.
const RISKS: { v: RiskLevel; l: string; c: string }[] = [
  { v: 'high', l: 'High', c: '#F85F5D' },
  { v: 'medium', l: 'Medium', c: '#F7931A' },
  { v: 'low', l: 'Low', c: '#0ECC68' },
];

// BGaming Plinko control cluster — identical on desktop and mobile:
// Risk card · big round PLAY · Bet Mode card, with the Min|−|Bet|+|Max
// stepper row and balance beneath. Auto mode = PLAY starts an endless run,
// the STOP orb ends it.
export default function BgControls({
  balance, betStr, setBetStr, risk, setRisk, mode, setMode,
  autoRunning, ballsInFlight, autoPlayed, autoProfit,
  onPlay, onStopAuto,
}: Props) {
  const riskLocked = autoRunning || ballsInFlight > 0;
  const bet = Math.max(0, parseFloat(betStr) || 0);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (autoRunning) onStopAuto(); else onPlay();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [autoRunning, onPlay, onStopAuto]);

  // Step along the fixed ladder: + moves to the next step above, − below.
  const stepBet = (dir: 1 | -1) => {
    const next = dir === 1
      ? BET_STEPS.find(s => s > bet + 1e-9)
      : [...BET_STEPS].reverse().find(s => s < bet - 1e-9);
    if (next != null) setBetStr(next.toFixed(2));
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
            <span className="play-btn-sub">{autoPlayed} · {autoProfit >= 0 ? '+' : ''}{fmt(autoProfit)}</span>
          </button>
        ) : (
          <button className="play-btn" onClick={onPlay} disabled={bet <= 0 || bet > balance}>
            <span className="play-btn-label">PLAY</span>
          </button>
        )}

        <div className="bgc-card bgc-mode">
          <span className="bgc-card-label">Bet Mode</span>
          <button
            className={`bgc-opt${mode === 'manual' ? ' active-mode' : ''}`}
            onClick={() => setMode('manual')}
            disabled={autoRunning}
          >
            <span className="bgc-opt-ico">M</span>
            Manual
          </button>
          <button
            className={`bgc-opt${mode === 'auto' ? ' active-mode' : ''}`}
            onClick={() => setMode('auto')}
            disabled={autoRunning}
          >
            <span className="bgc-opt-ico bgc-opt-ico--a">A</span>
            Auto
          </button>
        </div>
      </div>

      <div className="bgc-bet-row">
        <div className="bgc-bet-side">
          <button className="bgc-pill" disabled={autoRunning || bet <= MIN_BET} onClick={() => setBetStr(MIN_BET.toFixed(2))}>Min</button>
          <button className="bgc-pill" disabled={autoRunning || bet <= MIN_BET} onClick={() => stepBet(-1)}>−</button>
        </div>
        <div className="bgc-bet-display">
          <span>Bet</span>
          <b>{fmt(bet)}</b>
        </div>
        <div className="bgc-bet-side">
          <button className="bgc-pill" disabled={autoRunning || bet >= MAX_BET} onClick={() => stepBet(1)}>+</button>
          <button className="bgc-pill" disabled={autoRunning || bet >= MAX_BET} onClick={() => setBetStr(MAX_BET.toFixed(2))}>Max</button>
        </div>
      </div>

      <div className="bgc-balance">Balance <b>{fmt(balance)}</b></div>
    </div>
  );
}
