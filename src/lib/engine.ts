import { SKINS, Skin } from './skins';
import { MAPS, MapDef } from './maps';
import { SaveData } from './persistence';

// ── CONSTANTS ──
export const WORLD = 4000;
const BOT_COUNT = 28;
const FOOD_COUNT = 800;
export const VIRUS_MASS = 100;
const EJECT_AMT = 14;
const MAX_CELLS = 16;
const MIN_SPLIT_MASS = 36;
const SPLIT_CD = 200;
const MERGE_CD = 12000;
const SPLIT_SPEED = 22;
const SPLIT_DECAY = 0.88;
const BASE_SPEED = 6.5;

const BOT_NAMES = ['Xenomorph','Nomvula','Drizzt','Yuki','Kwame','Lysander','Priya','Obafemi','Sienna','Torben','Zephyr','Iolanthe','Rashid','Vesper','Kimani','Alaric','Nadia','Orion','Thalia','Ezra','Marisol','Caspian','Zara','Leif','Indira','Bastian','Nkechi','Cleo','Remy','Solange'];

// ── UTILS ──
const rand = (a: number, b: number) => Math.random() * (b - a) + a;
const randInt = (a: number, b: number) => Math.floor(rand(a, b));
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const dist = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x - b.x, a.y - b.y);
export const m2r = (m: number) => Math.sqrt(m / Math.PI) * 4;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ── TYPES ──
export interface Cell {
  x: number; y: number; mass: number;
  vx: number; vy: number; lvx: number; lvy: number;
  splitCD: number; mergeCD: number;
}

export interface Food {
  x: number; y: number; mass: number; color: string; size: number; pulse: number;
}

export interface Virus {
  x: number; y: number; spikes: number; angle: number;
}

export interface EjectedMass {
  x: number; y: number; vx: number; vy: number; mass: number; color: string | null; life: number;
}

export interface Particle {
  x: number; y: number; vx: number; vy: number; color: string; life: number; decay: number; size: number;
}

export interface Structure {
  type: 'rect' | 'circle' | 'island' | 'blob';
  x: number; y: number;
  w?: number; h?: number;
  r?: number;
  seed?: number;
}

export interface XPEvent {
  amount: number; x: number; y: number;
}

export interface GameEventEmitter {
  onXP?: (amount: number, screenX: number, screenY: number) => void;
  onLevelUp?: (level: number) => void;
  onUnlock?: (name: string, skinId: number) => void;
  onMapUnlock?: (map: MapDef) => void;
  onDied?: (stats: { peakMass: number; elapsed: number; kills: number; sessionXP: number }) => void;
  onToast?: (msg: string, color: string) => void;
}

// ── STRUCTURES ──
function generateStructures(mapDef: MapDef): Structure[] {
  const s: Structure[] = [];
  const type = mapDef.structures;
  if (!type) return s;
  const margin = 200;

  if (type === 'walls') {
    for (let i = 0; i < 12; i++) {
      const horiz = Math.random() > 0.5;
      const x = rand(margin, WORLD - margin), y = rand(margin, WORLD - margin);
      const len = rand(200, 500), thick = 40;
      s.push({ type: 'rect', x: horiz ? x : x - thick/2, y: horiz ? y - thick/2 : y, w: horiz ? len : thick, h: horiz ? thick : len });
    }
  } else if (type === 'pillars') {
    for (let i = 0; i < 18; i++) s.push({ type: 'circle', x: rand(margin, WORLD-margin), y: rand(margin, WORLD-margin), r: rand(60, 160) });
  } else if (type === 'organic') {
    for (let i = 0; i < 14; i++) s.push({ type: 'blob', x: rand(margin, WORLD-margin), y: rand(margin, WORLD-margin), r: rand(80, 200), seed: Math.random() * 1000 });
  } else if (type === 'islands') {
    for (let i = 0; i < 10; i++) { const sz = rand(120, 280); s.push({ type: 'island', x: rand(margin, WORLD-margin), y: rand(margin, WORLD-margin), r: sz/2 }); }
  } else if (type === 'maze') {
    const cols = 6, rows = 6;
    const cw = Math.floor((WORLD - 2*margin) / cols);
    const ch = Math.floor((WORLD - 2*margin) / rows);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      if (Math.random() < 0.35) {
        const horiz = Math.random() > 0.5;
        const bx = margin + col*cw + cw/2, by = margin + row*ch + ch/2;
        const len = horiz ? cw*0.8 : ch*0.8, thick = 35;
        s.push({ type: 'rect', x: horiz ? bx-len/2 : bx-thick/2, y: horiz ? by-thick/2 : by-len/2, w: horiz ? len : thick, h: horiz ? thick : len });
      }
    }
  }
  return s;
}

function collidesWithStructure(structs: Structure[], x: number, y: number, r: number): boolean {
  for (const s of structs) {
    if (s.type === 'rect') { if (x+r > s.x! && x-r < s.x!+s.w! && y+r > s.y! && y-r < s.y!+s.h!) return true; }
    else if (s.type === 'circle' || s.type === 'island') { if (dist({x,y}, {x:s.x,y:s.y}) < s.r! + r) return true; }
    else if (s.type === 'blob') {
      for (let i = 0; i < 6; i++) {
        const a = s.seed! + (i/6)*Math.PI*2;
        const bx = s.x + Math.cos(a)*s.r!*0.4, by = s.y + Math.sin(a)*s.r!*0.4;
        if (dist({x,y},{x:bx,y:by}) < s.r!*0.65 + r) return true;
      }
    }
  }
  return false;
}

// ── GAME ENGINE ──
export class GameEngine {
  // public state
  player: { name: string; skinId: number; skin: Skin; cells: Cell[]; dead: boolean } | null = null;
  bots: Array<{ skin: Skin; name: string; cells: Cell[]; target: {x:number;y:number}; timer: number; id: number }> = [];
  foods: Food[] = [];
  viruses: Virus[] = [];
  ejected: EjectedMass[] = [];
  particles: Particle[] = [];
  structures: Structure[] = [];
  activeMap: MapDef = MAPS[0];
  camera = { x: WORLD/2, y: WORLD/2, zoom: 1 };
  mouse = { x: 0, y: 0 };
  frameCount = 0;
  sessionXP = 0;
  peakMass = 0;
  killCount = 0;
  sessionStartTime = 0;
  save: SaveData;
  events: GameEventEmitter = {};
  private canvasW = 800;
  private canvasH = 600;

  constructor(save: SaveData) { this.save = save; }

  // ── COORDINATE TRANSFORM ──
  screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.canvasW/2) / this.camera.zoom + this.camera.x, y: (sy - this.canvasH/2) / this.camera.zoom + this.camera.y };
  }
  worldToScreen(wx: number, wy: number) {
    return { x: (wx - this.camera.x) * this.camera.zoom + this.canvasW/2, y: (wy - this.camera.y) * this.camera.zoom + this.canvasH/2 };
  }
  setCanvasSize(w: number, h: number) { this.canvasW = w; this.canvasH = h; }

  // ── INIT ──
  start(mapId: number, skinId: number, name: string) {
    this.activeMap = MAPS[mapId];
    this.structures = generateStructures(this.activeMap);
    this.player = { name: name || 'Blob', skinId, skin: SKINS[skinId], cells: [this.mkCell(WORLD/2, WORLD/2, INIT_MASS)], dead: false };
    this.bots = Array.from({ length: BOT_COUNT }, () => this.mkBot());
    this.foods = Array.from({ length: FOOD_COUNT }, () => this.mkFood());
    this.viruses = Array.from({ length: VIRUS_COUNT }, () => this.mkVirus());
    this.ejected = []; this.particles = []; this.frameCount = 0;
    this.sessionStartTime = Date.now(); this.sessionXP = 0; this.peakMass = INIT_MASS; this.killCount = 0;
    this.camera = { x: WORLD/2, y: WORLD/2, zoom: 1 };
    this.save.games++; this.syncSave();
  }

  private mkCell(x: number, y: number, mass: number): Cell {
    return { x, y, mass, vx: 0, vy: 0, lvx: 0, lvy: 0, splitCD: 0, mergeCD: 0 };
  }

  private mkFood(): Food {
    let x = 0, y = 0, tries = 0;
    do { x = rand(20, WORLD-20); y = rand(20, WORLD-20); tries++; }
    while (collidesWithStructure(this.structures, x, y, 6) && tries < 10);
    return { x, y, mass: FOOD_MASS, color: this.activeMap.foodColors(), size: rand(3, 6), pulse: rand(0, Math.PI*2) };
  }

  private mkVirus(px?: number, py?: number): Virus {
    let x = px ?? 0, y = py ?? 0, tries = 0;
    if (!px) { do { x = rand(150, WORLD-150); y = rand(150, WORLD-150); tries++; } while (collidesWithStructure(this.structures, x, y, m2r(VIRUS_MASS)) && tries < 10); }
    return { x, y, spikes: randInt(8, 14), angle: rand(0, Math.PI*2) };
  }

  private mkBot() {
    const pi = randInt(0, SKINS.length);
    const name = BOT_NAMES[randInt(0, BOT_NAMES.length)];
    let x = 0, y = 0, tries = 0;
    do { x = rand(200, WORLD-200); y = rand(200, WORLD-200); tries++; } while (collidesWithStructure(this.structures, x, y, m2r(200)) && tries < 20);
    return { skin: SKINS[pi], name, cells: [this.mkCell(x, y, rand(80, 400))], target: { x: rand(0, WORLD), y: rand(0, WORLD) }, timer: 0, id: Math.random() };
  }

  private mkParticle(x: number, y: number, color: string, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI*2), sp = rand(1, 5);
      this.particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, color, life: 1, decay: rand(0.02, 0.06), size: rand(2, 8) });
    }
  }

  private botTotalMass(bot: typeof this.bots[0]) { return bot.cells.reduce((s, c) => s + c.mass, 0); }
  private botAvgPos(bot: typeof this.bots[0]) { const n = bot.cells.length; return { x: bot.cells.reduce((s,c)=>s+c.x,0)/n, y: bot.cells.reduce((s,c)=>s+c.y,0)/n }; }
  playerTotalMass() { return this.player?.cells.reduce((s,c)=>s+c.mass,0) ?? 0; }
  playerAvgPos() { if (!this.player?.cells.length) return {x:0,y:0}; const n=this.player.cells.length; return {x:this.player.cells.reduce((s,c)=>s+c.x,0)/n,y:this.player.cells.reduce((s,c)=>s+c.y,0)/n}; }

  // ── INPUT ──
  split() {
    if (!this.player) return;
    const w = this.screenToWorld(this.mouse.x, this.mouse.y);
    const sorted = [...this.player.cells].sort((a,b) => b.mass - a.mass);
    const newCells: Cell[] = [];
    for (const cell of sorted) {
      if (this.player.cells.length + newCells.length >= MAX_CELLS) break;
      if (cell.mass < MIN_SPLIT_MASS*2 || cell.splitCD > 0) continue;
      const dx = w.x - cell.x, dy = w.y - cell.y, len = Math.hypot(dx,dy)||1;
      const ax = dx/len, ay = dy/len, half = cell.mass/2;
      cell.mass = half; cell.splitCD = SPLIT_CD; cell.mergeCD = MERGE_CD;
      cell.lvx = (cell.lvx||0) - ax*SPLIT_SPEED*0.2;
      cell.lvy = (cell.lvy||0) - ay*SPLIT_SPEED*0.2;
      newCells.push({ x: cell.x + ax*m2r(cell.mass)*0.5, y: cell.y + ay*m2r(cell.mass)*0.5, mass: half, vx: cell.vx, vy: cell.vy, lvx: ax*SPLIT_SPEED, lvy: ay*SPLIT_SPEED, splitCD: SPLIT_CD, mergeCD: MERGE_CD });
    }
    this.player.cells.push(...newCells);
  }

  eject() {
    if (!this.player) return;
    this.player.cells.forEach(cell => {
      if (cell.mass <= EJECT_AMT*2) return;
      const w = this.screenToWorld(this.mouse.x, this.mouse.y);
      const dx = w.x - cell.x, dy = w.y - cell.y, len = Math.hypot(dx,dy)||1;
      const ax = dx/len, ay = dy/len, r = m2r(cell.mass);
      cell.mass -= EJECT_AMT;
      this.ejected.push({ x: cell.x + ax*r, y: cell.y + ay*r, vx: ax*18, vy: ay*18, mass: EJECT_AMT, color: null, life: 150 });
    });
  }

  forceMerge() {
    this.player?.cells.forEach(c => { c.mergeCD = 0; c.splitCD = 0; });
  }

  // ── UPDATE ──
  update(dt: number) {
    if (!this.player) return;
    this.frameCount++;
    this.updatePlayer(dt);
    this.updateBots(dt);
    this.updateEjected();
    this.updateParticles();
    this.checkEating();
    this.updateCamera();
    const total = this.playerTotalMass();
    if (total > this.peakMass) this.peakMass = total;
  }

  private updatePlayer(dt: number) {
    if (!this.player) return;
    const w = this.screenToWorld(this.mouse.x, this.mouse.y);
    this.player.cells.forEach(cell => {
      const dx = w.x - cell.x, dy = w.y - cell.y, d = Math.hypot(dx,dy)||1;
      const r = m2r(cell.mass), sp = BASE_SPEED / Math.pow(cell.mass, 0.15);
      if (d > r*0.3) { cell.vx = dx/d*sp; cell.vy = dy/d*sp; }
      else { cell.vx *= 0.85; cell.vy *= 0.85; }
      cell.lvx = (cell.lvx||0) * SPLIT_DECAY; cell.lvy = (cell.lvy||0) * SPLIT_DECAY;
      if (Math.abs(cell.lvx) < 0.05) cell.lvx = 0;
      if (Math.abs(cell.lvy) < 0.05) cell.lvy = 0;
      let nx = clamp(cell.x + cell.vx + cell.lvx, 0, WORLD);
      let ny = clamp(cell.y + cell.vy + cell.lvy, 0, WORLD);
      if (collidesWithStructure(this.structures, nx, ny, r*0.6)) {
        if (!collidesWithStructure(this.structures, cell.x + cell.vx + cell.lvx, cell.y, r*0.6)) { ny = cell.y; cell.lvy *= -0.4; }
        else if (!collidesWithStructure(this.structures, cell.x, ny, r*0.6)) { nx = cell.x; cell.lvx *= -0.4; }
        else { nx = cell.x; ny = cell.y; cell.lvx = 0; cell.lvy = 0; }
      }
      cell.x = nx; cell.y = ny;
      cell.splitCD = Math.max(0, cell.splitCD - dt);
      cell.mergeCD = Math.max(0, cell.mergeCD - dt);
      if (cell.mass > 100) cell.mass = Math.max(100, cell.mass - dt*0.001);
    });

    // Cell separation/merge
    for (let i = 0; i < this.player.cells.length; i++) {
      for (let j = i+1; j < this.player.cells.length; j++) {
        const a = this.player.cells[i], b = this.player.cells[j];
        const d = dist(a, b), minD = m2r(a.mass) + m2r(b.mass);
        if (d < minD) {
          const ang = Math.atan2(b.y-a.y, b.x-a.x);
          if (a.mergeCD > 0 || b.mergeCD > 0) {
            const push = (minD - d) * 0.12, spring = 0.08;
            a.lvx -= Math.cos(ang)*push*spring; a.lvy -= Math.sin(ang)*push*spring;
            b.lvx += Math.cos(ang)*push*spring; b.lvy += Math.sin(ang)*push*spring;
            a.x -= Math.cos(ang)*push*0.5; a.y -= Math.sin(ang)*push*0.5;
            b.x += Math.cos(ang)*push*0.5; b.y += Math.sin(ang)*push*0.5;
          } else {
            const ratio = b.mass / (a.mass + b.mass);
            a.x = lerp(a.x, b.x, ratio*0.15); a.y = lerp(a.y, b.y, ratio*0.15);
            a.mass += b.mass*0.08; b.mass *= 0.92;
            if (b.mass < a.mass*0.05) {
              a.mass += b.mass;
              this.mkParticle(b.x, b.y, '#00ffd0', 3);
              this.player.cells.splice(j, 1); j--;
            }
          }
        }
      }
    }

    // Eat food
    this.player.cells.forEach(cell => {
      const r = m2r(cell.mass);
      this.foods = this.foods.filter(f => {
        if (dist(cell, f) < r) { cell.mass += f.mass; this.mkParticle(f.x, f.y, f.color, 2); return false; }
        return true;
      });
    });
  }

  private updateBots(dt: number) {
    this.bots.forEach(bot => {
      const pos = this.botAvgPos(bot), myMass = this.botTotalMass(bot);
      bot.timer -= dt;
      if (bot.timer <= 0) {
        const pp = this.player ? this.playerAvgPos() : null, pm = this.player ? this.playerTotalMass() : 0;
        if (pp && myMass > pm*1.25 && dist(pos,pp) < 700) { bot.target = {...pp}; }
        else if (pp && pm > myMass*1.25 && dist(pos,pp) < 500) {
          const a = Math.atan2(pos.y-pp.y, pos.x-pp.x);
          bot.target = { x: clamp(pos.x+Math.cos(a)*400,100,WORLD-100), y: clamp(pos.y+Math.sin(a)*400,100,WORLD-100) };
        } else {
          let best: Food|null=null, bd=Infinity;
          for (const f of this.foods) { const d=dist(pos,f); if(d<bd){bd=d;best=f;} }
          bot.target = best && bd < 700 ? {...best} : { x: rand(100,WORLD-100), y: rand(100,WORLD-100) };
        }
        bot.timer = rand(300, 1500);
      }
      bot.cells.forEach(cell => {
        const dx = bot.target.x - cell.x, dy = bot.target.y - cell.y, d = Math.hypot(dx,dy)||1;
        const sp = BASE_SPEED / Math.pow(cell.mass, 0.15);
        cell.vx = dx/d*sp; cell.vy = dy/d*sp;
        cell.lvx = (cell.lvx||0)*SPLIT_DECAY; cell.lvy = (cell.lvy||0)*SPLIT_DECAY;
        if (Math.abs(cell.lvx)<0.05) cell.lvx=0;
        if (Math.abs(cell.lvy)<0.05) cell.lvy=0;
        let nx = clamp(cell.x+cell.vx+cell.lvx, 0, WORLD);
        let ny = clamp(cell.y+cell.vy+cell.lvy, 0, WORLD);
        if (collidesWithStructure(this.structures, nx, ny, m2r(cell.mass)*0.5)) { nx=cell.x; ny=cell.y; cell.lvx*=-0.5; cell.lvy*=-0.5; }
        cell.x=nx; cell.y=ny;
        cell.splitCD=Math.max(0,cell.splitCD-dt); cell.mergeCD=Math.max(0,cell.mergeCD-dt);
        if (cell.mass>100) cell.mass=Math.max(100,cell.mass-dt*0.001);
      });
      // Bot merge
      for (let i=0;i<bot.cells.length;i++) for (let j=i+1;j<bot.cells.length;j++) {
        const a=bot.cells[i],b=bot.cells[j];
        if (a.mergeCD<=0&&b.mergeCD<=0&&dist(a,b)<Math.max(m2r(a.mass),m2r(b.mass))*0.9) {
          a.mass+=b.mass; bot.cells.splice(j,1); j--;
        }
      }
      // Bot eat food
      bot.cells.forEach(cell => {
        const r = m2r(cell.mass);
        this.foods = this.foods.filter(f => { if(dist(cell,f)<r){cell.mass+=f.mass;return false;} return true; });
      });
    });
  }

  private updateEjected() {
    this.ejected.forEach(em => {
      em.x = clamp(em.x+em.vx, 0, WORLD); em.y = clamp(em.y+em.vy, 0, WORLD);
      em.vx *= 0.91; em.vy *= 0.91; em.life--;
    });
    this.ejected = this.ejected.filter(e => e.life > 0);
  }

  private updateParticles() {
    this.particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vx*=0.94; p.vy*=0.94; p.life-=p.decay; });
    this.particles = this.particles.filter(p => p.life > 0);
  }

  private updateCamera() {
    if (!this.player?.cells.length) return;
    const pos = this.playerAvgPos(), mass = this.playerTotalMass();
    this.camera.x = lerp(this.camera.x, pos.x, 0.08);
    this.camera.y = lerp(this.camera.y, pos.y, 0.08);
    const tz = Math.pow(Math.min(64/Math.sqrt(mass/Math.PI), 1), 0.4) * 0.9;
    this.camera.zoom = lerp(this.camera.zoom, tz, 0.05);
    this.camera.zoom = clamp(this.camera.zoom, 0.05, 2.5);
  }

  private checkEating() {
    if (!this.player) return;

    // Player eats bots
    this.player.cells.forEach(pc => {
      const pr = m2r(pc.mass);
      this.bots.forEach(bot => {
        bot.cells = bot.cells.filter(bc => {
          if (pc.mass <= bc.mass*1.1) return true;
          if (dist(pc,bc) >= pr*0.85) return true;
          pc.mass += bc.mass;
          this.mkParticle(bc.x, bc.y, '#ff6b6b', 14);
          this.killCount++;
          const xpGain = Math.max(25, Math.floor(bc.mass/3));
          this.awardXP(xpGain, this.worldToScreen(bc.x, bc.y));
          return false;
        });
      });
    });

    // Bots eat player
    this.bots.forEach(bot => {
      bot.cells.forEach(bc => {
        const br = m2r(bc.mass);
        this.player!.cells = this.player!.cells.filter(pc => {
          if (bc.mass <= pc.mass*1.1) return true;
          if (dist(bc,pc) >= br*0.85) return true;
          bc.mass += pc.mass;
          this.mkParticle(pc.x, pc.y, '#ff2d55', 16);
          return false;
        });
      });
    });

    // Bot vs Bot
    this.bots.forEach(ba => {
      ba.cells.forEach(ac => {
        const ar = m2r(ac.mass);
        this.bots.forEach(bb => {
          if (ba===bb) return;
          bb.cells = bb.cells.filter(bc => {
            if (ac.mass<=bc.mass*1.1) return true;
            if (dist(ac,bc)>=ar*0.85) return true;
            ac.mass+=bc.mass; return false;
          });
        });
      });
    });

    // Virus hits player
    for (let vi=0;vi<this.viruses.length;vi++) {
      const v = this.viruses[vi];
      for (let pi=0;pi<this.player.cells.length;pi++) {
        const pc = this.player.cells[pi];
        if (pc.mass<=VIRUS_MASS*1.25) continue;
        if (dist(pc,v)>=m2r(pc.mass)*0.85) continue;
        this.mkParticle(v.x,v.y,'#00ff66',18);
        const available = MAX_CELLS - this.player.cells.length;
        const splits = Math.min(available, Math.min(6, Math.floor(pc.mass/MIN_SPLIT_MASS/2)));
        if (splits>0) {
          const massEach = pc.mass/(splits+1);
          pc.mass=massEach; pc.mergeCD=MERGE_CD;
          for (let s=0;s<splits;s++) {
            const ang = rand(0,Math.PI*2);
            this.player.cells.push({ x:pc.x,y:pc.y,mass:massEach,vx:0,vy:0,lvx:Math.cos(ang)*SPLIT_SPEED*0.7,lvy:Math.sin(ang)*SPLIT_SPEED*0.7,splitCD:SPLIT_CD,mergeCD:MERGE_CD });
          }
        }
        this.viruses[vi] = this.mkVirus(); break;
      }
    }

    // Ejected mass
    this.ejected = this.ejected.filter(em => {
      let eaten = false;
      this.player!.cells.forEach(c => { if(!eaten&&m2r(c.mass)>m2r(em.mass)*1.1&&dist(c,em)<m2r(c.mass)){c.mass+=em.mass;eaten=true;} });
      if (!eaten) this.bots.forEach(b=>b.cells.forEach(c=>{if(!eaten&&m2r(c.mass)>m2r(em.mass)*1.1&&dist(c,em)<m2r(c.mass)){c.mass+=em.mass;eaten=true;}}));
      return !eaten;
    });

    // Respawn bots/food
    this.bots = this.bots.filter(b => b.cells.length > 0);
    while (this.bots.length < BOT_COUNT) this.bots.push(this.mkBot());
    while (this.foods.length < FOOD_COUNT) this.foods.push(this.mkFood());

    if (this.player.cells.length === 0) this.onPlayerDied();
  }

  private awardXP(amount: number, screenPos?: {x:number;y:number}) {
    const prevLvl = this.currentLevel();
    this.save.xp += amount; this.sessionXP += amount;
    const newLvl = this.currentLevel();

    // Unlock skins
    SKINS.forEach(skin => {
      if (!this.save.unlockedSkins.includes(skin.id) && this.save.xp >= skin.xpRequired) {
        this.save.unlockedSkins.push(skin.id);
        this.events.onUnlock?.(skin.name, skin.id);
      }
    });

    // Unlock maps
    MAPS.forEach(map => {
      if (!this.save.unlockedMaps.includes(map.id) && this.save.xp >= map.xpReq) {
        this.save.unlockedMaps.push(map.id);
        this.events.onMapUnlock?.(map);
      }
    });

    if (newLvl > prevLvl) this.events.onLevelUp?.(newLvl);
    if (screenPos) this.events.onXP?.(amount, screenPos.x, screenPos.y);
    this.syncSave();
  }

  private onPlayerDied() {
    const bonusXP = Math.floor(Math.max(0, this.peakMass - 100) / 20);
    this.awardXP(bonusXP);
    if (this.peakMass > this.save.bestMass) this.save.bestMass = this.peakMass;
    this.save.kills = (this.save.kills || 0) + this.killCount;
    this.syncSave();
    const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
    this.events.onDied?.({ peakMass: this.peakMass, elapsed, kills: this.killCount, sessionXP: this.sessionXP });
    this.player!.dead = true;
  }

  private syncSave() { /* save is written by the page component via engine.save ref */ }

  currentLevel() {
    let l=1, x=this.save.xp;
    while(x >= this.xpForLevel(l)){x-=this.xpForLevel(l);l++;}
    return l;
  }
  xpForLevel(l: number) { return Math.floor(120*Math.pow(l,1.55)); }
  xpIntoLevel() {
    let x=this.save.xp, l=1;
    while(x>=this.xpForLevel(l)){x-=this.xpForLevel(l);l++;}
    return x;
  }

  leaderboard() {
    const all = [
      { name: this.player?.name ?? 'You', mass: this.playerTotalMass(), me: true },
      ...this.bots.map(b => ({ name: b.name, mass: this.botTotalMass(b), me: false })),
    ];
    return all.sort((a,b) => b.mass - a.mass);
  }
}
