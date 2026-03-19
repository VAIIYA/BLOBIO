export interface SaveData {
  xp: number;
  level: number;
  unlockedSkins: number[];
  selectedSkin: number;
  unlockedMaps: number[];
  selectedMap: number;
  games: number;
  bestMass: number;
  kills: number;
}

const SAVE_KEY = 'blobio_v3';

export function loadSave(): SaveData {
  if (typeof window === 'undefined') return defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function defaultSave(): SaveData {
  return {
    xp: 0, level: 1,
    unlockedSkins: [0], selectedSkin: 0,
    unlockedMaps: [0], selectedMap: 0,
    games: 0, bestMass: 0, kills: 0,
  };
}

export function xpForLevel(l: number) {
  return Math.floor(120 * Math.pow(l, 1.55));
}

export function currentLevel(xp: number) {
  let l = 1, x = xp;
  while (x >= xpForLevel(l)) { x -= xpForLevel(l); l++; }
  return l;
}

export function xpIntoLevel(xp: number) {
  let x = xp, l = 1;
  while (x >= xpForLevel(l)) { x -= xpForLevel(l); l++; }
  return x;
}
