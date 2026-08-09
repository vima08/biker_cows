/**
 * Procedural 16-bit inspired artwork for the Biker Mice fan prototype.
 *
 * Everything in this module is drawn directly to Canvas 2D.  Coordinates are
 * authored for a 480x270 logical canvas; upscale the canvas with CSS and keep
 * image smoothing disabled for clean nearest-neighbour pixels.
 */

export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 270;

export const Palette = Object.freeze({
  ink: "#100d20",
  ink2: "#24152f",
  night: "#1c1b4b",
  violet: "#3c2e63",
  mauve: "#6f3e6b",
  haze: "#a8546c",
  sunset: "#e46f67",
  sand: "#f0aa6b",
  cream: "#ffe0a3",
  white: "#fff5d6",
  red: "#d9364b",
  hotRed: "#ff4d4d",
  orange: "#f7793b",
  yellow: "#ffd35a",
  acid: "#a8e85c",
  green: "#47b878",
  cyan: "#50d8d7",
  blue: "#3981bd",
  steel: "#71859b",
  paleSteel: "#b8c4bf",
  darkSteel: "#343e50",
  rubber: "#171622",
  road: "#312b3b",
  bone: "#d2b485",
  brown: "#75424e",
  smoke: "#746879",
});

export type HeroId = "throttle" | "modo" | "vinnie";
export type EnemyKind = "crawler" | "raider" | "turret" | "drone" | "wasp" | "bomber";
export type BossKind = "roadReaper" | "plutarkianDreadnought";
export type PickupKind = "health" | "armor" | "spread" | "plasma" | "rocket" | "overdrive" | "score";
export type BulletKind = "hero" | "spread" | "plasma" | "rocket" | "enemy" | "boss";
export type ParticleKind = "spark" | "smoke" | "dust" | "debris" | "flame" | "star";

export interface SpriteOptions {
  /** Animation tick; integer values look best. */
  frame?: number;
  /** Sprite scale in logical pixels. */
  scale?: number;
  /** Mirror around the sprite origin. */
  flipX?: boolean;
  /** White-hot damage flash from 0..1. */
  flash?: number;
  /** Optional banking/lean in radians. */
  angle?: number;
  /** 0..1 intensity used by exhaust and weapon glows. */
  power?: number;
  /** Explicit weapon pose. When omitted, legacy frame-driven muzzle flicker is used. */
  firing?: boolean;
  /** Explicit jump pose. When omitted, a non-zero angle still implies airborne. */
  airborne?: boolean;
  /** 0..1 weapon kick, useful for a staged three-frame firing animation. */
  recoil?: number;
  /** Enemy hit pose: 0 pre-hit, 1 crushed recoil, 2 debris/recovery. */
  reaction?: number;
}

export interface BackgroundOptions {
  cameraX?: number;
  time?: number;
  speed?: number;
  storm?: number;
  roadY?: number;
}

export interface HudOptions {
  health: number;
  maxHealth: number;
  armor?: number;
  score?: number;
  combo?: number;
  weapon?: PickupKind;
  bossHealth?: number;
  bossName?: string;
  hero?: HeroId;
}

export interface ParticleVisual {
  kind: ParticleKind;
  x: number;
  y: number;
  life: number;
  size?: number;
  color?: string;
  angle?: number;
}

const P = Palette;
type Ctx = CanvasRenderingContext2D;

function px(n: number): number { return Math.round(n); }

function polygon(ctx: Ctx, color: string, points: ReadonlyArray<readonly [number, number]>): void {
  if (!points.length) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(px(points[0][0]), px(points[0][1]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(px(points[i][0]), px(points[i][1]));
  ctx.closePath();
  ctx.fill();
}

function line(ctx: Ctx, color: string, width: number, points: ReadonlyArray<readonly [number, number]>): void {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.moveTo(px(points[0][0]), px(points[0][1]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(px(points[i][0]), px(points[i][1]));
  ctx.stroke();
}

function dot(ctx: Ctx, color: string, x: number, y: number, w = 1, h = w): void {
  ctx.fillStyle = color;
  ctx.fillRect(px(x), px(y), px(w), px(h));
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function withSprite(ctx: Ctx, x: number, y: number, options: SpriteOptions, draw: () => void): void {
  ctx.save();
  ctx.translate(px(x), px(y));
  if (options.angle) ctx.rotate(options.angle);
  const scale = options.scale ?? 1;
  ctx.scale((options.flipX ? -1 : 1) * scale, scale);
  const flash = Math.max(0, Math.min(1, options.flash ?? 0));
  if (flash > 0) ctx.filter = `brightness(${1 + flash * 3.5}) saturate(${1 - flash})`;
  draw();
  ctx.restore();
}

/** Configure a canvas as a crisp 480x270 render target. */
export function configurePixelCanvas(canvas: HTMLCanvasElement, cssScale = 2): Ctx {
  canvas.width = LOGICAL_WIDTH;
  canvas.height = LOGICAL_HEIGHT;
  canvas.style.width = `${LOGICAL_WIDTH * cssScale}px`;
  canvas.style.height = `${LOGICAL_HEIGHT * cssScale}px`;
  canvas.style.imageRendering = "pixelated";
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not supported");
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function drawMoon(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px(x), px(y), px(r), 0, Math.PI * 2);
  ctx.fill();
  dot(ctx, P.haze, x - r * .45, y - r * .2, r * .28);
  dot(ctx, P.mauve, x + r * .18, y + r * .18, r * .2);
  dot(ctx, P.sunset, x - r * .05, y + r * .45, r * .12);
}

/** Draw all distant scenery, including the track. Call before entities. */
export function drawMartianParallax(ctx: Ctx, options: BackgroundOptions = {}): void {
  const cameraX = options.cameraX ?? 0;
  const time = options.time ?? 0;
  const speed = options.speed ?? 1;
  const storm = Math.max(0, Math.min(1, options.storm ?? 0));
  const roadY = options.roadY ?? 222;

  // Seven hard color bands provide a dramatic sky without blurry gradients.
  const skyBands = [P.ink, P.night, P.violet, P.mauve, P.haze, P.sunset, P.sand];
  skyBands.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, i * 27, LOGICAL_WIDTH, 29);
  });
  ctx.fillStyle = storm > .5 ? P.mauve : P.sunset;
  ctx.fillRect(0, 177, LOGICAL_WIDTH, 45);

  // Stable stars plus a few horizontal speed glints.
  for (let i = 0; i < 48; i++) {
    const sx = wrap(hash(i) * 520 - cameraX * .025, 520) - 20;
    const sy = 7 + hash(i + 80) * 116;
    const bright = hash(i + 140) > .72;
    dot(ctx, bright ? P.cream : P.haze, sx, sy, bright ? 2 : 1, 1);
  }
  for (let i = 0; i < Math.floor(4 + speed * 4); i++) {
    const sx = wrap(hash(i + 300) * 510 - time * (18 + i * 3) * speed, 520) - 20;
    const sy = 30 + hash(i + 340) * 150;
    dot(ctx, P.cream, sx, sy, 3 + speed * 3, 1);
  }

  drawMoon(ctx, wrap(365 - cameraX * .018, 620) - 70, 53, 34, P.orange);
  drawMoon(ctx, wrap(102 - cameraX * .04, 650) - 85, 101, 14, P.cyan);

  // Far skyline: chunky silhouettes, antennae and lit windows.
  const cityOffset = cameraX * .11;
  for (let i = -2; i < 23; i++) {
    const w = 21 + Math.floor(hash(i + 401) * 20);
    const h = 19 + Math.floor(hash(i + 501) * 56);
    const x = wrap(i * 31 - cityOffset, 680) - 50;
    const y = 189 - h;
    ctx.fillStyle = i % 3 === 0 ? P.ink2 : P.night;
    ctx.fillRect(px(x), y, w, h);
    if (i % 4 === 0) {
      line(ctx, P.ink2, 2, [[x + w * .5, y], [x + w * .5, y - 12]]);
      dot(ctx, P.red, x + w * .5 - 1, y - 14, 2, 2);
    }
    for (let wy = y + 7; wy < 185; wy += 9) {
      if (hash(i * 19 + wy) > .45) dot(ctx, hash(wy + i) > .5 ? P.orange : P.cyan, x + 5, wy, 3, 2);
      if (w > 28 && hash(i * 23 + wy) > .55) dot(ctx, P.haze, x + w - 8, wy, 3, 2);
    }
  }

  // Distant mesas.
  const far = -wrap(cameraX * .18, 360);
  for (let repeat = -1; repeat < 3; repeat++) {
    const x = far + repeat * 360;
    polygon(ctx, P.brown, [[x, 202], [x + 26, 169], [x + 48, 166], [x + 62, 142], [x + 110, 141], [x + 126, 177], [x + 161, 179], [x + 193, 203]]);
    polygon(ctx, P.haze, [[x + 49, 166], [x + 63, 145], [x + 107, 145], [x + 116, 166]]);
  }

  // Foreground industrial conduit line and refinery stacks.
  const pipeOffset = -wrap(cameraX * .43, 510);
  for (let repeat = -1; repeat < 3; repeat++) {
    const x = pipeOffset + repeat * 510;
    ctx.fillStyle = P.darkSteel;
    ctx.fillRect(px(x + 25), 177, 9, roadY - 177);
    ctx.fillRect(px(x + 228), 160, 12, roadY - 160);
    ctx.fillRect(px(x + 22), 178, 221, 7);
    ctx.fillStyle = P.steel;
    ctx.fillRect(px(x + 24), 178, 217, 2);
    dot(ctx, P.orange, x + 28, 187, 3, 4);
    dot(ctx, P.cyan, x + 232, 169, 3, 5);
    ctx.fillStyle = P.ink2;
    ctx.fillRect(px(x + 320), 142, 27, roadY - 142);
    polygon(ctx, P.darkSteel, [[x + 315, 142], [x + 352, 142], [x + 346, 133], [x + 322, 133]]);
    dot(ctx, P.red, x + 326, 151, 15, 4);
    const smokeY = 125 - wrap(time * 7 + repeat * 11, 24);
    dot(ctx, P.smoke, x + 327, smokeY, 13, 6);
    dot(ctx, P.mauve, x + 333, smokeY - 8, 17, 7);
  }

  // Track, lane markers, perspective seams and fast foreground grit.
  ctx.fillStyle = P.ink2;
  ctx.fillRect(0, roadY - 4, LOGICAL_WIDTH, 4);
  ctx.fillStyle = P.road;
  ctx.fillRect(0, roadY, LOGICAL_WIDTH, LOGICAL_HEIGHT - roadY);
  ctx.fillStyle = P.darkSteel;
  ctx.fillRect(0, roadY + 35, LOGICAL_WIDTH, 4);
  const markerShift = wrap(cameraX * 1.2 + time * speed * 55, 52);
  for (let x = -52 - markerShift; x < LOGICAL_WIDTH + 52; x += 52) {
    polygon(ctx, P.sand, [[x, roadY + 20], [x + 22, roadY + 20], [x + 29, roadY + 23], [x + 4, roadY + 23]]);
  }
  const gritShift = wrap(cameraX * 1.8 + time * speed * 80, 67);
  for (let i = -1; i < 9; i++) {
    const x = i * 67 - gritShift;
    dot(ctx, i % 3 === 0 ? P.haze : P.steel, x, roadY + 42 + (i % 4), 8 + speed * 5, 1);
  }
}

function drawWheel(ctx: Ctx, x: number, y: number, frame: number, accent: string, r = 12, ridePhase = 0, airborne = false): void {
  // Tires visibly load and unload: phases 1/4 flatten the contact patch while
  // 2/5 are round, lifted rebound frames. This makes the road cycle readable
  // even when the rapidly spinning spokes alias at gameplay scale.
  const loaded = !airborne && (ridePhase === 3 || ridePhase === 4);
  const maxLoaded = !airborne && ridePhase === 4;
  const rebound = !airborne && ridePhase === 5;
  const squashY = maxLoaded ? .78 : loaded ? .87 : rebound ? 1.04 : 1;
  ctx.save(); ctx.translate(px(x), px(y)); ctx.scale(1, squashY);
  ctx.fillStyle = P.ink;
  ctx.beginPath(); ctx.arc(0, 0, px(r + 1), 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = P.rubber; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, px(r - 2), 0, Math.PI * 2); ctx.stroke();
  // Three rubber tones and moving tread blocks stop the tire reading as a flat ring.
  ctx.strokeStyle = P.ink2; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, px(r - 1), .2, 2.65); ctx.stroke();
  ctx.fillStyle = P.darkSteel;
  ctx.beginPath(); ctx.arc(0, 0, px(r - 4), 0, Math.PI * 2); ctx.fill();
  const spin = frame * .62 + ridePhase * .18;
  for (let i = 0; i < 6; i++) {
    const a = spin + i * Math.PI / 3;
    const ax = px(Math.cos(a) * 3); const ay = px(Math.sin(a) * 3);
    const bx = px(Math.cos(a) * (r - 5)); const by = px(Math.sin(a) * (r - 5));
    line(ctx, i % 2 ? P.steel : accent, 1, [[ax, ay], [bx, by]]);
  }
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  dot(ctx, P.paleSteel, -2, -2, 4, 4); dot(ctx, P.white, -1, -2, 2, 1);
  dot(ctx, P.white, -r + 2, -5, 2, 5); dot(ctx, P.steel, r - 2, -4, 2, 4);
  // Quantised tread glints jump between two unmistakable rotation poses.
  if (ridePhase % 2 === 0) { dot(ctx, P.steel, -7, r - 3, 5, 2); dot(ctx, P.ink, 6, -r, 4, 2); }
  else { dot(ctx, P.steel, 3, r - 3, 6, 2); dot(ctx, P.ink, -8, -r + 1, 4, 2); }
  ctx.restore();
  if (loaded) dot(ctx, P.ink, x - r + (maxLoaded ? 0 : 3), y + r - 2, r * 2 - (maxLoaded ? 0 : 6), maxLoaded ? 4 : 3);
}

// Six authored silhouettes: neutral, anticipation, muzzle kick, fork contact,
// maximum compression/counter-torso, and a visibly lifted rebound.
const rideLift = [0, -2, 0, 2, 5, -4] as const;
const ridePitch = [0, -2, -1, 3, 6, -4] as const;
const rideAngle = [0, -.038, -.064, .072, .098, -.082] as const;
const riderLag = [0, -2, 0, 3, 6, -4] as const;
const riderReach = [0, -3, 2, 4, -4, -2] as const;
const torsoCounter = [0, .035, -.048, -.07, -.13, .095] as const;

function drawRoadContact(ctx: Ctx, frame: number, rearX: number, frontX: number, wheelY: number, radius: number, airborne: boolean, power: number): void {
  if (airborne) return;
  const phase = frame % 6;
  const patch = [10, 12, 10, 18, 23, 13][phase];
  ctx.globalAlpha = .38;
  polygon(ctx, P.ink, [[rearX - radius, wheelY + radius - 1], [frontX + radius, wheelY + radius - 1], [frontX + radius - 4, wheelY + radius + 3], [rearX - radius + 5, wheelY + radius + 3]]);
  ctx.globalAlpha = 1;
  const frontPatch = phase === 3 ? patch + 5 : patch;
  dot(ctx, P.rubber, rearX - patch / 2, wheelY + radius - 1, patch, phase === 4 ? 4 : 2);
  dot(ctx, P.rubber, frontX - frontPatch / 2, wheelY + radius - 1, frontPatch, phase === 4 ? 4 : 2);
  const dustX = rearX - radius - 4 - (phase % 3) * 4;
  const dustY = wheelY + radius - 2 + (phase % 2);
  dot(ctx, phase % 2 ? P.sand : P.smoke, dustX, dustY, 5 + px(power * 4), 2);
  if (power > .82) dot(ctx, P.cream, dustX - 8, dustY - 2, 4, 1);
}

function drawExhaust(ctx: Ctx, frame: number, x: number, y: number, power: number, accent: string): void {
  const boost = power > .86;
  const length = 7 + px(power * 8) + frame % 3 * 2;
  polygon(ctx, P.ink, [[x + 2, y - 4], [x - length - 3, y], [x + 2, y + 4]]);
  polygon(ctx, boost ? P.hotRed : P.orange, [[x, y - 3], [x - length, y], [x, y + 3]]);
  polygon(ctx, P.yellow, [[x, y - 1], [x - Math.max(5, length - 5), y], [x, y + 1]]);
  if (boost) dot(ctx, P.white, x - 6 - frame % 3, y, 5, 1);
  dot(ctx, accent, x - length - 6 - frame % 2 * 3, y + 2, 3, 2);
}

function drawThrottleBike(ctx: Ctx, frame: number, power: number, airborne: boolean): void {
  const phase = frame % 6; const lift = airborne ? -3 : rideLift[phase]; const pitch = airborne ? -3 : ridePitch[phase];
  const rearY = airborne ? 6 : 8; const frontY = airborne ? 3 : 8;
  drawRoadContact(ctx, frame, -23, 27, 8, 13, airborne, power);
  drawWheel(ctx, -23, rearY, frame, P.yellow, 13, phase, airborne);
  drawWheel(ctx, 27, frontY, frame + 1, P.yellow, 13, (phase + 3) % 6, airborne);
  ctx.save(); if (!airborne) ctx.rotate(rideAngle[phase]);
  // Chrome double-cradle frame and long drag-bike fork.
  line(ctx, P.ink, 5, [[-23, 5], [-7, -10 + lift], [8, 4 + lift], [-23, 5], [14, -10 + lift + pitch], [27, frontY - 3]]);
  line(ctx, P.paleSteel, 2, [[-23, 5], [-7, -10 + lift], [8, 4 + lift], [-23, 5], [14, -10 + lift + pitch], [27, frontY - 3]]);
  line(ctx, P.ink, 5, [[13, -12 + lift + pitch], [27, frontY - 3]]); line(ctx, P.steel, 2, [[13, -12 + lift + pitch], [27, frontY - 3]]);
  polygon(ctx, P.ink, [[-19, -12 + lift], [-4, -17 + lift], [14, -14 + lift + pitch], [22, -7 + lift + pitch], [12, 1 + lift], [-19, 0 + lift]]);
  polygon(ctx, P.brown, [[-16, -10 + lift], [-3, -15 + lift], [13, -12 + lift + pitch], [18, -7 + lift], [9, -2 + lift], [-17, -3 + lift]]);
  polygon(ctx, P.red, [[-14, -11 + lift], [-2, -14 + lift], [12, -12 + lift + pitch], [17, -7 + lift], [9, -3 + lift], [-16, -4 + lift]]);
  polygon(ctx, P.hotRed, [[-7, -12 + lift], [10, -11 + lift + pitch], [14, -8 + lift], [-4, -8 + lift]]);
  polygon(ctx, P.yellow, [[-12, -7 + lift], [9, -7 + lift], [5, -4 + lift], [-14, -4 + lift]]);
  dot(ctx, P.cream, -9, -13 + lift, 12, 1); dot(ctx, P.ink2, -15, -1 + lift, 17, 2);
  // V-twin engine, pipes and headlamp nacelle.
  polygon(ctx, P.ink, [[-10, -5 + lift], [2, -7 + lift], [10, 2 + lift], [1, 7 + lift], [-12, 3 + lift]]);
  dot(ctx, P.steel, -7, -4 + lift, 8, 8); dot(ctx, P.paleSteel, -5, -2 + lift, 5, 2);
  dot(ctx, P.darkSteel, 2, -2 + lift, 6, 7); dot(ctx, P.paleSteel, 3, 0 + lift, 5, 2);
  dot(ctx, P.cyan, 0, 3 + lift, 3, 2); dot(ctx, P.white, 1, 3 + lift, 1, 1);
  line(ctx, P.steel, 2, [[2, 5 + lift], [10, 7 + lift], [14, 5 + lift]]);
  polygon(ctx, P.ink, [[14, -15 + lift + pitch], [25, -17 + lift + pitch], [30, -11 + lift + pitch], [24, -6 + lift], [16, -7 + lift]]);
  polygon(ctx, P.red, [[17, -13 + lift + pitch], [24, -14 + lift + pitch], [27, -11 + lift], [23, -8 + lift], [17, -9 + lift]]);
  dot(ctx, P.white, 25, -12 + lift + pitch, 4, 3); dot(ctx, P.yellow, 26, -11 + lift + pitch, 3, 2);
  dot(ctx, P.ink, 13, -11 + lift, 4, 4); dot(ctx, P.paleSteel, 14, -10 + lift, 2, 2);
  drawExhaust(ctx, frame, -17, -4 + lift, power, P.smoke);
  ctx.restore();
}

function drawModoBike(ctx: Ctx, frame: number, power: number, airborne: boolean): void {
  const phase = frame % 6; const lift = airborne ? -2 : px(rideLift[phase] * .65); const pitch = airborne ? -1 : ridePitch[phase];
  const rearY = airborne ? 6 : 8; const frontY = airborne ? 5 : 8;
  drawRoadContact(ctx, frame, -25, 26, 8, 14, airborne, power);
  drawWheel(ctx, -25, rearY, frame, P.cyan, 14, phase, airborne);
  drawWheel(ctx, 26, frontY, frame + 1, P.cyan, 14, (phase + 3) % 6, airborne);
  ctx.save(); if (!airborne) ctx.rotate(rideAngle[phase]);
  // Heavy armoured frame with an exposed turbine and reinforced fork.
  line(ctx, P.ink, 6, [[-25, 5], [-7, -12 + lift], [12, 4 + lift], [-25, 5], [12, -12 + lift + pitch], [26, frontY - 3]]);
  line(ctx, P.steel, 3, [[-25, 5], [-7, -12 + lift], [12, 4 + lift], [-25, 5], [12, -12 + lift + pitch], [26, frontY - 3]]);
  line(ctx, P.ink, 7, [[17, -14 + lift + pitch], [26, frontY - 3]]); line(ctx, P.paleSteel, 3, [[17, -14 + lift + pitch], [26, frontY - 3]]);
  polygon(ctx, P.ink, [[-22, -13 + lift], [-10, -19 + lift], [13, -18 + lift + pitch], [24, -8 + lift], [13, 2 + lift], [-23, 1 + lift]]);
  polygon(ctx, P.ink2, [[-18, -11 + lift], [-8, -16 + lift], [12, -15 + lift], [20, -8 + lift], [10, -2 + lift], [-20, -3 + lift]]);
  polygon(ctx, P.darkSteel, [[-17, -11 + lift], [-8, -15 + lift], [11, -14 + lift + pitch], [19, -8 + lift], [10, -3 + lift], [-19, -3 + lift]]);
  polygon(ctx, P.steel, [[-10, -13 + lift], [10, -12 + lift + pitch], [15, -8 + lift], [-5, -8 + lift]]);
  polygon(ctx, P.cyan, [[-17, -7 + lift], [9, -7 + lift], [5, -4 + lift], [-19, -4 + lift]]);
  dot(ctx, P.white, -8, -14 + lift, 10, 1); dot(ctx, P.blue, 3, -11 + lift, 8, 2);
  polygon(ctx, P.ink, [[-12, -5 + lift], [8, -5 + lift], [13, 5 + lift], [-9, 7 + lift], [-17, 2 + lift]]);
  dot(ctx, P.steel, -9, -3 + lift, 13, 8); dot(ctx, P.paleSteel, -6, -1 + lift, 7, 2);
  dot(ctx, P.darkSteel, 5, -2 + lift, 6, 7); dot(ctx, P.cyan, 6, 0 + lift, 4, 3); dot(ctx, P.white, 7, lift, 2, 1);
  line(ctx, P.paleSteel, 3, [[-12, 5 + lift], [9, 7 + lift], [16, 3 + lift]]);
  polygon(ctx, P.ink, [[14, -17 + lift + pitch], [28, -17 + lift + pitch], [32, -10 + lift], [25, -6 + lift], [17, -8 + lift]]);
  polygon(ctx, P.blue, [[17, -14 + lift + pitch], [26, -14 + lift], [29, -11 + lift], [24, -9 + lift], [18, -10 + lift]]);
  dot(ctx, P.white, 27, -12 + lift, 4, 3); dot(ctx, P.cyan, 28, -11 + lift, 3, 2);
  dot(ctx, P.ink, 15, -12 + lift, 5, 5); dot(ctx, P.steel, 16, -11 + lift, 3, 3);
  drawExhaust(ctx, frame, -20, -5 + lift, power, P.cyan);
  ctx.restore();
}

function drawVinnieBike(ctx: Ctx, frame: number, power: number, airborne: boolean): void {
  const phase = frame % 6; const lift = airborne ? -5 : rideLift[phase]; const pitch = airborne ? -5 : ridePitch[phase] * 2;
  const rearY = airborne ? 7 : 8; const frontY = airborne ? 1 : 8;
  drawRoadContact(ctx, frame, -19, 24, 8, 12, airborne, power);
  drawWheel(ctx, -19, rearY, frame, P.cyan, 11, phase, airborne);
  drawWheel(ctx, 24, frontY, frame + 1, P.cyan, 12, (phase + 3) % 6, airborne);
  ctx.save(); if (!airborne) ctx.rotate(rideAngle[phase]);
  // Short stunt-bike geometry with a high tail and compact engine.
  line(ctx, P.ink, 5, [[-19, 6], [-4, -9 + lift], [8, 5 + lift], [-19, 6], [9, -9 + lift + pitch], [24, frontY - 3]]);
  line(ctx, P.paleSteel, 2, [[-19, 6], [-4, -9 + lift], [8, 5 + lift], [-19, 6], [9, -9 + lift + pitch], [24, frontY - 3]]);
  line(ctx, P.ink, 5, [[13, -12 + lift + pitch], [24, frontY - 3]]); line(ctx, P.steel, 2, [[13, -12 + lift + pitch], [24, frontY - 3]]);
  polygon(ctx, P.ink, [[-19, -15 + lift], [-5, -19 + lift], [13, -13 + lift + pitch], [20, -7 + lift], [8, 1 + lift], [-18, 0 + lift]]);
  polygon(ctx, P.brown, [[-16, -13 + lift], [-4, -16 + lift], [12, -11 + lift + pitch], [17, -7 + lift], [7, -3 + lift], [-16, -4 + lift]]);
  polygon(ctx, P.orange, [[-14, -13 + lift], [-4, -15 + lift], [11, -11 + lift + pitch], [15, -7 + lift], [7, -3 + lift], [-15, -4 + lift]]);
  polygon(ctx, P.yellow, [[-9, -12 + lift], [9, -9 + lift + pitch], [12, -7 + lift], [-10, -8 + lift]]);
  polygon(ctx, P.red, [[-18, -15 + lift], [-13, -24 + lift], [-5, -18 + lift], [-7, -13 + lift]]);
  dot(ctx, P.cream, -8, -14 + lift, 10, 1); dot(ctx, P.hotRed, -14, -19 + lift, 3, 4);
  polygon(ctx, P.ink, [[-10, -5 + lift], [6, -6 + lift], [11, 4 + lift], [1, 7 + lift], [-12, 3 + lift]]);
  dot(ctx, P.darkSteel, -7, -3 + lift, 8, 8); dot(ctx, P.paleSteel, -5, -1 + lift, 6, 2);
  dot(ctx, P.steel, 2, -3 + lift, 6, 8); dot(ctx, P.cyan, 4, 0 + lift, 3, 3); dot(ctx, P.white, 4, lift, 2, 1);
  polygon(ctx, P.ink, [[11, -15 + lift + pitch], [24, -16 + lift + pitch], [29, -10 + lift], [24, -6 + lift], [14, -8 + lift]]);
  polygon(ctx, P.orange, [[15, -13 + lift + pitch], [23, -13 + lift], [26, -10 + lift], [22, -8 + lift], [15, -9 + lift]]);
  dot(ctx, P.white, 24, -11 + lift, 4, 2); dot(ctx, P.ink, 12, -11 + lift, 4, 4); dot(ctx, P.paleSteel, 13, -10 + lift, 2, 2);
  drawExhaust(ctx, frame, -16, -4 + lift, Math.min(1, power + .12), P.cyan);
  ctx.restore();
}

function drawMouseHead(ctx: Ctx, fur: string, shade: string, ear: string, visor: string, mohawk = false, phase = 0): void {
  // Separate ear/head/muzzle masses keep the face readable at gameplay scale.
  const earLag = [0, 1, 2, 1, -1, -2][phase % 6];
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(-2 - earLag, -43, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(-2 - earLag, -43, 4, 0, Math.PI * 2); ctx.fill();
  polygon(ctx, P.ink, [[-10, -29], [-10, -38], [-7, -44], [-1, -47], [7, -44], [12, -39], [15, -32], [11, -27], [4, -24], [-4, -25]]);
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(-6 + earLag, -42, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ear; ctx.beginPath(); ctx.arc(-6 + earLag, -42, 4, 0, Math.PI * 2); ctx.fill();
  polygon(ctx, fur, [[-7, -30], [-7, -38], [-3, -43], [5, -42], [10, -38], [12, -32], [8, -28], [2, -25], [-3, -27]]);
  polygon(ctx, shade, [[-7, -30], [-5, -36], [-1, -39], [0, -27], [-3, -27]]);
  dot(ctx, P.white, 1, -42, 5, 1); dot(ctx, shade, -5, -29, 4, 2);
  polygon(ctx, P.cream, [[7, -34], [15, -32], [12, -28], [6, -28]]);
  dot(ctx, P.ink, 13, -31, 4, 3); dot(ctx, P.white, 14, -31, 1, 1);
  polygon(ctx, P.ink, [[-5, -39], [9, -39], [12, -34], [8, -31], [-4, -32], [-7, -35]]);
  polygon(ctx, visor, [[-4, -37], [8, -37], [10, -34], [7, -33], [-3, -34]]);
  dot(ctx, P.white, -2, -37, 5, 1);
  if (mohawk) {
    polygon(ctx, P.ink, [[-1, -43], [1, -52], [5, -47], [8, -54], [11, -43]]);
    polygon(ctx, P.hotRed, [[1, -43], [2, -49], [5, -45], [8, -51], [9, -42]]);
    dot(ctx, P.orange, 3, -47, 2, 4);
  }
}

/** Draw one of the three heroes and their distinct motorcycle. Origin: ground contact center. */
export function drawHero(ctx: Ctx, hero: HeroId, x: number, y: number, options: SpriteOptions = {}): void {
  const frame = Math.floor(options.frame ?? 0);
  const phase = frame % 6;
  const power = Math.max(0, Math.min(1, options.power ?? .7));
  const hit = (options.flash ?? 0) > .05;
  const airborne = options.airborne ?? Math.abs(options.angle ?? 0) > .025;
  const firing = options.firing ?? frame % 11 < 3;
  const firePhase = firing ? frame % 3 : 0;
  const stagedKick = firing ? [1, 4, 2][firePhase] : 0;
  const gunRecoil = Math.max(stagedKick, px(Math.max(0, Math.min(1, options.recoil ?? 0)) * 5));
  const accelerating = power > .86;
  const crouch = airborne ? -4 : riderLag[phase] + (accelerating && phase === 1 ? 1 : 0);
  const bodyX = (hit ? -5 : 0) + riderReach[phase];
  const bodyY = crouch + (airborne ? -2 : riderLag[phase]);
  withSprite(ctx, x, y, options, () => {
    if (hero === "throttle") {
      drawThrottleBike(ctx, frame, power, airborne);
      ctx.save(); ctx.translate(bodyX, bodyY); if (!airborne) ctx.rotate(torsoCounter[phase]);
      // Long scarf, upright gunfighter torso and forward-reaching shooting arm.
      const scarfWave = [0, 2, 5, 7, 4, 1][(phase + 4) % 6] + (accelerating ? 5 : 0);
      polygon(ctx, P.ink, [[-7, -35 + crouch], [-26 - scarfWave, -31], [-18, -25], [-7, -27]]);
      polygon(ctx, P.red, [[-7, -33 + crouch], [-22 - scarfWave, -30], [-16, -27], [-5, -28]]);
      polygon(ctx, P.ink, [[-12, -31 + crouch], [-5, -38 + crouch], [7, -38 + crouch], [14, -29], [12, -15], [2, -11], [-11, -16]]);
      polygon(ctx, P.brown, [[-9, -30 + crouch], [-4, -35 + crouch], [6, -35 + crouch], [11, -28], [9, -18], [2, -14], [-8, -18]]);
      polygon(ctx, P.cream, [[-4, -33 + crouch], [5, -34 + crouch], [9, -27], [5, -21], [-3, -23]]);
      polygon(ctx, P.ink2, [[-8, -23], [3, -23], [4, -14], [-9, -16]]);
      line(ctx, P.ink, 7, [[5, -29], [17, -19], [25, -19]]);
      line(ctx, P.bone, 4, [[5, -29], [17, -19], [25, -19]]);
      polygon(ctx, P.ink, [[18 - gunRecoil, -22], [29 - gunRecoil, -22], [32 - gunRecoil, -19], [28 - gunRecoil, -16], [18 - gunRecoil, -17]]);
      polygon(ctx, P.darkSteel, [[20 - gunRecoil, -20], [28 - gunRecoil, -20], [29 - gunRecoil, -19], [27 - gunRecoil, -18], [20 - gunRecoil, -18]]);
      dot(ctx, P.paleSteel, 20 - gunRecoil, -21, 7, 1); dot(ctx, P.yellow, 25 - gunRecoil, -19, 3, 1);
      if (firing && firePhase !== 0) { polygon(ctx, firePhase === 1 ? P.white : P.yellow, [[31 - gunRecoil, -24], [42 - gunRecoil, -19], [31 - gunRecoil, -14]]); dot(ctx, P.orange, 32 - gunRecoil, -20, 7, 3); }
      drawMouseHead(ctx, P.bone, P.brown, P.sand, P.acid, false, phase);
      dot(ctx, P.darkSteel, -7, -19, 6, 7); dot(ctx, P.paleSteel, -6, -18, 4, 2);
      // Tail follows two beats behind the sprung frame.
      line(ctx, P.ink, 4, [[-10, -18], [-20, -15 + ridePitch[(phase + 4) % 6]], [-25, -19]]);
      line(ctx, P.bone, 2, [[-10, -18], [-20, -15 + ridePitch[(phase + 4) % 6]], [-25, -19]]);
      ctx.restore();
    } else if (hero === "modo") {
      drawModoBike(ctx, frame, power, airborne);
      ctx.save(); ctx.translate(bodyX, bodyY); if (!airborne) ctx.rotate(torsoCounter[phase]);
      // A low, broad triangle and the enormous prosthetic arm make Modo unmistakable.
      polygon(ctx, P.ink, [[-16, -33 + crouch], [-7, -41 + crouch], [8, -40 + crouch], [18, -30], [16, -14], [7, -10], [-15, -14], [-21, -24]]);
      polygon(ctx, P.blue, [[-13, -32 + crouch], [-6, -37 + crouch], [7, -37 + crouch], [14, -29], [12, -17], [5, -13], [-12, -16], [-17, -24]]);
      polygon(ctx, P.cyan, [[-8, -34 + crouch], [6, -35 + crouch], [10, -29], [-10, -29]]);
      polygon(ctx, P.ink2, [[-13, -23], [9, -23], [12, -14], [-14, -16]]);
      line(ctx, P.ink, 9, [[7, -31], [19, -25], [27, -16]]);
      line(ctx, P.steel, 6, [[8, -31], [19, -25], [27, -16]]);
      dot(ctx, P.paleSteel, 15, -27, 8, 5); dot(ctx, P.darkSteel, 19, -24, 4, 4);
      polygon(ctx, P.ink, [[22, -21], [31, -20], [35, -16], [30, -11], [23, -12]]);
      polygon(ctx, P.paleSteel, [[24, -19], [30, -18], [32, -16], [29, -13], [25, -14]]);
      dot(ctx, firing && firePhase === 1 ? P.white : P.cyan, 29 - gunRecoil, -17, firing ? 6 : 3, 3);
      if (firing && firePhase === 1) polygon(ctx, P.yellow, [[32 - gunRecoil, -21], [42 - gunRecoil, -16], [32 - gunRecoil, -11]]);
      drawMouseHead(ctx, P.steel, P.darkSteel, P.paleSteel, P.red, false, phase);
      // Heavy boot/braced leg.
      line(ctx, P.ink, 7, [[-8, -18], [-16, -10], [-10, -7]]); line(ctx, P.steel, 3, [[-8, -18], [-16, -10], [-10, -7]]);
      line(ctx, P.ink, 5, [[-13, -19], [-24, -17 + ridePitch[(phase + 4) % 6]], [-28, -13]]);
      line(ctx, P.steel, 2, [[-13, -19], [-24, -17 + ridePitch[(phase + 4) % 6]], [-28, -13]]);
      ctx.restore();
    } else {
      drawVinnieBike(ctx, frame, power, airborne);
      ctx.save(); ctx.translate(bodyX, bodyY); if (!airborne) ctx.rotate(torsoCounter[phase]);
      // Vinnie's narrow S-curve, mohawk and dual guns read as agile and reckless.
      const stunt = airborne ? -4 : 0;
      polygon(ctx, P.ink, [[-12, -33 + crouch + stunt], [-5, -40 + crouch], [7, -39 + crouch], [16, -29], [11, -13], [-10, -13], [-18, -23]]);
      polygon(ctx, P.white, [[-9, -32 + crouch + stunt], [-4, -36 + crouch], [6, -36 + crouch], [12, -28], [8, -17], [-8, -16], [-14, -23]]);
      polygon(ctx, P.orange, [[-11, -27], [-1, -32], [10, -24], [7, -18], [-10, -18]]);
      polygon(ctx, P.red, [[-10, -19], [8, -19], [12, -14], [-13, -14]]);
      line(ctx, P.ink, 6, [[4, -30], [18, -21], [27, -22]]); line(ctx, P.white, 3, [[4, -30], [18, -21], [27, -22]]);
      line(ctx, P.ink, 6, [[1, -25], [14, -16], [24, -16]]); line(ctx, P.bone, 3, [[1, -25], [14, -16], [24, -16]]);
      polygon(ctx, P.ink, [[20, -25], [31, -24], [32, -21], [28, -19], [20, -20]]);
      polygon(ctx, P.ink, [[18, -19], [28, -18], [30, -15], [26, -13], [18, -14]]);
      dot(ctx, P.cyan, 23 - gunRecoil, -23, 7, 2); dot(ctx, P.cyan, 21 - gunRecoil, -17, 7, 2);
      if (firing && firePhase !== 0) { polygon(ctx, P.white, [[31 - gunRecoil, -26], [41 - gunRecoil, -22], [31 - gunRecoil, -18]]); polygon(ctx, firePhase === 1 ? P.yellow : P.orange, [[29 - gunRecoil, -20], [38 - gunRecoil, -16], [29 - gunRecoil, -12]]); }
      drawMouseHead(ctx, P.white, P.steel, P.cream, P.blue, true, phase);
      dot(ctx, P.ink2, -9, -18, 8, 4); dot(ctx, P.cyan, -7, -17, 4, 1);
      line(ctx, P.ink, 4, [[-11, -17], [-22, -21 + ridePitch[(phase + 3) % 6]], [-28, -17]]);
      line(ctx, P.white, 2, [[-11, -17], [-22, -21 + ridePitch[(phase + 3) % 6]], [-28, -17]]);
      ctx.restore();
    }
    // One-frame impact recoil: a small back-edge highlight, not a silhouette-erasing flash.
    if (hit) { dot(ctx, P.white, -15, -38, 3, 8); dot(ctx, P.cyan, -19, -33, 2, 4); }
  });
}

function drawCrawler(ctx: Ctx, frame: number): void {
  const step = frame % 4 < 2 ? 3 : -3;
  // Low quadruped silhouette with four independently stepping scythe legs.
  for (const [sx, phase] of [[-1, 1], [1, -1]] as const) {
    line(ctx, P.ink, 6, [[sx * 8, 2], [sx * (17 + step * phase), 10], [sx * 25, 11]]);
    line(ctx, P.steel, 2, [[sx * 8, 2], [sx * (17 + step * phase), 10], [sx * 25, 11]]);
    polygon(ctx, P.paleSteel, [[sx * 22, 9], [sx * 29, 12], [sx * 22, 13]]);
  }
  polygon(ctx, P.ink, [[-20, -6], [-13, -15], [-4, -18], [13, -14], [20, -4], [14, 7], [-14, 7]]);
  polygon(ctx, P.brown, [[-16, -5], [-10, -12], [-3, -15], [10, -11], [16, -3], [11, 3], [-12, 3]]);
  polygon(ctx, P.red, [[-10, -11], [9, -9], [13, -4], [-13, -5]]);
  polygon(ctx, P.hotRed, [[-6, -9], [7, -8], [9, -6], [-8, -7]]);
  polygon(ctx, P.ink, [[-7, -16], [-2, -24], [5, -23], [9, -13]]);
  polygon(ctx, P.paleSteel, [[-4, -16], [0, -21], [4, -20], [6, -13]]);
  dot(ctx, frame % 6 < 2 ? P.white : P.yellow, 4, -18, 3, 3);
  polygon(ctx, P.ink, [[14, -7], [26, -5], [28, -1], [17, 1]]); dot(ctx, P.red, 18, -4, 7, 2);
}

function drawRaider(ctx: Ctx, frame: number, reaction = 0): void {
  const crushed = reaction === 1; const recovering = reaction === 2;
  const rearX = crushed ? -18 : recovering ? -16 : -15;
  const frontX = crushed ? 11 : recovering ? 18 : 16;
  const frontY = crushed ? 9 : recovering ? 7 : 6;
  drawWheel(ctx, rearX, crushed ? 7 : 6, frame, P.red, 9, crushed ? 4 : recovering ? 5 : 0);
  drawWheel(ctx, frontX, frontY, frame, P.red, 9, crushed ? 4 : recovering ? 5 : 0);
  line(ctx, P.ink, 5, [[rearX, 5], [-4, crushed ? -3 : -8], [6, crushed ? 6 : 4], [frontX, frontY - 1], [crushed ? 3 : 8, crushed ? -5 : -9]]);
  line(ctx, P.steel, 2, [[rearX, 5], [-4, crushed ? -3 : -8], [6, crushed ? 6 : 4], [frontX, frontY - 1], [crushed ? 3 : 8, crushed ? -5 : -9]]);
  polygon(ctx, P.ink, crushed ? [[-20,-4],[4,-8],[16,1],[8,7],[-20,2]] : [[-18,-8],[7,-12],[21,-3],[12,4],[-18,1]]);
  polygon(ctx, P.violet, crushed ? [[-16,-2],[3,-5],[11,1],[6,4],[-17,-1]] : [[-14,-6],[6,-9],[16,-3],[9,1],[-15,-2]]);
  polygon(ctx, P.mauve, crushed ? [[-7,-4],[4,-4],[8,0],[-8,-1]] : [[-5,-8],[7,-8],[12,-4],[-6,-5]]);
  dot(ctx, P.acid, -8, crushed ? 0 : -4, crushed ? 12 : 15, 2);
  ctx.save();
  if (crushed) { ctx.translate(-6, 3); ctx.rotate(-.27); }
  else if (recovering) { ctx.translate(-2, 1); ctx.rotate(.1); }
  polygon(ctx, P.ink, crushed ? [[-12,-15],[-8,-22],[4,-26],[13,-16],[8,-7],[-10,-8]] : [[-9,-18],[-4,-26],[7,-28],[14,-20],[11,-9],[-7,-10]]);
  polygon(ctx, P.acid, crushed ? [[-9,-15],[-5,-20],[3,-22],[9,-16],[6,-10],[-8,-11]] : [[-6,-18],[-2,-23],[6,-24],[10,-19],[8,-12],[-5,-13]]);
  polygon(ctx, P.ink, crushed ? [[-8,-24],[4,-28],[10,-23],[7,-18],[-3,-19],[-11,-21]] : [[-4,-27],[8,-29],[12,-25],[10,-20],[0,-20],[-6,-23]]);
  dot(ctx, P.yellow, crushed ? 1 : 5, crushed ? -24 : -26, 5, 2);
  if (crushed) {
    line(ctx, P.ink, 6, [[4,-16],[13,-8],[17,-4]]); line(ctx, P.green, 2, [[4,-16],[13,-8],[17,-4]]);
    polygon(ctx, P.paleSteel, [[14,-8],[23,-3],[21,1],[13,-4]]);
  } else if (recovering) {
    line(ctx, P.ink, 5, [[6,-19],[15,-12],[20,-6]]); line(ctx, P.green, 2, [[6,-19],[15,-12],[20,-6]]);
    polygon(ctx, P.paleSteel, [[17,-10],[25,-6],[24,-3],[16,-6]]);
  } else {
    line(ctx, P.ink, 5, [[6,-19],[17,-13],[24,-13]]); line(ctx, P.green, 2, [[6,-19],[17,-13],[24,-13]]);
    polygon(ctx, P.paleSteel, [[20,-16],[30,-14],[30,-11],[20,-11]]);
  }
  ctx.restore();
  if (crushed) {
    polygon(ctx, P.paleSteel, [[-26,-18],[-19,-20],[-22,-13]]);
    polygon(ctx, P.orange, [[19,-15],[27,-13],[22,-8]]);
  } else if (recovering) {
    polygon(ctx, P.steel, [[-26,-12],[-20,-16],[-18,-10]]);
    dot(ctx, P.orange, 24, -16, 4, 3); dot(ctx, P.smoke, 29, -20, 6, 4);
  }
  drawExhaust(ctx, frame, -16, crushed ? 0 : -3, recovering ? .48 : .75, P.smoke);
}

function drawTurret(ctx: Ctx, frame: number): void {
  // Compact tracked pillbox: broad base, faceted cupola, long recoil cannon.
  polygon(ctx, P.ink, [[-22, 3], [-17, -4], [14, -4], [22, 3], [18, 12], [-19, 12]]);
  polygon(ctx, P.rubber, [[-18, 2], [16, 2], [19, 7], [15, 10], [-16, 10], [-19, 7]]);
  for (let i = -14; i <= 12; i += 7) { dot(ctx, P.darkSteel, i, 4, 5, 5); dot(ctx, P.steel, i + 1, 5, 2, 2); }
  dot(ctx, P.paleSteel, -16, 1, 32, 2);
  polygon(ctx, P.ink, [[-14, -4], [-9, -14], [7, -17], [16, -10], [13, -2], [-12, 0]]);
  polygon(ctx, P.violet, [[-10, -5], [-6, -11], [6, -13], [12, -9], [10, -4]]);
  polygon(ctx, P.mauve, [[-5, -11], [6, -11], [9, -8], [-7, -7]]);
  dot(ctx, P.cyan, -6, -9, 4, 3); dot(ctx, P.red, 3, -10, 3, 2);
  const recoil = frame % 8 < 2 ? 3 : 0;
  line(ctx, P.ink, 8, [[5, -13], [27 - recoil, -20]]); line(ctx, P.paleSteel, 4, [[6, -13], [27 - recoil, -20]]);
  polygon(ctx, P.ink, [[23 - recoil, -24], [34 - recoil, -24], [38 - recoil, -20], [34 - recoil, -16], [23 - recoil, -17]]);
  polygon(ctx, P.red, [[27 - recoil, -22], [34 - recoil, -22], [35 - recoil, -20], [33 - recoil, -18], [27 - recoil, -19]]);
}

function drawDrone(ctx: Ctx, frame: number): void {
  const bank = frame % 4 < 2 ? -2 : 2;
  polygon(ctx, P.ink, [[-26, bank], [-12, -10], [11, -10], [27, bank], [12, 9], [-13, 9]]);
  polygon(ctx, P.darkSteel, [[-21, bank], [-9, -7], [9, -7], [22, bank], [9, 5], [-10, 5]]);
  polygon(ctx, P.steel, [[-15, -1], [-7, -6], [9, -5], [16, 0], [7, 3], [-9, 3]]);
  polygon(ctx, P.ink, [[-7, -8], [-3, -15], [6, -15], [11, -7]]);
  polygon(ctx, P.red, [[-4, -8], [-1, -12], [5, -12], [8, -7]]);
  dot(ctx, P.yellow, 1, -11, 4, 3); dot(ctx, P.white, 2, -11, 2, 1);
  polygon(ctx, P.cyan, [[-22, bank - 1], [-13, -5], [-14, 3]]); polygon(ctx, P.cyan, [[22, bank - 1], [13, -5], [14, 3]]);
  line(ctx, P.ink, 4, [[-9, 5], [-12, 14], [-7, 17]]); line(ctx, P.steel, 2, [[-9, 5], [-12, 14], [-7, 17]]);
  line(ctx, P.ink, 4, [[9, 5], [12, 14], [7, 17]]); line(ctx, P.steel, 2, [[9, 5], [12, 14], [7, 17]]);
  dot(ctx, frame % 3 ? P.orange : P.white, -18, 3, 5, 2); dot(ctx, frame % 3 ? P.orange : P.white, 14, 3, 5, 2);
}

function drawWasp(ctx: Ctx, frame: number): void {
  const flap = frame % 2 ? 5 : -7;
  polygon(ctx, P.ink, [[-4, -3], [-23, flap - 2], [-12, 10], [1, 5]]);
  polygon(ctx, P.cyan, [[-5, -2], [-19, flap], [-10, 7], [0, 3]]);
  polygon(ctx, P.ink, [[4, -4], [23, flap - 2], [12, 10], [-1, 5]]);
  polygon(ctx, P.blue, [[5, -2], [19, flap], [10, 7], [0, 3]]);
  polygon(ctx, P.ink, [[-10, -10], [6, -12], [15, -2], [8, 11], [-7, 10], [-15, 0]]);
  polygon(ctx, P.yellow, [[-7, -7], [5, -9], [11, -2], [6, 7], [-5, 7], [-11, 0]]);
  dot(ctx, P.ink2, -8, -4, 18, 4); dot(ctx, P.orange, -5, -3, 5, 2);
  polygon(ctx, P.red, [[3, -9], [9, -7], [11, -3], [5, -3]]); dot(ctx, P.white, 6, -7, 2, 1);
  polygon(ctx, P.ink, [[-11, -3], [-26, 1], [-27, 5], [-10, 4]]);
  polygon(ctx, P.paleSteel, [[-12, -1], [-24, 2], [-24, 3], [-11, 2]]);
  polygon(ctx, P.ink, [[7, 7], [12, 16], [8, 18], [3, 8]]);
}

function drawBomber(ctx: Ctx, frame: number): void {
  polygon(ctx, P.ink, [[-32, -5], [-20, -16], [-9, -20], [14, -18], [31, -6], [25, 5], [12, 10], [-20, 8]]);
  polygon(ctx, P.brown, [[-26, -5], [-17, -12], [-7, -16], [12, -14], [25, -5], [20, 2], [10, 5], [-18, 4]]);
  polygon(ctx, P.haze, [[-17, -10], [11, -11], [20, -5], [-21, -4]]);
  polygon(ctx, P.ink, [[-11, -16], [-5, -25], [8, -24], [15, -15]]);
  polygon(ctx, P.acid, [[-7, -16], [-3, -22], [6, -21], [11, -15]]);
  dot(ctx, P.ink2, -2, -21, 10, 4); dot(ctx, P.red, 3, -20, 4, 2);
  polygon(ctx, P.darkSteel, [[-30, -5], [-18, -3], [-23, 2]]); polygon(ctx, P.darkSteel, [[29, -5], [17, -3], [23, 2]]);
  dot(ctx, P.yellow, -23, -7, 4, 2); dot(ctx, P.yellow, 20, -7, 4, 2);
  polygon(ctx, P.ink, [[-8, 5], [8, 5], [11, 13], [0, 17], [-11, 13]]);
  polygon(ctx, P.red, [[-5, 7], [6, 7], [7, 11], [0, 14], [-7, 11]]);
  const jet = 8 + frame % 3 * 2;
  polygon(ctx, P.orange, [[-21, 5], [-17, 5 + jet], [-12, 6]]); polygon(ctx, P.yellow, [[-18, 6], [-17, 10 + frame % 2 * 2], [-15, 6]]);
  polygon(ctx, P.orange, [[14, 6], [18, 5 + jet], [23, 5]]); polygon(ctx, P.yellow, [[17, 6], [18, 10 + (frame + 1) % 2 * 2], [20, 6]]);
}

/** Draw a common ground or air enemy. Origin is the sprite center/ground point. */
export function drawEnemy(ctx: Ctx, kind: EnemyKind, x: number, y: number, options: SpriteOptions = {}): void {
  const frame = Math.floor(options.frame ?? 0);
  withSprite(ctx, x, y, options, () => {
    if (kind === "crawler") drawCrawler(ctx, frame);
    else if (kind === "raider") drawRaider(ctx, frame, Math.max(0, Math.min(2, Math.floor(options.reaction ?? 0))));
    else if (kind === "turret") drawTurret(ctx, frame);
    else if (kind === "drone") drawDrone(ctx, frame);
    else if (kind === "wasp") drawWasp(ctx, frame);
    else drawBomber(ctx, frame);
  });
}

function drawRoadReaper(ctx: Ctx, frame: number): void {
  drawWheel(ctx, -38, 13, frame, P.acid, 18); drawWheel(ctx, 34, 13, frame, P.acid, 17);
  // Node 1: exposed rear engine and wheel cage.
  polygon(ctx, P.ink, [[-55, -8], [-43, -21], [-25, -19], [-18, -3], [-25, 12], [-50, 11], [-58, 3]]);
  polygon(ctx, P.darkSteel, [[-50, -7], [-40, -16], [-28, -15], [-23, -3], [-29, 7], [-47, 7], [-53, 2]]);
  dot(ctx, P.steel, -45, -10, 13, 11); dot(ctx, P.paleSteel, -42, -8, 7, 2);
  for (let i = 0; i < 3; i++) line(ctx, P.ink2, 2, [[-31 + i * 3, -12], [-27 + i * 3, 2]]);
  drawExhaust(ctx, frame, -52, 0, .92, P.smoke);
  // Node 2: faceted central chassis and toxic power cell.
  polygon(ctx, P.ink, [[-27, -24], [8, -28], [28, -17], [31, 4], [18, 13], [-27, 10], [-34, -5]]);
  polygon(ctx, P.violet, [[-23, -20], [6, -23], [23, -14], [26, 2], [15, 8], [-23, 6], [-29, -5]]);
  polygon(ctx, P.mauve, [[-16, -18], [7, -19], [19, -12], [-20, -10]]);
  polygon(ctx, P.ink, [[-14, -13], [4, -15], [13, -7], [6, 3], [-13, 1], [-19, -6]]);
  polygon(ctx, P.acid, [[-10, -10], [3, -11], [9, -6], [4, -1], [-10, -2], [-14, -6]]);
  dot(ctx, P.white, -6 + frame % 3, -8, 7, 2);
  // Node 3: armoured rider/cockpit.
  polygon(ctx, P.ink, [[-16, -22], [-9, -39], [9, -43], [24, -27], [20, -16]]);
  polygon(ctx, P.green, [[-11, -23], [-6, -35], [7, -38], [19, -26], [16, -19]]);
  polygon(ctx, P.ink2, [[-5, -35], [9, -36], [15, -30], [8, -26], [-7, -28]]);
  dot(ctx, P.yellow, 5, -34, 6, 3); dot(ctx, P.white, 7, -34, 2, 1);
  // Node 4: long gun deck and separate saw-tooth ram.
  polygon(ctx, P.ink, [[20, -16], [42, -18], [51, -8], [47, 5], [27, 8], [24, 0]]);
  polygon(ctx, P.darkSteel, [[25, -13], [40, -14], [47, -7], [43, 1], [29, 4], [28, -1]]);
  const recoil = frame % 7 < 2 ? 4 : 0;
  line(ctx, P.ink, 9, [[28, -15], [51 - recoil, -29]]); line(ctx, P.paleSteel, 4, [[29, -15], [51 - recoil, -29]]);
  polygon(ctx, P.ink, [[46 - recoil, -34], [61 - recoil, -33], [65 - recoil, -28], [60 - recoil, -24], [47 - recoil, -25]]);
  polygon(ctx, P.red, [[51 - recoil, -31], [59 - recoil, -31], [61 - recoil, -28], [58 - recoil, -27], [51 - recoil, -28]]);
  polygon(ctx, P.ink, [[45, -5], [63, 0], [53, 5], [64, 10], [43, 9]]);
  polygon(ctx, P.paleSteel, [[47, -2], [58, 0], [51, 3], [59, 7], [45, 6]]);
}

function drawDreadnought(ctx: Ctx, frame: number, power: number): void {
  const damage = Math.max(0, Math.min(1, power));
  const pulse = frame % 4;
  // Ground node: a continuous tread with six readable bogies instead of two huge wheels.
  polygon(ctx, P.ink, [[-75, 10], [-65, 0], [57, 0], [74, 11], [65, 31], [-62, 31], [-78, 22]]);
  polygon(ctx, P.rubber, [[-69, 11], [-61, 5], [54, 5], [68, 13], [60, 26], [-59, 26], [-72, 20]]);
  for (let i = -53; i <= 51; i += 21) drawWheel(ctx, i, 16, frame, i % 2 ? P.red : P.violet, 10);
  polygon(ctx, P.darkSteel, [[-66, 8], [57, 8], [64, 12], [-67, 12]]);
  for (let x = -61; x < 59; x += 12) dot(ctx, P.steel, x, 25, 8, 2);

  // Node 1: rear reactor/engine block with vents and layered armour.
  polygon(ctx, P.ink, [[-72, 5], [-67, -25], [-53, -43], [-28, -40], [-18, -21], [-23, 7]]);
  polygon(ctx, P.darkSteel, [[-66, 2], [-62, -22], [-51, -36], [-32, -34], [-24, -20], [-28, 3]]);
  polygon(ctx, P.brown, [[-59, -21], [-49, -32], [-35, -30], [-29, -20], [-35, -11], [-55, -12]]);
  polygon(ctx, P.haze, [[-54, -25], [-48, -29], [-38, -27], [-34, -23], [-39, -20], [-52, -20]]);
  for (let i = 0; i < 4; i++) line(ctx, i === 0 ? P.paleSteel : P.ink2, 2, [[-62 + i * 5, -8], [-58 + i * 5, 2]]);
  dot(ctx, damage > .55 && frame % 3 === 0 ? P.white : P.orange, -57, -17, 5, 3);
  if (damage > .45) { polygon(ctx, P.ink, [[-65, -26], [-57, -20], [-62, -13], [-55, -8]]); dot(ctx, P.smoke, -69, -37 - pulse, 7 + pulse, 5); }

  // Node 2: central armour spine surrounding the exposed, glowing weak point.
  polygon(ctx, P.ink, [[-31, 4], [-28, -35], [-15, -49], [18, -48], [31, -31], [31, 4]]);
  polygon(ctx, P.violet, [[-25, 1], [-23, -31], [-12, -43], [15, -42], [25, -28], [25, 1]]);
  polygon(ctx, P.mauve, [[-18, -34], [-9, -40], [13, -39], [19, -32], [14, -24], [-13, -25]]);
  polygon(ctx, P.ink, [[-17, -25], [-8, -34], [10, -34], [19, -24], [12, -10], [-9, -9], [-20, -18]]);
  polygon(ctx, damage > .68 ? P.hotRed : P.cyan, [[-11, -23], [-5, -29], [8, -29], [13, -23], [8, -15], [-6, -15], [-13, -20]]);
  polygon(ctx, damage > .68 ? P.yellow : P.blue, [[-6, -22], [-2, -26], [6, -26], [9, -22], [5, -18], [-3, -18]]);
  dot(ctx, P.white, -1 + pulse, -24, 6, 3);
  // Breakaway armour plates and progressive cracks expose damage state.
  if (damage < .72) polygon(ctx, P.paleSteel, [[-26, -33], [-17, -45], [-7, -42], [-16, -29]]);
  else { line(ctx, P.hotRed, 2, [[-22, -38], [-17, -32], [-21, -25]]); dot(ctx, P.smoke, -21, -49 - pulse, 9, 6); }
  if (damage > .3) { line(ctx, P.ink, 2, [[19, -39], [13, -33], [20, -28], [14, -20]]); dot(ctx, P.orange, 17, -31, 3, 3); }

  // Node 3: raised alien command cab with crest and slit visor.
  polygon(ctx, P.ink, [[-13, -45], [-7, -65], [5, -73], [22, -65], [31, -45], [20, -35], [-3, -36]]);
  polygon(ctx, P.green, [[-7, -46], [-2, -60], [6, -67], [17, -61], [25, -46], [17, -39], [0, -40]]);
  polygon(ctx, P.acid, [[0, -58], [7, -64], [15, -59], [20, -51], [14, -45], [2, -46], [-3, -51]]);
  polygon(ctx, P.ink, [[-1, -57], [17, -57], [20, -52], [15, -48], [0, -49], [-4, -53]]);
  polygon(ctx, P.orange, [[2, -55], [16, -55], [17, -53], [14, -51], [1, -51]]); dot(ctx, P.white, 4, -55, 4, 1);
  polygon(ctx, P.ink, [[3, -67], [6, -78], [11, -70], [18, -75], [18, -63]]);
  polygon(ctx, P.red, [[6, -67], [7, -74], [10, -68], [15, -72], [15, -62]]);

  // Node 4: skull-like prow; jaw, cheek armour and ram are separate pieces.
  polygon(ctx, P.ink, [[27, -37], [42, -48], [62, -38], [75, -20], [70, 2], [49, 9], [29, -2], [20, -19]]);
  polygon(ctx, P.bone, [[31, -34], [43, -43], [58, -34], [69, -19], [65, -4], [49, 3], [33, -5], [25, -19]]);
  polygon(ctx, P.cream, [[43, -39], [56, -31], [64, -21], [57, -20], [43, -26]]);
  polygon(ctx, P.ink, [[38, -30], [55, -30], [61, -23], [54, -17], [39, -20], [33, -25]]);
  polygon(ctx, P.red, [[42, -27], [54, -27], [57, -23], [52, -20], [41, -22]]); dot(ctx, P.yellow, 47, -26, 6, 2);
  polygon(ctx, P.ink, [[49, -13], [70, -17], [76, -9], [69, -1], [48, -2], [42, -7]]);
  polygon(ctx, P.paleSteel, [[51, -11], [67, -14], [72, -9], [66, -5], [50, -5], [46, -8]]);
  polygon(ctx, P.ink, [[68, -18], [84, -11], [87, -5], [72, -2]]);
  polygon(ctx, P.white, [[71, -15], [81, -10], [83, -7], [72, -5]]);

  // Node 5: dorsal and side cannons; opposing recoil gives mechanical animation.
  const recoilA = frame % 8 < 2 ? 5 : 0; const recoilB = frame % 8 >= 4 && frame % 8 < 6 ? 5 : 0;
  polygon(ctx, P.ink, [[-42, -34], [-37, -51], [-29, -51], [-26, -37]]);
  line(ctx, P.ink, 10, [[-36, -47], [-64 + recoilA, -64]]); line(ctx, P.paleSteel, 5, [[-35, -47], [-64 + recoilA, -64]]);
  polygon(ctx, P.ink, [[-71 + recoilA, -70], [-56 + recoilA, -69], [-52 + recoilA, -63], [-59 + recoilA, -58], [-74 + recoilA, -61]]);
  polygon(ctx, P.red, [[-68 + recoilA, -67], [-58 + recoilA, -66], [-56 + recoilA, -63], [-60 + recoilA, -61], [-69 + recoilA, -63]]);
  polygon(ctx, P.ink, [[16, -51], [24, -66], [33, -63], [30, -47]]);
  line(ctx, P.ink, 10, [[26, -62], [44 - recoilB, -79]]); line(ctx, P.steel, 5, [[26, -62], [44 - recoilB, -79]]);
  polygon(ctx, P.ink, [[38 - recoilB, -84], [53 - recoilB, -84], [58 - recoilB, -78], [53 - recoilB, -73], [39 - recoilB, -75]]);
  polygon(ctx, P.cyan, [[42 - recoilB, -81], [51 - recoilB, -81], [54 - recoilB, -78], [51 - recoilB, -76], [42 - recoilB, -77]]);

  // Hot underside flicker and sparks become harsher as armour fails.
  ctx.globalAlpha = .25 + damage * .28;
  polygon(ctx, damage > .6 ? P.hotRed : P.orange, [[-53, 30], [57, 30], [45, 36 + pulse], [-45, 36 + pulse]]);
  ctx.globalAlpha = 1;
  if (damage > .72) { dot(ctx, P.yellow, -43, -3, 4, 2); dot(ctx, P.orange, 33, 3, 3, 4); }
}

/** Draw either the mid-level road hunter or the large final dreadnought. */
export function drawBoss(ctx: Ctx, kind: BossKind, x: number, y: number, options: SpriteOptions = {}): void {
  const frame = Math.floor(options.frame ?? 0);
  withSprite(ctx, x, y, options, () => {
    if (kind === "roadReaper") drawRoadReaper(ctx, frame);
    else drawDreadnought(ctx, frame, options.power ?? .75);
  });
}

const pickupColors: Record<PickupKind, string> = {
  health: P.hotRed, armor: P.cyan, spread: P.yellow, plasma: P.acid,
  rocket: P.orange, overdrive: P.red, score: P.cream,
};

/** Draw a floating collectible. */
export function drawPickup(ctx: Ctx, kind: PickupKind, x: number, y: number, options: SpriteOptions = {}): void {
  const frame = Math.floor(options.frame ?? 0);
  const bob = Math.sin(frame * .45) * 2;
  withSprite(ctx, x, y + bob, options, () => {
    const color = pickupColors[kind];
    ctx.globalAlpha = .16 + (frame % 4) * .06;
    polygon(ctx, color, [[0, -16], [12, -9], [16, 0], [11, 10], [0, 16], [-12, 9], [-16, 0], [-10, -10]]);
    ctx.globalAlpha = 1;
    polygon(ctx, P.ink, [[0, -12], [10, -7], [12, 0], [9, 8], [0, 13], [-10, 7], [-12, 0], [-9, -8]]);
    polygon(ctx, P.darkSteel, [[0, -9], [8, -5], [8, 5], [0, 10], [-8, 5], [-8, -5]]);
    polygon(ctx, color, [[0, -7], [6, -3], [6, 4], [0, 7], [-6, 3], [-6, -3]]);
    dot(ctx, P.white, -4, -6, 4, 1); dot(ctx, P.paleSteel, -9, -1, 2, 4);
    ctx.fillStyle = P.ink;
    if (kind === "health") { dot(ctx, P.white, -2, -5, 4, 10); dot(ctx, P.white, -5, -2, 10, 4); }
    else if (kind === "armor") { polygon(ctx, P.white, [[0, -6], [5, -3], [4, 4], [0, 7], [-4, 4], [-5, -3]]); }
    else if (kind === "spread") { line(ctx, P.ink, 2, [[-5, 4], [0, -5], [5, 4]]); }
    else if (kind === "plasma") { ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); }
    else if (kind === "rocket") { polygon(ctx, P.white, [[-4, 5], [0, -6], [4, 5], [0, 3]]); }
    else if (kind === "overdrive") { polygon(ctx, P.yellow, [[2, -7], [-4, 1], [0, 1], [-2, 7], [6, -2], [2, -2]]); }
    else { dot(ctx, P.ink, -1, -5, 2, 10); dot(ctx, P.ink, -4, -3, 8, 2); dot(ctx, P.ink, -4, 2, 8, 2); }
  });
}

/** Draw projectile art and its luminous trail. Direction is encoded by angle. */
export function drawBullet(ctx: Ctx, kind: BulletKind, x: number, y: number, angle = 0, frame = 0): void {
  ctx.save(); ctx.translate(px(x), px(y)); ctx.rotate(angle);
  if (kind === "hero") { dot(ctx, P.blue, -12, -2, 12, 4); dot(ctx, P.cyan, -7, -1, 13, 3); dot(ctx, P.white, 0, 0, 7, 1); }
  else if (kind === "spread") { polygon(ctx, P.orange, [[-11, -3], [4, -3], [10, 0], [4, 3], [-11, 3], [-6, 0]]); polygon(ctx, P.yellow, [[-7, -1], [5, -1], [9, 0], [5, 1], [-7, 1]]); dot(ctx, P.white, 2, 0, 6, 1); }
  else if (kind === "plasma") {
    ctx.globalAlpha = .25; polygon(ctx, P.acid, [[-14, 0], [-7, -7], [5, -6], [11, 0], [5, 6], [-7, 7]]); ctx.globalAlpha = 1;
    polygon(ctx, P.green, [[-8, 0], [-3, -4], [6, -3], [10, 0], [6, 3], [-3, 4]]); dot(ctx, P.white, -1, -1, 8, 2);
  } else if (kind === "rocket") {
    polygon(ctx, P.ink, [[-7, -5], [6, -5], [12, 0], [6, 5], [-7, 5]]);
    polygon(ctx, P.paleSteel, [[-5, -3], [5, -3], [10, 0], [5, 3], [-5, 3]]); dot(ctx, P.white, 1, -3, 5, 1);
    polygon(ctx, P.hotRed, [[-5, -3], [-17 - frame % 3 * 2, 0], [-5, 3]]); polygon(ctx, P.yellow, [[-6, -1], [-12 - frame % 2 * 2, 0], [-6, 1]]);
  } else if (kind === "enemy") { polygon(ctx, P.red, [[-8, -3], [4, -3], [9, 0], [4, 3], [-8, 3]]); dot(ctx, P.yellow, -1, -1, 7, 2); dot(ctx, P.white, 3, 0, 4, 1); }
  else { ctx.globalAlpha = .22; polygon(ctx, P.violet, [[0, -10], [9, -5], [11, 3], [4, 10], [-7, 8], [-11, -2], [-6, -9]]); ctx.globalAlpha = 1; polygon(ctx, P.hotRed, [[0, -6], [6, -3], [7, 3], [2, 7], [-5, 5], [-7, -2], [-3, -6]]); dot(ctx, P.white, -2, -2, 5, 4); }
  ctx.restore();
}

/** Draw an expanding, multi-ring explosion. `life` runs from 0 (new) to 1 (gone). */
export function drawExplosion(ctx: Ctx, x: number, y: number, life: number, size = 26, seed = 0): void {
  const t = Math.max(0, Math.min(1, life));
  const radius = size * (.22 + t * .92);
  ctx.save(); ctx.translate(px(x), px(y));
  // Outward metal shards establish direction before the smoke bloom appears.
  ctx.globalAlpha = Math.max(0, 1 - t * 1.1);
  for (let i = 0; i < 7; i++) {
    const a = hash(i + seed * 7) * Math.PI * 2;
    const r = radius * (.55 + hash(i + seed * 11 + 99) * .55);
    const s = Math.max(2, (1 - t) * size * (.08 + hash(i + 51) * .09));
    ctx.save(); ctx.translate(px(Math.cos(a) * r), px(Math.sin(a) * r)); ctx.rotate(a);
    polygon(ctx, i % 3 === 0 ? P.paleSteel : P.orange, [[-s * 1.8, -1], [s, -s * .5], [s * .5, s * .5]]); ctx.restore();
  }
  // Six irregular lobes: white-hot at birth, orange, then mauve smoke at the rim.
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + hash(seed + i) * .45;
    const r = radius * (.16 + t * .5);
    const s = size * (.2 + hash(seed * 13 + i) * .16) * (t < .72 ? 1 : 1.25);
    const color = t > .58 ? (i % 2 ? P.smoke : P.mauve) : i % 2 ? P.hotRed : P.orange;
    polygon(ctx, color, [[Math.cos(a) * r - s, Math.sin(a) * r], [Math.cos(a) * r - s * .35, Math.sin(a) * r - s], [Math.cos(a) * r + s, Math.sin(a) * r - s * .45], [Math.cos(a) * r + s * .75, Math.sin(a) * r + s * .65], [Math.cos(a) * r - s * .45, Math.sin(a) * r + s]]);
  }
  if (t < .52) {
    const core = Math.max(2, size * (.48 - t * .7));
    polygon(ctx, t < .22 ? P.white : P.yellow, [[0, -core], [core, -core * .4], [core * .7, core], [-core * .7, core], [-core, -core * .4]]);
    dot(ctx, P.white, -core * .45, -core * .35, core * .9, core * .45);
  }
  // A thin pressure diamond reads as impact without obscuring combatants.
  ctx.globalAlpha = Math.max(0, .55 - t * .6);
  ctx.strokeStyle = P.yellow; ctx.lineWidth = Math.max(1, px(size * .06));
  ctx.beginPath(); ctx.moveTo(0, -radius); ctx.lineTo(radius, 0); ctx.lineTo(0, radius); ctx.lineTo(-radius, 0); ctx.closePath(); ctx.stroke();
  ctx.restore();
}

/** Draw one inexpensive gameplay particle. */
export function drawParticle(ctx: Ctx, particle: ParticleVisual): void {
  const t = Math.max(0, Math.min(1, particle.life));
  const s = (particle.size ?? 4) * (particle.kind === "smoke" ? .5 + t : 1 - t * .45);
  const color = particle.color ?? ({
    spark: P.yellow, smoke: P.smoke, dust: P.sand, debris: P.darkSteel,
    flame: P.orange, star: P.white,
  } as Record<ParticleKind, string>)[particle.kind];
  ctx.save(); ctx.translate(px(particle.x), px(particle.y)); ctx.rotate(particle.angle ?? 0);
  ctx.globalAlpha = Math.max(0, 1 - t);
  if (particle.kind === "spark" || particle.kind === "star") {
    polygon(ctx, color, [[-s * 2.5, -1], [s * 1.5, -2], [s * 2.2, 0], [s * 1.5, 2]]); dot(ctx, P.white, -1, -s, 2, s * 2);
  } else if (particle.kind === "smoke" || particle.kind === "dust") {
    polygon(ctx, color, [[-s, -s * .3], [-s * .45, -s], [s * .45, -s * .8], [s, -s * .15], [s * .7, s * .7], [-s * .5, s]]);
    dot(ctx, particle.kind === "smoke" ? P.mauve : P.cream, -s * .45, -s * .45, s * .75, s * .35);
  } else if (particle.kind === "flame") {
    polygon(ctx, P.hotRed, [[-s, s], [-s * .3, -s], [0, -s * 2.5], [s * .25, -s], [s, s]]);
    polygon(ctx, color, [[-s * .55, s * .5], [0, -s * 1.5], [s * .5, s * .5]]); dot(ctx, P.white, -1, -s * .5, 2, s);
  } else {
    polygon(ctx, P.ink, [[-s - 1, -s * .5 - 1], [s + 1, -s - 1], [s * .5 + 1, s + 1], [-s - 1, s * .5 + 1]]);
    polygon(ctx, color, [[-s, -s * .5], [s, -s], [s * .5, s], [-s, s * .5]]); dot(ctx, P.paleSteel, -s * .5, -s * .4, s, 1);
  }
  ctx.restore();
}

function hudText(ctx: Ctx, text: string, x: number, y: number, color: string = P.white, align: CanvasTextAlign = "left", size = 8): void {
  ctx.save();
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = P.ink;
  ctx.fillText(text, px(x + 1), px(y + 1));
  ctx.fillStyle = color;
  ctx.fillText(text, px(x), px(y));
  ctx.restore();
}

/** Draw the complete in-game HUD, including optional combo and boss meter. */
export function drawHudOrnaments(ctx: Ctx, hud: HudOptions): void {
  const healthRatio = Math.max(0, Math.min(1, hud.health / Math.max(1, hud.maxHealth)));
  polygon(ctx, P.ink, [[5, 5], [154, 5], [161, 12], [154, 29], [5, 29]]);
  polygon(ctx, P.darkSteel, [[8, 8], [148, 8], [154, 13], [149, 25], [8, 25]]);
  hudText(ctx, (hud.hero ?? "RIDER").toUpperCase(), 12, 9, P.cream, "left", 7);
  ctx.fillStyle = P.ink; ctx.fillRect(54, 10, 91, 9);
  ctx.fillStyle = healthRatio > .3 ? P.hotRed : P.yellow; ctx.fillRect(56, 12, px(87 * healthRatio), 5);
  for (let x = 71; x < 143; x += 16) dot(ctx, P.ink2, x, 12, 1, 5);
  if ((hud.armor ?? 0) > 0) {
    ctx.fillStyle = P.cyan; ctx.fillRect(56, 20, px(87 * Math.min(1, hud.armor ?? 0)), 2);
  }
  polygon(ctx, P.ink, [[326, 5], [475, 5], [475, 28], [333, 28], [326, 20]]);
  hudText(ctx, `SCORE ${String(hud.score ?? 0).padStart(7, "0")}`, 468, 9, P.cream, "right", 8);
  hudText(ctx, `WPN ${(hud.weapon ?? "spread").toUpperCase()}`, 468, 19, pickupColors[hud.weapon ?? "spread"], "right", 6);
  if ((hud.combo ?? 0) > 1) {
    hudText(ctx, `${hud.combo}x`, 239, 11, P.yellow, "center", 15);
    hudText(ctx, "ROAD RAGE", 239, 27, P.orange, "center", 6);
  }
  if (hud.bossHealth !== undefined) {
    polygon(ctx, P.ink, [[77, 244], [403, 244], [411, 252], [403, 263], [77, 263], [69, 252]]);
    ctx.fillStyle = P.darkSteel; ctx.fillRect(82, 250, 316, 7);
    ctx.fillStyle = P.red; ctx.fillRect(83, 251, px(314 * Math.max(0, Math.min(1, hud.bossHealth))), 5);
    hudText(ctx, hud.bossName ?? "DREADNOUGHT", 240, 239, P.cream, "center", 7);
  }
}

/** Draw the original ROAD MICE: RED DUST title treatment and chrome wings. */
export function drawTitleLogo(ctx: Ctx, x = 240, y = 78, scale = 1): void {
  ctx.save(); ctx.translate(px(x), px(y)); ctx.scale(scale, scale);
  // Winged wheel insignia.
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(0, 4, 47, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = P.paleSteel; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 4, 40, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    line(ctx, P.steel, 3, [[Math.cos(a) * 12, 4 + Math.sin(a) * 12], [Math.cos(a) * 37, 4 + Math.sin(a) * 37]]);
  }
  polygon(ctx, P.paleSteel, [[-34, -12], [-112, -28], [-70, -7], [-116, -2], [-62, 11], [-105, 21], [-28, 22]]);
  polygon(ctx, P.paleSteel, [[34, -12], [112, -28], [70, -7], [116, -2], [62, 11], [105, 21], [28, 22]]);
  polygon(ctx, P.red, [[-91, -20], [-36, -8], [-39, 0], [-82, -7]]);
  polygon(ctx, P.red, [[91, -20], [36, -8], [39, 0], [82, -7]]);
  // Heavy italic typography, layered for an embossed 16-bit logo.
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "900 italic 30px Impact, sans-serif";
  ctx.lineJoin = "miter";
  ctx.strokeStyle = P.ink; ctx.lineWidth = 9; ctx.strokeText("ROAD MICE", 0, -5);
  ctx.strokeStyle = P.cream; ctx.lineWidth = 5; ctx.strokeText("ROAD MICE", 0, -5);
  ctx.fillStyle = P.hotRed; ctx.fillText("ROAD MICE", 0, -7);
  ctx.globalAlpha = .7; ctx.fillStyle = P.orange; ctx.fillText("ROAD MICE", 0, -3); ctx.globalAlpha = 1;
  ctx.font = "900 italic 13px Impact, sans-serif";
  ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.strokeText("RED DUST REBELLION", 0, 22);
  ctx.fillStyle = P.yellow; ctx.fillText("RED DUST REBELLION", 0, 22);
  // Tiny highlights restore a pixel-cut metal look.
  dot(ctx, P.white, -80, -15, 14, 2); dot(ctx, P.white, 54, -15, 17, 2);
  ctx.restore();
}

/** Decorative panel used behind menus and hero selection cards. */
export function drawPanel(ctx: Ctx, x: number, y: number, width: number, height: number, accent: string = P.red): void {
  polygon(ctx, P.ink, [[x + 7, y], [x + width - 7, y], [x + width, y + 7], [x + width, y + height - 7], [x + width - 7, y + height], [x + 7, y + height], [x, y + height - 7], [x, y + 7]]);
  polygon(ctx, P.darkSteel, [[x + 8, y + 4], [x + width - 10, y + 4], [x + width - 4, y + 10], [x + width - 4, y + height - 10], [x + width - 10, y + height - 4], [x + 8, y + height - 4], [x + 4, y + height - 10], [x + 4, y + 10]]);
  ctx.fillStyle = P.ink2; ctx.fillRect(px(x + 8), px(y + 9), px(width - 16), px(height - 18));
  dot(ctx, accent, x + 6, y + 6, 3, 3); dot(ctx, accent, x + width - 9, y + 6, 3, 3);
  dot(ctx, accent, x + 6, y + height - 9, 3, 3); dot(ctx, accent, x + width - 9, y + height - 9, 3, 3);
}

/** Convenience façade for games that prefer keeping a renderer instance. */
export class PixelArtRenderer {
  constructor(public readonly ctx: Ctx) { ctx.imageSmoothingEnabled = false; }
  background(options?: BackgroundOptions): void { drawMartianParallax(this.ctx, options); }
  hero(id: HeroId, x: number, y: number, options?: SpriteOptions): void { drawHero(this.ctx, id, x, y, options); }
  enemy(kind: EnemyKind, x: number, y: number, options?: SpriteOptions): void { drawEnemy(this.ctx, kind, x, y, options); }
  boss(kind: BossKind, x: number, y: number, options?: SpriteOptions): void { drawBoss(this.ctx, kind, x, y, options); }
  pickup(kind: PickupKind, x: number, y: number, options?: SpriteOptions): void { drawPickup(this.ctx, kind, x, y, options); }
  bullet(kind: BulletKind, x: number, y: number, angle?: number, frame?: number): void { drawBullet(this.ctx, kind, x, y, angle, frame); }
  explosion(x: number, y: number, life: number, size?: number, seed?: number): void { drawExplosion(this.ctx, x, y, life, size, seed); }
  particle(particle: ParticleVisual): void { drawParticle(this.ctx, particle); }
  hud(options: HudOptions): void { drawHudOrnaments(this.ctx, options); }
  title(x?: number, y?: number, scale?: number): void { drawTitleLogo(this.ctx, x, y, scale); }
  panel(x: number, y: number, width: number, height: number, accent?: string): void { drawPanel(this.ctx, x, y, width, height, accent); }
}
