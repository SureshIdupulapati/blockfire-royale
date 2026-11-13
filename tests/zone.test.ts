import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ZoneManager } from '../src/zone/ZoneManager';

describe('PUBG Safe Zone System', () => {
  it('should initialize with starting radius and phases', () => {
    const scene = new THREE.Scene();
    const zone = new ZoneManager(scene);

    expect(zone.phases.length).toBeGreaterThanOrEqual(4);
    expect(zone.phaseIndex).toBe(0);
    expect(zone.currentRadius).toBe(75);
    expect(zone.isShrinking).toBe(false);
  });

  it('should detect when coordinates are inside vs outside safe zone', () => {
    const scene = new THREE.Scene();
    const zone = new ZoneManager(scene);
    zone.currentCenter.set(0, 0);
    zone.currentRadius = 50;

    const insidePos = new THREE.Vector3(20, 10, 20); // dist ~28.3 < 50
    const outsidePos = new THREE.Vector3(60, 10, 0); // dist 60 > 50

    expect(zone.isOutsideZone(insidePos)).toBe(false);
    expect(zone.isOutsideZone(outsidePos)).toBe(true);
  });

  it('should scale damage-per-second with shrinking phases', () => {
    const scene = new THREE.Scene();
    const zone = new ZoneManager(scene);

    const dmgPhase1 = zone.getCurrentDamagePerSecond();
    zone.initPhase(1);
    const dmgPhase2 = zone.getCurrentDamagePerSecond();
    zone.initPhase(2);
    const dmgPhase3 = zone.getCurrentDamagePerSecond();

    expect(dmgPhase2).toBeGreaterThan(dmgPhase1);
    expect(dmgPhase3).toBeGreaterThan(dmgPhase2);
  });

  it('should transition to shrinking state when wait timer expires', () => {
    const scene = new THREE.Scene();
    const zone = new ZoneManager(scene);
    zone.phaseTimer = 2.0;
    zone.isShrinking = false;

    zone.update(3.0); // Elapsed 3s > 2s wait
    expect(zone.isShrinking).toBe(true);
  });
});
