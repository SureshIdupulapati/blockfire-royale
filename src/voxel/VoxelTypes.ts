import { BlockType } from '../types';

export interface BlockDefinition {
  type: BlockType;
  name: string;
  isSolid: boolean;
  isTransparent: boolean;
  hardness: number; // mining time in seconds
  dropType: 'wood' | 'stone' | 'none';
  dropCount: number;
  textures: {
    top: number;
    bottom: number;
    side: number;
  };
}

export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  [BlockType.AIR]: {
    type: BlockType.AIR,
    name: 'Air',
    isSolid: false,
    isTransparent: true,
    hardness: 0,
    dropType: 'none',
    dropCount: 0,
    textures: { top: 0, bottom: 0, side: 0 }
  },
  [BlockType.GRASS]: {
    type: BlockType.GRASS,
    name: 'Grass Block',
    isSolid: true,
    isTransparent: false,
    hardness: 0.6,
    dropType: 'none',
    dropCount: 0,
    textures: { top: 0, bottom: 2, side: 1 }
  },
  [BlockType.DIRT]: {
    type: BlockType.DIRT,
    name: 'Dirt',
    isSolid: true,
    isTransparent: false,
    hardness: 0.5,
    dropType: 'none',
    dropCount: 0,
    textures: { top: 2, bottom: 2, side: 2 }
  },
  [BlockType.STONE]: {
    type: BlockType.STONE,
    name: 'Stone',
    isSolid: true,
    isTransparent: false,
    hardness: 1.5,
    dropType: 'stone',
    dropCount: 1,
    textures: { top: 3, bottom: 3, side: 3 }
  },
  [BlockType.WOOD]: {
    type: BlockType.WOOD,
    name: 'Wood Log',
    isSolid: true,
    isTransparent: false,
    hardness: 1.0,
    dropType: 'wood',
    dropCount: 3,
    textures: { top: 5, bottom: 5, side: 4 }
  },
  [BlockType.LEAVES]: {
    type: BlockType.LEAVES,
    name: 'Leaves',
    isSolid: true,
    isTransparent: true,
    hardness: 0.2,
    dropType: 'none',
    dropCount: 0,
    textures: { top: 6, bottom: 6, side: 6 }
  },
  [BlockType.BRICK]: {
    type: BlockType.BRICK,
    name: 'Red Brick',
    isSolid: true,
    isTransparent: false,
    hardness: 2.0,
    dropType: 'stone',
    dropCount: 2,
    textures: { top: 7, bottom: 7, side: 7 }
  },
  [BlockType.SAND]: {
    type: BlockType.SAND,
    name: 'Sand',
    isSolid: true,
    isTransparent: false,
    hardness: 0.4,
    dropType: 'none',
    dropCount: 0,
    textures: { top: 8, bottom: 8, side: 8 }
  },
  [BlockType.GLASS]: {
    type: BlockType.GLASS,
    name: 'Glass',
    isSolid: true,
    isTransparent: true,
    hardness: 0.3,
    dropType: 'none',
    dropCount: 0,
    textures: { top: 9, bottom: 9, side: 9 }
  },
  [BlockType.GLOO_ICE]: {
    type: BlockType.GLOO_ICE,
    name: 'Gloo Ice Wall',
    isSolid: true,
    isTransparent: true,
    hardness: 10.0,
    dropType: 'none',
    dropCount: 0,
    textures: { top: 10, bottom: 10, side: 10 }
  },
  [BlockType.CRATE_METAL]: {
    type: BlockType.CRATE_METAL,
    name: 'Supply Crate',
    isSolid: true,
    isTransparent: false,
    hardness: 0.8,
    dropType: 'none',
    dropCount: 0,
    textures: { top: 11, bottom: 11, side: 12 }
  },
  [BlockType.OBSIDIAN]: {
    type: BlockType.OBSIDIAN,
    name: 'Obsidian',
    isSolid: true,
    isTransparent: false,
    hardness: 15.0,
    dropType: 'stone',
    dropCount: 5,
    textures: { top: 13, bottom: 13, side: 13 }
  }
};

