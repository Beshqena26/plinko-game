import { useRef, useEffect, useCallback, useState } from 'react';
import Matter from 'matter-js';
import { getBucketColor, slotProbability } from '../utils/multipliers';
import { getGeometry, bucketAt } from '../game/geometry';
import type { BoardGeometry } from '../game/geometry';
import {
  drawBackground, drawPinGlows, drawPins, drawBuckets, drawParticles,
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

interface ActiveBall {
  body: Matter.Body;
  row: number;
  dirs: number[];
  targetSlot: number;
  trail: TrailDot[];
  stuck: number;
}

const PHYSICS_STEP = 1000 / 60; // fixed timestep, decoupled from display refresh
const TIME_SCALE = 1.35;

export default function PlinkoBoard({
  rows, multipliers, bet, onBallLand, ballQueue, onBallConsumed, paths,
}: PlinkoBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderLoopRef = useRef<number>(0);
  const activeBallsRef = useRef<Map<number, ActiveBall>>(new Map());
  const flashRef = useRef<Map<number, number>>(new Map());
  const sizeRef = useRef({ w: 0, h: 0 });
  const landedRef = useRef<Set<number>>(new Set());
  const spawnedRef = useRef<Set<number>>(new Set());
  const pinGlowsRef = useRef<PinGlow[]>([]);
  const winPopupsRef = useRef<WinPopup[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lastTsRef = useRef(0);
  const accRef = useRef(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; slot: number } | null>(null);

  const geometry = useCallback(
    (w: number, h: number): BoardGeometry => getGeometry(w, h, rows),
    [rows],
  );

  // Engine (physics is stepped inside the render loop for perfect sync)
  useEffect(() => {
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.5, scale: 0.001 } });
    engine.timing.timeScale = TIME_SCALE;
    engineRef.current = engine;
    return () => {
      Matter.Engine.clear(engine);
      engineRef.current = null;
    };
  }, []);

  // Build world
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    Matter.Composite.clear(engine.world, false);
    activeBallsRef.current.clear();
    landedRef.current.clear();
    spawnedRef.current.clear();
    pinGlowsRef.current = [];
    winPopupsRef.current = [];
    particlesRef.current = [];

    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    sizeRef.current = { w, h };
    const geo = geometry(w, h);
    const { pins, endY, gap, topLeftX, topRightX, bottomLeftX, bottomRightX, startY, pinR, ballR } = geo;

    pins.forEach(p => {
      Matter.Composite.add(engine.world,
        Matter.Bodies.circle(p.x, p.y, pinR + 1, {
          isStatic: true, restitution: 0.5, friction: 0.0, label: `pin-${p.row}-${p.col}`,
        })
      );
    });

    // Angled boundary walls along the triangle edges
    const wallPadding = ballR + 5;
    const wallThickness = 10;
    const leftWallLen = Math.sqrt((bottomLeftX - topLeftX) ** 2 + (endY - startY) ** 2) + gap;
    const leftWallAngle = Math.atan2(endY - startY, (bottomLeftX - wallPadding) - (topLeftX - wallPadding));
    const leftWallCx = ((topLeftX - wallPadding) + (bottomLeftX - wallPadding)) / 2;
    const leftWallCy = (startY - gap / 2 + endY + gap / 2) / 2;
    Matter.Composite.add(engine.world,
      Matter.Bodies.rectangle(leftWallCx, leftWallCy, leftWallLen, wallThickness, {
        isStatic: true, angle: leftWallAngle, restitution: 0.3, label: 'wallL',
      })
    );
    const rightWallAngle = Math.atan2(endY - startY, (bottomRightX + wallPadding) - (topRightX + wallPadding));
    const rightWallCx = ((topRightX + wallPadding) + (bottomRightX + wallPadding)) / 2;
    Matter.Composite.add(engine.world,
      Matter.Bodies.rectangle(rightWallCx, leftWallCy, leftWallLen, wallThickness, {
        isStatic: true, angle: rightWallAngle, restitution: 0.3, label: 'wallR',
      })
    );

    // Thick floor: a thin one can be tunneled through at high speed.
    const bucketY = endY + gap * 0.65;
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(w / 2, bucketY + 60, w * 2, 64, { isStatic: true, label: 'floor', restitution: 0.1 }),
    ]);

    // Bucket dividers
    const numBuckets = rows + 1;
    const bw = (bottomRightX - bottomLeftX) / numBuckets;
    for (let i = 0; i <= numBuckets; i++) {
      Matter.Composite.add(engine.world,
        Matter.Bodies.rectangle(bottomLeftX + i * bw, bucketY + 8, 3, 36, {
          isStatic: true, restitution: 0.2, label: 'divider',
        })
      );
    }
  }, [rows, geometry]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Collisions: pin deflection along the seed path + floor landing
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const handler = (event: Matter.IEventCollision<Matter.Engine>) => {
      event.pairs.forEach(pair => {
        const { bodyA, bodyB } = pair;
        const ball = bodyA.label.startsWith('ball-') ? bodyA : bodyB.label.startsWith('ball-') ? bodyB : null;
        const pin = bodyA.label.startsWith('pin-') ? bodyA : bodyB.label.startsWith('pin-') ? bodyB : null;

        if (ball && pin) {
          const ballId = parseInt(ball.label.split('-')[1]);
          const pinRow = parseInt(pin.label.split('-')[1]);
          const info = activeBallsRef.current.get(ballId);
          if (!info || pinRow < info.row) return;

          const dir = info.dirs[pinRow] ?? (Math.random() > 0.5 ? 1 : 0);
          info.row = pinRow + 1;
          sound.pinHit(pinRow / rows);
          pinGlowsRef.current.push({ x: pin.position.x, y: pin.position.y, time: Date.now() });

          const hSpeed = Math.max(1.6, Math.abs(ball.velocity.y) * 0.5);
          Matter.Body.setVelocity(ball, {
            x: dir === 1 ? hSpeed : -hSpeed,
            y: Math.max(1.8, ball.velocity.y * 0.45),
          });
        }

        if (ball && (bodyA.label === 'floor' || bodyB.label === 'floor')) {
          const ballId = parseInt(ball.label.split('-')[1]);
          if (landedRef.current.has(ballId)) return;
          landedRef.current.add(ballId);

          const { w, h } = sizeRef.current;
          const geo = geometry(w, h);
          const numBuckets = rows + 1;
          const bw = (geo.bottomRightX - geo.bottomLeftX) / numBuckets;

          // The seed-derived slot is the authority; the funnel lands the ball
          // there, so flash/popup use it too.
          const info = activeBallsRef.current.get(ballId);
          const slot = info
            ? info.targetSlot
            : Math.max(0, Math.min(numBuckets - 1, Math.floor((ball.position.x - geo.bottomLeftX) / bw)));

          const now = Date.now();
          flashRef.current.set(slot, now);
          const mult = multipliers[slot] || 0;
          const color = getBucketColor(slot, numBuckets);
          const popupX = geo.bottomLeftX + (slot + 0.5) * bw;
          const bucketTopY = geo.endY + geo.gap * 0.3;
          winPopupsRef.current.push({ x: popupX, y: bucketTopY - 10, mult, time: now, color });
          spawnWinParticles(particlesRef.current, popupX, bucketTopY, mult, color);

          onBallLand(ballId);
          setTimeout(() => {
            if (engineRef.current) Matter.Composite.remove(engineRef.current.world, ball);
            activeBallsRef.current.delete(ballId);
          }, 150);
        }
      });
    };

    Matter.Events.on(engine, 'collisionStart', handler);
    return () => Matter.Events.off(engine, 'collisionStart', handler);
  }, [rows, multipliers, onBallLand, geometry]);

  // Spawn queued balls (idempotent — StrictMode re-runs effects in dev)
  useEffect(() => {
    if (ballQueue.length === 0) return;
    const engine = engineRef.current;
    if (!engine) return;
    const { w, h } = sizeRef.current;
    const geo = geometry(w, h);
    const { startY, ballR, endY, gap, bottomLeftX, bottomRightX } = geo;

    ballQueue.forEach(({ id, instant }) => {
      if (spawnedRef.current.has(id)) return;
      spawnedRef.current.add(id);
      const dirs = paths.get(id) || [];
      const targetSlot = dirs.reduce((a, b) => a + b, 0);

      // Instant Bet: no physics — flash the bucket and settle immediately.
      if (instant) {
        if (!landedRef.current.has(id)) {
          landedRef.current.add(id);
          const numBuckets = multipliers.length;
          const bw = (bottomRightX - bottomLeftX) / numBuckets;
          const now = Date.now();
          flashRef.current.set(targetSlot, now);
          const mult = multipliers[targetSlot] || 0;
          const color = getBucketColor(targetSlot, numBuckets);
          const popupX = bottomLeftX + (targetSlot + 0.5) * bw;
          winPopupsRef.current.push({ x: popupX, y: endY + gap * 0.3 - 10, mult, time: now, color });
          spawnWinParticles(particlesRef.current, popupX, endY + gap * 0.3, mult, color);
          onBallLand(id);
        }
        onBallConsumed(id);
        return;
      }

      const ball = Matter.Bodies.circle(
        w / 2 + (Math.random() - 0.5) * 4,
        startY - 20,
        ballR,
        {
          restitution: 0.4, friction: 0.05, density: 0.003, label: `ball-${id}`,
          // Stake behavior: balls collide with pins, never with each other —
          // no slingshots, pile-ups or tunneling from ball-ball impacts.
          collisionFilter: { group: -1 },
        }
      );
      Matter.Body.setVelocity(ball, { x: 0, y: 1.5 });
      Matter.Composite.add(engine.world, ball);
      activeBallsRef.current.set(id, { body: ball, row: 0, dirs, targetSlot, trail: [], stuck: 0 });
      onBallConsumed(id);
      sound.drop();
    });
  }, [ballQueue, paths, multipliers, onBallConsumed, onBallLand, geometry]);

  // Render + physics loop (fixed-timestep accumulator, one clock)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = (ts: number) => {
      const engine = engineRef.current;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Step physics on a fixed timestep so motion is identical across
      // display refresh rates; cap the accumulator after tab throttling.
      if (engine) {
        if (!lastTsRef.current) lastTsRef.current = ts;
        accRef.current = Math.min(accRef.current + (ts - lastTsRef.current), 100);
        lastTsRef.current = ts;
        while (accRef.current >= PHYSICS_STEP) {
          Matter.Engine.update(engine, PHYSICS_STEP);
          accRef.current -= PHYSICS_STEP;
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawBackground(ctx, w, h);

      const geo = geometry(w, h);
      const { endY, bottomLeftX, bottomRightX, pinR, ballR } = geo;
      const now = Date.now();

      pinGlowsRef.current = pinGlowsRef.current.filter(g => now - g.time < 250);
      drawPinGlows(ctx, pinGlowsRef.current, pinR, now);
      drawPins(ctx, geo, pinGlowsRef.current);
      drawBuckets(ctx, geo, multipliers, flashRef.current, tooltip?.slot ?? null, now);

      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      drawParticles(ctx, particlesRef.current);

      activeBallsRef.current.forEach(info => {
        const { body, trail } = info;
        const { x, y } = body.position;
        const numBuckets = multipliers.length;
        const bw = (bottomRightX - bottomLeftX) / numBuckets;
        const targetX = bottomLeftX + (info.targetSlot + 0.5) * bw;

        // Anti-stuck watchdog: a ball balancing on a pin or wedged in place
        // barely moves — kick it toward its own target bucket.
        if (body.speed < 0.35) {
          info.stuck += 1;
          if (info.stuck > 25) {
            const dirX = Math.sign(targetX - x) || (Math.random() < 0.5 ? -1 : 1);
            Matter.Body.setVelocity(body, { x: dirX * 1.3, y: 3 });
            info.stuck = 0;
          }
        } else {
          info.stuck = 0;
        }

        // Funnel: from just above the last pin row (all deflections consumed),
        // steer into the seed-derived bucket.
        if (y > endY - geo.gap * 0.35) {
          const pull = Math.max(-3.5, Math.min(3.5, (targetX - x) * 0.1));
          Matter.Body.setVelocity(body, { x: pull, y: Math.max(body.velocity.y, 2.2) });
        }

        trail.push({ x, y, time: now });
        while (trail.length > 10) trail.shift();
        drawBall(ctx, x, y, ballR, trail, now);
      });

      // Escape sweep: a ball that somehow left the board settles its wager.
      activeBallsRef.current.forEach((info, id) => {
        const by = info.body.position.y;
        const bx = info.body.position.x;
        if (by > h + 40 || bx < -60 || bx > w + 60) {
          if (!landedRef.current.has(id)) {
            landedRef.current.add(id);
            flashRef.current.set(info.targetSlot, now);
            onBallLand(id);
          }
          if (engineRef.current) Matter.Composite.remove(engineRef.current.world, info.body);
          activeBallsRef.current.delete(id);
        }
      });

      winPopupsRef.current = winPopupsRef.current.filter(p => now - p.time < 1400);
      drawWinPopups(ctx, winPopupsRef.current, now);

      flashRef.current.forEach((time, idx) => {
        if (now - time > 600) flashRef.current.delete(idx);
      });

      renderLoopRef.current = requestAnimationFrame(frame);
    };

    renderLoopRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(renderLoopRef.current);
      lastTsRef.current = 0;
      accRef.current = 0;
    };
  }, [rows, multipliers, geometry, onBallLand, tooltip]);

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
