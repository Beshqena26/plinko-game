import { useRef, useEffect, useCallback } from 'react';
import { Ball } from '../hooks/useGameEngine';
import { getMultiplierColor } from '../utils/multipliers';
import { soundManager } from '../utils/sound';

interface PlinkoBoardProps {
  rows: number;
  balls: Ball[];
  setBalls: React.Dispatch<React.SetStateAction<Ball[]>>;
  multipliers: number[];
  flashingBucket: number | null;
}

const PIN_RADIUS = 3;
const BALL_RADIUS = 5;
const GRAVITY = 0.25;
const BOUNCE = 0.5;
const FRICTION = 0.98;

export default function PlinkoBoard({ rows, balls, setBalls, multipliers, flashingBucket }: PlinkoBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const ballsRef = useRef<Ball[]>(balls);

  useEffect(() => {
    ballsRef.current = balls;
  }, [balls]);

  const getPinPositions = useCallback((width: number, height: number) => {
    const pins: { x: number; y: number }[] = [];
    const startY = 40;
    const endY = height - 50;
    const rowSpacing = (endY - startY) / (rows + 1);

    for (let row = 0; row <= rows; row++) {
      const pinsInRow = row + 3;
      const y = startY + row * rowSpacing;
      const totalWidth = (pinsInRow - 1) * rowSpacing;
      const startX = (width - totalWidth) / 2;

      for (let col = 0; col < pinsInRow; col++) {
        pins.push({ x: startX + col * rowSpacing, y });
      }
    }
    return { pins, rowSpacing, startY };
  }, [rows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);

      const { pins, rowSpacing, startY } = getPinPositions(width, height);

      // Draw glow behind pins
      pins.forEach(pin => {
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, PIN_RADIUS + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 140, 255, 0.06)';
        ctx.fill();
      });

      // Draw pins
      pins.forEach(pin => {
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, PIN_RADIUS, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(pin.x - 1, pin.y - 1, 0, pin.x, pin.y, PIN_RADIUS);
        gradient.addColorStop(0, '#8b9cf7');
        gradient.addColorStop(1, '#4a5aad');
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // Draw multiplier buckets
      const bucketY = startY + rows * rowSpacing + rowSpacing * 0.4;
      const numBuckets = rows + 1;
      const totalBucketWidth = rows * rowSpacing;
      const bucketWidth = totalBucketWidth / numBuckets;
      const bucketsStartX = (width - totalBucketWidth) / 2;

      multipliers.forEach((mult, i) => {
        const x = bucketsStartX + i * bucketWidth;
        const color = getMultiplierColor(mult);
        const isFlashing = flashingBucket === i;

        // Bucket background
        ctx.fillStyle = isFlashing
          ? color.replace(')', ', 0.4)').replace('rgb', 'rgba')
          : `rgba(${hexToRgb(color)}, 0.12)`;
        ctx.beginPath();
        ctx.roundRect(x + 1, bucketY, bucketWidth - 2, 28, 4);
        ctx.fill();

        // Bucket border
        ctx.strokeStyle = isFlashing ? color : `rgba(${hexToRgb(color)}, 0.3)`;
        ctx.lineWidth = isFlashing ? 2 : 1;
        ctx.stroke();

        // Multiplier text
        ctx.fillStyle = color;
        ctx.font = `bold ${bucketWidth < 30 ? 8 : bucketWidth < 40 ? 9 : 11}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${mult}x`, x + bucketWidth / 2, bucketY + 14);
      });

      // Update and draw balls
      const currentBalls = ballsRef.current;
      let updated = false;

      const newBalls = currentBalls.map(ball => {
        if (ball.done) return ball;

        let { x, y, vx, vy, currentRow, directions } = ball;
        const pixelX = x * width;
        const pixelY = y * (height - 80) + 20;

        // Target position for current row
        const targetRow = Math.min(currentRow, rows);
        const pinsInRow = targetRow + 3;
        const totalRowWidth = (pinsInRow - 1) * rowSpacing;
        const rowStartX = (width - totalRowWidth) / 2;
        const targetY = startY + targetRow * rowSpacing;

        vy += GRAVITY;
        vy *= FRICTION;
        vx *= FRICTION;

        let newPixelX = pixelX + vx;
        let newPixelY = pixelY + vy;

        // Check collision with pins in current row
        if (currentRow <= rows) {
          const rowPinsCount = currentRow + 3;
          const rowTotalWidth = (rowPinsCount - 1) * rowSpacing;
          const rowStartXCurr = (width - rowTotalWidth) / 2;

          for (let col = 0; col < rowPinsCount; col++) {
            const pinX = rowStartXCurr + col * rowSpacing;
            const pinY = startY + currentRow * rowSpacing;
            const dx = newPixelX - pinX;
            const dy = newPixelY - pinY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = PIN_RADIUS + BALL_RADIUS;

            if (dist < minDist && dist > 0) {
              soundManager.playPinHit(currentRow / rows);
              const direction = currentRow < directions.length ? directions[currentRow] : (Math.random() > 0.5 ? 1 : 0);
              const angle = direction === 1 ? Math.PI / 4 : -Math.PI / 4 + Math.PI;
              vx = Math.cos(angle) * 2.5 + (Math.random() - 0.5) * 0.5;
              vy = Math.abs(Math.sin(angle)) * 2;
              newPixelX = pinX + (dx / dist) * minDist;
              newPixelY = pinY + (dy / dist) * minDist;
              currentRow++;
              break;
            }
          }
        }

        // Check if ball reached bottom
        const done = newPixelY >= bucketY - 5;
        if (done) {
          newPixelY = bucketY - 5;
          vy = 0;
          vx = 0;
        }

        const newX = newPixelX / width;
        const newY = (newPixelY - 20) / (height - 80);

        // Trail
        const trail = [
          { x: newPixelX, y: newPixelY, opacity: 0.5 },
          ...ball.trail.map(t => ({ ...t, opacity: t.opacity - 0.08 })).filter(t => t.opacity > 0),
        ].slice(0, 8);

        updated = true;
        return { ...ball, x: newX, y: newY, vx, vy, currentRow, done, trail };
      });

      if (updated) {
        setBalls(newBalls);
      }

      // Draw ball trails and balls
      newBalls.forEach(ball => {
        if (ball.done && ball.trail.length === 0) return;
        const bx = ball.x * width;
        const by = ball.y * (height - 80) + 20;

        // Trail
        ball.trail.forEach(t => {
          ctx.beginPath();
          ctx.arc(t.x, t.y, BALL_RADIUS * t.opacity, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 200, 50, ${t.opacity * 0.3})`;
          ctx.fill();
        });

        // Ball glow
        ctx.beginPath();
        ctx.arc(bx, by, BALL_RADIUS + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 200, 50, 0.2)';
        ctx.fill();

        // Ball
        const ballGrad = ctx.createRadialGradient(bx - 2, by - 2, 0, bx, by, BALL_RADIUS);
        ballGrad.addColorStop(0, '#ffe066');
        ballGrad.addColorStop(1, '#f59e0b');
        ctx.beginPath();
        ctx.arc(bx, by, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ballGrad;
        ctx.fill();
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [rows, multipliers, flashingBucket, getPinPositions, setBalls]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 255';
}
