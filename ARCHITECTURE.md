# System Architecture & Technical Specifications

This document outlines the internal architectural designs, data structures, and mathematical algorithms driving **BlockFire: Craft Royale**.

---

## 1. Voxel Engine Design

### 1.1 Chunk Data Representation & Coordinate System
The world is partitioned into fixed-size column chunks of dimensions $16 \times 32 \times 16$ ($X \times Y \times Z$).
Blocks are stored in a contiguous 1D flat typed array (`Uint8Array`) to maximize cache locality:

$$\text{Index}(x, y, z) = x + (z \times 16) + (y \times 16 \times 16)$$

World coordinates $(wx, wy, wz)$ map to chunk coordinates $(cx, cz)$ and local chunk coordinates $(lx, lz)$ as follows:
- $cx = \lfloor wx / 16 \rfloor$
- $cz = \lfloor wz / 16 \rfloor$
- $lx = ((wx \pmod{16}) + 16) \pmod{16}$
- $lz = ((wz \pmod{16}) + 16) \pmod{16}$

### 1.2 Face Culling Optimization
Naively rendering each voxel as an independent cube creates $6 \times 2 = 12$ triangles per block. In a $112 \times 112$ terrain with tens of thousands of blocks, this would saturate the GPU vertex pipeline.

The chunk builder inspects all six orthogonal neighbor voxels:
1. Top $(+Y)$
2. Bottom $(-Y)$
3. Left $(-X)$
4. Right $(+X)$
5. Front $(+Z)$
6. Back $(-Z)$

A quad face is emitted if and only if:
- The neighbor block is `BlockType.AIR`, or
- The neighbor block is transparent (e.g., `GLASS`, `LEAVES`, `GLOO_ICE`) and of a different type than the current block.

This culls over 85% of interior faces, allowing the entire world to render smoothly at 60 FPS in 1-2 draw calls per chunk.

### 1.3 3D DDA (Digital Differential Analyzer) Voxel Raymarching
For block mining, placing, and bullet trajectory testing, the engine uses Amanatides and Woo's Fast Voxel Traversal algorithm.

Rather than performing expensive iterative sphere raycasts with small fixed step sizes, the algorithm computes the exact parametric intersection times $t_{\text{MaxX}}, t_{\text{MaxY}}, t_{\text{MaxZ}}$ to the next voxel boundary:

$$t_{\Delta X} = \left| \frac{1}{\text{dir}_x} \right|, \quad t_{\Delta Y} = \left| \frac{1}{\text{dir}_y} \right|, \quad t_{\Delta Z} = \left| \frac{1}{\text{dir}_z} \right|$$

At each step, the smallest $t_{\text{Max}}$ axis is advanced, updating the current coordinate and recording the previous position (which becomes the placement coordinate for Minecraft block building).

---

## 2. Procedural Web Audio Synthesis

To eliminate external asset dependencies and ensure zero HTTP network latency:
- **Gunshots**: Composed of two coupled nodes:
  1. A low-frequency sawtooth/sine oscillator rapidly swept down from 140 Hz to 30 Hz for visceral mechanical punch.
  2. A procedural white-noise buffer routed through a resonant bandpass filter (Q: 1.5, frequency: 1800-3000 Hz) with an exponential decay gain envelope.
- **Gloo Wall Freeze**: An upward exponential frequency sweep (300 Hz to 1800 Hz) combined with a crystalline triangle chime.
- **Hitmarkers**: High-frequency dual-triangle clicks at 1000 Hz (body) and 1600 Hz (headshot).
- **Booyah Fanfare**: A resonant C-Major chord progression ($C_4 \to E_4 \to G_4 \to C_5 \to E_5 \to G_5$) played in series upon match victory.

---

## 3. Battle Royale Shrinking Zone Math

The safe zone contracts over 5 scheduled phases. Each phase consists of:
1. `waitTime`: countdown interval during which the zone remains stationary.
2. `shrinkTime`: contraction interval during which the current radius and center linearly interpolate to the target values.

To ensure gameplay fairness, the next target center $C_{\text{target}}$ is constrained inside the current circle:

$$C_{\text{target}} = C_{\text{prev}} + r \begin{pmatrix} \cos \theta \\ \sin \theta \end{pmatrix}, \quad \text{where } r \le 0.8 \times (R_{\text{prev}} - R_{\text{target}})$$

---

## 4. Bot Artificial Intelligence (Behavior Trees)

Each bot executes a state machine evaluated on every frame:
- **Parachuting**: Glides toward the island until altitude $\le 0.5\text{m}$.
- **Move to Zone**: If $||P_{\text{bot}} - C_{\text{zone}}|| > R_{\text{zone}}$, sets navigation target to $C_{\text{zone}}$ and sprints inward.
- **Patrol**: Explores random waypoints on the voxel terrain, utilizing step-climbing physics.
- **Combat**: Triggered when a player or bot enters line of sight within 40m.
  - Computes aim vector with accuracy jitter.
  - Fires in bursts according to weapon fire rates.
  - Performs lateral strafing to evade incoming fire.
- **Free Fire Gloo Wall Response**: When taking sudden damage from an open angle, if the bot carries Gloo Grenades, it immediately places a defensive Gloo Wall oriented toward the attacker's trajectory, breaking line-of-sight and retreating to heal.

