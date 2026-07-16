import { getBucketColor } from '../utils/multipliers';
import type { BoardGeometry } from './geometry';

export interface PinGlow { x: number; y: number; time: number }
export interface TrailDot { x: number; y: number; time: number }
export interface WinPopup { x: number; y: number; mult: number; time: number; color: string }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }

export function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#120D24';
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.025;
  const bW = 80, bH = 50;
  for (let row = 0; row < Math.ceil(h / bH) + 1; row++) {
    const off = row % 2 === 0 ? 0 : bW / 2;
    for (let col = -1; col < Math.ceil(w / bW) + 1; col++) {
      ctx.strokeStyle = '#8B8BA3';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(col * bW + off + 2, row * bH + 2, bW - 4, bH - 4, 4);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.75);
  vig.addColorStop(0, 'rgba(18,13,36,0)');
  vig.addColorStop(1, 'rgba(18,13,36,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

export function drawPinGlows(ctx: CanvasRenderingContext2D, glows: PinGlow[], pinR: number, now: number) {
  glows.forEach(g => {
    const age = (now - g.time) / 250;
    const alpha = (1 - age) * 0.5;
    const r = pinR + 8 + age * 5;
    const grd = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, r);
    grd.addColorStop(0, `rgba(247, 147, 26, ${alpha})`);
    grd.addColorStop(1, 'rgba(247, 147, 26, 0)');
    ctx.beginPath();
    ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  });
}

export function drawPins(ctx: CanvasRenderingContext2D, geo: BoardGeometry, glows: PinGlow[]) {
  const { pins, pinR } = geo;
  pins.forEach(pin => {
    const isHit = glows.some(g => Math.abs(g.x - pin.x) < 2 && Math.abs(g.y - pin.y) < 2);
    const g = ctx.createRadialGradient(pin.x - 0.5, pin.y - 0.5, 0, pin.x, pin.y, pinR);
    if (isHit) {
      g.addColorStop(0, 'rgba(247, 147, 26, 1)');
      g.addColorStop(1, 'rgba(247, 147, 26, 0.6)');
    } else {
      g.addColorStop(0, 'rgba(206, 202, 255, 0.65)');
      g.addColorStop(1, 'rgba(139, 139, 163, 0.30)');
    }
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, isHit ? pinR + 0.5 : pinR, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  });
}

export function drawBuckets(
  ctx: CanvasRenderingContext2D,
  geo: BoardGeometry,
  multipliers: number[],
  flash: Map<number, number>,
  hovered: number | null,
  now: number,
) {
  const { gap, bucketLeftX, bucketTopY } = geo;
  const numBuckets = multipliers.length;
  const bw = gap; // one bucket per bottom-row gap, aligned to the pin grid

  multipliers.forEach((mult, i) => {
    const x = bucketLeftX + i * bw;
    const color = getBucketColor(i, numBuckets);
    const flashTime = flash.get(i);
    const isFlashing = flashTime && now - flashTime < 500;
    const flashI = isFlashing ? 1 - (now - flashTime!) / 500 : 0;
    const isHovered = hovered === i;
    const [bR, bG, bB] = hexToRgb(color);

    // Stake-style press-down: the bucket dips and springs back on a hit.
    const pressP = flashTime ? (now - flashTime) / 380 : 1;
    const pressY = pressP < 1 ? Math.sin(Math.min(pressP, 1) * Math.PI) * Math.min(7, gap * 0.28) : 0;

    // All bucket metrics scale with the pin gap so proportions stay
    // identical from phone to desktop.
    const cupW = bw - Math.max(1.5, gap * 0.06);
    const cupH = gap * 0.62;
    const taper = cupW * 0.1;

    ctx.save();
    ctx.translate(0, pressY);

    ctx.beginPath();
    ctx.moveTo(x + 1 + taper, bucketTopY);
    ctx.lineTo(x + 1, bucketTopY + cupH);
    ctx.lineTo(x + 1 + cupW, bucketTopY + cupH);
    ctx.lineTo(x + 1 + cupW - taper, bucketTopY);
    ctx.closePath();

    const base = isHovered ? 0.15 : 0;
    const fg = ctx.createLinearGradient(x, bucketTopY, x, bucketTopY + cupH);
    fg.addColorStop(0, `rgba(${bR}, ${bG}, ${bB}, ${Math.min(1, 0.65 + base + flashI * 0.35)})`);
    fg.addColorStop(0.5, `rgba(${bR * 0.5 | 0}, ${bG * 0.5 | 0}, ${bB * 0.5 | 0}, ${0.5 + base + flashI * 0.3})`);
    fg.addColorStop(1, `rgba(${bR * 0.15 | 0}, ${bG * 0.15 | 0}, ${bB * 0.15 | 0}, 0.8)`);
    ctx.fillStyle = fg;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 1 + taper, bucketTopY);
    ctx.lineTo(x + 1 + cupW - taper, bucketTopY);
    ctx.lineWidth = isFlashing || isHovered ? 2.5 : 1.5;
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

    const labelY = bucketTopY + cupH + Math.max(9, gap * 0.42);
    const fontSize = Math.max(6.5, Math.min(10, gap * 0.28));
    const padX = Math.max(2.5, gap * 0.13);
    const boxH = fontSize + 7;
    ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = mult >= 1000 ? `${(mult / 1000).toFixed(0)}K` : `${mult}X`;
    const tw = ctx.measureText(label).width;

    ctx.beginPath();
    ctx.roundRect(x + bw / 2 - tw / 2 - padX, labelY - boxH / 2, tw + padX * 2, boxH, 4);
    ctx.fillStyle = `rgba(${bR}, ${bG}, ${bB}, ${0.15 + base + flashI * 0.25})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${bR}, ${bG}, ${bB}, ${0.25 + base + flashI * 0.3})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.globalAlpha = isFlashing || isHovered ? 1 : 0.9;
    ctx.fillText(label, x + bw / 2, labelY);
    ctx.globalAlpha = 1;
    ctx.restore();
  });
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  particles.forEach(p => {
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
}

export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, ballR: number, trail: TrailDot[], now: number) {
  for (let t = 0; t < trail.length - 1; t++) {
    const dot = trail[t];
    const age = (now - dot.time) / 120;
    if (age > 1) continue;
    const alpha = (1 - age) * 0.2 * (t / trail.length);
    const sz = ballR * (1 - age) * 0.5;
    if (sz <= 0) continue;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, sz, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(247, 147, 26, ${alpha})`;
    ctx.fill();
  }

  const glowG = ctx.createRadialGradient(x, y, ballR, x, y, ballR + 14);
  glowG.addColorStop(0, 'rgba(247, 147, 26, 0.28)');
  glowG.addColorStop(1, 'rgba(247, 147, 26, 0)');
  ctx.beginPath();
  ctx.arc(x, y, ballR + 14, 0, Math.PI * 2);
  ctx.fillStyle = glowG;
  ctx.fill();

  const bg = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, ballR);
  bg.addColorStop(0, '#ffe9cc');
  bg.addColorStop(0.3, '#F7931A');
  bg.addColorStop(0.7, '#d97a08');
  bg.addColorStop(1, '#8a4c02');
  ctx.beginPath();
  ctx.arc(x, y, ballR, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - 2, y - 2.5, ballR * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fill();
}

export function drawWinPopups(ctx: CanvasRenderingContext2D, popups: WinPopup[], now: number) {
  popups.forEach(p => {
    const age = (now - p.time) / 1400;
    const alpha = age < 0.15 ? age / 0.15 : age > 0.65 ? (1 - age) / 0.35 : 1;
    const offsetY = age * 55;
    const scale = 0.7 + Math.sin(age * Math.PI) * 0.35;
    ctx.save();
    ctx.translate(p.x, p.y - offsetY);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, alpha);
    const text = p.mult >= 1000 ? `${(p.mult / 1000).toFixed(0)}K` : `${p.mult}X`;
    ctx.font = `bold ${p.mult >= 10 ? 16 : 13}px 'JetBrains Mono', monospace`;
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
}

export function spawnWinParticles(particles: Particle[], x: number, y: number, mult: number, color: string) {
  if (mult < 5) return;
  const count = mult >= 50 ? 40 : mult >= 10 ? 25 : 12;
  for (let p = 0; p < count; p++) {
    const angle = (Math.PI * 2 * p) / count + (Math.random() - 0.5) * 0.5;
    const spd = 1.5 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
      life: 1, maxLife: 0.6 + Math.random() * 0.6,
      color, size: 2 + Math.random() * 3,
    });
  }
}
