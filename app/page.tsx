"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Vec2 = { x: number; y: number };

type NetCell = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  mass: number;
};

type NetPellet = {
  id: string;
  x: number;
  y: number;
  mass: number;
  color: string;
};

type NetVirus = {
  id: string;
  x: number;
  y: number;
  mass: number;
};

type NetPlayer = {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
};

type NetLeaderboard = {
  id: string;
  name: string;
  mass: number;
};

type NetSnapshot = {
  type: "snapshot";
  serverTime: number;
  roomId: string;
  players: NetPlayer[];
  cells: NetCell[];
  pellets: NetPellet[];
  viruses: NetVirus[];
  leaderboard: NetLeaderboard[];
};

type HudSnapshot = {
  fps: number;
  ping: number;
  connected: boolean;
  playerMass: number;
  playerAlive: boolean;
  leaderboard: Array<{ name: string; mass: number; you: boolean }>;
};

const WORLD_SIZE_DEFAULT = 8000;
const SNAPSHOT_RATE = 20;
const SNAPSHOT_MS = 1000 / SNAPSHOT_RATE;

const FOOD_COLORS = [
  "#2ecc71",
  "#f1c40f",
  "#3498db",
  "#ff7eb6",
  "#ff9f43",
  "#2ed573",
  "#70a1ff",
  "#ff6b81",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cellRadius(mass: number): number {
  return Math.sqrt(mass) * 4;
}

function centroid(cells: NetCell[]): Vec2 {
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function createFoodBgDots(count = 100): NetPellet[] {
  const pellets: NetPellet[] = [];
  for (let i = 0; i < count; i += 1) {
    const color = FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)] ?? "#2ecc71";
    pellets.push({
      id: `bg_${i}`,
      x: (Math.random() - 0.5) * WORLD_SIZE_DEFAULT,
      y: (Math.random() - 0.5) * WORLD_SIZE_DEFAULT,
      mass: 2,
      color,
    });
  }
  return pellets;
}

function wsUrl(): string {
  const override = process.env.NEXT_PUBLIC_WS_URL;
  if (override) return override;
  if (typeof window === "undefined") return "ws://localhost:8080/ws";

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8080/ws`;
}

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue} 75% 52%)`;
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const renderRef = useRef({
    prevSnapshot: null as NetSnapshot | null,
    currSnapshot: null as NetSnapshot | null,
    lastSnapshotRecvAt: 0,
    camera: { x: 0, y: 0, zoom: 1 },
    mouseScreen: { x: 0, y: 0 },
    fps: 60,
    lastFrameAt: 0,
    worldSize: WORLD_SIZE_DEFAULT,
    ping: 0,
    connected: false,
    fallbackPellets: createFoodBgDots(),
  });

  const inputRef = useRef({ splitPressed: false, ejectPressed: false });
  const serverRef = useRef({
    playerId: "",
    roomId: "",
  });

  const [nameInput, setNameInput] = useState("Blob");
  const [roomInput, setRoomInput] = useState("main");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>({
    fps: 60,
    ping: 0,
    connected: false,
    playerMass: 0,
    playerAlive: false,
    leaderboard: [],
  });

  const localColor = useMemo(() => colorFromName(nameInput || "Blob"), [nameInput]);

  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      renderRef.current.mouseScreen = { x: e.clientX, y: e.clientY };
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        inputRef.current.splitPressed = true;
      }
      if (e.key.toLowerCase() === "w") {
        inputRef.current.ejectPressed = true;
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    let rafId = 0;
    let hudUpdatedAt = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const render = renderRef.current;
      const now = performance.now();
      const dt = clamp((now - (render.lastFrameAt || now)) / 1000, 0, 0.045);
      render.lastFrameAt = now;
      render.fps = Math.round(1 / Math.max(dt, 0.0001));

      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#f6f8fc";
      ctx.fillRect(0, 0, w, h);

      const prevSnap = render.prevSnapshot;
      const currSnap = render.currSnapshot;

      const alpha = currSnap
        ? clamp((performance.now() - render.lastSnapshotRecvAt) / SNAPSHOT_MS, 0, 1)
        : 1;

      let players = new Map<string, NetPlayer>();
      let cells: NetCell[] = [];
      let pellets: NetPellet[] = render.fallbackPellets;
      let viruses: NetVirus[] = [];
      if (currSnap) {
        players = new Map(currSnap.players.map((p) => [p.id, p]));
        const prevCells = new Map((prevSnap?.cells ?? []).map((c) => [c.id, c]));

        cells = currSnap.cells.map((c) => {
          const prev = prevCells.get(c.id);
          if (!prev) return c;
          return {
            ...c,
            x: lerp(prev.x, c.x, alpha),
            y: lerp(prev.y, c.y, alpha),
            mass: lerp(prev.mass, c.mass, alpha),
          };
        });

        pellets = currSnap.pellets;
        viruses = currSnap.viruses;
      }

      const localId = serverRef.current.playerId;
      const myCells = cells.filter((c) => c.ownerId === localId);
      const center = centroid(myCells);
      const totalMass = myCells.reduce((sum, c) => sum + c.mass, 0);
      const desiredZoom = clamp(1.5 / Math.pow(Math.max(totalMass, 60) / 60, 0.22), 0.18, 1.2);

      render.camera.x += (center.x - render.camera.x) * dt * 6;
      render.camera.y += (center.y - render.camera.y) * dt * 6;
      render.camera.zoom += (desiredZoom - render.camera.zoom) * dt * 4;

      const halfWorld = render.worldSize / 2;
      render.camera.x = clamp(render.camera.x, -halfWorld, halfWorld);
      render.camera.y = clamp(render.camera.y, -halfWorld, halfWorld);

      const zoom = render.camera.zoom;
      const left = render.camera.x - w / 2 / zoom;
      const right = render.camera.x + w / 2 / zoom;
      const top = render.camera.y - h / 2 / zoom;
      const bottom = render.camera.y + h / 2 / zoom;

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-render.camera.x, -render.camera.y);

      drawGrid(ctx, left, right, top, bottom);
      drawBorders(ctx, render.worldSize);

      for (const pellet of pellets) {
        const r = cellRadius(pellet.mass);
        ctx.fillStyle = pellet.color;
        ctx.beginPath();
        ctx.arc(pellet.x, pellet.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const virus of viruses) {
        drawVirus(ctx, virus, zoom);
      }

      const sortedCells = [...cells].sort((a, b) => a.mass - b.mass);
      for (const cell of sortedCells) {
        const owner = players.get(cell.ownerId);
        if (!owner) continue;
        drawCell(ctx, cell, owner, zoom);
      }

      ctx.restore();

      if (currSnap && now - hudUpdatedAt > 120) {
        const ranking = currSnap.leaderboard.map((entry) => ({
          name: entry.name,
          mass: entry.mass,
          you: entry.id === localId,
        }));

        setHud({
          fps: render.fps,
          ping: render.ping,
          connected: render.connected,
          playerMass: totalMass,
          playerAlive: myCells.length > 0,
          leaderboard: ranking,
        });
        hudUpdatedAt = now;
      }
    };

    const loop = () => {
      draw();
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const inputTimer = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const render = renderRef.current;
      const camera = render.camera;
      const mouse = render.mouseScreen;
      const target = {
        x: camera.x + (mouse.x - window.innerWidth / 2) / camera.zoom,
        y: camera.y + (mouse.y - window.innerHeight / 2) / camera.zoom,
      };

      ws.send(
        JSON.stringify({
          type: "input",
          target,
          split: inputRef.current.splitPressed,
          eject: inputRef.current.ejectPressed,
        }),
      );

      inputRef.current.splitPressed = false;
      inputRef.current.ejectPressed = false;
    }, 33);

    const pingTimer = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
    }, 2000);

    return () => {
      clearInterval(inputTimer);
      clearInterval(pingTimer);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connect = (name: string, roomId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      renderRef.current.connected = true;
      ws.send(
        JSON.stringify({
          type: "join",
          name: name.trim() || "Blob",
          roomId: roomId.trim() || "main",
          color: localColor,
        }),
      );
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);

      if (msg.type === "welcome") {
        serverRef.current.playerId = msg.playerId;
        serverRef.current.roomId = msg.roomId;
        setJoinedRoom(msg.roomId);
        renderRef.current.worldSize = Number(msg.worldSize || WORLD_SIZE_DEFAULT);
        return;
      }

      if (msg.type === "snapshot") {
        const snapshot = msg as NetSnapshot;
        const render = renderRef.current;
        render.prevSnapshot = render.currSnapshot;
        render.currSnapshot = snapshot;
        render.lastSnapshotRecvAt = performance.now();
        return;
      }

      if (msg.type === "dead") {
        setHud((prev) => ({ ...prev, playerAlive: false }));
        return;
      }

      if (msg.type === "pong" && Number.isFinite(msg.t)) {
        renderRef.current.ping = Math.max(0, Date.now() - msg.t);
      }
    };

    ws.onclose = () => {
      renderRef.current.connected = false;
      setHud((prev) => ({ ...prev, connected: false }));
    };

    ws.onerror = () => {
      renderRef.current.connected = false;
      setHud((prev) => ({ ...prev, connected: false }));
    };
  };

  const onPlay = (e: FormEvent) => {
    e.preventDefault();
    setStarted(true);
    connect(nameInput, roomInput);
  };

  const onRespawn = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connect(nameInput, roomInput);
      return;
    }
    ws.send(JSON.stringify({ type: "respawn" }));
  };

  const canShowMenu = !started || !hud.connected || !hud.playerAlive;

  return (
    <main className="agar-page">
      <canvas ref={canvasRef} className="game-canvas" />

      <section className="hud top-left">
        <h1>BLOBHAUS</h1>
        <p>Mass: {Math.round(hud.playerMass)}</p>
        <p>FPS: {hud.fps}</p>
        <p>Ping: {hud.ping}ms</p>
      </section>

      <section className="hud top-right">
        <h2>Leaderboard</h2>
        <ol>
          {hud.leaderboard.map((entry) => (
            <li key={`${entry.name}_${entry.mass}`} className={entry.you ? "you" : ""}>
              {entry.name} - {Math.round(entry.mass)}
            </li>
          ))}
        </ol>
      </section>

      <section className="hud bottom-left controls">
        <p>Mouse: Move</p>
        <p>Space: Split</p>
        <p>W: Eject mass</p>
        <p>Room: {joinedRoom || roomInput}</p>
      </section>

      {canShowMenu && (
        <section className="overlay">
          <form className="panel" onSubmit={onPlay}>
            <h2>
              {!started
                ? "BLOBHAUS Arena"
                : !hud.connected
                  ? "Disconnected"
                  : "You were eaten"}
            </h2>
            <p>Server-authoritative multiplayer with rooms, bots, viruses, and leaderboard sync.</p>
            <label>
              Nickname
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={20}
                placeholder="Nickname"
              />
            </label>
            <label>
              Room
              <input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.replace(/\s+/g, ""))}
                maxLength={32}
                placeholder="main"
              />
            </label>
            {!started || !hud.connected ? (
              <button type="submit">{started ? "Reconnect" : "Play"}</button>
            ) : (
              <button type="button" onClick={onRespawn}>
                Respawn
              </button>
            )}
          </form>
        </section>
      )}
    </main>
  );
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  top: number,
  bottom: number,
) {
  ctx.strokeStyle = "rgba(35, 54, 88, 0.08)";
  ctx.lineWidth = 1;
  const step = 200;

  for (let x = Math.floor(left / step) * step; x <= right; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
}

function drawBorders(ctx: CanvasRenderingContext2D, worldSize: number) {
  const halfWorld = worldSize / 2;
  ctx.strokeStyle = "#a8b4c8";
  ctx.lineWidth = 5;
  ctx.strokeRect(-halfWorld, -halfWorld, worldSize, worldSize);
}

function drawVirus(ctx: CanvasRenderingContext2D, virus: NetVirus, zoom: number) {
  const r = cellRadius(virus.mass);
  ctx.fillStyle = "#22c55e";
  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 3 / zoom;
  ctx.beginPath();
  const spikes = 22;
  for (let i = 0; i <= spikes; i += 1) {
    const t = (Math.PI * 2 * i) / spikes;
    const rr = i % 2 === 0 ? r * 1.07 : r * 0.88;
    const x = virus.x + Math.cos(t) * rr;
    const y = virus.y + Math.sin(t) * rr;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawCell(ctx: CanvasRenderingContext2D, cell: NetCell, owner: NetPlayer, zoom: number) {
  const r = cellRadius(cell.mass);

  ctx.fillStyle = owner.color;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 2 / zoom;
  ctx.beginPath();
  ctx.arc(cell.x, cell.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.font = `${Math.max(12 / zoom, r / 3)}px 'Trebuchet MS', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(owner.name, cell.x, cell.y);
}
