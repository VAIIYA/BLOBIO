# BLOB.IO — Next.js Edition

An agar-style browser game built with Next.js 15, TypeScript, and HTML5 Canvas.

## Features

- 🎮 100 unique skins across 11 categories (Classic, Meme, Kawaii, Cyberpunk, Art, Nature, Space, Food, Retro, Mythic)
- 🗺️ 6 maps with different structures (walls, pillars, organic blobs, islands, maze)
- ⚡ XP / levelling system with localStorage persistence
- 🤖 28 AI bots with chase/flee/food-seek logic
- 🦠 Virus splitting mechanics
- 🗂️ Leaderboard + minimap HUD
- 📱 Touch support (tap to split)

## Deploy to Vercel (3 steps)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Click **Deploy** — no config needed, Vercel auto-detects Next.js

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Controls

| Key | Action |
|-----|--------|
| Mouse | Move |
| Space | Split |
| W | Eject mass |
| Q | Force merge |
| Tap (mobile) | Split |

## Project Structure

```
src/
  app/
    layout.tsx      # Root layout + fonts
    page.tsx        # Main game orchestration (screen routing, game loop)
    globals.css     # Base CSS variables
  components/
    MenuScreen.tsx  # Main menu with XP bar, skin picker, map selector
    SkinScreen.tsx  # Full skin collection browser
    HUD.tsx         # In-game HUD (mass, rank, leaderboard, XP bar)
    DeathScreen.tsx # Death screen with stats + XP gain
    SkinCanvas.tsx  # Canvas-based skin thumbnail renderer
    Overlays.tsx    # Toast, XP popups, level-up banner
  lib/
    engine.ts       # Core game engine (physics, AI, eating, XP)
    renderer.ts     # Canvas renderer (world, cells, minimap)
    skins.ts        # All 100 skin draw functions
    maps.ts         # Map definitions
    persistence.ts  # localStorage save/load + XP helpers
```
