import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { VoxelChunk } from '../src/voxel/VoxelChunk';
import { VoxelWorld } from '../src/voxel/VoxelWorld';
import { raycastVoxel } from '../src/voxel/VoxelRaycast';
import { TextureAtlas } from '../src/voxel/TextureAtlas';
import { BlockType } from '../src/types';

describe('Voxel Engine', () => {
  describe('VoxelChunk', () => {
    let chunk: VoxelChunk;

    beforeEach(() => {
      chunk = new VoxelChunk(0, 0);
    });

    it('should initialize with air blocks', () => {
      expect(chunk.getBlock(0, 0, 0)).toBe(BlockType.AIR);
      expect(chunk.getBlock(5, 10, 5)).toBe(BlockType.AIR);
    });

    it('should set and retrieve blocks correctly', () => {
      chunk.setBlock(2, 5, 2, BlockType.STONE);
      expect(chunk.getBlock(2, 5, 2)).toBe(BlockType.STONE);
      expect(chunk.isDirty).toBe(true);
    });

    it('should handle out-of-bounds coordinates safely', () => {
      expect(chunk.getBlock(-1, 0, 0)).toBe(BlockType.AIR);
      expect(chunk.getBlock(16, 0, 0)).toBe(BlockType.AIR);
      expect(chunk.getBlock(0, 32, 0)).toBe(BlockType.AIR);
      chunk.setBlock(-1, 0, 0, BlockType.DIRT); // Should not throw
    });
  });

  describe('VoxelWorld', () => {
    let world: VoxelWorld;

    beforeEach(() => {
      world = new VoxelWorld();
    });

    it('should convert world coordinates to proper chunks across negative bounds', () => {
      world.setBlock(-5, 10, -5, BlockType.WOOD);
      expect(world.getBlock(-5, 10, -5)).toBe(BlockType.WOOD);
    });

    it('should detect solid blocks correctly', () => {
      world.setBlock(3, 4, 3, BlockType.BRICK);
      expect(world.isSolid(3, 4, 3)).toBe(true);
      expect(world.isSolid(3, 5, 3)).toBe(false);
    });

    it('should calculate highest solid Y coordinate', () => {
      world.setBlock(10, 5, 10, BlockType.STONE);
      world.setBlock(10, 6, 10, BlockType.DIRT);
      world.setBlock(10, 7, 10, BlockType.GRASS);
      expect(world.getHighestY(10, 10)).toBe(7);
    });
  });

  describe('VoxelRaycast DDA', () => {
    it('should accurately detect block collisions and return normal and place position', () => {
      const world = new VoxelWorld();
      world.setBlock(0, 2, 5, BlockType.STONE);

      const origin = new THREE.Vector3(0.5, 2.5, 0);
      const direction = new THREE.Vector3(0, 0, 1);

      const hit = raycastVoxel(world, origin, direction, 10);
      expect(hit.hit).toBe(true);
      expect(hit.blockType).toBe(BlockType.STONE);
      expect(hit.blockPosition).toBeDefined();
      expect(hit.blockPosition?.z).toBe(5);
      expect(hit.normal.z).toBe(-1); // Hit front face
      expect(hit.placePosition?.z).toBe(4); // Place block adjacent to face
    });

    it('should return hit:false if ray reaches max distance without obstacle', () => {
      const world = new VoxelWorld();
      const origin = new THREE.Vector3(0, 10, 0);
      const direction = new THREE.Vector3(0, 1, 0);

      const hit = raycastVoxel(world, origin, direction, 10);
      expect(hit.hit).toBe(false);
    });
  });

  describe('TextureAtlas UV Math', () => {
    it('should compute valid normalized UV ranges', () => {
      // Create mockup canvas for headless tests
      const atlas = Object.create(TextureAtlas.prototype);
      atlas.atlasCols = 4;
      atlas.atlasRows = 4;

      const [uMin, vMin, uMax, vMax] = TextureAtlas.prototype.getTileUV.call(atlas, 0);
      expect(uMin).toBe(0);
      expect(uMax).toBe(0.25);
      expect(vMax).toBe(1.0);
      expect(vMin).toBe(0.75);
    });
  });
});
