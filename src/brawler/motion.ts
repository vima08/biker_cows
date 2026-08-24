import type { BrawlerHeroId, BrawlerPlayer } from './types';

export const WALK_PHASE_COUNT = 4;

export const PLAYER_WALK_STRIDE: Readonly<Record<BrawlerHeroId, number>> = {
  cassia: 96,
  bruna: 104,
  // Nova used to cycle at ~85 ms per cel, which read as a two-frame buzz.
  // A longer stride keeps all three heroes inside the authored 100-150 ms
  // display window without tying animation to refresh rate.
  nova: 116,
};

export type BrawlerAttackPhase = 'windup' | 'contact' | 'recovery' | null;
export type PlayerReactionPhase = 'hit-stun' | 'knockback' | 'ground' | 'recovery' | 'down' | null;
export type PlayerMotionAtlas = 'hero' | 'walk';
export type PlayerWalkContact = 'left-contact' | 'passing-right' | 'right-contact' | 'passing-left' | null;

export interface BrawlerMotionPose {
  frame: number;
  atlas: PlayerMotionAtlas;
  walkPhase: number;
  walkContact: PlayerWalkContact;
  walkPhaseProgress: number;
  attackPhase: BrawlerAttackPhase;
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface PlayerReactionPose {
  frame: number;
  phase: PlayerReactionPhase;
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function pose(
  frame: number,
  options: Partial<Omit<BrawlerMotionPose, 'frame'>> = {},
): BrawlerMotionPose {
  return {
    frame,
    atlas: options.atlas ?? 'hero',
    walkPhase: options.walkPhase ?? 0,
    walkContact: options.walkContact ?? null,
    walkPhaseProgress: options.walkPhaseProgress ?? 0,
    attackPhase: options.attackPhase ?? null,
    offsetX: options.offsetX ?? 0,
    offsetY: options.offsetY ?? 0,
    rotation: options.rotation ?? 0,
    scaleX: options.scaleX ?? 1,
    scaleY: options.scaleY ?? 1,
  };
}

function attackProgress(player: BrawlerPlayer): number {
  if (player.attackTimer <= 0 || player.attackDuration <= 0) return 0;
  return clamp01(1 - player.attackTimer / player.attackDuration);
}

function airbornePose(player: BrawlerPlayer, directionBase: number): BrawlerMotionPose {
  if (player.attackTimer <= 0) {
    return pose(directionBase + 6, { offsetY: -1, rotation: player.facing * .012 });
  }

  const progress = attackProgress(player);
  if (progress < .22) {
    return pose(directionBase + 6, {
      attackPhase: 'windup',
      offsetX: -player.facing * 4,
      offsetY: 1,
      rotation: -player.facing * .035,
      scaleX: 1.015,
      scaleY: .985,
    });
  }
  if (progress < .72) {
    return pose(directionBase + 5, {
      attackPhase: 'contact',
      offsetX: player.facing * 5,
      offsetY: -3,
      rotation: player.facing * .048,
      scaleX: 1.02,
      scaleY: .98,
    });
  }
  return pose(directionBase + 6, {
    attackPhase: 'recovery',
    offsetX: player.facing * 1,
    offsetY: -1,
    rotation: player.facing * .016,
  });
}

function groundAttackPose(player: BrawlerPlayer, directionBase: number): BrawlerMotionPose {
  const progress = attackProgress(player);
  const facing = player.facing;

  if (player.attackStep === 3) {
    if (progress < .12) return pose(directionBase, { attackPhase: 'windup', offsetX: -facing * 5, scaleX: .98, scaleY: 1.02 });
    if (progress < .82) return pose(directionBase + 5, { attackPhase: 'contact', offsetX: facing * 3, rotation: facing * .018 });
    return pose(directionBase + 1, { attackPhase: 'recovery', offsetX: -facing * 1, rotation: -facing * .008 });
  }

  const contactFrame = player.attackStep === 0 ? 3 : player.attackStep === 1 ? 4 : 5;
  const windupFrame = player.attackStep === 0 ? 0 : player.attackStep === 1 ? 3 : 4;
  const windupEnd = player.attackStep === 2 ? .16 : .2;
  const contactEnd = player.attackStep === 2 ? .72 : .66;
  if (progress < windupEnd) {
    return pose(directionBase + windupFrame, {
      attackPhase: 'windup',
      offsetX: -facing * (player.attackStep === 2 ? 3 : 5),
      rotation: -facing * (player.attackStep === 2 ? .018 : .028),
      scaleX: .985,
      scaleY: 1.015,
    });
  }
  if (progress < contactEnd) {
    return pose(directionBase + contactFrame, {
      attackPhase: 'contact',
      offsetX: facing * (player.attackStep === 2 ? 3 : 6),
      offsetY: player.attackStep === 2 ? -1 : 0,
      rotation: facing * (player.attackStep === 2 ? .026 : .014),
      scaleX: 1.015,
      scaleY: .99,
    });
  }
  return pose(directionBase + (player.attackStep === 2 ? 1 : 0), {
    attackPhase: 'recovery',
    offsetX: facing,
    rotation: -facing * .008,
  });
}

/** Resolves the four authored walk cels from actual distance travelled. */
export function resolvePlayerMotionPose(player: BrawlerPlayer): BrawlerMotionPose {
  const directionBase = player.facing > 0 ? 0 : 8;
  if (player.z > 8) return airbornePose(player, directionBase);
  if (player.attackTimer > 0) return groundAttackPose(player, directionBase);
  if (!player.moving) return pose(directionBase);

  const stride = PLAYER_WALK_STRIDE[player.hero];
  const cycle = ((player.gaitDistance % stride) + stride) % stride / stride;
  const phaseFloat = cycle * WALK_PHASE_COUNT;
  const walkPhase = Math.min(WALK_PHASE_COUNT - 1, Math.floor(phaseFloat));
  const walkPhaseProgress = phaseFloat - walkPhase;
  const contacts = ['left-contact', 'passing-right', 'right-contact', 'passing-left'] as const;

  // Do not fake silhouette changes with root translation, rotation or squash.
  // The renderer holds a stable baseline and the four bitmap cels carry the
  // full gait. Phase 2 is explicitly the lowered right-foot contact requested
  // by the visual strip contract.
  return pose(walkPhase, {
    atlas: 'walk',
    walkPhase,
    walkContact: contacts[walkPhase],
    walkPhaseProgress,
  });
}

/** Nominal real-time hold for one walk cel at the hero's ground speed. */
export function playerWalkFrameDurationMs(hero: BrawlerHeroId, groundSpeed: number): number {
  return PLAYER_WALK_STRIDE[hero] / WALK_PHASE_COUNT / groundSpeed * 1000;
}

export function resolvePlayerReactionPose(player: BrawlerPlayer): PlayerReactionPose | null {
  if (!player.downed && player.reactionTimer <= 0) return null;
  if (player.downed && player.reactionTimer <= 0) {
    return { frame: 7, phase: 'down', offsetX: player.reactionDirection * 7, offsetY: 7, rotation: player.reactionDirection * .035, scaleX: 1.04, scaleY: .92 };
  }

  const progress = player.reactionDuration > 0
    ? clamp01(1 - player.reactionTimer / player.reactionDuration)
    : 1;
  const direction = player.reactionDirection;
  if (progress < .18) {
    return { frame: 7, phase: 'hit-stun', offsetX: direction * 4, offsetY: -1, rotation: direction * .028, scaleX: 1.04, scaleY: .97 };
  }
  if (progress < .5) {
    return { frame: 7, phase: 'knockback', offsetX: direction * 7, offsetY: -3, rotation: direction * .065, scaleX: 1.025, scaleY: .985 };
  }
  if (progress < .73 || player.downed) {
    return { frame: 7, phase: player.downed && progress >= .73 ? 'down' : 'ground', offsetX: direction * 6, offsetY: 6, rotation: direction * .11, scaleX: 1.055, scaleY: .88 };
  }
  if (progress < .9) {
    return { frame: 6, phase: 'recovery', offsetX: direction * 3, offsetY: 2, rotation: -direction * .025, scaleX: .99, scaleY: 1.015 };
  }
  return { frame: 1, phase: 'recovery', offsetX: direction, offsetY: 0, rotation: -direction * .008, scaleX: 1, scaleY: 1 };
}
