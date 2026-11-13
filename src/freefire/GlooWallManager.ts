import * as THREE from 'three';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { BlockType } from '../types';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { ParticleManager } from '../combat/ParticleManager';

export interface GlooWallInstance {
  blocks: { x: number; y: number; z: number }[];
  lifetime: number;
}

export class GlooWallManager {
  private world: VoxelWorld;
  private sound: SoundSynthesizer;
  private particles: ParticleManager;
  public walls: GlooWallInstance[] = [];

  constructor(world: VoxelWorld, sound: SoundSynthesizer, particles: ParticleManager) {
    this.world = world;
    this.sound = sound;
    this.particles = particles;
  }

  /**
   * Deploys an instant curved defensive Gloo Wall in front of an entity
   */
  public deployGlooWall(origin: THREE.Vector3, forwardDir: THREE.Vector3): boolean {
    const forward = forwardDir.clone().setY(0).normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();

    // Spawn 2.5 meters in front of player
    const centerPos = origin.clone().add(forward.multiplyScalar(2.2));
    const cx = Math.floor(centerPos.x);
    const cz = Math.floor(centerPos.z);
    const groundY = this.world.getHighestY(cx, cz) + 1;

    const wallBlocks: { x: number; y: number; z: number }[] = [];

    // Deploy a 5-column wide, 3-block high curved defensive ice shield
    const offsets = [
      { rx: -2, rz: 0.8 },
      { rx: -1, rz: 0.3 },
      { rx: 0,  rz: 0 },
      { rx: 1,  rz: 0.3 },
      { rx: 2,  rz: 0.8 }
    ];

    for (const offset of offsets) {
      const blockWorldPos = centerPos.clone()
        .add(right.clone().multiplyScalar(offset.rx))
        .add(forward.clone().multiplyScalar(offset.rz));

      const bx = Math.floor(blockWorldPos.x);
      const bz = Math.floor(blockWorldPos.z);
      const by = Math.max(groundY, this.world.getHighestY(bx, bz) + 1);

      for (let dy = 0; dy < 3; dy++) {
        const targetY = by + dy;
        if (targetY < 32) {
          this.world.setBlock(bx, targetY, bz, BlockType.GLOO_ICE);
          wallBlocks.push({ x: bx, y: targetY, z: bz });

          // Spawn ice crystal sparks
          this.particles.spawnVoxelDebris(
            new THREE.Vector3(bx + 0.5, targetY + 0.5, bz + 0.5),
            0x00f0ff,
            2
          );
        }
      }
    }

    this.sound.playGlooDeploy();

    this.walls.push({
      blocks: wallBlocks,
      lifetime: 25.0 // lasts 25 seconds
    });

    return true;
  }

  public update(delta: number): void {
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const wall = this.walls[i];
      wall.lifetime -= delta;

      if (wall.lifetime <= 0) {
        // Dissolve wall blocks
        for (const b of wall.blocks) {
          if (this.world.getBlock(b.x, b.y, b.z) === BlockType.GLOO_ICE) {
            this.world.setBlock(b.x, b.y, b.z, BlockType.AIR);
            this.particles.spawnVoxelDebris(
              new THREE.Vector3(b.x + 0.5, b.y + 0.5, b.z + 0.5),
              0x00d2ff,
              2
            );
          }
        }
        this.walls.splice(i, 1);
      }
    }
  }
}

