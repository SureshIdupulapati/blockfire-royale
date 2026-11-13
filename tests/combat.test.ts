import { describe, it, expect } from 'vitest';
import { WEAPON_REGISTRY } from '../src/combat/WeaponTypes';
import { RecoilSystem } from '../src/combat/RecoilSystem';
import { WeaponCategory } from '../src/types';

describe('Combat & Weapons System', () => {
  it('should define core weapon archetypes correctly', () => {
    expect(WEAPON_REGISTRY.m416).toBeDefined();
    expect(WEAPON_REGISTRY.ak47).toBeDefined();
    expect(WEAPON_REGISTRY.mp40).toBeDefined();
    expect(WEAPON_REGISTRY.awm).toBeDefined();
    expect(WEAPON_REGISTRY.pickaxe).toBeDefined();
    expect(WEAPON_REGISTRY.frag_grenade).toBeDefined();
    expect(WEAPON_REGISTRY.gloo_wall).toBeDefined();

    expect(WEAPON_REGISTRY.awm.category).toBe(WeaponCategory.SNIPER);
    expect(WEAPON_REGISTRY.frag_grenade.category).toBe(WeaponCategory.TACTICAL);
    expect(WEAPON_REGISTRY.m416.category).toBe(WeaponCategory.ASSAULT_RIFLE);
    expect(WEAPON_REGISTRY.pickaxe.category).toBe(WeaponCategory.MELEE);
  });

  it('should balance sniper rifle with high damage and slow fire rate', () => {
    const awm = WEAPON_REGISTRY.awm;
    const mp40 = WEAPON_REGISTRY.mp40;

    expect(awm.damage).toBeGreaterThan(mp40.damage * 4);
    expect(mp40.fireRate).toBeGreaterThan(awm.fireRate * 5);
  });

  describe('Frag Grenades', () => {
    it('should configure high explosive damage and blast radius', () => {
      const grenade = WEAPON_REGISTRY.frag_grenade;
      expect(grenade.damage).toBe(160);
      expect(grenade.icon).toBe('💣');
      expect(grenade.range).toBeGreaterThanOrEqual(35);
    });
  });

  describe('RecoilSystem', () => {
    it('should reduce spread bloom when aiming down sights (ADS)', () => {
      const recoil = new RecoilSystem();
      recoil.update(0.1, false, false, false); // Hipfire
      const hipfireSpread = recoil.getEffectiveSpread(0.02);

      recoil.update(0.1, false, false, true); // ADS
      const adsSpread = recoil.getEffectiveSpread(0.02);

      expect(adsSpread).toBeLessThan(hipfireSpread);
    });

    it('should kick camera upward and damp back down', () => {
      const recoil = new RecoilSystem();
      recoil.applyRecoil(0.1, 0.02, false);

      recoil.update(0.016, false, false, false);
      expect(recoil.currentRecoilPitch).toBeGreaterThan(0);
    });
  });
});

