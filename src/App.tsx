import { useState, useEffect, useRef } from 'react';
import { useUiScale } from './hooks/useUiScale';
import PlinkoBoard from './components/PlinkoBoard';
import BgControls from './components/BgControls';
import type { BetMode } from './components/BgControls';
import { InfoDrawer, PfDrawer, HistoryDrawer } from './components/Drawers';
import type { RiskLevel } from './utils/multipliers';
import { getMultipliers } from './utils/multipliers';
import { usePlinkoGame } from './hooks/usePlinkoGame';
import { fmt } from './utils/format';
import { sound } from './utils/sound';

import type { BetResult, SessionStats } from './hooks/usePlinkoGame';

export type { BetResult, AutoSummary, QueuedBall } from './hooks/usePlinkoGame';
export { fmt };

/* Session totals (rounds / total bet / net profit) — desktop table footer,
   history drawer header, and the mobile swipe-in panel all share this. */
export function SessionStatsBlock({ session }: { session: SessionStats }) {
  return (
    <div className="fx-stats">
      <div className="fx-stats-title">Session</div>
      <div className="fx-stats-cells">
        <div className="fx-stats-cell"><span>Rounds</span><b>{session.rounds}</b></div>
        <div className="fx-stats-cell"><span>Total Bet</span><b>{fmt(session.wagered)}</b></div>
        <div className="fx-stats-cell">
          <span>Net Profit</span>
          <b style={{ color: session.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {session.profit < 0 ? '-' : '+'}{fmt(Math.abs(session.profit))}
          </b>
        </div>
      </div>
    </div>
  );
}

/* Bet history table (Time/Bet/Payout/Profit) — desktop left column and the
   mobile swipe-in panel render the same rows. */
function HistRows({ history, onRowClick }: { history: BetResult[]; onRowClick: () => void }) {
  return (
    <>
      <div className="fx-hist-head">
        <span>Time</span><span>Bet</span><span>Payout</span><span>Profit</span>
      </div>
      {history.slice(0, 8).map(h => (
        <button key={h.id} className="fx-hist-row" onClick={onRowClick}>
          <span>{new Date(h.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
          <span>{h.bet.toFixed(2)}</span>
          <span>{h.pay.toFixed(2)}</span>
          <span style={{ color: h.profit >= 0 ? '#46E144' : '#FF7B93' }}>
            {h.profit >= 0 ? '+' : ''}{h.profit.toFixed(2)}
          </span>
        </button>
      ))}
    </>
  );
}

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
const MusicSVG = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    {!on && <line x1="3" y1="3" x2="21" y2="21" />}
  </svg>
);
const SoundSVG = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />{on && <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />}</svg>
);
const InfoSVG = () => (
  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="11" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>
);

// Scales its child as one rigid unit (BGaming stage behavior): the child is
// laid out at full design size, then transform-scaled; the wrapper's height
// shrinks to match so the board above gets the reclaimed space.
function ScaleBox({ scale, children }: { scale: number; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [naturalH, setNaturalH] = useState(0);
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setNaturalH(el.offsetHeight);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    // re-measure on the frame after a scale change settles — mid-resize the
    // observer can capture a transient layout height and never fire again
    const raf = requestAnimationFrame(measure);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [scale]);
  if (scale >= 1) return <>{children}</>;
  return (
    <div style={{ height: naturalH ? naturalH * scale : undefined, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'visible' }}>
      <div ref={innerRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: `${100 / scale}%`, flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState(16);
  const [risk, setRisk] = useState<RiskLevel>('high');
  const [soundOn, setSoundOn] = useState(() => sound.isEnabled());
  const [musicOn, setMusicOn] = useState(() => sound.isMusicEnabled());
  const [audioOpen, setAudioOpen] = useState(false);
  const [musicVol, setMusicVol] = useState(() => Math.round(sound.getMusicVolume() * 100));
  const [sfxVol, setSfxVol] = useState(() => Math.round(sound.getVolume() * 100));
  const [infoOpen, setInfoOpen] = useState(false);
  const [pfOpen, setPfOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [mode, setMode] = useState<BetMode>('manual');
  const [winBanner, setWinBanner] = useState<{ id: number; pay: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [faved, setFaved] = useState(() => localStorage.getItem('fav_plinko') === 'true');
  const [statsOpen, setStatsOpen] = useState(false);

  const game = usePlinkoGame(rows, risk);
  // Below 360×640 the control cluster scales uniformly instead of reflowing
  const uiScale = useUiScale(360, 640);

  // BGaming shows a "Win X" banner top-center on every winning landing.
  const lastRound = game.history[0];
  useEffect(() => {
    if (!lastRound || lastRound.pay <= 0) return;
    setWinBanner({ id: lastRound.id, pay: lastRound.pay });
    const tm = setTimeout(() => setWinBanner(null), 1800);
    return () => clearTimeout(tm);
  }, [lastRound?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // System alerts (insufficient balance etc.) auto-dismiss after 2.4s
  useEffect(() => {
    if (!game.alert) return;
    const tm = setTimeout(() => game.setAlert(null), 2400);
    return () => clearTimeout(tm);
  }, [game.alert?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // BGaming behavior: in Auto mode PLAY runs "Number of bets" rounds
  // (∞ when set to 0); the STOP orb ends the run early.
  const onPlay = () => {
    if (mode === 'auto') game.startAuto(game.autoRounds);
    else void game.drop();
  };

  useEffect(() => {
    const tm = setTimeout(() => setLoading(false), 2200);
    sound.armMusicAutostart();
    return () => clearTimeout(tm);
  }, []);

  // close the header dots menu / audio panel on any outside click
  useEffect(() => {
    if (!menuOpen && !audioOpen) return;
    const close = () => { setMenuOpen(false); setAudioOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen, audioOpen]);

  const mults = getMultipliers(risk, rows);
  const handleSoundToggle = () => setSoundOn(sound.toggle());
  const handleMusicToggle = () => setMusicOn(sound.toggleMusic());

  // Mobile board pager (BGaming behavior): the play field is a 2-page
  // horizontal carousel — the finger drags the field itself, it follows the
  // touch and snaps to the board page or the stats page. Header and betting
  // controls stay fixed; page dots indicate position.
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; horiz: boolean | null } | null>(null);
  const pagerActive = () => window.innerWidth <= 1000;
  const onPagerTouchStart = (e: React.TouchEvent) => {
    if (!pagerActive() || infoOpen || pfOpen || histOpen || menuOpen) return;
    const t = e.touches[0];
    dragRef.current = { x: t.clientX, y: t.clientY, horiz: null };
  };
  const onPagerTouchMove = (e: React.TouchEvent) => {
    const d = dragRef.current;
    const track = trackRef.current;
    if (!d || !track) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (d.horiz === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) d.horiz = Math.abs(dx) > Math.abs(dy);
    if (!d.horiz) return;
    const w = track.parentElement!.clientWidth;
    // stats page is the LEFT page: open = 0%, game page = -50%
    const base = statsOpen ? 0 : -50;
    const pct = Math.max(-50, Math.min(0, base + (dx / w) * 50));
    track.style.transition = 'none';
    track.style.transform = `translateX(${pct}%)`;
  };
  const onPagerTouchEnd = (e: React.TouchEvent) => {
    const d = dragRef.current;
    const track = trackRef.current;
    dragRef.current = null;
    if (!d || !d.horiz || !track) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - d.x;
    const w = track.parentElement!.clientWidth;
    track.style.transition = '';
    if (Math.abs(dx) > w * 0.18) {
      setStatsOpen(dx > 0); // swipe right pulls the left stats page in
      track.style.transform = '';
    } else {
      // snap back to the current page
      track.style.transform = `translateX(${statsOpen ? 0 : -50}%)`;
    }
  };

  // Shared audio rows (desktop popover + mobile dots menu)
  const audioRows = (
    <>
      <div className="audio-row">
        <div className="audio-row-head">
          <span className="audio-label"><MusicSVG on={musicOn} /> Music</span>
          <button className={`audio-switch${musicOn ? ' on' : ''}`} onClick={handleMusicToggle} aria-label="Toggle music" />
        </div>
        <input
          className="audio-slider" type="range" min={0} max={100} value={musicVol} disabled={!musicOn}
          style={{ backgroundImage: `linear-gradient(to right, var(--accent) ${musicVol}%, #272859 ${musicVol}%)` }}
          onChange={(e) => { const v = +e.target.value; setMusicVol(v); sound.setMusicVolume(v / 100); }}
        />
      </div>
      <div className="audio-row">
        <div className="audio-row-head">
          <span className="audio-label"><SoundSVG on={soundOn} /> Sound</span>
          <button className={`audio-switch${soundOn ? ' on' : ''}`} onClick={handleSoundToggle} aria-label="Toggle sound effects" />
        </div>
        <input
          className="audio-slider" type="range" min={0} max={100} value={sfxVol} disabled={!soundOn}
          style={{ backgroundImage: `linear-gradient(to right, var(--accent) ${sfxVol}%, #272859 ${sfxVol}%)` }}
          onChange={(e) => { const v = +e.target.value; setSfxVol(v); sound.setVolume(v / 100); }}
        />
      </div>
    </>
  );

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
        {/* Ambient background: rising bokeh orbs + breathing glow + sparks */}
        <div className="bg-fx" aria-hidden="true">
          <div className="bg-glow" />
          {Array.from({ length: 8 }, (_, i) => <span key={`o${i}`} className={`bg-orb bg-orb-${i + 1}`} />)}
          {Array.from({ length: 10 }, (_, i) => <span key={`s${i}`} className={`bg-spark bg-spark-${i + 1}`} />)}
        </div>
        <div className="header">
          <div className="header-left">
            <div className="game-name">
              <PlinkoIcon size={20} />
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
            <div className="hdr-audio-wrap hdr-desktop">
              <button
                className={`hdr-btn${audioOpen ? ' hdr-on' : ''}`}
                onClick={(e) => { e.stopPropagation(); setAudioOpen(v => !v); }}
                title="Audio"
              ><SoundSVG on={soundOn || musicOn} /></button>
              {audioOpen && (
                <div className="audio-pop" onClick={(e) => e.stopPropagation()}>
                  {audioRows}
                </div>
              )}
            </div>
            <button className="hdr-btn hdr-desktop hdr-info" onClick={() => setInfoOpen(true)} title="How to Play">i</button>
            <button className="hdr-btn hdr-mobile" onClick={() => setHistOpen(true)} title="History"><ClockSVG /></button>
            <div className="hdr-dots-wrap hdr-mobile">
              <button className="hdr-btn hdr-dots" onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }} title="Menu">
                <svg viewBox="0 0 20 12" fill="none" width="16" height="10"><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="10" cy="6" r="1.5" fill="currentColor"/><circle cx="16" cy="6" r="1.5" fill="currentColor"/></svg>
              </button>
              {menuOpen && (
                <div className="dots-menu open" onClick={(e) => e.stopPropagation()}>
                  <div className="dots-menu-item" onClick={() => { setPfOpen(true); setMenuOpen(false); }}><ShieldSVG /> Fair Play</div>
                  <div className="dots-menu-item" onClick={() => { setInfoOpen(true); setMenuOpen(false); }}><InfoSVG /> How to Play</div>
                  <div className="dots-menu-audio">{audioRows}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {winBanner && (
          <div className="win-banner" key={winBanner.id}>Win {fmt(winBanner.pay)}</div>
        )}

        {game.alert && (
          <div className="alert-toast" key={game.alert.id}>
            <span className="alert-icon">⚠</span> {game.alert.msg}
          </div>
        )}

        <div className="row">
          <main className="main">
            {/* Whole-screen pager (BGaming mobile behavior): the LEFT page is
                the same history table desktop shows on its left side; the
                RIGHT page is the game (board + controls). The finger drags
                everything below the header; desktop is locked to the game
                page and shows the table as its usual overlay. */}
            <div
              ref={trackRef}
              className="ga-track"
              style={{ transform: `translateX(${statsOpen ? 0 : -50}%)` }}
              onTouchStart={onPagerTouchStart}
              onTouchMove={onPagerTouchMove}
              onTouchEnd={onPagerTouchEnd}
            >
              <div className="ga-page ga-page-stats">
                <div className="fx-hist">
                  <HistRows history={game.history} onRowClick={() => setHistOpen(true)} />
                  {game.history.length === 0 && <div className="mob-stats-empty">No rounds yet — drop a ball!</div>}
                  <SessionStatsBlock session={game.session} />
                </div>
              </div>

              <div className="ga-page ga-page-game">
                {/* Desktop bet history table (BGaming, left of the board) + session totals */}
                <div className="fx-hist fx-hist-desktop">
                  <HistRows history={game.history} onRowClick={() => setHistOpen(true)} />
                  <SessionStatsBlock session={game.session} />
                </div>

                <div className="game-area">
                  <PlinkoBoard rows={rows} multipliers={mults} bet={game.bet} onBallLand={game.onLand}
                    ballQueue={game.ballQueue} onBallConsumed={game.onConsumed} paths={game.paths} />

                  {/* Mobile: compact session totals pinned top-left of the board,
                      stacked vertically below the win-alert position */}
                  <div className="mob-session" aria-hidden="true">
                    <div><span>Rounds</span><b>{game.session.rounds}</b></div>
                    <div><span>Total Bet</span><b>{fmt(game.session.wagered)}</b></div>
                    <div>
                      <span>Profit</span>
                      <b style={{ color: game.session.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {game.session.profit < 0 ? '-' : '+'}{fmt(Math.abs(game.session.profit))}
                      </b>
                    </div>
                  </div>

                  {/* Lines rail: rows selector on the board edge */}
                  <div className={`lines-rail${game.ballsInFlight > 0 || game.autoRunning ? ' locked' : ''}`}>
                    <span className="lines-rail-label">Lines</span>
                    {[8, 9, 10, 11, 12, 13, 14, 15, 16].map(n => {
                      const disabled = game.ballsInFlight > 0 || game.autoRunning;
                      return (
                        <button
                          key={n}
                          className={`lines-rail-btn${rows === n ? ' active' : ''}`}
                          onMouseEnter={() => { if (!disabled) sound.uiHover(); }}
                          onClick={() => { if (rows !== n) sound.uiClick(); setRows(n); }}
                          disabled={disabled}
                        >{n}</button>
                      );
                    })}
                  </div>
                </div>

            {/* BGaming control cluster — identical desktop & mobile */}
            <ScaleBox scale={uiScale}>
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
              totalAutoRounds={game.autoRounds === '0' ? '∞' : game.autoRounds}
              onPlay={onPlay}
              onStopAuto={game.stopAuto}
              instant={game.instant}
              setInstant={(v: boolean) => game.setInstant(v)}
            />
            </ScaleBox>
              </div>
            </div>

            {/* Edge hint (mobile only) */}
            <button
              className={`mob-stats-hint${statsOpen ? ' right' : ''}`}
              onClick={() => setStatsOpen(v => !v)}
              aria-label={statsOpen ? 'Back to game' : 'Show session stats'}
            >
              {statsOpen
                ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 6 9 12 15 18" /></svg>
                : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>}
            </button>
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
      <HistoryDrawer open={histOpen} onClose={() => setHistOpen(false)} rounds={game.history} session={game.session} />

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
