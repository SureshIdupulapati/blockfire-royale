import * as THREE from 'three';

export enum GameState {
  LOBBY = 'LOBBY',
  AIRBORNE = 'AIRBORNE',
  PLAYING = 'PLAYING',
  VICTORY = 'VICTORY',
  DEFEAT = 'DEFEAT'
}

export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  WOOD = 4,
  LEAVES = 5,
  BRICK = 6,
  SAND = 7,
  GLASS = 8,
  GLOO_ICE = 9,
  CRATE_METAL = 10,
  OBSIDIAN = 11
}

export enum WeaponCategory {
  MELEE = 'MELEE',
  ASSAULT_RIFLE = 'ASSAULT_RIFLE',
  SMG = 'SMG',
  SNIPER = 'SNIPER',
  SHOTGUN = 'SHOTGUN',
  CONSUMABLE = 'CONSUMABLE',
  TACTICAL = 'TACTICAL'
}

export enum AmmoType {
  NONE = 'NONE',
  AMMO_556 = '5.56mm',
  AMMO_762 = '7.62mm',
  AMMO_9MM = '9mm',
  AMMO_300 = '.300 Magnum',
  AMMO_12GA = '12 Gauge'
}

export interface WeaponConfig {
  id: string;
  name: string;
  category: WeaponCategory;
  damage: number;
  headshotMultiplier: number;
  fireRate: number; // rounds per second
  magazineSize: number;
  reserveAmmo: number;
  reloadTime: number; // seconds
  spread: number; // in radians
  recoilVertical: number;
  recoilHorizontal: number;
  range: number;
  ammoType: AmmoType;
  icon: string;
  isAutomatic: boolean;
  bulletSpeed: number; // for projectile visual
  soundType: 'rifle' | 'heavy_rifle' | 'smg' | 'sniper' | 'shotgun' | 'pickaxe' | 'gloo' | 'medkit';
}

export interface InventorySlot {
  weapon: WeaponConfig | null;
  currentAmmo: number;
  reserveAmmo: number;
}

export interface PlayerVitals {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  helmetTier: number;
  vestTier: number;
  woodCount: number;
  stoneCount: number;
  glooCount: number;
}

export interface RaycastHit {
  hit: boolean;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  blockPosition?: THREE.Vector3;
  blockType?: BlockType;
  targetEntity?: any;
}

export interface KillFeedEvent {
  killer: string;
  victim: string;
  weapon: string;
  isHeadshot: boolean;
  isPlayerKiller: boolean;
  isPlayerVictim: boolean;
  timestamp: number;
}

export interface MatchStats {
  kills: number;
  damageDealt: number;
  survivalTimeSeconds: number;
  blocksPlaced: number;
  blocksMined: number;
  rank: number;
  totalParticipants: number;
}
