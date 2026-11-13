import * as THREE from 'three';

/**
 * Handles camera kick, spring damping recovery, and dynamic crosshair bloom.
 */
export class RecoilSystem {
  public currentRecoilPitch: number = 0;
  public currentRecoilYaw: number = 0;
  private targetRecoilPitch: number = 0;
  private targetRecoilYaw: number = 0;

  public spreadMultiplier: number = 1.0;
  public targetSpreadMultiplier: number = 1.0;

  private recoverySpeed: number = 12.0;
  private dampingFactor: number = 0.25;

  /**
   * Applies weapon kick on shot
   */
  public applyRecoil(verticalKick: number, horizontalKick: number, isADS: boolean = false): void {
    const adsFactor = isADS ? 0.5 : 1.0;
    const randomYaw = (Math.random() - 0.5) * 2 * horizontalKick * adsFactor;

    this.targetRecoilPitch += verticalKick * adsFactor;
    this.targetRecoilYaw += randomYaw;

    // Recoil bloom expansion
    this.targetSpreadMultiplier += isADS ? 0.4 : 0.8;
  }

  /**
   * Updates spring dampening recovery toward rest position
   */
  public update(delta: number, isMoving: boolean, isSprinting: boolean, isADS: boolean): void {
    // Determine baseline movement bloom
    let baseSpread = 1.0;
    if (isADS) {
      baseSpread = 0.35;
    } else if (isSprinting) {
      baseSpread = 2.2;
    } else if (isMoving) {
      baseSpread = 1.5;
    }

    this.targetSpreadMultiplier = THREE.MathUtils.lerp(
      this.targetSpreadMultiplier,
      baseSpread,
      delta * 8
    );

    this.spreadMultiplier = THREE.MathUtils.lerp(
      this.spreadMultiplier,
      this.targetSpreadMultiplier,
      delta * 12
    );

    // Spring recovery for camera recoil
    const pitchDelta = this.targetRecoilPitch * delta * this.recoverySpeed;
    const yawDelta = this.targetRecoilYaw * delta * this.recoverySpeed;

    this.currentRecoilPitch = pitchDelta;
    this.currentRecoilYaw = yawDelta;

    this.targetRecoilPitch = THREE.MathUtils.lerp(this.targetRecoilPitch, 0, delta * this.recoverySpeed * this.dampingFactor);
    this.targetRecoilYaw = THREE.MathUtils.lerp(this.targetRecoilYaw, 0, delta * this.recoverySpeed * this.dampingFactor);
  }

  public getEffectiveSpread(baseSpread: number): number {
    return baseSpread * this.spreadMultiplier;
  }
}

