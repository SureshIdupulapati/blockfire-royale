import * as THREE from 'three';

interface Particle {
  mesh: THREE.Object3D;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  color?: THREE.Color;
}

interface BulletTracer {
  line: THREE.Line;
  start: THREE.Vector3;
  end: THREE.Vector3;
  progress: number;
  speed: number;
}

export class ParticleManager {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private tracers: BulletTracer[] = [];
  private damageContainer: HTMLElement | null;

  // Shared geometries and materials for high performance
  private cubeGeo: THREE.BoxGeometry;
  private smokeGeo: THREE.DodecahedronGeometry;
  private tracerMaterial: THREE.LineBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.damageContainer = document.getElementById('damage-numbers-layer');

    this.cubeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.smokeGeo = new THREE.DodecahedronGeometry(0.25, 0);
    this.tracerMaterial = new THREE.LineBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0.9,
      linewidth: 2
    });
  }

  /**
   * Spawns voxel debris when mining or destroying blocks
   */
  public spawnVoxelDebris(pos: THREE.Vector3, colorHex: number, count: number = 8): void {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.cubeGeo, mat);
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6
      ));

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 4 + 2,
        (Math.random() - 0.5) * 4
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: vel,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0
      });
    }
  }

  /**
   * Spawns bullet impact sparks and smoke puff on voxel collision
   */
  public spawnImpact(pos: THREE.Vector3, normal: THREE.Vector3): void {
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const count = 5;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.cubeGeo, sparkMat);
      mesh.scale.set(0.6, 0.6, 0.6);
      mesh.position.copy(pos);

      const vel = normal.clone().multiplyScalar(2).add(new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3
      ));

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: vel,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45
      });
    }

    // Impact smoke puff
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x999999,
      transparent: true,
      opacity: 0.5
    });
    const smoke = new THREE.Mesh(this.smokeGeo, smokeMat);
    smoke.position.copy(pos).add(normal.clone().multiplyScalar(0.1));
    this.scene.add(smoke);
    this.particles.push({
      mesh: smoke,
      velocity: normal.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.5, 0)),
      life: 0.5,
      maxLife: 0.5
    });
  }

  /**
   * Spawns red blood particles on enemy hit
   */
  public spawnBlood(pos: THREE.Vector3): void {
    const bloodMat = new THREE.MeshBasicMaterial({ color: 0xcc0000 });
    const count = 6;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.cubeGeo, bloodMat);
      mesh.scale.set(0.7, 0.7, 0.7);
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3
      ));

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        Math.random() * 2 + 1,
        (Math.random() - 0.5) * 2.5
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: vel,
        life: 0.4,
        maxLife: 0.4
      });
    }
  }

  /**
   * Creates a high-speed bullet tracer line
   */
  public createBulletTracer(from: THREE.Vector3, to: THREE.Vector3, speed: number = 200): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, from.clone()]);
    const line = new THREE.Line(geo, this.tracerMaterial);
    this.scene.add(line);

    this.tracers.push({
      line,
      start: from.clone(),
      end: to.clone(),
      progress: 0,
      speed
    });
  }

  /**
   * Spawns floating damage numbers (PUBG / Free Fire style)
   */
  public spawnDamageNumber(
    damage: number,
    worldPos: THREE.Vector3,
    camera: THREE.Camera,
    isHeadshot: boolean = false
  ): void {
    if (!this.damageContainer) return;

    // Convert 3D position to 2D screen space
    const screenPos = worldPos.clone().project(camera);
    if (screenPos.z > 1) return; // Behind camera

    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    el.className = `floating-dmg ${isHeadshot ? 'headshot' : ''}`;
    el.innerText = `${Math.round(damage)}`;
    el.style.left = `${x + (Math.random() - 0.5) * 20}px`;
    el.style.top = `${y + (Math.random() - 0.5) * 10}px`;

    this.damageContainer.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 800);
  }

  /**
   * Spawns Free Fire glowing sonic ring during Alok active skill
   */
  public spawnSonicPulse(pos: THREE.Vector3): void {
    const ringGeo = new THREE.RingGeometry(0.5, 0.7, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9d4edd,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos).setY(pos.y + 0.1);
    this.scene.add(ring);

    this.particles.push({
      mesh: ring,
      velocity: new THREE.Vector3(0, 0, 0),
      life: 0.8,
      maxLife: 0.8
    });
  }

  public update(delta: number): void {
    // 1. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        if (p.mesh instanceof THREE.Mesh) {
          p.mesh.geometry.dispose();
          if (Array.isArray(p.mesh.material)) {
            p.mesh.material.forEach(m => m.dispose());
          } else {
            p.mesh.material.dispose();
          }
        }
        this.particles.splice(i, 1);
        continue;
      }

      // Gravity & position update
      p.velocity.y -= 9.8 * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);

      // Fade out
      const alpha = p.life / p.maxLife;
      if (p.mesh instanceof THREE.Mesh && p.mesh.material instanceof THREE.Material) {
        (p.mesh.material as any).opacity = alpha;
      }
    }

    // 2. Update bullet tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];
      const dist = tracer.start.distanceTo(tracer.end);
      tracer.progress += (tracer.speed * delta) / Math.max(1, dist);

      if (tracer.progress >= 1.0) {
        this.scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        this.tracers.splice(i, 1);
        continue;
      }

      const currentHead = tracer.start.clone().lerp(tracer.end, Math.min(1.0, tracer.progress));
      const currentTail = tracer.start.clone().lerp(tracer.end, Math.max(0, tracer.progress - 0.25));

      tracer.line.geometry.setFromPoints([currentTail, currentHead]);
    }
  }
}
