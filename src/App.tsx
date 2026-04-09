import { useState, useCallback, useRef, useEffect } from 'react';
import PlinkoBoard from './components/PlinkoBoard';
import BetControls from './components/BetControls';
import BetHistory from './components/BetHistory';
import type { BetRecord } from './components/BetHistory';
import type { RiskLevel } from './utils/multipliers';
import { getMultipliers, getMultiplierColor } from './utils/multipliers';
import { getPath, randomHex } from './utils/provablyFair';
import { sound } from './utils/sound';

function useAnimatedNum(target: number) {
  const [val, setVal] = useState(target);
  const cur = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    const go = () => {
      const d = target - cur.current;
      if (Math.abs(d) < 0.01) { cur.current = target; setVal(target); return; }
      cur.current += d * 0.15;
      setVal(cur.current);
      raf.current = requestAnimationFrame(go);
    };
    raf.current = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return val;
}

export default function App() {
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

  const idRef = useRef(0);
  const nonceRef = useRef(0);
  const sSeed = useRef(randomHex(32));
  const cSeed = useRef(randomHex(16));
  const autoRef = useRef(false);
  const pending = useRef(new Map<number, number>());
  const autoStart = useRef(0);

  const mults = getMultipliers(risk, rows);
  const dispBal = useAnimatedNum(balance);

  const drop = useCallback(async () => {
    if (balance < betAmount || betAmount <= 0) return;
    setBalance(p => p - betAmount);
    const id = ++idRef.current;
    const dirs = await getPath(sSeed.current, cSeed.current, ++nonceRef.current, rows);
    paths.set(id, dirs);
    pending.current.set(id, betAmount);
    setBallQueue(p => [...p, id]);
  }, [balance, betAmount, rows, paths]);

  const onLand = useCallback((idx: number) => {
    const m = getMultipliers(risk, rows)[idx];
    if (!m) return;
    const e = Array.from(pending.current.entries());
    if (!e.length) return;
    const [bid, bet] = e[0];
    pending.current.delete(bid);
    const pay = +(bet * m).toFixed(2);
    setBalance(p => p + pay);
    sound.land(m);
    setLastWin({ amount: pay - bet, mult: m, color: getMultiplierColor(m) });
    setTimeout(() => setLastWin(null), 2500);
    setRecords(p => [{ id: bid, bet, multiplier: m, payout: pay, time: Date.now() }, ...p].slice(0, 100));
  }, [risk, rows]);

  const onConsumed = useCallback((id: number) => {
    setBallQueue(p => p.filter(x => x !== id));
  }, []);

  const startAuto = useCallback(() => {
    autoRef.current = true; autoStart.current = balance; setIsAuto(true);
    let c = 0;
    const tick = () => {
      if (!autoRef.current || c >= autoBetCount) { autoRef.current = false; setIsAuto(false); return; }
      setBalance(b => {
        const pl = b - autoStart.current;
        if ((stopOnProfit > 0 && pl >= stopOnProfit) || (stopOnLoss > 0 && -pl >= stopOnLoss)) {
          autoRef.current = false; setIsAuto(false); return b;
        }
        return b;
      });
      if (!autoRef.current) return;
      drop(); c++; setTimeout(tick, 350);
    };
    tick();
  }, [drop, autoBetCount, balance, stopOnProfit, stopOnLoss]);

  const stopAuto = useCallback(() => { autoRef.current = false; setIsAuto(false); }, []);

  const pl = records.reduce((s, r) => s + r.payout - r.bet, 0);

  return (
    <div className="min-h-screen bg-[#000514] text-white flex flex-col select-none">
      {/* Header — h-12 */}
      <header className="h-12 bg-[#100C1C] border-b border-[#1A1726] flex items-center px-4 gap-3 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0ECC68] to-[#087a3d] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="5" r="3"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/>
            </svg>
          </div>
          <span className="text-16 font-bold">Plinko</span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Last win */}
          {lastWin && (
            <div className="anim-slide h-8 px-3 rounded-lg flex items-center gap-1.5 text-12 font-bold tabular-nums"
              style={{ backgroundColor: `${lastWin.color}10`, border: `1px solid ${lastWin.color}20`, color: lastWin.color }}>
              <span className="text-10 opacity-50">{lastWin.mult}x</span>
              {lastWin.amount >= 0 ? '+' : ''}{lastWin.amount.toFixed(2)}
            </div>
          )}

          {/* P/L */}
          {records.length > 0 && (
            <div className={`hidden sm:flex h-8 px-3 rounded-lg items-center text-12 font-bold tabular-nums border
              ${pl >= 0 ? 'bg-[#0ECC68]/5 border-[#0ECC68]/15 text-[#0ECC68]' : 'bg-[#ff003f]/5 border-[#ff003f]/15 text-[#ff003f]'}`}>
              {pl >= 0 ? '+' : ''}{pl.toFixed(2)}
            </div>
          )}

          {/* Balance */}
          <div className="h-8 bg-[#000514] border border-[#1A1726] rounded-lg px-3 flex items-center gap-2 min-w-[112px]">
            <div className="w-4 h-4 rounded-full bg-[#FBCE04] flex items-center justify-center">
              <span className="text-[8px] font-black text-[#000514]">$</span>
            </div>
            <span className="text-14 font-bold text-[#FBCE04] tabular-nums">{dispBal.toFixed(2)}</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-[256px] shrink-0 border-r border-[#1A1726] order-2 lg:order-1">
          <BetControls
            balance={balance} betAmount={betAmount} setBetAmount={setBetAmount}
            rows={rows} setRows={setRows} risk={risk} setRisk={setRisk}
            isAuto={isAuto} autoBetCount={autoBetCount} setAutoBetCount={setAutoBetCount}
            onDrop={drop} onStartAuto={startAuto} onStopAuto={stopAuto} disabled={false}
            stopOnProfit={stopOnProfit} setStopOnProfit={setStopOnProfit}
            stopOnLoss={stopOnLoss} setStopOnLoss={setStopOnLoss}
          />
        </div>

        <div className="flex-1 order-1 lg:order-2 min-h-[480px]">
          <PlinkoBoard rows={rows} multipliers={mults} onBallLand={onLand}
            ballQueue={ballQueue} onBallConsumed={onConsumed} paths={paths} />
        </div>

        <div className="hidden lg:block w-[192px] shrink-0 border-l border-[#1A1726] order-3">
          <BetHistory records={records} />
        </div>
        <div className="lg:hidden order-3 border-t border-[#1A1726] max-h-[192px]">
          <BetHistory records={records} />
        </div>
      </main>

      {/* Footer — h-8 */}
      <footer className="h-8 bg-[#100C1C] border-t border-[#1A1726] flex items-center justify-between px-4 shrink-0">
        <span className="text-10 text-[#73768C]/60">Provably Fair — For Entertainment Only</span>
        <div className="flex items-center gap-1 text-10 text-[#73768C]/30">
          <kbd className="px-1 h-4 flex items-center rounded bg-[#1A1726] border border-[#2a2538] text-[8px] font-mono text-[#73768C]/50">Space</kbd>
          <span>drop</span>
        </div>
      </footer>
    </div>
  );
}
