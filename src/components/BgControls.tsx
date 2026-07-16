import { useEffect } from 'react';
import type { RiskLevel } from '../utils/multipliers';
import { fmt } from '../utils/format';

export const MIN_BET = 0.1;
export const MAX_BET = 1000;

// BGaming steps the bet through a fixed 1-2-3-5 ladder (observed in the
// demo: 1 → 2 → 3 → 5 → 10 → 15…) — no free typing.
const BET_STEPS = [
  0.1, 0.2, 0.3, 0.5, 1, 2, 3, 5, 10, 15, 20, 30, 50, 100, 150, 200, 300, 500, 1000,
];

// Number-of-bets ladder for auto mode ('0' renders as ∞).
const AUTO_STEPS = ['5', '10', '25', '50', '100', '0'];

export type BetMode = 'manual' | 'auto';

interface Props {
  balance: number;
  betStr: string;
  setBetStr: (v: string) => void;
  risk: RiskLevel;
  setRisk: (v: RiskLevel) => void;
  mode: BetMode;
  setMode: (m: BetMode) => void;
  autoRounds: string;
  setAutoRounds: (v: string) => void;
  autoRunning: boolean;
  ballsInFlight: number;
  autoPlayed: number;
  totalAutoRounds: string;
  onPlay: () => void;
  onStopAuto: () => void;
}

const FlameSVG = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="#F85F5D"><path d="M12 2s1 3.2-1.5 6C8.2 10.5 7 12.3 7 14.5A5 5 0 0 0 12 19.5a5 5 0 0 0 5-5c0-1.6-.6-2.9-1.4-4.1-.4 1-1.1 1.8-2.1 2.1.4-2.5-.3-6.2-1.5-8.5z"/></svg>
);
const GaugeSVG = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#F7931A" strokeWidth="2.4" strokeLinecap="round"><path d="M5 17a8 8 0 1 1 14 0"/><path d="M12 13l3.5-3.5"/></svg>
);
const IceSVG = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#E91E8C" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v18M5.5 6.5l13 11M18.5 6.5l-13 11"/></svg>
);

const RISKS: { v: RiskLevel; l: string; ico: React.ReactNode }[] = [
  { v: 'high', l: 'High', ico: <FlameSVG /> },
  { v: 'medium', l: 'Normal', ico: <GaugeSVG /> },
  { v: 'low', l: 'Low', ico: <IceSVG /> },
];

// BGaming Plinko control cluster (1:1 with the demo close-up):
// labels above purple cards · white icon squares · big glossy PLAY orb with
// the dotted bounce arc · Number-of-bets stepper appears in Auto mode.
export default function BgControls({
  balance, betStr, setBetStr, risk, setRisk, mode, setMode,
  autoRounds, setAutoRounds,
  autoRunning, ballsInFlight, autoPlayed, totalAutoRounds,
  onPlay, onStopAuto,
}: Props) {
  // BGaming locks the whole cluster while a ball is in flight — one ball at
  // a time in manual, and everything dims during an auto run.
  const locked = autoRunning || ballsInFlight > 0;
  const bet = Math.max(0, parseFloat(betStr) || 0);
  const remaining = totalAutoRounds === '∞' ? '∞' : String(Math.max(0, parseInt(totalAutoRounds) - autoPlayed));

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

  const stepBet = (dir: 1 | -1) => {
    const next = dir === 1
      ? BET_STEPS.find(s => s > bet + 1e-9)
      : [...BET_STEPS].reverse().find(s => s < bet - 1e-9);
    if (next != null) setBetStr(next.toFixed(2));
  };

  const stepAuto = (dir: 1 | -1) => {
    const i = AUTO_STEPS.indexOf(autoRounds);
    const cur = i === -1 ? 1 : i;
    const next = Math.max(0, Math.min(AUTO_STEPS.length - 1, cur + dir));
    setAutoRounds(AUTO_STEPS[next]);
  };

  return (
    <div className="bgc">
      <div className="bgc-main">
        <div className="bgc-block">
          <span className="bgc-block-label">Risk Level</span>
          <div className="bgc-card bgc-risk">
            {RISKS.map(r => (
              <button
                key={r.v}
                className={`bgc-opt${risk === r.v ? ' active-mode' : ''}`}
                onClick={() => setRisk(r.v)}
                disabled={locked}
              >
                <span className="bgc-ico">{r.ico}</span>
                {r.l}
              </button>
            ))}
          </div>
        </div>

        {autoRunning ? (
          <button className="play-btn stop" onClick={onStopAuto}>
            <span className="play-btn-label">STOP</span>
            <span className="play-btn-count">{remaining}</span>
          </button>
        ) : (
          <button className="play-btn" onClick={onPlay} disabled={bet <= 0 || bet > balance || ballsInFlight > 0}>
            <svg className="play-btn-arc" viewBox="0 0 60 20" width="52" height="17" fill="none">
              <path d="M4 16 Q 14 2 26 14 Q 38 26 52 5" stroke="#E9A53C" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.1 6.5" />
              <circle cx="53" cy="4.4" r="3.6" fill="#E9375B" />
            </svg>
            <span className="play-btn-label">PLAY</span>
          </button>
        )}

        <div className="bgc-block">
          <span className="bgc-block-label">Bet Mode</span>
          <div className="bgc-card bgc-mode">
            <button
              className={`bgc-opt${mode === 'manual' ? ' active-mode' : ''}`}
              onClick={() => setMode('manual')}
              disabled={locked}
            >
              <span className="bgc-ico"><b style={{ color: '#7C5CD6' }}>M</b></span>
              Manual
            </button>
            <button
              className={`bgc-opt${mode === 'auto' ? ' active-mode' : ''}`}
              onClick={() => setMode('auto')}
              disabled={locked}
            >
              <span className="bgc-ico"><b style={{ color: '#E9375B' }}>A</b></span>
              Auto
            </button>
            {mode === 'auto' && (
              <div className="bgc-nob">
                <span className="bgc-nob-label">Number of bets</span>
                <div className="bgc-nob-row">
                  <button className="bgc-nob-btn" disabled={autoRunning || autoRounds === AUTO_STEPS[0]} onClick={() => stepAuto(-1)}>−</button>
                  <span className="bgc-nob-val">{autoRounds === '0' ? '∞' : autoRounds}</span>
                  <button className="bgc-nob-btn" disabled={autoRunning || autoRounds === AUTO_STEPS[AUTO_STEPS.length - 1]} onClick={() => stepAuto(1)}>+</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bgc-bet-row">
        <div className="bgc-bet-side">
          <button className="bgc-pill" disabled={locked || bet <= MIN_BET} onClick={() => setBetStr(MIN_BET.toFixed(2))}>Min</button>
          <button className="bgc-pill" disabled={locked || bet <= MIN_BET} onClick={() => stepBet(-1)}>−</button>
        </div>
        <div className="bgc-bet-display">
          <span>Bet</span>
          <b>{fmt(bet)}</b>
        </div>
        <div className="bgc-bet-side">
          <button className="bgc-pill" disabled={locked || bet >= MAX_BET} onClick={() => stepBet(1)}>+</button>
          <button className="bgc-pill" disabled={locked || bet >= MAX_BET} onClick={() => setBetStr(MAX_BET.toFixed(2))}>Max</button>
        </div>
      </div>

      <div className="bgc-balance">Balance <b>{fmt(balance)}</b></div>
    </div>
  );
}
