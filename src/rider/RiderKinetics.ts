import type { HeroId, RiderPlayer } from './types';

export interface RiderKineticPose {
  readonly active: boolean;
  readonly cycleIndex: number;
  readonly signature: number;
  readonly suspensionY: number;
  readonly chassisPitch: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly secondaryA: number;
  readonly secondaryB: number;
  readonly wheelAngleIndex: number;
  readonly wheelAngle: number;
}

export interface RiderWheelGeometry {
  readonly rear: readonly [number, number];
  readonly front: readonly [number, number];
  readonly radius: number;
}

export interface RiderWheelMotion {
  readonly active: boolean;
  readonly angleIndex: number;
  readonly angle: number;
  readonly signature: number;
}

export const HERO_WHEEL_GEOMETRY: Readonly<Record<HeroId, RiderWheelGeometry>> = {
  cassia: { rear: [57, 144], front: [202, 144], radius: 29 },
  bruna: { rear: [51, 151], front: [207, 151], radius: 29 },
  nova: { rear: [59, 148], front: [199, 148], radius: 28 },
};

const RIDE_POSES = [
  // The chassis travels through a readable two-beat suspension cycle while the
  // two cloth pieces lag independently.  Values are intentionally quantised:
  // the extrema move the silhouette by 6+ screen pixels without introducing
  // a source-sprite pose that can lose the gun, wheels or rider anatomy.
  { suspensionY: 0, chassisPitch: -.009, scaleX: 1.002, scaleY: .998, secondaryA: -10, secondaryB: 2 },
  { suspensionY: -3, chassisPitch: -.018, scaleX: 1.006, scaleY: .992, secondaryA: -4, secondaryB: 8 },
  { suspensionY: -5, chassisPitch: -.027, scaleX: 1.009, scaleY: .987, secondaryA: 5, secondaryB: 13 },
  { suspensionY: -3, chassisPitch: -.015, scaleX: 1.006, scaleY: .992, secondaryA: 11, secondaryB: 7 },
  { suspensionY: 0, chassisPitch: .005, scaleX: 1, scaleY: 1.002, secondaryA: 13, secondaryB: -2 },
  { suspensionY: 3, chassisPitch: .019, scaleX: .994, scaleY: 1.014, secondaryA: 6, secondaryB: -11 },
  { suspensionY: 5, chassisPitch: .029, scaleX: .989, scaleY: 1.021, secondaryA: -5, secondaryB: -14 },
  { suspensionY: 3, chassisPitch: .019, scaleX: .994, scaleY: 1.014, secondaryA: -13, secondaryB: -7 },
  { suspensionY: 0, chassisPitch: .006, scaleX: 1, scaleY: 1.002, secondaryA: -12, secondaryB: 4 },
  { suspensionY: -3, chassisPitch: -.012, scaleX: 1.005, scaleY: .993, secondaryA: -4, secondaryB: 13 },
  { suspensionY: -5, chassisPitch: -.024, scaleX: 1.008, scaleY: .988, secondaryA: 7, secondaryB: 10 },
  { suspensionY: -2, chassisPitch: -.007, scaleX: 1.003, scaleY: .997, secondaryA: 13, secondaryB: 1 },
] as const;

const NEUTRAL: RiderKineticPose = Object.freeze({
  active: false,
  cycleIndex: 0,
  signature: 0,
  suspensionY: 0,
  chassisPitch: 0,
  scaleX: 1,
  scaleY: 1,
  secondaryA: 0,
  secondaryB: 0,
  wheelAngleIndex: 0,
  wheelAngle: 0,
});

const NEUTRAL_WHEELS: RiderWheelMotion = Object.freeze({
  active: false,
  angleIndex: 0,
  angle: 0,
  signature: 0,
});

function positiveMod(value: number, modulus: number) {
  return ((value % modulus) + modulus) % modulus;
}

/** Quantised internal motion shared by rendering, hardpoints and motion tests. */
export function resolveRiderKinetics(player: RiderPlayer, active: boolean): RiderKineticPose {
  if (!active) return NEUTRAL;
  // A dedicated simulation clock prevents road-speed changes and PNG capture
  // cost from aliasing the suspension or the eight wheel angles.
  const cycleIndex = positiveMod(Math.floor(player.kineticClock * 10), RIDE_POSES.length);
  const wheelAngleIndex = positiveMod(Math.floor(player.kineticClock * 8), 8);
  const phase = RIDE_POSES[cycleIndex];
  return {
    active: true,
    cycleIndex,
    signature: cycleIndex * 8 + wheelAngleIndex,
    ...phase,
    wheelAngleIndex,
    wheelAngle: wheelAngleIndex * Math.PI / 4,
  };
}

/**
 * Wheel rotation is deliberately independent from the chassis pose. Sustained
 * fire keeps a neutral body transform so its authored gun/hardpoints cannot
 * drift, but a grounded bike still has visible road speed.
 */
export function resolveRiderWheelMotion(player: RiderPlayer, active: boolean): RiderWheelMotion {
  if (!active) return NEUTRAL_WHEELS;
  const angleIndex = positiveMod(Math.floor(player.kineticClock * 8), 8);
  return {
    active: true,
    angleIndex,
    angle: angleIndex * Math.PI / 4,
    signature: angleIndex,
  };
}
