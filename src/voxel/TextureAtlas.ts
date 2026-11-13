import * as THREE from 'three';

/**
 * Procedural Texture Atlas Generator for Voxel Blocks.
 * Creates sharp, 16x16 pixel-art textures mapped into a single canvas atlas.
 */
export class TextureAtlas {
  public canvas: HTMLCanvasElement | null = null;
  public texture: THREE.Texture;
  public readonly tileSize: number = 16;
  public readonly atlasCols: number = 4;
  public readonly atlasRows: number = 4;

  constructor() {
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.tileSize * this.atlasCols;
      this.canvas.height = this.tileSize * this.atlasRows;
      this.generateAtlas();

      const canvasTex = new THREE.CanvasTexture(this.canvas);
      canvasTex.magFilter = THREE.NearestFilter;
      canvasTex.minFilter = THREE.NearestFilter;
      canvasTex.colorSpace = THREE.SRGBColorSpace;
      this.texture = canvasTex;
    } else {
      this.texture = new THREE.Texture();
    }
  }

  private setPixel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, g: number, b: number, a: number = 1): void {
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  private generateAtlas(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Tile 0: Grass Top
    this.drawTile(ctx, 0, 0, (x, y) => {
      const noise = (Math.sin(x * 7.5 + y * 9.3) * 0.5 + 0.5) * 35;
      const r = Math.floor(70 + noise * 0.4);
      const g = Math.floor(165 + noise * 0.8);
      const b = Math.floor(55 + noise * 0.3);
      return [r, g, b, 1];
    });

    // Tile 1: Grass Side
    this.drawTile(ctx, 1, 0, (x, y) => {
      const isTopGrass = y < 3 + Math.floor(Math.sin(x * 2.1) * 1.5);
      if (isTopGrass) {
        return [70, 165, 55, 1];
      }
      const noise = (Math.sin(x * 3.3 + y * 5.1) * 0.5 + 0.5) * 30;
      return [115 + noise * 0.4, 75 + noise * 0.3, 45 + noise * 0.2, 1];
    });

    // Tile 2: Dirt
    this.drawTile(ctx, 2, 0, (x, y) => {
      const noise = (Math.sin(x * 4.7 + y * 6.3) * 0.5 + 0.5) * 35;
      return [115 + noise * 0.5, 75 + noise * 0.4, 45 + noise * 0.3, 1];
    });

    // Tile 3: Stone / Cobble
    this.drawTile(ctx, 3, 0, (x, y) => {
      const noise = (Math.sin(x * 8.1 + y * 11.2) * 0.5 + 0.5) * 45;
      const isCrack = (x + y) % 5 === 0 && Math.sin(x) > 0.2;
      const base = isCrack ? 90 : 135 + noise;
      return [base, base + 2, base + 5, 1];
    });

    // Tile 4: Wood Log Side
    this.drawTile(ctx, 0, 1, (x, y) => {
      const barkLine = Math.floor(Math.sin(x * 1.8) * 20);
      const noise = (Math.sin(y * 8.5) * 0.5 + 0.5) * 20;
      const r = Math.floor(100 + barkLine * 0.3 + noise);
      const g = Math.floor(65 + barkLine * 0.2);
      const b = Math.floor(35 + barkLine * 0.1);
      return [r, g, b, 1];
    });

    // Tile 5: Wood Log Top (Rings)
    this.drawTile(ctx, 1, 1, (x, y) => {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.floor(Math.sin(dist * 1.5) * 25);
      return [160 + ring, 120 + ring * 0.8, 70 + ring * 0.5, 1];
    });

    // Tile 6: Leaves
    this.drawTile(ctx, 2, 1, (x, y) => {
      const isHole = (x * 7 + y * 13) % 9 === 0;
      if (isHole) return [0, 0, 0, 0];
      const noise = (Math.sin(x * 5.2 + y * 7.1) * 0.5 + 0.5) * 40;
      return [35 + noise * 0.3, 130 + noise * 0.7, 35 + noise * 0.3, 0.95];
    });

    // Tile 7: Red Brick
    this.drawTile(ctx, 3, 1, (x, y) => {
      const isMortarY = y % 4 === 0;
      const rowOffset = Math.floor(y / 4) % 2 === 0 ? 0 : 4;
      const isMortarX = (x + rowOffset) % 8 === 0;
      if (isMortarY || isMortarX) {
        return [190, 185, 175, 1];
      }
      const noise = (Math.sin(x * 4.1 + y * 5.2) * 0.5 + 0.5) * 30;
      return [160 + noise, 55 + noise * 0.3, 40 + noise * 0.2, 1];
    });

    // Tile 8: Sand
    this.drawTile(ctx, 0, 2, (x, y) => {
      const noise = (Math.sin(x * 6.5 + y * 8.3) * 0.5 + 0.5) * 25;
      return [225 + noise * 0.3, 210 + noise * 0.3, 155 + noise * 0.2, 1];
    });

    // Tile 9: Glass
    this.drawTile(ctx, 1, 2, (x, y) => {
      const isBorder = x === 0 || x === 15 || y === 0 || y === 15;
      const isGlint = (x - y === 2 || x - y === 3) && x > 3 && x < 12;
      if (isBorder) return [200, 230, 255, 0.8];
      if (isGlint) return [255, 255, 255, 0.9];
      return [160, 210, 240, 0.2];
    });

    // Tile 10: Free Fire Gloo Ice Wall
    this.drawTile(ctx, 2, 2, (x, y) => {
      const hex = (Math.sin(x * 1.2) * Math.cos(y * 1.2) * 0.5 + 0.5) * 60;
      const isEdge = x === 0 || x === 15 || y === 0 || y === 15;
      if (isEdge) return [0, 240, 255, 0.9];
      return [30 + hex * 0.5, 190 + hex * 0.8, 255, 0.75];
    });

    // Tile 11: Supply Crate Top
    this.drawTile(ctx, 3, 2, (x, y) => {
      const isBorder = x === 0 || x === 15 || y === 0 || y === 15;
      const isCross = Math.abs(x - y) <= 1 || Math.abs(x - (15 - y)) <= 1;
      if (isBorder || isCross) return [220, 50, 40, 1];
      return [45, 65, 85, 1];
    });

    // Tile 12: Supply Crate Side
    this.drawTile(ctx, 0, 3, (x, y) => {
      const isHazard = (x + y) % 6 < 3 && y > 10;
      if (isHazard) return [240, 180, 20, 1];
      const isHandle = y >= 6 && y <= 9 && x >= 5 && x <= 10;
      if (isHandle) return [30, 35, 40, 1];
      return [180, 40, 40, 1];
    });

    // Tile 13: Obsidian
    this.drawTile(ctx, 1, 3, (x, y) => {
      const noise = (Math.sin(x * 9.1 + y * 7.4) * 0.5 + 0.5) * 40;
      return [25 + noise * 0.4, 15 + noise * 0.2, 35 + noise * 0.6, 1];
    });
  }

  private drawTile(
    ctx: CanvasRenderingContext2D,
    col: number,
    row: number,
    pixelFn: (x: number, y: number) => [number, number, number, number]
  ): void {
    const startX = col * this.tileSize;
    const startY = row * this.tileSize;

    for (let py = 0; py < this.tileSize; py++) {
      for (let px = 0; px < this.tileSize; px++) {
        const [r, g, b, a] = pixelFn(px, py);
        this.setPixel(ctx, startX + px, startY + py, Math.floor(r), Math.floor(g), Math.floor(b), a);
      }
    }
  }

  /**
   * Returns UV coordinates [uMin, vMin, uMax, vMax] for a given tile index.
   */
  public getTileUV(tileIndex: number): [number, number, number, number] {
    const col = tileIndex % this.atlasCols;
    const row = Math.floor(tileIndex / this.atlasCols);

    const uMin = col / this.atlasCols;
    const uMax = (col + 1) / this.atlasCols;
    const vMax = 1 - row / this.atlasRows;
    const vMin = 1 - (row + 1) / this.atlasRows;

    return [uMin, vMin, uMax, vMax];
  }
}
