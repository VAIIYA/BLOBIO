export interface MapDef {
  id: number;
  name: string;
  emoji: string;
  xpReq: number;
  bg: string;
  gridColor: string;
  borderColor: string;
  foodColors: () => string;
  structures: false | 'walls' | 'pillars' | 'organic' | 'islands' | 'maze';
  description: string;
}

export const MAPS: MapDef[] = [
  {
    id: 0, name: 'The Petri Dish', emoji: '🧫', xpReq: 0,
    bg: '#07080f', gridColor: 'rgba(255,255,255,0.03)', borderColor: '#ff2d55',
    foodColors: () => `hsl(${~~(Math.random() * 360)},80%,60%)`,
    structures: false, description: 'Classic arena',
  },
  {
    id: 1, name: 'Neon City', emoji: '🌆', xpReq: 300,
    bg: '#05030f', gridColor: 'rgba(0,255,208,0.04)', borderColor: '#00ffd0',
    foodColors: () => (['#00ffd0', '#ff00ff', '#00aaff', '#ffff00'] as string[])[~~(Math.random() * 4)],
    description: 'Urban corridors', structures: 'walls',
  },
  {
    id: 2, name: 'The Void', emoji: '🌌', xpReq: 700,
    bg: '#000005', gridColor: 'rgba(139,92,246,0.04)', borderColor: '#7c3aed',
    foodColors: () => `hsl(${250 + ~~(Math.random() * 80)},90%,${50 + ~~(Math.random() * 30)}%)`,
    description: 'Deep space chaos', structures: 'pillars',
  },
  {
    id: 3, name: 'Bio Lab', emoji: '🔬', xpReq: 1500,
    bg: '#001a00', gridColor: 'rgba(0,255,100,0.04)', borderColor: '#00ff66',
    foodColors: () => `hsl(${90 + ~~(Math.random() * 60)},80%,50%)`,
    description: 'Organic corridors', structures: 'organic',
  },
  {
    id: 4, name: 'Lava Zone', emoji: '🌋', xpReq: 3000,
    bg: '#1a0000', gridColor: 'rgba(255,60,0,0.04)', borderColor: '#ff3300',
    foodColors: () => `hsl(${~~(Math.random() * 40)},100%,55%)`,
    description: 'Extreme heat', structures: 'islands',
  },
  {
    id: 5, name: 'Crystal Cave', emoji: '💎', xpReq: 6000,
    bg: '#000d1a', gridColor: 'rgba(0,200,255,0.05)', borderColor: '#00c8ff',
    foodColors: () => `hsl(${180 + ~~(Math.random() * 60)},90%,60%)`,
    description: 'Prismatic labyrinth', structures: 'maze',
  },
];
