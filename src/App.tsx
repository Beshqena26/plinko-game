import { useState, useCallback, useRef, useEffect } from 'react';
import PlinkoBoard from './components/PlinkoBoard';
import BetControls from './components/BetControls';
import BetHistory from './components/BetHistory';
import type { BetRecord } from './components/BetHistory';
import type { RiskLevel } from './utils/multipliers';
import { getMultipliers, getMultiplierColor } from './utils/multipliers';
import { getPath, randomHex } from './utils/provablyFair';
import { sound } from './utils/sound';

function useAnimatedNumber(target: number, speed = 0.15) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>(0);
  const currentRef = useRef(target);
  useEffect(() => {
    const animate = () => {
      const diff = target - currentRef.current;
      if (Math.abs(diff) < 0.01) { currentRef.current = target; setDisplay(target); return; }
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
  const [lastWin, setLastWin] = useState<{ amount: number; mult: number; color: string } | null>(null);

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
    setBalance(prev => prev - betAmount);
    const id = ++ballIdRef.current;
    const dirs = await getPath(serverSeed.current, clientSeed.current, ++nonceRef.current, rows);
    paths.set(id, dirs);
    pendingBetsRef.current.set(id, betAmount);
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

    const color = getMultiplierColor(mult);
    setLastWin({ amount: payout - bet, mult, color });
    setTimeout(() => setLastWin(null), 2500);

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
      if (!autoRef.current || count >= autoBetCount) { autoRef.current = false; setIsAuto(false); return; }
      setBalance(cur => {
        const profit = cur - autoStartBalanceRef.current;
        if ((stopOnProfit > 0 && profit >= stopOnProfit) || (stopOnLoss > 0 && -profit >= stopOnLoss)) {
          autoRef.current = false; setIsAuto(false); return cur;
        }
        return cur;
      });
      if (!autoRef.current) return;
      dropBall(); count++;
      setTimeout(tick, 350);
    };
    tick();
  }, [dropBall, autoBetCount, balance, stopOnProfit, stopOnLoss]);

  const stopAuto = useCallback(() => { autoRef.current = false; setIsAuto(false); }, []);

  const profit = records.reduce((s, r) => s + r.payout - r.bet, 0);

  return (
    <div className="min-h-screen bg-[#000514] text-white flex flex-col select-none">
      {/* Header */}
      <header className="h-[52px] bg-[#100C1C] border-b border-[#1A1726] flex items-center px-4 shrink-0">
        <div className="flex items-center gap-2.5 flex-1">
          {/* Logo */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0ECC68] to-[#087a3d] flex items-center justify-center shadow-[0_2px_8px_rgba(14,204,104,0.2)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="5" r="3"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/>
            </svg>
          </div>
          <h1 className="text-[18px] font-black tracking-tight text-white">
            Plinko
          </h1>
          <div className="hidden sm:flex items-center gap-1 ml-2 bg-[#0ECC68]/8 border border-[#0ECC68]/15 rounded-full px-2 py-[3px]">
            <span className="w-[5px] h-[5px] rounded-full bg-[#0ECC68] animate-pulse" />
            <span className="text-[9px] font-medium text-[#0ECC68]/70 uppercase tracking-wider">Live</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Last win toast */}
          {lastWin && (
            <div
              className="animate-slide-up px-3 py-1.5 rounded-lg text-[12px] font-bold tabular-nums flex items-center gap-1.5"
              style={{
                backgroundColor: `${lastWin.color}12`,
                border: `1px solid ${lastWin.color}25`,
                color: lastWin.color,
              }}
            >
              <span className="text-[10px] opacity-60">{lastWin.mult}x</span>
              <span>{lastWin.amount >= 0 ? '+' : ''}{lastWin.amount.toFixed(2)}</span>
            </div>
          )}

          {/* Session P/L */}
          {records.length > 0 && (
            <div className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold tabular-nums border ${
              profit >= 0
                ? 'bg-[#0ECC68]/5 border-[#0ECC68]/15 text-[#0ECC68]'
                : 'bg-[#ff003f]/5 border-[#ff003f]/15 text-[#ff003f]'
            }`}>
              <span className="text-[9px] opacity-50 uppercase">P/L</span>
              {profit >= 0 ? '+' : ''}{profit.toFixed(2)}
            </div>
          )}

          {/* Balance */}
          <div className="bg-[#000514] border border-[#1A1726] rounded-xl px-3.5 py-[7px] flex items-center gap-2 min-w-[115px]
            hover:border-[#2a2538] transition-colors">
            <div className="w-[16px] h-[16px] rounded-full bg-[#FBCE04] flex items-center justify-center shadow-[0_0_6px_rgba(251,206,4,0.2)]">
              <span className="text-[7px] font-black text-[#000514]">$</span>
            </div>
            <span className="text-[13px] font-bold text-[#FBCE04] tabular-nums">
              {animatedBalance.toFixed(2)}
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Controls */}
        <div className="w-full lg:w-[260px] shrink-0 border-r border-[#1A1726] order-2 lg:order-1">
          <BetControls
            balance={balance} betAmount={betAmount} setBetAmount={setBetAmount}
            rows={rows} setRows={setRows} risk={risk} setRisk={setRisk}
            isAuto={isAuto} autoBetCount={autoBetCount} setAutoBetCount={setAutoBetCount}
            onDrop={dropBall} onStartAuto={startAuto} onStopAuto={stopAuto} disabled={false}
            stopOnProfit={stopOnProfit} setStopOnProfit={setStopOnProfit}
            stopOnLoss={stopOnLoss} setStopOnLoss={setStopOnLoss}
          />
        </div>

        {/* Board */}
        <div className="flex-1 order-1 lg:order-2 min-h-[500px]">
          <PlinkoBoard
            rows={rows} multipliers={multipliers}
            onBallLand={handleBallLand} ballQueue={ballQueue}
            onBallConsumed={handleBallConsumed} paths={paths}
          />
        </div>

        {/* History */}
        <div className="hidden lg:block w-[190px] shrink-0 border-l border-[#1A1726] order-3">
          <BetHistory records={records} />
        </div>
        <div className="lg:hidden order-3 border-t border-[#1A1726] max-h-[200px]">
          <BetHistory records={records} />
        </div>
      </main>

      {/* Footer */}
      <footer className="h-9 bg-[#100C1C] border-t border-[#1A1726] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#73768C]">Provably Fair</span>
          <span className="w-[3px] h-[3px] rounded-full bg-[#1A1726]" />
          <span className="text-[10px] text-[#73768C]/50">For Entertainment Only</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-[#73768C]/40">
          <kbd className="px-1.5 py-0.5 rounded bg-[#1A1726] text-[#73768C]/60 border border-[#2a2538] text-[8px] font-mono">SPACE</kbd>
          <span>to drop</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
