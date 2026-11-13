import * as THREE from 'three';

export interface ZonePhase {
  phaseNumber: number;
  radius: number;
  waitTime: number; // seconds to wait before shrinking starts
  shrinkTime: number; // seconds taken to contract to this radius
  damagePerSec: number;
}

export class ZoneManager {
  public scene: THREE.Scene;
  public currentCenter: THREE.Vector2 = new THREE.Vector2(0, 0);
  public currentRadius: number = 75;

  public targetCenter: THREE.Vector2 = new THREE.Vector2(0, 0);
  public targetRadius: number = 50;

  public previousCenter: THREE.Vector2 = new THREE.Vector2(0, 0);
  public previousRadius: number = 75;

  public phaseIndex: number = 0;
  public phaseTimer: number = 0;
  public isShrinking: boolean = false;
  public isCompleted: boolean = false;

  private zoneMesh: THREE.Mesh;
  private zoneMaterial: THREE.MeshBasicMaterial;

  public readonly phases: ZonePhase[] = [
    { phaseNumber: 1, radius: 55, waitTime: 45, shrinkTime: 30, damagePerSec: 2 },
    { phaseNumber: 2, radius: 35, waitTime: 35, shrinkTime: 25, damagePerSec: 5 },
    { phaseNumber: 3, radius: 20, waitTime: 25, shrinkTime: 20, damagePerSec: 10 },
    { phaseNumber: 4, radius: 8,  waitTime: 15, shrinkTime: 15, damagePerSec: 20 },
    { phaseNumber: 5, radius: 0,  waitTime: 10, shrinkTime: 15, damagePerSec: 35 }
  ];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create 3D Electric Blue Zone Cylinder
    const cylinderGeo = new THREE.CylinderGeometry(1, 1, 60, 48, 1, true);
    this.zoneMaterial = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      wireframe: false,
      depthWrite: false
    });

    this.zoneMesh = new THREE.Mesh(cylinderGeo, this.zoneMaterial);
    this.zoneMesh.position.set(0, 15, 0);
    this.scene.add(this.zoneMesh);

    this.initPhase(0);
  }

  public initPhase(index: number): void {
    if (index >= this.phases.length) {
      this.isCompleted = true;
      return;
    }

    this.phaseIndex = index;
    const currentConfig = this.phases[index];

    this.previousCenter.copy(this.currentCenter);
    this.previousRadius = this.currentRadius;

    // Pick target center inside previous circle
    if (index === 0) {
      this.targetCenter.set(0, 0);
      this.targetRadius = currentConfig.radius;
    } else {
      const maxOffset = Math.max(0, this.previousRadius - currentConfig.radius);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * maxOffset * 0.8;

      this.targetCenter.set(
        this.previousCenter.x + Math.cos(angle) * dist,
        this.previousCenter.y + Math.sin(angle) * dist
      );
      this.targetRadius = currentConfig.radius;
    }

    this.isShrinking = false;
    this.phaseTimer = currentConfig.waitTime;
  }

  public update(delta: number): void {
    if (this.isCompleted) return;

    this.phaseTimer -= delta;

    if (!this.isShrinking) {
      // Waiting phase
      if (this.phaseTimer <= 0) {
        this.isShrinking = true;
        this.phaseTimer = this.phases[this.phaseIndex].shrinkTime;
      }
    } else {
      // Shrinking phase
      const currentConfig = this.phases[this.phaseIndex];
      const shrinkProgress = 1.0 - Math.max(0, this.phaseTimer) / currentConfig.shrinkTime;

      this.currentRadius = THREE.MathUtils.lerp(this.previousRadius, this.targetRadius, shrinkProgress);
      this.currentCenter.lerpVectors(this.previousCenter, this.targetCenter, shrinkProgress);

      if (this.phaseTimer <= 0) {
        // Phase complete -> Advance to next
        this.currentRadius = this.targetRadius;
        this.currentCenter.copy(this.targetCenter);
        this.initPhase(this.phaseIndex + 1);
      }
    }

    // Update 3D visual cylinder
    this.zoneMesh.position.set(this.currentCenter.x, 15, this.currentCenter.y);
    this.zoneMesh.scale.set(this.currentRadius, 1, this.currentRadius);

    // Pulse opacity
    const pulse = Math.sin(Date.now() * 0.005) * 0.1;
    this.zoneMaterial.opacity = 0.3 + pulse;
  }

  /**
   * Checks if a 3D position is outside the safe zone
   */
  public isOutsideZone(pos: THREE.Vector3): boolean {
    const dx = pos.x - this.currentCenter.x;
    const dz = pos.z - this.currentCenter.y;
    const distSq = dx * dx + dz * dz;
    return distSq > this.currentRadius * this.currentRadius;
  }

  /**
   * Calculates zone damage per second
   */
  public getCurrentDamagePerSecond(): number {
    if (this.phaseIndex < this.phases.length) {
      return this.phases[this.phaseIndex].damagePerSec;
    }
    return 40;
  }
}
