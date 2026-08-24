import type { BrawlerEnemyKind } from '../levels/types';
import type { BrawlerEnemy } from './types';

export type EnemyAttackPhase = 'anticipation' | 'contact' | 'recovery' | null;
export type EnemyReactionPhase = 'impact' | 'recoil' | 'recovery' | 'phase-shift' | 'collapse' | null;

export interface EnemyMotionPose {
  frame: number;
  walkPhase: number;
  walkPhaseProgress: number;
  attackPhase: EnemyAttackPhase;
  reactionPhase: EnemyReactionPhase;
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
}

interface WalkStyle {
  stride: number;
  lift: readonly [number, number, number, number];
  lean: readonly [number, number, number, number];
  scaleX: readonly [number, number, number, number];
  scaleY: readonly [number, number, number, number];
}

const WALK_STYLE: Record<Exclude<BrawlerEnemyKind, 'boss'>, WalkStyle> = {
  raider: {
    stride: 62,
    lift: [0, 0, 0, 0],
    lean: [0, -.025, .02, .015],
    scaleX: [1, 1.015, .985, .995],
    scaleY: [1.005, .99, 1.015, 1.008],
  },
  bruiser: {
    stride: 88,
    lift: [0, 0, 0, 0],
    lean: [0, -.012, .008, .01],
    scaleX: [1.015, 1.03, 1, 1.02],
    scaleY: [.99, .975, 1.005, .985],
  },
  shocker: {
    stride: 52,
    lift: [0, 0, 0, 0],
    lean: [0, -.035, .028, .022],
    scaleX: [.995, 1.02, .975, 1.008],
    scaleY: [1.01, .985, 1.025, .995],
  },
};

const ATTACK_DURATION: Record<BrawlerEnemyKind, number> = {
  raider: .54,
  bruiser: .64,
  shocker: .5,
  boss: .84,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const baseFrame = (enemy: BrawlerEnemy): number =>
  (enemy.kind === 'bruiser' ? 8 : enemy.kind === 'shocker' ? 16 : 0) + (enemy.facing > 0 ? 0 : 4);

function pose(frame: number, options: Partial<Omit<EnemyMotionPose, 'frame'>> = {}): EnemyMotionPose {
  return {
    frame,
    walkPhase: options.walkPhase ?? 0,
    walkPhaseProgress: options.walkPhaseProgress ?? 0,
    attackPhase: options.attackPhase ?? null,
    reactionPhase: options.reactionPhase ?? null,
    offsetX: options.offsetX ?? 0,
    offsetY: options.offsetY ?? 0,
    rotation: options.rotation ?? 0,
    scaleX: options.scaleX ?? 1,
    scaleY: options.scaleY ?? 1,
    alpha: options.alpha ?? 1,
  };
}

export function enemyAttackDuration(kind: BrawlerEnemyKind): number {
  return ATTACK_DURATION[kind];
}

export function enemyAttackProgress(enemy: BrawlerEnemy): number {
  if (enemy.attackTimer <= 0 || enemy.attackDuration <= 0) return 0;
  return clamp01(1 - enemy.attackTimer / enemy.attackDuration);
}

export function enemyAttackPhase(enemy: BrawlerEnemy): EnemyAttackPhase {
  if (enemy.attackTimer <= 0) return null;
  const progress = enemyAttackProgress(enemy);
  if (progress < .32) return 'anticipation';
  if (progress < .56) return 'contact';
  return 'recovery';
}

function reactionProgress(enemy: BrawlerEnemy): number {
  if (enemy.reactionTimer <= 0 || enemy.reactionDuration <= 0) return 0;
  return clamp01(1 - enemy.reactionTimer / enemy.reactionDuration);
}

function bossPose(enemy: BrawlerEnemy): EnemyMotionPose {
  const facing = enemy.facing;
  if (enemy.dead) {
    const progress = clamp01(enemy.phase / .9);
    return pose(5, {
      reactionPhase: 'collapse',
      offsetX: facing * Math.min(8, progress * 10),
      offsetY: progress * 8,
      rotation: -facing * progress * .035,
      scaleX: 1 + progress * .035,
      scaleY: 1 - progress * .08,
      alpha: 1 - Math.max(0, progress - .62) / .38,
    });
  }
  if (enemy.reactionTimer > 0) {
    const progress = reactionProgress(enemy);
    if (enemy.reactionKind === 'phase') {
      if (progress < .24) return pose(4, { reactionPhase: 'impact', offsetX: -facing * 6, rotation: -facing * .025, scaleX: 1.025, scaleY: .985 });
      if (progress < .76) return pose(2, { reactionPhase: 'phase-shift', offsetY: -4, scaleX: 1.035, scaleY: .975 });
      return pose(0, { reactionPhase: 'recovery', offsetX: facing * 2, scaleX: 1.01, scaleY: .995 });
    }
    if (progress < .36) return pose(4, { reactionPhase: 'impact', offsetX: -facing * 5, rotation: -facing * .028, scaleX: 1.02, scaleY: .985 });
    if (progress < .72) return pose(1, { reactionPhase: 'recoil', offsetX: -facing * 7, rotation: -facing * .015, scaleX: 1.012, scaleY: .992 });
    return pose(0, { reactionPhase: 'recovery', offsetX: -facing * 3 });
  }
  const attack = enemyAttackPhase(enemy);
  if (attack === 'anticipation') return pose(2, { attackPhase: attack, offsetX: -facing * 5, rotation: -facing * .018, scaleX: .985, scaleY: 1.012 });
  if (attack === 'contact') return pose(3, { attackPhase: attack, offsetX: facing * 7, rotation: facing * .012, scaleX: 1.025, scaleY: .98 });
  if (attack === 'recovery') return pose(1, { attackPhase: attack, offsetX: facing * 2, rotation: -facing * .008 });
  if (!enemy.moving) return pose(0);

  const cycle = ((enemy.gaitDistance % 104) + 104) % 104 / 104;
  const phaseFloat = cycle * 4;
  const walkPhase = Math.min(3, Math.floor(phaseFloat));
  const progress = phaseFloat - walkPhase;
  const frames = [0, 1, 0, 1] as const;
  const lift = [0, -1, -2, 0] as const;
  const lean = [0, -.014, .01, .012] as const;
  return pose(frames[walkPhase], {
    walkPhase,
    walkPhaseProgress: progress,
    offsetX: facing * ((.5 - progress) * 5 + [1, 0, -1, 0][walkPhase]),
    offsetY: lift[walkPhase],
    rotation: facing * lean[walkPhase],
    scaleX: [1.008, 1.015, .998, 1.01][walkPhase],
    scaleY: [.995, .988, 1.005, .992][walkPhase],
  });
}

function commonDeathPose(enemy: BrawlerEnemy, base: number): EnemyMotionPose {
  const progress = clamp01(enemy.phase / .78);
  const facing = enemy.facing;
  if (progress < .2) return pose(base + 3, { reactionPhase: 'impact', offsetX: facing * 5, rotation: facing * .04, scaleX: 1.04, scaleY: .97 });
  if (progress < .58) {
    const collapse = (progress - .2) / .38;
    const classLean = enemy.kind === 'bruiser' ? .035 : enemy.kind === 'shocker' ? .16 : .1;
    return pose(base + 2, {
      reactionPhase: 'collapse',
      offsetX: facing * (6 + collapse * 4),
      offsetY: collapse * 7,
      rotation: facing * classLean * collapse,
      scaleX: 1 + collapse * (enemy.kind === 'bruiser' ? .08 : .035),
      scaleY: 1 - collapse * (enemy.kind === 'bruiser' ? .28 : .18),
    });
  }
  const settle = (progress - .58) / .42;
  return pose(base, {
    reactionPhase: 'collapse',
    offsetX: facing * 10,
    offsetY: 8 + settle * 5,
    rotation: facing * (enemy.kind === 'shocker' ? .18 : .08),
    scaleX: enemy.kind === 'bruiser' ? 1.12 : 1.06,
    scaleY: enemy.kind === 'bruiser' ? .62 : .72,
    alpha: 1 - settle,
  });
}

function commonPose(enemy: BrawlerEnemy): EnemyMotionPose {
  const base = baseFrame(enemy);
  const facing = enemy.facing;
  if (enemy.dead) return commonDeathPose(enemy, base);
  if (enemy.reactionTimer > 0) {
    const progress = reactionProgress(enemy);
    if (progress < .3) return pose(base + 3, { reactionPhase: 'impact', offsetX: enemy.reactionDirection * 4, rotation: enemy.reactionDirection * .045, scaleX: 1.035, scaleY: .97 });
    if (progress < .7) return pose(base + 2, { reactionPhase: 'recoil', offsetX: enemy.reactionDirection * 7, offsetY: enemy.kind === 'shocker' ? -2 : 0, rotation: enemy.reactionDirection * (enemy.kind === 'bruiser' ? .028 : .07), scaleX: enemy.kind === 'bruiser' ? 1.06 : 1.02, scaleY: enemy.kind === 'bruiser' ? .95 : .985 });
    return pose(base + 1, { reactionPhase: 'recovery', offsetX: enemy.reactionDirection * 3, rotation: -enemy.reactionDirection * .018 });
  }
  const attack = enemyAttackPhase(enemy);
  if (attack === 'anticipation') return pose(base, { attackPhase: attack, offsetX: -facing * (enemy.kind === 'bruiser' ? 4 : 3), rotation: -facing * .025, scaleX: .98, scaleY: 1.025 });
  if (attack === 'contact') return pose(base + 3, { attackPhase: attack, offsetX: facing * (enemy.kind === 'bruiser' ? 7 : 6), rotation: facing * .018, scaleX: 1.035, scaleY: .975 });
  if (attack === 'recovery') return pose(base + 1, { attackPhase: attack, offsetX: facing * 2, rotation: -facing * .012 });
  if (!enemy.moving) return pose(base);

  const kind = enemy.kind as Exclude<BrawlerEnemyKind, 'boss'>;
  const style = WALK_STYLE[kind];
  const cycle = ((enemy.gaitDistance % style.stride) + style.stride) % style.stride / style.stride;
  const phaseFloat = cycle * 4;
  const walkPhase = Math.min(3, Math.floor(phaseFloat));
  const progress = phaseFloat - walkPhase;
  const frames = [0, 1, 2, 1] as const;
  const plantStrength = style.stride / 4;
  return pose(base + frames[walkPhase], {
    walkPhase,
    walkPhaseProgress: progress,
    offsetX: facing * ((.5 - progress) * plantStrength + [2, 1, -2, -1][walkPhase]),
    offsetY: style.lift[walkPhase],
    rotation: facing * style.lean[walkPhase],
    scaleX: style.scaleX[walkPhase],
    scaleY: style.scaleY[walkPhase],
  });
}

export function resolveEnemyMotionPose(enemy: BrawlerEnemy): EnemyMotionPose {
  return enemy.kind === 'boss' ? bossPose(enemy) : commonPose(enemy);
}
