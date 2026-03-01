import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8080);
const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;
const SNAPSHOT_RATE = 20;
const SNAPSHOT_MS = 1000 / SNAPSHOT_RATE;

const WORLD_SIZE = 8000;
const HALF_WORLD = WORLD_SIZE / 2;
const FOOD_COUNT = 1450;
const VIRUS_COUNT = 30;
const POWERUP_COUNT = 15;
const BOT_COUNT = 18;
const MIN_MASS = 10;
const MAX_SPLITS = 16;
const MERGE_DELAY = 12;
const ROOM_TTL_MS = 5 * 60 * 1000;
const POWERUP_TYPES = ['SPEED', 'SHIELD', 'MASS'];

const FOOD_COLORS = [
  '#2ecc71',
  '#f1c40f',
  '#3498db',
  '#ff7eb6',
  '#ff9f43',
  '#2ed573',
  '#70a1ff',
  '#ff6b81',
];

const rooms = new Map();

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cellRadius(mass) {
  return Math.sqrt(mass) * 4;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function randomWorldPos() {
  return {
    x: randomBetween(-HALF_WORLD, HALF_WORLD),
    y: randomBetween(-HALF_WORLD, HALF_WORLD),
  };
}

function playerColor(seed = Math.random()) {
  const hue = Math.floor(seed * 360);
  return `hsl(${hue} 75% 52%)`;
}

function makePellet() {
  const pos = randomWorldPos();
  const color = FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)] ?? '#2ecc71';
  return {
    id: makeId('food'),
    x: pos.x,
    y: pos.y,
    mass: randomBetween(1.2, 2.6),
    color,
  };
}

function makeVirus() {
  const pos = randomWorldPos();
  return {
    id: makeId('virus'),
    x: pos.x,
    y: pos.y,
    mass: 100,
  };
}

function makePowerUp() {
  const pos = randomWorldPos();
  return {
    id: makeId('pw'),
    x: pos.x,
    y: pos.y,
    type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)],
  };
}

function centroid(cells) {
  if (!cells.length) return { x: 0, y: 0 };
  let totalMass = 0;
  let x = 0;
  let y = 0;
  for (const cell of cells) {
    totalMass += cell.mass;
    x += cell.x * cell.mass;
    y += cell.y * cell.mass;
  }
  if (!totalMass) return { x: 0, y: 0 };
  return { x: x / totalMass, y: y / totalMass };
}

function splitCountFromMass(mass) {
  if (mass < 70) return 0;
  if (mass < 140) return 2;
  if (mass < 260) return 4;
  if (mass < 400) return 6;
  return 8;
}

function createRoom(roomId) {
  const room = {
    id: roomId,
    gameMode: 'ffa',
    players: new Map(),
    cells: new Map(),
    pellets: new Map(),
    viruses: new Map(),
    powerups: new Map(),
    obstacles: new Map(),
    lastSnapshotAt: 0,
    lastHumanAt: Date.now(),
    botCounter: 1,
  };

  for (let i = 0; i < FOOD_COUNT; i += 1) {
    const pellet = makePellet();
    room.pellets.set(pellet.id, pellet);
  }

  for (let i = 0; i < VIRUS_COUNT; i += 1) {
    const virus = makeVirus();
    room.viruses.set(virus.id, virus);
  }

  for (let i = 0; i < POWERUP_COUNT; i += 1) {
    const pw = makePowerUp();
    room.powerups.set(pw.id, pw);
  }

  rooms.set(roomId, room);
  return room;
}

function getOrCreateRoom(roomId) {
  return rooms.get(roomId) ?? createRoom(roomId);
}

function createBot(room) {
  const id = makeId('bot');
  const name = `Bot ${room.botCounter}`;
  room.botCounter += 1;
  const bot = {
    id,
    name,
    color: playerColor((room.botCounter % BOT_COUNT) / BOT_COUNT),
    skin: 'default',
    team: room.gameMode === 'team' ? (Math.random() > 0.5 ? 'red' : 'blue') : undefined,
    isBot: true,
    socket: null,
    target: randomWorldPos(),
    splitQueued: false,
    ejectQueued: false,
    powerups: { speed: 0, shield: 0 },
  };

  room.players.set(bot.id, bot);
  spawnPlayerCell(room, bot.id, randomBetween(36, 72));
}

function spawnPlayerCell(room, playerId, mass = 48) {
  const pos = randomWorldPos();
  const id = makeId('cell');
  room.cells.set(id, {
    id,
    ownerId: playerId,
    x: pos.x,
    y: pos.y,
    mass,
    boostX: 0,
    boostY: 0,
    mergeCooldown: 0,
  });
}

function splitCell(room, cell, target) {
  if (room.cells.size > 1200) return;
  if (cell.mass < 36) return;

  const newMass = cell.mass / 2;
  cell.mass = newMass;

  const dx = target.x - cell.x;
  const dy = target.y - cell.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;

  const childId = makeId('cell');
  room.cells.set(childId, {
    id: childId,
    ownerId: cell.ownerId,
    x: clamp(cell.x + nx * (cellRadius(cell.mass) + 12), -HALF_WORLD, HALF_WORLD),
    y: clamp(cell.y + ny * (cellRadius(cell.mass) + 12), -HALF_WORLD, HALF_WORLD),
    mass: newMass,
    boostX: nx * 900,
    boostY: ny * 900,
    mergeCooldown: MERGE_DELAY,
  });

  cell.mergeCooldown = Math.max(cell.mergeCooldown, MERGE_DELAY);
}

function ensureRoomCounts(room) {
  while (room.pellets.size < FOOD_COUNT) {
    const pellet = makePellet();
    room.pellets.set(pellet.id, pellet);
  }

  while (room.viruses.size < VIRUS_COUNT) {
    const virus = makeVirus();
    room.viruses.set(virus.id, virus);
  }

  while (room.powerups.size < POWERUP_COUNT) {
    const pw = makePowerUp();
    room.powerups.set(pw.id, pw);
  }

  let botCount = 0;
  for (const p of room.players.values()) {
    if (p.isBot) botCount += 1;
  }

  while (botCount < BOT_COUNT) {
    createBot(room);
    botCount += 1;
  }
}

function updateBots(room, dt) {
  const allCells = [...room.cells.values()];

  for (const bot of room.players.values()) {
    if (!bot.isBot) continue;

    const myCells = allCells.filter((c) => c.ownerId === bot.id);
    if (!myCells.length) {
      spawnPlayerCell(room, bot.id, 44);
      continue;
    }

    const center = centroid(myCells);
    let bestTarget = bot.target;
    let bestScore = -Infinity;

    for (const pellet of room.pellets.values()) {
      const d = distance(center, pellet);
      const score = 1000 / (d + 50);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = { x: pellet.x, y: pellet.y };
      }
    }

    const largestMass = Math.max(...myCells.map((c) => c.mass));
    const largestRadius = cellRadius(largestMass);

    for (const other of allCells) {
      if (other.ownerId === bot.id) continue;
      const d = distance(center, other);
      const or = cellRadius(other.mass);
      if (largestRadius > or * 1.2) {
        const chase = 7000 / (d + 60);
        if (chase > bestScore) {
          bestScore = chase;
          bestTarget = { x: other.x, y: other.y };
        }
      } else if (or > largestRadius * 1.15 && d < 1000) {
        const away = {
          x: center.x + (center.x - other.x) * 2,
          y: center.y + (center.y - other.y) * 2,
        };
        const panic = 10000 / (d + 30);
        if (panic > bestScore) {
          bestScore = panic;
          bestTarget = away;
        }
      }
    }

    bot.target = {
      x: clamp(bot.target.x + (bestTarget.x - bot.target.x) * dt * 3.2, -HALF_WORLD, HALF_WORLD),
      y: clamp(bot.target.y + (bestTarget.y - bot.target.y) * dt * 3.2, -HALF_WORLD, HALF_WORLD),
    };

    if (Math.random() < dt * 0.22 && myCells.length < 8) {
      const biggest = myCells.reduce((a, b) => (a.mass > b.mass ? a : b));
      if (biggest.mass > 90) {
        splitCell(room, biggest, bot.target);
      }
    }
  }
}

function applyPlayerActions(room) {
  for (const player of room.players.values()) {
    const myCells = [...room.cells.values()].filter((c) => c.ownerId === player.id);

    if (player.splitQueued) {
      const splitCandidates = [...myCells]
        .sort((a, b) => b.mass - a.mass)
        .slice(0, MAX_SPLITS - myCells.length);

      for (const cell of splitCandidates) {
        splitCell(room, cell, player.target);
      }
      player.splitQueued = false;
    }

    if (player.ejectQueued) {
      for (const cell of myCells) {
        if (cell.mass <= 24) continue;

        const dx = player.target.x - cell.x;
        const dy = player.target.y - cell.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = dx / len;
        const ny = dy / len;

        cell.mass -= 1.2;

        const id = makeId('eject');
        room.pellets.set(id, {
          id,
          x: clamp(cell.x + nx * (cellRadius(cell.mass) + 24), -HALF_WORLD, HALF_WORLD),
          y: clamp(cell.y + ny * (cellRadius(cell.mass) + 24), -HALF_WORLD, HALF_WORLD),
          mass: 2.2,
          color: '#9b59b6',
        });
      }
      player.ejectQueued = false;
    }
  }
}

function updateMovement(room, dt) {
  const allCells = [...room.cells.values()];
  const grouped = new Map();

  for (const cell of allCells) {
    const arr = grouped.get(cell.ownerId) ?? [];
    arr.push(cell);
    grouped.set(cell.ownerId, arr);
  }

  for (const cell of allCells) {
    const owner = room.players.get(cell.ownerId);
    if (!owner) continue;

    const target = owner.target;
    const dx = target.x - cell.x;
    const dy = target.y - cell.y;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;

    let speedBase = 300 / Math.pow(cellRadius(cell.mass), 0.38);
    if (owner.powerups.speed > 0) {
      speedBase *= 2;
    }
    const speed = speedBase;
    const damp = clamp(dist / 140, 0.1, 1);

    const vx = nx * speed * damp + cell.boostX;
    const vy = ny * speed * damp + cell.boostY;

    cell.x = clamp(cell.x + vx * dt, -HALF_WORLD, HALF_WORLD);
    cell.y = clamp(cell.y + vy * dt, -HALF_WORLD, HALF_WORLD);

    cell.boostX *= Math.pow(0.16, dt);
    cell.boostY *= Math.pow(0.16, dt);
    cell.mergeCooldown = Math.max(0, cell.mergeCooldown - dt);

    // Obstacle Collisions
    for (const obs of room.obstacles.values()) {
      const odx = cell.x - obs.x;
      const ody = cell.y - obs.y;
      const odist = Math.sqrt(odx * odx + ody * ody);
      const minClearance = cellRadius(cell.mass) + obs.radius;

      if (odist < minClearance) {
        const angle = Math.atan2(ody, odx);
        cell.x = obs.x + Math.cos(angle) * minClearance;
        cell.y = obs.y + Math.sin(angle) * minClearance;

        // Kill velocity
        cell.boostX = 0;
        cell.boostY = 0;
      }
    }
  }

  for (const sameOwnerCells of grouped.values()) {
    for (let i = 0; i < sameOwnerCells.length; i += 1) {
      for (let j = i + 1; j < sameOwnerCells.length; j += 1) {
        const a = sameOwnerCells[i];
        const b = sameOwnerCells[j];

        if (!room.cells.has(a.id) || !room.cells.has(b.id)) continue;

        const ra = cellRadius(a.mass);
        const rb = cellRadius(b.mass);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const minDist = (ra + rb) * 0.9;

        if (d >= minDist) continue;

        if (a.mergeCooldown <= 0 && b.mergeCooldown <= 0) {
          if (a.mass >= b.mass) {
            a.mass += b.mass;
            room.cells.delete(b.id);
          } else {
            b.mass += a.mass;
            room.cells.delete(a.id);
          }
        } else {
          const overlap = minDist - d;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
        }
      }
    }
  }
}

function consumeFood(room) {
  const pellets = [...room.pellets.values()];
  const powerups = [...room.powerups.values()];

  for (const cell of room.cells.values()) {
    const owner = room.players.get(cell.ownerId);
    if (!owner) continue;

    const r = cellRadius(cell.mass);

    // Consume Pellets
    for (const pellet of pellets) {
      if (!room.pellets.has(pellet.id)) continue;
      if (distance(cell, pellet) < r - 2) {
        cell.mass += pellet.mass;
        room.pellets.delete(pellet.id);
      }
    }

    // Consume Powerups
    for (const pw of powerups) {
      if (!room.powerups.has(pw.id)) continue;
      if (distance(cell, pw) < r + 10) {
        if (pw.type === 'SPEED') owner.powerups.speed = 10000;
        else if (pw.type === 'SHIELD') owner.powerups.shield = 10000;
        else if (pw.type === 'MASS') {
          const myCells = [...room.cells.values()].filter(c => c.ownerId === owner.id);
          myCells.forEach(c => c.mass += 50);
        }
        room.powerups.delete(pw.id);
      }
    }
  }
}

function consumeCells(room) {
  const cells = [...room.cells.values()];

  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      const a = cells[i];
      const b = cells[j];

      if (!room.cells.has(a.id) || !room.cells.has(b.id)) continue;
      if (a.ownerId === b.ownerId) continue;
      const ownerA = room.players.get(a.ownerId);
      const ownerB = room.players.get(b.ownerId);
      if (room.gameMode === 'team' && ownerA?.team === ownerB?.team && ownerA?.team) continue;

      const ra = cellRadius(a.mass);
      const rb = cellRadius(b.mass);
      const d = distance(a, b);

      if (ra > rb * 1.15 && d < ra - rb * 0.35) {
        a.mass += b.mass;
        room.cells.delete(b.id);
      } else if (rb > ra * 1.15 && d < rb - ra * 0.35) {
        b.mass += a.mass;
        room.cells.delete(a.id);
      }
    }
  }
}

function hitViruses(room) {
  for (const cell of [...room.cells.values()]) {
    const owner = room.players.get(cell.ownerId);
    if (!owner) continue;

    const r = cellRadius(cell.mass);

    for (const virus of room.viruses.values()) {
      const vr = cellRadius(virus.mass);
      if (distance(cell, virus) >= r + vr * 0.2 || cell.mass <= 130) continue;

      if (owner.powerups.shield > 0) {
        // Shield logic: absorb mass, no explosion
        cell.mass += virus.mass / 2;
        room.viruses.delete(virus.id);
        continue;
      }

      const ownerCells = [...room.cells.values()].filter((c) => c.ownerId === cell.ownerId);
      const possibleSplits = clamp(
        splitCountFromMass(cell.mass),
        2,
        MAX_SPLITS - ownerCells.length + 1,
      );
      if (possibleSplits <= 1) continue;

      room.cells.delete(cell.id);
      const pieceMass = cell.mass / possibleSplits;

      for (let i = 0; i < possibleSplits; i += 1) {
        const angle = (Math.PI * 2 * i) / possibleSplits;
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        const pieceId = makeId('cell');

        room.cells.set(pieceId, {
          id: pieceId,
          ownerId: cell.ownerId,
          x: clamp(cell.x + nx * (r + 8), -HALF_WORLD, HALF_WORLD),
          y: clamp(cell.y + ny * (r + 8), -HALF_WORLD, HALF_WORLD),
          mass: Math.max(pieceMass, MIN_MASS),
          boostX: nx * 700,
          boostY: ny * 700,
          mergeCooldown: MERGE_DELAY,
        });
      }
      break;
    }
  }
}

function decayMass(room, dt) {
  for (const cell of room.cells.values()) {
    if (cell.mass > 40) {
      cell.mass *= Math.pow(0.9978, dt * 60);
    }
    cell.mass = Math.max(cell.mass, MIN_MASS);
  }
}

function cleanupRoom(room) {
  for (const [id, player] of room.players.entries()) {
    if (player.isBot) continue;

    const alive = [...room.cells.values()].some((c) => c.ownerId === id);
    if (!alive && player.socket && player.socket.readyState === player.socket.OPEN) {
      player.socket.send(JSON.stringify({ type: 'dead' }));
    }
  }

  for (const [id, player] of room.players.entries()) {
    if (!player.isBot) continue;
    const botAlive = [...room.cells.values()].some((c) => c.ownerId === id);
    if (!botAlive) {
      spawnPlayerCell(room, id, 44);
    }
  }
}

function leaderboardForRoom(room) {
  const massByPlayer = new Map();
  for (const cell of room.cells.values()) {
    massByPlayer.set(cell.ownerId, (massByPlayer.get(cell.ownerId) ?? 0) + cell.mass);
  }

  return [...massByPlayer.entries()]
    .map(([id, mass]) => ({ id, mass, name: room.players.get(id)?.name ?? 'Unknown' }))
    .sort((a, b) => b.mass - a.mass)
    .slice(0, 10);
}

function broadcastSnapshot(room) {
  const now = Date.now();
  if (now - room.lastSnapshotAt < SNAPSHOT_MS) return;
  room.lastSnapshotAt = now;

  const players = [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    skin: p.skin,
    team: p.team,
    isBot: p.isBot,
  }));

  const payload = {
    type: 'snapshot',
    serverTime: now,
    roomId: room.id,
    gameMode: room.gameMode,
    players,
    cells: [...room.cells.values()].map((c) => ({
      id: c.id,
      ownerId: c.ownerId,
      x: c.x,
      y: c.y,
      mass: c.mass,
    })),
    pellets: [...room.pellets.values()],
    viruses: [...room.viruses.values()],
    powerups: [...room.powerups.values()],
    obstacles: [...room.obstacles.values()],
    leaderboard: leaderboardForRoom(room),
  };

  const text = JSON.stringify(payload);
  for (const player of room.players.values()) {
    if (player.isBot || !player.socket) continue;
    if (player.socket.readyState === player.socket.OPEN) {
      player.socket.send(text);
    }
  }
}

function countHumans(room) {
  let humans = 0;
  for (const p of room.players.values()) {
    if (!p.isBot) humans += 1;
  }
  return humans;
}

function maybeDestroyRoom(roomId, room) {
  const humans = countHumans(room);
  if (humans > 0) return;
  if (Date.now() - room.lastHumanAt < ROOM_TTL_MS) return;
  rooms.delete(roomId);
}

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (socket) => {
  let currentRoom = null;
  let playerId = null;

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'join') {
      const roomId = String(msg.roomId || 'main').slice(0, 32);
      const name = String(msg.name || 'Blob').slice(0, 20).trim() || 'Blob';
      const color = typeof msg.color === 'string' ? msg.color : playerColor();

      const room = getOrCreateRoom(roomId);
      room.lastHumanAt = Date.now();

      if (currentRoom && playerId) {
        removePlayer(currentRoom, playerId);
      }

      playerId = makeId('you');
      currentRoom = room;

      room.players.set(playerId, {
        id: playerId,
        name,
        color,
        skin: msg.skin || 'default',
        team: room.gameMode === 'team' ? (Math.random() > 0.5 ? 'red' : 'blue') : undefined,
        isBot: false,
        socket,
        target: randomWorldPos(),
        splitQueued: false,
        ejectQueued: false,
        powerups: { speed: 0, shield: 0 },
      });

      spawnPlayerCell(room, playerId, 48);
      ensureRoomCounts(room);

      room.obstacles.clear();
      if (msg.mapData && msg.mapData.obstacles) {
        for (const obs of msg.mapData.obstacles) {
          room.obstacles.set(obs.id, {
            id: obs.id,
            x: obs.x,
            y: obs.y,
            radius: obs.width / 2, // Map width to radius
            shape: obs.shape,
            color: obs.color,
            rotation: obs.rotation
          });
        }
      }

      socket.send(
        JSON.stringify({
          type: 'welcome',
          playerId,
          roomId,
          worldSize: WORLD_SIZE,
          tickRate: TICK_RATE,
        }),
      );

      return;
    }

    if (msg.type === 'saveMap' && currentRoom) {
      currentRoom.obstacles.clear();
      if (msg.mapData && msg.mapData.obstacles) {
        for (const obs of msg.mapData.obstacles) {
          currentRoom.obstacles.set(obs.id, {
            id: obs.id,
            x: obs.x,
            y: obs.y,
            radius: obs.width / 2,
            shape: obs.shape,
            color: obs.color,
            rotation: obs.rotation
          });
        }
      }
      return;
    }

    if (!currentRoom || !playerId) return;

    const player = currentRoom.players.get(playerId);
    if (!player) return;

    if (msg.type === 'input') {
      if (msg.target && Number.isFinite(msg.target.x) && Number.isFinite(msg.target.y)) {
        player.target = {
          x: clamp(msg.target.x, -HALF_WORLD, HALF_WORLD),
          y: clamp(msg.target.y, -HALF_WORLD, HALF_WORLD),
        };
      }
      if (msg.split) player.splitQueued = true;
      if (msg.eject) player.ejectQueued = true;
      return;
    }

    if (msg.type === 'respawn') {
      const alive = [...currentRoom.cells.values()].some((c) => c.ownerId === playerId);
      if (!alive) spawnPlayerCell(currentRoom, playerId, 48);
      return;
    }

    if (msg.type === 'ping' && Number.isFinite(msg.t)) {
      socket.send(JSON.stringify({ type: 'pong', t: msg.t }));
    }
  });

  socket.on('close', () => {
    if (currentRoom && playerId) {
      removePlayer(currentRoom, playerId);
      maybeDestroyRoom(currentRoom.id, currentRoom);
    }
  });
});

function removePlayer(room, playerId) {
  room.players.delete(playerId);
  for (const [cellId, cell] of room.cells.entries()) {
    if (cell.ownerId === playerId) {
      room.cells.delete(cellId);
    }
  }

  if (countHumans(room) === 0) {
    room.lastHumanAt = Date.now();
  }
}

let prevTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = clamp((now - prevTick) / 1000, 0, 0.045);
  prevTick = now;

  for (const [roomId, room] of rooms.entries()) {
    ensureRoomCounts(room);
    updateBots(room, dt);

    // Decay powerup timers
    for (const player of room.players.values()) {
      if (player.powerups.speed > 0) player.powerups.speed -= dt * 1000;
      if (player.powerups.shield > 0) player.powerups.shield -= dt * 1000;
    }

    applyPlayerActions(room);
    updateMovement(room, dt);
    consumeFood(room);
    consumeCells(room);
    hitViruses(room);
    decayMass(room, dt);
    cleanupRoom(room);
    ensureRoomCounts(room);
    broadcastSnapshot(room);
    maybeDestroyRoom(roomId, room);
  }
}, TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`WebSocket game server listening on http://localhost:${PORT} (ws path: /ws)`);
});
