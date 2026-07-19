import { useState, useCallback, useRef, useEffect } from 'react';
import type { RiskLevel } from '../utils/multipliers';
import { getMultipliers } from '../utils/multipliers';
import { getPath, randomHex, sha256 } from '../utils/provablyFair';
import { MIN_BET } from '../game/betting';
import { sound } from '../utils/sound';

export interface BetResult {
  id: number; mult: number; profit: number; bet: number; pay: number; time: number; nonce: number;
  serverSeed: string; clientSeed: string; seedHash: string; dirs: number[]; slot: number;
  free?: boolean;
}

export interface AutoSummary { rounds: number; wins: number; losses: number; profit: number }
export type GameSpeed = 'slow' | 'normal' | 'instant';
export interface QueuedBall { id: number; speed: GameSpeed }
export interface SystemAlert { id: number; msg: string }
export interface SessionStats { rounds: number; wagered: number; profit: number }

/* Free rounds (mirrors supernova-rgs semantics): stake is never debited, the
   bet is forced to the grant amount, and each round's winnings credit
   immediately — inclusive counts the full payout, exclusive only the profit
   above stake (floored at 0). Completion pays nothing extra. */
export interface FreeGrant {
  id: string;
  betAmount: number;
  roundsTotal: number;
  roundsUsed: number;
  inclusive: boolean;
  winnings: number;
  status: 'active' | 'completed';
}
export interface FreeSummary { rounds: number; winnings: number }

function initFreeGrant(): FreeGrant | null {
  const p = new URLSearchParams(window.location.search);
  if (p.has('demo-free')) {
    const total = Math.max(1, parseInt(p.get('demo-free') || '5', 10) || 5);
    const used = Math.min(total, Math.max(0, parseInt(p.get('used') || '0', 10) || 0));
    const g: FreeGrant = {
      id: `demo_${Date.now()}`,
      betAmount: Math.max(0.1, parseFloat(p.get('free-bet') || '5') || 5),
      roundsTotal: total,
      roundsUsed: used,
      inclusive: p.get('inclusive') === '1' || p.get('mode') === 'inclusive',
      winnings: 0,
      status: used >= total ? 'completed' : 'active',
    };
    if (g.status === 'active') {
      localStorage.setItem('plinko_free', JSON.stringify(g));
      return g;
    }
    localStorage.removeItem('plinko_free');
    return null;
  }
  try {
    const saved = JSON.parse(localStorage.getItem('plinko_free') || 'null') as FreeGrant | null;
    if (saved && saved.status === 'active' && saved.roundsUsed < saved.roundsTotal) return saved;
  } catch { /* corrupted — ignore */ }
  return null;
}

// Demo max-profit cap (Stake clips wins to a per-currency cap, never rejects).
export const MAX_PROFIT = 10000;
export const MAX_CONCURRENT_BALLS = 200; // safety backstop only — PLAY is uncapped

interface PendingBall {
  bet: number; nonce: number; dirs: number[]; slot: number; mult: number;
  serverSeed: string; clientSeed: string; seedHash: string;
  free?: { credit: number; isLast: boolean };
}

// All game logic: seeds, wagers, per-ball snapshots, settlement, auto-play.
// The payout is decided by the seed-derived slot at drop time and settles into
// a persisted ledger immediately — the animation only defers the UI credit.
export function usePlinkoGame(rows: number, risk: RiskLevel) {
  const [balance, setBalance] = useState(() => {
    const v = parseFloat(localStorage.getItem('plinko_balance') || '');
    return v >= 0.1 ? v : 10000;
  });
  // Bet amount persists across sessions (Stake behavior)
  const [betStr, setBetStrState] = useState(() => {
    const v = localStorage.getItem('plinko_bet');
    return v && !isNaN(parseFloat(v)) ? v : '1.00';
  });
  const setBetStr = useCallback((v: string) => {
    setBetStrState(v);
    if (!isNaN(parseFloat(v))) localStorage.setItem('plinko_bet', v);
  }, []);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoRounds, setAutoRounds] = useState('10'); // '0' = unlimited
  // Effective round cap of the CURRENT auto run (free rounds can shrink it
  // below the Number-of-bets setting; Infinity = ∞)
  const [autoLimit, setAutoLimit] = useState<number>(Infinity);
  const [autoPlayed, setAutoPlayed] = useState(0);
  const [autoProfit, setAutoProfit] = useState(0);
  const [autoSummary, setAutoSummary] = useState<AutoSummary | null>(null);
  const [ballQueue, setBallQueue] = useState<QueuedBall[]>([]);
  // Ball speed: slow / normal / instant (boss spec — default normal;
  // migrates the old boolean instant setting)
  const [speed, setSpeedState] = useState<GameSpeed>(() => {
    const v = localStorage.getItem('plinko_speed');
    if (v === 'slow' || v === 'normal' || v === 'instant') return v;
    return localStorage.getItem('plinko_instant') === 'true' ? 'instant' : 'normal';
  });
  const setSpeed = useCallback((v: GameSpeed) => {
    setSpeedState(v);
    localStorage.setItem('plinko_speed', v);
  }, []);
  const [history, setHistory] = useState<BetResult[]>([]);
  const [ballsInFlight, setBallsInFlight] = useState(0);
  const [serverSeed, setServerSeed] = useState(() => randomHex(32));
  const [clientSeed, setClientSeed] = useState(() => 'plinko_' + randomHex(6));
  const [paths] = useState(() => new Map<number, number[]>());
  const [alert, setAlert] = useState<SystemAlert | null>(null);
  const alertId = useRef(0);
  const notify = useCallback((msg: string) => setAlert({ id: ++alertId.current, msg }), []);
  // Session totals (this page visit) — history is capped at 50 rows, so
  // totals accumulate separately as each round settles.
  const [session, setSession] = useState<SessionStats>({ rounds: 0, wagered: 0, profit: 0 });
  const [freeGrant, setFreeGrant] = useState<FreeGrant | null>(initFreeGrant);
  const [freeSummary, setFreeSummary] = useState<FreeSummary | null>(null);
  const [freeEnding, setFreeEnding] = useState(false);

  const idRef = useRef(0);
  const nonceRef = useRef(0);
  const seedRef = useRef({ s: serverSeed, c: clientSeed });
  seedRef.current = { s: serverSeed, c: clientSeed };
  const autoRef = useRef(false);
  const autoIds = useRef(new Set<number>());
  const autoStats = useRef<AutoSummary>({ rounds: 0, wins: 0, losses: 0, profit: 0 });
  const autoDoneRef = useRef(false);
  const pending = useRef(new Map<number, PendingBall>());
  const ledgerRef = useRef(0); // settled balance, written at drop time
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const freeRef = useRef(freeGrant);
  freeRef.current = freeGrant;
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const betRef = useRef(1);
  betRef.current = Math.max(0, parseFloat(betStr) || 0);

  useEffect(() => { ledgerRef.current = balance; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Demo refill: a busted balance would permanently brick the PLAY button.
  useEffect(() => {
    if (balance < MIN_BET && ballsInFlight === 0 && !autoRunning) {
      ledgerRef.current = 10000;
      localStorage.setItem('plinko_balance', '10000');
      setBalance(10000);
    }
  }, [balance, ballsInFlight, autoRunning]);

  const drop = useCallback(async (isAuto = false) => {
    if (pending.current.size >= MAX_CONCURRENT_BALLS) return false;
    const grant = freeRef.current;
    // Free rounds: bet forced to the grant amount, stake never debited, and
    // the round slot is consumed at bet time (RGS Acquire semantics).
    let bet: number;
    let freeInfo: PendingBall['free'];
    if (grant) {
      // A completed-but-unclaimed grant (summary not dismissed yet) blocks ALL
      // play — the button still says FREE, so falling through to real-money
      // bets here would silently wager the player's saved bet.
      if (grant.status !== 'active' || grant.roundsUsed >= grant.roundsTotal) return false;
      bet = grant.betAmount;
      // Consume the round slot synchronously, BEFORE any await — overlapping
      // drop calls (hold-to-pour, tap spam) must never double-spend a slot.
      const used = grant.roundsUsed + 1;
      const isLast = used >= grant.roundsTotal;
      const next: FreeGrant = { ...grant, roundsUsed: used, status: isLast ? 'completed' : 'active' };
      freeRef.current = next;
      setFreeGrant(next);
      localStorage.setItem('plinko_free', JSON.stringify(next));
      if (isLast) setFreeEnding(true);
      freeInfo = { credit: 0, isLast }; // credit filled in once the slot is known
    } else {
      // The bet is never changed behind the player's back — if the balance
      // doesn't cover it, the round simply doesn't start and an alert says why.
      bet = betRef.current;
      if (bet <= 0) return false;
      if (bet > balanceRef.current) {
        notify('Insufficient balance');
        return false;
      }
      setBalance(p => p - bet);
    }
    const id = ++idRef.current;
    const nonce = ++nonceRef.current;
    const { s, c } = seedRef.current;
    const dirs = await getPath(s, c, nonce, rows);
    const seedHash = await sha256(s);
    const slot = dirs.reduce((a, b) => a + b, 0);
    const mult = getMultipliers(risk, rows)[slot] ?? 0;
    paths.set(id, dirs);
    const pay = Math.min(+(bet * mult).toFixed(2), bet + MAX_PROFIT);
    if (freeInfo) {
      // inclusive credits the full payout; exclusive only the profit over stake
      freeInfo.credit = grant!.inclusive ? pay : Math.max(0, +(pay - bet).toFixed(2));
      // ledger: stake untouched, credit settles now (animation defers UI)
      ledgerRef.current = +(ledgerRef.current + freeInfo.credit).toFixed(2);
    } else {
      // Settle into the persisted ledger NOW — the animation only defers the
      // on-screen credit. Wins clip to the max-profit cap.
      ledgerRef.current = +(ledgerRef.current - bet + pay).toFixed(2);
    }
    localStorage.setItem('plinko_balance', String(ledgerRef.current));
    pending.current.set(id, { bet, nonce, dirs, slot, mult, serverSeed: s, clientSeed: c, seedHash, free: freeInfo });
    setBallsInFlight(pending.current.size);
    if (isAuto) autoIds.current.add(id);
    setBallQueue(p => [...p, { id, speed: speedRef.current }]);
    return true;
  }, [rows, risk, paths, notify]);

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
    const { bet, nonce, dirs, slot, mult, serverSeed: ss, clientSeed: cs, seedHash, free } = entry;
    const rawPay = Math.min(+(bet * mult).toFixed(2), bet + MAX_PROFIT);
    // Free rounds: the stake was never real money — the round's value is the
    // credited winnings (inclusive: full payout; exclusive: profit only).
    const pay = free ? free.credit : rawPay;
    const profit = free ? free.credit : rawPay - bet;
    setBalance(p => +(p + pay).toFixed(2));
    setSession(s => ({
      rounds: s.rounds + 1,
      wagered: +(free ? s.wagered : s.wagered + bet).toFixed(2),
      profit: +(s.profit + profit).toFixed(2),
    }));
    if (free && freeRef.current) {
      const next = { ...freeRef.current, winnings: +(freeRef.current.winnings + free.credit).toFixed(2) };
      freeRef.current = next;
      setFreeGrant(next);
      // The summary waits for the LAST free ball to LAND, not the last one
      // consumed — with mixed speeds an earlier slow ball can still be
      // falling when the final instant round hits its slot.
      const freeStillFlying = [...pending.current.values()].some(p => p.free);
      if (next.status === 'completed' && !freeStillFlying) {
        localStorage.removeItem('plinko_free');
        setFreeSummary({ rounds: next.roundsTotal, winnings: next.winnings });
      } else {
        localStorage.setItem('plinko_free', JSON.stringify(next));
      }
    }
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
      id: ballId, mult, profit, bet: free ? 0 : bet, pay, time: Date.now(), nonce,
      serverSeed: ss, clientSeed: cs, seedHash, dirs, slot, free: !!free,
    }, ...p].slice(0, 50));
  }, [maybeShowAutoSummary]);

  const onConsumed = useCallback((id: number) => setBallQueue(p => p.filter(x => x.id !== id)), []);

  const stopAuto = useCallback(() => {
    autoRef.current = false; setAutoRunning(false);
    autoDoneRef.current = true;
    maybeShowAutoSummary();
  }, [maybeShowAutoSummary]);

  const startAuto = useCallback((roundsOverride?: string) => {
    autoRef.current = true; setAutoRunning(true); setAutoPlayed(0); setAutoProfit(0);
    autoStats.current = { rounds: 0, wins: 0, losses: 0, profit: 0 };
    autoDoneRef.current = false;
    const rounds = roundsOverride ?? autoRounds;
    let limit = rounds === '0' ? Infinity : (parseInt(rounds) || 10);
    const g = freeRef.current;
    if (g && g.status === 'active') limit = Math.min(limit, g.roundsTotal - g.roundsUsed);
    setAutoLimit(limit);
    let c = 0;
    const tick = async () => {
      if (!autoRef.current || c >= limit) { stopAuto(); return; }
      const ok = await drop(true);
      if (!ok) {
        if (c > 0 && !freeRef.current) notify('Auto Play stopped — insufficient balance');
        stopAuto();
        return;
      }
      c++; setAutoPlayed(c);
      setTimeout(tick, 120); // no artificial cadence — balls stream out like rapid manual play
    };
    tick();
  }, [drop, autoRounds, stopAuto, notify]);

  // Continue button on the completion modal
  const clearFree = useCallback(() => {
    setFreeGrant(null);
    freeRef.current = null;
    setFreeSummary(null);
    setFreeEnding(false);
    localStorage.removeItem('plinko_free');
  }, []);

  const rotateSeed = useCallback(() => {
    const next = randomHex(32);
    setServerSeed(next);
    nonceRef.current = 0;
    return next;
  }, []);

  return {
    balance, betStr, setBetStr, bet: betRef.current,
    autoRunning, autoRounds, setAutoRounds, autoPlayed, autoProfit, autoLimit,
    autoSummary, setAutoSummary,
    ballQueue, speed, setSpeed, history, ballsInFlight,
    serverSeed, clientSeed, setClientSeed, rotateSeed,
    paths, drop, onLand, onConsumed, startAuto, stopAuto,
    alert, setAlert, notify, session,
    freeGrant, freeSummary, freeEnding, clearFree,
  };
}
