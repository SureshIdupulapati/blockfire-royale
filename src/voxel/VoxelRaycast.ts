import * as THREE from 'three';
import { BlockType, RaycastHit } from '../types';

export interface VoxelGrid {
  getBlock(x: number, y: number, z: number): BlockType;
  isSolid(x: number, y: number, z: number): boolean;
}

/**
 * 3D DDA (Digital Differential Analyzer) Voxel Raymarching.
 * Implements Amanatides & Woo's "A Fast Voxel Traversal Algorithm for Ray Tracing".
 * Returns exact voxel coordinates, hit face normal, and previous adjacent empty block.
 */
export function raycastVoxel(
  grid: VoxelGrid,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance: number = 8
): RaycastHit & { placePosition?: THREE.Vector3 } {
  const dir = direction.clone().normalize();

  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
  const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
  const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

  const fracX = origin.x - x;
  const fracY = origin.y - y;
  const fracZ = origin.z - z;

  let tMaxX = stepX > 0 ? (1 - fracX) * tDeltaX : fracX * tDeltaX;
  let tMaxY = stepY > 0 ? (1 - fracY) * tDeltaY : fracY * tDeltaY;
  let tMaxZ = stepZ > 0 ? (1 - fracZ) * tDeltaZ : fracZ * tDeltaZ;

  let normal = new THREE.Vector3(0, 0, 0);
  let prevPosition = new THREE.Vector3(x, y, z);
  let distance = 0;

  while (distance < maxDistance) {
    const block = grid.getBlock(x, y, z);
    if (block !== BlockType.AIR && grid.isSolid(x, y, z)) {
      const hitPoint = origin.clone().add(dir.clone().multiplyScalar(distance));
      return {
        hit: true,
        point: hitPoint,
        normal: normal.clone(),
        distance,
        blockPosition: new THREE.Vector3(x, y, z),
        blockType: block,
        placePosition: prevPosition.clone()
      };
    }

    prevPosition.set(x, y, z);

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        distance = tMaxX;
        tMaxX += tDeltaX;
        x += stepX;
        normal.set(-stepX, 0, 0);
      } else {
        distance = tMaxZ;
        tMaxZ += tDeltaZ;
        z += stepZ;
        normal.set(0, 0, -stepZ);
      }
    } else {
      if (tMaxY < tMaxZ) {
        distance = tMaxY;
        tMaxY += tDeltaY;
        y += stepY;
        normal.set(0, -stepY, 0);
      } else {
        distance = tMaxZ;
        tMaxZ += tDeltaZ;
        z += stepZ;
        normal.set(0, 0, -stepZ);
      }
    }
  }

  return {
    hit: false,
    point: origin.clone().add(dir.clone().multiplyScalar(maxDistance)),
    normal: new THREE.Vector3(0, 1, 0),
    distance: maxDistance
  };
}
