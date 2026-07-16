import { useState, useCallback, useRef } from 'react';
import PlinkoBoard from './components/PlinkoBoard';
import BetPanel from './components/BetPanel';
import InfoDrawer from './components/InfoDrawer';
import type { RiskLevel } from './utils/multipliers';
import { getMultipliers, getMultiplierColor } from './utils/multipliers';
import { getPath, randomHex } from './utils/provablyFair';
import { sound } from './utils/sound';

export interface BetResult { id: number; mult: number; profit: number; color: string }

const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function App() {
  const [balance, setBalance] = useState(10000);
  const [betAmount, setBetAmount] = useState(1);
  const [rows, setRows] = useState(16);
  const [risk, setRisk] = useState<RiskLevel>('high');
  const [isAuto, setIsAuto] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState(10); // 0 = unlimited
  const [autoPlayed, setAutoPlayed] = useState(0);
  const [ballQueue, setBallQueue] = useState<number[]>([]);
  const [paths] = useState(() => new Map<number, number[]>());
  const [history, setHistory] = useState<BetResult[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const idRef = useRef(0);
  const nonceRef = useRef(0);
  const sSeed = useRef(randomHex(32));
  const cSeed = useRef(randomHex(16));
  const autoRef = useRef(false);
  const pending = useRef(new Map<number, number>());
  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  const mults = getMultipliers(risk, rows);

  const drop = useCallback(async () => {
    if (balanceRef.current < betAmount || betAmount <= 0) return false;
    setBalance(p => p - betAmount);
    const id = ++idRef.current;
    const dirs = await getPath(sSeed.current, cSeed.current, ++nonceRef.current, rows);
    paths.set(id, dirs);
    pending.current.set(id, betAmount);
    setBallQueue(p => [...p, id]);
    return true;
  }, [betAmount, rows, paths]);

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
    autoRef.current = true; setIsAuto(true); setAutoPlayed(0);
    const total = autoBetCount || Infinity;
    let c = 0;
    const tick = async () => {
      if (!autoRef.current || c >= total) { autoRef.current = false; setIsAuto(false); return; }
      const ok = await drop();
      if (!ok) { autoRef.current = false; setIsAuto(false); return; }
      c++; setAutoPlayed(c);
      setTimeout(tick, 400);
    };
    tick();
  }, [drop, autoBetCount]);

  const stopAuto = useCallback(() => { autoRef.current = false; setIsAuto(false); }, []);

  return (
    <div className="h-dvh flex flex-col select-none overflow-hidden bg-[var(--board)] text-white">
      {/* ===== Header (RGS parity) ===== */}
      <header className="h-[50px] shrink-0 flex items-center justify-between px-5 max-[560px]:px-3 bg-[var(--panel)] border-b border-[var(--hairline)] z-10">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[var(--accent)]">
            <circle cx="12" cy="4" r="2.2" fill="currentColor" />
            <circle cx="8" cy="11" r="1.4" fill="currentColor" opacity="0.65" />
            <circle cx="16" cy="11" r="1.4" fill="currentColor" opacity="0.65" />
            <circle cx="4.5" cy="18" r="1.4" fill="currentColor" opacity="0.4" />
            <circle cx="12" cy="18" r="1.4" fill="currentColor" opacity="0.4" />
            <circle cx="19.5" cy="18" r="1.4" fill="currentColor" opacity="0.4" />
          </svg>
          <span className="text-[14px] font-bold tracking-[0.02em]">Plinko</span>
        </div>

        <div className="flex items-center gap-1 ml-auto mr-2">
          <span className="text-[14px] font-bold text-[var(--accent)]">$</span>
          <span className="text-[14px] font-bold mono">{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSoundOn(sound.toggle())}
            title="Sound"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--toggle-border)] text-[var(--text-mid)] hover:text-white hover:border-[var(--accent-border)] hover:bg-white/[0.04] transition-all"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {soundOn && <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />}
            </svg>
          </button>
          <button
            onClick={() => setInfoOpen(true)}
            title="How to Play"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--toggle-border)] text-[var(--text-mid)] text-[13px] font-bold hover:text-white hover:border-[var(--accent-border)] hover:bg-white/[0.04] transition-all"
          >i</button>
        </div>
      </header>

      {/* ===== Row: side controls + board ===== */}
      <div className="flex flex-1 min-h-0 overflow-hidden max-[860px]:flex-col">
        <aside className="w-[340px] shrink-0 bg-[var(--panel)] border-r border-[var(--hairline)] p-4 flex flex-col gap-2.5 overflow-y-auto
          max-[1168px]:w-[300px]
          max-[860px]:order-2 max-[860px]:w-full max-[860px]:border-r-0 max-[860px]:border-t max-[860px]:border-[var(--hairline)] max-[860px]:px-3.5 max-[860px]:py-2.5 max-[860px]:gap-2 max-[860px]:overflow-visible">
          <BetPanel
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
            autoPlayed={autoPlayed}
            onDrop={() => { void drop(); }}
            onStartAuto={startAuto}
            onStopAuto={stopAuto}
            canBet={balance >= betAmount && betAmount > 0}
          />
        </aside>

        <main className="flex-1 min-w-0 min-h-0 flex flex-col max-[860px]:order-1">
          {/* Recent results strip (limbo/hilo history-bar parity) */}
          <div className="h-11 shrink-0 flex items-center gap-1.5 px-4 overflow-x-auto max-[560px]:h-9 max-[560px]:px-2">
            {history.length === 0 ? (
              <span className="text-[11px] text-[var(--text-dim)] font-semibold uppercase tracking-wide">No results yet</span>
            ) : history.map((r, i) => (
              <div
                key={r.id}
                className={`h-6 px-2 shrink-0 rounded-md text-[11px] font-bold mono flex items-center ${i === 0 ? 'anim-slide' : ''}`}
                style={{ background: `${r.color}1e`, color: r.color, border: `1px solid ${r.color}30` }}
              >
                {r.mult}x
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            <PlinkoBoard rows={rows} multipliers={mults} onBallLand={onLand}
              ballQueue={ballQueue} onBallConsumed={onConsumed} paths={paths} />
          </div>
        </main>
      </div>

      <InfoDrawer open={infoOpen} onClose={() => setInfoOpen(false)} fmt={fmt} />
    </div>
  );
}
