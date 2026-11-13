import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { BotAI, BotState } from '../src/ai/BotAI';
import { VoxelWorld } from '../src/voxel/VoxelWorld';
import { CharacterSkills } from '../src/freefire/CharacterSkills';

describe('AI Bots & Free Fire Mechanics', () => {
  it('should initialize bot in parachuting state and transition to patrol on ground', () => {
    const world = new VoxelWorld();
    const soundMock: any = {
      playGunshot: vi.fn(),
      playHitmarker: vi.fn(),
      playGlooDeploy: vi.fn(),
      playSkillActivate: vi.fn()
    };
    const particlesMock: any = {
      spawnBlood: vi.fn(),
      spawnVoxelDebris: vi.fn(),
      createBulletTracer: vi.fn(),
      spawnDamageNumber: vi.fn(),
      spawnSonicPulse: vi.fn()
    };
    const glooMock: any = {
      deployGlooWall: vi.fn().mockReturnValue(true)
    };
    const zoneMock: any = {
      isOutsideZone: vi.fn().mockReturnValue(false),
      getCurrentDamagePerSecond: vi.fn().mockReturnValue(5)
    };

    const bot = new BotAI(
      'bot-1',
      'Bot_Test',
      new THREE.Vector3(0, 10, 0),
      world,
      soundMock,
      particlesMock,
      glooMock,
      zoneMock
    );

    expect(bot.state).toBe(BotState.PARACHUTING);
    expect(bot.health).toBe(100);

    // Simulate descent until ground touchdown
    bot.update(2.0, new THREE.Vector3(100, 0, 100), [], vi.fn());
    expect(bot.state).toBe(BotState.PATROL);
  });

  describe('CharacterSkills (Alok Drop the Beat)', () => {
    it('should activate healing aura and enforce cooldown', () => {
      const soundMock: any = { playSkillActivate: vi.fn() };
      const particlesMock: any = { spawnSonicPulse: vi.fn() };
      const skills = new CharacterSkills(soundMock, particlesMock);

      const activated = skills.activateSkill(new THREE.Vector3(0, 0, 0));
      expect(activated).toBe(true);
      expect(skills.isSkillActive).toBe(true);
      expect(skills.skillCooldownRemaining).toBeGreaterThan(0);

      // Cannot activate while on cooldown
      const reactivate = skills.activateSkill(new THREE.Vector3(0, 0, 0));
      expect(reactivate).toBe(false);

      // Accumulated heal test
      let healedAmount = 0;
      skills.update(1.0, new THREE.Vector3(0, 0, 0), (amt) => {
        healedAmount += amt;
      });
      expect(healedAmount).toBeCloseTo(5.0, 1);
    });
  });
});
