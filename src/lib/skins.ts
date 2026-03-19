// ── SKIN DRAW HELPERS ──
type Ctx = CanvasRenderingContext2D;

export function gradCircle(c: Ctx, x: number, y: number, r: number, c1: string, c2: string) {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
export function ring(c: Ctx, x: number, y: number, r: number, col: string, lw = 3) {
  c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
}
export function emojiDraw(c: Ctx, x: number, y: number, r: number, e: string) {
  c.font = `${r * 1.4}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, x, y + r * 0.05);
}
export function clip(c: Ctx, x: number, y: number, r: number, fn: () => void) {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip(); fn(); c.restore();
}
export function poly(c: Ctx, x: number, y: number, r: number, n: number, a = 0, f = '#fff') {
  c.beginPath();
  for (let i = 0; i < n; i++) { const ang = a + (i / n) * Math.PI * 2; const xi = x + Math.cos(ang) * r, yi = y + Math.sin(ang) * r; i === 0 ? c.moveTo(xi, yi) : c.lineTo(xi, yi); }
  c.closePath(); c.fillStyle = f; c.fill();
}
export function star(c: Ctx, x: number, y: number, r: number, n = 5, f = '#ffd700') {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n; const ri = i % 2 === 0 ? r : r * 0.4; c.lineTo(x + Math.cos(a) * ri, y + Math.sin(a) * ri); }
  c.closePath(); c.fillStyle = f; c.fill();
}
export function stripes(c: Ctx, x: number, y: number, r: number, cols: string[], a = 0) {
  clip(c, x, y, r, () => {
    const w = (r * 2) / cols.length;
    cols.forEach((col, i) => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; c.fillRect(-r + i * w, -r, w, r * 2); c.restore(); });
  });
}
export function checkers(c: Ctx, x: number, y: number, r: number, c1: string, c2: string, n = 4) {
  clip(c, x, y, r, () => {
    const s = (r * 2) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = (i + j) % 2 === 0 ? c1 : c2; c.fillRect(x - r + i * s, y - r + j * s, s, s); }
  });
}

export type SkinDrawFn = (c: Ctx, x: number, y: number, r: number) => void;

export interface Skin {
  id: number;
  name: string;
  category: string;
  xpRequired: number;
  draw: SkinDrawFn;
}

function makeSkin(id: number, name: string, category: string, xpRequired: number, drawFn: SkinDrawFn): Skin {
  return { id, name, category, xpRequired, draw: drawFn };
}

export const CATEGORIES = ['All', 'Classic', 'Meme', 'Kawaii', 'Cyberpunk', 'Art', 'Nature', 'Space', 'Food', 'Retro', 'Mythic'];

export const SKINS: Skin[] = [
  makeSkin(0, 'Classic Mint', 'Classic', 0, (c, x, y, r) => { gradCircle(c, x, y, r, '#6fffd4', '#00c896'); ring(c, x, y, r, '#00a87a'); }),
  makeSkin(1, 'Solar Flare', 'Classic', 50, (c, x, y, r) => { gradCircle(c, x, y, r, '#ffea80', '#ff6b00'); ring(c, x, y, r, '#e05000'); }),
  makeSkin(2, 'Cobalt', 'Classic', 80, (c, x, y, r) => { gradCircle(c, x, y, r, '#74b9ff', '#0056e0'); ring(c, x, y, r, '#003faa'); }),
  makeSkin(3, 'Crimson', 'Classic', 120, (c, x, y, r) => { gradCircle(c, x, y, r, '#ff758c', '#c70039'); ring(c, x, y, r, '#8b0020'); }),
  makeSkin(4, 'Amethyst', 'Classic', 160, (c, x, y, r) => { gradCircle(c, x, y, r, '#d8b4fe', '#7c3aed'); ring(c, x, y, r, '#5b21b6'); }),
  makeSkin(5, 'Onyx', 'Classic', 200, (c, x, y, r) => { gradCircle(c, x, y, r, '#6b7280', '#111827'); ring(c, x, y, r, '#374151'); c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); }),
  makeSkin(6, 'Rose Gold', 'Classic', 250, (c, x, y, r) => { gradCircle(c, x, y, r, '#ffd6e0', '#c77daa'); ring(c, x, y, r, '#9d4e7a'); }),
  makeSkin(7, 'Forest', 'Classic', 300, (c, x, y, r) => { gradCircle(c, x, y, r, '#84efac', '#166534'); ring(c, x, y, r, '#14532d'); }),
  makeSkin(8, 'Tangerine', 'Classic', 350, (c, x, y, r) => { gradCircle(c, x, y, r, '#fed7aa', '#ea580c'); ring(c, x, y, r, '#c2410c'); }),
  makeSkin(9, 'Ice', 'Classic', 400, (c, x, y, r) => { gradCircle(c, x, y, r, '#e0f2fe', '#7dd3fc'); ring(c, x, y, r, '#38bdf8'); clip(c, x, y, r, () => { c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x - r, y - r, r * 0.6, r * 2); }); }),
  makeSkin(10, 'Doge', 'Meme', 100, (c, x, y, r) => { gradCircle(c, x, y, r, '#f5d08a', '#c8950a'); emojiDraw(c, x, y, r, '🐕'); }),
  makeSkin(11, 'Much Wow', 'Meme', 200, (c, x, y, r) => { gradCircle(c, x, y, r, '#fef9c3', '#fbbf24'); emojiDraw(c, x, y, r, '😮'); const ts = ['wow', 'such blob', 'very eat', 'amaze']; ts.forEach((t, i) => { c.font = `bold ${r * 0.18}px sans-serif`; c.fillStyle = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96e6a1'][i]; c.textAlign = 'center'; c.fillText(t, x + Math.cos(i * 1.57) * r * 0.6, y + Math.sin(i * 1.57) * r * 0.6); }); }),
  makeSkin(12, 'Pepe', 'Meme', 150, (c, x, y, r) => { gradCircle(c, x, y, r, '#78c800', '#4a7c00'); emojiDraw(c, x, y, r, '🐸'); }),
  makeSkin(13, 'OK Boomer', 'Meme', 180, (c, x, y, r) => { gradCircle(c, x, y, r, '#d4d4d4', '#737373'); c.fillStyle = '#171717'; c.font = `bold ${r * 0.28}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ok boomer', x, y); }),
  makeSkin(14, 'NPC', 'Meme', 220, (c, x, y, r) => { gradCircle(c, x, y, r, '#808080', '#404040'); emojiDraw(c, x, y, r, '😐'); c.fillStyle = 'rgba(255,255,255,0.5)'; c.font = `${r * 0.2}px monospace`; c.textAlign = 'center'; c.fillText('NPC', x, y + r * 0.55); }),
  makeSkin(15, 'Trollface', 'Meme', 280, (c, x, y, r) => { gradCircle(c, x, y, r, '#e8d5b7', '#c4a876'); emojiDraw(c, x, y, r, '😏'); }),
  makeSkin(16, 'Stonks', 'Meme', 320, (c, x, y, r) => { stripes(c, x, y, r, ['#16a34a', '#15803d', '#166534']); emojiDraw(c, x, y, r, '📈'); }),
  makeSkin(17, 'Gigachad', 'Meme', 380, (c, x, y, r) => { gradCircle(c, x, y, r, '#bfdbfe', '#1e3a8a'); emojiDraw(c, x, y, r, '😎'); }),
  makeSkin(18, 'This Is Fine', 'Meme', 440, (c, x, y, r) => { gradCircle(c, x, y, r, '#fde68a', '#f59e0b'); emojiDraw(c, x, y, r, '🔥'); }),
  makeSkin(19, 'Shrek', 'Meme', 500, (c, x, y, r) => { gradCircle(c, x, y, r, '#84cc16', '#3f6212'); emojiDraw(c, x, y, r, '🧅'); }),
  makeSkin(20, 'Nyan Cat', 'Meme', 550, (c, x, y, r) => { stripes(c, x, y, r, ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'], 0); c.font = `${r * 0.7}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🐱', x, y); }),
  makeSkin(21, 'Distracted BF', 'Meme', 600, (c, x, y, r) => { gradCircle(c, x, y, r, '#fed7aa', '#fb923c'); emojiDraw(c, x, y, r, '👀'); }),
  makeSkin(22, 'Drake NO', 'Meme', 650, (c, x, y, r) => { stripes(c, x, y, r, ['#1c1917', '#292524'], Math.PI / 2); c.fillStyle = '#ef4444'; c.font = `bold ${r * 0.55}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('❌', x, y - r * 0.2); c.fillStyle = '#22c55e'; c.fillText('✅', x, y + r * 0.55); }),
  makeSkin(23, 'Wojak', 'Meme', 700, (c, x, y, r) => { gradCircle(c, x, y, r, '#fde8d8', '#daa28a'); emojiDraw(c, x, y, r, '😢'); }),
  makeSkin(24, 'GigaBlob', 'Meme', 800, (c, x, y, r) => { gradCircle(c, x, y, r, '#a855f7', '#1e1b4b'); ring(c, x, y, r, '#7c3aed', 4); c.fillStyle = '#fff'; c.font = `bold ${r * 0.22}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('GIGA', x, y - r * 0.1); c.fillStyle = '#fbbf24'; c.fillText('BLOB', x, y + r * 0.35); }),
  makeSkin(25, 'Sakura', 'Kawaii', 100, (c, x, y, r) => { gradCircle(c, x, y, r, '#fce7f3', '#f9a8d4'); emojiDraw(c, x, y, r, '🌸'); }),
  makeSkin(26, 'UwU', 'Kawaii', 150, (c, x, y, r) => { gradCircle(c, x, y, r, '#fde8f5', '#fba8d4'); c.fillStyle = '#be185d'; c.font = `bold ${r * 0.55}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('uwu', x, y); }),
  makeSkin(27, 'Star Eyes', 'Kawaii', 200, (c, x, y, r) => { gradCircle(c, x, y, r, '#fef9c3', '#fde047'); emojiDraw(c, x, y, r, '🤩'); }),
  makeSkin(28, 'Bunny', 'Kawaii', 250, (c, x, y, r) => { gradCircle(c, x, y, r, '#f3f4f6', '#e5e7eb'); emojiDraw(c, x, y, r, '🐰'); }),
  makeSkin(29, 'Kitty', 'Kawaii', 300, (c, x, y, r) => { gradCircle(c, x, y, r, '#fbcfe8', '#f472b6'); emojiDraw(c, x, y, r, '🐱'); }),
  makeSkin(30, 'Panda', 'Kawaii', 350, (c, x, y, r) => { gradCircle(c, x, y, r, '#f9fafb', '#e5e7eb'); emojiDraw(c, x, y, r, '🐼'); }),
  makeSkin(31, 'Mochi', 'Kawaii', 400, (c, x, y, r) => { gradCircle(c, x, y, r, '#fce7f3', '#fbcfe8'); ring(c, x, y, r, '#f9a8d4', 2); emojiDraw(c, x, y, r, '🍡'); }),
  makeSkin(32, 'Totoro', 'Kawaii', 450, (c, x, y, r) => { gradCircle(c, x, y, r, '#9ca3af', '#4b5563'); emojiDraw(c, x, y, r, '🌿'); }),
  makeSkin(33, 'Sailor Moon', 'Kawaii', 500, (c, x, y, r) => { stripes(c, x, y, r, ['#fce7f3', '#fffbeb', '#fce7f3'], 0); emojiDraw(c, x, y, r, '🌙'); star(c, x, y + r * 0.55, r * 0.2, 5, '#fbbf24'); }),
  makeSkin(34, 'Pikachu', 'Kawaii', 550, (c, x, y, r) => { gradCircle(c, x, y, r, '#fef08a', '#facc15'); emojiDraw(c, x, y, r, '⚡'); c.fillStyle = '#ca8a04'; c.beginPath(); c.arc(x - r * 0.4, y + r * 0.1, r * 0.25, 0, Math.PI * 2); c.arc(x + r * 0.4, y + r * 0.1, r * 0.25, 0, Math.PI * 2); c.fill(); }),
  makeSkin(35, 'Shiba', 'Kawaii', 600, (c, x, y, r) => { gradCircle(c, x, y, r, '#fcd34d', '#f59e0b'); emojiDraw(c, x, y, r, '🐕‍🦺'); }),
  makeSkin(36, 'Axolotl', 'Kawaii', 650, (c, x, y, r) => { gradCircle(c, x, y, r, '#fbcfe8', '#f9a8d4'); emojiDraw(c, x, y, r, '🫧'); }),
  makeSkin(37, 'Rainbow Tears', 'Kawaii', 700, (c, x, y, r) => { stripes(c, x, y, r, ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'], 0); emojiDraw(c, x, y, r, '😭'); }),
  makeSkin(38, 'Sugar Rush', 'Kawaii', 750, (c, x, y, r) => { gradCircle(c, x, y, r, '#fce7f3', '#fbcfe8'); ['🍭', '🍬', '🍓'].forEach((e, i) => { c.font = `${r * 0.3}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; const a = (i / 3) * Math.PI * 2 - Math.PI / 2; c.fillText(e, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); }); }),
  makeSkin(39, 'Angel', 'Kawaii', 850, (c, x, y, r) => { gradCircle(c, x, y, r, '#fffbeb', '#fef3c7'); ring(c, x, y, r, '#fbbf24', 2); emojiDraw(c, x, y, r, '👼'); }),
  makeSkin(40, 'Neon Wire', 'Cyberpunk', 200, (c, x, y, r) => { gradCircle(c, x, y, r, '#0f0f1a', '#1a0a2e'); ring(c, x, y, r, '#00ffff', 2); ring(c, x, y, r * 0.75, '#ff00ff', 1); c.fillStyle = '#00ffff'; c.font = `bold ${r * 0.2}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SYS', x, y); }),
  makeSkin(41, 'Glitch', 'Cyberpunk', 280, (c, x, y, r) => { gradCircle(c, x, y, r, '#1a1a2e', '#16213e'); clip(c, x, y, r, () => { [['#ff0055', 2], ['#0066ff', -2], ['#00ff88', 0]].forEach(([col, off]) => { c.fillStyle = col as string; c.globalAlpha = 0.7; c.fillRect(x - r + (off as number), y - r, r * 2, r * 0.33); c.fillRect(x - r - (off as number), y - r + r * 0.33, r * 2, r * 0.33); c.fillRect(x - r + (off as number) * 2, y - r + r * 0.66, r * 2, r * 0.34); }); c.globalAlpha = 1; }); c.fillStyle = '#fff'; c.font = `bold ${r * 0.35}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ERR', x, y); }),
  makeSkin(42, 'Synthwave', 'Cyberpunk', 350, (c, x, y, r) => { const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, '#ff006e'); g.addColorStop(0.5, '#8338ec'); g.addColorStop(1, '#3a86ff'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }),
  makeSkin(43, 'Hacker', 'Cyberpunk', 420, (c, x, y, r) => { gradCircle(c, x, y, r, '#001a00', '#003300'); c.fillStyle = '#00ff41'; c.font = `bold ${r * 0.22}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('>_', x, y); }),
  makeSkin(44, 'Cyber Skull', 'Cyberpunk', 480, (c, x, y, r) => { gradCircle(c, x, y, r, '#1f2937', '#111827'); emojiDraw(c, x, y, r, '💀'); ring(c, x, y, r, '#ef4444', 2); }),
  makeSkin(45, 'Plasma', 'Cyberpunk', 540, (c, x, y, r) => { gradCircle(c, x, y, r, '#4c1d95', '#7c3aed'); for (let i = 0; i < 6; i++) { c.strokeStyle = `hsla(${280 + i * 10},100%,${60 + i * 5}%,0.4)`; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r * (0.3 + i * 0.12), 0, Math.PI * 2); c.stroke(); } c.fillStyle = '#e9d5ff'; c.font = `bold ${r * 0.22}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PWR', x, y); }),
  makeSkin(46, 'Drone', 'Cyberpunk', 600, (c, x, y, r) => { gradCircle(c, x, y, r, '#111827', '#374151'); [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([dx, dy]) => { c.strokeStyle = '#06b6d4'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx * r * 0.7, y + dy * r * 0.3); c.stroke(); c.beginPath(); c.arc(x + dx * r * 0.7, y + dy * r * 0.3, r * 0.2, 0, Math.PI * 2); c.stroke(); }); ring(c, x, y, r * 0.2, '#06b6d4', 2); }),
  makeSkin(47, 'Neural', 'Cyberpunk', 660, (c, x, y, r) => { gradCircle(c, x, y, r, '#0f172a', '#1e1b4b'); const ns = [[0, 0], [0.6, 0], [-0.5, 0.4], [0.3, -0.6], [-0.4, -0.3]].map(([nx, ny]) => ({ x: x + nx * r, y: y + ny * r })); ns.forEach((n, i) => { ns.forEach((m, j) => { if (i < j && Math.random() > 0.3) { c.strokeStyle = 'rgba(139,92,246,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(n.x, n.y); c.lineTo(m.x, m.y); c.stroke(); } }); }); ns.forEach(n => { c.fillStyle = '#a78bfa'; c.beginPath(); c.arc(n.x, n.y, r * 0.07, 0, Math.PI * 2); c.fill(); }); }),
  makeSkin(48, 'Vaporwave', 'Cyberpunk', 720, (c, x, y, r) => { stripes(c, x, y, r, ['#ff71ce', '#b967ff', '#05ffa1', '#01cdfe'], 0); c.fillStyle = 'rgba(0,0,0,0.4)'; c.font = `bold ${r * 0.4}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Ａ', x, y); }),
  makeSkin(49, 'Cyber Cat', 'Cyberpunk', 780, (c, x, y, r) => { gradCircle(c, x, y, r, '#0f0a1e', '#1a0a2e'); emojiDraw(c, x, y, r, '😼'); ring(c, x, y, r, '#ff00ff', 2); }),
  makeSkin(50, 'Hologram', 'Cyberpunk', 850, (c, x, y, r) => { clip(c, x, y, r, () => { for (let i = 0; i < 20; i++) { c.fillStyle = `hsla(${180 + i * 9},100%,60%,0.12)`; c.fillRect(x - r, y - r + i * r * 0.1, r * 2, r * 0.05); } }); ring(c, x, y, r, 'rgba(0,255,255,0.6)', 2); c.fillStyle = 'rgba(0,255,255,0.8)'; c.font = `bold ${r * 0.2}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('HOLO', x, y); }),
  makeSkin(51, 'Samurai', 'Cyberpunk', 920, (c, x, y, r) => { gradCircle(c, x, y, r, '#1a0000', '#3d0000'); ring(c, x, y, r, '#dc2626', 3); emojiDraw(c, x, y, r, '⚔️'); }),
  makeSkin(52, 'Ghost Protocol', 'Cyberpunk', 1000, (c, x, y, r) => { clip(c, x, y, r, () => { c.fillStyle = 'rgba(0,255,200,0.05)'; c.fillRect(x - r, y - r, r * 2, r * 2); }); ring(c, x, y, r, 'rgba(0,255,200,0.5)', 1); emojiDraw(c, x, y, r, '👁'); }),
  makeSkin(53, 'Rogue AI', 'Cyberpunk', 1100, (c, x, y, r) => { gradCircle(c, x, y, r, '#0a0a0a', '#1a1a1a'); ring(c, x, y, r, '#ff0000', 3); c.fillStyle = '#ff0000'; c.font = `bold ${r * 0.5}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('AI', x, y); }),
  makeSkin(54, 'Neon God', 'Cyberpunk', 1200, (c, x, y, r) => { gradCircle(c, x, y, r, '#050510', '#0a0520'); ['#ff00ff', '#00ffff', '#ff0080', '#0080ff'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r * (0.4 + i * 0.15), i * Math.PI / 4, i * Math.PI / 4 + Math.PI * 1.5); c.stroke(); }); star(c, x, y, r * 0.35, 6, '#ffffff'); }),
  makeSkin(55, 'Monet', 'Art', 300, (c, x, y, r) => { clip(c, x, y, r, () => { ['#4ade80', '#60a5fa', '#f472b6', '#facc15', '#a78bfa'].forEach((col) => { c.fillStyle = col; c.globalAlpha = 0.6; c.beginPath(); c.ellipse(x - r + Math.random() * r * 2, y - r + Math.random() * r * 2, r * 0.3 + Math.random() * r * 0.2, r * 0.15, Math.random() * Math.PI, 0, Math.PI * 2); c.fill(); }); c.globalAlpha = 1; }); }),
  makeSkin(56, 'Mondrian', 'Art', 400, (c, x, y, r) => { clip(c, x, y, r, () => { [['#ef4444', x - r, y - r, r, r * 0.6], ['#3b82f6', x, y - r, r, r * 0.6], ['#ffffff', x - r, y - r + r * 0.6, r * 0.6, r * 0.8], ['#eab308', x - r + r * 0.6, y - r + r * 0.6, r * 0.4, r * 0.4], ['#ffffff', x - r + r * 0.6, y - r + r, r * 0.4, r * 0.6]].forEach(([col, rx, ry, rw, rh]) => { c.fillStyle = col as string; c.fillRect(rx as number, ry as number, rw as number, rh as number); }); c.strokeStyle = '#000'; c.lineWidth = 3; [x, x - r * 0.4].forEach(cx => { c.beginPath(); c.moveTo(cx, y - r); c.lineTo(cx, y + r); c.stroke(); }); [y - r * 0.4, y + r * 0.3].forEach(cy => { c.beginPath(); c.moveTo(x - r, cy); c.lineTo(x + r, cy); c.stroke(); }); }); }),
  makeSkin(57, 'Starry Night', 'Art', 500, (c, x, y, r) => { clip(c, x, y, r, () => { c.fillStyle = '#1e3a5f'; c.fillRect(x - r, y - r, r * 2, r * 2); for (let i = 0; i < 20; i++) { c.fillStyle = `rgba(255,255,200,${Math.random() * 0.8 + 0.2})`; c.beginPath(); c.arc(x - r + Math.random() * r * 2, y - r + Math.random() * r, Math.random() * r * 0.06 + 0.5, 0, Math.PI * 2); c.fill(); } c.strokeStyle = '#c4a35a'; c.lineWidth = 4; c.beginPath(); c.arc(x, y + r * 0.3, r * 0.4, Math.PI, 0); c.stroke(); }); }),
  makeSkin(58, 'Warhol', 'Art', 600, (c, x, y, r) => { const cols: [string, string][] = [['#ef4444', '#fbbf24'], ['#22c55e', '#3b82f6'], ['#f472b6', '#a78bfa'], ['#fb923c', '#34d399']]; clip(c, x, y, r, () => { cols.forEach(([bg, fg], i) => { const qx = x + (i % 2 === 0 ? -r : 0), qy = y + (i < 2 ? -r : 0); c.fillStyle = bg; c.fillRect(qx, qy, r, r); c.fillStyle = fg; c.font = `bold ${r * 0.35}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('B', qx + r / 2, qy + r / 2); }); }); }),
  makeSkin(59, 'Psychedelic', 'Art', 700, (c, x, y, r) => { for (let i = 10; i > 0; i--) { c.fillStyle = `hsl(${i * 36},100%,50%)`; c.beginPath(); c.arc(x, y, r * i / 10, 0, Math.PI * 2); c.fill(); } c.fillStyle = 'rgba(0,0,0,0.5)'; c.font = `bold ${r * 0.4}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✦', x, y); }),
  makeSkin(60, 'Bauhaus', 'Art', 800, (c, x, y, r) => { clip(c, x, y, r, () => { c.fillStyle = '#fbbf24'; c.fillRect(x - r, y - r, r * 2, r * 2); c.fillStyle = '#1e3a8a'; c.beginPath(); c.arc(x, y + r * 0.1, r * 0.65, 0, Math.PI * 2); c.fill(); c.fillStyle = '#dc2626'; c.beginPath(); c.moveTo(x - r * 0.7, y - r * 0.05); c.lineTo(x + r * 0.7, y - r * 0.05); c.lineTo(x, y - r * 0.9); c.fill(); }); }),
  makeSkin(61, 'Van Gogh', 'Art', 900, (c, x, y, r) => { gradCircle(c, x, y, r, '#fbbf24', '#d97706'); clip(c, x, y, r, () => { for (let i = 0; i < 8; i++) { c.strokeStyle = `hsl(${40 + i * 5},80%,${40 + i * 5}%)`; c.lineWidth = 3; c.beginPath(); c.arc(x + Math.cos(i) * r * 0.3, y + Math.sin(i) * r * 0.3, r * (0.2 + i * 0.08), i * 0.4, i * 0.4 + Math.PI * 1.8); c.stroke(); } }); emojiDraw(c, x, y, r, '🎨'); }),
  makeSkin(62, 'Suprematism', 'Art', 1000, (c, x, y, r) => { clip(c, x, y, r, () => { c.fillStyle = '#fff'; c.fillRect(x - r, y - r, r * 2, r * 2); c.fillStyle = '#111'; c.fillRect(x - r * 0.5, y - r * 0.5, r * 0.3, r * 0.8); c.fillStyle = '#dc2626'; c.beginPath(); c.arc(x + r * 0.2, y - r * 0.1, r * 0.35, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1d4ed8'; c.beginPath(); c.moveTo(x - r * 0.1, y + r * 0.1); c.lineTo(x + r * 0.5, y + r * 0.1); c.lineTo(x + r * 0.2, y + r * 0.6); c.fill(); }); }),
  makeSkin(63, 'Abstract Soul', 'Art', 1100, (c, x, y, r) => { gradCircle(c, x, y, r, '#0f0f0f', '#1a0a0a'); const pts = 8; for (let i = 0; i < pts; i++) { const a = (i / pts) * Math.PI * 2, a2 = ((i + 0.5) / pts) * Math.PI * 2; c.fillStyle = `hsl(${i * 45},80%,60%)`; c.globalAlpha = 0.7; c.beginPath(); c.moveTo(x, y); c.arc(x, y, r * 0.85, a, a2); c.fill(); } c.globalAlpha = 1; c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.arc(x, y, r * 0.3, 0, Math.PI * 2); c.fill(); }),
  makeSkin(64, 'Renaissance', 'Art', 1300, (c, x, y, r) => { gradCircle(c, x, y, r, '#8b6914', '#d4a017'); ring(c, x, y, r, '#d4a017', 3); c.fillStyle = '#fff8e7'; c.font = `${r * 0.45}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✦', x, y); }),
  makeSkin(65, 'Leafy', 'Nature', 200, (c, x, y, r) => { gradCircle(c, x, y, r, '#bbf7d0', '#16a34a'); emojiDraw(c, x, y, r, '🌿'); }),
  makeSkin(66, 'Ocean', 'Nature', 350, (c, x, y, r) => { const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, '#0ea5e9'); g.addColorStop(1, '#0c4a6e'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); emojiDraw(c, x, y, r, '🌊'); }),
  makeSkin(67, 'Volcano', 'Nature', 500, (c, x, y, r) => { gradCircle(c, x, y, r, '#292524', '#1c1917'); emojiDraw(c, x, y, r, '🌋'); }),
  makeSkin(68, 'Aurora', 'Nature', 700, (c, x, y, r) => { clip(c, x, y, r, () => { const g = c.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, '#06b6d4'); g.addColorStop(0.4, '#22c55e'); g.addColorStop(0.7, '#a855f7'); g.addColorStop(1, '#3b82f6'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }); ring(c, x, y, r, 'rgba(255,255,255,0.2)', 2); }),
  makeSkin(69, 'Crystal', 'Nature', 900, (c, x, y, r) => { gradCircle(c, x, y, r, '#e0f2fe', '#7dd3fc'); poly(c, x, y, r * 0.9, 6, Math.PI / 6, 'rgba(186,230,253,0.5)'); ring(c, x, y, r, '#38bdf8', 2); }),
  makeSkin(70, 'Black Hole', 'Space', 500, (c, x, y, r) => { gradCircle(c, x, y, r, '#111', '#000'); for (let i = 5; i > 0; i--) { c.strokeStyle = `rgba(139,92,246,${i * 0.1})`; c.lineWidth = i * 1.5; c.beginPath(); c.arc(x, y, r * i * 0.18, 0, Math.PI * 2); c.stroke(); } c.fillStyle = '#000'; c.beginPath(); c.arc(x, y, r * 0.2, 0, Math.PI * 2); c.fill(); }),
  makeSkin(71, 'Nebula', 'Space', 700, (c, x, y, r) => { clip(c, x, y, r, () => { ['#4c1d95', '#1e1b4b', '#831843', '#0c4a6e'].forEach((col, i) => { c.fillStyle = col; c.globalAlpha = 0.8; c.beginPath(); c.ellipse(x + Math.cos(i * 1.57) * r * 0.3, y + Math.sin(i * 1.57) * r * 0.3, r * 0.7, r * 0.5, i * Math.PI / 4, 0, Math.PI * 2); c.fill(); }); c.globalAlpha = 1; for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(x - r + Math.random() * r * 2, y - r + Math.random() * r * 2, Math.random() * 1.5, 0, Math.PI * 2); c.fill(); } }); }),
  makeSkin(72, 'Astronaut', 'Space', 600, (c, x, y, r) => { gradCircle(c, x, y, r, '#e5e7eb', '#9ca3af'); emojiDraw(c, x, y, r, '👨‍🚀'); ring(c, x, y, r, '#6b7280', 2); }),
  makeSkin(73, 'Alien', 'Space', 450, (c, x, y, r) => { gradCircle(c, x, y, r, '#4ade80', '#15803d'); emojiDraw(c, x, y, r, '👽'); }),
  makeSkin(74, 'Star Cluster', 'Space', 800, (c, x, y, r) => { gradCircle(c, x, y, r, '#0f0a2e', '#1a1060'); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,200,${Math.random()})`; c.beginPath(); c.arc(x - r + Math.random() * r * 2, y - r + Math.random() * r * 2, Math.random() * 2 + 0.5, 0, Math.PI * 2); c.fill(); } star(c, x, y, r * 0.3, 5, '#fbbf24'); }),
  makeSkin(75, 'Pizza', 'Food', 200, (c, x, y, r) => { gradCircle(c, x, y, r, '#fed7aa', '#f97316'); emojiDraw(c, x, y, r, '🍕'); }),
  makeSkin(76, 'Sushi', 'Food', 300, (c, x, y, r) => { gradCircle(c, x, y, r, '#fef9c3', '#fde047'); emojiDraw(c, x, y, r, '🍣'); }),
  makeSkin(77, 'Donut', 'Food', 400, (c, x, y, r) => { gradCircle(c, x, y, r, '#fce7f3', '#f9a8d4'); emojiDraw(c, x, y, r, '🍩'); }),
  makeSkin(78, 'Ramen', 'Food', 500, (c, x, y, r) => { gradCircle(c, x, y, r, '#fef3c7', '#fbbf24'); emojiDraw(c, x, y, r, '🍜'); }),
  makeSkin(79, 'Waffle', 'Food', 600, (c, x, y, r) => { checkers(c, x, y, r, '#f59e0b', '#d97706', 6); emojiDraw(c, x, y, r, '🧇'); }),
  makeSkin(80, 'Pacman', 'Retro', 300, (c, x, y, r) => { gradCircle(c, x, y, r, '#fef08a', '#facc15'); c.fillStyle = '#facc15'; c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, 0.3, Math.PI * 1.7); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(x + r * 0.1, y - r * 0.4, r * 0.1, 0, Math.PI * 2); c.fill(); }),
  makeSkin(81, 'Pixel Art', 'Retro', 400, (c, x, y, r) => { clip(c, x, y, r, () => { const s = r * 0.25; const grid = [['#ef4444', '#fbbf24', '#ef4444', '#fbbf24'], ['#3b82f6', '#22c55e', '#3b82f6', '#22c55e'], ['#ef4444', '#fbbf24', '#ef4444', '#fbbf24'], ['#3b82f6', '#22c55e', '#3b82f6', '#22c55e']]; grid.forEach((row, j) => row.forEach((col, i) => { c.fillStyle = col; c.fillRect(x - r * 0.5 + i * s, y - r * 0.5 + j * s, s, s); })); }); }),
  makeSkin(82, '8-bit Heart', 'Retro', 500, (c, x, y, r) => { gradCircle(c, x, y, r, '#fce7f3', '#fbcfe8'); c.fillStyle = '#dc2626'; const s = r * 0.12; const h = [[0, 1, 1, 0, 0, 0, 1, 1, 0], [1, 1, 1, 1, 0, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1], [0, 1, 1, 1, 1, 1, 1, 1, 0], [0, 0, 1, 1, 1, 1, 1, 0, 0], [0, 0, 0, 1, 1, 1, 0, 0, 0], [0, 0, 0, 0, 1, 0, 0, 0, 0]]; h.forEach((row, j) => row.forEach((px, i) => { if (px) c.fillRect(x - r * 0.54 + i * s, y - r * 0.4 + j * s, s, s); })); }),
  makeSkin(83, 'Space Invader', 'Retro', 600, (c, x, y, r) => { gradCircle(c, x, y, r, '#0f172a', '#1e293b'); c.fillStyle = '#22c55e'; const s = r * 0.11; const inv = [[0, 0, 1, 0, 0, 0, 0, 1, 0, 0], [0, 0, 0, 1, 0, 0, 1, 0, 0, 0], [0, 0, 1, 1, 1, 1, 1, 1, 0, 0], [0, 1, 1, 0, 1, 1, 0, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 0, 1, 0, 0, 0, 0, 1, 0, 1], [0, 0, 0, 1, 1, 1, 1, 0, 0, 0]]; inv.forEach((row, j) => row.forEach((px, i) => { if (px) c.fillRect(x - r * 0.55 + i * s, y - r * 0.4 + j * s, s, s); })); }),
  makeSkin(84, 'Tetris', 'Retro', 700, (c, x, y, r) => { clip(c, x, y, r, () => { [['#ef4444', 0, 0], ['#3b82f6', 1, 0], ['#22c55e', 0, 1], ['#eab308', 1, 1]].forEach(([col, dx, dy]) => { c.fillStyle = col as string; c.fillRect(x - r + (dx as number) * r, y - r + (dy as number) * r, r, r); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2; c.strokeRect(x - r + (dx as number) * r, y - r + (dy as number) * r, r, r); }); }); }),
  makeSkin(85, 'Dragon', 'Mythic', 600, (c, x, y, r) => { gradCircle(c, x, y, r, '#7f1d1d', '#450a0a'); emojiDraw(c, x, y, r, '🐉'); }),
  makeSkin(86, 'Phoenix', 'Mythic', 800, (c, x, y, r) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#fef08a'); g.addColorStop(0.4, '#f97316'); g.addColorStop(1, '#dc2626'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); emojiDraw(c, x, y, r, '🦅'); }),
  makeSkin(87, 'Unicorn', 'Mythic', 900, (c, x, y, r) => { stripes(c, x, y, r, ['#fce7f3', '#ddd6fe', '#bfdbfe', '#d1fae5'], 0); emojiDraw(c, x, y, r, '🦄'); }),
  makeSkin(88, 'God Blob', 'Mythic', 1500, (c, x, y, r) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#fffbeb'); g.addColorStop(0.3, '#fef3c7'); g.addColorStop(0.7, '#fbbf24'); g.addColorStop(1, '#d97706'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); for (let i = 0; i < 12; i++) { c.strokeStyle = `rgba(255,255,200,${0.3 - i * 0.02})`; c.lineWidth = 3 - i * 0.2; c.beginPath(); c.arc(x, y, r * (0.2 + i * 0.07), 0, Math.PI * 2); c.stroke(); } star(c, x, y, r * 0.35, 8, 'rgba(255,255,255,0.9)'); }),
  makeSkin(89, 'Void Walker', 'Mythic', 1800, (c, x, y, r) => { gradCircle(c, x, y, r, '#000005', '#020208'); for (let i = 0; i < 6; i++) { c.strokeStyle = `hsla(${260 + i * 10},100%,${30 + i * 8}%,${0.6 - i * 0.08})`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * (0.15 + i * 0.14), i * 0.5, i * 0.5 + Math.PI * 2); c.stroke(); } c.fillStyle = 'rgba(139,92,246,0.8)'; c.beginPath(); c.arc(x, y, r * 0.12, 0, Math.PI * 2); c.fill(); }),
  makeSkin(90, 'Titan', 'Mythic', 2000, (c, x, y, r) => { gradCircle(c, x, y, r, '#1c1917', '#292524'); ring(c, x, y, r, '#78716c', 5); ring(c, x, y, r * 0.7, '#a8a29e', 3); ring(c, x, y, r * 0.4, '#d6d3d1', 2); c.fillStyle = '#fafaf9'; c.font = `bold ${r * 0.45}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('⚡', x, y); }),
  makeSkin(91, 'Medusa', 'Mythic', 1200, (c, x, y, r) => { gradCircle(c, x, y, r, '#064e3b', '#065f46'); emojiDraw(c, x, y, r, '🐍'); }),
  makeSkin(92, 'Leviathan', 'Mythic', 1600, (c, x, y, r) => { gradCircle(c, x, y, r, '#0c4a6e', '#083344'); emojiDraw(c, x, y, r, '🌊'); ring(c, x, y, r, '#0ea5e9', 3); }),
  makeSkin(93, 'Cerberus', 'Mythic', 2200, (c, x, y, r) => { gradCircle(c, x, y, r, '#1c0000', '#3d0000'); emojiDraw(c, x, y, r, '🐕'); ring(c, x, y, r, '#dc2626', 2); }),
  makeSkin(94, 'Anubis', 'Mythic', 2500, (c, x, y, r) => { gradCircle(c, x, y, r, '#1c1400', '#3d2c00'); ring(c, x, y, r, '#d97706', 3); emojiDraw(c, x, y, r, '🐺'); }),
  makeSkin(95, 'Ouroboros', 'Mythic', 3000, (c, x, y, r) => { gradCircle(c, x, y, r, '#0a0a0a', '#1a0a0a'); c.strokeStyle = '#16a34a'; c.lineWidth = r * 0.15; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, r * 0.7, 0, Math.PI * 1.92); c.stroke(); emojiDraw(c, x, y, r * 0.5, '🐍'); }),
  makeSkin(96, 'Ragnarok', 'Mythic', 3500, (c, x, y, r) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#7f1d1d'); g.addColorStop(0.5, '#1c1917'); g.addColorStop(1, '#000'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); for (let i = 0; i < 8; i++) { c.strokeStyle = `rgba(239,68,68,${0.5 - i * 0.05})`; c.lineWidth = 3; const a = (i / 8) * Math.PI * 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke(); } emojiDraw(c, x, y, r, '⚡'); }),
  makeSkin(97, 'Eldritch', 'Mythic', 4000, (c, x, y, r) => { gradCircle(c, x, y, r, '#0a001a', '#0f0020'); for (let i = 0; i < 20; i++) { c.strokeStyle = `hsla(${280 + i * 4},100%,50%,0.15)`; c.lineWidth = 1; c.beginPath(); c.arc(x + Math.cos(i) * r * 0.1, y + Math.sin(i) * r * 0.1, r * (0.05 + i * 0.044), i * 0.3, i * 0.3 + Math.PI * 1.7); c.stroke(); } c.fillStyle = 'rgba(200,0,255,0.6)'; c.font = `bold ${r * 0.5}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('👁', x, y); }),
  makeSkin(98, 'Infinity', 'Mythic', 5000, (c, x, y, r) => { for (let i = 10; i > 0; i--) { c.fillStyle = `hsl(${i * 36},80%,50%)`; c.beginPath(); c.arc(x, y, r * i / 10, 0, Math.PI * 2); c.fill(); } c.fillStyle = 'rgba(0,0,0,0.7)'; c.beginPath(); c.arc(x, y, r * 0.3, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.font = `bold ${r * 0.3}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('∞', x, y); }),
  makeSkin(99, 'THE BLOB', 'Mythic', 10000, (c, x, y, r) => { const t = Date.now() / 1000; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#fff'); g.addColorStop(0.2, `hsl(${(t * 60) % 360},100%,70%)`); g.addColorStop(0.5, `hsl(${(t * 60 + 120) % 360},100%,50%)`); g.addColorStop(1, `hsl(${(t * 60 + 240) % 360},100%,30%)`); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); for (let i = 0; i < 12; i++) { c.strokeStyle = `hsla(${i * 30},100%,70%,0.4)`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * (0.3 + i * 0.058), i * 0.5, i * 0.5 + Math.PI * 1.8); c.stroke(); } c.fillStyle = 'rgba(0,0,0,0.8)'; c.beginPath(); c.arc(x, y, r * 0.35, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.font = `bold ${r * 0.18}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('THE BLOB', x, y); }),
];
