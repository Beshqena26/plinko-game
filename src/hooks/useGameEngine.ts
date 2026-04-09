import { useState, useCallback, useRef } from 'react';
import { RiskLevel, getMultipliers } from '../utils/multipliers';
import { generateClientSeed, generateServerSeed, getDropResult } from '../utils/provablyFair';
import { soundManager } from '../utils/sound';

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  directions: number[];
  currentRow: number;
  done: boolean;
  trail: { x: number; y: number; opacity: number }[];
}

export interface BetResult {
  id: number;
  betAmount: number;
  multiplier: number;
  payout: number;
  bucketIndex: number;
  timestamp: number;
}

export function useGameEngine() {
  const [balance, setBalance] = useState(10000);
  const [betAmount, setBetAmount] = useState(1);
  const [rows, setRows] = useState<number>(16);
  const [risk, setRisk] = useState<RiskLevel>('medium');
  const [balls, setBalls] = useState<Ball[]>([]);
  const [results, setResults] = useState<BetResult[]>([]);
  const [isAutoBetting, setIsAutoBetting] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState(10);
  const [flashingBucket, setFlashingBucket] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<{ amount: number; x: number; y: number } | null>(null);

  const ballIdRef = useRef(0);
  const nonceRef = useRef(0);
  const serverSeedRef = useRef(generateServerSeed());
  const clientSeedRef = useRef(generateClientSeed());
  const autoBetRef = useRef(false);

  const multipliers = getMultipliers(risk, rows);

  const dropBall = useCallback(async () => {
    if (balance < betAmount) return;

    setBalance(prev => prev - betAmount);
    soundManager.playDrop();

    const id = ++ballIdRef.current;
    const nonce = ++nonceRef.current;
    const directions = await getDropResult(
      serverSeedRef.current,
      clientSeedRef.current,
      nonce,
      rows
    );

    const newBall: Ball = {
      id,
      x: 0.5,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 5,
      directions,
      currentRow: 0,
      done: false,
      trail: [],
    };

    setBalls(prev => [...prev, newBall]);

    const bucketIndex = directions.reduce((sum, d) => sum + d, 0);
    const mults = getMultipliers(risk, rows);
    const multiplier = mults[bucketIndex];
    const payout = betAmount * multiplier;

    setTimeout(() => {
      setBalance(prev => prev + payout);
      setFlashingBucket(bucketIndex);
      setLastWin({ amount: payout, x: 0, y: 0 });

      if (multiplier >= 2) {
        soundManager.playWin(multiplier >= 10);
      } else if (multiplier < 1) {
        soundManager.playLoss();
      }

      setResults(prev => [{
        id,
        betAmount,
        multiplier,
        payout,
        bucketIndex,
        timestamp: Date.now(),
      }, ...prev].slice(0, 50));

      setTimeout(() => {
        setFlashingBucket(null);
        setLastWin(null);
      }, 800);

      setTimeout(() => {
        setBalls(prev => prev.filter(b => b.id !== id));
      }, 500);
    }, rows * 120 + 200);
  }, [balance, betAmount, rows, risk]);

  const startAutoBet = useCallback(() => {
    autoBetRef.current = true;
    setIsAutoBetting(true);
    let count = 0;
    const interval = setInterval(() => {
      if (!autoBetRef.current || count >= autoBetCount) {
        clearInterval(interval);
        autoBetRef.current = false;
        setIsAutoBetting(false);
        return;
      }
      dropBall();
      count++;
    }, 400);
  }, [dropBall, autoBetCount]);

  const stopAutoBet = useCallback(() => {
    autoBetRef.current = false;
    setIsAutoBetting(false);
  }, []);

  const halfBet = useCallback(() => {
    setBetAmount(prev => Math.max(0.01, +(prev / 2).toFixed(2)));
  }, []);

  const doubleBet = useCallback(() => {
    setBetAmount(prev => Math.min(10000, +(prev * 2).toFixed(2)));
  }, []);

  return {
    balance,
    betAmount,
    setBetAmount,
    rows,
    setRows,
    risk,
    setRisk,
    balls,
    setBalls,
    results,
    multipliers,
    isAutoBetting,
    autoBetCount,
    setAutoBetCount,
    flashingBucket,
    lastWin,
    dropBall,
    startAutoBet,
    stopAutoBet,
    halfBet,
    doubleBet,
  };
}
