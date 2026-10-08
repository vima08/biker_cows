import { HERO_AUTHORED_SIZE, HEROES } from './catalog';
import { HERO_WHEEL_GEOMETRY } from './RiderKinetics';
import type { RiderEnemy, RiderPlayer } from './types';

const ENEMY_CONTACT_OFFSETS: Readonly<Record<RiderEnemy['kind'], number>> = {
  mine: 28, tank: 24, rider: 34, miniboss: 48, boss: 110,
  drone: 0, skimmer: 0, pod: 0,
};

/** Stable road contact, independent of jump, recoil and suspension animation. */
export function playerRoadDepth(player: RiderPlayer): number {
  const hero = HEROES[player.heroIndex].id;
  const size = HERO_AUTHORED_SIZE[hero];
  const wheels = HERO_WHEEL_GEOMETRY[hero];
  return player.y + 38 + ((Math.max(wheels.rear[1], wheels.front[1]) + wheels.radius) / 192 - size.anchorY) * size.height;
}

/** Resting contact points of the authored silhouettes, in canvas pixels. */
export function enemyRoadDepth(enemy: RiderEnemy): number {
  return enemy.y + ENEMY_CONTACT_OFFSETS[enemy.kind];
}
