import type { BrawlerControls, BrawlerPlayer } from '../brawler/types';

export const BRAWLER_DEBUG_SCENES = ['brawler-walk', 'brawler-jump', 'brawler-air-attack'] as const;
export type BrawlerDebugScene = typeof BRAWLER_DEBUG_SCENES[number];

export function parseBrawlerDebugScene(value: string | null): BrawlerDebugScene | null {
  return BRAWLER_DEBUG_SCENES.includes(value as BrawlerDebugScene) ? value as BrawlerDebugScene : null;
}

const neutral = (): BrawlerControls => ({
  left: false, right: false, up: false, down: false, attack: false,
  attackPressed: false, jumpPressed: false, specialPressed: false,
});

/** Deterministic input while the real BeatEmUpStage update/render path stays in charge. */
export function brawlerDebugControls(
  scene: BrawlerDebugScene,
  elapsed: number,
  player: Pick<BrawlerPlayer, 'z' | 'attackTimer'>,
  pulse: { jumpCycle: number; attackCycle: number },
): BrawlerControls {
  const controls = neutral();
  const cycleDuration = 1.55;
  const cycle = Math.floor(elapsed / cycleDuration);
  const cycleTime = elapsed - cycle * cycleDuration;
  if (scene === 'brawler-walk') {
    controls.right = true;
    return controls;
  }
  if (cycle !== pulse.jumpCycle && cycleTime < .12 && player.z === 0) {
    controls.jumpPressed = true;
    pulse.jumpCycle = cycle;
  }
  if (scene === 'brawler-air-attack' && cycle !== pulse.attackCycle && cycleTime >= .18 && player.z > 12 && player.attackTimer <= 0) {
    controls.attack = true;
    controls.attackPressed = true;
    pulse.attackCycle = cycle;
  }
  return controls;
}
