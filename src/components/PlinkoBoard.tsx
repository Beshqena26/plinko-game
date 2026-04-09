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

const PIN_RADIUS = 3.5;
const BALL_RADIUS = 7;

interface PinGlow {
  x: number;
  y: number;
  time: number;
}

interface TrailDot {
  x: number;
  y: number;
  time: number;
}

interface WinPopup {
  x: number;
  y: number;
  mult: number;
  payout: number;
  time: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

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

  const getGeometry = useCallback((w: number, h: number) => {
    const gap = Math.min(42, Math.min((w - 80) / (rows + 3), (h - 140) / (rows + 2)));
    const boardH = gap * (rows + 1);
    const startY = (h - boardH) / 2 - 20;
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
    return { gap, startY, endY, pins };
  }, [rows]);

  // Engine
  useEffect(() => {
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.8, scale: 0.001 } });
    engineRef.current = engine;
    const runner = Matter.Runner.create({ delta: 1000 / 120 });
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);
    return () => {
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      cancelAnimationFrame(renderLoopRef.current);
    };
  }, []);

  // Build pins
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
    const { pins, endY, gap } = getGeometry(w, h);

    pins.forEach(p => {
      Matter.Composite.add(engine.world,
        Matter.Bodies.circle(p.x, p.y, PIN_RADIUS, {
          isStatic: true, restitution: 0.5, friction: 0.1, label: `pin-${p.row}-${p.col}`,
        })
      );
    });

    const bucketY = endY + gap * 0.7;
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(w / 2, bucketY + 40, w * 2, 20, { isStatic: true, label: 'floor' }),
      Matter.Bodies.rectangle(-10, h / 2, 20, h * 2, { isStatic: true }),
      Matter.Bodies.rectangle(w + 10, h / 2, 20, h * 2, { isStatic: true }),
    ]);

    const numBuckets = rows + 1;
    const totalBW = rows * gap;
    const bw = totalBW / numBuckets;
    const bsx = (w - totalBW) / 2;
    for (let i = 0; i <= numBuckets; i++) {
      Matter.Composite.add(engine.world,
        Matter.Bodies.rectangle(bsx + i * bw, bucketY + 10, 2, 30, { isStatic: true, restitution: 0.3, label: 'divider' })
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
          Matter.Body.applyForce(ball, ball.position, { x: dir === 1 ? 0.00035 : -0.00035, y: 0 });
          info.row = pinRow + 1;
          sound.pinHit(pinRow / rows);

          // Pin glow effect
          pinGlowsRef.current.push({ x: pin.position.x, y: pin.position.y, time: Date.now() });
        }

        if (ball && (bodyA.label === 'floor' || bodyB.label === 'floor')) {
          const ballId = parseInt(ball.label.split('-')[1]);
          if (landedRef.current.has(ballId)) return;
          landedRef.current.add(ballId);

          const { w } = sizeRef.current;
          const { gap, endY } = getGeometry(w, sizeRef.current.h);
          const numBuckets = rows + 1;
          const totalBW = rows * gap;
          const bw = totalBW / numBuckets;
          const bsx = (w - totalBW) / 2;
          const idx = Math.round((ball.position.x - bsx - bw / 2) / bw);
          const clampedIdx = Math.max(0, Math.min(numBuckets - 1, idx));

          flashRef.current.set(clampedIdx, Date.now());
          const mult = multipliers[clampedIdx] || 0;
          const color = getMultiplierColor(mult);

          // Win popup
          const popupX = bsx + clampedIdx * bw + bw / 2;
          const bucketTopY = endY + gap * 0.35;
          winPopupsRef.current.push({
            x: popupX,
            y: bucketTopY - 10,
            mult,
            payout: mult, // Will show multiplier
            time: Date.now(),
            color,
          });

          // Particles for big wins
          if (mult >= 5) {
            const count = mult >= 50 ? 40 : mult >= 10 ? 25 : 12;
            for (let p = 0; p < count; p++) {
              const angle = (Math.PI * 2 * p) / count + (Math.random() - 0.5) * 0.5;
              const speed = 1.5 + Math.random() * 3;
              particlesRef.current.push({
                x: popupX,
                y: bucketTopY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                life: 1,
                maxLife: 0.6 + Math.random() * 0.6,
                color,
                size: 2 + Math.random() * 3,
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
      const ball = Matter.Bodies.circle(w / 2 + (Math.random() - 0.5) * 6, startY - 30, BALL_RADIUS, {
        restitution: 0.5, friction: 0.1, density: 0.002, label: `ball-${id}`,
      });
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

      // Background
      ctx.fillStyle = '#000514';
      ctx.fillRect(0, 0, w, h);
      drawStoneBackground(ctx, w, h);

      const { pins, gap, endY } = getGeometry(w, h);
      const now = Date.now();

      // Clean up old pin glows
      pinGlowsRef.current = pinGlowsRef.current.filter(g => now - g.time < 200);

      // Draw pin glows BEHIND pins
      pinGlowsRef.current.forEach(g => {
        const age = (now - g.time) / 200;
        const alpha = (1 - age) * 0.5;
        const radius = PIN_RADIUS + 6 + age * 4;
        const grd = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, radius);
        grd.addColorStop(0, `rgba(14, 204, 104, ${alpha})`);
        grd.addColorStop(1, `rgba(14, 204, 104, 0)`);
        ctx.beginPath();
        ctx.arc(g.x, g.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });

      // Draw pins
      pins.forEach(pin => {
        // Check if this pin was recently hit
        const isHit = pinGlowsRef.current.some(g =>
          Math.abs(g.x - pin.x) < 1 && Math.abs(g.y - pin.y) < 1
        );

        const g = ctx.createRadialGradient(pin.x - 0.8, pin.y - 0.8, 0, pin.x, pin.y, PIN_RADIUS);
        if (isHit) {
          g.addColorStop(0, 'rgba(14, 204, 104, 0.95)');
          g.addColorStop(1, 'rgba(14, 204, 104, 0.6)');
        } else {
          g.addColorStop(0, 'rgba(194, 197, 214, 0.65)');
          g.addColorStop(1, 'rgba(115, 118, 140, 0.35)');
        }
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, isHit ? PIN_RADIUS + 0.5 : PIN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });

      // Buckets
      const numBuckets = rows + 1;
      const totalBW = rows * gap;
      const bw = totalBW / numBuckets;
      const bsx = (w - totalBW) / 2;
      const bucketTopY = endY + gap * 0.35;

      multipliers.forEach((mult, i) => {
        const x = bsx + i * bw;
        const color = getMultiplierColor(mult);
        const flashTime = flashRef.current.get(i);
        const isFlashing = flashTime && now - flashTime < 500;
        const flashI = isFlashing ? 1 - (now - flashTime!) / 500 : 0;

        const [baseR, baseG, baseB] = hexToRgb(color);

        // 3D Bucket
        const cupW = bw - 3;
        const cupH = 22;
        const taperInset = cupW * 0.12;

        ctx.beginPath();
        ctx.moveTo(x + 1.5 + taperInset, bucketTopY);
        ctx.lineTo(x + 1.5, bucketTopY + cupH);
        ctx.lineTo(x + 1.5 + cupW, bucketTopY + cupH);
        ctx.lineTo(x + 1.5 + cupW - taperInset, bucketTopY);
        ctx.closePath();

        ctx.fillStyle = `rgb(${baseR * 0.3 | 0}, ${baseG * 0.3 | 0}, ${baseB * 0.3 | 0})`;
        ctx.fill();

        const frontG = ctx.createLinearGradient(x, bucketTopY, x, bucketTopY + cupH);
        frontG.addColorStop(0, `rgba(${baseR}, ${baseG}, ${baseB}, ${0.55 + flashI * 0.45})`);
        frontG.addColorStop(0.6, `rgba(${baseR * 0.6 | 0}, ${baseG * 0.6 | 0}, ${baseB * 0.6 | 0}, ${0.45 + flashI * 0.35})`);
        frontG.addColorStop(1, `rgba(${baseR * 0.2 | 0}, ${baseG * 0.2 | 0}, ${baseB * 0.2 | 0}, 0.7)`);
        ctx.fillStyle = frontG;
        ctx.fill();

        // Rim
        ctx.beginPath();
        ctx.moveTo(x + 1.5 + taperInset, bucketTopY);
        ctx.lineTo(x + 1.5 + cupW - taperInset, bucketTopY);
        ctx.lineWidth = isFlashing ? 2.5 : 2;
        ctx.strokeStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${0.7 + flashI * 0.3})`;
        ctx.stroke();

        // Flash glow
        if (isFlashing) {
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 20 * flashI;
          ctx.beginPath();
          ctx.arc(x + bw / 2, bucketTopY + cupH / 2, cupW / 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${flashI * 0.3})`;
          ctx.fill();
          ctx.restore();
        }

        // Label
        const labelY = bucketTopY + cupH + 14;
        const fontSize = bw < 28 ? 7 : bw < 38 ? 8 : bw < 48 ? 9 : 10;
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = mult >= 1000 ? `${(mult / 1000).toFixed(0)}K` : `${mult}X`;
        const tw = ctx.measureText(label).width;

        ctx.beginPath();
        ctx.roundRect(x + bw / 2 - tw / 2 - 4, labelY - 7, tw + 8, 14, 3);
        ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${0.12 + flashI * 0.2})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${0.2 + flashI * 0.3})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.globalAlpha = isFlashing ? 1 : 0.9;
        ctx.fillText(label, x + bw / 2, labelY);
        ctx.globalAlpha = 1;
      });

      // Update & draw particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // gravity
        p.life -= 1 / (60 * p.maxLife);
        const alpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Draw ball trails + balls
      activeBallsRef.current.forEach(info => {
        const { body, trail } = info;
        const { x, y } = body.position;

        // Add trail dot
        trail.push({ x, y, time: now });
        // Keep last 12
        while (trail.length > 12) trail.shift();

        // Draw trail
        trail.forEach((dot, idx) => {
          const age = (now - dot.time) / 150;
          if (age > 1) return;
          const alpha = (1 - age) * 0.25 * (idx / trail.length);
          const size = BALL_RADIUS * (1 - age) * 0.6;
          if (size <= 0) return;
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 206, 4, ${alpha})`;
          ctx.fill();
        });

        // Ball glow
        const glowG = ctx.createRadialGradient(x, y, BALL_RADIUS, x, y, BALL_RADIUS + 12);
        glowG.addColorStop(0, 'rgba(251, 206, 4, 0.3)');
        glowG.addColorStop(1, 'rgba(251, 206, 4, 0)');
        ctx.beginPath();
        ctx.arc(x, y, BALL_RADIUS + 12, 0, Math.PI * 2);
        ctx.fillStyle = glowG;
        ctx.fill();

        // Ball body
        const ballG = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, BALL_RADIUS);
        ballG.addColorStop(0, '#fff8dc');
        ballG.addColorStop(0.3, '#FBCE04');
        ballG.addColorStop(0.7, '#d4a904');
        ballG.addColorStop(1, '#8a6f02');
        ctx.beginPath();
        ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ballG;
        ctx.fill();

        // Specular
        ctx.beginPath();
        ctx.arc(x - 2, y - 2.5, BALL_RADIUS * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fill();
      });

      // Win popups — float upward and fade
      winPopupsRef.current = winPopupsRef.current.filter(p => now - p.time < 1500);
      winPopupsRef.current.forEach(p => {
        const age = (now - p.time) / 1500;
        const alpha = age < 0.2 ? age / 0.2 : age > 0.7 ? (1 - age) / 0.3 : 1;
        const offsetY = age * 50;
        const scale = 0.8 + Math.sin(age * Math.PI) * 0.3;

        ctx.save();
        ctx.translate(p.x, p.y - offsetY);
        ctx.scale(scale, scale);
        ctx.globalAlpha = Math.max(0, alpha);

        const text = `${p.mult}X`;
        ctx.font = `bold ${p.mult >= 10 ? 16 : 13}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Background pill
        const tw = ctx.measureText(text).width;
        ctx.beginPath();
        ctx.roundRect(-tw / 2 - 8, -11, tw + 16, 22, 11);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, alpha * 0.2);
        ctx.fill();

        // Border
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = Math.max(0, alpha * 0.5);
        ctx.stroke();

        // Text
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.fillText(text, 0, 0);

        ctx.restore();
        ctx.globalAlpha = 1;
      });

      // Cleanup flashes
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
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function drawStoneBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const blockW = 80;
  const blockH = 50;
  ctx.globalAlpha = 0.03;
  for (let row = 0; row < Math.ceil(h / blockH) + 1; row++) {
    const offset = row % 2 === 0 ? 0 : blockW / 2;
    for (let col = -1; col < Math.ceil(w / blockW) + 1; col++) {
      const bx = col * blockW + offset;
      const by = row * blockH;
      ctx.strokeStyle = '#73768C';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx + 2, by + 2, blockW - 4, blockH - 4, 4);
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
