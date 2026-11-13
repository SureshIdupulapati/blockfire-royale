import * as THREE from 'three';
import { BotAI } from './BotAI';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { ParticleManager } from '../combat/ParticleManager';
import { GlooWallManager } from '../freefire/GlooWallManager';
import { ZoneManager } from '../zone/ZoneManager';
import { PlayerController } from '../player/PlayerController';
import { WeaponConfig, KillFeedEvent } from '../types';

export class BotManager {
  private scene: THREE.Scene;
  private world: VoxelWorld;
  private sound: SoundSynthesizer;
  private particles: ParticleManager;
  private glooManager: GlooWallManager;
  private zoneManager: ZoneManager;

  public bots: BotAI[] = [];
  public totalParticipants: number = 15; // 1 player + 14 bots
  public aliveCount: number = 15;
  public playerKills: number = 0;
  public totalDamageDealt: number = 0;

  public onKillFeedEvent: (event: KillFeedEvent) => void = () => {};
  public onAliveCountChanged: (count: number) => void = () => {};

  private botNames: string[] = [
    'Bot_Ghost', 'Bot_Viper', 'Bot_Phantom', 'Bot_Hunter', 'Bot_Shadow',
    'Bot_Striker', 'Bot_Cobra', 'Bot_Apex', 'Bot_Nova', 'Bot_Blaze',
    'Bot_Raptor', 'Bot_Titan', 'Bot_Spectre', 'Bot_Vortex'
  ];

  constructor(
    scene: THREE.Scene,
    world: VoxelWorld,
    sound: SoundSynthesizer,
    particles: ParticleManager,
    glooManager: GlooWallManager,
    zoneManager: ZoneManager
  ) {
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.particles = particles;
    this.glooManager = glooManager;
    this.zoneManager = zoneManager;
  }

  public spawnBots(): void {
    this.bots = [];
    this.aliveCount = this.botNames.length + 1;

    for (let i = 0; i < this.botNames.length; i++) {
      const name = this.botNames[i];
      // Random coordinates across the island
      const angle = (i / this.botNames.length) * Math.PI * 2;
      const radius = 20 + Math.random() * 25;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const startPos = new THREE.Vector3(x, 45 + Math.random() * 10, z);

      const bot = new BotAI(
        `bot-${i}`,
        name,
        startPos,
        this.world,
        this.sound,
        this.particles,
        this.glooManager,
        this.zoneManager
      );

      this.scene.add(bot.mesh);
      this.bots.push(bot);
    }

    this.onAliveCountChanged(this.aliveCount);
  }

  public registerPlayerWeaponListener(player: PlayerController): void {
    player.onWeaponFired = (origin: THREE.Vector3, dir: THREE.Vector3, weapon: WeaponConfig) => {
      this.checkPlayerHitAgainstBots(player, origin, dir, weapon);
    };
  }

  private checkPlayerHitAgainstBots(
    player: PlayerController,
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    weapon: WeaponConfig
  ): void {
    const ray = new THREE.Ray(origin, dir);

    let closestBot: BotAI | null = null;
    let closestDist: number = weapon.range;
    let isHeadshotHit: boolean = false;

    for (const bot of this.bots) {
      if (!bot.isAlive) continue;

      // Body bounding box
      const bodyBox = new THREE.Box3(
        bot.position.clone().add(new THREE.Vector3(-0.4, 0, -0.4)),
        bot.position.clone().add(new THREE.Vector3(0.4, 1.8, 0.4))
      );

      const hitPoint = new THREE.Vector3();
      if (ray.intersectBox(bodyBox, hitPoint)) {
        const dist = origin.distanceTo(hitPoint);
        if (dist < closestDist) {
          closestDist = dist;
          closestBot = bot;
          // Check if hit was near head level (y > 1.3 relative to bot feet)
          isHeadshotHit = (hitPoint.y - bot.position.y) >= 1.35;
        }
      }
    }

    if (closestBot) {
      // Audio confirmation
      this.sound.playHitmarker(isHeadshotHit);

      // Trigger UI hitmarker
      const hmEl = document.getElementById('hitmarker');
      if (hmEl) {
        hmEl.className = `hitmarker active ${isHeadshotHit ? 'headshot' : ''}`;
        setTimeout(() => {
          hmEl.className = 'hitmarker hidden';
        }, 120);
      }

      const multiplier = isHeadshotHit ? weapon.headshotMultiplier : 1.0;
      const totalDamage = weapon.damage * multiplier;
      this.totalDamageDealt += totalDamage;

      // Floating damage number
      this.particles.spawnDamageNumber(
        totalDamage,
        closestBot.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
        player.camera,
        isHeadshotHit
      );

      closestBot.takeDamage(weapon.damage, player.position, isHeadshotHit, () => {
        // Bot killed by player!
        this.playerKills++;
        this.aliveCount = Math.max(1, this.aliveCount - 1);
        this.onAliveCountChanged(this.aliveCount);

        // Free Fire reward: instant Gloo Wall drop & Adrenaline shield refill!
        player.vitals.glooCount += 2;
        player.vitals.armor = Math.min(player.vitals.maxArmor, player.vitals.armor + 50);

        this.onKillFeedEvent({
          killer: 'Player',
          victim: closestBot.name,
          weapon: weapon.name,
          isHeadshot: isHeadshotHit,
          isPlayerKiller: true,
          isPlayerVictim: false,
          timestamp: Date.now()
        });
      });
    }
  }

  public update(delta: number, player: PlayerController): void {
    for (const bot of this.bots) {
      if (!bot.isAlive) continue;

      bot.update(delta, player.position, this.bots, (shooter, targetPos, isHeadshot) => {
        // If bot shoots at player
        if (shooter.currentCombatTarget && shooter.currentCombatTarget.isPlayer) {
          player.applyDamage(shooter.weapon.damage * (isHeadshot ? 1.5 : 1.0), isHeadshot);
          player.sound.playHitmarker(false);

          if (player.vitals.health <= 0) {
            this.onKillFeedEvent({
              killer: shooter.name,
              victim: 'Player',
              weapon: shooter.weapon.name,
              isHeadshot,
              isPlayerKiller: false,
              isPlayerVictim: true,
              timestamp: Date.now()
            });
          }
        } else if (shooter.currentCombatTarget && shooter.currentCombatTarget.entity) {
          // Bot shoots other bot
          const victimBot = shooter.currentCombatTarget.entity as BotAI;
          victimBot.takeDamage(shooter.weapon.damage, shooter.position, isHeadshot, () => {
            this.aliveCount = Math.max(1, this.aliveCount - 1);
            this.onAliveCountChanged(this.aliveCount);

            this.onKillFeedEvent({
              killer: shooter.name,
              victim: victimBot.name,
              weapon: shooter.weapon.name,
              isHeadshot,
              isPlayerKiller: false,
              isPlayerVictim: false,
              timestamp: Date.now()
            });
          });
        }
      });
    }
  }

  public getAliveBotCount(): number {
    return this.bots.filter(b => b.isAlive).length;
  }
}
