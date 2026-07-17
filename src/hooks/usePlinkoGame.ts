import { useState, useCallback, useRef, useEffect } from 'react';
import type { RiskLevel } from '../utils/multipliers';
import { getMultipliers } from '../utils/multipliers';
import { getPath, randomHex, sha256 } from '../utils/provablyFair';
import { MIN_BET } from '../game/betting';
import { sound } from '../utils/sound';

export interface BetResult {
  id: number; mult: number; profit: number; bet: number; pay: number; time: number; nonce: number;
  serverSeed: string; clientSeed: string; seedHash: string; dirs: number[]; slot: number;
}

export interface AutoSummary { rounds: number; wins: number; losses: number; profit: number }
export interface QueuedBall { id: number; instant: boolean }
export interface SystemAlert { id: number; msg: string }

// Demo max-profit cap (Stake clips wins to a per-currency cap, never rejects).
export const MAX_PROFIT = 10000;
export const MAX_CONCURRENT_BALLS = 20;

interface PendingBall {
  bet: number; nonce: number; dirs: number[]; slot: number; mult: number;
  serverSeed: string; clientSeed: string; seedHash: string;
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
  const [autoPlayed, setAutoPlayed] = useState(0);
  const [autoProfit, setAutoProfit] = useState(0);
  const [autoSummary, setAutoSummary] = useState<AutoSummary | null>(null);
  const [ballQueue, setBallQueue] = useState<QueuedBall[]>([]);
  const [instant, setInstant] = useState(() => localStorage.getItem('plinko_instant') === 'true');
  const [history, setHistory] = useState<BetResult[]>([]);
  const [ballsInFlight, setBallsInFlight] = useState(0);
  const [serverSeed, setServerSeed] = useState(() => randomHex(32));
  const [clientSeed, setClientSeed] = useState(() => 'plinko_' + randomHex(6));
  const [paths] = useState(() => new Map<number, number[]>());
  const [alert, setAlert] = useState<SystemAlert | null>(null);
  const alertId = useRef(0);
  const notify = useCallback((msg: string) => setAlert({ id: ++alertId.current, msg }), []);

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
  const instantRef = useRef(instant);
  instantRef.current = instant;
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const betRef = useRef(1);
  betRef.current = Math.max(0, parseFloat(betStr) || 0);

  useEffect(() => { ledgerRef.current = balance; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { localStorage.setItem('plinko_instant', String(instant)); }, [instant]);

  // Demo refill: a busted balance would permanently brick the PLAY button.
  useEffect(() => {
    if (balance < MIN_BET && ballsInFlight === 0 && !autoRunning) {
      ledgerRef.current = 10000;
      localStorage.setItem('plinko_balance', '10000');
      setBalance(10000);
    }
  }, [balance, ballsInFlight, autoRunning]);

  const drop = useCallback(async (isAuto = false) => {
    // The bet is never changed behind the player's back — if the balance
    // doesn't cover it, the round simply doesn't start and an alert says why.
    const bet = betRef.current;
    if (bet <= 0) return false;
    if (bet > balanceRef.current) {
      notify('Insufficient balance');
      return false;
    }
    if (pending.current.size >= MAX_CONCURRENT_BALLS) return false;
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
    const { bet, nonce, dirs, slot, mult, serverSeed: ss, clientSeed: cs, seedHash } = entry;
    const pay = Math.min(+(bet * mult).toFixed(2), bet + MAX_PROFIT);
    const profit = pay - bet;
    setBalance(p => +(p + pay).toFixed(2));
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

  const startAuto = useCallback((roundsOverride?: string) => {
    autoRef.current = true; setAutoRunning(true); setAutoPlayed(0); setAutoProfit(0);
    autoStats.current = { rounds: 0, wins: 0, losses: 0, profit: 0 };
    autoDoneRef.current = false;
    const rounds = roundsOverride ?? autoRounds;
    const limit = rounds === '0' ? Infinity : (parseInt(rounds) || 10);
    let c = 0;
    const tick = async () => {
      if (!autoRef.current || c >= limit) { stopAuto(); return; }
      const ok = await drop(true);
      if (!ok) {
        if (c > 0) notify('Auto Play stopped — insufficient balance');
        stopAuto();
        return;
      }
      c++; setAutoPlayed(c);
      setTimeout(tick, 1050); // BGaming's observed auto cadence (~1.1s/bet)
    };
    tick();
  }, [drop, autoRounds, stopAuto, notify]);

  const rotateSeed = useCallback(() => {
    const next = randomHex(32);
    setServerSeed(next);
    nonceRef.current = 0;
    return next;
  }, []);

  return {
    balance, betStr, setBetStr, bet: betRef.current,
    autoRunning, autoRounds, setAutoRounds, autoPlayed, autoProfit,
    autoSummary, setAutoSummary,
    ballQueue, instant, setInstant, history, ballsInFlight,
    serverSeed, clientSeed, setClientSeed, rotateSeed,
    paths, drop, onLand, onConsumed, startAuto, stopAuto,
    alert, setAlert, notify,
  };
}
