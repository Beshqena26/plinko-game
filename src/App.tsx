import { useState, useEffect } from 'react';
import PlinkoBoard from './components/PlinkoBoard';
import SidePanel from './components/SidePanel';
import { InfoDrawer, PfDrawer, HistoryDrawer, AutoDrawer } from './components/Drawers';
import type { RiskLevel } from './utils/multipliers';
import { getMultipliers, getBucketColor } from './utils/multipliers';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pfOpen, setPfOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [faved, setFaved] = useState(() => localStorage.getItem('fav_plinko') === 'true');

  const game = usePlinkoGame(rows, risk);

  useEffect(() => {
    const tm = setTimeout(() => setLoading(false), 2200);
    return () => clearTimeout(tm);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const h = () => setMenuOpen(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [menuOpen]);

  const mults = getMultipliers(risk, rows);
  const handleSoundToggle = () => setSoundOn(sound.toggle());
  const totalAutoRounds = game.autoRounds === '0' ? '∞' : game.autoRounds;

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
      <div className={`app${game.autoRunning ? ' auto-running' : ''}`}>
        <div className="header">
          <div className="header-left">
            <div className="game-name">
              <PlinkoIcon />
              <span>Plinko</span>
            </div>
          </div>
          <div className="header-bal">
            <span className="header-bal-icon">$</span>
            <span className="header-bal-value">{game.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="header-right">
            <button className="hdr-btn hdr-desktop" onClick={() => setHistOpen(true)} title="History"><ClockSVG /></button>
            <button className="hdr-btn hdr-desktop" onClick={() => setPfOpen(true)} title="Fair Play"><ShieldSVG /></button>
            <button
              className="hdr-btn hdr-desktop" onClick={() => game.setInstant(v => !v)} title="Instant Bet"
              style={game.instant ? { color: 'var(--accent)', borderColor: 'var(--accent-border)', background: 'var(--accent-glow)' } : undefined}
            ><BoltHdrSVG /></button>
            <button className="hdr-btn hdr-desktop" onClick={handleSoundToggle} title="Sound"><SoundSVG on={soundOn} /></button>
            <button className="hdr-btn hdr-desktop hdr-info" onClick={() => setInfoOpen(true)} title="How to Play">i</button>
            <button className="hdr-btn hdr-mobile" onClick={() => setHistOpen(true)} title="History"><ClockSVG /></button>
            <button className="hdr-btn hdr-mobile hdr-dots" onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} title="Menu">
              <svg viewBox="0 0 20 12" fill="none" width="16" height="10"><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="10" cy="6" r="1.5" fill="currentColor"/><circle cx="16" cy="6" r="1.5" fill="currentColor"/></svg>
              {menuOpen && (
                <div className="dots-menu open" onClick={(e) => e.stopPropagation()}>
                  <div className="dots-menu-item" onClick={() => { setPfOpen(true); setMenuOpen(false); }}><ShieldSVG /> Fair Play</div>
                  <div className="dots-menu-item" onClick={() => { setInfoOpen(true); setMenuOpen(false); }}><InfoSVG /> How to Play</div>
                  <div className="dots-menu-item" onClick={() => { game.setInstant(v => !v); setMenuOpen(false); }}><BoltHdrSVG /> {game.instant ? 'Instant: On' : 'Instant: Off'}</div>
                  <div className="dots-menu-item" onClick={() => { handleSoundToggle(); setMenuOpen(false); }}><SoundSVG on={soundOn} /> {soundOn ? 'Sound: On' : 'Sound: Off'}</div>
                </div>
              )}
            </button>
          </div>
        </div>

        <div className="row">
          <aside className="side">
            <SidePanel
              balance={game.balance}
              betStr={game.betStr}
              setBetStr={game.setBetStr}
              rows={rows}
              setRows={setRows}
              risk={risk}
              setRisk={setRisk}
              autoRunning={game.autoRunning}
              ballsInFlight={game.ballsInFlight}
              autoPlayed={game.autoPlayed}
              autoProfit={game.autoProfit}
              totalAutoRounds={totalAutoRounds}
              onDrop={() => { void game.drop(); }}
              onStopAuto={game.stopAuto}
              onOpenAuto={() => setAutoOpen(true)}
            />
          </aside>

          <main className="main">
            {/* Recent results — Stake practice: chips colored by the landed
                bucket, newest first, click opens the round history. */}
            <div className="history-bar">
              {game.history.length === 0 ? (
                <span className="history-empty">No games yet</span>
              ) : game.history.slice(0, 8).map(h => {
                const color = getBucketColor(h.slot, h.dirs.length + 1);
                return (
                  <button
                    key={h.id}
                    className="history-chip"
                    style={{ background: `${color}1a`, color, border: `1px solid ${color}40`, cursor: 'pointer' }}
                    onClick={() => setHistOpen(true)}
                    title="Open history"
                  >
                    {h.mult.toFixed(2)}x
                  </button>
                );
              })}
            </div>

            <div className="game-area">
              <PlinkoBoard rows={rows} multipliers={mults} bet={game.bet} onBallLand={game.onLand}
                ballQueue={game.ballQueue} onBallConsumed={game.onConsumed} paths={game.paths} />
            </div>
          </main>
        </div>

        <div className="bottom">
          <div className="bottom-icons">
            <div className={`ic${faved ? ' faved' : ''}`} title="Favorite" onClick={() => { const next = !faved; setFaved(next); localStorage.setItem('fav_plinko', String(next)); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={faved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          </div>
          <div className="bottom-logo">MYBC</div>
        </div>
      </div>

      <InfoDrawer open={infoOpen} onClose={() => setInfoOpen(false)} risk={risk} rows={rows} />
      <PfDrawer
        open={pfOpen} onClose={() => setPfOpen(false)}
        serverSeed={game.serverSeed} clientSeed={game.clientSeed}
        setClientSeed={game.setClientSeed} onRotate={game.rotateSeed}
      />
      <HistoryDrawer open={histOpen} onClose={() => setHistOpen(false)} rounds={game.history} />
      <AutoDrawer
        open={autoOpen} onClose={() => setAutoOpen(false)}
        autoRounds={game.autoRounds} setAutoRounds={game.setAutoRounds}
        bet={game.bet} rows={rows} risk={risk}
        autoRunning={game.autoRunning} onStart={game.startAuto}
      />

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
