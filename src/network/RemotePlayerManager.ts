import * as THREE from 'three';
import { PlayerController } from '../player/PlayerController';
import { RoomManager } from './RoomManager';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { ParticleManager } from '../combat/ParticleManager';
import { WeaponConfig } from '../types';
import { WEAPON_REGISTRY } from '../combat/WeaponTypes';

export interface RemotePlayerState {
  slotId: number;
  name: string;
  team: 'blue' | 'red';
  position: { x: number; y: number; z: number };
  rotationY: number;
  health: number;
  armor: number;
  weaponId: string;
  isShooting: boolean;
  isAlive: boolean;
}

export class RemotePlayer {
  public slotId: number;
  public name: string;
  public team: 'blue' | 'red';
  public mesh: THREE.Group;
  public headMesh: THREE.Mesh;
  public leftArm: THREE.Mesh;
  public rightArm: THREE.Mesh;
  public leftLeg: THREE.Mesh;
  public rightLeg: THREE.Mesh;
  public gunMesh: THREE.Mesh;
  public torsoMesh: THREE.Mesh;
  public nameSprite: THREE.Sprite;
  public bodyParts: THREE.Mesh[] = [];

  public position: THREE.Vector3 = new THREE.Vector3();
  public targetPosition: THREE.Vector3 = new THREE.Vector3();
  public targetRotationY: number = 0;
  public health: number = 100;
  public maxHealth: number = 100;
  public armor: number = 100;
  public isAlive: boolean = true;
  public currentWeapon: WeaponConfig = WEAPON_REGISTRY.m416;

  private animTimer: number = 0;
  private hitFlashTimer: number = 0;
  private flinchAmount: number = 0;

  private spriteCanvas: HTMLCanvasElement;
  private spriteCtx: CanvasRenderingContext2D;
  private spriteTexture: THREE.CanvasTexture;

  constructor(slotId: number, name: string, team: 'blue' | 'red') {
    this.slotId = slotId;
    this.name = name;
    this.team = team;

    this.mesh = new THREE.Group();

    const teamColor = team === 'blue' ? 0x2563eb : 0xd97706;
    const bodyMat = new THREE.MeshLambertMaterial({ color: teamColor });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd1d5db });
    const vestMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.75, 0.3);
    this.torsoMesh = new THREE.Mesh(torsoGeo, vestMat);
    this.torsoMesh.position.y = 0.9;
    this.mesh.add(this.torsoMesh);
    this.bodyParts.push(this.torsoMesh);

    // Team band
    const bandGeo = new THREE.BoxGeometry(0.57, 0.2, 0.32);
    const band = new THREE.Mesh(bandGeo, bodyMat);
    band.position.y = 0.9;
    this.mesh.add(band);
    this.bodyParts.push(band);

    // Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.position.y = 1.45;
    this.mesh.add(this.headMesh);
    this.bodyParts.push(this.headMesh);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
    this.leftArm = new THREE.Mesh(armGeo, skinMat);
    this.leftArm.position.set(-0.38, 0.9, 0);
    this.mesh.add(this.leftArm);
    this.bodyParts.push(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, skinMat);
    this.rightArm.position.set(0.38, 0.9, 0);
    this.mesh.add(this.rightArm);
    this.bodyParts.push(this.rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    this.leftLeg = new THREE.Mesh(legGeo, vestMat);
    this.leftLeg.position.set(-0.16, 0.35, 0);
    this.mesh.add(this.leftLeg);
    this.bodyParts.push(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, vestMat);
    this.rightLeg.position.set(0.16, 0.35, 0);
    this.mesh.add(this.rightLeg);
    this.bodyParts.push(this.rightLeg);

    // Gun
    const gunGeo = new THREE.BoxGeometry(0.1, 0.12, 0.6);
    this.gunMesh = new THREE.Mesh(gunGeo, gunMat);
    this.gunMesh.position.set(0.3, 0.85, 0.35);
    this.mesh.add(this.gunMesh);
    this.bodyParts.push(this.gunMesh);

    // 3D Name Tag & Dynamic Health Bar Canvas
    this.spriteCanvas = document.createElement('canvas');
    this.spriteCanvas.width = 320;
    this.spriteCanvas.height = 110;
    this.spriteCtx = this.spriteCanvas.getContext('2d')!;

    this.spriteTexture = new THREE.CanvasTexture(this.spriteCanvas);
    const spriteMat = new THREE.SpriteMaterial({ map: this.spriteTexture, transparent: true });
    this.nameSprite = new THREE.Sprite(spriteMat);
    this.nameSprite.scale.set(2.2, 0.75, 1);
    this.nameSprite.position.y = 2.25;
    this.mesh.add(this.nameSprite);

    this.updateNameAndHealthSprite();
  }

  public updateNameAndHealthSprite(): void {
    const ctx = this.spriteCtx;
    if (!ctx) return;

    const w = 320;
    const h = 110;
    ctx.clearRect(0, 0, w, h);

    // 1. Dark glowing background container
    ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
    ctx.strokeStyle = this.team === 'blue' ? 'rgba(56, 189, 248, 0.85)' : 'rgba(249, 115, 22, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 12);
    ctx.fill();
    ctx.stroke();

    // 2. Team Badge & Name
    ctx.fillStyle = this.team === 'blue' ? '#38bdf8' : '#fb923c';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tag = this.team === 'blue' ? '[BLUE]' : '[RED]';
    ctx.fillText(`${tag} ${this.name}`, w / 2, 16);

    // 3. Health Bar Background Track
    const barX = 24;
    const barY = 46;
    const barW = w - 48;
    const barH = 18;

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();

    // 4. Health Bar Fill
    const hpRatio = Math.max(0, Math.min(1, this.health / this.maxHealth));
    const currentBarW = Math.max(this.health > 0 ? 6 : 0, barW * hpRatio);

    if (hpRatio > 0.5) {
      ctx.fillStyle = '#22c55e'; // Green
    } else if (hpRatio > 0.25) {
      ctx.fillStyle = '#f59e0b'; // Amber / Yellow
    } else {
      ctx.fillStyle = '#ef4444'; // Red
    }

    if (currentBarW > 0) {
      ctx.beginPath();
      ctx.roundRect(barX, barY, currentBarW, barH, 6);
      ctx.fill();
    }

    // 5. HP Text inside bar
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(`HP ${Math.ceil(this.health)} / ${this.maxHealth}`, w / 2, barY + barH / 2);
    ctx.shadowBlur = 0;

    // 6. Armor Bar (if any armor remaining)
    if (this.armor > 0) {
      const armY = 72;
      const armH = 8;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(barX, armY, barW, armH, 4);
      ctx.fill();

      const armRatio = Math.max(0, Math.min(1, this.armor / 100));
      ctx.fillStyle = '#00d2ff';
      ctx.beginPath();
      ctx.roundRect(barX, armY, barW * armRatio, armH, 4);
      ctx.fill();
    }

    this.spriteTexture.needsUpdate = true;
  }

  public takeHit(dmg: number, isHeadshot: boolean): void {
    this.health = Math.max(0, this.health - dmg);
    this.hitFlashTimer = 0.18;
    this.flinchAmount = 0.25;

    // Flash body parts red
    for (const part of this.bodyParts) {
      const mat = part.material as THREE.MeshLambertMaterial;
      if (mat && mat.emissive) {
        mat.emissive.setHex(0xff0000);
      }
    }

    this.updateNameAndHealthSprite();
  }

  public update(delta: number): void {
    if (!this.isAlive) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    // Smooth position interpolation
    this.position.lerp(this.targetPosition, 0.35);
    this.mesh.position.copy(this.position);

    // Smooth rotation interpolation
    let diff = this.targetRotationY - this.mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.mesh.rotation.y += diff * 0.25;

    // Hit flash timer countdown
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      if (this.hitFlashTimer <= 0) {
        for (const part of this.bodyParts) {
          const mat = part.material as THREE.MeshLambertMaterial;
          if (mat && mat.emissive) {
            mat.emissive.setHex(0x000000);
          }
        }
      }
    }

    // Flinch reaction decay
    if (this.flinchAmount > 0) {
      this.flinchAmount = THREE.MathUtils.lerp(this.flinchAmount, 0, delta * 8);
      this.torsoMesh.rotation.x = -this.flinchAmount;
    } else {
      this.torsoMesh.rotation.x = 0;
    }

    // Walking animation if moving
    const isMoving = this.position.distanceTo(this.targetPosition) > 0.05;
    if (isMoving) {
      this.animTimer += delta * 10;
      this.leftLeg.rotation.x = Math.sin(this.animTimer) * 0.6;
      this.rightLeg.rotation.x = -Math.sin(this.animTimer) * 0.6;
      this.leftArm.rotation.x = -Math.sin(this.animTimer) * 0.4;
    } else {
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
    }
  }
}

export class RemotePlayerManager {
  private scene: THREE.Scene;
  private sound: SoundSynthesizer;
  private particles: ParticleManager;
  private roomManager: RoomManager;

  public peers: Map<number, RemotePlayer> = new Map();
  public localPlayer: PlayerController | null = null;
  private syncTimer: number = 0;

  constructor(
    scene: THREE.Scene,
    sound: SoundSynthesizer,
    particles: ParticleManager,
    roomManager: RoomManager
  ) {
    this.scene = scene;
    this.sound = sound;
    this.particles = particles;
    this.roomManager = roomManager;

    this.roomManager.onRemotePlayerUpdate = (data: any) => {
      this.handlePeerMessage(data);
    };
  }

  public getAliveOpponentCount(myTeam: 'blue' | 'red'): number {
    const enemyTeam = myTeam === 'blue' ? 'red' : 'blue';
    let count = 0;
    for (const [, peer] of this.peers) {
      if (peer.team === enemyTeam && peer.isAlive) {
        count++;
      }
    }
    return count;
  }

  public getOrCreatePeer(slotId: number, name: string, team: 'blue' | 'red'): RemotePlayer {
    let peer = this.peers.get(slotId);
    if (!peer) {
      peer = new RemotePlayer(slotId, name, team);
      this.scene.add(peer.mesh);
      this.peers.set(slotId, peer);
    }
    return peer;
  }

  public removePeer(slotId: number): void {
    const peer = this.peers.get(slotId);
    if (peer) {
      this.scene.remove(peer.mesh);
      this.peers.delete(slotId);
    }
  }

  public clear(): void {
    for (const [, peer] of this.peers) {
      this.scene.remove(peer.mesh);
    }
    this.peers.clear();
  }

  private handlePeerMessage(data: any): void {
    if (data.type === 'PLAYER_STATE') {
      const state = data as RemotePlayerState;
      if (state.slotId === this.roomManager.localPlayerSlot) return; // Ignore own echoes

      const peer = this.getOrCreatePeer(state.slotId, state.name || 'Friend (Online)', state.team);
      peer.targetPosition.set(state.position.x, state.position.y, state.position.z);
      peer.targetRotationY = state.rotationY;

      const hpChanged = (peer.health !== state.health || peer.armor !== state.armor || peer.isAlive !== state.isAlive);
      peer.health = state.health;
      peer.armor = state.armor;
      peer.isAlive = state.isAlive;

      if (hpChanged) {
        peer.updateNameAndHealthSprite();
      }

      if (state.isShooting) {
        this.sound.playGunshot('rifle');
        const muzzlePos = peer.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.rotationY);
        const targetPos = muzzlePos.clone().add(forward.multiplyScalar(25));
        this.particles.createBulletTracer(muzzlePos, targetPos, 120);
      }
    } else if (data.type === 'DAMAGE_EVENT') {
      // Check if this damage event was targeted at the local player
      if (data.targetSlot === this.roomManager.localPlayerSlot && this.localPlayer) {
        this.localPlayer.applyDamage(data.damage, data.isHeadshot);

        // If damage proved fatal to local player, broadcast elimination
        if (this.localPlayer.vitals.health <= 0) {
          const myTeam = this.roomManager.isHost ? 'blue' : this.roomManager.preferredTeam;
          const enemyTeam = myTeam === 'blue' ? 'red' : 'blue';
          this.roomManager.sendNetworkMessage({
            type: 'PLAYER_ELIMINATED',
            slotId: this.roomManager.localPlayerSlot,
            killerTeam: enemyTeam
          });
        }
      }
    } else if (data.type === 'PLAYER_ELIMINATED') {
      const peer = this.peers.get(data.slotId);
      if (peer) {
        peer.isAlive = false;
        peer.mesh.visible = false;
        peer.health = 0;
        peer.updateNameAndHealthSprite();
      }
      this.roomManager.registerKill(data.killerTeam);
    }
  }

  public update(delta: number, localPlayer: PlayerController): void {
    // 1. Update all remote peer visual meshes
    for (const [, peer] of this.peers) {
      peer.update(delta);
    }

    // 2. Broadcast local player state at 20Hz (every 50ms)
    if (this.roomManager.currentRoom) {
      this.syncTimer += delta;
      if (this.syncTimer >= 0.05) {
        this.syncTimer = 0;

        const myTeam = this.roomManager.isHost ? 'blue' : this.roomManager.preferredTeam;
        const myName = this.roomManager.isHost ? 'Player 1 (Host)' : 'Player 2 (Friend)';
        const activeWeapon = localPlayer.getActiveWeapon();

        this.roomManager.sendNetworkMessage({
          type: 'PLAYER_STATE',
          slotId: this.roomManager.localPlayerSlot,
          name: myName,
          team: myTeam,
          position: {
            x: localPlayer.position.x,
            y: localPlayer.position.y,
            z: localPlayer.position.z
          },
          rotationY: localPlayer.yaw,
          health: localPlayer.vitals.health,
          armor: localPlayer.vitals.armor,
          weaponId: activeWeapon?.id || 'm416',
          isShooting: localPlayer.isShooting,
          isAlive: localPlayer.vitals.health > 0
        });
      }
    }
  }

  /**
   * Raycasts local player bullet against remote peers with generous hitbox
   */
  public checkHitAgainstPeers(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    weapon: WeaponConfig,
    localPlayer: PlayerController
  ): boolean {
    const ray = new THREE.Ray(origin, dir);
    const myTeam = this.roomManager.isHost ? 'blue' : this.roomManager.preferredTeam;

    let closestPeer: RemotePlayer | null = null;
    let closestDist: number = weapon.range;
    let isHeadshot: boolean = false;
    let hitLocation: THREE.Vector3 = new THREE.Vector3();

    for (const [, peer] of this.peers) {
      if (!peer.isAlive || peer.team === myTeam) continue; // No friendly fire

      // Generous hitbox padding to ensure reliable hit registration with network jitter
      const box = new THREE.Box3(
        peer.position.clone().add(new THREE.Vector3(-0.65, -0.2, -0.65)),
        peer.position.clone().add(new THREE.Vector3(0.65, 2.1, 0.65))
      );

      const hitPoint = new THREE.Vector3();
      if (ray.intersectBox(box, hitPoint)) {
        const dist = origin.distanceTo(hitPoint);
        if (dist < closestDist) {
          closestDist = dist;
          closestPeer = peer;
          hitLocation.copy(hitPoint);
          isHeadshot = (hitPoint.y - peer.position.y) >= 1.35;
        }
      }
    }

    if (closestPeer) {
      // 1. Play hitmarker sound
      this.sound.playHitmarker(isHeadshot);

      // 2. 2D HUD Crosshair Hitmarker
      const hmEl = document.getElementById('hitmarker');
      if (hmEl) {
        hmEl.className = `hitmarker active ${isHeadshot ? 'headshot' : ''}`;
        setTimeout(() => { hmEl.className = 'hitmarker hidden'; }, 140);
      }

      // 3. Blood splatter particles at exact impact point
      this.particles.spawnBlood(hitLocation);

      // 4. Calculate damage
      const multiplier = isHeadshot ? weapon.headshotMultiplier : 1.0;
      const dmg = weapon.damage * multiplier;

      // 5. Remote peer mesh damage reaction: red flash + flinch + overhead health bar update
      closestPeer.takeHit(dmg, isHeadshot);

      // 6. Floating 3D damage numbers
      this.particles.spawnDamageNumber(
        dmg,
        closestPeer.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
        localPlayer.camera,
        isHeadshot
      );

      // 7. Check if fatal
      if (closestPeer.health <= 0) {
        closestPeer.isAlive = false;
        closestPeer.mesh.visible = false;
        const myTeam = this.roomManager.isHost ? 'blue' : this.roomManager.preferredTeam;
        this.roomManager.registerKill(myTeam);

        this.roomManager.sendNetworkMessage({
          type: 'PLAYER_ELIMINATED',
          slotId: closestPeer.slotId,
          killerTeam: myTeam
        });
      }

      // 8. Send damage event to remote player
      this.roomManager.sendNetworkMessage({
        type: 'DAMAGE_EVENT',
        targetSlot: closestPeer.slotId,
        damage: dmg,
        isHeadshot
      });

      return true;
    }

    return false;
  }
}
