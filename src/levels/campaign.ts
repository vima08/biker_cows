import { LevelRegistry } from './LevelRegistry';
import type { BrawlerLevelDefinition, RiderLevelDefinition, RoadRashLevelDefinition } from './types';
import { assetUrl } from '../assetUrl';

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

export const SULFUR_RUN: RoadRashLevelDefinition = {
  id: 'sulfur-run',
  order: 2,
  runtime: 'road-rash',
  title: 'SULFUR RUN',
  subtitle: 'KNOCK THE JACKALS OFF THE ROAD',
  bossName: 'RAZORBACK REX',
  musicCue: 'stage',
  distance: 7200,
  bossAt: 5900,
  backdrop: assetUrl('assets/road-rash/venus-badlands-panorama-v1.png'),
};

export const FURNACE_DISTRICT: BrawlerLevelDefinition = {
  id: 'furnace-district',
  order: 3,
  runtime: 'brawler',
  title: 'FURNACE DISTRICT',
  subtitle: 'THE FORGE OVERSEER',
  bossName: 'THE FORGE OVERSEER',
  musicCue: 'brawler',
  length: 6700,
  floorNear: 478,
  floorFar: 302,
  assets: {
    backdrop: assetUrl('assets/brawler/furnace-district-panorama.png'),
    floor: assetUrl('assets/brawler/furnace-floor.png'),
    enemies: assetUrl('assets/brawler/venus-gang-sheet.png'),
    boss: assetUrl('assets/brawler/forge-overseer-sheet.png'),
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

export const campaign = new LevelRegistry([VENUS_HIGHWAY, SULFUR_RUN, FURNACE_DISTRICT]);
