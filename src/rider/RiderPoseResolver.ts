import {
  FIRE_RELEASE_DURATION,
  HERO_AUTHORED_SIZE,
  HERO_EXHAUST_SOURCE,
  HERO_MUZZLE_SOURCE,
  HEROES,
} from './catalog';
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
      return { sheet: 'sustained', frame: ((Math.floor(player.fireLoop * 9) % 4) + 4) % 4 };
    }
    if (debugImpactStage === null && grounded && player.fireReleaseElapsed >= 0 && player.fireReleaseElapsed < FIRE_RELEASE_DURATION) {
      return {
        sheet: 'release',
        frame: Math.min(2, Math.floor(player.fireReleaseElapsed / (FIRE_RELEASE_DURATION / 3))),
      };
    }
    return { sheet: 'authored', frame: this.authoredFrame(player, debugImpactStage) };
  }

  muzzle(
    player: RiderPlayer,
    debugImpactStage: number | null,
    bodyX = player.x,
    bodyY = player.y - player.jump + 38,
    pose = this.bodyPose(player, debugImpactStage),
  ): RiderHardpoint {
    return this.hardpoint(player, bodyX, bodyY, pose, HERO_MUZZLE_SOURCE);
  }

  exhaust(
    player: RiderPlayer,
    debugImpactStage: number | null,
    bodyX = player.x,
    bodyY = player.y - player.jump + 38,
    pose = this.bodyPose(player, debugImpactStage),
  ): RiderHardpoint {
    return this.hardpoint(player, bodyX, bodyY, pose, HERO_EXHAUST_SOURCE);
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
      frame = [0, 0, 3, 3, 6, 6, 7, 7][((Math.floor(player.wheel) % 8) + 8) % 8];
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
  ): RiderHardpoint {
    const hero = HEROES[player.heroIndex].id;
    const size = HERO_AUTHORED_SIZE[hero];
    const points = sourceMaps[hero][pose.sheet];
    const source = points[Math.min(points.length - 1, Math.max(0, pose.frame))];
    const left = bodyX - size.width * size.anchorX;
    const top = bodyY - size.height * size.anchorY;
    return {
      x: left + source[0] / 256 * size.width,
      y: top + source[1] / 192 * size.height,
      sourceX: source[0],
      sourceY: source[1],
      ...pose,
    };
  }
}
