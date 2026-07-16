import { useState } from 'react';
import type { BetResult } from '../App';
import { fmt } from '../App';
import type { RiskLevel } from '../utils/multipliers';
import { sha256, randomHex } from '../utils/provablyFair';
import { MIN_BET, MAX_BET } from './SidePanel';

const CloseSVG = () => (
  <svg viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
);
const WinSVG = () => (
  <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#0ECC68"/></svg>
);
const LoseSVG = () => (
  <svg viewBox="0 0 24 24" fill="none"><path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="#F85F5D"/></svg>
);
const CopySVG = () => (
  <svg viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 11V3a2 2 0 012-2h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
);
const CheckSVG = () => (
  <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="#0ECC68" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

const PLINKO_OUTCOME_MAPPING = 'path = SHA-256(server:client:nonce) · bit i of hash → ball bounces left (0) or right (1) at row i';

interface DrawerShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function DrawerShell({ open, onClose, title, children, footer }: DrawerShellProps) {
  return (
    <div className={`drawer-backdrop${open ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <span className="drawer-title">{title}</span>
          <button className="drawer-close" onClick={onClose}><CloseSVG /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ===== GameInfoDrawer (How to Play) ===== */
export function InfoDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <DrawerShell open={open} onClose={onClose} title="How to Play">
      <div className="drw-text" style={{ marginBottom: 10 }}>
        Plinko is a game of pure chance: a ball drops through a pegboard and lands in a
        multiplier slot. The riskier the setting, the bigger the top prize.
      </div>
      <div className="drw-card">
        <div className="drw-stat-row"><span className="drw-stat-label">Min Bet</span><span className="drw-stat-value">{fmt(MIN_BET)}</span></div>
        <div className="drw-stat-row"><span className="drw-stat-label">Max Bet</span><span className="drw-stat-value">{fmt(MAX_BET)}</span></div>
        <div className="drw-stat-row"><span className="drw-stat-label">Rows</span><span className="drw-stat-value">8 – 16</span></div>
        <div className="drw-stat-row"><span className="drw-stat-label">Risk Levels</span><span className="drw-stat-value">Low · Medium · High</span></div>
        <div className="drw-stat-row"><span className="drw-stat-label">Max Multiplier</span><span className="drw-stat-value green">1000x</span></div>
      </div>
      <div className="drw-card">
        <div className="drw-card-title">Game Flow</div>
        <div className="drw-steps">
          <div className="drw-step"><div className="drw-step-num">1</div><div className="drw-step-text">Set your bet amount, pick a risk level and the number of rows.</div></div>
          <div className="drw-step-arrow"><div className="drw-step-arrow-line"></div></div>
          <div className="drw-step"><div className="drw-step-num">2</div><div className="drw-step-text">Press DROP BALL — the ball falls through the pegboard, bouncing left or right on every pin.</div></div>
          <div className="drw-step-arrow"><div className="drw-step-arrow-line"></div></div>
          <div className="drw-step"><div className="drw-step-num">3</div><div className="drw-step-text">The slot where the ball lands decides your multiplier. Edge slots pay the most.</div></div>
          <div className="drw-step-arrow"><div className="drw-step-arrow-line"></div></div>
          <div className="drw-step"><div className="drw-step-num">4</div><div className="drw-step-text">Use Auto Play to drop a series of balls automatically — stop any time.</div></div>
        </div>
      </div>
      <div className="drw-card">
        <div className="drw-card-title">Risk &amp; Rows</div>
        <div className="drw-text">
          <strong style={{ color: '#0ECC68' }}>Low risk</strong> pays small but often.{' '}
          <strong style={{ color: 'var(--accent)' }}>Medium</strong> balances both.{' '}
          <strong style={{ color: 'var(--red)' }}>High risk</strong> concentrates the payout in the rare edge slots.
          More rows mean more bounces — and steeper top multipliers.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <svg viewBox="0 0 20 20" fill="none" width="18" height="18" style={{ flexShrink: 0 }}><path d="M6.945 10L9.167 12.222 13.333 8.056M10 1.667L3.056 4.445v5c0 4 2.889 7.333 6.944 8.611 4.056-1.278 6.945-4.611 6.945-8.611v-5L10 1.667z" stroke="#4ADE80" strokeWidth="1.778" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <div className="drw-text" style={{ fontSize: 11 }}>
          This game uses <strong style={{ color: 'var(--text)' }}>Provably Fair</strong> technology — every drop path is derived from seeds committed before the ball falls.
        </div>
      </div>
    </DrawerShell>
  );
}

/* ===== PfDrawer (Provably Fair) ===== */
interface PfProps {
  open: boolean;
  onClose: () => void;
  serverSeed: string;
  clientSeed: string;
  setClientSeed: (v: string) => void;
  onRotate: () => string;
}

export function PfDrawer({ open, onClose, serverSeed, clientSeed, setClientSeed, onRotate }: PfProps) {
  const [tab, setTab] = useState<'overview' | 'seeds' | 'verify'>('overview');
  const [copied, setCopied] = useState<string | null>(null);
  const [seedHash, setSeedHash] = useState('');
  const [verifyServer, setVerifyServer] = useState('');
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean | null; hash: string } | null>(null);

  if (open && !seedHash) { void sha256(serverSeed).then(setSeedHash); }

  const handleCopy = (text: string, label: string) => {
    if (navigator.clipboard) void navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const doRotate = () => {
    const next = onRotate();
    void sha256(next).then(setSeedHash);
  };

  const doVerify = async () => {
    if (!verifyServer) return;
    const computed = await sha256(verifyServer);
    setVerifyResult({ ok: verifyHash ? computed === verifyHash : null, hash: computed });
  };

  return (
    <div className={`drawer-backdrop${open ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <span className="drawer-title">Provably Fair</span>
          <button className="drawer-close" onClick={onClose}><CloseSVG /></button>
        </div>
        <div className="drawer-tabs">
          {(['overview', 'seeds', 'verify'] as const).map(tb => (
            <button key={tb} className={`drawer-tab${tab === tb ? ' active' : ''}`} onClick={() => setTab(tb)}>
              {tb === 'overview' ? 'Overview' : tb === 'seeds' ? 'Seeds' : 'Verify'}
            </button>
          ))}
        </div>
        <div className="drawer-body">
          {tab === 'overview' && (
            <>
              <div className="drw-text" style={{ marginBottom: 10 }}>
                Every drop is generated with Provably Fair technology — the outcome is fixed
                by the seeds before the ball starts falling, and you can verify it afterwards.
              </div>
              <div className="drw-steps">
                <div className="drw-step"><div className="drw-step-num">1</div><div className="drw-step-text">The game commits to a secret server seed and shows you its SHA-256 hash.</div></div>
                <div className="drw-step-arrow"><div className="drw-step-arrow-line"></div></div>
                <div className="drw-step"><div className="drw-step-num">2</div><div className="drw-step-text">You control the client seed — change it any time.</div></div>
                <div className="drw-step-arrow"><div className="drw-step-arrow-line"></div></div>
                <div className="drw-step"><div className="drw-step-num">3</div><div className="drw-step-text">{PLINKO_OUTCOME_MAPPING}</div></div>
                <div className="drw-step-arrow"><div className="drw-step-arrow-line"></div></div>
                <div className="drw-step"><div className="drw-step-num">4</div><div className="drw-step-text">Rotate the seed to reveal the old one and verify its hash matches the commitment.</div></div>
              </div>
            </>
          )}
          {tab === 'seeds' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="drw-input">
                <div className="drw-input-text">
                  <span className="drw-input-label">Client Seed</span>
                  <input className="drw-input-value mono" type="text" value={clientSeed} onChange={e => setClientSeed(e.target.value)} />
                </div>
                <button className="drw-input-btn" onClick={() => handleCopy(clientSeed, 'client')}>{copied === 'client' ? <CheckSVG /> : <CopySVG />}</button>
                <button className="drw-input-btn" onClick={() => setClientSeed('plinko_' + randomHex(6))}>R</button>
              </div>
              <div className="drw-input">
                <div className="drw-input-text">
                  <span className="drw-input-label">Server Seed SHA256</span>
                  <div className="drw-input-value mono green" style={{ wordBreak: 'break-all', fontSize: 11 }}>{seedHash || '…'}</div>
                </div>
                <button className="drw-input-btn" onClick={() => handleCopy(seedHash, 'hash')}>{copied === 'hash' ? <CheckSVG /> : <CopySVG />}</button>
              </div>
              <button className="drw-save-btn" style={{ background: 'transparent', border: '1px solid var(--toggle-border)' }} onClick={doRotate}>Rotate Seed</button>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                The hash is committed before you bet. Rotating reveals the current server seed
                (shown below for this demo) and commits a fresh one.
              </div>
              <div className="drw-input">
                <div className="drw-input-text">
                  <span className="drw-input-label">Server Seed (revealed — demo mode)</span>
                  <div className="drw-input-value mono" style={{ wordBreak: 'break-all', fontSize: 11 }}>{serverSeed}</div>
                </div>
                <button className="drw-input-btn" onClick={() => handleCopy(serverSeed, 'server')}>{copied === 'server' ? <CheckSVG /> : <CopySVG />}</button>
              </div>
            </div>
          )}
          {tab === 'verify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="drw-text" style={{ marginBottom: 4 }}>Paste a server seed and its expected hash to check the commitment.</div>
              <div className="drw-input">
                <div className="drw-input-text">
                  <span className="drw-input-label">Server Seed</span>
                  <input className="drw-input-value mono" type="text" value={verifyServer} onChange={e => setVerifyServer(e.target.value)} placeholder="paste server seed" />
                </div>
              </div>
              <div className="drw-input">
                <div className="drw-input-text">
                  <span className="drw-input-label">Seed Hash (expected)</span>
                  <input className="drw-input-value mono" type="text" value={verifyHash} onChange={e => setVerifyHash(e.target.value)} placeholder="paste seed hash" />
                </div>
              </div>
              <button className="drw-save-btn" onClick={() => { void doVerify(); }}>Verify</button>
              {verifyResult && (
                <div style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: verifyResult.ok === true ? 'var(--green-bg)' : verifyResult.ok === false ? 'var(--red-bg)' : 'rgba(0,0,0,0.2)',
                  border: '1px solid ' + (verifyResult.ok === true ? 'rgba(14,204,104,0.3)' : verifyResult.ok === false ? 'rgba(248,95,93,0.3)' : 'var(--toggle-border)'),
                }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: verifyResult.ok === true ? 'var(--green)' : verifyResult.ok === false ? 'var(--red)' : 'var(--text-75)' }}>
                    {verifyResult.ok === true ? 'Verified — hashes match' : verifyResult.ok === false ? 'Mismatch' : 'SHA-256 computed'}
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 10, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '.04em' }}>SHA-256 of server seed</div>
                    <div style={{ fontSize: 10, wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.4 }}>{verifyResult.hash}</div>
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 10, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '.04em' }}>Outcome mapping</div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--accent)', marginTop: 2, wordBreak: 'break-all' }}>{PLINKO_OUTCOME_MAPPING}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== HistoryDrawer ===== */
export function HistoryDrawer({ open, onClose, rounds }: { open: boolean; onClose: () => void; rounds: BetResult[] }) {
  return (
    <DrawerShell open={open} onClose={onClose} title="History">
      {rounds.length === 0 && <div className="hist-empty">No rounds played yet</div>}
      {rounds.length > 0 && (
        <div className="hist-list">
          {rounds.map(r => {
            const isWin = r.profit >= 0;
            const time = new Date(r.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={r.id} className="hist-item">
                <div className="hist-header">
                  <div className="hist-left">
                    <div className={`hist-icon ${isWin ? 'hist-icon-win' : 'hist-icon-lose'}`}>{isWin ? <WinSVG /> : <LoseSVG />}</div>
                    <div className="hist-info">
                      <span className="hist-info-title">{isWin ? 'Win' : 'Lose'}</span>
                      <span className="hist-info-sub">{fmt(r.bet)} &middot; {time} &middot; #{r.nonce}</span>
                    </div>
                  </div>
                  <div className="hist-right">
                    <div className="hist-chips">
                      <span className="hist-mult-chip">{r.mult.toFixed(2)}x</span>
                      <span className={`hist-payout-chip ${isWin ? 'hist-payout-chip--win' : 'hist-payout-chip--lose'}`}>
                        {isWin ? '+ ' : '- '}{fmt(Math.abs(r.profit))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DrawerShell>
  );
}

/* ===== AutoDrawer (Auto Play settings — limbo parity) ===== */
interface AutoProps {
  open: boolean;
  onClose: () => void;
  autoRounds: string;
  setAutoRounds: (v: string) => void;
  bet: number;
  rows: number;
  risk: RiskLevel;
  autoRunning: boolean;
  onStart: () => void;
}

export function AutoDrawer({ open, onClose, autoRounds, setAutoRounds, bet, rows, risk, autoRunning, onStart }: AutoProps) {
  const unlimited = autoRounds === '0';
  const rounds = unlimited ? '∞' : String(parseInt(autoRounds) || 10);
  const stepRounds = (dir: 1 | -1) => {
    if (unlimited) { setAutoRounds(dir === 1 ? '10' : '1000'); return; }
    const v = parseInt(autoRounds) || 10;
    setAutoRounds(String(Math.max(1, Math.min(1000, v + dir * (v < 10 ? 1 : 10)))));
  };
  return (
    <DrawerShell
      open={open} onClose={onClose} title="Auto Play"
      footer={
        <button className="place-btn auto-drawer-start" onClick={() => { onClose(); onStart(); }} disabled={autoRunning}>
          Start Auto Play
        </button>
      }
    >
      <div className="drw-text" style={{ marginBottom: 12 }}>
        Auto Play drops one ball per round with your current bet, risk and rows.
        Press STOP AUTO at any time to end the run.
      </div>
      <div className="field">
        <span className="risk-label">Number of Rounds</span>
        <div className="stake-input">
          <button className="stake-pm" onClick={() => stepRounds(-1)}>−</button>
          {unlimited
            ? <span className="stake-amount stake-amount--inf" title="Unlimited — runs until you press Stop">∞</span>
            : <input className="stake-amount" type="number" value={autoRounds} onChange={e => setAutoRounds(e.target.value)} min={1} max={1000} step={1} />}
          <button className="stake-pm" onClick={() => stepRounds(1)}>+</button>
        </div>
        <div className="stake-chips auto-rounds-chips">
          <button className={`stake-chip${autoRounds === '10' ? ' active' : ''}`} onClick={() => setAutoRounds('10')}>10</button>
          <button className={`stake-chip${autoRounds === '50' ? ' active' : ''}`} onClick={() => setAutoRounds('50')}>50</button>
          <button className={`stake-chip${autoRounds === '100' ? ' active' : ''}`} onClick={() => setAutoRounds('100')}>100</button>
          <button className={`stake-chip stake-chip--inf${unlimited ? ' active' : ''}`} onClick={() => setAutoRounds('0')} aria-label="Unlimited" title="Unlimited">∞</button>
        </div>
      </div>
      <div className="drw-card" style={{ marginTop: 12 }}>
        <div className="drw-stat-row"><span className="drw-stat-label">Bet</span><span className="drw-stat-value">{fmt(bet)}</span></div>
        <div className="drw-stat-row"><span className="drw-stat-label">Risk</span><span className="drw-stat-value" style={{ textTransform: 'capitalize' }}>{risk}</span></div>
        <div className="drw-stat-row"><span className="drw-stat-label">Rows</span><span className="drw-stat-value">{rows}</span></div>
        <div className="drw-stat-row"><span className="drw-stat-label">Rounds</span><span className="drw-stat-value">{rounds}</span></div>
      </div>
    </DrawerShell>
  );
}
