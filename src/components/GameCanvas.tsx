'use client';
import { useEffect, useRef, useCallback } from 'react';
import { GameEngine } from '@/lib/engine';
import { renderFrame, renderMinimap } from '@/lib/renderer';

interface Props {
  engine: GameEngine;
  onUpdate: () => void;
}

export default function GameCanvas({ engine, onUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef<number>(0);

  const loop = useCallback((ts: number) => {
    rafRef.current = requestAnimationFrame(loop);
    const dt = Math.min(ts - lastTimeRef.current, 50);
    lastTimeRef.current = ts;
    frameRef.current++;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width, ch = canvas.height;
    engine.setCanvasSize(cw, ch);
    engine.update(dt);
    renderFrame(engine, ctx, cw, ch);

    if (frameRef.current % 7 === 0) {
      const mini = miniRef.current;
      if (mini) {
        const mCtx = mini.getContext('2d');
        if (mCtx) renderMinimap(engine, mCtx, 150, 150, cw, ch);
      }
      onUpdate(); // trigger React re-render for HUD
    }
  }, [engine, onUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e: MouseEvent) => { engine.mouse.x = e.clientX; engine.mouse.y = e.clientY; };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); engine.split(); }
      if (e.code === 'KeyW') engine.eject();
      if (e.code === 'KeyQ') engine.forceMerge();
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [engine, loop]);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, display: 'block' }} />
      <canvas
        ref={miniRef}
        width={150} height={150}
        style={{ position: 'fixed', bottom: 12, right: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', zIndex: 21 }}
      />
    </>
  );
}
