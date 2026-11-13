# BlockFire: Craft Royale 🎮🔥

[![CI](https://github.com/Sureshldupulapati/blockfire-royale/actions/workflows/ci.yml/badge.svg)](https://github.com/Sureshldupulapati/blockfire-royale/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Three.js](https://img.shields.io/badge/Three.js-r174-blue.svg)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

**BlockFire: Craft Royale** is a high-octane 3D browser battle royale game that seamlessly blends the best mechanics of three legendary titles:
1. **Minecraft**: Fully destructible and constructible voxel terrain, tactical block building (ramps, walls, watchtowers), dynamic resource gathering (wood and stone) with a pickaxe.
2. **PUBG**: High-altitude parachute deployment, realistic gun mechanics (M416, AKM, AWM, MP40, Shotguns), recoil & spread bloom, supply plane airdrops with red flare smoke, top compass bearing ribbon, and a multi-phase contracting electric blue safe zone.
3. **Free Fire**: Instant deployable holographic **Gloo Wall** ice barriers, active character abilities (*DJ Alok "Drop the Beat"* speed & healing aura), floating damage numbers, fast-paced arcade gunplay, and the triumphant **BOOYAH!** victory celebration.

---

## 🌟 Key Features

### 🪓 Minecraft Voxel Engine
- **Procedural Voxel Terrain**: Rolling hills, sandy shores, oak forests, brick military watchtowers, and underground stone foundations.
- **Greedy Face-Culled Meshing**: Renders multi-chunk worlds at a locked 60 FPS by only meshing exterior faces against transparent air blocks.
- **Fast 3D DDA Raymarching**: Pixel-perfect voxel ray traversal (Amanatides & Woo algorithm) for instant mining, block placement, and ballistic impact calculation.
- **Procedural Canvas Texture Atlas**: Sharp 16x16 pixel-art textures generated at runtime in HTML5 Canvas. Zero external texture image files required!

### 🪂 PUBG Battle Royale Framework
- **Airborne Deployment**: Drop from 60 meters above the voxel battlefield; control descent velocity and deploy military parachute with spacebar.
- **Shrinking Electric Playzone**: Multi-phase contracting blue forcefield cylinder with dynamic center shifts and escalating damage ticks.
- **Supply Plane AirDrops**: Cargo crates descending via parachute, detonating red smoke flares on touchdown and containing tier-3 military loot.
- **Ballistics & Recoil**: Procedural camera kick, spring recovery dampening, headshot multipliers (2.2x - 2.8x), and dynamic crosshair bloom.

### 🧊 Free Fire Signature Mechanics
- **Deployable Gloo Wall**: Press `[G]` or select slot 4 to instantly construct a curved 5-column wide defensive ice barrier in front of you. Blocks incoming hostile gunfire in open-field shootouts!
- **Alok Skill ("Drop the Beat")**: Press `[E]` to trigger a 5-meter pulsing sonic aura granting +25% sprint speed and 5 HP/sec healing for 10 seconds.
- **Dynamic Combat Feedback**: Floating damage indicators (yellow for body, crimson red for headshot crits), hitmarkers, kill streaks, and the **BOOYAH!** victory screen.
- **14 Tactical AI Bots**: Autonomous enemy combatants that parachute down, scavenge crates, push into the safe zone, engage players and each other in firefights, and deploy tactical Gloo Walls when shot!

---

## 🕹️ Controls Guide

| Key | Action |
|---|---|
| **W, A, S, D** | Move / Strafe / Parachute glide direction |
| **Mouse Look** | Aim, look around, and steer view |
| **Left Click** | Shoot weapon / Mine voxel blocks with pickaxe / Place blocks |
| **Right Click** | Aim Down Sights (ADS) zoom & spread tighten |
| **Space** | Jump / Deploy parachute during drop |
| **Shift** | Tactical sprint |
| **1 - 5 / Wheel** | Switch inventory slots (Primary, Secondary, Pickaxe, Gloo Wall, Medkit) |
| **R** | Reload equipped firearm |
| **E** | Activate Character Skill (*Drop the Beat*) |
| **G** | Instant deploy Gloo Wall ice barrier |
| **V** | Toggle between First-Person and Third-Person view |

---

## 🛠️ Architecture & Tech Stack

- **Renderer**: Three.js (WebGL, PCFSoftShadows, ACESFilmicToneMapping)
- **Language**: TypeScript 5.8 (Strict type safety, zero compile warnings)
- **Build System**: Vite 6.2
- **Audio Engine**: Web Audio API Sound Synthesizer (procedural audio oscillators and noise generators for all firearms, clicks, and fanfares)
- **Unit Testing**: Vitest 3.0 (covering chunks, DDA raymarching, zone containment, combat recoil, and bot state transitions)

```
src/
├── airdrop/
│   └── AirDropManager.ts    # Cargo plane crate drops, parachutes, smoke flares
├── ai/
│   ├── BotAI.ts             # Autonomous bot state machine & tactical behaviors
│   └── BotManager.ts        # Bot spawner, kill feed, and hit registration
├── audio/
│   └── SoundSynthesizer.ts  # Web Audio API procedural sound engine
├── combat/
│   ├── ParticleManager.ts   # Bullet tracers, blood, debris, damage numbers
│   ├── RecoilSystem.ts      # Camera kick, spring dampening, ADS spread
│   └── WeaponTypes.ts       # Firearm specs, magazine sizes, and fire rates
├── freefire/
│   ├── CharacterSkills.ts   # Alok Drop-the-Beat speed & healing aura
│   └── GlooWallManager.ts   # Deployable defensive ice shield mechanics
├── player/
│   └── PlayerController.ts  # FPS/TPS camera, voxel AABB physics, parachute
├── types/
│   └── index.ts             # Enums, interfaces, and shared data structures
├── ui/
│   └── UIManager.ts         # Minimap radar, compass, HUD, and Booyah screens
├── voxel/
│   ├── TextureAtlas.ts      # Procedural 16x16 pixel-art canvas atlas
│   ├── VoxelChunk.ts        # Optimized chunk geometry with face culling
│   ├── VoxelRaycast.ts      # 3D DDA fast voxel traversal algorithm
│   ├── VoxelTypes.ts        # Block definitions, hardness, and drop loot
│   └── VoxelWorld.ts        # Multi-chunk world manager & terrain generation
├── main.ts                  # Application bootstrap and render loop
└── style.css                # Battle Royale HUD overlay and responsive UI
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
```bash
git clone https://github.com/Sureshldupulapati/blockfire-royale.git
cd blockfire-royale
npm install
```

### Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in any modern WebGL2-compatible browser (Chrome, Firefox, Edge, Brave, Safari).

### Run Test Suite
```bash
npm run test
```

### Production Build
```bash
npm run build
```

---

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
