'use client';
import { useEffect, useRef } from 'react';
import { SKINS } from '@/lib/skins';

interface Props { skinId: number; size?: number; style?: React.CSSProperties; }

export default function SkinCanvas({ skinId, size = 46, style }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width/2, cy = canvas.height/2, r = cx*0.88;
    try { SKINS[skinId]?.draw(ctx, cx, cy, r); } catch {}
  }, [skinId]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size, borderRadius: '50%', ...style }} />;
}
