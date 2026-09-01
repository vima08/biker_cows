export type GameMode = 'title' | 'select' | 'intro' | 'outro' | 'playing' | 'road-rash' | 'brawler' | 'paused' | 'continue' | 'win' | 'lose';
export type HeroId = 'cassia' | 'bruna' | 'nova';
export type Weapon = 'blaster' | 'spread' | 'laser' | 'rockets';
export type RiderEnemyKind = 'rider' | 'tank' | 'drone' | 'skimmer' | 'mine' | 'miniboss' | 'boss' | 'pod';
export type RiderPickupKind = 'health' | 'armor' | 'weapon' | 'rapid' | 'score';
export type HeroBodySheet = 'authored' | 'sustained' | 'release';
export type SourcePoint = readonly [number, number];

export interface HeroSpec {
  id: HeroId;
  name: string;
  epithet: string;
  color: string;
  accent: string;
  maxHp: number;
  maxArmor: number;
  speed: number;
  fireRate: number;
  weapon: Weapon;
  special: string;
  stats: [number, number, number];
}

export interface IntroPanel {
  src: string;
  kicker: string;
  title: string;
  caption: string;
  duration: number;
  pan: number;
}

export interface HeroSourceMap {
  readonly authored: readonly SourcePoint[];
  readonly sustained: readonly SourcePoint[];
  readonly release: readonly SourcePoint[];
}

export interface RiderPlayer {
  id: 1 | 2;
  heroIndex: number;
  alive: boolean;
  downed: boolean;
  x: number;
  y: number;
  jump: number;
  jumpV: number;
  hp: number;
  armor: number;
  invuln: number;
  cooldown: number;
  weapon: Weapon;
  weaponRank: number;
  rapid: number;
  special: number;
  specialTime: number;
  lean: number;
  wheel: number;
  kineticClock: number;
  recoil: number;
  fireHeld: boolean;
  fireLoop: number;
  fireReleaseBlend: number;
  fireReleaseElapsed: number;
  shotsFired: number;
  lastMuzzle: { x: number; y: number; sheet: HeroBodySheet; frame: number } | null;
  lastExhaust: { x: number; y: number; sheet: HeroBodySheet; frame: number } | null;
  exhaustClock: number;
  debugInput?: { left?: boolean; right?: boolean; up?: boolean; down?: boolean; fire?: boolean; jump?: boolean; special?: boolean };
}

export interface RiderEnemy {
  id: number;
  kind: RiderEnemyKind;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  t: number;
  fire: number;
  aerial: boolean;
  phase: number;
  flash: number;
  hitReact: number;
  /** Coalesces cosmetic hit bursts on large targets without dropping damage events. */
  impactFxCooldown?: number;
  score: number;
  /** Stage-one boss attack timeline; absent for ordinary enemies. */
  attackMode?: number;
  attackTime?: number;
  attackShot?: number;
}

export interface RiderProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  damage: number;
  friendly: boolean;
  color: string;
  kind: Weapon | 'enemy' | 'orb';
  pierce: number;
  homing?: boolean;
  age?: number;
  phase?: number;
  ownerId?: 1 | 2;
}

export interface RiderPickup { x: number; y: number; kind: RiderPickupKind; t: number }
export interface RiderFloater { x: number; y: number; text: string; color: string; life: number }
export interface RiderImpactEvent { enemyId: number; age: number; localX: number; localY: number }
export interface RiderParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'spark' | 'smoke' | 'fire' | 'dust' | 'debris' | 'ring' | 'star' | 'impact' | 'shard' | 'blast';
  rot: number;
}
