import { GameEngine, m2r, clamp, dist } from './engine';
import { Structure } from './engine';

function worldToScreen(engine: GameEngine, wx: number, wy: number, cw: number, ch: number) {
  return { x: (wx - engine.camera.x) * engine.camera.zoom + cw/2, y: (wy - engine.camera.y) * engine.camera.zoom + ch/2 };
}

export function renderFrame(engine: GameEngine, ctx: CanvasRenderingContext2D, cw: number, ch: number) {
  const { camera, activeMap, structures, foods, viruses, ejected, particles, bots, player } = engine;
  const w2s = (wx: number, wy: number) => worldToScreen(engine, wx, wy, cw, ch);

  // ── Background ──
  ctx.fillStyle = activeMap.bg;
  ctx.fillRect(0, 0, cw, ch);

  // Grid
  const gs = 50;
  ctx.strokeStyle = activeMap.gridColor;
  ctx.lineWidth = 1;
  const WORLD = 4000;
  const sx = Math.floor((camera.x - cw/2/camera.zoom) / gs) * gs;
  const ex = camera.x + cw/2/camera.zoom + gs;
  const sy = Math.floor((camera.y - ch/2/camera.zoom) / gs) * gs;
  const ey = camera.y + ch/2/camera.zoom + gs;
  ctx.beginPath();
  for (let x = sx; x <= ex; x += gs) { const s = w2s(x, 0); ctx.moveTo(s.x, 0); ctx.lineTo(s.x, ch); }
  for (let y = sy; y <= ey; y += gs) { const s = w2s(0, y); ctx.moveTo(0, s.y); ctx.lineTo(cw, s.y); }
  ctx.stroke();

  // World border
  const bc = activeMap.borderColor;
  const corners = [w2s(0,0), w2s(WORLD,0), w2s(WORLD,WORLD), w2s(0,WORLD)];
  ctx.strokeStyle = bc; ctx.lineWidth = 3; ctx.shadowBlur = 25; ctx.shadowColor = bc;
  ctx.beginPath(); ctx.moveTo(corners[0].x, corners[0].y);
  corners.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
  ctx.shadowBlur = 0;

  // ── Structures ──
  structures.forEach(s => {
    ctx.save();
    if (s.type === 'rect') {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = activeMap.borderColor; ctx.lineWidth = 2;
      const tl = w2s(s.x, s.y), br = w2s(s.x + s.w!, s.y + s.h!);
      ctx.fillRect(tl.x, tl.y, br.x-tl.x, br.y-tl.y);
      ctx.strokeRect(tl.x, tl.y, br.x-tl.x, br.y-tl.y);
    } else if (s.type === 'circle' || s.type === 'island') {
      const sc = w2s(s.x, s.y), sr = s.r! * camera.zoom;
      if (s.type === 'island') {
        ctx.fillStyle = 'rgba(0,255,100,0.08)'; ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(sc.x, sc.y, sr, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        if (sr > 20) { ctx.font = `${sr*0.4}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏝', sc.x, sc.y); }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.strokeStyle = activeMap.borderColor; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sc.x, sc.y, sr, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
    } else if (s.type === 'blob') {
      const sc = w2s(s.x, s.y);
      ctx.fillStyle = 'rgba(0,255,100,0.07)'; ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = s.seed! + (i/6)*Math.PI*2;
        const bx = sc.x + Math.cos(a)*s.r!*0.4*camera.zoom;
        const by = sc.y + Math.sin(a)*s.r!*0.4*camera.zoom;
        ctx.beginPath(); ctx.arc(bx, by, s.r!*0.65*camera.zoom, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  });

  // ── Food ──
  foods.forEach(f => {
    const s = w2s(f.x, f.y);
    const r = f.size * camera.zoom;
    if (r < 0.3) return;
    f.pulse += 0.05;
    ctx.beginPath(); ctx.arc(s.x, s.y, r + Math.sin(f.pulse)*r*0.2, 0, Math.PI*2);
    ctx.fillStyle = f.color; ctx.shadowBlur = 5; ctx.shadowColor = f.color; ctx.fill(); ctx.shadowBlur = 0;
  });

  // ── Viruses ──
  viruses.forEach(v => {
    const s = w2s(v.x, v.y), r = m2r(100) * camera.zoom;
    if (r < 1) return;
    v.angle += 0.008;
    ctx.beginPath();
    for (let i = 0; i < v.spikes*2; i++) {
      const a = v.angle + (i/(v.spikes*2))*Math.PI*2;
      const rr = i%2===0 ? r*1.2 : r*0.82;
      if (i===0) ctx.moveTo(s.x+Math.cos(a)*rr, s.y+Math.sin(a)*rr);
      else ctx.lineTo(s.x+Math.cos(a)*rr, s.y+Math.sin(a)*rr);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,255,100,.1)'; ctx.fill();
    ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = '#00ff66'; ctx.stroke(); ctx.shadowBlur = 0;
  });

  // ── Ejected ──
  ejected.forEach(em => {
    const s = w2s(em.x, em.y), r = Math.max(m2r(em.mass)*camera.zoom, 2);
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2);
    ctx.fillStyle = em.color || '#00ffd0'; ctx.fill();
  });

  // ── Particles ──
  particles.forEach(p => {
    const s = w2s(p.x, p.y), r = Math.max(p.size*camera.zoom*p.life, 0.3);
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2);
    ctx.fillStyle = p.color + Math.floor(p.life*255).toString(16).padStart(2,'0'); ctx.fill();
  });

  // ── Bots ──
  bots.forEach(bot => {
    bot.cells.forEach(cell => drawCell(ctx, camera.zoom, w2s, cell, bot.skin, bot.name, false));
  });

  // ── Player ──
  if (player && !player.dead) {
    player.cells.forEach(cell => drawCell(ctx, camera.zoom, w2s, cell, player.skin, player.name, true));
  }
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  zoom: number,
  w2s: (wx: number, wy: number) => {x:number; y:number},
  cell: { x: number; y: number; mass: number },
  skin: { draw: (c: CanvasRenderingContext2D, x: number, y: number, r: number) => void },
  name: string,
  isPlayer: boolean
) {
  const s = w2s(cell.x, cell.y);
  const r = m2r(cell.mass) * zoom;
  if (r < 0.4) return;

  if (isPlayer) {
    ctx.beginPath(); ctx.arc(s.x, s.y, r+5, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,255,208,0.07)'; ctx.fill();
  }

  ctx.save(); ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2); ctx.clip();
  try { skin.draw(ctx, s.x, s.y, r); } catch { ctx.fillStyle = '#00ffd0'; ctx.fillRect(s.x-r, s.y-r, r*2, r*2); }
  ctx.restore();

  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(1.5, r*0.04);
  ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2); ctx.stroke();

  if (r > 14) {
    const fs = clamp(r*0.32, 9, 24);
    ctx.font = `700 ${fs}px Unbounded,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(name, s.x, s.y+1);
    ctx.fillStyle = '#fff'; ctx.fillText(name, s.x, s.y);
  }
  if (r > 24) {
    ctx.font = `400 ${clamp(r*0.18, 7, 12)}px Space Mono,monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillText(String(Math.floor(cell.mass)), s.x, s.y+r*0.42);
  }
}

export function renderMinimap(engine: GameEngine, ctx: CanvasRenderingContext2D, W: number, H: number, cw: number, ch: number) {
  const sc = W / 4000;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, W, H);

  engine.structures.forEach(s => {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    if (s.type === 'rect') ctx.fillRect(s.x*sc, s.y*sc, s.w!*sc, s.h!*sc);
    else if (s.type === 'circle' || s.type === 'island') { ctx.beginPath(); ctx.arc(s.x*sc, s.y*sc, s.r!*sc, 0, Math.PI*2); ctx.fill(); }
  });

  engine.foods.forEach(f => { ctx.fillStyle = f.color; ctx.fillRect(f.x*sc-0.5, f.y*sc-0.5, 1, 1); });

  engine.bots.forEach(b => {
    b.cells.forEach(c => {
      const rr = Math.max(1.5, m2r(c.mass)*sc*0.6);
      ctx.beginPath(); ctx.arc(c.x*sc, c.y*sc, rr, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    });
  });

  if (engine.player) {
    engine.player.cells.forEach(c => {
      const rr = Math.max(2.5, m2r(c.mass)*sc*0.8);
      ctx.beginPath(); ctx.arc(c.x*sc, c.y*sc, rr, 0, Math.PI*2);
      ctx.fillStyle = '#00ffd0'; ctx.shadowBlur = 6; ctx.shadowColor = '#00ffd0'; ctx.fill(); ctx.shadowBlur = 0;
    });
    const cam = engine.camera;
    const vw = cw/cam.zoom*sc, vh = ch/cam.zoom*sc;
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1;
    ctx.strokeRect(cam.x*sc-vw/2, cam.y*sc-vh/2, vw, vh);
  }

  ctx.strokeStyle = engine.activeMap.borderColor; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, W, H);
}
