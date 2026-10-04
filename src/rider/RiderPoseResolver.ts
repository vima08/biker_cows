import {
  FIRE_RELEASE_DURATION,
  GROUNDED_RIDE_CYCLE,
  HERO_AUTHORED_SIZE,
  HERO_EXHAUST_SOURCE,
  HERO_MUZZLE_SOURCE,
  HERO_SUSTAINED_FIRE_CYCLE,
  HEROES,
} from './catalog';
import {
  resolveRiderKinetics,
  resolveRiderWheelMotion,
  type RiderKineticPose,
  type RiderWheelMotion,
} from './RiderKinetics';
import type { HeroBodySheet, HeroId, HeroSourceMap, RiderPlayer } from './types';

// Source-cell attachment points, inspected against the unchanged hero PNGs.
// Upper is Cassia/Nova's scarf knot or Bruna's hair; lower is the tail/vest hem.
// Airborne cels move the torso independently inside the atlas cell, so a fixed
// world offset cannot keep these pieces attached throughout a jump.
export type RiderSecondaryAnchors = readonly [number, number, number, number];
const SECONDARY_ANCHORS: Readonly<Record<HeroId, Readonly<Record<HeroBodySheet, readonly RiderSecondaryAnchors[]>>>> = {
  cassia: {
    authored: [[99, 54, 77, 103], [118, 61, 85, 104], [99, 44, 76, 91], [137, 76, 89, 106], [115, 80, 75, 112], [82, 63, 91, 121], [89, 61, 91, 118], [116, 64, 83, 104]],
    sustained: [[107, 59, 79, 104], [108, 59, 79, 104], [105, 59, 79, 104], [110, 60, 79, 104]],
    release: [[109, 60, 79, 104], [102, 60, 79, 104], [110, 61, 79, 104]],
  },
  bruna: {
    authored: [[89, 37, 72, 100], [104, 39, 84, 102], [92, 44, 84, 99], [124, 69, 88, 107], [98, 73, 66, 111], [105, 44, 97, 115], [100, 43, 93, 114], [93, 41, 76, 103]],
    sustained: [[98, 42, 75, 101], [100, 42, 76, 104], [99, 41, 75, 102], [100, 43, 76, 103]],
    release: [[91, 41, 74, 102], [90, 41, 74, 102], [100, 43, 76, 103]],
  },
  nova: {
    authored: [[113, 60, 83, 100], [125, 73, 83, 104], [107, 52, 87, 91], [128, 79, 94, 102], [154, 115, 73, 120], [101, 67, 113, 129], [108, 53, 102, 115], [126, 90, 95, 109]],
    sustained: [[110, 61, 86, 102], [110, 67, 84, 107], [107, 61, 85, 104], [110, 63, 85, 104]],
    release: [[104, 55, 85, 105], [103, 56, 85, 104], [112, 65, 84, 104]],
  },
};

export interface RiderBodyPose {
  sheet: HeroBodySheet;
  frame: number;
}

export interface RiderHardpoint extends RiderBodyPose {
  x: number;
  y: number;
  sourceX: number;
  sourceY: number;
}

/** Resolves animation frames and authored attachment points without rendering. */
export class RiderPoseResolver {
  bodyPose(player: RiderPlayer, debugImpactStage: number | null): RiderBodyPose {
    const grounded = player.jump <= 1;
    if (debugImpactStage === null && grounded && player.fireHeld) {
      const hero = HEROES[player.heroIndex].id;
      const cycle = HERO_SUSTAINED_FIRE_CYCLE[hero];
      const fireIndex = ((Math.floor(player.fireLoop * 9) % cycle.length) + cycle.length) % cycle.length;
      return { sheet: 'sustained', frame: cycle[fireIndex] };
    }
    if (debugImpactStage === null && grounded && player.fireReleaseElapsed >= 0 && player.fireReleaseElapsed < FIRE_RELEASE_DURATION) {
      return {
        sheet: 'release',
        frame: Math.min(2, Math.floor(player.fireReleaseElapsed / (FIRE_RELEASE_DURATION / 3))),
      };
    }
    return { sheet: 'authored', frame: this.authoredFrame(player, debugImpactStage) };
  }

  kinetics(
    player: RiderPlayer,
    debugImpactStage: number | null,
    pose = this.bodyPose(player, debugImpactStage),
  ): RiderKineticPose {
    const active = debugImpactStage === null && player.jump <= 1 && !player.fireHeld
      && player.fireReleaseElapsed < 0 && pose.sheet === 'authored' && pose.frame <= 1;
    return resolveRiderKinetics(player, active, debugImpactStage === null && player.alive);
  }

  secondaryAnchors(player: RiderPlayer, pose = this.bodyPose(player, null)): RiderSecondaryAnchors {
    const frames = SECONDARY_ANCHORS[HEROES[player.heroIndex].id][pose.sheet];
    return frames[Math.min(frames.length - 1, Math.max(0, pose.frame))];
  }

  wheelMotion(
    player: RiderPlayer,
    debugImpactStage: number | null,
    pose = this.bodyPose(player, debugImpactStage),
  ): RiderWheelMotion {
    const bodyKinetics = this.kinetics(player, debugImpactStage, pose);
    const groundedMotion = debugImpactStage === null && player.jump <= 1
      && (bodyKinetics.active || pose.sheet === 'sustained' || pose.sheet === 'release');
    return resolveRiderWheelMotion(player, groundedMotion);
  }

  muzzle(
    player: RiderPlayer,
    debugImpactStage: number | null,
    bodyX = player.x,
    bodyY = player.y - player.jump + 38,
    pose = this.bodyPose(player, debugImpactStage),
  ): RiderHardpoint {
    return this.hardpoint(player, bodyX, bodyY, pose, HERO_MUZZLE_SOURCE, this.kinetics(player, debugImpactStage, pose));
  }

  exhaust(
    player: RiderPlayer,
    debugImpactStage: number | null,
    bodyX = player.x,
    bodyY = player.y - player.jump + 38,
    pose = this.bodyPose(player, debugImpactStage),
  ): RiderHardpoint {
    return this.hardpoint(player, bodyX, bodyY, pose, HERO_EXHAUST_SOURCE, this.kinetics(player, debugImpactStage, pose));
  }

  private authoredFrame(player: RiderPlayer, debugImpactStage: number | null): number {
    let frame = 0;
    if (player.jump > 1) {
      if (player.jump < 9 && player.jumpV > 0) frame = 1;
      else if (player.jumpV > 105) frame = 4;
      else if (player.jumpV > -80) frame = 5;
      else if (player.jumpV < -185) frame = 6;
      else frame = 7;
    } else {
      const rideIndex = ((Math.floor(player.wheel) % GROUNDED_RIDE_CYCLE.length) + GROUNDED_RIDE_CYCLE.length)
        % GROUNDED_RIDE_CYCLE.length;
      frame = GROUNDED_RIDE_CYCLE[rideIndex];
    }
    return debugImpactStage === null
      ? frame
      : [0, 2, 2, 7, 7, 7, 7, 7, 0, 0, 0, 7][debugImpactStage];
  }

  private hardpoint(
    player: RiderPlayer,
    bodyX: number,
    bodyY: number,
    pose: RiderBodyPose,
    sourceMaps: Readonly<Record<'cassia' | 'bruna' | 'nova', HeroSourceMap>>,
    kinetics: RiderKineticPose,
  ): RiderHardpoint {
    const hero = HEROES[player.heroIndex].id;
    const size = HERO_AUTHORED_SIZE[hero];
    const points = sourceMaps[hero][pose.sheet];
    const source = points[Math.min(points.length - 1, Math.max(0, pose.frame))];
    const localX = (-size.width * size.anchorX + source[0] / 256 * size.width) * kinetics.scaleX;
    const localY = (-size.height * size.anchorY + source[1] / 192 * size.height) * kinetics.scaleY;
    const cos = Math.cos(kinetics.chassisPitch);
    const sin = Math.sin(kinetics.chassisPitch);
    return {
      x: bodyX + localX * cos - localY * sin,
      y: bodyY + kinetics.suspensionY + localX * sin + localY * cos,
      sourceX: source[0],
      sourceY: source[1],
      ...pose,
    };
  }
}
