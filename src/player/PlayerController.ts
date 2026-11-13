import * as THREE from 'three';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { raycastVoxel } from '../voxel/VoxelRaycast';
import { BlockType, InventorySlot, PlayerVitals, WeaponConfig } from '../types';
import { BLOCK_DEFINITIONS } from '../voxel/VoxelTypes';
import { WEAPON_REGISTRY } from '../combat/WeaponTypes';
import { RecoilSystem } from '../combat/RecoilSystem';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { ParticleManager } from '../combat/ParticleManager';
import { GlooWallManager } from '../freefire/GlooWallManager';
import { CharacterSkills } from '../freefire/CharacterSkills';
import { GrenadeManager } from '../combat/GrenadeManager';

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public scene: THREE.Scene;
  public world: VoxelWorld;
  public sound: SoundSynthesizer;
  public particles: ParticleManager;
  public glooManager: GlooWallManager;
  public skills: CharacterSkills;
  public grenadeManager: GrenadeManager;

  // Player position & physics
  public position: THREE.Vector3 = new THREE.Vector3(0, 48, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public boundingBox: THREE.Box3 = new THREE.Box3();
  public isGrounded: boolean = false;

  // Camera settings: TPS is DEFAULT!
  public isThirdPerson: boolean = true;
  public isADS: boolean = false;
  public pitch: number = 0;
  public yaw: number = 0;
  private mouseSensitivity: number = 0.0022;

  // Movement constants
  private walkSpeed: number = 6.5;
  private sprintSpeed: number = 10.5;
  private jumpSpeed: number = 9.0;
  private gravity: number = 24.0;
  public isSprinting: boolean = false;

  // Parachute / Airborne state
  public isAirborne: boolean = true;
  public isParachuteOpen: boolean = false;
  public altitude: number = 48;
  private parachuteMesh: THREE.Group | null = null;

  // Vitals & inventory
  public vitals: PlayerVitals = {
    health: 100,
    maxHealth: 100,
    armor: 100,
    maxArmor: 100,
    helmetTier: 2,
    vestTier: 2,
    woodCount: 80,
    stoneCount: 50,
    glooCount: 4
  };

  public inventory: InventorySlot[] = [
    { weapon: WEAPON_REGISTRY.m416, currentAmmo: 30, reserveAmmo: 180 },
    { weapon: WEAPON_REGISTRY.awm, currentAmmo: 5, reserveAmmo: 25 },
    { weapon: WEAPON_REGISTRY.pickaxe, currentAmmo: 0, reserveAmmo: 0 },
    { weapon: WEAPON_REGISTRY.frag_grenade, currentAmmo: 4, reserveAmmo: 0 },
    { weapon: WEAPON_REGISTRY.gloo_wall, currentAmmo: 4, reserveAmmo: 0 },
    { weapon: WEAPON_REGISTRY.medkit, currentAmmo: 3, reserveAmmo: 0 }
  ];
  public activeSlotIndex: number = 0;

  // Combat state
  public recoil: RecoilSystem = new RecoilSystem();
  private shootCooldown: number = 0;
  public isReloading: boolean = false;
  public reloadTimer: number = 0;
  public isShooting: boolean = false;
  private isMouseDown: boolean = false;

  // 3D Player Character Model (Fully Animated Rig)
  public playerMesh: THREE.Group;
  private torsoGroup: THREE.Group;
  private headMesh: THREE.Mesh;
  private legLeft: THREE.Mesh;
  private legRight: THREE.Mesh;
  private armLeft: THREE.Group;
  private armRight: THREE.Group;
  private gunMesh: THREE.Group;
  private pickaxeMesh: THREE.Group;
  private glooOrbMesh: THREE.Mesh;
  private grenadeMesh: THREE.Group;
  private muzzleFlashMesh: THREE.Mesh;

  // Animation timers
  private walkCycle: number = 0;
  private pickaxeSwingTimer: number = 0;
  private muzzleFlashTimer: number = 0;

  // Input states
  private keys: Record<string, boolean> = {};

  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    world: VoxelWorld,
    sound: SoundSynthesizer,
    particles: ParticleManager,
    glooManager: GlooWallManager,
    skills: CharacterSkills,
    grenadeManager: GrenadeManager
  ) {
    this.camera = camera;
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.particles = particles;
    this.glooManager = glooManager;
    this.skills = skills;
    this.grenadeManager = grenadeManager;

    // 1. Build Animated Voxel Character Model
    this.playerMesh = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
    const vestMat = new THREE.MeshLambertMaterial({ color: 0x1e3a5f });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const helmetMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x18181b });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });

    // Legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.75, 0.26);
    this.legLeft = new THREE.Mesh(legGeo, pantsMat);
    this.legLeft.position.set(-0.16, 0.38, 0);
    this.legLeft.castShadow = true;
    this.playerMesh.add(this.legLeft);

    this.legRight = new THREE.Mesh(legGeo, pantsMat);
    this.legRight.position.set(0.16, 0.38, 0);
    this.legRight.castShadow = true;
    this.playerMesh.add(this.legRight);

    // Torso Group
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.75, 0);
    this.playerMesh.add(this.torsoGroup);

    const torsoGeo = new THREE.BoxGeometry(0.58, 0.72, 0.32);
    const torsoMesh = new THREE.Mesh(torsoGeo, vestMat);
    torsoMesh.position.set(0, 0.36, 0);
    torsoMesh.castShadow = true;
    this.torsoGroup.add(torsoMesh);

    const packGeo = new THREE.BoxGeometry(0.42, 0.45, 0.16);
    const packMesh = new THREE.Mesh(packGeo, helmetMat);
    packMesh.position.set(0, 0.38, 0.22);
    this.torsoGroup.add(packMesh);

    // Head
    const headGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.position.set(0, 0.9, 0);
    this.headMesh.castShadow = true;

    const helmetGeo = new THREE.BoxGeometry(0.4, 0.2, 0.4);
    const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat);
    helmetMesh.position.set(0, 0.1, 0);
    this.headMesh.add(helmetMesh);

    const visorGeo = new THREE.BoxGeometry(0.32, 0.08, 0.06);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, -0.02, -0.19);
    this.headMesh.add(visorMesh);

    this.torsoGroup.add(this.headMesh);

    // Left Arm
    this.armLeft = new THREE.Group();
    this.armLeft.position.set(-0.38, 0.65, 0);
    const armGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
    const armLMesh = new THREE.Mesh(armGeo, vestMat);
    armLMesh.position.set(0, -0.3, 0);
    armLMesh.castShadow = true;
    this.armLeft.add(armLMesh);
    this.torsoGroup.add(this.armLeft);

    // Right Arm (holds weapon)
    this.armRight = new THREE.Group();
    this.armRight.position.set(0.38, 0.65, 0);
    const armRMesh = new THREE.Mesh(armGeo, vestMat);
    armRMesh.position.set(0, -0.3, 0);
    armRMesh.castShadow = true;
    this.armRight.add(armRMesh);
    this.torsoGroup.add(this.armRight);

    // 2. Gun Mesh with Tactical 3D Scope
    this.gunMesh = new THREE.Group();
    const receiverGeo = new THREE.BoxGeometry(0.1, 0.14, 0.45);
    const receiverMesh = new THREE.Mesh(receiverGeo, gunMat);
    this.gunMesh.add(receiverMesh);

    const barrelGeo = new THREE.BoxGeometry(0.06, 0.06, 0.4);
    const barrelMesh = new THREE.Mesh(barrelGeo, gunMat);
    barrelMesh.position.set(0, 0.02, -0.38);
    this.gunMesh.add(barrelMesh);

    const magGeo = new THREE.BoxGeometry(0.08, 0.22, 0.12);
    const magMesh = new THREE.Mesh(magGeo, gunMat);
    magMesh.position.set(0, -0.14, -0.05);
    this.gunMesh.add(magMesh);

    // 3D Optical Tactical Scope Cylinder mounted on rifle rail
    const scopeTubeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.26, 8);
    const scopeMat = new THREE.MeshLambertMaterial({ color: 0x27272a });
    const scopeTube = new THREE.Mesh(scopeTubeGeo, scopeMat);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.12, -0.05);
    this.gunMesh.add(scopeTube);

    const scopeBellGeo = new THREE.CylinderGeometry(0.055, 0.04, 0.08, 8);
    const scopeBell = new THREE.Mesh(scopeBellGeo, scopeMat);
    scopeBell.rotation.x = Math.PI / 2;
    scopeBell.position.set(0, 0.12, -0.18);
    this.gunMesh.add(scopeBell);

    const lensGeo = new THREE.CircleGeometry(0.045, 8);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0, 0.12, -0.23);
    this.gunMesh.add(lens);

    // Muzzle Flash
    const flashGeo = new THREE.OctahedronGeometry(0.14, 0);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0, 0.02, -0.6);
    this.gunMesh.add(this.muzzleFlashMesh);

    this.gunMesh.position.set(0, -0.35, -0.25);
    this.armRight.add(this.gunMesh);

    // Pickaxe Mesh
    this.pickaxeMesh = new THREE.Group();
    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6);
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x854d0e });
    const handleMesh = new THREE.Mesh(handleGeo, woodMat);
    handleMesh.rotation.x = Math.PI / 2;
    this.pickaxeMesh.add(handleMesh);

    const pickHeadGeo = new THREE.BoxGeometry(0.48, 0.08, 0.12);
    const pickHeadMesh = new THREE.Mesh(pickHeadGeo, goldMat);
    pickHeadMesh.position.set(0, 0, -0.38);
    this.pickaxeMesh.add(pickHeadMesh);

    this.pickaxeMesh.position.set(0, -0.35, -0.2);
    this.pickaxeMesh.visible = false;
    this.armRight.add(this.pickaxeMesh);

    // Gloo Wall Capsule Orb
    const orbGeo = new THREE.DodecahedronGeometry(0.15, 0);
    const orbMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.glooOrbMesh = new THREE.Mesh(orbGeo, orbMat);
    this.glooOrbMesh.position.set(0, -0.35, -0.2);
    this.glooOrbMesh.visible = false;
    this.armRight.add(this.glooOrbMesh);

    // Frag Grenade Mesh in Hand
    this.grenadeMesh = new THREE.Group();
    const gBodyGeo = new THREE.DodecahedronGeometry(0.13, 1);
    const gBodyMat = new THREE.MeshLambertMaterial({ color: 0x3f6212 });
    const gBody = new THREE.Mesh(gBodyGeo, gBodyMat);
    this.grenadeMesh.add(gBody);

    const gCapGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6);
    const gCap = new THREE.Mesh(gCapGeo, scopeMat);
    gCap.position.y = 0.12;
    this.grenadeMesh.add(gCap);

    this.grenadeMesh.position.set(0, -0.35, -0.2);
    this.grenadeMesh.visible = false;
    this.armRight.add(this.grenadeMesh);

    this.scene.add(this.playerMesh);

    this.setupParachuteMesh();
    this.setupEventListeners();
  }

  private setupParachuteMesh(): void {
    this.parachuteMesh = new THREE.Group();

    const canopyGeo = new THREE.CylinderGeometry(2.8, 1.0, 1.4, 8, 1, true);
    const canopyMat = new THREE.MeshLambertMaterial({
      color: 0x16a34a,
      side: THREE.DoubleSide
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 3.6;
    this.parachuteMesh.add(canopy);

    const cordMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 1.6, 0),
        new THREE.Vector3(Math.cos(angle) * 2.5, 3.6, Math.sin(angle) * 2.5)
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

    // Quick throw grenade on [T]
    if (e.code === 'KeyT') {
      this.throwGrenade();
    }

    if (e.code === 'Space' && this.isAirborne) {
      this.isParachuteOpen = !this.isParachuteOpen;
      if (this.parachuteMesh) {
        this.parachuteMesh.visible = this.isParachuteOpen;
      }
    }

    // Number keys 1-6 for hotbar
    if (e.key >= '1' && e.key <= '6') {
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

    const adsMultiplier = this.isADS ? 0.35 : 1.0;
    this.yaw -= e.movementX * this.mouseSensitivity * adsMultiplier;
    this.pitch -= e.movementY * this.mouseSensitivity * adsMultiplier;

    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
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
      this.updateEquippedMesh();
    }
  }

  private updateEquippedMesh(): void {
    const slot = this.getActiveSlot();
    const id = slot.weapon ? slot.weapon.id : '';

    this.gunMesh.visible = id === 'm416' || id === 'ak47' || id === 'mp40' || id === 'awm' || id === 'm1887';
    this.pickaxeMesh.visible = id === 'pickaxe';
    this.glooOrbMesh.visible = id === 'gloo_wall';
    this.grenadeMesh.visible = id === 'frag_grenade';
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
      this.armRight.rotation.x = -1.2;
      return true;
    }
    return false;
  }

  public throwGrenade(): boolean {
    const slot = this.inventory.find(s => s.weapon?.id === 'frag_grenade');
    if (!slot || slot.currentAmmo <= 0) return false;

    slot.currentAmmo--;
    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);

    const startPos = this.position.clone().add(new THREE.Vector3(0.3, 1.5, 0));
    this.grenadeManager.throwGrenade(startPos, lookDir);

    this.armRight.rotation.x = -1.4;
    return true;
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

    if (weapon.id === 'frag_grenade') {
      this.throwGrenade();
      return;
    }

    if (weapon.id === 'gloo_wall') {
      this.deployGlooWall();
      return;
    }

    if (weapon.id === 'medkit') {
      this.useMedkit();
      return;
    }

    if (weapon.id === 'pickaxe') {
      this.pickaxeSwingTimer = 0.3;
      this.mineOrBuild();
      return;
    }

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

    const hit = raycastVoxel(this.world, this.camera.position, lookDir, 7.0);

    if (hit.hit && hit.blockPosition && hit.blockType) {
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
      this.particles.spawnVoxelDebris(hit.point, 0x887755, 12);
    } else if (hit.placePosition && (this.vitals.woodCount >= 10 || this.vitals.stoneCount >= 10)) {
      const px = hit.placePosition.x;
      const py = hit.placePosition.y;
      const pz = hit.placePosition.z;

      const blockToPlace = this.vitals.woodCount >= 10 ? BlockType.WOOD : BlockType.BRICK;
      if (blockToPlace === BlockType.WOOD) this.vitals.woodCount -= 10;
      else this.vitals.stoneCount -= 10;

      this.world.setBlock(px, py, pz, blockToPlace);
      this.sound.playPlaceBlock();
      this.particles.spawnVoxelDebris(new THREE.Vector3(px + 0.5, py + 0.5, pz + 0.5), 0x996633, 6);
    }
  }

  private fireBullet(weapon: WeaponConfig): void {
    this.isShooting = true;
    this.recoil.applyRecoil(weapon.recoilVertical, weapon.recoilHorizontal, this.isADS);
    this.sound.playGunshot(weapon.soundType as any);

    (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
    this.muzzleFlashTimer = 0.06;

    this.armRight.position.z += 0.08;

    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);

    const spread = this.recoil.getEffectiveSpread(weapon.spread);
    lookDir.x += (Math.random() - 0.5) * spread;
    lookDir.y += (Math.random() - 0.5) * spread;
    lookDir.z += (Math.random() - 0.5) * spread;
    lookDir.normalize();

    const rayOrigin = this.camera.position.clone();
    const voxelHit = raycastVoxel(this.world, rayOrigin, lookDir, weapon.range);

    const muzzleWorldPos = new THREE.Vector3();
    this.muzzleFlashMesh.getWorldPosition(muzzleWorldPos);

    const hitPoint = voxelHit.point;
    this.particles.createBulletTracer(muzzleWorldPos, hitPoint, weapon.bulletSpeed);

    if (voxelHit.hit) {
      this.particles.spawnImpact(hitPoint, voxelHit.normal);
    }

    this.onWeaponFired(rayOrigin, lookDir, weapon);
  }

  public onWeaponFired: (origin: THREE.Vector3, dir: THREE.Vector3, weapon: WeaponConfig) => void = () => {};

  public applyDamage(amount: number, isHeadshot: boolean = false): void {
    let effectiveDmg = amount;

    if (isHeadshot) {
      const helmetReduction = this.vitals.helmetTier * 0.15;
      effectiveDmg *= (1.0 - helmetReduction);
    }

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

    // Audio & screen damage feedback
    this.sound.playPlayerHurt();

    const vig = document.getElementById('damage-vignette');
    if (vig) {
      vig.classList.remove('hidden');
      vig.classList.add('active');
      setTimeout(() => {
        vig.classList.remove('active');
      }, 250);
    }

    // Flinch / camera impulse
    this.pitch += (Math.random() - 0.5) * 0.035;
    this.yaw += (Math.random() - 0.5) * 0.035;
  }

  public update(delta: number): void {
    this.updateAirborne(delta);
    this.updateMovement(delta);
    this.updateAnimations(delta);
    this.updateCombat(delta);
    this.updateCamera();
    this.updateGrenadePreview();
  }

  private updateGrenadePreview(): void {
    const slot = this.getActiveSlot();
    const isGrenade = slot.weapon?.id === 'frag_grenade';
    if (isGrenade && !this.isAirborne) {
      const lookDir = new THREE.Vector3();
      this.camera.getWorldDirection(lookDir);
      const throwStart = this.position.clone().add(new THREE.Vector3(0.3, 1.5, 0));
      this.grenadeManager.updateTrajectoryPreview(throwStart, lookDir, true);
    } else {
      this.grenadeManager.updateTrajectoryPreview(this.position, new THREE.Vector3(), false);
    }
  }

  private updateAirborne(delta: number): void {
    if (!this.isAirborne) return;

    const highestGround = this.world.getHighestY(Math.floor(this.position.x), Math.floor(this.position.z)) + 1;
    this.altitude = Math.max(0, Math.round(this.position.y - highestGround));

    if (this.altitude < 18 && !this.isParachuteOpen) {
      this.isParachuteOpen = true;
      if (this.parachuteMesh) this.parachuteMesh.visible = true;
    }

    const fallSpeed = this.isParachuteOpen ? 6.5 : 22.0;
    this.velocity.y = -fallSpeed;

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const glideSpeed = this.isParachuteOpen ? 12.0 : 6.0;

    if (this.keys['KeyW']) this.velocity.add(forward.clone().multiplyScalar(glideSpeed * delta * 5));
    if (this.keys['KeyS']) this.velocity.add(forward.clone().multiplyScalar(-glideSpeed * delta * 5));

    this.position.addScaledVector(this.velocity, delta);

    if (this.position.y <= highestGround + 0.2) {
      this.position.y = highestGround;
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

    if (this.keys['Space'] && this.isGrounded) {
      this.velocity.y = this.jumpSpeed;
      this.isGrounded = false;
    }

    this.velocity.y -= this.gravity * delta;

    this.resolveVoxelCollisions(delta);

    // Island boundary clamp
    const mapLimit = 90;
    this.position.x = Math.max(-mapLimit, Math.min(mapLimit, this.position.x));
    this.position.z = Math.max(-mapLimit, Math.min(mapLimit, this.position.z));

    const groundLimit = this.world.getHighestY(Math.floor(this.position.x), Math.floor(this.position.z));
    if (this.position.y < groundLimit) {
      this.position.y = groundLimit + 0.1;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    this.playerMesh.position.copy(this.position);
    this.playerMesh.rotation.y = this.yaw;
  }

  private resolveVoxelCollisions(delta: number): void {
    const halfWidth = 0.3;
    const height = 1.8;

    const nextX = this.position.x + this.velocity.x * delta;
    this.boundingBox.min.set(nextX - halfWidth, this.position.y, this.position.z - halfWidth);
    this.boundingBox.max.set(nextX + halfWidth, this.position.y + height, this.position.z + halfWidth);

    if (!this.world.checkAABBCollision(this.boundingBox)) {
      this.position.x = nextX;
    } else {
      this.boundingBox.min.y += 1.05;
      this.boundingBox.max.y += 1.05;
      if (!this.world.checkAABBCollision(this.boundingBox)) {
        this.position.y += 1.05;
        this.position.x = nextX;
      } else {
        this.velocity.x = 0;
      }
    }

    const nextZ = this.position.z + this.velocity.z * delta;
    this.boundingBox.min.set(this.position.x - halfWidth, this.position.y, nextZ - halfWidth);
    this.boundingBox.max.set(this.position.x + halfWidth, this.position.y + height, nextZ + halfWidth);

    if (!this.world.checkAABBCollision(this.boundingBox)) {
      this.position.z = nextZ;
    } else {
      this.boundingBox.min.y += 1.05;
      this.boundingBox.max.y += 1.05;
      if (!this.world.checkAABBCollision(this.boundingBox)) {
        this.position.y += 1.05;
        this.position.z = nextZ;
      } else {
        this.velocity.z = 0;
      }
    }

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

  private updateAnimations(delta: number): void {
    const isMoving = (this.velocity.x !== 0 || this.velocity.z !== 0) && this.isGrounded;

    if (isMoving) {
      const cycleSpeed = this.isSprinting ? 14 : 9;
      this.walkCycle += delta * cycleSpeed;

      this.legLeft.rotation.x = Math.sin(this.walkCycle) * 0.65;
      this.legRight.rotation.x = -Math.sin(this.walkCycle) * 0.65;

      if (!this.isADS) {
        this.armLeft.rotation.x = -Math.sin(this.walkCycle) * 0.45;
      }
    } else {
      this.legLeft.rotation.x = THREE.MathUtils.lerp(this.legLeft.rotation.x, 0, delta * 10);
      this.legRight.rotation.x = THREE.MathUtils.lerp(this.legRight.rotation.x, 0, delta * 10);
      this.armLeft.rotation.x = THREE.MathUtils.lerp(this.armLeft.rotation.x, 0, delta * 10);
    }

    this.torsoGroup.rotation.x = this.pitch * 0.55;

    if (this.pickaxeSwingTimer > 0) {
      this.pickaxeSwingTimer -= delta;
      this.armRight.rotation.x = -0.8 + Math.sin(this.pickaxeSwingTimer * 20) * 0.9;
    } else {
      const targetArmX = -0.25 - this.pitch * 0.4;
      this.armRight.rotation.x = THREE.MathUtils.lerp(this.armRight.rotation.x, targetArmX, delta * 15);
    }

    this.armRight.position.z = THREE.MathUtils.lerp(this.armRight.position.z, 0, delta * 18);

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= delta;
      if (this.muzzleFlashTimer <= 0) {
        (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
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

    const activeWeapon = this.getActiveWeapon();
    const hasScope = activeWeapon && (activeWeapon.id === 'm416' || activeWeapon.id === 'awm');

    // Scope Overlay Visibility
    const scopeOverlay = document.getElementById('scope-overlay');
    const crosshairEl = document.getElementById('crosshair');

    if (this.isADS && hasScope) {
      if (scopeOverlay) scopeOverlay.classList.remove('hidden');
      if (crosshairEl) crosshairEl.classList.add('hidden');
    } else {
      if (scopeOverlay) scopeOverlay.classList.add('hidden');
      if (crosshairEl) crosshairEl.classList.remove('hidden');
    }

    if (!this.isThirdPerson || (this.isADS && activeWeapon?.id === 'awm')) {
      // 1st Person or Full 8x Sniper Scope View
      this.camera.position.set(
        this.position.x,
        this.position.y + 1.55,
        this.position.z
      );
      this.camera.rotation.set(finalPitch, finalYaw, 0, 'YXZ');
      this.playerMesh.visible = false;
    } else {
      this.playerMesh.visible = true;

      // Dynamic Third-Person Camera
      const shoulderX = this.isADS ? 0.42 : 0.65;
      const camDist = this.isADS ? 1.5 : 2.8;
      const camHeight = 1.65;

      const offset = new THREE.Vector3(shoulderX, camHeight, camDist);
      offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), finalPitch * 0.7);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), finalYaw);

      this.camera.position.copy(this.position).add(offset);
      this.camera.rotation.set(finalPitch, finalYaw, 0, 'YXZ');
    }

    // Zoom FOV for Optical Scopes
    let targetFOV = 75;
    if (this.isADS) {
      if (activeWeapon?.id === 'awm') {
        targetFOV = 22; // High-power 8x Sniper Scope
      } else if (activeWeapon?.id === 'm416') {
        targetFOV = 36; // 4x ACOG Scope
      } else {
        targetFOV = 50;
      }
    }

    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.25);
    this.camera.updateProjectionMatrix();
  }
}
