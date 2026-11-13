import * as THREE from 'three';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { raycastVoxel } from '../voxel/VoxelRaycast';
import { BlockType, WeaponConfig } from '../types';
import { WEAPON_REGISTRY } from '../combat/WeaponTypes';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { ParticleManager } from '../combat/ParticleManager';
import { GlooWallManager } from '../freefire/GlooWallManager';
import { ZoneManager } from '../zone/ZoneManager';

export enum BotState {
  PARACHUTING = 'PARACHUTING',
  SCAVENGING = 'SCAVENGING',
  PATROL = 'PATROL',
  MOVE_TO_ZONE = 'MOVE_TO_ZONE',
  COMBAT = 'COMBAT',
  RETREATING = 'RETREATING'
}

export class BotAI {
  public id: string;
  public name: string;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public yaw: number = 0;
  public health: number = 100;
  public armor: number = 50;
  public state: BotState = BotState.PARACHUTING;
  public isAlive: boolean = true;

  public mesh: THREE.Group;
  private headMesh: THREE.Mesh;
  private parachuteMesh: THREE.Group;

  private world: VoxelWorld;
  private sound: SoundSynthesizer;
  private particles: ParticleManager;
  private glooManager: GlooWallManager;
  private zoneManager: ZoneManager;

  public weapon: WeaponConfig = WEAPON_REGISTRY.ak47;
  private shootCooldown: number = 0;
  private stateTimer: number = 0;
  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  public currentCombatTarget: { position: THREE.Vector3; isPlayer: boolean; entity?: any } | null = null;

  public glooGrenades: number = 2;
  private strafeDir: number = 1;
  private strafeTimer: number = 0;

  constructor(
    id: string,
    name: string,
    startPos: THREE.Vector3,
    world: VoxelWorld,
    sound: SoundSynthesizer,
    particles: ParticleManager,
    glooManager: GlooWallManager,
    zoneManager: ZoneManager
  ) {
    this.id = id;
    this.name = name;
    this.position = startPos.clone();
    this.world = world;
    this.sound = sound;
    this.particles = particles;
    this.glooManager = glooManager;
    this.zoneManager = zoneManager;

    // Pick weapon variant
    const weapons = [WEAPON_REGISTRY.m416, WEAPON_REGISTRY.ak47, WEAPON_REGISTRY.mp40, WEAPON_REGISTRY.awm];
    this.weapon = weapons[Math.floor(Math.random() * weapons.length)];

    // Build Bot 3D Avatar
    this.mesh = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd97706 }); // Orange tactical suit
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd1d5db });
    const vestMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

    const bodyGeo = new THREE.BoxGeometry(0.55, 0.75, 0.3);
    const bodyMesh = new THREE.Mesh(bodyGeo, vestMat);
    bodyMesh.position.y = 0.9;
    this.mesh.add(bodyMesh);

    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.position.y = 1.45;
    this.mesh.add(this.headMesh);

    // Gun
    const gunGeo = new THREE.BoxGeometry(0.1, 0.12, 0.6);
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
    const gunMesh = new THREE.Mesh(gunGeo, gunMat);
    gunMesh.position.set(0.32, 0.85, -0.4);
    this.mesh.add(gunMesh);

    // Parachute
    this.parachuteMesh = new THREE.Group();
    const canopyGeo = new THREE.CylinderGeometry(2.2, 0.6, 1.1, 8, 1, true);
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0xdc2626, side: THREE.DoubleSide });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 3.0;
    this.parachuteMesh.add(canopy);
    this.mesh.add(this.parachuteMesh);

    this.mesh.position.copy(this.position);
  }

  public takeDamage(
    amount: number,
    attackerPos: THREE.Vector3,
    isHeadshot: boolean = false,
    onKilled?: () => void
  ): void {
    if (!this.isAlive) return;

    let dmg = amount * (isHeadshot ? 2.0 : 1.0);

    // Armor absorption
    if (this.armor > 0) {
      const absorbed = dmg * 0.5;
      if (this.armor >= absorbed) {
        this.armor -= absorbed;
        dmg -= absorbed;
      } else {
        dmg -= this.armor;
        this.armor = 0;
      }
    }

    this.health -= dmg;
    this.particles.spawnBlood(this.position.clone().add(new THREE.Vector3(0, 1.2, 0)));

    // Tactical Free Fire reaction: if damaged from open angle, deploy Gloo Wall!
    if (this.health > 0 && this.glooGrenades > 0 && Math.random() < 0.75) {
      const dirToAttacker = attackerPos.clone().sub(this.position).normalize();
      this.glooManager.deployGlooWall(this.position, dirToAttacker);
      this.glooGrenades--;
      this.state = BotState.RETREATING;
      this.stateTimer = 4.0;
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.mesh.visible = false;
      if (onKilled) onKilled();
    }
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    allBots: BotAI[],
    onShootTarget: (shooter: BotAI, targetPos: THREE.Vector3, isHeadshot: boolean) => void
  ): void {
    if (!this.isAlive) return;

    this.stateTimer -= delta;
    if (this.shootCooldown > 0) this.shootCooldown -= delta;

    switch (this.state) {
      case BotState.PARACHUTING:
        this.updateParachuting(delta);
        break;
      case BotState.MOVE_TO_ZONE:
        this.updateMoveToZone(delta, playerPos, allBots);
        break;
      case BotState.PATROL:
        this.updatePatrol(delta, playerPos, allBots);
        break;
      case BotState.COMBAT:
        this.updateCombat(delta, playerPos, onShootTarget);
        break;
      case BotState.RETREATING:
        this.updateRetreat(delta);
        break;
    }

    // Check Zone Damage
    if (this.zoneManager.isOutsideZone(this.position)) {
      const dmg = this.zoneManager.getCurrentDamagePerSecond() * delta;
      this.health -= dmg;
      if (this.health <= 0) {
        this.health = 0;
        this.isAlive = false;
        this.mesh.visible = false;
      }
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;
  }

  private updateParachuting(delta: number): void {
    this.position.y -= delta * 7.5;
    const groundY = this.world.getHighestY(Math.floor(this.position.x), Math.floor(this.position.z)) + 1;

    if (this.position.y <= groundY + 0.1) {
      this.position.y = groundY;
      this.state = BotState.PATROL;
      this.parachuteMesh.visible = false;
      this.pickNewPatrolPoint();
    }
  }

  private updatePatrol(delta: number, playerPos: THREE.Vector3, allBots: BotAI[]): void {
    // Check if safe zone is shrinking away
    if (this.zoneManager.isOutsideZone(this.position)) {
      this.state = BotState.MOVE_TO_ZONE;
      return;
    }

    // Scan for targets: player or enemy bots
    const target = this.scanForEnemies(playerPos, allBots);
    if (target) {
      this.currentCombatTarget = target;
      this.state = BotState.COMBAT;
      return;
    }

    // Move toward patrol point
    this.moveTowards(this.targetPosition, 4.5, delta);

    if (this.position.distanceTo(this.targetPosition) < 2.0 || this.stateTimer <= 0) {
      this.pickNewPatrolPoint();
    }
  }

  private updateMoveToZone(delta: number, playerPos: THREE.Vector3, allBots: BotAI[]): void {
    // Move toward center of safe zone
    const center = this.zoneManager.currentCenter;
    const zonePos = new THREE.Vector3(center.x, this.position.y, center.y);

    this.moveTowards(zonePos, 6.0, delta);

    if (!this.zoneManager.isOutsideZone(this.position)) {
      this.state = BotState.PATROL;
      this.pickNewPatrolPoint();
      return;
    }

    // Still defend if attacked
    const target = this.scanForEnemies(playerPos, allBots);
    if (target && this.position.distanceTo(target.position) < 20) {
      this.currentCombatTarget = target;
      this.state = BotState.COMBAT;
    }
  }

  private updateCombat(
    delta: number,
    playerPos: THREE.Vector3,
    onShootTarget: (shooter: BotAI, targetPos: THREE.Vector3, isHeadshot: boolean) => void
  ): void {
    if (!this.currentCombatTarget) {
      this.state = BotState.PATROL;
      return;
    }

    const targetPos = this.currentCombatTarget.position;
    const dist = this.position.distanceTo(targetPos);

    if (dist > 50 || (this.currentCombatTarget.entity && !this.currentCombatTarget.entity.isAlive)) {
      this.currentCombatTarget = null;
      this.state = BotState.PATROL;
      return;
    }

    // Face target
    const dir = targetPos.clone().sub(this.position).setY(0).normalize();
    this.yaw = Math.atan2(-dir.x, -dir.z);

    // Tactical strafing
    this.strafeTimer -= delta;
    if (this.strafeTimer <= 0) {
      this.strafeDir *= -1;
      this.strafeTimer = 1.0 + Math.random() * 1.5;
    }

    const right = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafeDir);
    this.position.addScaledVector(right, delta * 2.5);

    // Keep on top of voxel terrain
    const groundY = this.world.getHighestY(Math.floor(this.position.x), Math.floor(this.position.z)) + 1;
    this.position.y = THREE.MathUtils.lerp(this.position.y, groundY, delta * 10);

    // Shoot in bursts
    if (this.shootCooldown <= 0) {
      const isHeadshot = Math.random() < 0.2; // 20% headshot accuracy
      this.sound.playGunshot(this.weapon.soundType as any);

      // Bullet tracer
      const muzzle = this.position.clone().add(new THREE.Vector3(0.3, 1.2, 0));
      this.particles.createBulletTracer(muzzle, targetPos.clone().add(new THREE.Vector3(0, 1.2, 0)), this.weapon.bulletSpeed);

      onShootTarget(this, targetPos, isHeadshot);
      this.shootCooldown = 1.0 / this.weapon.fireRate + Math.random() * 0.15;
    }
  }

  private updateRetreat(delta: number): void {
    if (this.stateTimer <= 0) {
      this.state = BotState.PATROL;
      this.pickNewPatrolPoint();
    }
  }

  private scanForEnemies(
    playerPos: THREE.Vector3,
    allBots: BotAI[]
  ): { position: THREE.Vector3; isPlayer: boolean; entity?: any } | null {
    // 1. Check player distance and line of sight
    const distToPlayer = this.position.distanceTo(playerPos);
    if (distToPlayer < 40) {
      const dir = playerPos.clone().sub(this.position).normalize();
      const hit = raycastVoxel(this.world, this.position.clone().setY(this.position.y + 1.2), dir, distToPlayer);
      if (!hit.hit) {
        return { position: playerPos, isPlayer: true };
      }
    }

    // 2. Check other bots
    for (const other of allBots) {
      if (other.id === this.id || !other.isAlive) continue;
      const d = this.position.distanceTo(other.position);
      if (d < 30) {
        return { position: other.position, isPlayer: false, entity: other };
      }
    }

    return null;
  }

  private moveTowards(target: THREE.Vector3, speed: number, delta: number): void {
    const dir = target.clone().sub(this.position).setY(0);
    if (dir.lengthSq() < 0.1) return;

    dir.normalize();
    this.yaw = Math.atan2(-dir.x, -dir.z);

    this.position.addScaledVector(dir, speed * delta);

    // Voxel height adjustment & step climbing
    const groundY = this.world.getHighestY(Math.floor(this.position.x), Math.floor(this.position.z)) + 1;
    this.position.y = THREE.MathUtils.lerp(this.position.y, groundY, delta * 12);
  }

  private pickNewPatrolPoint(): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * 25;
    this.targetPosition.set(
      this.position.x + Math.cos(angle) * dist,
      0,
      this.position.z + Math.sin(angle) * dist
    );
    this.stateTimer = 5 + Math.random() * 5;
  }
}

