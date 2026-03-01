"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { auth } from "./lib/auth";
import { getUserProfile, createUserProfile, updateUserProfile, initSchema, UserProfile, getTopMassPlayers, getTopKillPlayers, addOwnedSkin } from "./lib/db";

type Vec2 = { x: number; y: number };

const premiumSkins = [
  { id: 'tiger', name: 'Tiger', type: 'image' },
  { id: 'skull', name: 'Skull', type: 'image' },
  { id: 'pumpkin', name: 'Pumpkin', type: 'image' },
  { id: 'ninja', name: 'Ninja', type: 'image' },
  { id: 'gorilla', name: 'Gorilla', type: 'image' }
];

const freeSkins = [
  { id: 'default', name: 'Default', type: 'color', value: '#3b82f6' },
  { id: 'neon', name: 'Neon', type: 'gradient', value: 'linear-gradient(45deg, #3b82f6, #60a5fa)' },
  { id: 'doge', name: 'Doge', type: 'image' },
  { id: 'bunny', name: 'Bunny', type: 'image' },
  { id: 'alien_face', name: 'Alien Face', type: 'image' }
];

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

type NetPowerUp = {
  id: string;
  x: number;
  y: number;
  type: string;
};

type NetObstacle = {
  id: string;
  x: number;
  y: number;
  radius: number;
  shape: string;
  color: string;
  rotation: number;
};

type NetPlayer = {
  id: string;
  name: string;
  color: string;
  skin: string;
  team?: string;
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
  gameMode: "ffa" | "team";
  players: NetPlayer[];
  cells: NetCell[];
  pellets: NetPellet[];
  viruses: NetVirus[];
  powerups: NetPowerUp[];
  obstacles: NetObstacle[];
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
  const [gameMode, setGameMode] = useState<"ffa" | "team">("ffa");
  const [selectedSkin, setSelectedSkin] = useState("default");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [started, setStarted] = useState(false);

  // Modals & HUD state
  const [showProfile, setShowProfile] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeStoreTab, setActiveStoreTab] = useState<"premium" | "free">("premium");

  // Auth & Profile state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [dbLeaderboards, setDbLeaderboards] = useState({ mass: [] as any[], kill: [] as any[] });

  // Edit Profile internal state
  const [editProfileData, setEditProfileData] = useState({ username: "", twitter: "", youtube: "", bio: "" });

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
    async function init() {
      await initSchema();
      const massLb = await getTopMassPlayers(5);
      const killLb = await getTopKillPlayers(5);
      setDbLeaderboards({ mass: massLb, kill: killLb });
    }
    init();
  }, []);

  const handleLogin = async () => {
    const wallet = await auth.connect();
    if (wallet) {
      let profile = await getUserProfile(wallet);
      if (!profile) {
        profile = await createUserProfile(wallet, nameInput || 'Guest');
      }
      if (profile) {
        setCurrentUser(profile);
        setNameInput(profile.username);
        setEditProfileData({ username: profile.username, twitter: profile.twitter || "", youtube: profile.youtube || "", bio: profile.bio || "" });
      }
    }
  };

  const saveProfile = async () => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...editProfileData };
    await updateUserProfile(updated);
    setCurrentUser(updated);
    setNameInput(updated.username);
    alert("Profile saved!");
  };

  const handleBuySkin = async (skinId: string) => {
    if (!auth.isConnected() || !currentUser) {
      alert("Please connect wallet first");
      return;
    }
    const success = await auth.purchaseSkin(0.1, "2Z9eW3nwa2GZUM1JzXdfBK1MN57RPA2PrhuTREEZ31VY");
    if (success) {
      await addOwnedSkin(auth.walletAddress!, skinId);
      const newOwned = [...(currentUser.owned_skins || freeSkins.map(s => s.id)), skinId];
      setCurrentUser({ ...currentUser, owned_skins: newOwned });
      alert(`Successfully purchased ${skinId}!`);
    }
  };

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
      let powerups: NetPowerUp[] = [];
      let obstacles: NetObstacle[] = [];

      if (currSnap) {
        players = new Map(currSnap.players.map((p) => [p.id, p]));
        const prevCells = new Map((prevSnap?.cells ?? []).map((c) => [c.id, c]));

        cells = currSnap.cells.map((c: any) => {
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
        powerups = currSnap.powerups;
        obstacles = currSnap.obstacles;
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

      for (const pw of powerups) {
        drawPowerUp(ctx, pw, zoom);
      }

      for (const obs of obstacles) {
        drawObstacle(ctx, obs, zoom);
      }

      const sortedCells = [...cells].sort((a, b) => a.mass - b.mass);
      for (const cell of sortedCells) {
        const owner = players.get(cell.ownerId);
        if (!owner) continue;
        drawCell(ctx, cell, owner, zoom);
      }

      ctx.restore();

      if (currSnap && now - hudUpdatedAt > 120) {
        const ranking = currSnap.leaderboard.map((entry: any) => ({
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
          skin: selectedSkin,
          gameMode: gameMode,
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
        setHud((prev: any) => ({ ...prev, playerAlive: false }));
        return;
      }

      if (msg.type === "pong" && Number.isFinite(msg.t)) {
        renderRef.current.ping = Math.max(0, Date.now() - msg.t);
      }
    };

    ws.onclose = () => {
      renderRef.current.connected = false;
      setHud((prev: any) => ({ ...prev, connected: false }));
    };

    ws.onerror = () => {
      renderRef.current.connected = false;
      setHud((prev: any) => ({ ...prev, connected: false }));
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
          {hud.leaderboard.map((entry: any) => (
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
        {!started && <button onClick={() => setShowStore(true)} style={{ marginTop: 10, padding: 8, background: '#3b82f6', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer' }}>Open Store</button>}
      </section>

      {started && !canShowMenu && (
        <button
          onClick={() => setIsPaused(true)}
          style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 50, padding: '10px 20px', borderRadius: 20, background: 'rgba(255,255,255,0.8)', border: '1px solid #ccc', cursor: 'pointer' }}
        >
          ⏸ Pause
        </button>
      )}

      {isPaused && (
        <div className="overlay" style={{ zIndex: 60 }}>
          <div className="panel" style={{ textAlign: 'center' }}>
            <h2>Game Paused</h2>
            <button onClick={() => setIsPaused(false)}>Resume</button>
            <button onClick={() => { setIsPaused(false); setStarted(false); wsRef.current?.close(); }} style={{ background: '#ef4444' }}>Leave Room</button>
          </div>
        </div>
      )}

      {showStore && (
        <div className="overlay" style={{ zIndex: 60 }}>
          <div className="panel" style={{ width: 600, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Store & Skins</h2>
              <button onClick={() => setShowStore(false)} style={{ background: 'transparent', color: '#333', padding: 0 }}>✖</button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button onClick={() => setActiveStoreTab('premium')} style={{ flex: 1, background: activeStoreTab === 'premium' ? '#3b82f6' : '#e2e8f0', color: activeStoreTab === 'premium' ? '#fff' : '#333' }}>Premium (SOL)</button>
              <button onClick={() => setActiveStoreTab('free')} style={{ flex: 1, background: activeStoreTab === 'free' ? '#3b82f6' : '#e2e8f0', color: activeStoreTab === 'free' ? '#fff' : '#333' }}>Free</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
              {(activeStoreTab === 'premium' ? premiumSkins : freeSkins).map(skin => {
                const defaultOwned = freeSkins.map(s => s.id);
                const isOwned = (currentUser?.owned_skins || defaultOwned).includes(skin.id);
                const isEquipped = selectedSkin === skin.id;
                return (
                  <div key={skin.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                    <div style={{ width: 60, height: 60, margin: '0 auto 10px', borderRadius: '50%', background: skin.type === 'color' ? (skin as any).value : skin.type === 'gradient' ? (skin as any).value : `url(/skins/${skin.id}.png) center/cover` }}></div>
                    <p style={{ fontSize: 14, fontWeight: 'bold' }}>{skin.name}</p>
                    {isEquipped ? (
                      <button disabled style={{ width: '100%', background: '#22c55e', marginTop: 10 }}>Equipped</button>
                    ) : isOwned ? (
                      <button onClick={() => setSelectedSkin(skin.id)} style={{ width: '100%', background: '#3b82f6', marginTop: 10 }}>Equip</button>
                    ) : (
                      <button onClick={() => handleBuySkin(skin.id)} style={{ width: '100%', background: '#f59e0b', marginTop: 10 }}>Buy (0.1 SOL)</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showProfile && currentUser && (
        <div className="overlay" style={{ zIndex: 60 }}>
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Profile</h2>
              <button onClick={() => setShowProfile(false)} style={{ background: 'transparent', color: '#333', padding: 0 }}>✖</button>
            </div>
            <p>Wallet: {currentUser.wallet_address.substring(0, 8)}...</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 15, background: '#f1f5f9', padding: 10, borderRadius: 8 }}>
              <div><b>Wins:</b> {currentUser.wins}</div>
              <div><b>Losses:</b> {currentUser.losses}</div>
              <div><b>Kills:</b> {currentUser.kills}</div>
              <div><b>Max Mass:</b> {Math.round(currentUser.max_mass)}</div>
            </div>
            <label>Username <input value={editProfileData.username} onChange={e => setEditProfileData({ ...editProfileData, username: e.target.value })} /></label>
            <label>Twitter <input value={editProfileData.twitter} onChange={e => setEditProfileData({ ...editProfileData, twitter: e.target.value })} /></label>
            <button onClick={saveProfile} style={{ marginTop: 10 }}>Save Profile</button>
          </div>
        </div>
      )}

      {canShowMenu && (
        <section className="overlay">
          <form className="panel" onSubmit={onPlay} style={{ width: 600, maxWidth: '95vw', gridTemplateColumns: '1fr 300px' }}>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 32, marginBottom: 5 }}>
                  {!started ? "VAIIYA ARENA" : !hud.connected ? "Disconnected" : "You were eaten"}
                </h2>
                <p>Next.js Server-Authoritative Port</p>
              </div>
              {!currentUser ? (
                <button type="button" onClick={handleLogin} style={{ background: '#8b5cf6' }}>Connect Wallet</button>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => setShowProfile(true)} style={{ background: '#64748b' }}>{currentUser.username}</button>
                  <button type="button" onClick={() => setShowStore(true)} style={{ background: '#f59e0b' }}>Store</button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
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
              <div>
                <label style={{ marginBottom: 8, display: 'block' }}>Game Mode</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => setGameMode('ffa')} style={{ flex: 1, background: gameMode === 'ffa' ? '#3b82f6' : '#e2e8f0', color: gameMode === 'ffa' ? '#fff' : '#333' }}>FFA</button>
                  <button type="button" onClick={() => setGameMode('team')} style={{ flex: 1, background: gameMode === 'team' ? '#ef4444' : '#e2e8f0', color: gameMode === 'team' ? '#fff' : '#333' }}>Team</button>
                </div>
              </div>
              {!started || !hud.connected ? (
                <button type="submit" style={{ padding: '16px', fontSize: '1.2rem', marginTop: 10 }}>{started ? "Reconnect" : "Play"}</button>
              ) : (
                <button type="button" onClick={onRespawn} style={{ padding: '16px', fontSize: '1.2rem', marginTop: 10 }}>
                  Respawn
                </button>
              )}
            </div>

            <div style={{ background: '#f8fafc', padding: 15, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Global Rankings</h3>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 5px', fontSize: 13, color: '#64748b' }}>Top Mass</h4>
                  <div style={{ fontSize: 13 }}>
                    {dbLeaderboards.mass.map((p, i) => <div key={i} style={{ marginBottom: 4 }}><b>{i + 1}.</b> {p.username} <span style={{ float: 'right' }}>{Math.round(p.max_mass)}</span></div>)}
                  </div>
                </div>
              </div>
            </div>
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

  ctx.save();
  ctx.beginPath();
  ctx.arc(cell.x, cell.y, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip(); // Clip everything to the blob circle

  ctx.fillStyle = owner.color;
  ctx.fill();

  if (owner.skin && owner.skin !== 'default' && owner.skin !== 'neon' && typeof window !== 'undefined') {
    // Only fetch if image
    let img = (window as any)[`__skin_${owner.skin}`];
    if (!img) {
      img = new Image();
      img.src = `/skins/${owner.skin}.png`;
      (window as any)[`__skin_${owner.skin}`] = img;
    }
    if (img.complete && img.naturalHeight !== 0) {
      ctx.drawImage(img, cell.x - r, cell.y - r, r * 2, r * 2);
    }
  } else if (owner.skin === 'neon') {
    const gradient = ctx.createLinearGradient(cell.x - r, cell.y - r, cell.x + r, cell.y + r);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(1, '#60a5fa');
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 2 / zoom;
  ctx.stroke();

  ctx.restore();

  // Draw name outside of clip mask
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 3 / zoom;
  ctx.font = `bold ${Math.max(12 / zoom, r / 3)}px 'Trebuchet MS', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(owner.name, cell.x, cell.y);
  ctx.fillText(owner.name, cell.x, cell.y);
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pw: NetPowerUp, zoom: number) {
  const r = 20;
  ctx.beginPath();
  ctx.arc(pw.x, pw.y, r, 0, Math.PI * 2);

  if (pw.type === 'SPEED') {
    ctx.fillStyle = '#0ea5e9'; // Blue shield
    ctx.fill();
    ctx.strokeStyle = '#bae6fd';
  } else if (pw.type === 'SHIELD') {
    ctx.fillStyle = '#8b5cf6'; // Purple shield
    ctx.fill();
    ctx.strokeStyle = '#ddd6fe';
  } else {
    ctx.fillStyle = '#eab308'; // Yellow Mass
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
  }

  ctx.lineWidth = 4 / zoom;
  ctx.stroke();

  // Icon
  ctx.fillStyle = 'white';
  ctx.font = `bold ${14 / zoom}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pw.type === 'SPEED' ? '⚡' : pw.type === 'SHIELD' ? '🛡️' : 'M', pw.x, pw.y);
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: NetObstacle, zoom: number) {
  ctx.save();
  ctx.translate(obs.x, obs.y);
  ctx.rotate(obs.rotation);

  ctx.fillStyle = obs.color;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 3 / zoom;

  ctx.beginPath();
  if (obs.shape === 'RECT') {
    const w = obs.radius * 2;
    const h = obs.radius * 2; // For now keeping square
    ctx.rect(-w / 2, -h / 2, w, h);
  } else if (obs.shape === 'CIRCLE') {
    ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
  } else if (obs.shape === 'TRIANGLE') {
    const r = obs.radius;
    ctx.moveTo(0, -r);
    ctx.lineTo(r, r);
    ctx.lineTo(-r, r);
    ctx.closePath();
  }

  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
