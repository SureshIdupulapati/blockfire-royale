import * as THREE from 'three';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { BlockType } from '../types';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { ParticleManager } from '../combat/ParticleManager';
import { BotManager } from '../ai/BotManager';
import { PlayerController } from '../player/PlayerController';

export interface ActiveGrenade {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  fuseTimer: number;
  isCooked: boolean;
  radius: number;
  damage: number;
}

export class GrenadeManager {
  private scene: THREE.Scene;
  private world: VoxelWorld;
  private sound: SoundSynthesizer;
  private particles: ParticleManager;
  private botManager: BotManager | null = null;
  private player: PlayerController | null = null;

  public activeGrenades: ActiveGrenade[] = [];
  private trajectoryLine: THREE.Line | null = null;

  constructor(scene: THREE.Scene, world: VoxelWorld, sound: SoundSynthesizer, particles: ParticleManager) {
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.particles = particles;

    this.initTrajectoryLine();
  }

  public setEntities(botManager: BotManager, player: PlayerController): void {
    this.botManager = botManager;
    this.player = player;
  }

  private initTrajectoryLine(): void {
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.LineDashedMaterial({
      color: 0xff4500,
      dashSize: 0.4,
      gapSize: 0.2,
      linewidth: 2,
      transparent: true,
      opacity: 0.85
    });
    this.trajectoryLine = new THREE.Line(geo, mat);
    this.trajectoryLine.visible = false;
    this.scene.add(this.trajectoryLine);
  }

  /**
   * Throws a frag grenade along camera look direction with ballistic velocity
   */
  public throwGrenade(origin: THREE.Vector3, direction: THREE.Vector3, throwPower: number = 22.0): void {
    const group = new THREE.Group();

    // 3D Olive Drab Pineapple Frag Grenade Mesh
    const bodyGeo = new THREE.DodecahedronGeometry(0.12, 1);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3f6212 }); // Military olive drab
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Fuse cap & pin handle
    const capGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6);
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x71717a });
    const capMesh = new THREE.Mesh(capGeo, metalMat);
    capMesh.position.y = 0.12;
    group.add(capMesh);

    const leverGeo = new THREE.BoxGeometry(0.02, 0.14, 0.05);
    const leverMesh = new THREE.Mesh(leverGeo, metalMat);
    leverMesh.position.set(0.04, 0.06, 0);
    group.add(leverMesh);

    group.position.copy(origin);
    this.scene.add(group);

    // Initial velocity: forward vector + upward arc boost
    const vel = direction.clone().normalize().multiplyScalar(throwPower);
    vel.y += 4.5;

    this.activeGrenades.push({
      mesh: group,
      position: origin.clone(),
      velocity: vel,
      fuseTimer: 2.8, // 2.8s fuse countdown
      isCooked: false,
      radius: 6.5,
      damage: 160
    });

    this.sound.playPlaceBlock();
  }

  public update(delta: number): void {
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.fuseTimer -= delta;

      // Physics: Gravity & Drag
      g.velocity.y -= 18.0 * delta;
      g.velocity.x *= (1.0 - 0.5 * delta);
      g.velocity.z *= (1.0 - 0.5 * delta);

      // Tumble rotation in air
      g.mesh.rotation.x += delta * 8;
      g.mesh.rotation.z += delta * 6;

      const nextPos = g.position.clone().addScaledVector(g.velocity, delta);

      // Voxel collision & bounce physics
      const bx = Math.floor(nextPos.x);
      const by = Math.floor(nextPos.y);
      const bz = Math.floor(nextPos.z);

      if (this.world.isSolid(bx, by, bz) || nextPos.y <= 3.8) {
        // Bounce restitution with damping
        g.velocity.y = -g.velocity.y * 0.45;
        g.velocity.x *= 0.6;
        g.velocity.z *= 0.6;

        if (Math.abs(g.velocity.y) < 1.0) {
          g.velocity.y = 0;
          nextPos.y = Math.max(3.8, by + 1.05);
        }

        // Small bounce click sound
        this.sound.playHitmarker(false);
      } else {
        g.position.copy(nextPos);
      }

      g.mesh.position.copy(g.position);

      // Detonation
      if (g.fuseTimer <= 0) {
        this.detonateGrenade(g);
        this.scene.remove(g.mesh);
        this.activeGrenades.splice(i, 1);
      }
    }
  }

  private detonateGrenade(g: ActiveGrenade): void {
    const center = g.position;

    // 1. Audio Blast
    this.sound.playExplosion();

    // 2. Visual Fireball & Debris Particles
    this.particles.spawnVoxelDebris(center, 0xff4500, 24); // Fiery orange debris
    this.particles.spawnVoxelDebris(center, 0x111111, 16); // Smoke chunks

    // 3. Destructive Voxel Demolition Crater (Minecraft explosion physics)
    const craterRadius = 3;
    const cx = Math.floor(center.x);
    const cy = Math.floor(center.y);
    const cz = Math.floor(center.z);

    for (let dx = -craterRadius; dx <= craterRadius; dx++) {
      for (let dy = -craterRadius; dy <= craterRadius; dy++) {
        for (let dz = -craterRadius; dz <= craterRadius; dz++) {
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq <= craterRadius * craterRadius) {
            const wx = cx + dx;
            const wy = cy + dy;
            const wz = cz + dz;
            const block = this.world.getBlock(wx, wy, wz);

            // Destroy destructible blocks (Obsidian and Bedrock are blast-resistant!)
            if (
              block !== BlockType.AIR &&
              block !== BlockType.OBSIDIAN &&
              wy > 3
            ) {
              this.world.setBlock(wx, wy, wz, BlockType.AIR);
            }
          }
        }
      }
    }

    // 4. Calculate AoE Blast Damage to Bots
    if (this.botManager) {
      for (const bot of this.botManager.bots) {
        if (!bot.isAlive) continue;
        const d = center.distanceTo(bot.position);
        if (d <= g.radius) {
          const falloff = 1.0 - (d / g.radius);
          const finalDamage = g.damage * falloff;

          // Knockback vector
          const knockback = bot.position.clone().sub(center).normalize().multiplyScalar(12 * falloff);
          bot.position.add(knockback);

          bot.takeDamage(finalDamage, center, false, () => {
            if (this.player) {
              this.botManager!.playerKills++;
              this.botManager!.aliveCount = Math.max(1, this.botManager!.aliveCount - 1);
              this.botManager!.onAliveCountChanged(this.botManager!.aliveCount);

              this.botManager!.onKillFeedEvent({
                killer: 'Player',
                victim: bot.name,
                weapon: 'M67 Frag Grenade',
                isHeadshot: false,
                isPlayerKiller: true,
                isPlayerVictim: false,
                timestamp: Date.now()
              });
            }
          });

          if (this.player) {
            this.particles.spawnDamageNumber(finalDamage, bot.position, this.player.camera, false);
          }
        }
      }
    }

    // 5. Blast Damage to Player (if close)
    if (this.player) {
      const d = center.distanceTo(this.player.position);
      if (d <= g.radius) {
        const falloff = 1.0 - (d / g.radius);
        const playerDamage = g.damage * falloff * 0.75;
        this.player.applyDamage(playerDamage, false);
      }
    }
  }

  /**
   * Updates trajectory preview arc when player holds or aims grenade
   */
  public updateTrajectoryPreview(startPos: THREE.Vector3, direction: THREE.Vector3, isVisible: boolean): void {
    if (!this.trajectoryLine) return;
    this.trajectoryLine.visible = isVisible;
    if (!isVisible) return;

    const points: THREE.Vector3[] = [];
    const simPos = startPos.clone();
    const simVel = direction.clone().normalize().multiplyScalar(22.0);
    simVel.y += 4.5;
    const stepDelta = 0.05;

    for (let t = 0; t < 25; t++) {
      points.push(simPos.clone());
      simVel.y -= 18.0 * stepDelta;
      simPos.addScaledVector(simVel, stepDelta);

      const bx = Math.floor(simPos.x);
      const by = Math.floor(simPos.y);
      const bz = Math.floor(simPos.z);
      if (this.world.isSolid(bx, by, bz) || simPos.y <= 3.8) {
        points.push(simPos.clone());
        break;
      }
    }

    this.trajectoryLine.geometry.setFromPoints(points);
    this.trajectoryLine.computeLineDistances();
  }
}

