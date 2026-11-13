import * as THREE from 'three';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { ParticleManager } from '../combat/ParticleManager';

export class CharacterSkills {
  private sound: SoundSynthesizer;
  private particles: ParticleManager;

  public skillCooldownMax: number = 35.0; // 35s cooldown
  public skillCooldownRemaining: number = 0;
  public isSkillActive: boolean = false;
  public skillActiveRemaining: number = 0;
  public readonly skillDuration: number = 10.0; // 10s active duration

  public healPerSecond: number = 5.0;
  public speedMultiplier: number = 1.25; // +25% sprint speed

  constructor(sound: SoundSynthesizer, particles: ParticleManager) {
    this.sound = sound;
    this.particles = particles;
  }

  /**
   * Activates Free Fire "Drop the Beat" active skill
   */
  public activateSkill(playerPos: THREE.Vector3): boolean {
    if (this.skillCooldownRemaining > 0 || this.isSkillActive) {
      return false;
    }

    this.isSkillActive = true;
    this.skillActiveRemaining = this.skillDuration;
    this.skillCooldownRemaining = this.skillCooldownMax;

    this.sound.playSkillActivate();
    this.particles.spawnSonicPulse(playerPos);

    return true;
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    onHeal: (amount: number) => void
  ): void {
    // Cooldown ticker
    if (this.skillCooldownRemaining > 0) {
      this.skillCooldownRemaining = Math.max(0, this.skillCooldownRemaining - delta);
    }

    // Active skill duration
    if (this.isSkillActive) {
      this.skillActiveRemaining -= delta;
      onHeal(this.healPerSecond * delta);

      // Sonic visual ring pulse every 0.6s
      if (Math.random() < delta * 1.8) {
        this.particles.spawnSonicPulse(playerPos);
      }

      if (this.skillActiveRemaining <= 0) {
        this.isSkillActive = false;
      }
    }
  }

  public getCooldownPercent(): number {
    return Math.min(1.0, this.skillCooldownRemaining / this.skillCooldownMax);
  }
}
