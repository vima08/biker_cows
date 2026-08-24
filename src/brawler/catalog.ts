import type { BrawlerHeroId } from './types';
import { assetUrl } from '../assetUrl';

export interface BrawlerHeroSpec {
  fur: string;
  dark: string;
  accent: string;
  hp: number;
  speed: number;
  sprites: string;
  walkSprites: string;
  reactions: string;
}

/** Combat tuning and asset paths live together so a new hero has one entry point. */
export const BRAWLER_HEROES: Readonly<Record<BrawlerHeroId, BrawlerHeroSpec>> = {
  cassia: { fur: '#d99a42', dark: '#3b2330', accent: '#ffd34c', hp: 120, speed: 230, sprites: assetUrl('assets/brawler/cassia-brawler-sheet.png'), walkSprites: assetUrl('assets/brawler/cassia-brawler-walk-v2.png'), reactions: assetUrl('assets/brawler/cassia-brawler-reaction-sheet.png') },
  bruna: { fur: '#89909d', dark: '#17283a', accent: '#5ee5ff', hp: 170, speed: 185, sprites: assetUrl('assets/brawler/bruna-brawler-sheet.png'), walkSprites: assetUrl('assets/brawler/bruna-brawler-walk-v2.png'), reactions: assetUrl('assets/brawler/bruna-brawler-reaction-sheet.png') },
  nova: { fur: '#f1e8dc', dark: '#30242c', accent: '#ff527c', hp: 100, speed: 265, sprites: assetUrl('assets/brawler/nova-brawler-sheet.png'), walkSprites: assetUrl('assets/brawler/nova-brawler-walk-v2.png'), reactions: assetUrl('assets/brawler/nova-brawler-reaction-sheet.png') },
};
