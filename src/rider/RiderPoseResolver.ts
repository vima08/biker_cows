import {
  FIRE_RELEASE_DURATION,
  GROUNDED_RIDE_CYCLE,
  HERO_AUTHORED_SIZE,
  HERO_EXHAUST_SOURCE,
  HERO_MUZZLE_SOURCE,
  HERO_SUSTAINED_FIRE_CYCLE,
  HEROES,
} from './catalog';
import { resolveRiderKinetics, type RiderKineticPose } from './RiderKinetics';
import type { HeroBodySheet, HeroSourceMap, RiderPlayer } from './types';

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
    return resolveRiderKinetics(player, active);
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
