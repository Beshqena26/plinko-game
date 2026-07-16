interface Props {
  open: boolean;
  onClose: () => void;
  fmt: (n: number) => string;
}

const card = 'bg-[var(--board)] border border-[var(--hairline)] rounded-xl p-3.5 flex flex-col gap-2';
const statRow = 'flex items-center justify-between text-[12px]';
const statLabel = 'text-[var(--text-mid)] font-medium';
const statValue = 'font-bold text-white mono';

const STEPS = [
  'Set your bet amount, pick a risk level and the number of rows.',
  'Press DROP BALL — the ball falls through the pegboard, bouncing left or right on every pin.',
  'The slot where the ball lands decides your multiplier. Edge slots pay the most.',
  'Use AUTO mode to drop a series of balls automatically — stop any time.',
];

export default function InfoDrawer({ open, onClose, fmt }: Props) {
  return (
    <div className={`drawer-backdrop${open ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="h-[54px] shrink-0 flex items-center justify-between px-4 border-b border-[var(--hairline)]">
          <span className="text-[15px] font-extrabold tracking-wide">How to Play</span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--toggle-border)] text-[var(--text-mid)] hover:text-white transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <p className="text-[12px] leading-relaxed text-[var(--text-75)]">
            Plinko is a game of pure chance. A ball drops from the top of a pegboard
            and bounces its way down into one of the multiplier slots. The riskier
            the setting, the bigger the top prize — up to <b className="text-[var(--accent)]">1000x</b> your bet.
          </p>

          <div className={card}>
            <div className={statRow}><span className={statLabel}>Min Bet</span><span className={statValue}>{fmt(0.1)}</span></div>
            <div className={statRow}><span className={statLabel}>Max Bet</span><span className={statValue}>{fmt(1000)}</span></div>
            <div className={statRow}><span className={statLabel}>Rows</span><span className={statValue}>8 – 16</span></div>
            <div className={statRow}><span className={statLabel}>Risk Levels</span><span className={statValue}>Low · Medium · High</span></div>
            <div className={statRow}><span className={statLabel}>Max Multiplier</span><span className={`${statValue} text-[var(--green)]`}>1000x</span></div>
          </div>

          <div className={card}>
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--text-mid)]">Game Flow</span>
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 shrink-0 rounded-full bg-[var(--accent-glow)] border border-[var(--accent-border)] text-[var(--accent)] text-[10px] font-extrabold flex items-center justify-center mt-px">
                  {i + 1}
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--text-75)]">{s}</p>
              </div>
            ))}
          </div>

          <div className={card}>
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--text-mid)]">Risk & Rows</span>
            <p className="text-[12px] leading-relaxed text-[var(--text-75)]">
              <b className="text-[#0ECC68]">Low risk</b> pays small but often.{' '}
              <b className="text-[var(--accent)]">Medium</b> balances both.{' '}
              <b className="text-[#F85F5D]">High risk</b> concentrates the payout in the rare edge slots.
              More rows mean more bounces — and steeper top multipliers.
            </p>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <svg viewBox="0 0 20 20" fill="none" width="18" height="18" className="shrink-0">
              <path d="M6.945 10L9.167 12.222 13.333 8.056M10 1.667L3.056 4.445v5c0 4 2.889 7.333 6.944 8.611 4.056-1.278 6.945-4.611 6.945-8.611v-5L10 1.667z" stroke="#0ECC68" strokeWidth="1.778" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[11px] leading-relaxed text-[var(--text-75)]">
              Every drop path is generated with <b className="text-white">provably fair</b> HMAC-SHA256 seeds — the outcome is decided before the ball starts falling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
