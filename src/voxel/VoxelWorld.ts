import * as THREE from 'three';
import { BlockType } from '../types';
import { BLOCK_DEFINITIONS } from './VoxelTypes';
import { TextureAtlas } from './TextureAtlas';
import { VoxelChunk } from './VoxelChunk';
import { VoxelGrid } from './VoxelRaycast';

export class VoxelWorld implements VoxelGrid {
  public chunks: Map<string, VoxelChunk> = new Map();
  public atlas: TextureAtlas;
  public material: THREE.MeshLambertMaterial;
  public worldGroup: THREE.Group;

  public readonly chunkRadius: number = 3; // -3 to 3 = 7x7 chunks = 112x112 blocks
  public readonly worldMinX: number;
  public readonly worldMaxX: number;
  public readonly worldMinZ: number;
  public readonly worldMaxZ: number;

  constructor() {
    this.atlas = new TextureAtlas();
    this.material = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.2
    });
    this.worldGroup = new THREE.Group();

    this.worldMinX = -this.chunkRadius * VoxelChunk.SIZE_X;
    this.worldMaxX = (this.chunkRadius + 1) * VoxelChunk.SIZE_X - 1;
    this.worldMinZ = -this.chunkRadius * VoxelChunk.SIZE_Z;
    this.worldMaxZ = (this.chunkRadius + 1) * VoxelChunk.SIZE_Z - 1;
  }

  private getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public getChunk(cx: number, cz: number): VoxelChunk | undefined {
    return this.chunks.get(this.getChunkKey(cx, cz));
  }

  public getOrCreateChunk(cx: number, cz: number): VoxelChunk {
    const key = this.getChunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new VoxelChunk(cx, cz);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  public getBlock(wx: number, wy: number, wz: number): BlockType {
    if (wy < 0 || wy >= VoxelChunk.SIZE_Y) return BlockType.AIR;
    const cx = Math.floor(wx / VoxelChunk.SIZE_X);
    const cz = Math.floor(wz / VoxelChunk.SIZE_Z);
    const chunk = this.chunks.get(this.getChunkKey(cx, cz));
    if (!chunk) return BlockType.AIR;

    let lx = wx % VoxelChunk.SIZE_X;
    let lz = wz % VoxelChunk.SIZE_Z;
    if (lx < 0) lx += VoxelChunk.SIZE_X;
    if (lz < 0) lz += VoxelChunk.SIZE_Z;

    return chunk.getBlock(lx, wy, lz);
  }

  public setBlock(wx: number, wy: number, wz: number, type: BlockType): boolean {
    if (wy < 0 || wy >= VoxelChunk.SIZE_Y) return false;
    const cx = Math.floor(wx / VoxelChunk.SIZE_X);
    const cz = Math.floor(wz / VoxelChunk.SIZE_Z);
    const chunk = this.getOrCreateChunk(cx, cz);

    let lx = wx % VoxelChunk.SIZE_X;
    let lz = wz % VoxelChunk.SIZE_Z;
    if (lx < 0) lx += VoxelChunk.SIZE_X;
    if (lz < 0) lz += VoxelChunk.SIZE_Z;

    chunk.setBlock(lx, wy, lz, type);

    // If block is on boundary, mark neighboring chunks dirty
    if (lx === 0) this.markChunkDirty(cx - 1, cz);
    if (lx === VoxelChunk.SIZE_X - 1) this.markChunkDirty(cx + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cz - 1);
    if (lz === VoxelChunk.SIZE_Z - 1) this.markChunkDirty(cx, cz + 1);

    return true;
  }

  private markChunkDirty(cx: number, cz: number): void {
    const chunk = this.chunks.get(this.getChunkKey(cx, cz));
    if (chunk) chunk.isDirty = true;
  }

  public isSolid(wx: number, wy: number, wz: number): boolean {
    const block = this.getBlock(wx, wy, wz);
    if (block === BlockType.AIR) return false;
    const def = BLOCK_DEFINITIONS[block];
    return def ? def.isSolid : false;
  }

  /**
   * Generates procedural battle royale island terrain with hills, forests, ruins, and crates
   */
  public generateTerrain(): void {
    for (let cx = -this.chunkRadius; cx <= this.chunkRadius; cx++) {
      for (let cz = -this.chunkRadius; cz <= this.chunkRadius; cz++) {
        const chunk = this.getOrCreateChunk(cx, cz);
        const originX = cx * VoxelChunk.SIZE_X;
        const originZ = cz * VoxelChunk.SIZE_Z;

        for (let x = 0; x < VoxelChunk.SIZE_X; x++) {
          for (let z = 0; z < VoxelChunk.SIZE_Z; z++) {
            const wx = originX + x;
            const wz = originZ + z;

            // Height formula: smooth rolling hills with flatter center for arena combat
            const distFromCenter = Math.sqrt(wx * wx + wz * wz);
            const hill1 = Math.sin(wx * 0.06) * Math.cos(wz * 0.06) * 3;
            const hill2 = Math.sin(wx * 0.12 + 1.2) * Math.sin(wz * 0.12 + 0.8) * 1.5;
            const baseHeight = 8 + Math.floor(hill1 + hill2);
            const height = Math.max(3, Math.min(VoxelChunk.SIZE_Y - 8, baseHeight));

            // Layer blocks: Bedrock/Stone -> Dirt -> Grass
            for (let y = 0; y <= height; y++) {
              if (y === height) {
                // Top layer: Sand if near island outer ring, otherwise Grass
                if (distFromCenter > 45) {
                  chunk.setBlock(x, y, z, BlockType.SAND);
                } else {
                  chunk.setBlock(x, y, z, BlockType.GRASS);
                }
              } else if (y >= height - 2) {
                chunk.setBlock(x, y, z, BlockType.DIRT);
              } else {
                chunk.setBlock(x, y, z, BlockType.STONE);
              }
            }

            // Scatter oak trees (Minecraft style)
            if (
              x > 2 && x < VoxelChunk.SIZE_X - 3 &&
              z > 2 && z < VoxelChunk.SIZE_Z - 3 &&
              distFromCenter < 42 &&
              (Math.sin(wx * 37.1 + wz * 43.3) * 0.5 + 0.5) > 0.94
            ) {
              this.generateTree(chunk, x, height + 1, z);
            }
          }
        }
      }
    }

    // Spawn military watchtowers / sniper outposts (PUBG hot drops)
    this.buildWatchtower(-20, this.getHighestY(-20, -20) + 1, -20);
    this.buildWatchtower(20, this.getHighestY(20, 20) + 1, 20);
    this.buildWatchtower(-25, this.getHighestY(-25, 25) + 1, 25);
    this.buildWatchtower(25, this.getHighestY(25, -25) + 1, -25);

    // Spawn tactical brick bunkers / ruins
    this.buildBunker(0, this.getHighestY(0, 0) + 1, 0);

    // Spawn initial supply loot crates
    this.spawnLootCrates();
  }

  private generateTree(chunk: VoxelChunk, lx: number, startY: number, lz: number): void {
    const trunkHeight = 4 + Math.floor(Math.random() * 2);
    // Trunk
    for (let dy = 0; dy < trunkHeight; dy++) {
      if (startY + dy < VoxelChunk.SIZE_Y) {
        chunk.setBlock(lx, startY + dy, lz, BlockType.WOOD);
      }
    }

    // Leaves canopy
    const leafStart = startY + trunkHeight - 2;
    for (let dy = 0; dy < 3; dy++) {
      const radius = dy === 2 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && dy < 2) continue; // Trunk space
          const px = lx + dx;
          const py = leafStart + dy;
          const pz = lz + dz;
          if (
            px >= 0 && px < VoxelChunk.SIZE_X &&
            pz >= 0 && pz < VoxelChunk.SIZE_Z &&
            py < VoxelChunk.SIZE_Y
          ) {
            if (chunk.getBlock(px, py, pz) === BlockType.AIR) {
              chunk.setBlock(px, py, pz, BlockType.LEAVES);
            }
          }
        }
      }
    }
  }

  private buildWatchtower(wx: number, wy: number, wz: number): void {
    // 4x4 stone & wood observation post
    const towerHeight = 7;
    for (let dy = 0; dy < towerHeight; dy++) {
      for (let dx = -1; dx <= 2; dx++) {
        for (let dz = -1; dz <= 2; dz++) {
          const isCorner = (dx === -1 || dx === 2) && (dz === -1 || dz === 2);
          if (isCorner) {
            this.setBlock(wx + dx, wy + dy, wz + dz, BlockType.WOOD);
          } else if (dy === 0 || dy === towerHeight - 1) {
            this.setBlock(wx + dx, wy + dy, wz + dz, BlockType.WOOD);
          }
        }
      }
    }
    // Parapet
    for (let dx = -1; dx <= 2; dx++) {
      for (let dz = -1; dz <= 2; dz++) {
        if (dx === -1 || dx === 2 || dz === -1 || dz === 2) {
          this.setBlock(wx + dx, wy + towerHeight, wz + dz, BlockType.BRICK);
        }
      }
    }
  }

  private buildBunker(wx: number, wy: number, wz: number): void {
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        for (let dy = 0; dy < 3; dy++) {
          const isPerimeter = Math.abs(dx) === 3 || Math.abs(dz) === 3;
          if (isPerimeter && dy < 2) {
            // Door opening on one side
            if (!(dx === 0 && dz === 3)) {
              this.setBlock(wx + dx, wy + dy, wz + dz, BlockType.BRICK);
            }
          }
          if (dy === 2) {
            // Roof
            this.setBlock(wx + dx, wy + dy, wz + dz, BlockType.BRICK);
          }
        }
      }
    }
  }

  private spawnLootCrates(): void {
    const crateSpots = [
      [-15, -15], [15, 15], [-18, 18], [18, -18],
      [-5, -10], [10, -5], [-8, 12], [8, 10],
      [0, -1], [0, 1]
    ];

    for (const [x, z] of crateSpots) {
      const y = this.getHighestY(x, z) + 1;
      this.setBlock(x, y, z, BlockType.CRATE_METAL);
    }
  }

  public getHighestY(wx: number, wz: number): number {
    for (let y = VoxelChunk.SIZE_Y - 1; y >= 0; y--) {
      if (this.isSolid(wx, y, wz)) {
        return y;
      }
    }
    return 0;
  }

  /**
   * Rebuilds meshes for all modified chunks
   */
  public updateMeshes(scene: THREE.Scene): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.isDirty) {
        const mesh = chunk.buildMesh(this.atlas, this.material, (nx, ny, nz) => this.getBlock(nx, ny, nz));
        if (mesh && !mesh.parent) {
          this.worldGroup.add(mesh);
        }
      }
    }

    if (!this.worldGroup.parent) {
      scene.add(this.worldGroup);
    }
  }

  /**
   * AABB collision testing against voxel terrain blocks
   */
  public checkAABBCollision(box: THREE.Box3): boolean {
    const minX = Math.floor(box.min.x);
    const maxX = Math.floor(box.max.x);
    const minY = Math.floor(box.min.y);
    const maxY = Math.floor(box.max.y);
    const minZ = Math.floor(box.min.z);
    const maxZ = Math.floor(box.max.z);

    const blockBox = new THREE.Box3();

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.isSolid(x, y, z)) {
            blockBox.min.set(x, y, z);
            blockBox.max.set(x + 1, y + 1, z + 1);
            if (box.intersectsBox(blockBox)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }
}
