import type { BrawlerEnemyKind, BrawlerLevelDefinition } from '../levels/types';
import type { BrawlerDebugScene } from '../debug/brawlerScenes';

export type BrawlerHeroId = 'cassia' | 'bruna' | 'nova';
export type BrawlerStatus = 'intro' | 'running' | 'victory' | 'defeat';

export interface BrawlerControls {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  attack: boolean;
  attackPressed: boolean;
  jumpPressed: boolean;
  specialPressed: boolean;
}

export interface BeatEmUpOptions {
  level: BrawlerLevelDefinition;
  heroes: BrawlerHeroId[];
  debugBoss?: boolean;
  debugScene?: BrawlerDebugScene;
  /** The district clear returns to the campaign's final rider act. */
  campaignContinuation?: boolean;
}

export interface BrawlerPlayer {
  id: 1 | 2;
  hero: BrawlerHeroId;
  x: number;
  y: number;
  z: number;
  vz: number;
  hp: number;
  maxHp: number;
  special: number;
  facing: 1 | -1;
  moving: boolean;
  gaitDistance: number;
  attackTimer: number;
  attackDuration: number;
  attackStep: number;
  attackSerial: number;
  comboWindow: number;
  stun: number;
  invuln: number;
  reactionTimer: number;
  reactionDuration: number;
  reactionDirection: 1 | -1;
  hitFlash: number;
  knockX: number;
  downed: boolean;
  hitEnemies: Set<number>;
}

export interface BrawlerEnemy {
  id: number;
  kind: BrawlerEnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  moving: boolean;
  gaitDistance: number;
  attackTimer: number;
  attackDuration: number;
  attackSerial: number;
  attackVariant: number;
  cooldown: number;
  stun: number;
  flash: number;
  reactionTimer: number;
  reactionDuration: number;
  reactionDirection: 1 | -1;
  reactionKind: 'hit' | 'phase';
  knockX: number;
  phase: number;
  phaseShifted: boolean;
  dead: boolean;
  lastHitSerial: Record<number, number>;
}

export interface BrawlerParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'spark' | 'dust' | 'smoke' | 'star' | 'ring' | 'slash';
  angle?: number;
}

export interface BrawlerPickup {
  x: number;
  y: number;
  kind: 'health' | 'special' | 'score';
  life: number;
}
