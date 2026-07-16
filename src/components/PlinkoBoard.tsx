import { useRef, useEffect, useCallback, useState } from 'react';
import { getBucketColor, slotProbability } from '../utils/multipliers';
import { getGeometry, bucketAt } from '../game/geometry';
import type { BoardGeometry } from '../game/geometry';
import {
  drawEntryHole, drawPinGlows, drawPins, drawBuckets, drawParticles,
  drawBall, drawWinPopups, spawnWinParticles,
} from '../game/render';
import type { PinGlow, TrailDot, WinPopup, Particle } from '../game/render';
import { sound } from '../utils/sound';

interface QueuedBall { id: number; instant: boolean }

interface PlinkoBoardProps {
  rows: number;
  multipliers: number[];
  bet: number;
  onBallLand: (ballId: number) => void;
  ballQueue: QueuedBall[];
  onBallConsumed: (id: number) => void;
  paths: Map<number, number[]>;
}

// The ball is a scripted animation along the seed-derived path — the exact
// approach production plinkos use. Every bounce follows dirs[], so the ball
// lands in the paying bucket by construction; physics cannot disagree with
// the payout because there is no physics in the outcome path.
interface ActiveBall {
  dirs: number[];
  targetSlot: number;
  seg: number;          // current segment (0 = spawn→first pin)
  segStart: number;     // timestamp when this segment began
  segDur: number;       // per-segment duration with a little variance
  jitter: number;       // small per-ball horizontal offset for life
  x: number;
  y: number;
  trail: TrailDot[];
  done: boolean;
}

const HOP_MS = 118;        // per-row hop duration
const FIRST_DROP_MS = 200; // spawn → first pin
const FINAL_DROP_MS = 210; // last pin → bucket

// Pin the ball bounces on at row r: column = 1 + rights among dirs[0..r-1].
function bouncePin(geo: BoardGeometry, w: number, dirs: number[], r: number) {
  let rights = 0;
  for (let i = 0; i < r; i++) rights += dirs[i];
  const col = 1 + rights;
  const sx = (w - (r + 2) * geo.gap) / 2;
  return { x: sx + col * geo.gap, y: geo.startY + r * geo.gap };
}

function bucketCenterX(geo: BoardGeometry, slot: number) {
  return geo.bucketLeftX + (slot + 0.5) * geo.gap;
}

export default function PlinkoBoard({
  rows, multipliers, bet, onBallLand, ballQueue, onBallConsumed, paths,
}: PlinkoBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderLoopRef = useRef<number>(0);
  const activeBallsRef = useRef<Map<number, ActiveBall>>(new Map());
  const flashRef = useRef<Map<number, number>>(new Map());
  const sizeRef = useRef({ w: 0, h: 0 });
  const spawnedRef = useRef<Set<number>>(new Set());
  const pinGlowsRef = useRef<PinGlow[]>([]);
  const winPopupsRef = useRef<WinPopup[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; slot: number } | null>(null);

  const geometry = useCallback(
    (w: number, h: number): BoardGeometry => getGeometry(w, h, rows),
    [rows],
  );

  // Reset transient state when the board shape changes
  useEffect(() => {
    activeBallsRef.current.clear();
    spawnedRef.current.clear();
    pinGlowsRef.current = [];
    winPopupsRef.current = [];
    particlesRef.current = [];
    flashRef.current.clear();
  }, [rows]);

  // Resize — observe the parent element, not just the window, so any layout
  // change around the board (drawers, bars, font loading) re-measures the
  // canvas instead of shifting it.
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    window.addEventListener('resize', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  const settle = useCallback((id: number, targetSlot: number) => {
    const { w, h } = sizeRef.current;
    const geo = geometry(w, h);
    const numBuckets = multipliers.length;
    const now = Date.now();
    flashRef.current.set(targetSlot, now);
    const mult = multipliers[targetSlot] || 0;
    const color = getBucketColor(targetSlot, numBuckets);
    const popupX = bucketCenterX(geo, targetSlot);
    const bucketTopY = geo.bucketTopY;
    winPopupsRef.current.push({ x: popupX, y: bucketTopY - 10, mult, time: now, color });
    spawnWinParticles(particlesRef.current, popupX, bucketTopY, mult, color);
    onBallLand(id);
  }, [geometry, multipliers, onBallLand]);

  // Spawn queued balls (idempotent — StrictMode re-runs effects in dev)
  useEffect(() => {
    if (ballQueue.length === 0) return;
    const { w, h } = sizeRef.current;
    const geo = geometry(w, h);

    ballQueue.forEach(({ id, instant }) => {
      if (spawnedRef.current.has(id)) return;
      spawnedRef.current.add(id);
      const dirs = paths.get(id) || [];
      const targetSlot = dirs.reduce((a, b) => a + b, 0);

      // Instant Bet: no animation — flash the bucket and settle immediately.
      if (instant) {
        settle(id, targetSlot);
        onBallConsumed(id);
        return;
      }

      activeBallsRef.current.set(id, {
        dirs, targetSlot,
        seg: 0, segStart: performance.now(),
        segDur: FIRST_DROP_MS,
        jitter: (Math.random() - 0.5) * geo.gap * 0.14,
        x: w / 2, y: geo.startY - 24,
        trail: [], done: false,
      });
      onBallConsumed(id);
      sound.drop();
    });
  }, [ballQueue, paths, geometry, settle, onBallConsumed]);

  // Render loop — advances every ball along its scripted path and draws
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = (ts: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h); // transparent — the CSS scene shows through

      const geo = geometry(w, h);
      const { gap, startY, pinR, ballR } = geo;
      const now = Date.now();
      const bucketTopY = geo.bucketTopY;

      drawEntryHole(ctx, geo, w);
      pinGlowsRef.current = pinGlowsRef.current.filter(g => now - g.time < 250);
      drawPinGlows(ctx, pinGlowsRef.current, pinR, now);
      drawPins(ctx, geo, pinGlowsRef.current);
      drawBuckets(ctx, geo, multipliers, flashRef.current, tooltip?.slot ?? null, now);

      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      drawParticles(ctx, particlesRef.current);

      // Advance and draw balls. Segments: 0 = spawn→pin(row 0);
      // 1..rows-1 = pin(r-1)→pin(r); rows = pin(rows-1)→bucket.
      const finished: number[] = [];
      activeBallsRef.current.forEach((ball, id) => {
        const totalSegs = ball.dirs.length + 1;
        let t = (ts - ball.segStart) / ball.segDur;

        while (t >= 1 && ball.seg < totalSegs) {
          // Segment completed — bounce event or landing
          if (ball.seg < ball.dirs.length) {
            const pin = bouncePin(geo, w, ball.dirs, ball.seg);
            pinGlowsRef.current.push({ x: pin.x, y: pin.y, time: now });
            sound.pinHit(ball.seg / ball.dirs.length);
          }
          ball.segStart += ball.segDur;
          ball.seg += 1;
          ball.segDur = ball.seg === totalSegs ? FINAL_DROP_MS : HOP_MS * (0.92 + Math.random() * 0.16);
          if (ball.seg >= totalSegs) {
            ball.done = true;
            settle(id, ball.targetSlot);
            finished.push(id);
            break;
          }
          t = (ts - ball.segStart) / ball.segDur;
        }
        if (ball.done) return;

        t = Math.max(0, Math.min(1, t));

        // Endpoints of the current segment
        let x0: number, y0: number, x1: number, y1: number, arc: number;
        if (ball.seg === 0) {
          x0 = w / 2 + ball.jitter; y0 = startY - 24;
          const p = bouncePin(geo, w, ball.dirs, 0);
          x1 = p.x; y1 = p.y - ballR - pinR;
          arc = 0;
        } else if (ball.seg < ball.dirs.length) {
          const a = bouncePin(geo, w, ball.dirs, ball.seg - 1);
          const b = bouncePin(geo, w, ball.dirs, ball.seg);
          x0 = a.x; y0 = a.y - ballR - pinR;
          x1 = b.x; y1 = b.y - ballR - pinR;
          arc = gap * 0.38;
        } else {
          const a = bouncePin(geo, w, ball.dirs, ball.dirs.length - 1);
          x0 = a.x; y0 = a.y - ballR - pinR;
          x1 = bucketCenterX(geo, ball.targetSlot) + ball.jitter * 0.5;
          y1 = bucketTopY + 10;
          arc = gap * 0.3;
        }

        // Parabolic hop: rise off the pin, then fall to the next
        const ease = t * t; // accelerate downward like gravity
        ball.x = x0 + (x1 - x0) * t;
        ball.y = y0 + (y1 - y0) * ease - Math.sin(Math.PI * t) * arc;

        ball.trail.push({ x: ball.x, y: ball.y, time: now });
        while (ball.trail.length > 10) ball.trail.shift();
        drawBall(ctx, ball.x, ball.y, ballR, ball.trail, now);
      });
      finished.forEach(id => activeBallsRef.current.delete(id));

      winPopupsRef.current = winPopupsRef.current.filter(p => now - p.time < 1400);
      drawWinPopups(ctx, winPopupsRef.current, now);

      flashRef.current.forEach((time, idx) => {
        if (now - time > 600) flashRef.current.delete(idx);
      });

      renderLoopRef.current = requestAnimationFrame(frame);
    };

    renderLoopRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(renderLoopRef.current);
  }, [rows, multipliers, geometry, settle, tooltip]);

  // Bucket hover tooltip (Stake shows odds/payout on hover)
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const geo = geometry(rect.width, rect.height);
    const slot = bucketAt(geo, multipliers.length, x, y);
    setTooltip(prev => {
      if (slot == null) return prev == null ? prev : null;
      if (prev && prev.slot === slot && Math.abs(prev.x - x) < 4) return prev;
      return { x, y, slot };
    });
  }, [geometry, multipliers.length]);

  const tooltipData = tooltip == null ? null : {
    mult: multipliers[tooltip.slot] ?? 0,
    prob: slotProbability(rows, tooltip.slot) * 100,
    color: getBucketColor(tooltip.slot, multipliers.length),
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={onMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && tooltipData && (
        <div className="bucket-tooltip" style={{ left: tooltip.x, top: tooltip.y - 14 }}>
          <div className="bt-row"><span>Payout</span><b style={{ color: tooltipData.color }}>{tooltipData.mult}x</b></div>
          <div className="bt-row"><span>Profit on win</span><b>{'$' + Math.max(0, +(bet * tooltipData.mult - bet).toFixed(2)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</b></div>
          <div className="bt-row"><span>Chance</span><b>{tooltipData.prob < 0.01 ? tooltipData.prob.toFixed(4) : tooltipData.prob.toFixed(2)}%</b></div>
        </div>
      )}
    </div>
  );
}
