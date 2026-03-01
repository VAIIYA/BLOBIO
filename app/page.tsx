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
  "#2ecc71", "#f1c40f", "#3498db", "#ff7eb6", "#ff9f43",
  "#2ed573", "#70a1ff", "#ff6b81",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
function cellRadius(mass: number): number {
  return Math.sqrt(mass) * 4;
}
function centroid(cells: NetCell[]): Vec2 {
  if (!cells.length) return { x: 0, y: 0 };
  let totalMass = 0; let x = 0; let y = 0;
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

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef({
    camera: { x: 0, y: 0, zoom: 1 },
    mouseScreen: { x: 0, y: 0 },
    prevSnapshot: null as NetSnapshot | null,
    currSnapshot: null as NetSnapshot | null,
    lastSnapshotRecvAt: 0,
    lastFrameAt: 0,
    fps: 0,
    ping: 0,
    connected: false,
    worldSize: WORLD_SIZE_DEFAULT,
    fallbackPellets: createFoodBgDots(200),
  });

  const serverRef = useRef({
    playerId: "",
    roomId: "",
  });

  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef({
    splitPressed: false,
    ejectPressed: false,
  });

  const [hud, setHud] = useState<HudSnapshot>({
    fps: 0,
    ping: 0,
    connected: false,
    playerMass: 0,
    playerAlive: false,
    leaderboard: [],
  });

  const [started, setStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeStoreTab, setActiveStoreTab] = useState<'premium' | 'free'>('premium');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedSkin, setSelectedSkin] = useState('default');
  const [nameInput, setNameInput] = useState('');
  const [roomInput, setRoomInput] = useState('main');
  const [gameMode, setGameMode] = useState<'ffa' | 'team'>('ffa');
  const [localColor] = useState('#' + Math.floor(Math.random() * 16777215).toString(16));
  const [joinedRoom, setJoinedRoom] = useState('main');
  const [dbLeaderboards, setDbLeaderboards] = useState<{ mass: UserProfile[], kill: UserProfile[] }>({ mass: [], kill: [] });
  const [editProfileData, setEditProfileData] = useState({ username: "", bio: "", twitter: "", youtube: "" });

  useEffect(() => {
    initSchema();
    const fetchLB = async () => {
      const mass = await getTopMassPlayers();
      const kill = await getTopKillPlayers();
      setDbLeaderboards({ mass, kill });
    };
    fetchLB();
    const timer = setInterval(fetchLB, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') inputRef.current.splitPressed = true;
      if (e.code === 'KeyE') inputRef.current.ejectPressed = true;
      if (e.code === 'Escape' && started) setIsPaused(prev => !prev);
    };
    const handleMouse = (e: MouseEvent) => {
      renderRef.current.mouseScreen = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousemove', handleMouse);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousemove', handleMouse);
    };
  }, [started]);

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
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);

      // Dark Theme Background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);

      const prevSnap = render.prevSnapshot;
      const currSnap = render.currSnapshot;
      const alpha = currSnap ? clamp((performance.now() - render.lastSnapshotRecvAt) / SNAPSHOT_MS, 0, 1) : 1;

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
      for (const virus of viruses) { drawVirus(ctx, virus, zoom); }
      for (const pw of powerups) { drawPowerUp(ctx, pw, zoom); }
      for (const obs of obstacles) { drawObstacle(ctx, obs, zoom); }

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
    const loop = () => { draw(); rafId = requestAnimationFrame(loop); };
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
      ws.send(JSON.stringify({
        type: "input",
        target,
        split: inputRef.current.splitPressed,
        eject: inputRef.current.ejectPressed,
      }));
      inputRef.current.splitPressed = false;
      inputRef.current.ejectPressed = false;
    }, 33);
    const pingTimer = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
    }, 2000);
    return () => { clearInterval(inputTimer); clearInterval(pingTimer); };
  }, []);

  useEffect(() => { return () => { if (wsRef.current) wsRef.current.close(); }; }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/profile')) setShowProfile(true);
      else if (path.includes('/team')) setGameMode('team');
      else if (path.includes('/ffa')) setGameMode('ffa');
    }
  }, []);

  const handleLogin = async () => {
    try {
      const address = await auth.connect();
      if (address) {
        let profile = await getUserProfile(address);
        if (!profile) profile = await createUserProfile(address, nameInput || 'Guest');
        if (profile) {
          setCurrentUser(profile);
          setNameInput(profile.username);
          setEditProfileData({
            username: profile.username,
            bio: profile.bio || "",
            twitter: profile.twitter || "",
            youtube: profile.youtube || ""
          });
        }
      }
    } catch (err) { console.error("Login failed", err); }
  };

  const wsUrl = () => {
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return `${protocol}//${host}:8080/ws`;
    return process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${host}:8080/ws`;
  };

  const connect = (name: string, roomId: string) => {
    if (wsRef.current) wsRef.current.close();
    const url = wsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      renderRef.current.connected = true;
      setHud(prev => ({ ...prev, connected: true }));
      ws.send(JSON.stringify({
        type: "join",
        name: name.trim() || "Blob",
        roomId: roomId.trim() || "main",
        color: localColor,
        skin: selectedSkin,
        gameMode: gameMode,
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "welcome") {
        serverRef.current.playerId = msg.playerId;
        serverRef.current.roomId = msg.roomId;
        setJoinedRoom(msg.roomId);
        renderRef.current.worldSize = Number(msg.worldSize || WORLD_SIZE_DEFAULT);
      } else if (msg.type === "snapshot") {
        renderRef.current.prevSnapshot = renderRef.current.currSnapshot;
        renderRef.current.currSnapshot = msg;
        renderRef.current.lastSnapshotRecvAt = performance.now();
      } else if (msg.type === "dead") {
        setHud(prev => ({ ...prev, playerAlive: false }));
      } else if (msg.type === "pong" && Number.isFinite(msg.t)) {
        renderRef.current.ping = Math.max(0, Date.now() - msg.t);
      }
    };
    ws.onclose = () => {
      renderRef.current.connected = false;
      setHud(prev => ({ ...prev, connected: false }));
    };
    ws.onerror = () => {
      renderRef.current.connected = false;
      setHud(prev => ({ ...prev, connected: false }));
    };
  };

  const onPlay = (e?: FormEvent) => {
    if (e) e.preventDefault();
    setStarted(true);
    connect(nameInput, roomInput);
    if (typeof window !== "undefined") window.history.pushState({ inGame: true }, "", `/${gameMode}`);
  };

  const onRespawn = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connect(nameInput, roomInput);
      return;
    }
    wsRef.current.send(JSON.stringify({ type: "respawn" }));
  };

  const handleBuySkin = async (skinId: string) => {
    if (!currentUser) { alert("Please connect your wallet first"); return; }
    await addOwnedSkin(currentUser.wallet_address, skinId);
    const updated = await getUserProfile(currentUser.wallet_address);
    if (updated) setCurrentUser(updated);
  };

  const saveProfile = async () => {
    if (!currentUser) return;
    await updateUserProfile({
      wallet_address: currentUser.wallet_address,
      username: editProfileData.username,
      bio: editProfileData.bio,
      twitter: editProfileData.twitter,
      youtube: editProfileData.youtube
    });
    const updated = await getUserProfile(currentUser.wallet_address);
    if (updated) setCurrentUser(updated);
    alert("Profile saved!");
  };

  const canShowMenu = !started || !hud.connected || !hud.playerAlive;
  const isDead = started && hud.connected && !hud.playerAlive;

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).adsbygoogle && canShowMenu) {
      try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); } catch (e) { }
    }
  }, [canShowMenu]);

  return (
    <main id="app">
      <canvas ref={canvasRef} id="gameCanvas" />
      <div id="hud">
        <div className="score-display">Mass: <span id="scoreValue">{Math.round(hud.playerMass)}</span></div>
        {started && !canShowMenu && (
          <button id="hamburgerMenuBtn" className="hamburger-btn" onClick={() => setIsPaused(true)}>
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {canShowMenu && !isDead && (
        <div id="menu">
          <div id="globalLeaderboards" className="global-leaderboards">
            <div className="lb-section">
              <h3>🏆 Top Mass</h3>
              <div id="massLeaderboard" className="lb-list">
                {dbLeaderboards.mass.map((p, i) => (
                  <div key={i} className="lb-item">
                    <span className="name">{i + 1}. {p.username}</span>
                    <span className="value">{Math.round(p.max_mass)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lb-section">
              <h3>⚔️ Top Kills</h3>
              <div id="killLeaderboard" className="lb-list">
                {dbLeaderboards.kill.map((p, i) => (
                  <div key={i} className="lb-item">
                    <span className="name">{i + 1}. {p.username}</span>
                    <span className="value">{p.kills || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div id="releaseList" className="release-list">
            <div className="lb-section">
              <h3>🚀 Latest Releases</h3>
              <div className="lb-list">
                <div className="release-item">
                  <span className="release-date">v1.16.0 - Menu Update</span>
                  <p>Added SPA routing (/ffa, /teams) and in-game pause menu with active state saving.</p>
                </div>
                <div className="release-item">
                  <span className="release-date">v1.15.0 - Map Expansion</span>
                  <p>Map doubled in size! Extra Large Viruses and 3x faster food generation added.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="menu-card">
            <h1>BLOBIO</h1>
            {!currentUser ? (
              <div id="authSection">
                <button className="solana-btn" onClick={handleLogin}>Connect Solana Wallet</button>
                <p className="auth-hint">Or play as guest below</p>
              </div>
            ) : (
              <div id="profileSection">
                <button className="solana-btn" onClick={() => setShowProfile(true)} style={{ background: 'linear-gradient(90deg, #ec4899, #8b5cf6)', color: 'white' }}>My Profile</button>
              </div>
            )}
            <input type="text" id="playerName" placeholder="Guest" maxLength={15} value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
            <h4>Game Mode</h4>
            <div className="mode-settings">
              <div className={`mode-option ${gameMode === 'ffa' ? 'active' : ''}`} onClick={() => setGameMode('ffa')}>FFA</div>
              <div className={`mode-option ${gameMode === 'team' ? 'active' : ''}`} onClick={() => setGameMode('team')}>Team</div>
            </div>
            <h4>Skin</h4>
            <div className="skin-options">
              {freeSkins.map(skin => (
                <div key={skin.id} className={`skin-option ${selectedSkin === skin.id ? 'active' : ''}`} onClick={() => setSelectedSkin(skin.id)} style={skin.type === 'color' ? { background: (skin as any).value } : skin.type === 'gradient' ? { background: (skin as any).value } : { backgroundImage: `url(/skins/${skin.id}.png)`, backgroundSize: 'cover' }}></div>
              ))}
            </div>
            <button className="solana-btn" onClick={() => setShowStore(true)} style={{ background: '#eab308', color: '#fff', marginTop: 10 }}>Open Store</button>
            <button className="play-btn" onClick={() => onPlay()}>Play</button>
            <div className="controls-hint">Desktop: Mouse to move, Space to Split, E to Eject<br />Mobile: Touch to move</div>
            <div className="ad-banner-container">
              <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client="ca-pub-8049952818757963" data-ad-slot="8049952818" data-ad-format="auto" data-full-width-responsive="true"></ins>
            </div>
          </div>
        </div>
      )}

      {isDead && (
        <div id="deathPopup" className="death-popup">
          <div className="popup-card">
            <h2>DEFEATED</h2>
            <div className="death-stats"><p>Final Mass: {Math.round(hud.playerMass)}</p></div>
            <div className="popup-actions">
              <button className="play-btn" onClick={onRespawn}>RESTART</button>
              <button className="solana-btn" style={{ background: '#2563eb' }} onClick={() => setStarted(false)}>QUIT</button>
            </div>
          </div>
        </div>
      )}

      {isPaused && (
        <div id="pauseModal" className="pause-modal">
          <div className="popup-card">
            <h2>Game Paused</h2>
            <div className="popup-actions">
              <button className="play-btn" onClick={() => setIsPaused(false)}>Resume Game</button>
              <button className="solana-btn danger" onClick={() => { setIsPaused(false); setStarted(false); wsRef.current?.close(); }}>Leave Game</button>
            </div>
          </div>
        </div>
      )}

      {showStore && (
        <div id="storeModal" className="store-modal">
          <div className="store-card">
            <div className="store-header"><h2>Skins Store</h2><button className="close-btn" onClick={() => setShowStore(false)}>&times;</button></div>
            <div className="store-tabs">
              <button className={`store-tab ${activeStoreTab === 'premium' ? 'active' : ''}`} onClick={() => setActiveStoreTab('premium')}>Premium</button>
              <button className={`store-tab ${activeStoreTab === 'free' ? 'active' : ''}`} onClick={() => setActiveStoreTab('free')}>Free</button>
            </div>
            <div className="store-grid">
              {(activeStoreTab === 'premium' ? premiumSkins : freeSkins).map(skin => {
                const isOwned = (currentUser?.owned_skins || freeSkins.map(s => s.id)).includes(skin.id);
                const isEquipped = selectedSkin === skin.id;
                return (
                  <div key={skin.id} className="skin-card">
                    <div className="skin-preview" style={skin.type === 'color' ? { background: (skin as any).value } : skin.type === 'gradient' ? { background: (skin as any).value } : { backgroundImage: `url(/skins/${skin.id}.png)`, backgroundSize: 'cover' }}></div>
                    <div className="skin-name">{skin.name}</div>
                    {isEquipped ? <button className="skin-action-btn btn-equipped">Equipped</button> : isOwned ? <button className="skin-action-btn btn-equip" onClick={() => setSelectedSkin(skin.id)}>Equip</button> : <button className="skin-action-btn btn-buy" onClick={() => handleBuySkin(skin.id)}>Buy (0.1 SOL)</button>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showProfile && currentUser && (
        <div id="profileModal" className="profile-modal">
          <div className="profile-layout">
            <div className="profile-header-card">
              <div className="profile-avatar" id="profileAvatar" style={{ backgroundImage: selectedSkin !== 'default' ? `url(/skins/${selectedSkin}.png)` : 'none', backgroundSize: 'cover' }}></div>
              <div className="profile-title">
                <div className="profile-tags"><span className="tag verified">Verified Wallet</span><span className="tag premium">BLOBIO Player</span></div>
                <h2>{currentUser.username}</h2>
                <p className="wallet-hash">{currentUser.wallet_address.substring(0, 5)}...{currentUser.wallet_address.substring(currentUser.wallet_address.length - 5)}</p>
              </div>
              <button className="close-btn" onClick={() => setShowProfile(false)}>&times;</button>
              <div className="profile-stats-grid">
                <div className="stat-box"><h3>{currentUser.wins}</h3><p>WINS</p></div>
                <div className="stat-box"><h3>{currentUser.losses}</h3><p>LOSSES</p></div>
                <div className="stat-box"><h3>{Math.round(currentUser.max_mass)}</h3><p>MAX MASS</p></div>
                <div className="stat-box"><h3>{currentUser.kills}</h3><p>KILLS</p></div>
              </div>
            </div>
            <div className="profile-body-grid">
              <div className="profile-settings-card">
                <h3>Account Settings</h3>
                <div className="input-group"><label>DISPLAY NAME</label><input type="text" value={editProfileData.username} onChange={e => setEditProfileData({ ...editProfileData, username: e.target.value })} /></div>
                <div className="input-group"><label>BIO</label><textarea rows={4} value={editProfileData.bio} onChange={e => setEditProfileData({ ...editProfileData, bio: e.target.value })}></textarea></div>
                <button className="save-btn" onClick={saveProfile}>Synchronize Changes</button>
              </div>
              <div className="profile-inventory-card">
                <div className="inventory-header"><h3># My Skins</h3></div>
                <div className="inventory-grid">
                  {(currentUser.owned_skins || freeSkins.map(s => s.id)).map(skinId => {
                    const skin = [...premiumSkins, ...freeSkins].find(s => s.id === skinId);
                    if (!skin) return null;
                    return (
                      <div key={skinId} className="skin-card">
                        <div className="skin-preview" style={skin.type === 'color' ? { background: (skin as any).value } : skin.type === 'gradient' ? { background: (skin as any).value } : { backgroundImage: `url(/skins/${skin.id}.png)`, backgroundSize: 'cover' }}></div>
                        <h4>{skin.name}</h4>
                        <button className={`solana-btn ${selectedSkin === skinId ? 'btn-equipped' : 'btn-equip'}`} onClick={() => setSelectedSkin(skinId)}>{selectedSkin === skinId ? 'Equipped' : 'Equip'}</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, left: number, right: number, top: number, bottom: number) {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  const step = 200;
  for (let x = Math.floor(left / step) * step; x <= right; x += step) {
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }
  for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  }
}

function drawBorders(ctx: CanvasRenderingContext2D, worldSize: number) {
  const halfWorld = worldSize / 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 10;
  ctx.strokeRect(-halfWorld, -halfWorld, worldSize, worldSize);
}

function drawVirus(ctx: CanvasRenderingContext2D, virus: NetVirus, zoom: number) {
  const r = cellRadius(virus.mass);
  ctx.save();
  ctx.translate(virus.x, virus.y);
  ctx.fillStyle = "#33ff33";
  ctx.strokeStyle = "#11aa11";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 24; i += 1) {
    const angle = (i * Math.PI * 2) / 24;
    const dist = i % 2 === 0 ? r : r * 1.15;
    ctx.lineTo(Math.cos(angle) * dist, Math.sin(angle) * dist);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawCell(ctx: CanvasRenderingContext2D, cell: NetCell, player: NetPlayer, zoom: number) {
  const r = cellRadius(cell.mass);
  ctx.save();
  ctx.translate(cell.x, cell.y);
  if (player.skin && player.skin !== 'default') {
    const img = new Image();
    img.src = `/skins/${player.skin}.png`;
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    try { ctx.drawImage(img, -r, -r, r * 2, r * 2); } catch (e) { }
    ctx.restore();
    ctx.strokeStyle = player.color; ctx.lineWidth = 3; ctx.stroke();
  } else {
    ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2; ctx.stroke();
  }
  if (zoom > 0.4) {
    ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `${Math.max(12, r / 3)}px bold Inter, sans-serif`;
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4;
    ctx.fillText(player.name, 0, 0);
    if (zoom > 0.6) {
      ctx.font = `${Math.max(10, r / 4.5)}px Inter, sans-serif`;
      ctx.fillText(Math.round(cell.mass).toString(), 0, r / 2);
    }
  }
  ctx.restore();
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pw: NetPowerUp, zoom: number) {
  const r = 25;
  ctx.save(); ctx.translate(pw.x, pw.y); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  if (pw.type === 'SPEED') { ctx.fillStyle = '#0ea5e9'; ctx.fill(); ctx.strokeStyle = '#bae6fd'; }
  else if (pw.type === 'SHIELD') { ctx.fillStyle = '#8b5cf6'; ctx.fill(); ctx.strokeStyle = '#ddd6fe'; }
  else { ctx.fillStyle = '#eab308'; ctx.fill(); ctx.strokeStyle = '#fef08a'; }
  ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = 'white'; ctx.font = `bold 18px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(pw.type === 'SPEED' ? '⚡' : pw.type === 'SHIELD' ? '🛡️' : 'M', 0, 0);
  ctx.restore();
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: NetObstacle, zoom: number) {
  ctx.save(); ctx.translate(obs.x, obs.y); ctx.rotate(obs.rotation);
  ctx.fillStyle = obs.color || '#475569'; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 3;
  ctx.beginPath();
  if (obs.shape === 'RECT') { const w = obs.radius * 2; const h = obs.radius * 2; ctx.rect(-w / 2, -h / 2, w, h); }
  else if (obs.shape === 'CIRCLE') { ctx.arc(0, 0, obs.radius, 0, Math.PI * 2); }
  else if (obs.shape === 'TRIANGLE') { const r = obs.radius; ctx.moveTo(0, -r); ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath(); }
  ctx.fill(); ctx.stroke(); ctx.restore();
}
