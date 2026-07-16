import { useState, useEffect } from 'react';
import PlinkoBoard from './components/PlinkoBoard';
import BgControls from './components/BgControls';
import type { BetMode } from './components/BgControls';
import { InfoDrawer, PfDrawer, HistoryDrawer } from './components/Drawers';
import type { RiskLevel } from './utils/multipliers';
import { getMultipliers } from './utils/multipliers';
import { usePlinkoGame } from './hooks/usePlinkoGame';
import { fmt } from './utils/format';
import { sound } from './utils/sound';

export type { BetResult, AutoSummary, QueuedBall } from './hooks/usePlinkoGame';
export { fmt };

const PlinkoIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="ico">
    <circle cx="12" cy="4" r="2.2" fill="currentColor" />
    <circle cx="8" cy="11" r="1.4" fill="currentColor" opacity="0.65" />
    <circle cx="16" cy="11" r="1.4" fill="currentColor" opacity="0.65" />
    <circle cx="4.5" cy="18" r="1.4" fill="currentColor" opacity="0.4" />
    <circle cx="12" cy="18" r="1.4" fill="currentColor" opacity="0.4" />
    <circle cx="19.5" cy="18" r="1.4" fill="currentColor" opacity="0.4" />
  </svg>
);

const ClockSVG = () => (
  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const ShieldSVG = () => (
  <svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2"/></svg>
);
const SoundSVG = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />{on && <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />}</svg>
);
const InfoSVG = () => (
  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="11" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>
);
const BoltHdrSVG = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l1-8z"/></svg>
);

export default function App() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState(16);
  const [risk, setRisk] = useState<RiskLevel>('high');
  const [soundOn, setSoundOn] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pfOpen, setPfOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [mode, setMode] = useState<BetMode>('manual');

  const game = usePlinkoGame(rows, risk);

  // BGaming behavior: in Auto mode PLAY runs "Number of bets" rounds
  // (∞ when set to 0); the STOP orb ends the run early.
  const onPlay = () => {
    if (mode === 'auto') game.startAuto(game.autoRounds);
    else void game.drop();
  };

  useEffect(() => {
    const tm = setTimeout(() => setLoading(false), 2200);
    return () => clearTimeout(tm);
  }, []);

  const mults = getMultipliers(risk, rows);
  const handleSoundToggle = () => setSoundOn(sound.toggle());

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-content">
        <PlinkoIcon size={44} />
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', margin: '12px 0 4px', letterSpacing: 1 }}>Plinko</h1>
        <div className="loading-bar-wrap"><div className="loading-bar" /></div>
        <p className="loading-text">Loading game…</p>
      </div>
    </div>
  );

  return (
    <>
      <div className={`app bg-scene${game.autoRunning ? ' auto-running' : ''}`}>
        {/* Floating top layer — BGaming has no header bar */}
        <div className="fx-top">
          <div className="fx-title">
            <PlinkoIcon size={22} />
            <span>PLINKO</span>
          </div>
          <div className="fx-actions">
            <button className="fx-btn" onClick={() => setHistOpen(true)} title="History"><ClockSVG /></button>
            <button className="fx-btn" onClick={() => setPfOpen(true)} title="Fair Play"><ShieldSVG /></button>
            <button className={`fx-btn${game.instant ? ' fx-on' : ''}`} onClick={() => game.setInstant(v => !v)} title="Instant Bet"><BoltHdrSVG /></button>
            <button className="fx-btn" onClick={handleSoundToggle} title="Sound"><SoundSVG on={soundOn} /></button>
            <button className="fx-btn" onClick={() => setInfoOpen(true)} title="How to Play"><InfoSVG /></button>
          </div>
        </div>

        <div className="row">
          <main className="main">
            {/* Desktop bet history table (BGaming, left of the board) */}
            <div className="fx-hist">
              <div className="fx-hist-head">
                <span>Time</span><span>Bet</span><span>Payout</span><span>Profit</span>
              </div>
              {game.history.slice(0, 8).map(h => (
                <button key={h.id} className="fx-hist-row" onClick={() => setHistOpen(true)}>
                  <span>{new Date(h.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{h.bet.toFixed(2)}</span>
                  <span>{h.pay.toFixed(2)}</span>
                  <span style={{ color: h.profit >= 0 ? '#46E144' : '#FF7B93' }}>
                    {h.profit >= 0 ? '+' : ''}{h.profit.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>

            <div className="game-area">
              <PlinkoBoard rows={rows} multipliers={mults} bet={game.bet} onBallLand={game.onLand}
                ballQueue={game.ballQueue} onBallConsumed={game.onConsumed} paths={game.paths} />

              {/* Lines rail: rows selector on the board edge */}
              <div className={`lines-rail${game.ballsInFlight > 0 || game.autoRunning ? ' locked' : ''}`}>
                <span className="lines-rail-label">Lines</span>
                {[8, 9, 10, 11, 12, 13, 14, 15, 16].map(n => (
                  <button
                    key={n}
                    className={`lines-rail-btn${rows === n ? ' active' : ''}`}
                    onClick={() => setRows(n)}
                    disabled={game.ballsInFlight > 0 || game.autoRunning}
                  >{n}</button>
                ))}
              </div>
            </div>

            {/* BGaming control cluster — identical desktop & mobile */}
            <BgControls
              balance={game.balance}
              betStr={game.betStr}
              setBetStr={game.setBetStr}
              risk={risk}
              setRisk={setRisk}
              mode={mode}
              setMode={setMode}
              autoRounds={game.autoRounds}
              setAutoRounds={game.setAutoRounds}
              autoRunning={game.autoRunning}
              ballsInFlight={game.ballsInFlight}
              autoPlayed={game.autoPlayed}
              autoProfit={game.autoProfit}
              totalAutoRounds={game.autoRounds === '0' ? '∞' : game.autoRounds}
              onPlay={onPlay}
              onStopAuto={game.stopAuto}
            />
          </main>
        </div>
      </div>

      <InfoDrawer open={infoOpen} onClose={() => setInfoOpen(false)} risk={risk} rows={rows} />
      <PfDrawer
        open={pfOpen} onClose={() => setPfOpen(false)}
        serverSeed={game.serverSeed} clientSeed={game.clientSeed}
        setClientSeed={game.setClientSeed} onRotate={game.rotateSeed}
      />
      <HistoryDrawer open={histOpen} onClose={() => setHistOpen(false)} rounds={game.history} />

      {game.autoSummary && (
        <div className="modal-overlay show" onClick={() => game.setAutoSummary(null)}>
          <div className="modal free-bet-summary" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => game.setAutoSummary(null)}>&times;</button>
            <div className={`fbs-icon ${game.autoSummary.profit >= 0 ? 'fbs-icon-win' : 'fbs-icon-lose'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            </div>
            <h2>Auto Play Complete</h2>
            <div className="fbs-stats fbs-stats-3">
              <div className="fbs-stat"><span className="fbs-stat-label">Rounds</span><span className="fbs-stat-val">{game.autoSummary.rounds}</span></div>
              <div className="fbs-stat"><span className="fbs-stat-label">Wins</span><span className="fbs-stat-val" style={{ color: 'var(--green)' }}>{game.autoSummary.wins}</span></div>
              <div className="fbs-stat"><span className="fbs-stat-label">Losses</span><span className="fbs-stat-val" style={{ color: 'var(--red)' }}>{game.autoSummary.losses}</span></div>
            </div>
            <div className={`fbs-winnings ${game.autoSummary.profit >= 0 ? 'fbs-win' : 'fbs-lose'}`}>
              <span className="fbs-winnings-label">Net Profit</span>
              <span className="fbs-winnings-val" style={{ color: game.autoSummary.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {game.autoSummary.profit >= 0 ? '+' : ''}{fmt(game.autoSummary.profit)}
              </span>
            </div>
            <button className="fbs-btn" onClick={() => game.setAutoSummary(null)}>Continue Playing</button>
          </div>
        </div>
      )}
    </>
  );
}
