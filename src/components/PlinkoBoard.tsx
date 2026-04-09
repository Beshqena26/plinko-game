import { useRef, useEffect, useCallback } from 'react';
import Matter from 'matter-js';
import { getMultiplierColor } from '../utils/multipliers';
import { sound } from '../utils/sound';

interface PlinkoBoardProps {
  rows: number;
  multipliers: number[];
  onBallLand: (bucketIndex: number) => void;
  ballQueue: number[];
  onBallConsumed: (id: number) => void;
  paths: Map<number, number[]>;
}

const PIN_RADIUS = 4;
const BALL_RADIUS = 7;

interface PinGlow { x: number; y: number; time: number }
interface TrailDot { x: number; y: number; time: number }
interface WinPopup { x: number; y: number; mult: number; time: number; color: string }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }

export default function PlinkoBoard({
  rows,
  multipliers,
  onBallLand,
  ballQueue,
  onBallConsumed,
  paths,
}: PlinkoBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const renderLoopRef = useRef<number>(0);
  const activeBallsRef = useRef<Map<number, { body: Matter.Body; row: number; dirs: number[]; trail: TrailDot[] }>>(new Map());
  const flashRef = useRef<Map<number, number>>(new Map());
  const sizeRef = useRef({ w: 0, h: 0 });
  const landedRef = useRef<Set<number>>(new Set());
  const pinGlowsRef = useRef<PinGlow[]>([]);
  const winPopupsRef = useRef<WinPopup[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Geometry: row r has (r+3) pins, spaced by gap.
  // Bottom row (r=rows) has (rows+3) pins, spanning (rows+2)*gap.
  // Buckets = rows+1 slots, aligned to bottom row.
  const getGeometry = useCallback((w: number, h: number) => {
    const bottomPinCount = rows + 3;
    const bottomSpan = bottomPinCount - 1; // in gap units

    const maxGapW = (w - 60) / (bottomSpan + 1);
    const maxGapH = (h - 130) / (rows + 2);
    const gap = Math.min(38, maxGapW, maxGapH);

    const boardH = gap * rows;
    const startY = (h - boardH) / 2 - 10;

    const pins: { x: number; y: number; row: number; col: number }[] = [];
    for (let r = 0; r <= rows; r++) {
      const count = r + 3;
      const y = startY + r * gap;
      const totalW = (count - 1) * gap;
      const sx = (w - totalW) / 2;
      for (let c = 0; c < count; c++) {
        pins.push({ x: sx + c * gap, y, row: r, col: c });
      }
    }

    const endY = startY + rows * gap;

    // Bottom row bounds
    const bottomTotalW = bottomSpan * gap;
    const bottomLeftX = (w - bottomTotalW) / 2;
    const bottomRightX = bottomLeftX + bottomTotalW;

    // Top row (row 0) bounds: 3 pins, span = 2*gap
    const topTotalW = 2 * gap;
    const topLeftX = (w - topTotalW) / 2;
    const topRightX = topLeftX + topTotalW;

    return { gap, startY, endY, pins, bottomLeftX, bottomRightX, topLeftX, topRightX };
  }, [rows]);

  // Engine
  useEffect(() => {
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.2, scale: 0.001 } });
    engineRef.current = engine;
    const runner = Matter.Runner.create({ delta: 1000 / 60 });
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);
    return () => {
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      cancelAnimationFrame(renderLoopRef.current);
    };
  }, []);

  // Build world
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    Matter.Composite.clear(engine.world, false);
    activeBallsRef.current.clear();
    landedRef.current.clear();
    pinGlowsRef.current = [];
    winPopupsRef.current = [];
    particlesRef.current = [];

    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    sizeRef.current = { w, h };
    const geo = getGeometry(w, h);
    const { pins, endY, gap, topLeftX, topRightX, bottomLeftX, bottomRightX, startY } = geo;

    // Pins
    pins.forEach(p => {
      Matter.Composite.add(engine.world,
        Matter.Bodies.circle(p.x, p.y, PIN_RADIUS + 1.5, {
          isStatic: true, restitution: 0.5, friction: 0.0, label: `pin-${p.row}-${p.col}`,
        })
      );
    });

    // Angled boundary walls along triangle edges (keeps balls inside)
    const wallPadding = BALL_RADIUS + 5;
    const wallThickness = 10;

    // Left wall: from top-left pin to bottom-left pin
    const leftWallLen = Math.sqrt(
      (bottomLeftX - topLeftX) ** 2 + (endY - startY) ** 2
    ) + gap;
    const leftWallAngle = Math.atan2(endY - startY, (bottomLeftX - wallPadding) - (topLeftX - wallPadding));
    const leftWallCx = ((topLeftX - wallPadding) + (bottomLeftX - wallPadding)) / 2;
    const leftWallCy = (startY - gap / 2 + endY + gap / 2) / 2;
    Matter.Composite.add(engine.world,
      Matter.Bodies.rectangle(leftWallCx, leftWallCy, leftWallLen, wallThickness, {
        isStatic: true, angle: leftWallAngle, restitution: 0.3, label: 'wallL',
      })
    );

    // Right wall
    const rightWallAngle = Math.atan2(endY - startY, (bottomRightX + wallPadding) - (topRightX + wallPadding));
    const rightWallCx = ((topRightX + wallPadding) + (bottomRightX + wallPadding)) / 2;
    const rightWallCy = leftWallCy;
    Matter.Composite.add(engine.world,
      Matter.Bodies.rectangle(rightWallCx, rightWallCy, leftWallLen, wallThickness, {
        isStatic: true, angle: rightWallAngle, restitution: 0.3, label: 'wallR',
      })
    );

    // Floor + side walls
    const bucketY = endY + gap * 0.65;
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(w / 2, bucketY + 40, w * 2, 20, { isStatic: true, label: 'floor', restitution: 0.1 }),
    ]);

    // Bucket dividers — aligned to bottom row pin positions
    // rows+1 buckets fit between the (rows+3) bottom pins
    // Each bucket spans 1 gap between adjacent bottom-row pins
    // But we have rows+3 pins and rows+1 buckets...
    // Actually: rows+1 buckets, each between gaps of the bottom row.
    // Bottom row has rows+3 pins. Buckets sit between pairs of pins.
    // We need rows+2 gaps between pins, but only rows+1 buckets.
    // The standard approach: buckets span from pin[0] to pin[last] of bottom row,
    // divided into rows+1 equal segments.
    const numBuckets = rows + 1;
    const bucketAreaLeft = bottomLeftX;
    const bucketAreaRight = bottomRightX;
    const bucketTotalW = bucketAreaRight - bucketAreaLeft;
    const bw = bucketTotalW / numBuckets;

    for (let i = 0; i <= numBuckets; i++) {
      Matter.Composite.add(engine.world,
        Matter.Bodies.rectangle(bucketAreaLeft + i * bw, bucketY + 8, 3, 36, {
          isStatic: true, restitution: 0.2, label: 'divider',
        })
      );
    }
  }, [rows, getGeometry]);

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

  // Collisions
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

          // Set velocity directly for reliable left/right control
          const hSpeed = Math.max(1.2, Math.abs(ball.velocity.y) * 0.5);
          Matter.Body.setVelocity(ball, {
            x: dir === 1 ? hSpeed : -hSpeed,
            y: Math.max(0.5, ball.velocity.y * 0.3),
          });
        }

        if (ball && (bodyA.label === 'floor' || bodyB.label === 'floor')) {
          const ballId = parseInt(ball.label.split('-')[1]);
          if (landedRef.current.has(ballId)) return;
          landedRef.current.add(ballId);

          const { w } = sizeRef.current;
          const geo = getGeometry(w, sizeRef.current.h);
          const numBuckets = rows + 1;
          const bucketTotalW = geo.bottomRightX - geo.bottomLeftX;
          const bw = bucketTotalW / numBuckets;
          const relX = ball.position.x - geo.bottomLeftX;
          const idx = Math.floor(relX / bw);
          const clampedIdx = Math.max(0, Math.min(numBuckets - 1, idx));

          flashRef.current.set(clampedIdx, Date.now());
          const mult = multipliers[clampedIdx] || 0;
          const color = getMultiplierColor(mult);
          const popupX = geo.bottomLeftX + clampedIdx * bw + bw / 2;
          const bucketTopY = geo.endY + geo.gap * 0.3;

          winPopupsRef.current.push({ x: popupX, y: bucketTopY - 10, mult, time: Date.now(), color });

          if (mult >= 5) {
            const count = mult >= 50 ? 40 : mult >= 10 ? 25 : 12;
            for (let p = 0; p < count; p++) {
              const angle = (Math.PI * 2 * p) / count + (Math.random() - 0.5) * 0.5;
              const spd = 1.5 + Math.random() * 3;
              particlesRef.current.push({
                x: popupX, y: bucketTopY,
                vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
                life: 1, maxLife: 0.6 + Math.random() * 0.6,
                color, size: 2 + Math.random() * 3,
              });
            }
          }

          onBallLand(clampedIdx);
          setTimeout(() => {
            if (engineRef.current) Matter.Composite.remove(engineRef.current.world, ball);
            activeBallsRef.current.delete(ballId);
          }, 150);
        }
      });
    };

    Matter.Events.on(engine, 'collisionStart', handler);
    return () => Matter.Events.off(engine, 'collisionStart', handler);
  }, [rows, multipliers, onBallLand, getGeometry]);

  // Drop balls
  useEffect(() => {
    if (ballQueue.length === 0) return;
    const engine = engineRef.current;
    if (!engine) return;
    const { w, h } = sizeRef.current;
    const { startY } = getGeometry(w, h);

    ballQueue.forEach(id => {
      const dirs = paths.get(id) || [];
      const ball = Matter.Bodies.circle(
        w / 2 + (Math.random() - 0.5) * 4,
        startY - 20,
        BALL_RADIUS,
        { restitution: 0.4, friction: 0.05, density: 0.003, label: `ball-${id}` }
      );
      Matter.Body.setVelocity(ball, { x: 0, y: 1.5 });
      Matter.Composite.add(engine.world, ball);
      activeBallsRef.current.set(id, { body: ball, row: 0, dirs, trail: [] });
      onBallConsumed(id);
      sound.drop();
    });
  }, [ballQueue, paths, onBallConsumed, getGeometry]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#000514';
      ctx.fillRect(0, 0, w, h);
      drawStoneBackground(ctx, w, h);

      const geo = getGeometry(w, h);
      const { pins, gap, endY, bottomLeftX, bottomRightX } = geo;
      const now = Date.now();

      // Pin glows
      pinGlowsRef.current = pinGlowsRef.current.filter(g => now - g.time < 250);
      pinGlowsRef.current.forEach(g => {
        const age = (now - g.time) / 250;
        const alpha = (1 - age) * 0.5;
        const r = PIN_RADIUS + 8 + age * 5;
        const grd = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, r);
        grd.addColorStop(0, `rgba(14, 204, 104, ${alpha})`);
        grd.addColorStop(1, 'rgba(14, 204, 104, 0)');
        ctx.beginPath();
        ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });

      // Pins
      pins.forEach(pin => {
        const isHit = pinGlowsRef.current.some(g =>
          Math.abs(g.x - pin.x) < 2 && Math.abs(g.y - pin.y) < 2
        );
        const g = ctx.createRadialGradient(pin.x - 0.5, pin.y - 0.5, 0, pin.x, pin.y, PIN_RADIUS);
        if (isHit) {
          g.addColorStop(0, 'rgba(14, 204, 104, 1)');
          g.addColorStop(1, 'rgba(14, 204, 104, 0.6)');
        } else {
          g.addColorStop(0, 'rgba(194, 197, 214, 0.6)');
          g.addColorStop(1, 'rgba(115, 118, 140, 0.3)');
        }
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, isHit ? PIN_RADIUS + 0.5 : PIN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });

      // Buckets — aligned to bottom row
      const numBuckets = rows + 1;
      const bucketTotalW = bottomRightX - bottomLeftX;
      const bw = bucketTotalW / numBuckets;
      const bucketTopY = endY + gap * 0.3;

      multipliers.forEach((mult, i) => {
        const x = bottomLeftX + i * bw;
        const color = getMultiplierColor(mult);
        const flashTime = flashRef.current.get(i);
        const isFlashing = flashTime && now - flashTime < 500;
        const flashI = isFlashing ? 1 - (now - flashTime!) / 500 : 0;
        const [bR, bG, bB] = hexToRgb(color);

        // 3D Bucket
        const cupW = bw - 2;
        const cupH = 24;
        const taper = cupW * 0.1;

        ctx.beginPath();
        ctx.moveTo(x + 1 + taper, bucketTopY);
        ctx.lineTo(x + 1, bucketTopY + cupH);
        ctx.lineTo(x + 1 + cupW, bucketTopY + cupH);
        ctx.lineTo(x + 1 + cupW - taper, bucketTopY);
        ctx.closePath();

        const fg = ctx.createLinearGradient(x, bucketTopY, x, bucketTopY + cupH);
        fg.addColorStop(0, `rgba(${bR}, ${bG}, ${bB}, ${0.65 + flashI * 0.35})`);
        fg.addColorStop(0.5, `rgba(${bR * 0.5 | 0}, ${bG * 0.5 | 0}, ${bB * 0.5 | 0}, ${0.5 + flashI * 0.3})`);
        fg.addColorStop(1, `rgba(${bR * 0.15 | 0}, ${bG * 0.15 | 0}, ${bB * 0.15 | 0}, 0.8)`);
        ctx.fillStyle = fg;
        ctx.fill();

        // Rim
        ctx.beginPath();
        ctx.moveTo(x + 1 + taper, bucketTopY);
        ctx.lineTo(x + 1 + cupW - taper, bucketTopY);
        ctx.lineWidth = isFlashing ? 2.5 : 1.5;
        ctx.strokeStyle = `rgba(${bR}, ${bG}, ${bB}, ${0.8 + flashI * 0.2})`;
        ctx.stroke();

        if (isFlashing) {
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 20 * flashI;
          ctx.beginPath();
          ctx.arc(x + bw / 2, bucketTopY + cupH / 2, cupW / 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${bR}, ${bG}, ${bB}, ${flashI * 0.3})`;
          ctx.fill();
          ctx.restore();
        }

        // Label
        const labelY = bucketTopY + cupH + 15;
        const fontSize = bw < 26 ? 7 : bw < 34 ? 8 : bw < 44 ? 9 : 10;
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = mult >= 1000 ? `${(mult / 1000).toFixed(0)}K` : `${mult}X`;
        const tw = ctx.measureText(label).width;

        ctx.beginPath();
        ctx.roundRect(x + bw / 2 - tw / 2 - 5, labelY - 8, tw + 10, 16, 4);
        ctx.fillStyle = `rgba(${bR}, ${bG}, ${bB}, ${0.15 + flashI * 0.25})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${bR}, ${bG}, ${bB}, ${0.25 + flashI * 0.3})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.globalAlpha = isFlashing ? 1 : 0.9;
        ctx.fillText(label, x + bw / 2, labelY);
        ctx.globalAlpha = 1;
      });

      // Particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.06;
        p.life -= 1 / (60 * p.maxLife);
        const a = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a * 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Ball trails + balls
      activeBallsRef.current.forEach(info => {
        const { body, trail } = info;
        const { x, y } = body.position;
        trail.push({ x, y, time: now });
        while (trail.length > 10) trail.shift();

        for (let t = 0; t < trail.length - 1; t++) {
          const dot = trail[t];
          const age = (now - dot.time) / 120;
          if (age > 1) continue;
          const alpha = (1 - age) * 0.2 * (t / trail.length);
          const sz = BALL_RADIUS * (1 - age) * 0.5;
          if (sz <= 0) continue;
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, sz, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 206, 4, ${alpha})`;
          ctx.fill();
        }

        // Glow
        const glowG = ctx.createRadialGradient(x, y, BALL_RADIUS, x, y, BALL_RADIUS + 14);
        glowG.addColorStop(0, 'rgba(251, 206, 4, 0.25)');
        glowG.addColorStop(1, 'rgba(251, 206, 4, 0)');
        ctx.beginPath();
        ctx.arc(x, y, BALL_RADIUS + 14, 0, Math.PI * 2);
        ctx.fillStyle = glowG;
        ctx.fill();

        // Ball
        const bg = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, BALL_RADIUS);
        bg.addColorStop(0, '#fff8dc');
        bg.addColorStop(0.3, '#FBCE04');
        bg.addColorStop(0.7, '#d4a904');
        bg.addColorStop(1, '#8a6f02');
        ctx.beginPath();
        ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        // Specular
        ctx.beginPath();
        ctx.arc(x - 2, y - 2.5, BALL_RADIUS * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fill();
      });

      // Win popups
      winPopupsRef.current = winPopupsRef.current.filter(p => now - p.time < 1400);
      winPopupsRef.current.forEach(p => {
        const age = (now - p.time) / 1400;
        const alpha = age < 0.15 ? age / 0.15 : age > 0.65 ? (1 - age) / 0.35 : 1;
        const offsetY = age * 55;
        const scale = 0.7 + Math.sin(age * Math.PI) * 0.35;
        ctx.save();
        ctx.translate(p.x, p.y - offsetY);
        ctx.scale(scale, scale);
        ctx.globalAlpha = Math.max(0, alpha);
        const text = p.mult >= 1000 ? `${(p.mult / 1000).toFixed(0)}K` : `${p.mult}X`;
        ctx.font = `bold ${p.mult >= 10 ? 16 : 13}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tmw = ctx.measureText(text).width;
        ctx.beginPath();
        ctx.roundRect(-tmw / 2 - 8, -11, tmw + 16, 22, 11);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, alpha * 0.2);
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = Math.max(0, alpha * 0.5);
        ctx.stroke();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.fillText(text, 0, 0);
        ctx.restore();
        ctx.globalAlpha = 1;
      });

      flashRef.current.forEach((time, idx) => {
        if (now - time > 600) flashRef.current.delete(idx);
      });

      renderLoopRef.current = requestAnimationFrame(draw);
    };

    renderLoopRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(renderLoopRef.current);
  }, [rows, multipliers, getGeometry]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function drawStoneBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.globalAlpha = 0.025;
  const bW = 80, bH = 50;
  for (let row = 0; row < Math.ceil(h / bH) + 1; row++) {
    const off = row % 2 === 0 ? 0 : bW / 2;
    for (let col = -1; col < Math.ceil(w / bW) + 1; col++) {
      ctx.strokeStyle = '#73768C';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(col * bW + off + 2, row * bH + 2, bW - 4, bH - 4, 4);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.75);
  vig.addColorStop(0, 'rgba(0,5,20,0)');
  vig.addColorStop(1, 'rgba(0,5,20,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}
