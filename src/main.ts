import * as THREE from 'three';
import { GameState } from './types';
import { SoundSynthesizer } from './audio/SoundSynthesizer';
import { VoxelWorld } from './voxel/VoxelWorld';
import { ParticleManager } from './combat/ParticleManager';
import { GlooWallManager } from './freefire/GlooWallManager';
import { CharacterSkills } from './freefire/CharacterSkills';
import { GrenadeManager } from './combat/GrenadeManager';
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
  private grenadeManager: GrenadeManager;
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
    this.scene.background = new THREE.Color(0x7dd3fc); // Vivid tropical sky blue
    this.scene.fog = new THREE.FogExp2(0x93c5fd, 0.005);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 600);

    // 2. Setup Lighting
    this.setupLighting();

    // 3. Initialize Core Game Subsystems
    this.sound = new SoundSynthesizer();
    this.world = new VoxelWorld();
    this.particles = new ParticleManager(this.scene);
    this.glooManager = new GlooWallManager(this.world, this.sound, this.particles);
    this.skills = new CharacterSkills(this.sound, this.particles);
    this.grenadeManager = new GrenadeManager(this.scene, this.world, this.sound, this.particles);

    // 4. Generate Procedural Voxel Island
    this.world.generateTerrain();
    this.world.updateMeshes(this.scene);

    // 5. Add Ocean Water Basin (Spanning 800m across)
    const oceanGeo = new THREE.PlaneGeometry(800, 800);
    const oceanMat = new THREE.MeshLambertMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.75
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.position.y = 3.6;
    this.scene.add(oceanMesh);

    // 6. Initialize Battle Royale Systems
    this.zoneManager = new ZoneManager(this.scene);
    this.airdropManager = new AirDropManager(this.scene, this.world);

    // 7. Initialize Player & AI Bots
    this.player = new PlayerController(
      this.camera,
      this.scene,
      this.world,
      this.sound,
      this.particles,
      this.glooManager,
      this.skills,
      this.grenadeManager
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

    this.grenadeManager.setEntities(this.botManager, this.player);

    // 8. Initialize UI Overlay
    this.uiManager = new UIManager(this.player, this.zoneManager, this.botManager);

    // 9. Setup DOM & Window Events
    this.setupWindowEvents();
    this.setupMenuHandlers();

    // Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.25);
    sunLight.position.set(60, 120, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 300;
    const shadowD = 85;
    sunLight.shadow.camera.left = -shadowD;
    sunLight.shadow.camera.right = shadowD;
    sunLight.shadow.camera.top = shadowD;
    sunLight.shadow.camera.bottom = -shadowD;
    this.scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x0284c7, 0.45);
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

    // Drop safely directly over the Center Citadel of the island
    this.player.position.set(0, 48, 0);
    this.player.isAirborne = true;
    this.player.isParachuteOpen = false;
    this.player.isThirdPerson = true;
    this.player.vitals.health = 100;
    this.player.vitals.armor = 100;

    // Spawn 14 enemy bots across the island
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
    if (this.gameState === GameState.AIRBORNE && !this.player.isAirborne) {
      this.gameState = GameState.PLAYING;
    }

    this.player.update(delta);

    this.skills.update(delta, this.player.position, (amount) => {
      this.player.vitals.health = Math.min(
        this.player.vitals.maxHealth,
        this.player.vitals.health + amount
      );
    });

    this.world.updateMeshes(this.scene);
    this.glooManager.update(delta);
    this.grenadeManager.update(delta);
    this.zoneManager.update(delta);

    if (this.zoneManager.isOutsideZone(this.player.position)) {
      const zoneDmg = this.zoneManager.getCurrentDamagePerSecond() * delta;
      this.player.applyDamage(zoneDmg);
      if (Math.random() < delta * 1.5) {
        this.sound.playZoneWarning();
      }
    }

    this.airdropManager.update(delta);
    this.botManager.update(delta, this.player);
    this.particles.update(delta);
    this.uiManager.update();

    this.checkMatchConditions();
  }

  private checkMatchConditions(): void {
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

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
