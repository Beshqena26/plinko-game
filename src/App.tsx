import { useState, useCallback, useRef, useEffect } from 'react';
import PlinkoBoard from './components/PlinkoBoard';
import SidePanel from './components/SidePanel';
import { InfoDrawer, PfDrawer, HistoryDrawer, AutoDrawer } from './components/Drawers';
import type { RiskLevel } from './utils/multipliers';
import { getMultipliers } from './utils/multipliers';
import { getPath, randomHex, sha256 } from './utils/provablyFair';
import { sound } from './utils/sound';

export interface BetResult {
  id: number; mult: number; profit: number; bet: number; pay: number; time: number; nonce: number;
  serverSeed: string; clientSeed: string; seedHash: string; dirs: number[]; slot: number;
}

export interface AutoSummary { rounds: number; wins: number; losses: number; profit: number }
export interface QueuedBall { id: number; instant: boolean }

// Demo max-profit cap (Stake clips wins to a per-currency cap, never rejects).
const MAX_PROFIT = 10000;

export const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BoltSVG = () => (
  <svg className="hist-chip-bolt" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l1-8z"/></svg>
);

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
  // Balance persists across refreshes; a wager settles into the ledger at drop
  // time, so reloading mid-flight loses only the animation, never the payout.
  const [balance, setBalance] = useState(() => {
    const v = parseFloat(localStorage.getItem('plinko_balance') || '');
    return v >= 0.1 ? v : 10000;
  });
  const [betStr, setBetStr] = useState('1.00');
  const [rows, setRows] = useState(16);
  const [risk, setRisk] = useState<RiskLevel>('high');
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoRounds, setAutoRounds] = useState('10'); // '0' = unlimited
  const [autoPlayed, setAutoPlayed] = useState(0);
  const [autoProfit, setAutoProfit] = useState(0);
  const [ballQueue, setBallQueue] = useState<QueuedBall[]>([]);
  const [instant, setInstant] = useState(() => localStorage.getItem('plinko_instant') === 'true');
  const [paths] = useState(() => new Map<number, number[]>());
  const [history, setHistory] = useState<BetResult[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pfOpen, setPfOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoSummary, setAutoSummary] = useState<AutoSummary | null>(null);
  const [faved, setFaved] = useState(() => localStorage.getItem('fav_plinko') === 'true');

  const idRef = useRef(0);
  const nonceRef = useRef(0);
  const [serverSeed, setServerSeed] = useState(() => randomHex(32));
  const [clientSeed, setClientSeed] = useState(() => 'plinko_' + randomHex(6));
  const seedRef = useRef({ s: serverSeed, c: clientSeed });
  seedRef.current = { s: serverSeed, c: clientSeed };
  const autoRef = useRef(false);
  const autoIds = useRef(new Set<number>());
  const autoStats = useRef<AutoSummary>({ rounds: 0, wins: 0, losses: 0, profit: 0 });
  const autoDoneRef = useRef(false);
  // Everything a round needs is snapshotted at drop time: the payout is decided
  // by the seed-derived slot (sum of rights), never by where physics happens to
  // land, and later settings changes can't touch an in-flight ball.
  const pending = useRef(new Map<number, {
    bet: number; nonce: number; dirs: number[]; slot: number; mult: number;
    serverSeed: string; clientSeed: string; seedHash: string;
  }>());
  const [ballsInFlight, setBallsInFlight] = useState(0);
  const ledgerRef = useRef(0); // settled balance, written at drop time
  const instantRef = useRef(instant);
  instantRef.current = instant;
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const betRef = useRef(1);
  betRef.current = Math.max(0, parseFloat(betStr) || 0);

  useEffect(() => {
    const tm = setTimeout(() => setLoading(false), 2200);
    return () => clearTimeout(tm);
  }, []);

  useEffect(() => { ledgerRef.current = balance; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { localStorage.setItem('plinko_instant', String(instant)); }, [instant]);

  useEffect(() => {
    if (!menuOpen) return;
    const h = () => setMenuOpen(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [menuOpen]);

  const mults = getMultipliers(risk, rows);

  const drop = useCallback(async (isAuto = false) => {
    const bet = betRef.current;
    if (balanceRef.current < bet || bet <= 0) return false;
    if (pending.current.size >= 20) return false; // physics sanity cap
    setBalance(p => p - bet);
    const id = ++idRef.current;
    const nonce = ++nonceRef.current;
    const { s, c } = seedRef.current;
    const dirs = await getPath(s, c, nonce, rows);
    const seedHash = await sha256(s);
    const slot = dirs.reduce((a, b) => a + b, 0);
    const mult = getMultipliers(risk, rows)[slot] ?? 0;
    paths.set(id, dirs);
    pending.current.set(id, { bet, nonce, dirs, slot, mult, serverSeed: s, clientSeed: c, seedHash });
    setBallsInFlight(pending.current.size);
    if (isAuto) autoIds.current.add(id);
    // Settle into the persisted ledger NOW — the animation only defers the
    // on-screen credit. Wins clip to the max-profit cap.
    const pay = Math.min(+(bet * mult).toFixed(2), bet + MAX_PROFIT);
    ledgerRef.current = +(ledgerRef.current - bet + pay).toFixed(2);
    localStorage.setItem('plinko_balance', String(ledgerRef.current));
    setBallQueue(p => [...p, { id, instant: instantRef.current }]);
    return true;
  }, [rows, risk, paths]);

  // Auto summary appears once the run has ended AND its last ball has landed.
  const maybeShowAutoSummary = useCallback(() => {
    if (autoDoneRef.current && autoIds.current.size === 0 && autoStats.current.rounds > 0) {
      autoDoneRef.current = false;
      setAutoSummary({ ...autoStats.current });
    }
  }, []);

  const onLand = useCallback((ballId: number) => {
    const entry = pending.current.get(ballId);
    if (!entry) return;
    pending.current.delete(ballId);
    setBallsInFlight(pending.current.size);
    const { bet, nonce, dirs, slot, mult, serverSeed: ss, clientSeed: cs, seedHash } = entry;
    const pay = Math.min(+(bet * mult).toFixed(2), bet + MAX_PROFIT);
    const profit = pay - bet;
    setBalance(p => p + pay);
    sound.land(mult);
    if (autoIds.current.has(ballId)) {
      autoIds.current.delete(ballId);
      const st = autoStats.current;
      st.rounds += 1;
      if (profit >= 0) st.wins += 1; else st.losses += 1;
      st.profit = +(st.profit + profit).toFixed(2);
      setAutoProfit(st.profit);
      maybeShowAutoSummary();
    }
    setHistory(p => [{
      id: ballId, mult, profit, bet, pay, time: Date.now(), nonce,
      serverSeed: ss, clientSeed: cs, seedHash, dirs, slot,
    }, ...p].slice(0, 50));
  }, [maybeShowAutoSummary]);

  const onConsumed = useCallback((id: number) => setBallQueue(p => p.filter(x => x.id !== id)), []);

  const stopAuto = useCallback(() => {
    autoRef.current = false; setAutoRunning(false);
    autoDoneRef.current = true;
    maybeShowAutoSummary();
  }, [maybeShowAutoSummary]);

  const startAuto = useCallback(() => {
    autoRef.current = true; setAutoRunning(true); setAutoPlayed(0); setAutoProfit(0);
    autoStats.current = { rounds: 0, wins: 0, losses: 0, profit: 0 };
    autoDoneRef.current = false;
    const total = parseInt(autoRounds) || (autoRounds === '0' ? Infinity : 10);
    const limit = autoRounds === '0' ? Infinity : total;
    let c = 0;
    const tick = async () => {
      if (!autoRef.current || c >= limit) { stopAuto(); return; }
      const ok = await drop(true);
      if (!ok) { stopAuto(); return; }
      c++; setAutoPlayed(c);
      setTimeout(tick, 400);
    };
    tick();
  }, [drop, autoRounds, stopAuto]);

  const rotateSeed = useCallback(() => {
    const next = randomHex(32);
    setServerSeed(next);
    nonceRef.current = 0;
    return next;
  }, []);

  const handleSoundToggle = () => setSoundOn(sound.toggle());

  const totalAutoRounds = autoRounds === '0' ? '∞' : autoRounds;

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
      <div className={`app${autoRunning ? ' auto-running' : ''}`}>
        <div className="header">
          <div className="header-left">
            <div className="game-name">
              <PlinkoIcon />
              <span>Plinko</span>
            </div>
          </div>
          <div className="header-bal">
            <span className="header-bal-icon">$</span>
            <span className="header-bal-value">{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="header-right">
            <button className="hdr-btn hdr-desktop" onClick={() => setHistOpen(true)} title="History"><ClockSVG /></button>
            <button className="hdr-btn hdr-desktop" onClick={() => setPfOpen(true)} title="Fair Play"><ShieldSVG /></button>
            <button
              className="hdr-btn hdr-desktop" onClick={() => setInstant(v => !v)} title="Instant Bet"
              style={instant ? { color: 'var(--accent)', borderColor: 'var(--accent-border)', background: 'var(--accent-glow)' } : undefined}
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
                  <div className="dots-menu-item" onClick={() => { setInstant(v => !v); setMenuOpen(false); }}><BoltHdrSVG /> {instant ? 'Instant: On' : 'Instant: Off'}</div>
                  <div className="dots-menu-item" onClick={() => { handleSoundToggle(); setMenuOpen(false); }}><SoundSVG on={soundOn} /> {soundOn ? 'Sound: On' : 'Sound: Off'}</div>
                </div>
              )}
            </button>
          </div>
        </div>

        <div className="row">
          <aside className="side">
            <SidePanel
              balance={balance}
              betStr={betStr}
              setBetStr={setBetStr}
              rows={rows}
              setRows={setRows}
              risk={risk}
              setRisk={setRisk}
              autoRunning={autoRunning}
              ballsInFlight={ballsInFlight}
              autoPlayed={autoPlayed}
              autoProfit={autoProfit}
              totalAutoRounds={totalAutoRounds}
              onDrop={() => { void drop(); }}
              onStopAuto={stopAuto}
              onOpenAuto={() => setAutoOpen(true)}
            />
          </aside>

          <main className="main">
            <div className="history-bar">
              {history.length === 0 ? (
                <span className="history-empty">No games yet</span>
              ) : history.slice(0, 8).map(h => (
                <span key={h.id} className={`history-chip ${h.profit >= 0 ? 'hc-win' : 'hc-lose'}`}>
                  <BoltSVG />
                  {h.mult.toFixed(2)}x
                </span>
              ))}
            </div>

            <div className="game-area">
              <PlinkoBoard rows={rows} multipliers={mults} onBallLand={onLand}
                ballQueue={ballQueue} onBallConsumed={onConsumed} paths={paths} />
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
        serverSeed={serverSeed} clientSeed={clientSeed}
        setClientSeed={setClientSeed} onRotate={rotateSeed}
      />
      <HistoryDrawer open={histOpen} onClose={() => setHistOpen(false)} rounds={history} />
      <AutoDrawer
        open={autoOpen} onClose={() => setAutoOpen(false)}
        autoRounds={autoRounds} setAutoRounds={setAutoRounds}
        bet={betRef.current} rows={rows} risk={risk}
        autoRunning={autoRunning} onStart={startAuto}
      />

      {autoSummary && (
        <div className="modal-overlay show" onClick={() => setAutoSummary(null)}>
          <div className="modal free-bet-summary" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setAutoSummary(null)}>&times;</button>
            <div className={`fbs-icon ${autoSummary.profit >= 0 ? 'fbs-icon-win' : 'fbs-icon-lose'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            </div>
            <h2>Auto Play Complete</h2>
            <div className="fbs-stats fbs-stats-3">
              <div className="fbs-stat"><span className="fbs-stat-label">Rounds</span><span className="fbs-stat-val">{autoSummary.rounds}</span></div>
              <div className="fbs-stat"><span className="fbs-stat-label">Wins</span><span className="fbs-stat-val" style={{ color: 'var(--green)' }}>{autoSummary.wins}</span></div>
              <div className="fbs-stat"><span className="fbs-stat-label">Losses</span><span className="fbs-stat-val" style={{ color: 'var(--red)' }}>{autoSummary.losses}</span></div>
            </div>
            <div className={`fbs-winnings ${autoSummary.profit >= 0 ? 'fbs-win' : 'fbs-lose'}`}>
              <span className="fbs-winnings-label">Net Profit</span>
              <span className="fbs-winnings-val" style={{ color: autoSummary.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {autoSummary.profit >= 0 ? '+' : ''}{fmt(autoSummary.profit)}
              </span>
            </div>
            <button className="fbs-btn" onClick={() => setAutoSummary(null)}>Continue Playing</button>
          </div>
        </div>
      )}
    </>
  );
}
