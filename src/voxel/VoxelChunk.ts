import * as THREE from 'three';
import { BlockType } from '../types';
import { BLOCK_DEFINITIONS } from './VoxelTypes';
import { TextureAtlas } from './TextureAtlas';

export class VoxelChunk {
  public static readonly SIZE_X = 16;
  public static readonly SIZE_Z = 16;
  public static readonly SIZE_Y = 32;

  public chunkX: number;
  public chunkZ: number;
  public blocks: Uint8Array;
  public mesh: THREE.Mesh | null = null;
  public isDirty: boolean = true;

  constructor(chunkX: number, chunkZ: number) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.blocks = new Uint8Array(
      VoxelChunk.SIZE_X * VoxelChunk.SIZE_Y * VoxelChunk.SIZE_Z
    );
  }

  public getIndex(x: number, y: number, z: number): number {
    return x + z * VoxelChunk.SIZE_X + y * VoxelChunk.SIZE_X * VoxelChunk.SIZE_Z;
  }

  public getBlock(x: number, y: number, z: number): BlockType {
    if (
      x < 0 || x >= VoxelChunk.SIZE_X ||
      y < 0 || y >= VoxelChunk.SIZE_Y ||
      z < 0 || z >= VoxelChunk.SIZE_Z
    ) {
      return BlockType.AIR;
    }
    return this.blocks[this.getIndex(x, y, z)];
  }

  public setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (
      x < 0 || x >= VoxelChunk.SIZE_X ||
      y < 0 || y >= VoxelChunk.SIZE_Y ||
      z < 0 || z >= VoxelChunk.SIZE_Z
    ) {
      return;
    }
    this.blocks[this.getIndex(x, y, z)] = type;
    this.isDirty = true;
  }

  /**
   * Builds culled mesh geometry using TextureAtlas UVs
   */
  public buildMesh(
    atlas: TextureAtlas,
    material: THREE.Material,
    getNeighborBlock: (worldX: number, worldY: number, worldZ: number) => BlockType
  ): THREE.Mesh | null {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];

    const originX = this.chunkX * VoxelChunk.SIZE_X;
    const originZ = this.chunkZ * VoxelChunk.SIZE_Z;

    for (let y = 0; y < VoxelChunk.SIZE_Y; y++) {
      for (let z = 0; z < VoxelChunk.SIZE_Z; z++) {
        for (let x = 0; x < VoxelChunk.SIZE_X; x++) {
          const blockType = this.getBlock(x, y, z);
          if (blockType === BlockType.AIR) continue;

          const def = BLOCK_DEFINITIONS[blockType];
          if (!def) continue;

          const wx = originX + x;
          const wy = y;
          const wz = originZ + z;

          // Check all 6 faces for visibility
          // Top (+Y)
          const topBlock = y < VoxelChunk.SIZE_Y - 1 ? this.getBlock(x, y + 1, z) : getNeighborBlock(wx, wy + 1, wz);
          if (this.shouldRenderFace(topBlock, blockType)) {
            this.addFace(
              positions, normals, uvs, colors,
              wx, wy, wz,
              [0, 1, 0],
              [wx, wy + 1, wz + 1],
              [wx + 1, wy + 1, wz + 1],
              [wx + 1, wy + 1, wz],
              [wx, wy + 1, wz],
              atlas.getTileUV(def.textures.top),
              1.0 // Bright top
            );
          }

          // Bottom (-Y)
          const botBlock = y > 0 ? this.getBlock(x, y - 1, z) : getNeighborBlock(wx, wy - 1, wz);
          if (this.shouldRenderFace(botBlock, blockType)) {
            this.addFace(
              positions, normals, uvs, colors,
              wx, wy, wz,
              [0, -1, 0],
              [wx, wy, wz],
              [wx + 1, wy, wz],
              [wx + 1, wy, wz + 1],
              [wx, wy, wz + 1],
              atlas.getTileUV(def.textures.bottom),
              0.5 // Dark bottom
            );
          }

          // Left (-X)
          const leftBlock = x > 0 ? this.getBlock(x - 1, y, z) : getNeighborBlock(wx - 1, wy, wz);
          if (this.shouldRenderFace(leftBlock, blockType)) {
            this.addFace(
              positions, normals, uvs, colors,
              wx, wy, wz,
              [-1, 0, 0],
              [wx, wy, wz],
              [wx, wy, wz + 1],
              [wx, wy + 1, wz + 1],
              [wx, wy + 1, wz],
              atlas.getTileUV(def.textures.side),
              0.75
            );
          }

          // Right (+X)
          const rightBlock = x < VoxelChunk.SIZE_X - 1 ? this.getBlock(x + 1, y, z) : getNeighborBlock(wx + 1, wy, wz);
          if (this.shouldRenderFace(rightBlock, blockType)) {
            this.addFace(
              positions, normals, uvs, colors,
              wx, wy, wz,
              [1, 0, 0],
              [wx + 1, wy, wz + 1],
              [wx + 1, wy, wz],
              [wx + 1, wy + 1, wz],
              [wx + 1, wy + 1, wz + 1],
              atlas.getTileUV(def.textures.side),
              0.75
            );
          }

          // Front (+Z)
          const frontBlock = z < VoxelChunk.SIZE_Z - 1 ? this.getBlock(x, y, z + 1) : getNeighborBlock(wx, wy, wz + 1);
          if (this.shouldRenderFace(frontBlock, blockType)) {
            this.addFace(
              positions, normals, uvs, colors,
              wx, wy, wz,
              [0, 0, 1],
              [wx, wy, wz + 1],
              [wx + 1, wy, wz + 1],
              [wx + 1, wy + 1, wz + 1],
              [wx, wy + 1, wz + 1],
              atlas.getTileUV(def.textures.side),
              0.85
            );
          }

          // Back (-Z)
          const backBlock = z > 0 ? this.getBlock(x, y, z - 1) : getNeighborBlock(wx, wy, wz - 1);
          if (this.shouldRenderFace(backBlock, blockType)) {
            this.addFace(
              positions, normals, uvs, colors,
              wx, wy, wz,
              [0, 0, -1],
              [wx + 1, wy, wz],
              [wx, wy, wz],
              [wx, wy + 1, wz],
              [wx + 1, wy + 1, wz],
              atlas.getTileUV(def.textures.side),
              0.85
            );
          }
        }
      }
    }

    if (positions.length === 0) {
      if (this.mesh) {
        this.mesh.geometry.dispose();
        this.mesh = null;
      }
      this.isDirty = false;
      return null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    if (!this.mesh) {
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
    } else {
      this.mesh.geometry.dispose();
      this.mesh.geometry = geometry;
    }

    this.isDirty = false;
    return this.mesh;
  }

  private shouldRenderFace(neighborType: BlockType, currentType: BlockType): boolean {
    if (neighborType === BlockType.AIR) return true;
    const neighborDef = BLOCK_DEFINITIONS[neighborType];
    if (!neighborDef) return true;
    // Render face if neighbor is transparent and different type, or if neighbor is glass/leaves
    if (neighborDef.isTransparent && neighborType !== currentType) return true;
    return false;
  }

  private addFace(
    positions: number[],
    normals: number[],
    uvs: number[],
    colors: number[],
    _wx: number, _wy: number, _wz: number,
    normal: [number, number, number],
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    uv: [number, number, number, number],
    shade: number
  ): void {
    const [uMin, vMin, uMax, vMax] = uv;

    // Triangle 1: p0, p1, p2
    positions.push(...p0, ...p1, ...p2);
    normals.push(...normal, ...normal, ...normal);
    uvs.push(uMin, vMin, uMax, vMin, uMax, vMax);
    colors.push(shade, shade, shade, shade, shade, shade, shade, shade, shade);

    // Triangle 2: p0, p2, p3
    positions.push(...p0, ...p2, ...p3);
    normals.push(...normal, ...normal, ...normal);
    uvs.push(uMin, vMin, uMax, vMax, uMin, vMax);
    colors.push(shade, shade, shade, shade, shade, shade, shade, shade, shade);
  }
}

