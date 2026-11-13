import * as THREE from 'three';
import { VoxelWorld } from '../voxel/VoxelWorld';
import { BlockType } from '../types';

export interface AirDropCrate {
  mesh: THREE.Group;
  position: THREE.Vector3;
  targetY: number;
  isLanded: boolean;
  lootClaimed: boolean;
  smokeMesh: THREE.Mesh | null;
}

export class AirDropManager {
  private scene: THREE.Scene;
  private world: VoxelWorld;
  public crates: AirDropCrate[] = [];
  private dropTimer: number = 25; // First drop at 25s
  private dropInterval: number = 60; // Every 60s

  constructor(scene: THREE.Scene, world: VoxelWorld) {
    this.scene = scene;
    this.world = world;
  }

  public update(delta: number): void {
    this.dropTimer -= delta;
    if (this.dropTimer <= 0) {
      this.dropTimer = this.dropInterval;
      this.spawnAirDrop();
    }

    // Update active crates descent & smoke flares
    for (const crate of this.crates) {
      if (!crate.isLanded) {
        crate.position.y -= delta * 6; // Parachute descent speed
        crate.mesh.position.copy(crate.position);

        if (crate.position.y <= crate.targetY) {
          crate.position.y = crate.targetY;
          crate.mesh.position.copy(crate.position);
          crate.isLanded = true;
          this.onCrateLand(crate);
        }
      } else if (crate.smokeMesh && !crate.lootClaimed) {
        // Pulse smoke flare
        crate.smokeMesh.rotation.y += delta * 1.5;
        const scale = 1.0 + Math.sin(Date.now() * 0.006) * 0.2;
        crate.smokeMesh.scale.set(scale, 1, scale);
      }
    }
  }

  public spawnAirDrop(dropX?: number, dropZ?: number): void {
    const x = dropX ?? (Math.random() - 0.5) * 40;
    const z = dropZ ?? (Math.random() - 0.5) * 40;
    const groundY = this.world.getHighestY(Math.floor(x), Math.floor(z)) + 1;

    const group = new THREE.Group();

    // 1. Crate Mesh (Red with Blue Tarp)
    const crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const crateMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
    const crateMesh = new THREE.Mesh(crateGeo, crateMat);
    crateMesh.castShadow = true;
    group.add(crateMesh);

    // Blue Tarp on top
    const tarpGeo = new THREE.BoxGeometry(1.45, 0.3, 1.45);
    const tarpMat = new THREE.MeshLambertMaterial({ color: 0x1e40af });
    const tarpMesh = new THREE.Mesh(tarpGeo, tarpMat);
    tarpMesh.position.y = 0.6;
    group.add(tarpMesh);

    // 2. Parachute Canopy
    const parachuteGeo = new THREE.ConeGeometry(2.5, 1.5, 8, 1, true);
    const parachuteMat = new THREE.MeshBasicMaterial({
      color: 0xeeeeee,
      side: THREE.DoubleSide
    });
    const parachute = new THREE.Mesh(parachuteGeo, parachuteMat);
    parachute.position.y = 3.5;
    parachute.name = 'parachute';
    group.add(parachute);

    const startPos = new THREE.Vector3(x, 45, z);
    group.position.copy(startPos);
    this.scene.add(group);

    this.crates.push({
      mesh: group,
      position: startPos,
      targetY: groundY + 0.7,
      isLanded: false,
      lootClaimed: false,
      smokeMesh: null
    });
  }

  private onCrateLand(crate: AirDropCrate): void {
    // Detach parachute
    const parachute = crate.mesh.getObjectByName('parachute');
    if (parachute) {
      crate.mesh.remove(parachute);
    }

    // Set metal crate block on voxel grid for physical collision
    const bx = Math.floor(crate.position.x);
    const by = Math.floor(crate.position.y);
    const bz = Math.floor(crate.position.z);
    this.world.setBlock(bx, by, bz, BlockType.CRATE_METAL);

    // Add Red Smoke Flare Beacon
    const smokeGeo = new THREE.CylinderGeometry(0.3, 1.2, 12, 12, 1, true);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const smokeMesh = new THREE.Mesh(smokeGeo, smokeMat);
    smokeMesh.position.set(0, 6, 0);
    crate.mesh.add(smokeMesh);
    crate.smokeMesh = smokeMesh;
  }

  public getNearestUnclaimedCrate(pos: THREE.Vector3, maxDist: number = 40): AirDropCrate | null {
    let nearest: AirDropCrate | null = null;
    let minDist = maxDist;

    for (const c of this.crates) {
      if (c.isLanded && !c.lootClaimed) {
        const d = pos.distanceTo(c.position);
        if (d < minDist) {
          minDist = d;
          nearest = c;
        }
      }
    }

    return nearest;
  }
}
