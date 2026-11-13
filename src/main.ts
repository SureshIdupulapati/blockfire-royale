import * as THREE from 'three';
import { GameState, GameMode, RoomConfig } from './types';
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
import { RoomManager } from './network/RoomManager';
import { RemotePlayerManager } from './network/RemotePlayerManager';

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
  private roomManager: RoomManager;
  private remotePlayerManager: RemotePlayerManager;

  private gameState: GameState = GameState.LOBBY;
  private selectedMode: GameMode = GameMode.BATTLE_ROYALE;
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
    this.scene.background = new THREE.Color(0x7dd3fc);
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
    this.roomManager = new RoomManager();

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

    this.remotePlayerManager = new RemotePlayerManager(
      this.scene,
      this.sound,
      this.particles,
      this.roomManager
    );

    // Register weapon check for remote players too
    const baseWeaponFired = this.player.onWeaponFired;
    this.player.onWeaponFired = (origin, dir, weapon) => {
      baseWeaponFired(origin, dir, weapon);
      this.remotePlayerManager.checkHitAgainstPeers(origin, dir, weapon, this.player);
    };

    // 8. Initialize UI Overlay & Room Handlers
    this.uiManager = new UIManager(this.player, this.zoneManager, this.botManager);
    this.setupRoomHandlers();

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

  private setupRoomHandlers(): void {
    this.roomManager.onRoomUpdated = (room: RoomConfig) => {
      this.renderRoomSlots(room);
    };

    this.roomManager.onScoreUpdated = (blue: number, red: number) => {
      const bEl = document.getElementById('blue-score');
      const rEl = document.getElementById('red-score');
      if (bEl) bEl.innerText = `${blue}`;
      if (rEl) rEl.innerText = `${red}`;
    };

    this.roomManager.onStartMatch = (mode: GameMode) => {
      this.selectedMode = mode;
      this.startMatch();
    };

    const copyLanBtn = document.getElementById('btn-copy-lan');
    const copyWanBtn = document.getElementById('btn-copy-wan');

    if (copyLanBtn) {
      copyLanBtn.addEventListener('click', () => {
        const link = this.roomManager.getLocalNetworkLink();
        navigator.clipboard.writeText(link).then(() => {
          copyLanBtn.innerText = '✅ WI-FI LINK COPIED!';
          setTimeout(() => {
            copyLanBtn.innerText = '📋 COPY WI-FI LINK';
          }, 2000);
        });
      });
    }

    if (copyWanBtn) {
      copyWanBtn.addEventListener('click', () => {
        const link = this.roomManager.getPublicInternetLink();
        navigator.clipboard.writeText(link).then(() => {
          copyWanBtn.innerText = '✅ INTERNET LINK COPIED!';
          setTimeout(() => {
            copyWanBtn.innerText = '📋 COPY INTERNET LINK';
          }, 2000);
        });
      });
    }
  }

  private renderRoomSlots(room: RoomConfig): void {
    const codeEl = document.getElementById('room-code-display');
    if (codeEl) codeEl.innerText = room.roomId;

    const lanInput = document.getElementById('invite-lan-input') as HTMLInputElement | null;
    const wanInput = document.getElementById('invite-wan-input') as HTMLInputElement | null;
    if (lanInput) lanInput.value = this.roomManager.getLocalNetworkLink();
    if (wanInput) wanInput.value = this.roomManager.getPublicInternetLink();

    const blueContainer = document.getElementById('blue-slots');
    const redContainer = document.getElementById('red-slots');
    if (!blueContainer || !redContainer) return;

    blueContainer.innerHTML = '';
    redContainer.innerHTML = '';

    for (const slot of room.slots) {
      const row = document.createElement('div');
      row.className = 'rtc-slot-row';

      const info = document.createElement('div');
      info.className = 'slot-player-info';

      const badge = document.createElement('span');
      badge.className = `slot-badge ${slot.isHuman ? 'badge-human' : 'badge-bot'}`;
      badge.innerText = slot.isHuman ? 'HUMAN' : 'BOT';

      const name = document.createElement('span');
      name.innerText = slot.name;

      info.appendChild(badge);
      info.appendChild(name);
      row.appendChild(info);

      if (!slot.isHost) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn-slot-toggle';
        toggleBtn.innerText = slot.isHuman ? 'Switch to Bot' : 'Open for Human';
        toggleBtn.addEventListener('click', () => {
          this.roomManager.toggleSlotBot(slot.slotId);
        });
        row.appendChild(toggleBtn);
      }

      if (slot.team === 'blue') {
        blueContainer.appendChild(row);
      } else {
        redContainer.appendChild(row);
      }
    }
  }

  private setupMenuHandlers(): void {
    // Mode selector tabs
    const tabs = document.querySelectorAll('.mode-tab');
    const roomPanel = document.getElementById('room-panel');
    const startBtn = document.getElementById('btn-start');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const mode = tab.getAttribute('data-mode') as GameMode;
        this.selectedMode = mode;

        if (mode === GameMode.BATTLE_ROYALE) {
          if (roomPanel) roomPanel.classList.add('hidden');
          if (startBtn) startBtn.innerText = 'DEPLOY INTO BATTLE ROYALE';
        } else if (mode === GameMode.DUEL_1V1) {
          if (roomPanel) roomPanel.classList.remove('hidden');
          this.roomManager.createRoom(GameMode.DUEL_1V1);
          if (startBtn) startBtn.innerText = 'START 1v1 DUEL ARENA';
        } else if (mode === GameMode.CLASH_2V2) {
          if (roomPanel) roomPanel.classList.remove('hidden');
          this.roomManager.createRoom(GameMode.CLASH_2V2);
          if (startBtn) startBtn.innerText = 'START 2v2 SQUAD CLASH';
        }
      });
    });

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.sound.init();
        this.startMatch();
      });
    }

    const btnRestartWin = document.getElementById('btn-restart-win');
    if (btnRestartWin) {
      btnRestartWin.addEventListener('click', () => window.location.reload());
    }

    const btnRestartLose = document.getElementById('btn-restart-lose');
    if (btnRestartLose) {
      btnRestartLose.addEventListener('click', () => window.location.reload());
    }

    // Secret Code Join Handler
    const joinCodeInput = document.getElementById('join-code-input') as HTMLInputElement | null;
    const btnJoinCode = document.getElementById('btn-join-code');
    const joinFeedback = document.getElementById('join-feedback');

    const handleJoinByCode = () => {
      if (!joinCodeInput) return;
      const rawCode = joinCodeInput.value.trim();
      if (!rawCode) {
        if (joinFeedback) {
          joinFeedback.className = 'join-feedback error';
          joinFeedback.innerText = '⚠️ Please enter a room code (e.g. 6643 or ROOM-6643)';
          joinFeedback.classList.remove('hidden');
        }
        return;
      }

      let code = rawCode.toUpperCase();
      if (!code.startsWith('ROOM-')) {
        code = 'ROOM-' + code;
      }

      this.roomManager.joinRoom(code, GameMode.DUEL_1V1, 'red');

      if (joinFeedback) {
        joinFeedback.className = 'join-feedback success';
        joinFeedback.innerText = `✅ Joining ${code}...`;
        joinFeedback.classList.remove('hidden');
      }

      tabs.forEach(t => {
        if (t.getAttribute('data-mode') === GameMode.DUEL_1V1) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });
      if (roomPanel) roomPanel.classList.remove('hidden');
      if (startBtn) {
        startBtn.innerText = '🟢 READY IN ROOM (WAITING FOR HOST TO START)';
      }
    };

    if (btnJoinCode) {
      btnJoinCode.addEventListener('click', handleJoinByCode);
    }
    if (joinCodeInput) {
      joinCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleJoinByCode();
      });
    }

    // Automatic URL invite detector
    const hasInvite = this.roomManager.checkUrlForRoomInvite();
    if (hasInvite && this.roomManager.currentRoom) {
      const mode = this.roomManager.currentRoom.mode;
      this.selectedMode = mode;

      tabs.forEach(t => {
        if (t.getAttribute('data-mode') === mode) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });

      if (roomPanel) roomPanel.classList.remove('hidden');
      if (startBtn) {
        startBtn.innerText = '🟢 READY IN ROOM (WAITING FOR HOST TO START)';
      }

      if (joinFeedback) {
        joinFeedback.className = 'join-feedback success';
        joinFeedback.innerText = `✅ Joined Room ${this.roomManager.currentRoom.roomId} as Team Red!`;
        joinFeedback.classList.remove('hidden');
      }
    }
  }

  private startMatch(): void {
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.add('hidden');

    this.canvas.requestPointerLock();

    // Mode-specific initialization
    const clashScoreboard = document.getElementById('clash-scoreboard');
    const zoneBanner = document.getElementById('zone-banner');

    if (this.roomManager.isHost && this.roomManager.currentRoom) {
      this.roomManager.sendNetworkMessage({
        type: 'START_MATCH',
        mode: this.selectedMode
      });
    }

    const isRedTeam = !this.roomManager.isHost && this.roomManager.preferredTeam === 'red';

    if (this.selectedMode === GameMode.BATTLE_ROYALE) {
      if (clashScoreboard) clashScoreboard.classList.add('hidden');
      if (zoneBanner) zoneBanner.classList.remove('hidden');

      this.player.position.set(0, 48, 0);
      this.zoneManager.initPhase(0);
      this.botManager.spawnBots(GameMode.BATTLE_ROYALE);
    } else if (this.selectedMode === GameMode.DUEL_1V1) {
      if (clashScoreboard) clashScoreboard.classList.remove('hidden');
      if (zoneBanner) zoneBanner.classList.add('hidden');

      if (isRedTeam) {
        this.player.position.set(0, 48, 15);
        this.player.yaw = Math.PI;
        this.player.playerMesh.rotation.y = Math.PI;
      } else {
        this.player.position.set(0, 48, -15);
      }
      this.roomManager.resetScores();
      // Compact arena safe zone
      this.zoneManager.currentRadius = 40;
      this.zoneManager.targetRadius = 25;
      this.botManager.spawnBots(GameMode.DUEL_1V1, this.roomManager.currentRoom);
    } else if (this.selectedMode === GameMode.CLASH_2V2) {
      if (clashScoreboard) clashScoreboard.classList.remove('hidden');
      if (zoneBanner) zoneBanner.classList.add('hidden');

      if (isRedTeam) {
        this.player.position.set(0, 48, 20);
        this.player.yaw = Math.PI;
        this.player.playerMesh.rotation.y = Math.PI;
      } else {
        this.player.position.set(0, 48, -20);
      }
      this.roomManager.resetScores();
      this.zoneManager.currentRadius = 55;
      this.zoneManager.targetRadius = 30;
      this.botManager.spawnBots(GameMode.CLASH_2V2, this.roomManager.currentRoom);
    }

    this.player.isAirborne = true;
    this.player.isParachuteOpen = false;
    this.player.isThirdPerson = true;
    this.player.vitals.health = 100;
    this.player.vitals.armor = 100;

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

    if (this.selectedMode === GameMode.BATTLE_ROYALE) {
      this.zoneManager.update(delta);

      if (this.zoneManager.isOutsideZone(this.player.position)) {
        const zoneDmg = this.zoneManager.getCurrentDamagePerSecond() * delta;
        this.player.applyDamage(zoneDmg);
        if (Math.random() < delta * 1.5) {
          this.sound.playZoneWarning();
        }
      }

      this.airdropManager.update(delta);
    }

    this.botManager.update(delta, this.player);
    this.remotePlayerManager.update(delta, this.player);
    this.particles.update(delta);
    this.uiManager.update();

    this.checkMatchConditions();
  }

  private checkMatchConditions(): void {
    // Defeat
    if (this.player.vitals.health <= 0 && this.gameState !== GameState.DEFEAT) {
      this.gameState = GameState.DEFEAT;
      document.exitPointerLock();

      const rank = this.botManager.getAliveOpponentCount() + 1;
      this.uiManager.showDefeatScreen(
        rank,
        this.botManager.playerKills,
        this.botManager.totalDamageDealt,
        this.selectedMode === GameMode.BATTLE_ROYALE ? 'Enemy Combatant' : 'Team Red Rival'
      );
      return;
    }

    // Victory: All opponents eliminated!
    const opponentsLeft = this.botManager.getAliveOpponentCount();
    if (opponentsLeft === 0 && this.gameState !== GameState.VICTORY) {
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
