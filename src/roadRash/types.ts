export type RoadRashStatus = 'intro' | 'racing' | 'boss' | 'victory' | 'defeat';

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
  courseLength: number;
  progress: number;
  speed: number;
  speedKph: number;
  lane: number;
  health: number;
  maxHealth: number;
  score: number;
  rivalsDefeated: number;
  collisions: number;
  hits: number;
  finishReady: boolean;
  bossSpawned: boolean;
  bossDefeated: boolean;
  boss: RoadRashEntitySnapshot | null;
  entities: RoadRashEntitySnapshot[];
  attackTimer: number;
  invulnerability: number;
}
