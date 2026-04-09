import { useState, useCallback, useRef, useEffect } from 'react';
import PlinkoBoard from './components/PlinkoBoard';
import BetPanel from './components/BetPanel';
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
      cur.current += d * 0.15; setVal(cur.current);
      raf.current = requestAnimationFrame(go);
    };
    raf.current = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return val;
}

export interface BetResult { id: number; mult: number; profit: number; color: string }

export default function App() {
  const [balance, setBalance] = useState(10000);
  const [betAmount, setBetAmount] = useState(1);
  const [rows, setRows] = useState(16);
  const [risk, setRisk] = useState<RiskLevel>('high');
  const [isAuto, setIsAuto] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState(10);
  const [ballQueue, setBallQueue] = useState<number[]>([]);
  const [paths] = useState(() => new Map<number, number[]>());
  const [history, setHistory] = useState<BetResult[]>([]);

  const idRef = useRef(0);
  const nonceRef = useRef(0);
  const sSeed = useRef(randomHex(32));
  const cSeed = useRef(randomHex(16));
  const autoRef = useRef(false);
  const pending = useRef(new Map<number, number>());

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
    setHistory(p => [{ id: bid, mult: m, profit: pay - bet, color: getMultiplierColor(m) }, ...p].slice(0, 30));
  }, [risk, rows]);

  const onConsumed = useCallback((id: number) => setBallQueue(p => p.filter(x => x !== id)), []);

  const startAuto = useCallback(() => {
    autoRef.current = true; setIsAuto(true);
    let c = 0;
    const tick = () => {
      if (!autoRef.current || c >= autoBetCount) { autoRef.current = false; setIsAuto(false); return; }
      drop(); c++; setTimeout(tick, 400);
    };
    tick();
  }, [drop, autoBetCount]);

  const stopAuto = useCallback(() => { autoRef.current = false; setIsAuto(false); }, []);

  return (
    <div className="h-screen bg-[#000514] text-white flex flex-col select-none overflow-hidden">
      {/* Board — fills all available space */}
      <div className="flex-1 min-h-0 relative">
        <PlinkoBoard rows={rows} multipliers={mults} onBallLand={onLand}
          ballQueue={ballQueue} onBallConsumed={onConsumed} paths={paths} />

        {/* Recent results — floating top-right */}
        {history.length > 0 && (
          <div className="absolute top-4 right-4 flex gap-1.5 flex-wrap justify-end max-w-[280px]">
            {history.slice(0, 10).map((r, i) => (
              <div key={r.id}
                className={`h-7 px-2.5 rounded-lg text-xs font-bold tabular-nums flex items-center backdrop-blur-sm ${i === 0 ? 'anim-slide' : ''}`}
                style={{ background: `${r.color}18`, border: `1px solid ${r.color}25`, color: r.color }}>
                {r.mult}x
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls — bottom panel */}
      <div className="shrink-0 bg-[#0D0B18] border-t border-[#1A1726]">
        <BetPanel
          balance={dispBal}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          rows={rows}
          setRows={setRows}
          risk={risk}
          setRisk={setRisk}
          isAuto={isAuto}
          autoBetCount={autoBetCount}
          setAutoBetCount={setAutoBetCount}
          onDrop={drop}
          onStartAuto={startAuto}
          onStopAuto={stopAuto}
          canBet={balance >= betAmount && betAmount > 0}
        />
      </div>
    </div>
  );
}
