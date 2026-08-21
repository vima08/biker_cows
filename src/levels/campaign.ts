import { LevelRegistry } from './LevelRegistry';
import type { BrawlerLevelDefinition, RiderLevelDefinition } from './types';

export const VENUS_HIGHWAY: RiderLevelDefinition = {
  id: 'venus-highway',
  order: 1,
  runtime: 'rider',
  title: 'VENUS HIGHWAY',
  subtitle: 'SULFUR DREADNOUGHT',
  musicCue: 'stage',
  bossAtSeconds: 465,
  minibossAtSeconds: 145,
};

export const FURNACE_DISTRICT: BrawlerLevelDefinition = {
  id: 'furnace-district',
  order: 2,
  runtime: 'brawler',
  title: 'FURNACE DISTRICT',
  subtitle: 'THE FORGE OVERSEER',
  bossName: 'THE FORGE OVERSEER',
  musicCue: 'brawler',
  length: 6700,
  floorNear: 478,
  floorFar: 302,
  assets: {
    backdrop: '/assets/brawler/furnace-district-panorama.png',
    floor: '/assets/brawler/furnace-floor.png',
    enemies: '/assets/brawler/venus-gang-sheet.png',
    boss: '/assets/brawler/forge-overseer-sheet.png',
  },
  waves: [
    { at: 540, enemies: ['raider', 'raider', 'raider'] },
    { at: 1420, enemies: ['raider', 'bruiser', 'raider', 'shocker'] },
    { at: 2440, enemies: ['shocker', 'raider', 'bruiser', 'shocker'] },
    { at: 3520, enemies: ['bruiser', 'raider', 'raider', 'bruiser', 'shocker'] },
    { at: 4780, enemies: ['shocker', 'shocker', 'bruiser', 'raider', 'raider'] },
    { at: 5950, enemies: ['boss'] },
  ],
};

export const campaign = new LevelRegistry([VENUS_HIGHWAY, FURNACE_DISTRICT]);
