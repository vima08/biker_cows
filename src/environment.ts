/**
 * Procedural 16-bit stage environment for Venus Neon Stampede.
 *
 * The renderer is intentionally stateless: every decoration is derived from
 * scroll/time, so captures and debug scene jumps remain deterministic.
 */

import { assetUrl } from './assetUrl';
import { isArtEnabled } from './debug/runtime';

export const ENVIRONMENT_WIDTH = 960;
export const ENVIRONMENT_HEIGHT = 540;
export const ENVIRONMENT_ROAD_TOP = 292;
export const ENVIRONMENT_ROAD_BOTTOM = 506;
export const ENVIRONMENT_DURATION = 465;

export type EnvironmentSection =
  | 'venus-outskirts'
  | 'neon-refinery'
  | 'lava-foundry'
  | 'fortress-approach';

export interface EnvironmentDrawOptions {
  scroll: number;
  elapsed: number;
  speed: number;
  time: number;
  shake?: number;
  intensity?: number;
  width?: number;
  height?: number;
}

export interface EnvironmentPhase {
  current: EnvironmentSection;
  next: EnvironmentSection;
  mix: number;
  stageProgress: number;
}

interface Palette {
  sky0: string;
  sky1: string;
  sky2: string;
  horizon: string;
  glow: string;
  far0: string;
  far1: string;
  mid0: string;
  mid1: string;
  metal: string;
  accent: string;
  hot: string;
  road0: string;
  road1: string;
  road2: string;
  shoulder: string;
}

const SECTIONS: readonly EnvironmentSection[] = [
  'venus-outskirts',
  'neon-refinery',
  'lava-foundry',
  'fortress-approach',
];

/**
 * The authored panorama is an enhancement, never a boot dependency.  Keeping
 * the loader here (rather than in game state) means a slow/missing local asset
 * simply reveals the procedural world that is already drawn underneath it.
 */
const PANORAMA_URL = assetUrl('assets/world/venus-highway-panorama.png');
let panorama: HTMLImageElement | null = null;
let panoramaState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';

/**
 * One deliberately small atlas replaces the last highly visible procedural
 * roadside silhouettes. Cell semantics are fixed so the renderer and the
 * source-art prompt cannot quietly drift apart:
 *
 *   row 0: guardrail, lamp, warning sign, shoulder wreckage
 *   row 1: shoulder rock A/B, foreground rock A/B
 */
const ROAD_PROPS_URL = assetUrl('assets/world/roadside-props-sheet.png');
const ROAD_PROPS_COLUMNS = 4;
const ROAD_PROPS_ROWS = 2;
let roadProps: HTMLImageElement | null = null;
let roadPropsState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';

const SHOULDER_STRIP_URL = assetUrl('assets/world/venus-shoulder-strip.png');
let shoulderStrip: HTMLImageElement | null = null;
let shoulderStripState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';

function getPanorama(): HTMLImageElement | null {
  if (!isArtEnabled()) return null;
  if (panoramaState === 'ready') return panorama;
  if (panoramaState !== 'idle' || typeof Image === 'undefined') return null;
  panoramaState = 'loading';
  try {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      panorama = image;
      panoramaState = 'ready';
    };
    // A missing optional layer is intentionally silent: procedural art is the fallback.
    image.onerror = () => {
      panorama = null;
      panoramaState = 'failed';
    };
    image.src = PANORAMA_URL;
  } catch {
    panoramaState = 'failed';
  }
  return null;
}

function getRoadProps(): HTMLImageElement | null {
  if (!isArtEnabled()) return null;
  if (roadPropsState === 'ready') return roadProps;
  if (roadPropsState !== 'idle' || typeof Image === 'undefined') return null;
  roadPropsState = 'loading';
  try {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (image.naturalWidth >= ROAD_PROPS_COLUMNS && image.naturalHeight >= ROAD_PROPS_ROWS) {
        roadProps = image;
        roadPropsState = 'ready';
      } else {
        roadProps = null;
        roadPropsState = 'failed';
      }
    };
    image.onerror = () => {
      roadProps = null;
      roadPropsState = 'failed';
    };
    image.src = ROAD_PROPS_URL;
  } catch {
    roadPropsState = 'failed';
  }
  return null;
}

function getShoulderStrip(): HTMLImageElement | null {
  if (!isArtEnabled()) return null;
  if (shoulderStripState === 'ready') return shoulderStrip;
  if (shoulderStripState !== 'idle' || typeof Image === 'undefined') return null;
  shoulderStripState = 'loading';
  try {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (image.naturalWidth >= 256 && image.naturalHeight >= 32) {
        shoulderStrip = image;
        shoulderStripState = 'ready';
      } else {
        shoulderStrip = null;
        shoulderStripState = 'failed';
      }
    };
    image.onerror = () => {
      shoulderStrip = null;
      shoulderStripState = 'failed';
    };
    image.src = SHOULDER_STRIP_URL;
  } catch {
    shoulderStripState = 'failed';
  }
  return null;
}

const PALETTES: Record<EnvironmentSection, Palette> = {
  'venus-outskirts': {
    sky0: '#070a25', sky1: '#31204d', sky2: '#913e58', horizon: '#f58a5b', glow: '#ffc16c',
    far0: '#2b2145', far1: '#422640', mid0: '#17172c', mid1: '#302039', metal: '#5c4652',
    accent: '#69d5d2', hot: '#ffb43d', road0: '#11131c', road1: '#1a1b25', road2: '#282631', shoulder: '#3f2835',
  },
  'neon-refinery': {
    sky0: '#030b22', sky1: '#102f4c', sky2: '#293e59', horizon: '#1fd4c4', glow: '#6ffff2',
    far0: '#10233a', far1: '#173149', mid0: '#091522', mid1: '#182a37', metal: '#415160',
    accent: '#16f1cf', hot: '#ff4ca8', road0: '#0b121a', road1: '#111d25', road2: '#1d2b31', shoulder: '#233744',
  },
  'lava-foundry': {
    sky0: '#120712', sky1: '#481622', sky2: '#8c2823', horizon: '#ff7a23', glow: '#ffd052',
    far0: '#29101a', far1: '#481a20', mid0: '#160c13', mid1: '#31151a', metal: '#60403c',
    accent: '#ffc02d', hot: '#ff3b18', road0: '#130e13', road1: '#21151a', road2: '#352128', shoulder: '#4e221e',
  },
  'fortress-approach': {
    sky0: '#050718', sky1: '#1b183b', sky2: '#3d2550', horizon: '#ab4adb', glow: '#e885ff',
    far0: '#15142e', far1: '#25203d', mid0: '#090b1a', mid1: '#19172b', metal: '#4e4961',
    accent: '#bc62ff', hot: '#ff436f', road0: '#0a0c14', road1: '#141621', road2: '#222333', shoulder: '#30223e',
  },
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const wrap = (value: number, size: number) => ((value % size) + size) % size;
const pixel2 = (value: number) => Math.round(value / 2) * 2;
const hash = (value: number) => {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function colorChannels(color: string): [number, number, number] {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mixColor(a: string, b: string, t: number): string {
  const ac = colorChannels(a);
  const bc = colorChannels(b);
  const channel = (index: number) => Math.round(mix(ac[index], bc[index], t)).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

function mixPalette(a: Palette, b: Palette, t: number): Palette {
  const result = {} as Palette;
  for (const key of Object.keys(a) as Array<keyof Palette>) result[key] = mixColor(a[key], b[key], t);
  return result;
}

export function getEnvironmentPhase(elapsed: number): EnvironmentPhase {
  const t = clamp(elapsed, 0, ENVIRONMENT_DURATION);
  const transitions = [
    { from: 0, to: 1, start: 102, end: 130 },
    { from: 1, to: 2, start: 222, end: 252 },
    { from: 2, to: 3, start: 342, end: 376 },
  ] as const;

  let index = 0;
  for (const transition of transitions) {
    if (t < transition.start) break;
    if (t <= transition.end) {
      return {
        current: SECTIONS[transition.from],
        next: SECTIONS[transition.to],
        mix: smooth((t - transition.start) / (transition.end - transition.start)),
        stageProgress: t / ENVIRONMENT_DURATION,
      };
    }
    index = transition.to;
  }
  return { current: SECTIONS[index], next: SECTIONS[index], mix: 0, stageProgress: t / ENVIRONMENT_DURATION };
}

function polygon(ctx: CanvasRenderingContext2D, points: ReadonlyArray<readonly [number, number]>) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0][0]), Math.round(points[0][1]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(Math.round(points[i][0]), Math.round(points[i][1]));
  ctx.closePath();
  ctx.fill();
}

function line(ctx: CanvasRenderingContext2D, color: string, width: number, points: ReadonlyArray<readonly [number, number]>) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0][0]), Math.round(points[0][1]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(Math.round(points[i][0]), Math.round(points[i][1]));
  ctx.stroke();
}

function repeatedPositions(scroll: number, factor: number, spacing: number, padding = 1) {
  const shifted = scroll * factor;
  const first = Math.floor(shifted / spacing) - padding;
  const count = Math.ceil(ENVIRONMENT_WIDTH / spacing) + padding * 2 + 1;
  return Array.from({ length: count }, (_, offset) => {
    const index = first + offset;
    return { index, x: index * spacing - shifted };
  });
}

const enum RoadPropCell {
  Guardrail = 0,
  Lamp = 1,
  Sign = 2,
  Wreck = 3,
  ShoulderRockA = 4,
  ShoulderRockB = 5,
  ForegroundRockA = 6,
  ForegroundRockB = 7,
}

/** Draw a complete cell around a bottom-centre world anchor. */
function drawRoadPropCell(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cell: RoadPropCell,
  anchorX: number,
  groundY: number,
  width: number,
  height: number,
  flip = false,
  alpha = 1,
): void {
  const sourceWidth = image.naturalWidth / ROAD_PROPS_COLUMNS;
  const sourceHeight = image.naturalHeight / ROAD_PROPS_ROWS;
  const column = cell % ROAD_PROPS_COLUMNS;
  const row = Math.floor(cell / ROAD_PROPS_COLUMNS);
  const destinationX = Math.round(anchorX - width * .5);
  const destinationY = Math.round(groundY - height);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha;
  if (flip) {
    ctx.translate(Math.round(anchorX * 2), 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    image,
    Math.round(column * sourceWidth),
    Math.round(row * sourceHeight),
    Math.round(sourceWidth),
    Math.round(sourceHeight),
    destinationX,
    destinationY,
    Math.round(width),
    Math.round(height),
  );
  ctx.restore();
}

function drawBandSky(ctx: CanvasRenderingContext2D, palette: Palette, time: number, scroll: number) {
  const bands = [
    [0, 57, palette.sky0], [57, 116, mixColor(palette.sky0, palette.sky1, .38)],
    [116, 176, mixColor(palette.sky0, palette.sky1, .72)], [176, 226, palette.sky1],
    [226, 262, mixColor(palette.sky1, palette.sky2, .58)], [262, 293, palette.sky2],
  ] as const;
  for (const [y, nextY, color] of bands) {
    ctx.fillStyle = color;
    ctx.fillRect(0, y, ENVIRONMENT_WIDTH, nextY - y);
  }

  // Deliberately sparse ordered dithering keeps the sky 16-bit rather than airbrushed.
  ctx.globalAlpha = .22;
  ctx.fillStyle = palette.horizon;
  for (let y = 178; y < 286; y += 8) {
    const offset = ((y / 8) & 1) * 5;
    for (let x = offset; x < ENVIRONMENT_WIDTH; x += 10) {
      if (hash(x * .17 + y * 1.9) > .58 + (286 - y) / 260) ctx.fillRect(x, y, 2, 1);
    }
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < 66; i++) {
    const depth = .004 + hash(i + 8) * .014;
    const x = Math.floor(wrap(hash(i * 9 + 31) * ENVIRONMENT_WIDTH - scroll * depth, ENVIRONMENT_WIDTH));
    const y = 12 + Math.floor(hash(i * 17 + 4) * 190);
    const pulse = .42 + .34 * Math.sin(time * (1.2 + hash(i) * 2) + i);
    ctx.globalAlpha = clamp(pulse, .15, .84);
    ctx.fillStyle = i % 11 === 0 ? palette.accent : '#f4e5da';
    const size = i % 13 === 0 ? 2 : 1;
    ctx.fillRect(x, y, size, size);
    if (i % 17 === 0) {
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillRect(x, y - 2, 1, 5);
    }
  }
  ctx.globalAlpha = 1;
}

function drawMoons(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, section: EnvironmentSection) {
  const moonX = Math.round(wrap(788 - scroll * .0025, 1210) - 95);
  const moonY = section === 'lava-foundry' ? 92 : 104;
  const radius = section === 'fortress-approach' ? 37 : 46;
  ctx.fillStyle = mixColor(palette.glow, '#f1d9da', .54);
  ctx.beginPath();
  ctx.arc(moonX, moonY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mixColor(palette.sky1, '#1a172a', .42);
  ctx.beginPath();
  ctx.arc(moonX - 15, moonY - 10, radius - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = .35;
  ctx.fillStyle = palette.glow;
  ctx.fillRect(moonX - radius - 12, moonY + radius + 7, radius * 2 + 24, 2);
  ctx.globalAlpha = 1;

  if (section === 'venus-outskirts') {
    const x = Math.round(wrap(214 - scroll * .006, 1130) - 70);
    ctx.fillStyle = '#9ab7d0';
    ctx.beginPath(); ctx.arc(x, 65, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = palette.sky0;
    ctx.beginPath(); ctx.arc(x - 4, 62, 9, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCloudBands(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, time: number, section: EnvironmentSection) {
  const isSmoke = section === 'lava-foundry' || section === 'neon-refinery';
  ctx.globalAlpha = isSmoke ? .2 : .11;
  for (const item of repeatedPositions(scroll + time * 7, .025, 185, 2)) {
    const y = 132 + hash(item.index * 13) * 92;
    const width = 80 + hash(item.index + 3) * 115;
    ctx.fillStyle = isSmoke ? mixColor(palette.mid1, palette.sky2, .45) : palette.glow;
    ctx.fillRect(Math.floor(item.x), Math.floor(y), Math.floor(width), 3);
    ctx.fillRect(Math.floor(item.x + width * .21), Math.floor(y - 5), Math.floor(width * .58), 3);
    ctx.fillRect(Math.floor(item.x + width * .42), Math.floor(y + 5), Math.floor(width * .34), 2);
  }
  ctx.globalAlpha = 1;
}

function drawAuthoredPanorama(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, time: number): boolean {
  const image = getPanorama();
  if (!image || image.naturalWidth < 2 || image.naturalHeight < 2) return false;

  // Use a wide crop so motion stays a restrained far-parallax drift. A cosine
  // phase eases fully into both turnarounds: no seam and no velocity snap.
  const cropWidth = Math.min(image.naturalWidth, Math.max(2, Math.round(image.naturalWidth * .82)));
  const cropHeight = Math.min(image.naturalHeight, Math.max(2, Math.round(cropWidth * ENVIRONMENT_ROAD_TOP / ENVIRONMENT_WIDTH)));
  const travel = Math.max(0, image.naturalWidth - cropWidth);
  const drift = scroll * .014 + time * 1.5;
  const phase = travel > 0 ? drift / travel * Math.PI : 0;
  const sourceX = pixel2(travel * (.5 - .5 * Math.cos(phase)));
  const sourceY = Math.max(0, Math.min(image.naturalHeight - cropHeight, Math.round(image.naturalHeight * .04)));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ENVIRONMENT_WIDTH, ENVIRONMENT_ROAD_TOP);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = .78;
  ctx.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, ENVIRONMENT_WIDTH, ENVIRONMENT_ROAD_TOP);

  // Hard color bands bind one neutral panorama into all four existing region palettes.
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = .18;
  ctx.fillStyle = palette.sky0;
  ctx.fillRect(0, 0, ENVIRONMENT_WIDTH, 116);
  ctx.fillStyle = palette.sky1;
  ctx.fillRect(0, 116, ENVIRONMENT_WIDTH, 96);
  ctx.fillStyle = palette.sky2;
  ctx.fillRect(0, 212, ENVIRONMENT_WIDTH, ENVIRONMENT_ROAD_TOP - 212);
  ctx.restore();
  return true;
}

function drawRidge(ctx: CanvasRenderingContext2D, scroll: number, factor: number, baseY: number, step: number, height: number, color: string, salt: number) {
  const shifted = scroll * factor;
  const first = Math.floor(shifted / step) - 2;
  const count = Math.ceil(ENVIRONMENT_WIDTH / step) + 5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  for (let offset = 0; offset < count; offset++) {
    const index = first + offset;
    const x = Math.round(index * step - shifted);
    const top = baseY - height * (.25 + hash(index * 3 + salt) * .75);
    ctx.lineTo(x, Math.round(top));
    if (salt % 2 === 0) ctx.lineTo(x + step * .42, Math.round(top + height * (.08 + hash(index + salt) * .22)));
  }
  ctx.lineTo(ENVIRONMENT_WIDTH, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawMesaLayer(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number) {
  drawRidge(ctx, scroll, .038, 268, 88, 78, palette.far0, 8);
  for (const item of repeatedPositions(scroll, .058, 226, 2)) {
    const h = 30 + hash(item.index * 5) * 42;
    const w = 92 + hash(item.index + 21) * 56;
    const x = Math.floor(item.x);
    ctx.fillStyle = palette.far1;
    polygon(ctx, [[x, 270], [x + 13, 270 - h * .63], [x + 27, 270 - h], [x + w * .72, 270 - h], [x + w - 11, 270 - h * .55], [x + w, 270]]);
    ctx.fillStyle = mixColor(palette.far1, palette.horizon, .18);
    ctx.fillRect(x + 29, Math.floor(271 - h), Math.max(8, Math.floor(w * .41)), 3);
    ctx.fillStyle = mixColor(palette.far1, palette.sky0, .38);
    polygon(ctx, [[x + w * .67, 270 - h + 3], [x + w - 11, 270 - h * .55], [x + w, 270], [x + w * .81, 270]]);
  }
}

function drawOutskirts(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, time: number) {
  drawMesaLayer(ctx, palette, scroll);
  drawRidge(ctx, scroll, .105, 294, 61, 55, palette.mid0, 41);
  for (const item of repeatedPositions(scroll, .19, 242, 2)) {
    const x = Math.floor(item.x + 50);
    const flip = hash(item.index) > .5 ? 1 : -1;
    ctx.fillStyle = palette.mid1;
    polygon(ctx, [[x - 34, 292], [x - 17, 252], [x - 8, 228], [x + 4, 258], [x + 25, 292]]);
    ctx.fillStyle = palette.metal;
    ctx.fillRect(x + 42, 245, 5, 47);
    ctx.fillRect(x + 29, 251, 32, 4);
    line(ctx, palette.accent, 2, [[x + 45, 246], [x + 45 + flip * 26, 222], [x + 45 + flip * 39, 222]]);
    ctx.globalAlpha = .5 + Math.sin(time * 3 + item.index) * .25;
    ctx.fillStyle = palette.hot;
    ctx.fillRect(x + 43 + flip * 39, 220, 4, 4);
    ctx.globalAlpha = 1;
  }
}

function drawChimney(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number, palette: Palette, time: number, seed: number) {
  const w = 14 + Math.floor(hash(seed) * 9);
  ctx.fillStyle = palette.mid0;
  polygon(ctx, [[x, baseY], [x + 3, baseY - h], [x + w - 3, baseY - h], [x + w, baseY]]);
  ctx.fillStyle = palette.metal;
  for (let y = baseY - h + 9; y < baseY; y += 17) ctx.fillRect(x + 2, y, w - 4, 3);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(x - 2, baseY - h, w + 4, 3);
  ctx.globalAlpha = .1;
  ctx.fillStyle = palette.glow;
  ctx.fillRect(x - 10, baseY - h - 6, w + 20, 15);
  ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) {
    const drift = wrap(time * (7 + i * 2) + seed * 13 + i * 17, 52);
    ctx.globalAlpha = .17 * (1 - drift / 52);
    ctx.fillStyle = mixColor(palette.mid1, '#87939b', .3);
    ctx.fillRect(Math.floor(x + w / 2 + drift * .34 - i * 3), Math.floor(baseY - h - 8 - drift), 13 + i * 4, 5 + i * 2);
  }
  ctx.globalAlpha = 1;
}

function drawRefinery(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, time: number) {
  drawRidge(ctx, scroll, .035, 267, 78, 45, palette.far0, 17);
  for (const item of repeatedPositions(scroll, .082, 156, 2)) {
    const x = Math.floor(item.x);
    const h = 44 + hash(item.index + 9) * 78;
    ctx.fillStyle = palette.far1;
    ctx.fillRect(x, 270 - h, 44 + hash(item.index) * 33, h + 22);
    ctx.fillStyle = mixColor(palette.far1, palette.accent, .33);
    for (let y = 279 - h; y < 260; y += 13) ctx.fillRect(x + 7, y, 3, 5);
    drawChimney(ctx, x + 54, 281, 68 + hash(item.index * 7) * 78, palette, time, item.index);
  }
  ctx.fillStyle = palette.mid0;
  ctx.fillRect(0, 274, ENVIRONMENT_WIDTH, 18);
  for (const item of repeatedPositions(scroll, .22, 205, 2)) {
    const x = Math.floor(item.x);
    ctx.fillStyle = palette.mid1;
    ctx.fillRect(x + 24, 223, 89, 69);
    ctx.fillStyle = palette.metal;
    ctx.fillRect(x + 31, 232, 75, 5);
    ctx.fillRect(x + 31, 260, 75, 4);
    ctx.fillStyle = palette.hot;
    for (let wx = x + 38; wx < x + 103; wx += 16) ctx.fillRect(wx, 244, 7, 8);
    line(ctx, palette.metal, 7, [[x - 36, 251], [x + 22, 251], [x + 32, 241]]);
    line(ctx, palette.mid0, 3, [[x - 36, 251], [x + 22, 251], [x + 32, 241]]);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x - 36, 248, 48, 2);
  }
}

function drawFoundry(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, time: number) {
  drawRidge(ctx, scroll, .032, 270, 69, 104, palette.far0, 29);
  // Lava scars stay far from the action band but animate strongly at the horizon.
  for (const item of repeatedPositions(scroll, .048, 180, 2)) {
    const x = Math.floor(item.x + 60);
    const y = 207 + hash(item.index) * 35;
    ctx.fillStyle = palette.hot;
    ctx.globalAlpha = .48 + Math.sin(time * 5 + item.index) * .12;
    ctx.fillRect(x, y, 4, 270 - y);
    ctx.fillStyle = palette.glow;
    ctx.fillRect(x + 1, y, 1, 270 - y);
    ctx.globalAlpha = 1;
  }
  for (const item of repeatedPositions(scroll, .13, 244, 2)) {
    const x = Math.floor(item.x);
    ctx.fillStyle = palette.mid0;
    polygon(ctx, [[x, 292], [x + 9, 217], [x + 28, 197], [x + 46, 217], [x + 56, 292]]);
    ctx.fillStyle = palette.mid1;
    ctx.fillRect(x + 12, 226, 32, 66);
    ctx.fillStyle = palette.hot;
    ctx.fillRect(x + 18, 237, 20, 29);
    ctx.fillStyle = palette.glow;
    ctx.fillRect(x + 22, 241, 12, 19);
    ctx.fillStyle = palette.metal;
    ctx.fillRect(x - 12, 217, 79, 5);
    line(ctx, palette.metal, 4, [[x + 67, 219], [x + 106, 188], [x + 151, 188]]);
    line(ctx, palette.mid0, 2, [[x + 67, 219], [x + 106, 188], [x + 151, 188]]);
  }
  ctx.fillStyle = palette.mid0;
  ctx.fillRect(0, 279, ENVIRONMENT_WIDTH, 13);
}

function drawFortress(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, time: number) {
  drawRidge(ctx, scroll, .027, 259, 93, 58, palette.far0, 51);
  for (const item of repeatedPositions(scroll, .074, 284, 2)) {
    const x = Math.floor(item.x);
    ctx.fillStyle = palette.far1;
    ctx.fillRect(x, 172, 180, 120);
    polygon(ctx, [[x - 17, 172], [x + 28, 132], [x + 61, 172], [x + 116, 172], [x + 154, 139], [x + 195, 172]]);
    ctx.fillStyle = palette.mid0;
    for (let wx = x + 16; wx < x + 170; wx += 34) {
      ctx.fillRect(wx, 204, 17, 54);
      ctx.fillStyle = palette.hot;
      ctx.fillRect(wx + 5, 214, 7, 17);
      ctx.fillStyle = palette.mid0;
    }
    ctx.fillStyle = palette.metal;
    ctx.fillRect(x - 5, 180, 190, 7);
    ctx.fillRect(x - 5, 263, 190, 8);
  }
  ctx.fillStyle = palette.mid0;
  ctx.fillRect(0, 272, ENVIRONMENT_WIDTH, 20);
  for (const item of repeatedPositions(scroll, .18, 330, 2)) {
    const x = Math.floor(item.x + 40);
    ctx.fillStyle = palette.mid1;
    polygon(ctx, [[x - 28, 292], [x - 28, 198], [x, 169], [x + 28, 198], [x + 28, 292]]);
    ctx.fillStyle = palette.metal;
    ctx.fillRect(x - 33, 202, 66, 6);
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = .65 + Math.sin(time * 4 + item.index) * .25;
    ctx.fillRect(x - 8, 185, 16, 7);
    ctx.globalAlpha = 1;
    // Searchlight cone; low opacity avoids reducing projectile readability.
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = .055;
    const sweep = Math.sin(time * .75 + item.index) * 115;
    polygon(ctx, [[x, 190], [x + sweep - 54, 292], [x + sweep + 54, 292]]);
    ctx.globalAlpha = 1;
  }
}

function drawSectionFeatures(ctx: CanvasRenderingContext2D, section: EnvironmentSection, palette: Palette, scroll: number, time: number, alpha: number) {
  if (alpha <= .001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (section === 'venus-outskirts') drawOutskirts(ctx, palette, scroll, time);
  else if (section === 'neon-refinery') drawRefinery(ctx, palette, scroll, time);
  else if (section === 'lava-foundry') drawFoundry(ctx, palette, scroll, time);
  else drawFortress(ctx, palette, scroll, time);
  ctx.restore();
}

function drawHorizonEnergy(ctx: CanvasRenderingContext2D, palette: Palette, time: number, intensity: number) {
  ctx.fillStyle = palette.mid0;
  ctx.fillRect(0, 285, ENVIRONMENT_WIDTH, 10);
  ctx.fillStyle = palette.horizon;
  ctx.fillRect(0, 287, ENVIRONMENT_WIDTH, 2);
  ctx.globalAlpha = .22 + intensity * .08 + Math.sin(time * 3) * .04;
  ctx.fillStyle = palette.glow;
  ctx.fillRect(0, 289, ENVIRONMENT_WIDTH, 5);
  ctx.globalAlpha = 1;
}

function roadDepth(z: number) {
  return ENVIRONMENT_ROAD_TOP + Math.pow(clamp(z), 2.05) * (ENVIRONMENT_ROAD_BOTTOM - ENVIRONMENT_ROAD_TOP);
}

function drawRoadBase(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, section: EnvironmentSection) {
  ctx.fillStyle = palette.road0;
  ctx.fillRect(0, ENVIRONMENT_ROAD_TOP, ENVIRONMENT_WIDTH, ENVIRONMENT_ROAD_BOTTOM - ENVIRONMENT_ROAD_TOP);

  const roadBands = 18;
  for (let i = 0; i < roadBands; i++) {
    const z0 = i / roadBands;
    const z1 = (i + 1) / roadBands;
    const y0 = Math.floor(roadDepth(z0));
    const y1 = Math.ceil(roadDepth(z1));
    ctx.fillStyle = i % 3 === 0 ? palette.road2 : i % 2 === 0 ? palette.road1 : palette.road0;
    ctx.globalAlpha = .18 + z1 * .17;
    ctx.fillRect(0, y0, ENVIRONMENT_WIDTH, Math.max(1, y1 - y0));
  }
  ctx.globalAlpha = 1;

  // Moving transverse seams generate forward velocity without turning the road into a grid.
  for (let i = 0; i < 13; i++) {
    const z = wrap(i / 13 + scroll * .00072, 1);
    const y = roadDepth(z);
    ctx.globalAlpha = .09 + z * .19;
    ctx.fillStyle = z > .67 ? palette.road2 : palette.road1;
    ctx.fillRect(0, Math.round(y), ENVIRONMENT_WIDTH, Math.max(1, Math.round(1 + z * 3)));
  }
  ctx.globalAlpha = 1;

  if (section === 'neon-refinery') {
    ctx.globalAlpha = .09;
    ctx.fillStyle = palette.accent;
    for (const item of repeatedPositions(scroll, 1.28, 310, 2)) polygon(ctx, [[item.x, 462], [item.x + 116, 458], [item.x + 182, 476], [item.x + 40, 480]]);
    ctx.globalAlpha = 1;
  } else if (section === 'lava-foundry') {
    ctx.globalAlpha = .13;
    ctx.fillStyle = palette.hot;
    for (const item of repeatedPositions(scroll, .91, 420, 2)) polygon(ctx, [[item.x, 481], [item.x + 42, 470], [item.x + 128, 476], [item.x + 165, 490], [item.x + 68, 486]]);
    ctx.globalAlpha = 1;
  }
}

function drawAsphaltTexture(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number) {
  for (let i = 0; i < 96; i++) {
    const z = .08 + hash(i * 17 + 5) * .91;
    const y = roadDepth(z);
    const speed = .16 + z * 1.76;
    const period = 1010 + hash(i + 2) * 360;
    const x = wrap(hash(i * 31) * period - scroll * speed, period) - 80;
    const w = 2 + Math.floor(z * (7 + hash(i) * 14));
    ctx.globalAlpha = .12 + z * .2;
    ctx.fillStyle = i % 4 === 0 ? palette.shoulder : i % 3 === 0 ? palette.road2 : '#05070c';
    ctx.fillRect(Math.round(x), Math.round(y), w, Math.max(1, Math.floor(z * 3)));
  }
  ctx.globalAlpha = 1;

  // Tar repairs and twin tyre marks are stepped 2px clusters. They read as
  // hand-placed cartridge pixels and avoid smooth vector curves on the road.
  for (let track = 0; track < 3; track++) {
    const y = pixel2(338 + track * 61);
    const offset = pixel2(wrap(scroll * (1.06 + track * .12) + track * 311, 740) - 160);
    ctx.globalAlpha = .24 + track * .05;
    for (let step = 0; step < 18; step++) {
      const sx = offset + step * 20;
      const sy = y + pixel2(Math.sin((step + track * 2) * .72) * 6);
      ctx.fillStyle = '#05070b';
      ctx.fillRect(sx, sy, 18, track === 2 ? 4 : 2);
      ctx.fillStyle = palette.road2;
      ctx.fillRect(sx, sy - 2, 12, 2);
    }
  }
  ctx.globalAlpha = 1;
}

/** Three repeating, low-contrast material beats keep the road authored but the lane readable. */
function drawRoadMaterialEvents(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, time: number) {
  for (const item of repeatedPositions(scroll, 1.08, 286, 2)) {
    const event = ((item.index % 3) + 3) % 3;
    const x = pixel2(item.x + 18);
    if (event === 0) {
      // A patched slab rides the upper edge of the lane.
      ctx.globalAlpha = .26;
      ctx.fillStyle = palette.road2;
      polygon(ctx, [[x, 316], [x + 94, 312], [x + 126, 326], [x + 20, 330]]);
      ctx.fillStyle = palette.road0;
      for (let px = 0; px < 5; px++) ctx.fillRect(x + 12 + px * 22, 318 + (px % 2) * 4, 8, 2);
    } else if (event === 1) {
      // Twin stepped tyre marks sit below the main projectile corridor.
      ctx.globalAlpha = .28;
      ctx.fillStyle = '#05070b';
      for (let step = 0; step < 7; step++) {
        const sx = x + step * 18;
        const sy = 470 + ((step + item.index) % 3) * 2;
        ctx.fillRect(sx, sy, 14, 2);
        ctx.fillRect(sx + 2, sy + 8, 14, 2);
      }
    } else {
      // A small repair seam, broken into chunky top-left-lit pixels.
      ctx.globalAlpha = .34;
      ctx.fillStyle = '#05070a';
      const points = [[x, 404], [x + 18, 408], [x + 34, 402], [x + 50, 410], [x + 68, 406]] as const;
      for (let i = 0; i < points.length - 1; i++) {
        const ax = pixel2(points[i][0]);
        const ay = pixel2(points[i][1]);
        const bx = pixel2(points[i + 1][0]);
        const by = pixel2(points[i + 1][1]);
        line(ctx, '#05070a', 2, [[ax, ay], [bx, by]]);
      }
      ctx.fillStyle = palette.road2;
      ctx.fillRect(x + 16, 404, 12, 2);
    }
  }

  // Restrained light pools are clusters rather than gradients; gaps preserve silhouettes.
  for (const item of repeatedPositions(scroll, .74, 334, 2)) {
    const x = pixel2(item.x - 28);
    const pulse = .055 + (Math.sin(time * 2.6 + item.index) + 1) * .015;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = palette.accent;
    polygon(ctx, [[x, 338], [x + 148, 338], [x + 104, 358], [x + 30, 358]]);
    ctx.globalAlpha = pulse * .7;
    ctx.fillRect(x + 28, 360, 70, 2);
    ctx.fillRect(x + 42, 364, 42, 2);
  }
  ctx.globalAlpha = 1;
}

function drawCracks(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number) {
  for (const item of repeatedPositions(scroll, 1.16, 245, 2)) {
    const seed = item.index * 19;
    const z = .37 + hash(seed) * .57;
    const y = roadDepth(z);
    const x = item.x + hash(seed + 1) * 70;
    const size = 7 + z * 17;
    ctx.globalAlpha = .3 + z * .25;
    line(ctx, '#05070a', Math.max(1, z * 2), [[x, y], [x + size * .35, y + 4], [x + size, y - 2], [x + size * 1.45, y + 5]]);
    line(ctx, palette.road2, 1, [[x + size * .35, y + 4], [x + size * .5, y + 10]]);
  }
  ctx.globalAlpha = 1;
}

function drawLaneReflectors(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, time: number) {
  const lanes = [{ y: 352, speed: 1.06, scale: .72 }, { y: 438, speed: 1.48, scale: 1.15 }];
  for (const [laneIndex, lane] of lanes.entries()) {
    for (const item of repeatedPositions(scroll, lane.speed, laneIndex ? 126 : 98, 2)) {
      const x = Math.floor(item.x);
      const w = Math.round(19 * lane.scale);
      const h = Math.round(3 * lane.scale);
      ctx.fillStyle = '#4b3d2b';
      polygon(ctx, [[x - 2, lane.y + h], [x + w + 4, lane.y + h], [x + w, lane.y - h], [x, lane.y - h]]);
      ctx.fillStyle = palette.glow;
      ctx.globalAlpha = .68 + Math.sin(time * 7 + item.index) * .14;
      polygon(ctx, [[x, lane.y], [x + w, lane.y], [x + w - 3, lane.y - h], [x + 2, lane.y - h]]);
    }
  }
  ctx.globalAlpha = 1;
}

function drawGuardrail(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number) {
  const props = getRoadProps();
  if (props) {
    // Slight overlap makes the authored rail read as one uninterrupted beam,
    // while its post cadence still supplies a clean parallax beat.
    // The generated cell intentionally contains breathing room. A wider draw
    // and 104px cadence make the 165px painted beam itself overlap by ~4px,
    // eliminating white-space seams without cropping its authored post/foot.
    for (const item of repeatedPositions(scroll, .72, 104, 2)) {
      drawRoadPropCell(ctx, props, RoadPropCell.Guardrail, pixel2(item.x + 52), 328, 168, 108);
    }
    return;
  }

  // Three-tone metal contract: 2px top-left highlight, mid face, dark base.
  ctx.fillStyle = '#090b12';
  ctx.fillRect(0, 294, ENVIRONMENT_WIDTH, 8);
  ctx.fillStyle = palette.metal;
  ctx.fillRect(0, 296, ENVIRONMENT_WIDTH, 6);
  ctx.fillStyle = mixColor(palette.metal, '#f0d8b0', .2);
  ctx.fillRect(0, 296, ENVIRONMENT_WIDTH, 2);
  for (const item of repeatedPositions(scroll, .72, 78, 2)) {
    const x = pixel2(item.x);
    ctx.fillStyle = '#090b12';
    ctx.fillRect(x + 4, 300, 8, 26);
    ctx.fillStyle = palette.metal;
    ctx.fillRect(x, 302, 8, 20);
    ctx.fillStyle = mixColor(palette.metal, '#f0d8b0', .28);
    ctx.fillRect(x, 302, 2, 16);
    ctx.fillRect(x, 302, 6, 2);
    ctx.fillStyle = palette.hot;
    ctx.fillRect(x, 300, 6, 2);
  }
}

function drawRoadSign(ctx: CanvasRenderingContext2D, palette: Palette, x: number, props: HTMLImageElement | null) {
  if (props) {
    drawRoadPropCell(ctx, props, RoadPropCell.Sign, x, 300, 128, 96);
    return;
  }

  const dark = '#070a11';
  const mid = mixColor(palette.metal, palette.road0, .25);
  const light = mixColor(palette.metal, '#f4dfbd', .34);

  ctx.fillStyle = dark;
  ctx.fillRect(x, 234, 8, 62);
  ctx.fillStyle = mid;
  ctx.fillRect(x + 2, 234, 4, 60);
  ctx.fillStyle = light;
  ctx.fillRect(x + 2, 234, 2, 54);

  // The 72x30 face is assembled from aligned blocks; no long antialiased
  // polygon silhouette floats over the authored horizon.
  ctx.fillStyle = dark;
  ctx.fillRect(x - 34, 232, 68, 30);
  ctx.fillRect(x - 38, 238, 76, 18);
  ctx.fillStyle = mid;
  ctx.fillRect(x - 32, 234, 64, 26);
  ctx.fillRect(x - 36, 240, 72, 14);
  ctx.fillStyle = light;
  ctx.fillRect(x - 30, 236, 58, 2);
  ctx.fillRect(x - 34, 240, 2, 12);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(x - 28, 240, 56, 2);
  ctx.fillStyle = palette.hot;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x - 24 + i * 14, 246, 8, 4);
    ctx.fillRect(x - 22 + i * 14, 244, 4, 2);
  }
}

function drawRoadLamp(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  time: number,
  seed: number,
  props: HTMLImageElement | null,
) {
  if (props) {
    drawRoadPropCell(ctx, props, RoadPropCell.Lamp, x + 8, 298, 128, 96);
  } else {
    const dark = '#070910';
    const mid = mixColor(palette.metal, palette.road0, .2);
    const light = mixColor(palette.metal, '#f4dfbd', .32);
    ctx.fillStyle = dark;
    ctx.fillRect(x, 222, 8, 74);
    ctx.fillStyle = mid;
    ctx.fillRect(x + 2, 222, 6, 72);
    ctx.fillStyle = light;
    ctx.fillRect(x + 2, 222, 2, 64);

    ctx.fillStyle = dark;
    ctx.fillRect(x - 4, 216, 40, 12);
    ctx.fillRect(x, 212, 30, 16);
    ctx.fillStyle = mid;
    ctx.fillRect(x, 216, 32, 8);
    ctx.fillRect(x + 4, 214, 24, 10);
    ctx.fillStyle = light;
    ctx.fillRect(x + 4, 214, 20, 2);
    ctx.fillRect(x, 216, 2, 6);
  }

  const pulse = .58 + Math.sin(time * 4 + seed) * .2;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = palette.glow;
  ctx.fillRect(x + 4, 218, 24, 4);
  ctx.fillRect(x + 8, 222, 16, 2);

  // Small screen-blended 2px bars imply spill without darkening the action
  // lane or laying a large translucent polygon across the panorama.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = .055;
  ctx.fillStyle = palette.accent;
  ctx.fillRect(x - 12, 230, 58, 2);
  ctx.fillRect(x - 6, 236, 46, 2);
  ctx.fillRect(x, 242, 34, 2);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawRoadsideProps(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, time: number, section: EnvironmentSection) {
  const props = getRoadProps();
  for (const item of repeatedPositions(scroll, .48, 312, 2)) {
    const x = pixel2(item.x + 84);
    if (item.index % 3 === 0) {
      drawRoadSign(ctx, palette, x, props);
    } else {
      drawRoadLamp(ctx, palette, x, time, item.index, props);
    }
  }

  // Wreckage remains on the extreme shoulder, leaving y=330..468 visually clean.
  for (const item of repeatedPositions(scroll, .96, 438, 2)) {
    const x = Math.floor(item.x + 15);
    const front = item.index % 2 === 0;
    const y = front ? 493 : 317;
    if (props) {
      drawRoadPropCell(ctx, props, RoadPropCell.Wreck, x + 38, y + 7, 118, 88, item.index % 4 === 0);
    } else {
      ctx.fillStyle = '#080a10';
      polygon(ctx, [[x, y], [x + 24, y - 14], [x + 53, y - 9], [x + 75, y], [x + 59, y + 7], [x + 16, y + 5]]);
      ctx.fillStyle = palette.metal;
      polygon(ctx, [[x + 9, y - 1], [x + 28, y - 10], [x + 53, y - 6], [x + 63, y], [x + 45, y + 2]]);
      ctx.fillStyle = item.index % 3 === 0 ? palette.hot : palette.accent;
      ctx.fillRect(x + 28, y - 8, 14, 3);
    }
  }

  if (section === 'lava-foundry') {
    ctx.fillStyle = palette.hot;
    ctx.globalAlpha = .22;
    ctx.fillRect(0, 507, ENVIRONMENT_WIDTH, 5);
    ctx.globalAlpha = 1;
  }
}

function drawShoulders(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number) {
  const strip = getShoulderStrip();
  const top = 476;
  const tileWidth = 512;
  const tileHeight = ENVIRONMENT_HEIGHT - top;
  ctx.fillStyle = palette.shoulder;
  ctx.fillRect(0, top, ENVIRONMENT_WIDTH, tileHeight);
  if (strip) {
    const travel = scroll * 1.72;
    const firstTile = Math.floor(travel / tileWidth);
    const offset = wrap(travel, tileWidth);
    for (let tile = -1; tile <= 2; tile++) {
      const x = Math.floor(tile * tileWidth - offset);
      const mirrored = (firstTile + tile) % 2 !== 0;
      ctx.save();
      ctx.translate(mirrored ? x + tileWidth : x, top);
      if (mirrored) ctx.scale(-1, 1);
      ctx.drawImage(strip, 0, 0, strip.naturalWidth, strip.naturalHeight, 0, 0, tileWidth, tileHeight);
      ctx.restore();
    }
    ctx.globalAlpha = .28;
    ctx.fillStyle = palette.shoulder;
    ctx.fillRect(0, top, ENVIRONMENT_WIDTH, 4);
    ctx.globalAlpha = 1;
  } else {
    // Complete fallback: stepped slabs and gravel replace the old flat band.
    ctx.fillStyle = palette.road2;
    for (const item of repeatedPositions(scroll, 1.72, 96, 2)) {
      const x = pixel2(item.x);
      polygon(ctx, [[x - 24, 540], [x - 10, 492], [x + 36, 486], [x + 72, 540]]);
      ctx.fillStyle = item.index % 2 === 0 ? palette.shoulder : palette.road0;
      ctx.fillRect(x + 6, 510, 18, 6);
    }
  }
  ctx.fillStyle = '#08090e';
  ctx.fillRect(0, top, ENVIRONMENT_WIDTH, 3);
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, speed: number, time: number, intensity: number) {
  const amount = clamp((speed - 90) / 320) * clamp(intensity, 0, 2);
  if (amount <= .02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 22; i++) {
    if (hash(i * 7 + Math.floor(time * 5)) > amount * .82) continue;
    const ySeed = hash(i * 29 + 2);
    // Keep the central combat corridor comparatively quiet.
    const y = ySeed < .72 ? 18 + ySeed * 245 : 500 + (ySeed - .72) * 130;
    const period = 1050 + hash(i) * 290;
    const x = wrap(hash(i * 13) * period - scroll * (1.9 + hash(i) * 1.5), period) - 170;
    const length = 18 + amount * (45 + hash(i + 6) * 95);
    ctx.globalAlpha = .08 + amount * .17;
    ctx.fillStyle = i % 5 === 0 ? palette.accent : palette.glow;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(length), i % 4 === 0 ? 2 : 1);
  }
  ctx.restore();
}

function drawAmbientSparks(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, time: number, section: EnvironmentSection, intensity: number) {
  if (section !== 'lava-foundry' && section !== 'neon-refinery') return;
  const count = 11 + Math.round(intensity * 7);
  for (let i = 0; i < count; i++) {
    const cycle = wrap(time * (34 + hash(i) * 35) + i * 71, 1100);
    const x = wrap(hash(i * 13) * 960 - cycle - scroll * .08, 1040) - 40;
    const y = 194 + hash(i * 23) * 105 + wrap(cycle * .18, 42);
    ctx.globalAlpha = .18 + hash(i) * .28;
    ctx.fillStyle = i % 3 === 0 ? palette.glow : palette.hot;
    ctx.fillRect(Math.floor(x), Math.floor(y), i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 3 : 2);
  }
  ctx.globalAlpha = 1;
}

function withLogicalCanvas(ctx: CanvasRenderingContext2D, options: EnvironmentDrawOptions, draw: () => void) {
  const width = options.width ?? ENVIRONMENT_WIDTH;
  const height = options.height ?? ENVIRONMENT_HEIGHT;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.scale(width / ENVIRONMENT_WIDTH, height / ENVIRONMENT_HEIGHT);
  ctx.imageSmoothingEnabled = false;
  draw();
  ctx.restore();
}

/** Draw the complete world background, road and non-occluding speed detail. */
export function drawEnvironment(ctx: CanvasRenderingContext2D, options: EnvironmentDrawOptions): void {
  const phase = getEnvironmentPhase(options.elapsed);
  const basePalette = PALETTES[phase.current];
  const nextPalette = PALETTES[phase.next];
  const palette = mixPalette(basePalette, nextPalette, phase.mix);
  const intensity = clamp(options.intensity ?? 1, 0, 2);
  const shakeEnergy = clamp((options.shake ?? 0) / 18, 0, 1);

  withLogicalCanvas(ctx, options, () => {
    drawBandSky(ctx, palette, options.time, options.scroll);
    const panoramaReady = drawAuthoredPanorama(ctx, palette, options.scroll, options.time);
    if (!panoramaReady) {
      // Preserve the complete former world while the optional asset loads or
      // if it fails. Once ready, the authored panorama is the sole far horizon.
      drawMoons(ctx, palette, options.scroll, phase.mix < .5 ? phase.current : phase.next);
      drawCloudBands(ctx, palette, options.scroll, options.time, phase.mix < .5 ? phase.current : phase.next);
      drawSectionFeatures(ctx, phase.current, basePalette, options.scroll, options.time, phase.current === phase.next ? 1 : 1 - phase.mix);
      if (phase.current !== phase.next) drawSectionFeatures(ctx, phase.next, nextPalette, options.scroll, options.time, phase.mix);
    }
    drawHorizonEnergy(ctx, palette, options.time, intensity + shakeEnergy * .3);
    drawRoadBase(ctx, palette, options.scroll, phase.mix < .5 ? phase.current : phase.next);
    drawAsphaltTexture(ctx, palette, options.scroll);
    drawRoadMaterialEvents(ctx, palette, options.scroll, options.time);
    drawCracks(ctx, palette, options.scroll);
    drawLaneReflectors(ctx, palette, options.scroll, options.time);
    drawRoadsideProps(ctx, palette, options.scroll, options.time, phase.mix < .5 ? phase.current : phase.next);
    // The safety rail is nearest to the camera. Drawing it after roadside
    // lamps/signs keeps their bases behind the barrier and restores depth.
    drawGuardrail(ctx, palette, options.scroll);
    drawShoulders(ctx, palette, options.scroll);
    drawAmbientSparks(ctx, palette, options.scroll, options.time, phase.mix < .5 ? phase.current : phase.next, intensity);
    drawSpeedLines(ctx, palette, options.scroll, options.speed, options.time, intensity + shakeEnergy * .35);
  });
}

/**
 * Optional pass to call after actors but before the HUD. It only occupies the
 * extreme bottom/edge zones, creating camera depth without hiding combat.
 */
export function drawEnvironmentForeground(ctx: CanvasRenderingContext2D, options: EnvironmentDrawOptions): void {
  const phase = getEnvironmentPhase(options.elapsed);
  const palette = mixPalette(PALETTES[phase.current], PALETTES[phase.next], phase.mix);
  const intensity = clamp(options.intensity ?? 1, 0, 2);
  const velocity = clamp((options.speed - 100) / 310);
  withLogicalCanvas(ctx, options, () => {
    ctx.save();
    const props = getRoadProps();
    // Shoulder rocks share the same foreground pass as the large near-camera
    // formations. At the lowest ride line every rock now crosses in front of
    // wheels instead of slipping behind a heroine drawn later.
    for (const item of repeatedPositions(options.scroll, 1.85, props ? 104 : 67, 2)) {
      const x = Math.floor(item.x);
      if (props) {
        const cell = item.index % 2 === 0 ? RoadPropCell.ShoulderRockA : RoadPropCell.ShoulderRockB;
        // The atlas cells include a broad painted base.  Keep that base below
        // the canvas so the shoulder silhouettes enter from the near plane
        // instead of appearing to hover over the bottom road strip.
        drawRoadPropCell(ctx, props, cell, x + 28, 562, 98, 74, item.index % 4 === 1, .94);
      } else {
        ctx.fillStyle = item.index % 3 === 0 ? palette.metal : palette.road0;
        polygon(ctx, [[x - 18, 540], [x + 4, 509], [x + 31, 506], [x + 56, 540]]);
        ctx.fillStyle = '#07080d';
        polygon(ctx, [[x + 14, 540], [x + 35, 511], [x + 57, 540]]);
      }
    }
    for (const item of repeatedPositions(options.scroll, 2.46, 296, 2)) {
      if (item.index % 3 === 1) continue;
      const x = Math.floor(item.x);
      if (props) {
        const cell = item.index % 2 === 0 ? RoadPropCell.ForegroundRockA : RoadPropCell.ForegroundRockB;
        // Still large enough to establish the fastest parallax plane, but its
        // crest remains beneath rider torsos and projectile silhouettes.
        drawRoadPropCell(ctx, props, cell, x, 574, 152, 114, item.index % 4 === 2, .82 + velocity * .12);
      } else {
        ctx.globalAlpha = .65 + velocity * .2;
        ctx.fillStyle = '#05060b';
        polygon(ctx, [[x - 52, 540], [x - 18, 516], [x + 11, 520], [x + 45, 540]]);
        ctx.fillStyle = palette.shoulder;
        ctx.globalAlpha = .34;
        polygon(ctx, [[x - 23, 540], [x - 3, 521], [x + 17, 525], [x + 31, 540]]);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = (.06 + velocity * .13) * intensity;
    ctx.fillStyle = palette.accent;
    for (let i = 0; i < 5; i++) {
      const y = i < 3 ? 33 + i * 61 : 514 + (i - 3) * 11;
      const x = wrap(i * 229 - options.scroll * (2.8 + i * .14), 1180) - 180;
      ctx.fillRect(Math.round(x), y, 90 + i * 17, i === 4 ? 2 : 1);
    }
    ctx.restore();
  });
}

/** Positional adapter for integrations that do not want to allocate an options literal. */
export function drawEnvironmentFrame(
  ctx: CanvasRenderingContext2D,
  scroll: number,
  elapsed: number,
  speed: number,
  time: number,
  shake = 0,
  intensity = 1,
): void {
  drawEnvironment(ctx, { scroll, elapsed, speed, time, shake, intensity });
}
