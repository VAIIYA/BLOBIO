'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { loadSave, writeSave, SaveData } from '@/lib/persistence';
import { GameEngine } from '@/lib/engine';
import { MapDef } from '@/lib/maps';
import { SKINS } from '@/lib/skins';
import MenuScreen from '@/components/MenuScreen';
import SkinScreen from '@/components/SkinScreen';
import GameCanvas from '@/components/GameCanvas';
import HUD from '@/components/HUD';
import DeathScreen from '@/components/DeathScreen';
import Overlays, { ToastItem, XPPopItem, BannerItem, UnlockItem } from '@/components/Overlays';

type Screen = 'menu' | 'skins' | 'playing' | 'dead';
interface DeathStats { peakMass: number; elapsed: number; kills: number; sessionXP: number; }

let idCounter = 0;
const nextId = () => ++idCounter;

export default function Home() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const [hudTick, setHudTick] = useState(0);
  const [deathStats, setDeathStats] = useState<DeathStats | null>(null);
  const [prevUnlockedCount, setPrevUnlockedCount] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [xpPops, setXpPops] = useState<XPPopItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [unlocks, setUnlocks] = useState<UnlockItem[]>([]);
  const engineRef = useRef<GameEngine | null>(null);
  const playerNameRef = useRef<string>('Blob');

  useEffect(() => {
    setSave(loadSave());
  }, []);

  const addToast = useCallback((msg: string, color?: string) => {
    const id = nextId();
    setToasts(t => [...t, { id, msg, color }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3100);
  }, []);

  const addXPPop = useCallback((amount: number, x: number, y: number) => {
    const id = nextId();
    setXpPops(p => [...p, { id, x, y, amount }]);
    setTimeout(() => setXpPops(p => p.filter(x => x.id !== id)), 1100);
  }, []);

  const addBanner = useCallback((level: number) => {
    const id = nextId();
    setBanners(b => [...b, { id, type: 'levelup' as const, level }]);
    setTimeout(() => setBanners(b => b.filter(x => x.id !== id)), 2600);
  }, []);

  const addUnlock = useCallback((skinName: string, skinId: number) => {
    const id = nextId();
    setUnlocks(u => [...u, { id, skinName, skinId }]);
    setTimeout(() => setUnlocks(u => u.filter(x => x.id !== id)), 3100);
  }, []);

  const startGame = useCallback((playerName: string, currentSave?: SaveData) => {
    const s = currentSave ?? save;
    if (!s) return;
    playerNameRef.current = playerName;

    const engine = new GameEngine(s);
    engine.events.onXP = (amount, sx, sy) => addXPPop(amount, sx, sy);
    engine.events.onLevelUp = (lvl) => addBanner(lvl);
    engine.events.onUnlock = (name, id) => addUnlock(name, id);
    engine.events.onMapUnlock = (map: MapDef) =>
      addToast(`🗺️ Map unlocked: <b>${map.emoji} ${map.name}</b>!`, 'rgba(0,255,208,.4)');
    engine.events.onDied = (stats) => {
      writeSave(engine.save);
      setSave({ ...engine.save });
      setDeathStats(stats);
      setPrevUnlockedCount(s.unlockedSkins.length);
      setScreen('dead');
    };

    engine.start(s.selectedMap, s.selectedSkin, playerName);
    engineRef.current = engine;
    setScreen('playing');
  }, [save, addXPPop, addBanner, addUnlock, addToast]);

  const handleHudUpdate = useCallback(() => {
    if (engineRef.current) writeSave(engineRef.current.save);
    setHudTick(t => t + 1);
  }, []);

  const handleSelectMap = useCallback((id: number) => {
    if (!save) return;
    const s = { ...save, selectedMap: id };
    writeSave(s);
    setSave(s);
  }, [save]);

  const handleSelectSkin = useCallback((id: number) => {
    if (!save) return;
    if (!save.unlockedSkins.includes(id)) {
      const skin = SKINS[id];
      addToast(`🔒 Need ${skin?.xpRequired ?? '?'} XP — you have ${save.xp}`, 'rgba(251,191,36,.4)');
      return;
    }
    const s = { ...save, selectedSkin: id };
    writeSave(s);
    setSave(s);
  }, [save, addToast]);

  const handleRespawn = useCallback(() => {
    const fresh = loadSave();
    setSave(fresh);
    startGame(playerNameRef.current, fresh);
  }, [startGame]);

  const handleMenu = useCallback(() => {
    engineRef.current = null;
    const fresh = loadSave();
    setSave(fresh);
    setScreen('menu');
  }, []);

  if (!save) {
    return (
      <div style={{
        position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
        background:'#07080f',color:'#00ffd0',fontFamily:"'Space Mono',monospace",fontSize:14,
      }}>
        Loading…
      </div>
    );
  }

  return (
    <>
      {screen === 'playing' && engineRef.current && (
        <>
          <GameCanvas engine={engineRef.current} onUpdate={handleHudUpdate} />
          <HUD engine={engineRef.current} key={hudTick} />
        </>
      )}

      {screen === 'menu' && (
        <MenuScreen
          save={save}
          onPlay={startGame}
          onOpenSkins={() => setScreen('skins')}
          onSelectMap={handleSelectMap}
        />
      )}

      {screen === 'skins' && (
        <SkinScreen
          save={save}
          onBack={() => setScreen('menu')}
          onSelect={handleSelectSkin}
        />
      )}

      {screen === 'dead' && deathStats && (
        <DeathScreen
          stats={deathStats}
          save={save}
          prevUnlockedCount={prevUnlockedCount}
          onRespawn={handleRespawn}
          onMenu={handleMenu}
        />
      )}

      <Overlays toasts={toasts} xpPops={xpPops} banners={banners} unlocks={unlocks} />
    </>
  );
}
