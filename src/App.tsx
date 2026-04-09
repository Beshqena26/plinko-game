import { useState, useCallback, useRef, useEffect } from 'react';
import PlinkoBoard from './components/PlinkoBoard';
import BetControls from './components/BetControls';
import BetHistory from './components/BetHistory';
import type { BetRecord } from './components/BetHistory';
import type { RiskLevel } from './utils/multipliers';
import { getMultipliers } from './utils/multipliers';
import { getPath, randomHex } from './utils/provablyFair';
import { sound } from './utils/sound';

// Animated number hook
function useAnimatedNumber(target: number, speed = 0.15) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>(0);
  const currentRef = useRef(target);

  useEffect(() => {
    const animate = () => {
      const diff = target - currentRef.current;
      if (Math.abs(diff) < 0.01) {
        currentRef.current = target;
        setDisplay(target);
        return;
      }
      currentRef.current += diff * speed;
      setDisplay(currentRef.current);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, speed]);

  return display;
}

function App() {
  const [balance, setBalance] = useState(10000);
  const [betAmount, setBetAmount] = useState(1);
  const [rows, setRows] = useState(16);
  const [risk, setRisk] = useState<RiskLevel>('high');
  const [records, setRecords] = useState<BetRecord[]>([]);
  const [isAuto, setIsAuto] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState(10);
  const [stopOnProfit, setStopOnProfit] = useState(0);
  const [stopOnLoss, setStopOnLoss] = useState(0);
  const [ballQueue, setBallQueue] = useState<number[]>([]);
  const [paths] = useState(() => new Map<number, number[]>());
  const [lastWinAmount, setLastWinAmount] = useState<{ amount: number; mult: number } | null>(null);

  const ballIdRef = useRef(0);
  const nonceRef = useRef(0);
  const serverSeed = useRef(randomHex(32));
  const clientSeed = useRef(randomHex(16));
  const autoRef = useRef(false);
  const pendingBetsRef = useRef(new Map<number, number>());
  const autoStartBalanceRef = useRef(0);

  const multipliers = getMultipliers(risk, rows);
  const animatedBalance = useAnimatedNumber(balance);

  const dropBall = useCallback(async () => {
    if (balance < betAmount || betAmount <= 0) return;
    const bet = betAmount;
    setBalance(prev => prev - bet);
    const id = ++ballIdRef.current;
    const nonce = ++nonceRef.current;
    const dirs = await getPath(serverSeed.current, clientSeed.current, nonce, rows);
    paths.set(id, dirs);
    pendingBetsRef.current.set(id, bet);
    setBallQueue(prev => [...prev, id]);
  }, [balance, betAmount, rows, paths]);

  const handleBallLand = useCallback((bucketIndex: number) => {
    const mult = getMultipliers(risk, rows)[bucketIndex];
    if (!mult) return;
    const entries = Array.from(pendingBetsRef.current.entries());
    if (entries.length === 0) return;
    const [ballId, bet] = entries[0];
    pendingBetsRef.current.delete(ballId);
    const payout = +(bet * mult).toFixed(2);
    setBalance(prev => prev + payout);
    sound.land(mult);

    // Show last win
    setLastWinAmount({ amount: payout, mult });
    setTimeout(() => setLastWinAmount(null), 2000);

    setRecords(prev => [{ id: ballId, bet, multiplier: mult, payout, time: Date.now() }, ...prev].slice(0, 100));
  }, [risk, rows]);

  const handleBallConsumed = useCallback((id: number) => {
    setBallQueue(prev => prev.filter(x => x !== id));
  }, []);

  const startAuto = useCallback(() => {
    autoRef.current = true;
    autoStartBalanceRef.current = balance;
    setIsAuto(true);
    let count = 0;

    const tick = () => {
      if (!autoRef.current || count >= autoBetCount) {
        autoRef.current = false;
        setIsAuto(false);
        return;
      }

      // Check stop conditions
      setBalance(currentBalance => {
        const profit = currentBalance - autoStartBalanceRef.current;
        if (stopOnProfit > 0 && profit >= stopOnProfit) {
          autoRef.current = false;
          setIsAuto(false);
          return currentBalance;
        }
        if (stopOnLoss > 0 && -profit >= stopOnLoss) {
          autoRef.current = false;
          setIsAuto(false);
          return currentBalance;
        }
        return currentBalance;
      });

      if (!autoRef.current) return;

      dropBall();
      count++;
      setTimeout(tick, 350);
    };
    tick();
  }, [dropBall, autoBetCount, balance, stopOnProfit, stopOnLoss]);

  const stopAuto = useCallback(() => {
    autoRef.current = false;
    setIsAuto(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#000514] text-white flex flex-col">
      {/* Header */}
      <header className="h-14 bg-[#100C1C] border-b border-[#1A1726] flex items-center px-5 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <h1 className="text-[22px] font-black tracking-tight bg-gradient-to-b from-[#0ECC68] via-[#0ba854] to-[#087a3d] bg-clip-text text-transparent select-none">
            PLINKO
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Last win indicator */}
          {lastWinAmount && (
            <div
              className={`px-3 py-1 rounded-full text-[12px] font-bold animate-pulse ${
                lastWinAmount.mult >= 1 ? 'bg-[#0ECC68]/10 text-[#0ECC68]' : 'bg-[#ff003f]/10 text-[#ff003f]'
              }`}
            >
              {lastWinAmount.mult >= 1 ? '+' : ''}{lastWinAmount.amount.toFixed(2)}
            </div>
          )}

          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-lg bg-[#1A1726] flex items-center justify-center text-[#73768C] hover:text-[#C2C5D6] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            </button>
            <button className="w-8 h-8 rounded-lg bg-[#1A1726] flex items-center justify-center text-[#73768C] hover:text-[#C2C5D6] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5"/></svg>
            </button>
          </div>

          <div className="ml-1 bg-[#000514] border border-[#1A1726] rounded-lg px-3.5 py-1.5 flex items-center gap-2 min-w-[120px]">
            <span className="w-4 h-4 rounded-full bg-[#FBCE04] flex items-center justify-center text-[8px] font-bold text-[#000514]">$</span>
            <span className="text-[13px] font-bold text-[#FBCE04] tabular-nums">
              {animatedBalance.toFixed(2)}
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col lg:flex-row">
        <div className="w-full lg:w-[280px] shrink-0 border-r border-[#1A1726] order-2 lg:order-1">
          <BetControls
            balance={balance}
            betAmount={betAmount}
            setBetAmount={setBetAmount}
            rows={rows}
            setRows={setRows}
            risk={risk}
            setRisk={setRisk}
            isAuto={isAuto}
            autoBetCount={autoBetCount}
            setAutoBetCount={setAutoBetCount}
            onDrop={dropBall}
            onStartAuto={startAuto}
            onStopAuto={stopAuto}
            disabled={false}
            stopOnProfit={stopOnProfit}
            setStopOnProfit={setStopOnProfit}
            stopOnLoss={stopOnLoss}
            setStopOnLoss={setStopOnLoss}
          />
        </div>

        <div className="flex-1 order-1 lg:order-2" style={{ minHeight: '580px' }}>
          <PlinkoBoard
            rows={rows}
            multipliers={multipliers}
            onBallLand={handleBallLand}
            ballQueue={ballQueue}
            onBallConsumed={handleBallConsumed}
            paths={paths}
          />
        </div>

        <div className="hidden lg:block w-[200px] shrink-0 border-l border-[#1A1726] order-3">
          <BetHistory records={records} />
        </div>
        <div className="lg:hidden order-3 border-t border-[#1A1726]">
          <BetHistory records={records} />
        </div>
      </main>

      {/* Footer */}
      <footer className="h-10 bg-[#100C1C] border-t border-[#1A1726] flex items-center justify-between px-5 shrink-0">
        <span className="text-[11px] text-[#73768C]">Plinko — For Entertainment Only</span>
        <span className="text-[10px] text-[#73768C]/50">Press Space to drop</span>
      </footer>
    </div>
  );
}

export default App;
