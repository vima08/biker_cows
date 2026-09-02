export type RoadRashStatus = 'intro' | 'racing' | 'boss' | 'victory' | 'defeat';
export type RoadRashHeroId = 'cassia' | 'bruna' | 'nova';

/** Held inputs are booleans; attackPressed should only be true for one frame. */
export interface RoadRashControls {
  left?: boolean;
  right?: boolean;
  accelerate?: boolean;
  brake?: boolean;
  attack?: boolean;
  attackPressed?: boolean;
  /** InputController-compatible aliases. */
  up?: boolean;
  down?: boolean;
  specialPressed?: boolean;
}

export interface RoadRashStageOptions {
  seed?: number;
  courseLength?: number;
  introDuration?: number;
  debugBoss?: boolean;
  debugCombat?: boolean;
  debugSkipIntro?: boolean;
  playerName?: string;
  playerHero?: RoadRashHeroId;
}

export interface RoadRashEntitySnapshot {
  id: number;
  kind: 'rival' | 'boss' | 'car' | 'truck' | 'oil';
  lane: number;
  distance: number;
  relativeDistance: number;
  speed: number;
  hp: number;
  maxHp: number;
  active: boolean;
  attacking: boolean;
}

export interface RoadRashSnapshot {
  status: RoadRashStatus;
  completed: boolean;
  defeated: boolean;
  elapsed: number;
  distance: number;
  /** Continuously advancing road odometer, including while the boss gate holds race progress. */
  visualDistance: number;
  courseLength: number;
  progress: number;
  speed: number;
  speedKph: number;
  lane: number;
  health: number;
  maxHealth: number;
  playerHero: RoadRashHeroId;
  score: number;
  rivalsDefeated: number;
  collisions: number;
  hits: number;
  finishReady: boolean;
  finishCrossed: boolean;
  finishVisible: boolean;
  bossSpawned: boolean;
  bossDefeated: boolean;
  /** True while Road King is still visibly crashing after reaching zero HP. */
  bossDefeatAnimating: boolean;
  bossDefeatTimer: number;
  bossDefeatProgress: number;
  boss: RoadRashEntitySnapshot | null;
  entities: RoadRashEntitySnapshot[];
  attackTimer: number;
  invulnerability: number;
  bossArenaLocked: boolean;
}
