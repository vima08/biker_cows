import type { HeroId, HeroSourceMap, HeroSpec, IntroPanel } from './types';
import { assetUrl } from '../assetUrl';

export const HEROES: readonly HeroSpec[] = [
  { id: 'cassia', name: 'CASSIA', epithet: 'THE SOLAR CAPTAIN', color: '#d99a42', accent: '#ffcf32', maxHp: 110, maxArmor: 45, speed: 330, fireRate: .145, weapon: 'blaster', special: 'SUNBURST FOCUS', stats: [4, 4, 4] },
  { id: 'bruna', name: 'BRUNA', epithet: 'THE IRON HORN', color: '#aab2c1', accent: '#55d6ff', maxHp: 150, maxArmor: 80, speed: 285, fireRate: .24, weapon: 'spread', special: 'GRAVITY STOMP', stats: [5, 2, 5] },
  { id: 'nova', name: 'NOVA', epithet: 'THE WILD COMET', color: '#f1e6d3', accent: '#ff4b72', maxHp: 90, maxArmor: 30, speed: 375, fireRate: .105, weapon: 'laser', special: 'VENUS RUSH', stats: [3, 5, 2] },
];

export const INTRO_PANELS: readonly IntroPanel[] = [
  { src: assetUrl('assets/intro/venus-beach-01-rest.png'), kicker: 'VENUS BOARDWALK // 18:42 LOCAL', title: 'A PERFECT DAY OFF.', caption: 'CASSIA: "Quiet suits us."   BRUNA: "Last set."   NOVA: "Last wave!"', duration: 5.2, pan: -12 },
  { src: assetUrl('assets/intro/venus-beach-02-blast.png'), kicker: 'THEN THE HORIZON BLINKS.', title: 'KRA-KOOM!', caption: 'One blast. Three heads turn. The day off is officially over.', duration: 4.1, pan: 10 },
  { src: assetUrl('assets/intro/venus-beach-03-jackets.png'), kicker: 'NO SPEECHES. NO HESITATION.', title: 'JACKETS ON.', caption: 'Leather, engines and a rising column of smoke. Just like old times.', duration: 4.2, pan: -8 },
  { src: assetUrl('assets/intro/venus-beach-04-ride.png'), kicker: 'VACATION STATUS: CANCELLED', title: 'GIRLS... RIDE.', caption: 'The Venus skyway is waiting - and trouble never waits politely.', duration: 4.6, pan: 14 },
];

export const OUTRO_PANELS: readonly IntroPanel[] = [
  { src: assetUrl('assets/outro/venus-victory-01-parade.png'), kicker: 'VENUS CITY // THE ROAD HOME', title: 'THEY REMEMBER.', caption: 'The engines roll slowly now. Every raised fist says the same thing: Venus is free.', duration: 5.4, pan: -14 },
  { src: assetUrl('assets/outro/venus-victory-02-fireworks.png'), kicker: 'TONIGHT, THE SKY ANSWERS.', title: 'VENUS RIDES FREE.', caption: 'CASSIA: "Worth the detour."   BRUNA: "Almost."   NOVA: "Best vacation ever!"', duration: 7.2, pan: 12 },
];

export const HERO_AUTHORED_SIZE: Readonly<Record<HeroId, { width: number; height: number; anchorX: number; anchorY: number }>> = {
  cassia: { width: 208, height: 156, anchorX: .48, anchorY: .74 },
  bruna: { width: 220, height: 164, anchorX: .5, anchorY: .75 },
  nova: { width: 202, height: 152, anchorX: .48, anchorY: .73 },
};

// Authored cells 0 and 1 are the only shared upright ride family on all three
// hero sheets. Keep the original eight wheel-tick period, but hold each subtle
// suspension/clothing phase for four ticks. The remaining cells are reserved
// for explicit fire, crouch and airborne/wheelie actions.
export const GROUNDED_RIDE_CYCLE = [0, 0, 0, 0, 1, 1, 1, 1] as const;

// The sustained atlas contains several incompatible weapon elevations. These
// per-hero loops retain only cells whose bike/body silhouette and visible gun
// stay in one recoil family. Nova has one unambiguous blaster pose, so muzzle
// flashes and projectiles provide its motion without making the weapon vanish.
export const HERO_SUSTAINED_FIRE_CYCLE: Readonly<Record<HeroId, readonly number[]>> = {
  cassia: [0, 0, 2, 2],
  // Bruna's raised cannon cell is the only held pose that shares the release
  // sheet's opening silhouette; holding it also removes the old arm jump.
  bruna: [1, 1, 1, 1],
  nova: [2, 2, 2, 2],
};

// Source-cell hardpoints keep projectiles and exhaust attached to the authored
// sprite even when animation switches between ride, held-fire and release sheets.
export const HERO_MUZZLE_SOURCE = {
  cassia: {
    authored: [[235, 105], [240, 105], [218, 67], [201, 111], [196, 111], [198, 109], [210, 107], [198, 112]],
    sustained: [[218, 89], [243, 108], [220, 91], [243, 108]],
    release: [[219, 83], [219, 93], [225, 120]],
  },
  bruna: {
    authored: [[231, 112], [239, 111], [220, 68], [230, 110], [228, 110], [232, 110], [222, 106], [231, 108]],
    sustained: [[233, 101], [225, 75], [229, 105], [244, 112]],
    release: [[227, 79], [224, 80], [225, 115]],
  },
  nova: {
    authored: [[221, 104], [222, 105], [220, 63], [220, 106], [223, 108], [220, 110], [219, 105], [223, 111]],
    sustained: [[219, 106], [220, 106], [223, 73], [220, 107]],
    release: [[225, 66], [221, 69], [225, 122]],
  },
} as const satisfies Readonly<Record<HeroId, HeroSourceMap>>;

export const HERO_EXHAUST_SOURCE = {
  cassia: {
    authored: [[21, 145], [22, 145], [23, 147], [25, 145], [18, 143], [30, 147], [25, 146], [23, 146]],
    sustained: [[24, 146], [25, 146], [24, 146], [24, 146]],
    release: [[23, 146], [24, 146], [24, 146]],
  },
  bruna: {
    authored: [[13, 153], [14, 154], [14, 155], [15, 154], [12, 158], [18, 154], [15, 154], [13, 154]],
    sustained: [[13, 154], [14, 154], [13, 154], [14, 154]],
    release: [[13, 154], [14, 154], [14, 154]],
  },
  nova: {
    authored: [[27, 147], [27, 147], [28, 148], [29, 148], [25, 150], [29, 148], [28, 148], [27, 148]],
    sustained: [[27, 148], [28, 148], [27, 148], [28, 148]],
    release: [[27, 148], [28, 148], [28, 148]],
  },
} as const satisfies Readonly<Record<HeroId, HeroSourceMap>>;

export const FIRE_RELEASE_DURATION = .15;
