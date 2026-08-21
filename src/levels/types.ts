export type LevelRuntime = 'rider' | 'brawler';
export type BrawlerEnemyKind = 'raider' | 'bruiser' | 'shocker' | 'boss';

interface LevelMetadata {
  readonly id: string;
  readonly order: number;
  readonly runtime: LevelRuntime;
  readonly title: string;
  readonly subtitle: string;
  readonly musicCue: string;
}

export interface RiderLevelDefinition extends LevelMetadata {
  readonly runtime: 'rider';
  readonly bossAtSeconds: number;
  readonly minibossAtSeconds: number;
}

export interface BrawlerWaveDefinition {
  readonly at: number;
  readonly enemies: readonly BrawlerEnemyKind[];
}

export interface BrawlerLevelAssets {
  readonly backdrop: string;
  readonly floor: string;
  readonly enemies: string;
  readonly boss: string;
}

export interface BrawlerLevelDefinition extends LevelMetadata {
  readonly runtime: 'brawler';
  readonly length: number;
  readonly floorFar: number;
  readonly floorNear: number;
  readonly bossName: string;
  readonly assets: BrawlerLevelAssets;
  readonly waves: readonly BrawlerWaveDefinition[];
}

export type LevelDefinition = RiderLevelDefinition | BrawlerLevelDefinition;
