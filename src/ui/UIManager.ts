import * as THREE from 'three';
import { PlayerController } from '../player/PlayerController';
import { ZoneManager } from '../zone/ZoneManager';
import { BotManager } from '../ai/BotManager';
import { RemotePlayerManager } from '../network/RemotePlayerManager';
import { RoomManager } from '../network/RoomManager';
import { KillFeedEvent } from '../types';

export class UIManager {
  private player: PlayerController;
  private zoneManager: ZoneManager;
  private botManager: BotManager;
  private remotePlayerManager: RemotePlayerManager | null = null;
  private roomManager: RoomManager | null = null;

  // DOM Elements
  private compassStrip: HTMLElement | null;
  private compassDegree: HTMLElement | null;
  private zoneLabel: HTMLElement | null;
  private zoneTimer: HTMLElement | null;
  private zoneWarning: HTMLElement | null;
  private aliveCountEl: HTMLElement | null;
  private killCountEl: HTMLElement | null;
  private killFeedContainer: HTMLElement | null;
  private minimapCanvas: HTMLCanvasElement | null;
  private minimapCtx: CanvasRenderingContext2D | null;

  private hpBar: HTMLElement | null;
  private hpText: HTMLElement | null;
  private armorBar: HTMLElement | null;
  private armorText: HTMLElement | null;
  private resWood: HTMLElement | null;
  private resStone: HTMLElement | null;
  private resGloo: HTMLElement | null;
  private skillCooldownOverlay: HTMLElement | null;

  private weaponTitle: HTMLElement | null;
  private ammoCur: HTMLElement | null;
  private ammoReserve: HTMLElement | null;
  private reloadPrompt: HTMLElement | null;

  private altitudeBar: HTMLElement | null;
  private altitudeVal: HTMLElement | null;
  private airdropGauge: HTMLElement | null;

  // Screens
  private startScreen: HTMLElement | null;
  private booyahScreen: HTMLElement | null;
  private defeatScreen: HTMLElement | null;

  constructor(
    player: PlayerController,
    zoneManager: ZoneManager,
    botManager: BotManager,
    remotePlayerManager?: RemotePlayerManager,
    roomManager?: RoomManager
  ) {
    this.player = player;
    this.zoneManager = zoneManager;
    this.botManager = botManager;
    this.remotePlayerManager = remotePlayerManager || null;
    this.roomManager = roomManager || null;

    this.compassStrip = document.getElementById('compass-strip');
    this.compassDegree = document.getElementById('compass-degree');
    this.zoneLabel = document.getElementById('zone-status-label');
    this.zoneTimer = document.getElementById('zone-timer');
    this.zoneWarning = document.getElementById('zone-warning');
    this.aliveCountEl = document.getElementById('alive-count');
    this.killCountEl = document.getElementById('kill-count');
    this.killFeedContainer = document.getElementById('kill-feed');
    this.minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    this.hpBar = document.getElementById('hp-bar');
    this.hpText = document.getElementById('hp-text');
    this.armorBar = document.getElementById('armor-bar');
    this.armorText = document.getElementById('armor-text');
    this.resWood = document.getElementById('res-wood');
    this.resStone = document.getElementById('res-stone');
    this.resGloo = document.getElementById('res-gloo');
    this.skillCooldownOverlay = document.getElementById('skill-cooldown-overlay');

    this.weaponTitle = document.getElementById('weapon-title');
    this.ammoCur = document.getElementById('ammo-cur');
    this.ammoReserve = document.getElementById('ammo-reserve');
    this.reloadPrompt = document.getElementById('reload-prompt');

    this.altitudeBar = document.getElementById('altitude-bar');
    this.altitudeVal = document.getElementById('altitude-val');
    this.airdropGauge = document.getElementById('airdrop-gauge');

    this.startScreen = document.getElementById('start-screen');
    this.booyahScreen = document.getElementById('booyah-screen');
    this.defeatScreen = document.getElementById('defeat-screen');

    this.initCompass();
    this.setupBotListeners();
  }

  public setNetworkManagers(rpm: RemotePlayerManager, rm: RoomManager): void {
    this.remotePlayerManager = rpm;
    this.roomManager = rm;
  }

  private initCompass(): void {
    if (!this.compassStrip) return;
    this.compassStrip.innerHTML = '';

    // Create tick marks every 15 degrees from 0 to 360
    for (let deg = 0; deg < 360; deg += 15) {
      const mark = document.createElement('div');
      mark.style.position = 'absolute';
      mark.style.bottom = '0';
      mark.style.height = deg % 45 === 0 ? '16px' : '8px';
      mark.style.width = '1px';
      mark.style.background = deg % 45 === 0 ? '#00d2ff' : '#667788';

      let labelText = '';
      if (deg === 0) labelText = 'N';
      else if (deg === 45) labelText = 'NE';
      else if (deg === 90) labelText = 'E';
      else if (deg === 135) labelText = 'SE';
      else if (deg === 180) labelText = 'S';
      else if (deg === 225) labelText = 'SW';
      else if (deg === 270) labelText = 'W';
      else if (deg === 315) labelText = 'NW';

      if (labelText) {
        const span = document.createElement('span');
        span.innerText = labelText;
        span.style.position = 'absolute';
        span.style.top = '-14px';
        span.style.fontSize = '9px';
        span.style.fontWeight = '700';
        span.style.color = '#ffaa00';
        span.style.transform = 'translateX(-50%)';
        mark.appendChild(span);
      }

      this.compassStrip.appendChild(mark);
    }
  }

  private setupBotListeners(): void {
    this.botManager.onAliveCountChanged = (count: number) => {
      if (this.aliveCountEl) this.aliveCountEl.innerText = `${count}`;
    };

    this.botManager.onKillFeedEvent = (event: KillFeedEvent) => {
      this.addKillFeedEntry(event);
      if (this.killCountEl) this.killCountEl.innerText = `${this.botManager.playerKills}`;
    };
  }

  public addKillFeedEntry(event: KillFeedEvent): void {
    if (!this.killFeedContainer) return;

    const entry = document.createElement('div');
    entry.className = `kill-feed-entry ${event.isPlayerKiller ? 'player-kill' : ''}`;
    entry.innerHTML = `
      <span class="killer">${event.killer}</span>
      <span class="weapon">[${event.weapon}${event.isHeadshot ? ' 🎯' : ''}]</span>
      <span class="victim">${event.victim}</span>
    `;

    this.killFeedContainer.prepend(entry);

    setTimeout(() => {
      if (entry.parentNode) {
        entry.parentNode.removeChild(entry);
      }
    }, 4500);
  }

  public update(): void {
    this.updateCompass();
    this.updateZoneUI();
    this.updateVitals();
    this.updateWeaponUI();
    this.updateHotbar();
    this.updateMinimap();
    this.updateAirborneGauge();
  }

  private updateCompass(): void {
    // Convert yaw in radians to 0-360 degrees
    let deg = Math.round((-this.player.yaw * (180 / Math.PI)) % 360);
    if (deg < 0) deg += 360;

    let dirText = 'N';
    if (deg >= 337.5 || deg < 22.5) dirText = 'N';
    else if (deg >= 22.5 && deg < 67.5) dirText = 'NE';
    else if (deg >= 67.5 && deg < 112.5) dirText = 'E';
    else if (deg >= 112.5 && deg < 157.5) dirText = 'SE';
    else if (deg >= 157.5 && deg < 202.5) dirText = 'S';
    else if (deg >= 202.5 && deg < 247.5) dirText = 'SW';
    else if (deg >= 247.5 && deg < 292.5) dirText = 'W';
    else if (deg >= 292.5 && deg < 337.5) dirText = 'NW';

    if (this.compassDegree) {
      this.compassDegree.innerText = `${deg}° ${dirText}`;
    }
  }

  private updateZoneUI(): void {
    if (this.zoneTimer) {
      const mins = Math.floor(Math.max(0, this.zoneManager.phaseTimer) / 60);
      const secs = Math.floor(Math.max(0, this.zoneManager.phaseTimer) % 60);
      this.zoneTimer.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    if (this.zoneLabel) {
      this.zoneLabel.innerText = this.zoneManager.isShrinking
        ? 'SAFE ZONE SHRINKING'
        : `SAFE ZONE PHASE ${this.zoneManager.phaseIndex + 1}`;
    }

    const isOutside = this.zoneManager.isOutsideZone(this.player.position);
    if (this.zoneWarning) {
      this.zoneWarning.className = isOutside ? 'zone-warning' : 'zone-warning hidden';
    }
  }

  private updateVitals(): void {
    const v = this.player.vitals;

    if (this.hpBar) {
      const pct = Math.max(0, Math.min(100, (v.health / v.maxHealth) * 100));
      this.hpBar.style.width = `${pct}%`;
    }
    if (this.hpText) {
      this.hpText.innerText = `${Math.ceil(v.health)} / ${v.maxHealth}`;
    }

    if (this.armorBar) {
      const pct = Math.max(0, Math.min(100, (v.armor / v.maxArmor) * 100));
      this.armorBar.style.width = `${pct}%`;
    }
    if (this.armorText) {
      this.armorText.innerText = `${Math.ceil(v.armor)} / ${v.maxArmor}`;
    }

    if (this.resWood) this.resWood.innerText = `${v.woodCount}`;
    if (this.resStone) this.resStone.innerText = `${v.stoneCount}`;
    if (this.resGloo) this.resGloo.innerText = `${v.glooCount}`;

    // Skill cooldown overlay
    if (this.skillCooldownOverlay) {
      const cdPct = this.player.skills.getCooldownPercent();
      this.skillCooldownOverlay.style.clipPath = `polygon(50% 50%, 50% 0, 100% 0, 100% ${cdPct * 100}%, 0 ${cdPct * 100}%, 0 0, 50% 0)`;
    }
  }

  private updateWeaponUI(): void {
    const slot = this.player.getActiveSlot();
    const weapon = slot.weapon;

    if (weapon) {
      if (this.weaponTitle) this.weaponTitle.innerText = weapon.name.toUpperCase();
      if (this.ammoCur) this.ammoCur.innerText = weapon.magazineSize > 0 ? `${slot.currentAmmo}` : '—';
      if (this.ammoReserve) this.ammoReserve.innerText = weapon.magazineSize > 0 ? `${slot.reserveAmmo}` : '∞';

      if (this.reloadPrompt) {
        this.reloadPrompt.className =
          slot.currentAmmo === 0 && slot.reserveAmmo > 0 && !this.player.isReloading
            ? 'reload-prompt'
            : 'reload-prompt hidden';
      }
    }
  }

  private updateHotbar(): void {
    const slots = document.querySelectorAll('.hotbar .slot');
    slots.forEach((el, idx) => {
      if (idx === this.player.activeSlotIndex) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  private updateMinimap(): void {
    if (!this.minimapCanvas || !this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const scale = 1.2; // 1 meter = 1.2 pixels

    ctx.clearRect(0, 0, w, h);

    // Island background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2;
    const px = this.player.position.x;
    const pz = this.player.position.z;

    // 1. Draw Safe Zone Target Circle (White dotted)
    const targetScreenX = centerX + (this.zoneManager.targetCenter.x - px) * scale;
    const targetScreenY = centerY + (this.zoneManager.targetCenter.y - pz) * scale;
    const targetScreenR = this.zoneManager.targetRadius * scale;

    ctx.beginPath();
    ctx.arc(targetScreenX, targetScreenY, Math.max(1, targetScreenR), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Draw Current Electric Blue Zone Circle
    const currentScreenX = centerX + (this.zoneManager.currentCenter.x - px) * scale;
    const currentScreenY = centerY + (this.zoneManager.currentCenter.y - pz) * scale;
    const currentScreenR = this.zoneManager.currentRadius * scale;

    ctx.beginPath();
    ctx.arc(currentScreenX, currentScreenY, Math.max(1, currentScreenR), 0, Math.PI * 2);
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3. Draw Enemy Bot Radar Dots (if within 45m)
    for (const bot of this.botManager.bots) {
      if (!bot.isAlive) continue;
      const bx = centerX + (bot.position.x - px) * scale;
      const bz = centerY + (bot.position.z - pz) * scale;

      if (bx >= 0 && bx <= w && bz >= 0 && bz <= h) {
        ctx.beginPath();
        ctx.arc(bx, bz, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4500';
        ctx.fill();
      }
    }

    // 3b. Draw Remote Human Players (Opponents & Squad Mates)
    if (this.remotePlayerManager && this.remotePlayerManager.peers.size > 0) {
      const myTeam = this.roomManager?.isHost ? 'blue' : (this.roomManager?.preferredTeam || 'blue');
      const maxRadarRadius = (w / 2) - 8;

      for (const [, peer] of this.remotePlayerManager.peers) {
        if (!peer.isAlive) continue;

        const isEnemy = peer.team !== myTeam;
        const dx = (peer.position.x - px) * scale;
        const dz = (peer.position.z - pz) * scale;
        const dist = Math.hypot(dx, dz);

        let drawX = centerX + dx;
        let drawY = centerY + dz;
        const isClamped = dist > maxRadarRadius;

        if (isClamped) {
          // Clamp to radar perimeter with directional angle
          const angle = Math.atan2(dz, dx);
          drawX = centerX + Math.cos(angle) * maxRadarRadius;
          drawY = centerY + Math.sin(angle) * maxRadarRadius;
        }

        ctx.save();
        if (isEnemy) {
          const pulse = (Math.sin(Date.now() * 0.009) + 1) * 0.5;

          // Outer glowing warning halo
          ctx.beginPath();
          ctx.arc(drawX, drawY, 6 + pulse * 3.5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.45})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Center solid red dot
          ctx.beginPath();
          ctx.arc(drawX, drawY, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();

          // If clamped to edge, draw outward pointer triangle so player knows opponent location
          if (isClamped) {
            const angle = Math.atan2(dz, dx);
            ctx.translate(drawX, drawY);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(-3, -3.5);
            ctx.lineTo(-3, 3.5);
            ctx.closePath();
            ctx.fillStyle = '#ff2222';
            ctx.fill();
          }
        } else {
          // Friendly teammate: cyan blip with white ring
          ctx.beginPath();
          ctx.arc(drawX, drawY, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#00d2ff';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 4. Draw Player Indicator (Yellow triangle pointing in view direction)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-this.player.yaw);

    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fillStyle = '#ffaa00';
    ctx.fill();
    ctx.restore();
  }

  private updateAirborneGauge(): void {
    if (!this.airdropGauge || !this.altitudeBar || !this.altitudeVal) return;

    if (this.player.isAirborne) {
      this.airdropGauge.classList.remove('hidden');
      const pct = Math.min(100, (this.player.altitude / 55) * 100);
      this.altitudeBar.style.width = `${pct}%`;
      this.altitudeVal.innerText = `${this.player.altitude}m`;
    } else {
      this.airdropGauge.classList.add('hidden');
    }
  }

  public showBooyahScreen(kills: number, damage: number, timeStr: string, blocks: number): void {
    if (this.booyahScreen) {
      this.booyahScreen.classList.remove('hidden');
      const wk = document.getElementById('win-kills');
      const wd = document.getElementById('win-dmg');
      const wt = document.getElementById('win-time');
      const wb = document.getElementById('win-blocks');
      if (wk) wk.innerText = `${kills}`;
      if (wd) wd.innerText = `${Math.round(damage)}`;
      if (wt) wt.innerText = timeStr;
      if (wb) wb.innerText = `${blocks}`;
    }
  }

  public showDefeatScreen(rank: number, kills: number, damage: number, killer: string): void {
    if (this.defeatScreen) {
      this.defeatScreen.classList.remove('hidden');
      const dr = document.getElementById('defeat-rank');
      const lk = document.getElementById('lose-kills');
      const ld = document.getElementById('lose-dmg');
      const killerEl = document.getElementById('lose-killer');
      if (dr) dr.innerText = `RANK #${rank} / 15`;
      if (lk) lk.innerText = `${kills}`;
      if (ld) ld.innerText = `${Math.round(damage)}`;
      if (killerEl) killerEl.innerText = killer;
    }
  }
}

