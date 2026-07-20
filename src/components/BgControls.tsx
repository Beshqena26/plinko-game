import { useEffect, useRef, useState } from 'react';
import type { RiskLevel } from '../utils/multipliers';
import type { GameSpeed, FreeGrant } from '../hooks/usePlinkoGame';
import { fmt } from '../utils/format';
import { sound } from '../utils/sound';

import { MIN_BET, MAX_BET, BET_STEPS } from '../game/betting';
export { MIN_BET, MAX_BET };

// Number-of-bets ladder for auto mode ('0' renders as ∞).
const AUTO_STEPS = ['5', '10', '25', '50', '100', '0'];

export type BetMode = 'manual' | 'auto';

interface Props {
  balance: number;
  speed: GameSpeed;
  setSpeed: (v: GameSpeed) => void;
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
  // Returns whether a round actually started — false stops the pour
  onPlay: (roundsOverride?: string) => boolean | Promise<boolean>;
  onStopAuto: () => void;
  freeGrant: FreeGrant | null;
  freeEnding: boolean;
}

const FlameSVG = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="#F43F5E"><path d="M20.6005 11.7C20.2005 10.4 19.4005 9.2 18.5005 8.2C18.4005 8.1 18.4005 8.1 18.3005 8C17.8005 7.7 17.2005 7.9 16.9005 8.4C16.9005 8.4 16.9005 8.4 16.9005 8.5C16.6005 9.2 16.1005 9.8 15.5005 10.3C15.6005 9.8 15.6005 9.3 15.6005 8.8C15.6005 5.7 13.9005 2.8 11.2005 1.2C10.6005 0.9 10.0005 1 9.80047 1.5C9.70047 1.6 9.60047 1.8 9.60047 1.9C9.50047 3.8 8.60047 5.6 7.10047 6.8L6.90047 7.1C6.10047 7.6 5.50047 8.2 4.90047 9C1.80047 12.9 2.50047 18.5 6.40047 21.6C7.10047 22.1 7.80047 22.6 8.60047 22.9C9.10047 23.1 9.70047 22.9 9.90047 22.4C9.90047 22.3 10.0005 22.2 10.0005 22C10.0005 21.9 10.0005 21.8 10.0005 21.7C9.80047 20.9 9.70047 20 9.80047 19.1C10.7005 20.9 12.3005 22.3 14.1005 23.1C14.3005 23.2 14.6005 23.2 14.8005 23.1C19.5005 21.5 22.1005 16.5 20.6005 11.7Z"/></svg>
);
const DiceSVG = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="#FFD106"><path d="M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2ZM9 10C8.4 10 8 9.6 8 9C8 8.4 8.4 8 9 8C9.6 8 10 8.4 10 9C10 9.6 9.6 10 9 10ZM12 17C10.7 16.9 9.7 15.8 9.8 14.5C9.7 13.2 10.7 12.1 12 12C13.3 12.1 14.3 13.2 14.2 14.5C14.3 15.8 13.3 16.9 12 17ZM15 10C14.4 10 14 9.6 14 9C14 8.4 14.4 8 15 8C15.6 8 16 8.4 16 9C16 9.6 15.6 10 15 10Z"/></svg>
);
const ThumbSVG = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="#22C55E"><path d="M21.3 10.1C20.7 9.4 19.9 9 19 9H14.4L15 7.6C15.8 5.5 14.7 3.1 12.6 2.3C12.1 2.1 11.6 2 11.1 2C10.7 2 10.3 2.2 10.2 2.6L7.3 9H5C3.3 9 2 10.3 2 12V19C2 20.7 3.3 22 5 22H17.7C19.2 22 20.4 21 20.7 19.5L22 12.5C22.1 11.7 21.9 10.8 21.3 10.1ZM7 20H5C4.4 20 4 19.6 4 19V12C4 11.4 4.4 11 5 11H7V20Z"/></svg>
);

const GiftSVG = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);

const BoltSVG = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l1-8z"/></svg>
);

const RISKS: { v: RiskLevel; l: string; ico: React.ReactNode }[] = [
  { v: 'high', l: 'High', ico: <FlameSVG /> },
  { v: 'medium', l: 'Normal', ico: <DiceSVG /> },
  { v: 'low', l: 'Low', ico: <ThumbSVG /> },
];

// BGaming Plinko control cluster (1:1 with the demo close-up):
// labels above purple cards · white icon squares · big glossy PLAY orb with
// the dotted bounce arc · Number-of-bets stepper appears in Auto mode.
export default function BgControls({
  balance, betStr, setBetStr, risk, setRisk, mode, setMode,
  autoRounds, setAutoRounds,
  autoRunning, ballsInFlight, autoPlayed, totalAutoRounds,
  onPlay, onStopAuto, speed, setSpeed, freeGrant, freeEnding,
}: Props) {
  // No cap on simultaneous balls — PLAY can be spammed freely. Risk/lines/
  // mode still lock while any ball is in flight (the board must not change
  // under live balls).
  const locked = autoRunning || ballsInFlight > 0;
  const betLocked = autoRunning; // bet edits are safe mid-flight (per-ball snapshot)
  const bet = Math.max(0, parseFloat(betStr) || 0);
  const remaining = totalAutoRounds === '∞' ? '∞' : String(Math.max(0, parseInt(totalAutoRounds) - autoPlayed));
  // Max bets the full balance (floored to cents, capped at the table max) —
  // with $13.44 in the wallet, Max bets exactly $13.44. The + stepper still
  // walks the ladder but never past this.
  const affordableMax = Math.max(MIN_BET, Math.min(MAX_BET, Math.round(balance * 100) / 100));

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (autoRunning) onStopAuto(); else void onPlay();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [autoRunning, onPlay, onStopAuto]);

  const stepBet = (dir: 1 | -1) => {
    const next = dir === 1
      ? BET_STEPS.find(s => s > bet + 1e-9 && s <= affordableMax)
      : [...BET_STEPS].reverse().find(s => s < bet - 1e-9);
    if (next != null) { sound.uiClick(); setBetStr(next.toFixed(2)); }
  };

  // Hover blip for any enabled control (no-op on touch devices)
  const hover = (enabled: boolean) => () => { if (enabled) sound.uiHover(); };

  // Number-of-bets picker: opens under Auto when selected; clicking Auto
  // again toggles it.
  const [nobOpen, setNobOpen] = useState(true);

  const stepAuto = (dir: 1 | -1) => {
    const i = AUTO_STEPS.indexOf(autoRounds);
    const cur = i === -1 ? 1 : i;
    const next = Math.max(0, Math.min(AUTO_STEPS.length - 1, cur + dir));
    if (AUTO_STEPS[next] !== autoRounds) sound.uiClick();
    setAutoRounds(AUTO_STEPS[next]);
  };


  // Hold-to-pour: keep PLAY pressed (manual mode) and balls pour continuously
  // until release. A quick tap still drops exactly one ball — the pour only
  // starts after a short hold threshold, and the synthetic click that fires
  // on release is suppressed once pouring has begun.
  const POUR_HOLD_MS = 250;
  const POUR_EVERY_MS = 130;
  const pourTimer = useRef<number | null>(null);
  const pourInterval = useRef<number | null>(null);
  const suppressClick = useRef(false);
  // True while the pour is actually firing — drives the orb's fire effect
  const [pouring, setPouring] = useState(false);
  const stopPour = () => {
    if (pourTimer.current != null) { clearTimeout(pourTimer.current); pourTimer.current = null; }
    if (pourInterval.current != null) { clearInterval(pourInterval.current); pourInterval.current = null; }
    setPouring(false);
  };
  useEffect(() => stopPour, []);
  // A disabled button swallows pointerup/pointerleave, so the pour can't rely
  // on release events alone — it also stops the moment a drop is refused
  // (free rounds exhausted, insufficient balance) or the grant enters its
  // ending state mid-hold.
  useEffect(() => { if (freeEnding) stopPour(); }, [freeEnding]);
  const pourTick = () => {
    void Promise.resolve(onPlay()).then(ok => { if (ok === false) stopPour(); });
  };
  const onPlayPointerDown = () => {
    if (mode !== 'manual' || autoRunning) return;
    suppressClick.current = false;
    pourTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      setPouring(true);
      pourTick();
      pourInterval.current = window.setInterval(pourTick, POUR_EVERY_MS);
    }, POUR_HOLD_MS);
  };
  const onPlayClick = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    void onPlay();
  };

  // Single cycling speed control: each click advances slow → normal → instant →
  // slow. The three bolts show the current level (1 lit = slow, 2 = normal,
  // 3 = instant) so the state reads at a glance without three separate chips.
  const SPEED_ORDER: GameSpeed[] = ['slow', 'normal', 'instant'];
  const speedLevel = SPEED_ORDER.indexOf(speed) + 1;
  const cycleSpeed = () => {
    sound.uiClick();
    setSpeed(SPEED_ORDER[SPEED_ORDER.indexOf(speed) + 1] ?? SPEED_ORDER[0]);
  };
  // Oval pill under the PLAY orb (reference: slot turbo button) — 3 bolts,
  // lit count = current speed; tap to cycle.
  const speedButton = (
    <button
      className="bgc-speed-pill"
      onMouseEnter={hover(true)}
      onClick={cycleSpeed}
      title={`Speed: ${speed === 'slow' ? 'Slow' : speed === 'normal' ? 'Normal' : 'Instant'}`}
      aria-label={`Speed: ${speed} — click to change`}
    >
      {[1, 2, 3].map(n => (
        <span key={n} className={`bgc-speed-bolt${speedLevel >= n ? ' lit' : ''}`}><BoltSVG /></span>
      ))}
    </button>
  );

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
                onMouseEnter={hover(!locked)}
                onClick={() => { if (risk !== r.v) sound.uiClick(); setRisk(r.v); }}
                disabled={locked}
              >
                <span className="bgc-ico">{r.ico}</span>
                {r.l}
              </button>
            ))}
          </div>
        </div>

        <div className="play-wrap">
        {/* Fire layer sits BEHIND the orb (earlier sibling, lower z-index):
            the button face stays clean, only the flame beyond the rim shows */}
        <span className={`play-fire${pouring ? ' on' : ''}`} aria-hidden="true">
          <span className="play-flame-big" />
          <span className="play-ember e1" /><span className="play-ember e2" /><span className="play-ember e3" /><span className="play-ember e4" />
        </span>
        {autoRunning ? (
          <button className="play-btn stop" onClick={onStopAuto}>
            <span className="play-btn-label">STOP</span>
            <span className="play-btn-count">{remaining}</span>
          </button>
        ) : (
          <button
            className={`play-btn${freeGrant ? ' free-mode' : ''}${pouring ? ' on-fire' : ''}`}
            onClick={onPlayClick}
            onPointerDown={onPlayPointerDown}
            onPointerUp={stopPour}
            onPointerLeave={stopPour}
            onPointerCancel={stopPour}
            disabled={freeGrant ? freeEnding : balance < MIN_BET}
          >
            <svg className="play-btn-arc" viewBox="0 0 60 20" width="52" height="17" fill="none">
              <path d="M4 16 Q 14 2 26 14 Q 38 26 52 5" stroke="#E9A53C" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.1 6.5" />
              <circle cx="53" cy="4.4" r="3.6" fill="#E9375B" />
            </svg>
            <span className="play-btn-label">{freeGrant ? 'FREE' : 'PLAY'}</span>
            {freeGrant
              ? <span className="play-btn-count">{Math.max(0, freeGrant.roundsTotal - freeGrant.roundsUsed)} left</span>
              : mode === 'auto' ? (
                <span className="play-btn-count">×{autoRounds === '0' ? '∞' : autoRounds}</span>
              ) : (
                /* Manual: hold-to-rapid-fire hint — machine-gun + HOLD */
                <span className="play-btn-hold">
                  <svg viewBox="0 0 27 12" width="20" height="9" fill="currentColor">
                    {/* body + grip */}
                    <path d="M2 3.5h13v3.2h-5.6l-1.6 4h-3l1.3-4H2z" />
                    {/* barrel */}
                    <rect x="15" y="4.1" width="5.4" height="1.9" rx="0.6" />
                    {/* muzzle flash */}
                    <path d="M21.2 5 l2.6-2.4 -1.2 2.4 1.2 2.4z" opacity="0.9" />
                    <path d="M23.6 5 l3-1 -1.8 1 1.8 1 -3-1z" opacity="0.55" />
                  </svg>
                  HOLD
                </span>
              )}
          </button>
        )}
        {speedButton}
        </div>

        <div className="bgc-block bgc-block-mode">
          <span className="bgc-block-label">Bet Mode</span>
          <div className={`bgc-card bgc-mode${mode === 'auto' && nobOpen ? ' nob-open' : ''}`}>
            <button
              className={`bgc-opt${mode === 'manual' ? ' active-mode' : ''}`}
              onMouseEnter={hover(!locked)}
              onClick={() => { if (mode !== 'manual') sound.uiClick(); setMode('manual'); }}
              disabled={locked}
            >
              <span className="bgc-ico"><b style={{ color: '#A78BFA' }}>M</b></span>
              Manual
            </button>
            <button
              className={`bgc-opt${mode === 'auto' ? ' active-mode' : ''}`}
              onMouseEnter={hover(!locked)}
              onClick={() => {
                sound.uiClick();
                if (mode !== 'auto') { setMode('auto'); setNobOpen(true); }
                else setNobOpen(o => !o);   // already Auto → toggle the dropdown
              }}
              disabled={locked}
            >
              <span className="bgc-ico"><b style={{ color: '#F43F5E' }}>A</b></span>
              Auto
            </button>
            {/* Auto only: number-of-bets floats BELOW the card (absolute, out
                of flow) — the card hugs its content in Manual and the cluster
                height never changes, so mode switching cannot move the board */}
            {mode === 'auto' && nobOpen && (
              <div className="bgc-nob bgc-nob-float">
                <span className="bgc-nob-label">Number of bets</span>
                <div className="bgc-nob-row">
                  <button className="bgc-nob-btn" disabled={autoRunning || autoRounds === AUTO_STEPS[0]} onMouseEnter={hover(!autoRunning && autoRounds !== AUTO_STEPS[0])} onClick={() => stepAuto(-1)}>−</button>
                  <span className="bgc-nob-val">{autoRounds === '0' ? '∞' : autoRounds}</span>
                  <button className="bgc-nob-btn" disabled={autoRunning || autoRounds === AUTO_STEPS[AUTO_STEPS.length - 1]} onMouseEnter={hover(!autoRunning && autoRounds !== AUTO_STEPS[AUTO_STEPS.length - 1])} onClick={() => stepAuto(1)}>+</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Free slot is a single 30px line — exactly the bet row's height, so
          the swap back to the bet row when the grant ends cannot move the layout */}
      {freeGrant ? (
        <div className="free-round-slot">
          <span className="free-round-ico"><GiftSVG /></span>
          <span className="frs-label">Free Round</span>
          <span className="frs-count">{Math.min(freeGrant.roundsUsed, freeGrant.roundsTotal)}/{freeGrant.roundsTotal}</span>
          <span className="frs-bet">Bet {fmt(freeGrant.betAmount)}</span>
          <span className="frs-tw">Total Win <b>+{fmt(freeGrant.winnings)}</b></span>
        </div>
      ) : (
      <div className="bgc-bet-row">
        <div className="bgc-bet-side">
          <button className="bgc-pill" disabled={betLocked || bet <= MIN_BET} onMouseEnter={hover(!betLocked && bet > MIN_BET)} onClick={() => { sound.uiClick(); setBetStr(MIN_BET.toFixed(2)); }}>Min</button>
          <button className="bgc-pill" disabled={betLocked || bet <= MIN_BET} onMouseEnter={hover(!betLocked && bet > MIN_BET)} onClick={() => stepBet(-1)}>−</button>
        </div>
        <div className="bgc-bet-display">
          <span>Bet</span>
          <b>{fmt(bet)}</b>
        </div>
        <div className="bgc-bet-side">
          <button className="bgc-pill" disabled={betLocked || bet >= affordableMax} onMouseEnter={hover(!betLocked && bet < affordableMax)} onClick={() => stepBet(1)}>+</button>
          <button className="bgc-pill" disabled={betLocked || Math.abs(bet - affordableMax) < 1e-9} onMouseEnter={hover(!betLocked && Math.abs(bet - affordableMax) >= 1e-9)} onClick={() => { sound.uiClick(); setBetStr(affordableMax.toFixed(2)); }}>Max</button>
        </div>
      </div>
      )}

      <div className="bgc-balance">Balance <b>{fmt(balance)}</b></div>
    </div>
  );
}
