import * as THREE from 'three';
import { GameState } from './types';
import { SoundSynthesizer } from './audio/SoundSynthesizer';
import { VoxelWorld } from './voxel/VoxelWorld';
import { ParticleManager } from './combat/ParticleManager';
import { GlooWallManager } from './freefire/GlooWallManager';
import { CharacterSkills } from './freefire/CharacterSkills';
import { PlayerController } from './player/PlayerController';
import { ZoneManager } from './zone/ZoneManager';
import { AirDropManager } from './airdrop/AirDropManager';
import { BotManager } from './ai/BotManager';
import { UIManager } from './ui/UIManager';

class GameApp {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private sound: SoundSynthesizer;
  private world: VoxelWorld;
  private particles: ParticleManager;
  private glooManager: GlooWallManager;
  private skills: CharacterSkills;
  private player: PlayerController;
  private zoneManager: ZoneManager;
  private airdropManager: AirDropManager;
  private botManager: BotManager;
  private uiManager: UIManager;

  private gameState: GameState = GameState.LOBBY;
  private matchStartTime: number = 0;
  private lastTime: number = performance.now();
  private blocksPlacedCount: number = 0;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    // 1. Setup Three.js Renderer & Scene
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    this.scene.fog = new THREE.FogExp2(0xa0c4ff, 0.008);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

    // 2. Setup Lighting
    this.setupLighting();

    // 3. Initialize Core Game Subsystems
    this.sound = new SoundSynthesizer();
    this.world = new VoxelWorld();
    this.particles = new ParticleManager(this.scene);
    this.glooManager = new GlooWallManager(this.world, this.sound, this.particles);
    this.skills = new CharacterSkills(this.sound, this.particles);

    // 4. Generate Procedural Voxel Island
    this.world.generateTerrain();
    this.world.updateMeshes(this.scene);

    // 5. Initialize Battle Royale Systems
    this.zoneManager = new ZoneManager(this.scene);
    this.airdropManager = new AirDropManager(this.scene, this.world);

    // 6. Initialize Player & AI Bots
    this.player = new PlayerController(
      this.camera,
      this.scene,
      this.world,
      this.sound,
      this.particles,
      this.glooManager,
      this.skills
    );

    this.botManager = new BotManager(
      this.scene,
      this.world,
      this.sound,
      this.particles,
      this.glooManager,
      this.zoneManager
    );
    this.botManager.registerPlayerWeaponListener(this.player);

    // 7. Initialize UI Overlay
    this.uiManager = new UIManager(this.player, this.zoneManager, this.botManager);

    // 8. Setup DOM & Window Events
    this.setupWindowEvents();
    this.setupMenuHandlers();

    // Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    // Directional sunlight with shadows
    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    sunLight.position.set(50, 100, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 250;
    const shadowD = 60;
    sunLight.shadow.camera.left = -shadowD;
    sunLight.shadow.camera.right = shadowD;
    sunLight.shadow.camera.top = shadowD;
    sunLight.shadow.camera.bottom = -shadowD;
    this.scene.add(sunLight);

    // Hemispheric sky / ground bounce
    const hemiLight = new THREE.HemisphereLight(0xb1e1ff, 0x3b82f6, 0.4);
    this.scene.add(hemiLight);
  }

  private setupWindowEvents(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.canvas.addEventListener('click', () => {
      if (this.gameState === GameState.PLAYING || this.gameState === GameState.AIRBORNE) {
        if (document.pointerLockElement !== this.canvas) {
          this.canvas.requestPointerLock();
        }
      }
    });
  }

  private setupMenuHandlers(): void {
    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        this.sound.init();
        this.startMatch();
      });
    }

    const btnRestartWin = document.getElementById('btn-restart-win');
    if (btnRestartWin) {
      btnRestartWin.addEventListener('click', () => {
        window.location.reload();
      });
    }

    const btnRestartLose = document.getElementById('btn-restart-lose');
    if (btnRestartLose) {
      btnRestartLose.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }

  private startMatch(): void {
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.add('hidden');

    this.canvas.requestPointerLock();

    // Player drops from high altitude
    this.player.position.set(0, 55, 0);
    this.player.isAirborne = true;
    this.player.isParachuteOpen = false;
    this.player.vitals.health = 100;
    this.player.vitals.armor = 100;

    // Spawn 14 enemy bots
    this.botManager.spawnBots();

    this.gameState = GameState.AIRBORNE;
    this.matchStartTime = Date.now();
  }

  private animate(currentTime: number): void {
    requestAnimationFrame(this.animate);

    const delta = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (this.gameState === GameState.AIRBORNE || this.gameState === GameState.PLAYING) {
      this.updateGame(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updateGame(delta: number): void {
    // 1. Transition from AIRBORNE to PLAYING when player touches down
    if (this.gameState === GameState.AIRBORNE && !this.player.isAirborne) {
      this.gameState = GameState.PLAYING;
    }

    // 2. Update Player
    this.player.update(delta);

    // 3. Update Skills & Heals
    this.skills.update(delta, this.player.position, (amount) => {
      this.player.vitals.health = Math.min(
        this.player.vitals.maxHealth,
        this.player.vitals.health + amount
      );
    });

    // 4. Update Voxel Meshes if blocks were placed/destroyed
    this.world.updateMeshes(this.scene);

    // 5. Update Free Fire Gloo Walls
    this.glooManager.update(delta);

    // 6. Update PUBG Safe Zone
    this.zoneManager.update(delta);

    // Player Zone damage
    if (this.zoneManager.isOutsideZone(this.player.position)) {
      const zoneDmg = this.zoneManager.getCurrentDamagePerSecond() * delta;
      this.player.applyDamage(zoneDmg);
      if (Math.random() < delta * 1.5) {
        this.sound.playZoneWarning();
      }
    }

    // 7. Update PUBG AirDrops
    this.airdropManager.update(delta);

    // 8. Update Tactical Enemy Bots
    this.botManager.update(delta, this.player);

    // 9. Update Particles & Tracers
    this.particles.update(delta);

    // 10. Update HUD & Minimap
    this.uiManager.update();

    // 11. Check Victory / Defeat Conditions
    this.checkMatchConditions();
  }

  private checkMatchConditions(): void {
    // Defeat Condition: Player HP <= 0
    if (this.player.vitals.health <= 0 && this.gameState !== GameState.DEFEAT) {
      this.gameState = GameState.DEFEAT;
      document.exitPointerLock();

      const rank = this.botManager.getAliveBotCount() + 1;
      this.uiManager.showDefeatScreen(
        rank,
        this.botManager.playerKills,
        this.botManager.totalDamageDealt,
        'Enemy Combatant'
      );
      return;
    }

    // Victory Condition: All enemy bots eliminated!
    if (this.botManager.getAliveBotCount() === 0 && this.gameState !== GameState.VICTORY) {
      this.gameState = GameState.VICTORY;
      document.exitPointerLock();

      this.sound.playBooyahFanfare();

      const elapsedSecs = Math.floor((Date.now() - this.matchStartTime) / 1000);
      const mins = Math.floor(elapsedSecs / 60);
      const secs = elapsedSecs % 60;
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      this.uiManager.showBooyahScreen(
        this.botManager.playerKills,
        this.botManager.totalDamageDealt,
        timeStr,
        this.blocksPlacedCount
      );
    }
  }
}

// Bootstrap application on window load
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
