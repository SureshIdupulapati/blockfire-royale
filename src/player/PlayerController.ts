import * as THREE from 'three';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { raycastVoxel } from '../voxel/VoxelRaycast';
import { BlockType, InventorySlot, PlayerVitals, GameState, WeaponConfig } from '../types';
import { BLOCK_DEFINITIONS } from '../voxel/VoxelTypes';
import { WEAPON_REGISTRY } from '../combat/WeaponTypes';
import { RecoilSystem } from '../combat/RecoilSystem';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { ParticleManager } from '../combat/ParticleManager';
import { GlooWallManager } from '../freefire/GlooWallManager';
import { CharacterSkills } from '../freefire/CharacterSkills';

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public scene: THREE.Scene;
  public world: VoxelWorld;
  public sound: SoundSynthesizer;
  public particles: ParticleManager;
  public glooManager: GlooWallManager;
  public skills: CharacterSkills;

  // Player position & physics
  public position: THREE.Vector3 = new THREE.Vector3(0, 50, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  public boundingBox: THREE.Box3 = new THREE.Box3();
  public isGrounded: boolean = false;

  // Camera settings
  public isThirdPerson: boolean = false;
  public isADS: boolean = false;
  public pitch: number = 0;
  public yaw: number = 0;
  private mouseSensitivity: number = 0.0022;

  // Movement constants
  private walkSpeed: number = 6.0;
  private sprintSpeed: number = 9.5;
  private jumpSpeed: number = 8.5;
  private gravity: number = 24.0;
  public isSprinting: boolean = false;

  // Parachute / Airborne state
  public isAirborne: boolean = true;
  public isParachuteOpen: boolean = false;
  public altitude: number = 50;
  private parachuteMesh: THREE.Group | null = null;

  // Vitals & inventory
  public vitals: PlayerVitals = {
    health: 100,
    maxHealth: 100,
    armor: 100,
    maxArmor: 100,
    helmetTier: 2,
    vestTier: 2,
    woodCount: 50,
    stoneCount: 30,
    glooCount: 3
  };

  public inventory: InventorySlot[] = [
    { weapon: WEAPON_REGISTRY.m416, currentAmmo: 30, reserveAmmo: 180 },
    { weapon: WEAPON_REGISTRY.mp40, currentAmmo: 32, reserveAmmo: 200 },
    { weapon: WEAPON_REGISTRY.pickaxe, currentAmmo: 0, reserveAmmo: 0 },
    { weapon: WEAPON_REGISTRY.gloo_wall, currentAmmo: 3, reserveAmmo: 0 },
    { weapon: WEAPON_REGISTRY.medkit, currentAmmo: 2, reserveAmmo: 0 }
  ];
  public activeSlotIndex: number = 0;

  // Combat state
  public recoil: RecoilSystem = new RecoilSystem();
  private shootCooldown: number = 0;
  public isReloading: boolean = false;
  public reloadTimer: number = 0;
  private isMouseDown: boolean = false;

  // 3D Player Character Model (voxel avatar)
  public playerMesh: THREE.Group;
  private headMesh: THREE.Mesh;
  private gunMesh: THREE.Mesh;

  // Input states
  private keys: Record<string, boolean> = {};

  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    world: VoxelWorld,
    sound: SoundSynthesizer,
    particles: ParticleManager,
    glooManager: GlooWallManager,
    skills: CharacterSkills
  ) {
    this.camera = camera;
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.particles = particles;
    this.glooManager = glooManager;
    this.skills = skills;

    // Build Voxel Player Avatar
    this.playerMesh = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2563eb });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 });
    const vestMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
    const helmetMat = new THREE.MeshLambertMaterial({ color: 0x374151 });

    // Torso with tactical vest
    const bodyGeo = new THREE.BoxGeometry(0.55, 0.75, 0.3);
    const bodyMesh = new THREE.Mesh(bodyGeo, vestMat);
    bodyMesh.position.y = 0.9;
    this.playerMesh.add(bodyMesh);

    // Head with tactical helmet
    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.position.y = 1.45;

    const helmetGeo = new THREE.BoxGeometry(0.38, 0.2, 0.38);
    const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat);
    helmetMesh.position.y = 0.1;
    this.headMesh.add(helmetMesh);
    this.playerMesh.add(this.headMesh);

    // Gun in hand
    const gunGeo = new THREE.BoxGeometry(0.1, 0.12, 0.6);
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
    this.gunMesh = new THREE.Mesh(gunGeo, gunMat);
    this.gunMesh.position.set(0.32, 0.85, -0.4);
    this.playerMesh.add(this.gunMesh);

    this.playerMesh.castShadow = true;
    this.scene.add(this.playerMesh);

    this.setupParachuteMesh();
    this.setupEventListeners();
  }

  private setupParachuteMesh(): void {
    this.parachuteMesh = new THREE.Group();

    // Large military camouflage canopy
    const canopyGeo = new THREE.CylinderGeometry(2.4, 0.8, 1.2, 8, 1, true);
    const canopyMat = new THREE.MeshLambertMaterial({
      color: 0x15803d,
      side: THREE.DoubleSide
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 3.2;
    this.parachuteMesh.add(canopy);

    // Cords
    const cordMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 1.6, 0),
        new THREE.Vector3(Math.cos(angle) * 2.2, 3.2, Math.sin(angle) * 2.2)
      ]);
      const cord = new THREE.Line(geo, cordMat);
      this.parachuteMesh.add(cord);
    }

    this.parachuteMesh.visible = false;
    this.playerMesh.add(this.parachuteMesh);
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('wheel', (e) => this.onWheel(e));
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys[e.code] = true;

    if (e.code === 'KeyV') {
      this.isThirdPerson = !this.isThirdPerson;
      this.playerMesh.visible = this.isThirdPerson;
    }

    if (e.code === 'KeyR') {
      this.startReload();
    }

    if (e.code === 'KeyE') {
      this.skills.activateSkill(this.position);
    }

    if (e.code === 'KeyG') {
      this.deployGlooWall();
    }

    if (e.code === 'Space' && this.isAirborne) {
      this.isParachuteOpen = !this.isParachuteOpen;
      if (this.parachuteMesh) {
        this.parachuteMesh.visible = this.isParachuteOpen;
      }
    }

    // Number keys 1-5 for hotbar
    if (e.key >= '1' && e.key <= '5') {
      const slot = parseInt(e.key, 10) - 1;
      this.selectSlot(slot);
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;
  }

  private onMouseDown(e: MouseEvent): void {
    if (document.pointerLockElement !== document.getElementById('game-canvas')) {
      return;
    }

    if (e.button === 0) {
      this.isMouseDown = true;
      this.performAction();
    } else if (e.button === 2) {
      this.isADS = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.isMouseDown = false;
    } else if (e.button === 2) {
      this.isADS = false;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (document.pointerLockElement !== document.getElementById('game-canvas')) {
      return;
    }

    const adsMultiplier = this.isADS ? 0.45 : 1.0;
    this.yaw -= e.movementX * this.mouseSensitivity * adsMultiplier;
    this.pitch -= e.movementY * this.mouseSensitivity * adsMultiplier;

    // Clamp pitch (-89 to +89 degrees)
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
  }

  private onWheel(e: WheelEvent): void {
    if (e.deltaY > 0) {
      this.selectSlot((this.activeSlotIndex + 1) % this.inventory.length);
    } else {
      this.selectSlot((this.activeSlotIndex - 1 + this.inventory.length) % this.inventory.length);
    }
  }

  public selectSlot(index: number): void {
    if (index >= 0 && index < this.inventory.length) {
      this.activeSlotIndex = index;
      this.isReloading = false;
    }
  }

  public getActiveWeapon(): WeaponConfig | null {
    return this.inventory[this.activeSlotIndex].weapon;
  }

  public getActiveSlot(): InventorySlot {
    return this.inventory[this.activeSlotIndex];
  }

  public deployGlooWall(): boolean {
    if (this.vitals.glooCount <= 0) return false;

    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);

    const success = this.glooManager.deployGlooWall(this.position, lookDir);
    if (success) {
      this.vitals.glooCount--;
      return true;
    }
    return false;
  }

  public startReload(): void {
    const slot = this.getActiveSlot();
    const weapon = slot.weapon;
    if (!weapon || slot.reserveAmmo <= 0 || slot.currentAmmo >= weapon.magazineSize || this.isReloading) {
      return;
    }

    this.isReloading = true;
    this.reloadTimer = weapon.reloadTime;
    this.sound.playReload();
  }

  private performAction(): void {
    const slot = this.getActiveSlot();
    const weapon = slot.weapon;
    if (!weapon || this.isAirborne) return;

    if (weapon.id === 'gloo_wall') {
      this.deployGlooWall();
      return;
    }

    if (weapon.id === 'medkit') {
      this.useMedkit();
      return;
    }

    if (weapon.id === 'pickaxe') {
      this.mineOrBuild();
      return;
    }

    // Fire weapon
    if (this.shootCooldown <= 0 && !this.isReloading) {
      if (slot.currentAmmo > 0) {
        this.fireBullet(weapon);
        slot.currentAmmo--;
        this.shootCooldown = 1.0 / weapon.fireRate;
      } else {
        this.startReload();
      }
    }
  }

  private useMedkit(): void {
    const slot = this.getActiveSlot();
    if (slot.currentAmmo <= 0 || this.vitals.health >= this.vitals.maxHealth) return;

    slot.currentAmmo--;
    this.vitals.health = Math.min(this.vitals.maxHealth, this.vitals.health + 75);
    this.sound.playSkillActivate();
  }

  private mineOrBuild(): void {
    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);

    const hit = raycastVoxel(this.world, this.camera.position, lookDir, 5.0);

    if (hit.hit && hit.blockPosition && hit.blockType) {
      // Mine the targeted block
      const bx = hit.blockPosition.x;
      const by = hit.blockPosition.y;
      const bz = hit.blockPosition.z;

      const def = BLOCK_DEFINITIONS[hit.blockType];
      if (def) {
        if (def.dropType === 'wood') this.vitals.woodCount += def.dropCount;
        if (def.dropType === 'stone') this.vitals.stoneCount += def.dropCount;
      }

      this.world.setBlock(bx, by, bz, BlockType.AIR);
      this.sound.playMineBlock();
      this.particles.spawnVoxelDebris(hit.point, 0x887755, 10);
    } else if (hit.placePosition && (this.vitals.woodCount >= 10 || this.vitals.stoneCount >= 10)) {
      // Build a ramp or wall block (Minecraft building)
      const px = hit.placePosition.x;
      const py = hit.placePosition.y;
      const pz = hit.placePosition.z;

      const blockToPlace = this.vitals.woodCount >= 10 ? BlockType.WOOD : BlockType.BRICK;
      if (blockToPlace === BlockType.WOOD) this.vitals.woodCount -= 10;
      else this.vitals.stoneCount -= 10;

      this.world.setBlock(px, py, pz, blockToPlace);
      this.sound.playPlaceBlock();
      this.particles.spawnVoxelDebris(new THREE.Vector3(px + 0.5, py + 0.5, pz + 0.5), 0x996633, 5);
    }
  }

  private fireBullet(weapon: WeaponConfig): void {
    // Recoil kick & audio
    this.recoil.applyRecoil(weapon.recoilVertical, weapon.recoilHorizontal, this.isADS);
    this.sound.playGunshot(weapon.soundType as any);

    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);

    // Apply weapon spread bloom
    const spread = this.recoil.getEffectiveSpread(weapon.spread);
    lookDir.x += (Math.random() - 0.5) * spread;
    lookDir.y += (Math.random() - 0.5) * spread;
    lookDir.z += (Math.random() - 0.5) * spread;
    lookDir.normalize();

    const rayOrigin = this.camera.position.clone();
    const voxelHit = raycastVoxel(this.world, rayOrigin, lookDir, weapon.range);

    const muzzlePos = this.playerMesh.position.clone().add(new THREE.Vector3(0.3, 1.2, 0));
    const hitPoint = voxelHit.point;

    // Bullet tracer line
    this.particles.createBulletTracer(muzzlePos, hitPoint, weapon.bulletSpeed);

    if (voxelHit.hit) {
      this.particles.spawnImpact(hitPoint, voxelHit.normal);
    }

    // Trigger weapon firing event for AI bots check
    this.onWeaponFired(rayOrigin, lookDir, weapon);
  }

  // Callback attached by BotManager
  public onWeaponFired: (origin: THREE.Vector3, dir: THREE.Vector3, weapon: WeaponConfig) => void = () => {};

  public applyDamage(amount: number, isHeadshot: boolean = false): void {
    let effectiveDmg = amount;

    if (isHeadshot) {
      const helmetReduction = this.vitals.helmetTier * 0.15; // Tier 1: 15%, Tier 2: 30%, Tier 3: 45%
      effectiveDmg *= (1.0 - helmetReduction);
    }

    // Vest absorbs 50% damage
    if (this.vitals.armor > 0) {
      const armorAbsorb = effectiveDmg * 0.5;
      if (this.vitals.armor >= armorAbsorb) {
        this.vitals.armor -= armorAbsorb;
        effectiveDmg -= armorAbsorb;
      } else {
        effectiveDmg -= this.vitals.armor;
        this.vitals.armor = 0;
      }
    }

    this.vitals.health = Math.max(0, this.vitals.health - effectiveDmg);
  }

  public update(delta: number): void {
    this.updateAirborne(delta);
    this.updateMovement(delta);
    this.updateCombat(delta);
    this.updateCamera();
  }

  private updateAirborne(delta: number): void {
    if (!this.isAirborne) return;

    const highestGround = this.world.getHighestY(Math.floor(this.position.x), Math.floor(this.position.z)) + 1;
    this.altitude = Math.max(0, Math.round(this.position.y - highestGround));

    // Auto-deploy parachute at 18m
    if (this.altitude < 18 && !this.isParachuteOpen) {
      this.isParachuteOpen = true;
      if (this.parachuteMesh) this.parachuteMesh.visible = true;
    }

    const fallSpeed = this.isParachuteOpen ? 7.0 : 25.0;
    this.velocity.y = -fallSpeed;

    // Gliding control
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const glideSpeed = this.isParachuteOpen ? 12.0 : 6.0;

    if (this.keys['KeyW']) this.velocity.add(forward.clone().multiplyScalar(glideSpeed * delta * 5));
    if (this.keys['KeyS']) this.velocity.add(forward.clone().multiplyScalar(-glideSpeed * delta * 5));

    this.position.addScaledVector(this.velocity, delta);

    // Touchdown
    if (this.position.y <= highestGround + 1.2) {
      this.position.y = highestGround + 1.2;
      this.isAirborne = false;
      this.isParachuteOpen = false;
      if (this.parachuteMesh) this.parachuteMesh.visible = false;
      this.velocity.set(0, 0, 0);
    }

    this.playerMesh.position.copy(this.position);
  }

  private updateMovement(delta: number): void {
    if (this.isAirborne) return;

    this.isSprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    let speed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;

    if (this.skills.isSkillActive) {
      speed *= this.skills.speedMultiplier;
    }

    // Direction vectors
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const moveDir = new THREE.Vector3();
    if (this.keys['KeyW']) moveDir.add(forward);
    if (this.keys['KeyS']) moveDir.sub(forward);
    if (this.keys['KeyD']) moveDir.add(right);
    if (this.keys['KeyA']) moveDir.sub(right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
    }

    this.velocity.x = moveDir.x * speed;
    this.velocity.z = moveDir.z * speed;

    // Jump
    if (this.keys['Space'] && this.isGrounded) {
      this.velocity.y = this.jumpSpeed;
      this.isGrounded = false;
    }

    // Gravity
    this.velocity.y -= this.gravity * delta;

    // Voxel AABB Collision & Sliding
    this.resolveVoxelCollisions(delta);

    this.playerMesh.position.copy(this.position);
    this.playerMesh.rotation.y = this.yaw;
  }

  private resolveVoxelCollisions(delta: number): void {
    const halfWidth = 0.3;
    const height = 1.8;

    // X-axis movement & collision
    const nextX = this.position.x + this.velocity.x * delta;
    this.boundingBox.min.set(nextX - halfWidth, this.position.y, this.position.z - halfWidth);
    this.boundingBox.max.set(nextX + halfWidth, this.position.y + height, this.position.z + halfWidth);

    if (!this.world.checkAABBCollision(this.boundingBox)) {
      this.position.x = nextX;
    } else {
      // Step-assist: check if climbing 1 block is possible
      this.boundingBox.min.y += 1.05;
      this.boundingBox.max.y += 1.05;
      if (!this.world.checkAABBCollision(this.boundingBox)) {
        this.position.y += 1.05;
        this.position.x = nextX;
      } else {
        this.velocity.x = 0;
      }
    }

    // Z-axis movement & collision
    const nextZ = this.position.z + this.velocity.z * delta;
    this.boundingBox.min.set(this.position.x - halfWidth, this.position.y, nextZ - halfWidth);
    this.boundingBox.max.set(this.position.x + halfWidth, this.position.y + height, nextZ + halfWidth);

    if (!this.world.checkAABBCollision(this.boundingBox)) {
      this.position.z = nextZ;
    } else {
      // Step-assist on Z
      this.boundingBox.min.y += 1.05;
      this.boundingBox.max.y += 1.05;
      if (!this.world.checkAABBCollision(this.boundingBox)) {
        this.position.y += 1.05;
        this.position.z = nextZ;
      } else {
        this.velocity.z = 0;
      }
    }

    // Y-axis movement & collision (gravity / landing)
    const nextY = this.position.y + this.velocity.y * delta;
    this.boundingBox.min.set(this.position.x - halfWidth, nextY, this.position.z - halfWidth);
    this.boundingBox.max.set(this.position.x + halfWidth, nextY + height, this.position.z + halfWidth);

    if (!this.world.checkAABBCollision(this.boundingBox)) {
      this.position.y = nextY;
      this.isGrounded = false;
    } else {
      if (this.velocity.y < 0) {
        this.isGrounded = true;
        this.position.y = Math.floor(nextY) + 1.0;
      }
      this.velocity.y = 0;
    }
  }

  private updateCombat(delta: number): void {
    if (this.shootCooldown > 0) {
      this.shootCooldown -= delta;
    }

    if (this.isReloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const slot = this.getActiveSlot();
        const weapon = slot.weapon;
        if (weapon) {
          const needed = weapon.magazineSize - slot.currentAmmo;
          const transfer = Math.min(needed, slot.reserveAmmo);
          slot.currentAmmo += transfer;
          slot.reserveAmmo -= transfer;
        }
      }
    }

    // Continuous fire for automatic weapons
    const activeWeapon = this.getActiveWeapon();
    if (this.isMouseDown && activeWeapon && activeWeapon.isAutomatic && !this.isAirborne) {
      this.performAction();
    }

    const isMoving = this.velocity.x !== 0 || this.velocity.z !== 0;
    this.recoil.update(delta, isMoving, this.isSprinting, this.isADS);
  }

  private updateCamera(): void {
    const finalPitch = this.pitch + this.recoil.currentRecoilPitch;
    const finalYaw = this.yaw + this.recoil.currentRecoilYaw;

    this.headMesh.rotation.x = finalPitch;

    if (!this.isThirdPerson) {
      // 1st Person: Camera right at eye level
      this.camera.position.set(
        this.position.x,
        this.position.y + 1.55,
        this.position.z
      );
      this.camera.rotation.set(finalPitch, finalYaw, 0, 'YXZ');
      this.playerMesh.visible = false;
    } else {
      // 3rd Person: PUBG/Free Fire over-the-shoulder camera
      this.playerMesh.visible = true;
      const shoulderOffset = new THREE.Vector3(0.65, 1.6, 2.5);
      shoulderOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), finalPitch);
      shoulderOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), finalYaw);

      this.camera.position.copy(this.position).add(shoulderOffset);
      this.camera.rotation.set(finalPitch, finalYaw, 0, 'YXZ');
    }

    // Field of view for ADS Zoom
    const targetFOV = this.isADS ? 40 : 75;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.2);
    this.camera.updateProjectionMatrix();
  }
}
