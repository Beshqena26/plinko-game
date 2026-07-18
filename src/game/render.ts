import { getBucketColor } from '../utils/multipliers';
import type { BoardGeometry } from './geometry';

export interface PinGlow { x: number; y: number; time: number }
export interface TrailDot { x: number; y: number; time: number }
export interface WinPopup { x: number; y: number; mult: number; time: number; color: string }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }

export function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// BGaming scene: teal-to-navy gradient with a soft light bloom top-center
// and a faint decorative flourish.
export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const lg = ctx.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0, '#1D6A87');
  lg.addColorStop(0.5, '#154C64');
  lg.addColorStop(1, '#0E2A3C');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, w, h);

  const bloom = ctx.createRadialGradient(w / 2, h * 0.18, 0, w / 2, h * 0.18, Math.max(w, h) * 0.55);
  bloom.addColorStop(0, 'rgba(120, 200, 230, 0.18)');
  bloom.addColorStop(1, 'rgba(120, 200, 230, 0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);

  // faint flourish arcs (stand-in for BGaming's leaf ornament)
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#BFE8F5';
  ctx.lineWidth = 1.5;
  const cx = w * 0.34, cy = h * 0.3;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, 60 + i * 34, Math.PI * 0.9, Math.PI * 1.7);
    ctx.stroke();
  }
  ctx.restore();
}

// Entry hole rides higher when the apex pin is shown so the hole, the
// falling ball and the pin never visually merge.
export const entryHoleOffset = (spike: boolean) => (spike ? 1.55 : 1.05);

// Dark entry hole the ball drops out of (BGaming signature).
export function drawEntryHole(ctx: CanvasRenderingContext2D, geo: BoardGeometry, w: number, spike = false) {
  const r = Math.max(9, geo.gap * 0.42);
  const x = w / 2;
  const y = geo.startY - geo.gap * entryHoleOffset(spike);
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
  g.addColorStop(0, '#080617');
  g.addColorStop(0.75, '#0E0B20');
  g.addColorStop(1, 'rgba(14, 11, 32, 0.25)');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

// Cosmetic apex "spike" pin at the pyramid tip (test toggle) — visual only,
// the seed-derived path is untouched.
export function apexPinPos(geo: BoardGeometry, w: number) {
  return { x: w / 2, y: geo.startY - geo.gap * 0.72 };
}
export function drawApexPin(ctx: CanvasRenderingContext2D, geo: BoardGeometry, w: number) {
  const { x, y } = apexPinPos(geo, w);
  const pinR = geo.pinR * 1.25; // the tip pin reads slightly larger
  ctx.beginPath();
  ctx.arc(x, y + pinR * 0.35, pinR * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 8, 24, 0.4)';
  ctx.fill();
  const g = ctx.createRadialGradient(x - pinR * 0.35, y - pinR * 0.4, pinR * 0.1, x, y, pinR);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.65, '#E9E5FA');
  g.addColorStop(1, '#B8B2D9');
  ctx.beginPath();
  ctx.arc(x, y, pinR, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
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

// White glossy pins (BGaming style).
export function drawPins(ctx: CanvasRenderingContext2D, geo: BoardGeometry, glows: PinGlow[]) {
  const { pins, pinR } = geo;
  pins.forEach(pin => {
    const isHit = glows.some(g => Math.abs(g.x - pin.x) < 2 && Math.abs(g.y - pin.y) < 2);
    ctx.beginPath();
    ctx.arc(pin.x, pin.y + pinR * 0.35, pinR * 1.05, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 8, 24, 0.4)';
    ctx.fill();
    const g = ctx.createRadialGradient(pin.x - pinR * 0.35, pin.y - pinR * 0.4, pinR * 0.1, pin.x, pin.y, pinR);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.65, '#E9E5FA');
    g.addColorStop(1, '#B8B2D9');
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, isHit ? pinR + 0.6 : pinR, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  });
}

// BGaming chip buckets: flat bright rounded chips with dark text and a
// darker bottom lip; press-down bounce on hit.
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
  const bw = gap;

  multipliers.forEach((mult, i) => {
    const x = bucketLeftX + i * bw;
    const color = getBucketColor(i, numBuckets);
    const flashTime = flash.get(i);
    const isFlashing = flashTime && now - flashTime < 500;
    const isHovered = hovered === i;
    const [bR, bG, bB] = hexToRgb(color);

    const pressP = flashTime ? (now - flashTime) / 380 : 1;
    const pressY = pressP < 1 ? Math.sin(Math.min(pressP, 1) * Math.PI) * Math.min(7, gap * 0.3) : 0;

    const vertical = geo.verticalLabels;
    const chipW = bw - Math.max(1, gap * 0.06);
    const chipH = vertical ? Math.min(gap * 2.7, Math.max(26, gap * 2.4)) : Math.max(17, gap * 0.8);
    const lip = Math.max(2, Math.min(5, chipH * 0.18));
    const rad = Math.min(5, chipW * 0.18);
    const cx = x + (bw - chipW) / 2;

    ctx.save();
    ctx.translate(0, pressY);

    // bottom lip (darker shade of the chip color)
    ctx.beginPath();
    ctx.roundRect(cx, bucketTopY + lip, chipW, chipH, rad);
    ctx.fillStyle = `rgb(${bR * 0.55 | 0}, ${bG * 0.55 | 0}, ${bB * 0.2 | 0})`;
    ctx.fill();

    // chip face
    ctx.beginPath();
    ctx.roundRect(cx, bucketTopY, chipW, chipH, rad);
    ctx.fillStyle = isFlashing || isHovered ? '#FFFFFF' : color;
    ctx.fill();
    if (isFlashing || isHovered) {
      ctx.beginPath();
      ctx.roundRect(cx, bucketTopY, chipW, chipH, rad);
      ctx.fillStyle = `rgba(${bR}, ${bG}, ${bB}, 0.65)`;
      ctx.fill();
    }

    // label on the chip, dark navy like BGaming. Tight boards drop the "x"
    // prefix; when the chip is too narrow for horizontal text at a legible
    // size, the chip is tall and the label rotates 90° (length limited by
    // chip height instead of width).
    const value = mult >= 1000 ? `${(mult / 1000).toFixed(0)}K` : `${mult}`;
    const label = gap < 24 ? value : `x${value}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2A1502';
    if (vertical) {
      const fontSize = Math.min(11, chipW - 2, ((chipH - 5) * 1.7) / Math.max(2, label.length));
      ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
      ctx.save();
      ctx.translate(cx + chipW / 2, bucketTopY + chipH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, 0.5);
      ctx.restore();
    } else {
      const fit = (chipW * 1.6) / Math.max(2, label.length);
      const fontSize = Math.max(6.5, Math.min(13, gap * 0.5, fit));
      ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
      ctx.fillText(label, cx + chipW / 2, bucketTopY + chipH / 2 + 0.5);
    }

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

// Red-magenta glossy ball (BGaming style).
export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, ballR: number, trail: TrailDot[], now: number) {
  for (let t = 0; t < trail.length - 1; t++) {
    const dot = trail[t];
    const age = (now - dot.time) / 120;
    if (age > 1) continue;
    const alpha = (1 - age) * 0.18 * (t / trail.length);
    const sz = ballR * (1 - age) * 0.5;
    if (sz <= 0) continue;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, sz, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(247, 147, 26, ${alpha})`;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(x, y + ballR * 0.4, ballR * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 8, 24, 0.35)';
  ctx.fill();

  const bg = ctx.createRadialGradient(x - ballR * 0.35, y - ballR * 0.4, ballR * 0.15, x, y, ballR);
  bg.addColorStop(0, '#FFE0B0');
  bg.addColorStop(0.35, '#F7931A');
  bg.addColorStop(0.8, '#D9740A');
  bg.addColorStop(1, '#8A4C02');
  ctx.beginPath();
  ctx.arc(x, y, ballR, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - ballR * 0.3, y - ballR * 0.38, ballR * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
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
    const text = p.mult >= 1000 ? `x${(p.mult / 1000).toFixed(0)}K` : `x${p.mult}`;
    ctx.font = `bold ${p.mult >= 10 ? 16 : 13}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tmw = ctx.measureText(text).width;
    ctx.beginPath();
    ctx.roundRect(-tmw / 2 - 8, -11, tmw + 16, 22, 11);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, alpha * 0.92);
    ctx.fill();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = '#2A1502';
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
