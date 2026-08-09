/**
 * Procedural 16-bit stage environment for Mars Redline.
 *
 * The renderer is intentionally stateless: every decoration is derived from
 * scroll/time, so captures and debug scene jumps remain deterministic.
 */

export const ENVIRONMENT_WIDTH = 960;
export const ENVIRONMENT_HEIGHT = 540;
export const ENVIRONMENT_ROAD_TOP = 292;
export const ENVIRONMENT_ROAD_BOTTOM = 506;
export const ENVIRONMENT_DURATION = 465;

export type EnvironmentSection =
  | 'mars-outskirts'
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
  'mars-outskirts',
  'neon-refinery',
  'lava-foundry',
  'fortress-approach',
];

const PALETTES: Record<EnvironmentSection, Palette> = {
  'mars-outskirts': {
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

  if (section === 'mars-outskirts') {
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
  if (section === 'mars-outskirts') drawOutskirts(ctx, palette, scroll, time);
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

  // Tar repairs and twin tire marks: broad, curved and low contrast.
  for (let track = 0; track < 3; track++) {
    const y = 338 + track * 61;
    const offset = wrap(scroll * (1.06 + track * .12) + track * 311, 740) - 160;
    ctx.strokeStyle = '#05070b';
    ctx.globalAlpha = .24 + track * .05;
    ctx.lineWidth = 3 + track;
    ctx.beginPath();
    ctx.moveTo(offset, y);
    ctx.bezierCurveTo(offset + 100, y - 9, offset + 225, y + 12, offset + 360, y - 3);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.road2;
    ctx.beginPath();
    ctx.moveTo(offset, y - 3);
    ctx.bezierCurveTo(offset + 100, y - 12, offset + 225, y + 9, offset + 360, y - 6);
    ctx.stroke();
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
  ctx.fillStyle = '#090b12';
  ctx.fillRect(0, 294, ENVIRONMENT_WIDTH, 5);
  ctx.fillStyle = palette.metal;
  ctx.fillRect(0, 298, ENVIRONMENT_WIDTH, 5);
  ctx.fillStyle = mixColor(palette.metal, '#f0d8b0', .2);
  ctx.fillRect(0, 298, ENVIRONMENT_WIDTH, 2);
  for (const item of repeatedPositions(scroll, .72, 78, 2)) {
    const x = Math.floor(item.x);
    ctx.fillStyle = '#090b12';
    ctx.fillRect(x + 3, 300, 7, 23);
    ctx.fillStyle = palette.metal;
    ctx.fillRect(x, 302, 7, 18);
    ctx.fillStyle = palette.hot;
    ctx.fillRect(x - 1, 301, 8, 3);
  }
}

function drawRoadsideProps(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number, time: number, section: EnvironmentSection) {
  for (const item of repeatedPositions(scroll, .48, 312, 2)) {
    const x = Math.floor(item.x + 84);
    if (item.index % 3 === 0) {
      // Angular highway marker; the face color changes with the region.
      ctx.fillStyle = '#070a11';
      ctx.fillRect(x - 3, 233, 9, 63);
      ctx.fillStyle = palette.metal;
      ctx.fillRect(x, 236, 5, 60);
      ctx.fillStyle = '#090c18';
      polygon(ctx, [[x - 32, 231], [x + 44, 231], [x + 55, 242], [x + 44, 264], [x - 32, 264], [x - 42, 252]]);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(x - 28, 235, 67, 3);
      ctx.fillRect(x - 28, 257, 67, 3);
      ctx.fillStyle = palette.hot;
      for (let i = 0; i < 4; i++) ctx.fillRect(x - 22 + i * 15, 244, 9, 5);
    } else {
      ctx.fillStyle = '#070910';
      ctx.fillRect(x + 1, 223, 7, 72);
      ctx.fillStyle = palette.metal;
      ctx.fillRect(x + 4, 223, 4, 72);
      polygon(ctx, [[x - 3, 228], [x + 5, 213], [x + 30, 213], [x + 38, 228]]);
      ctx.fillStyle = palette.glow;
      ctx.globalAlpha = .58 + Math.sin(time * 4 + item.index) * .2;
      ctx.fillRect(x + 5, 217, 25, 5);
      ctx.globalAlpha = .07;
      polygon(ctx, [[x + 4, 222], [x + 31, 222], [x + 72, 292], [x - 37, 292]]);
      ctx.globalAlpha = 1;
    }
  }

  // Wreckage remains on the extreme shoulder, leaving y=330..468 visually clean.
  for (const item of repeatedPositions(scroll, .96, 438, 2)) {
    const x = Math.floor(item.x + 15);
    const front = item.index % 2 === 0;
    const y = front ? 493 : 317;
    ctx.fillStyle = '#080a10';
    polygon(ctx, [[x, y], [x + 24, y - 14], [x + 53, y - 9], [x + 75, y], [x + 59, y + 7], [x + 16, y + 5]]);
    ctx.fillStyle = palette.metal;
    polygon(ctx, [[x + 9, y - 1], [x + 28, y - 10], [x + 53, y - 6], [x + 63, y], [x + 45, y + 2]]);
    ctx.fillStyle = item.index % 3 === 0 ? palette.hot : palette.accent;
    ctx.fillRect(x + 28, y - 8, 14, 3);
  }

  if (section === 'lava-foundry') {
    ctx.fillStyle = palette.hot;
    ctx.globalAlpha = .22;
    ctx.fillRect(0, 507, ENVIRONMENT_WIDTH, 5);
    ctx.globalAlpha = 1;
  }
}

function drawShoulders(ctx: CanvasRenderingContext2D, palette: Palette, scroll: number) {
  ctx.fillStyle = palette.shoulder;
  ctx.fillRect(0, ENVIRONMENT_ROAD_BOTTOM, ENVIRONMENT_WIDTH, ENVIRONMENT_HEIGHT - ENVIRONMENT_ROAD_BOTTOM);
  ctx.fillStyle = '#08090e';
  ctx.fillRect(0, ENVIRONMENT_ROAD_BOTTOM, ENVIRONMENT_WIDTH, 7);
  for (const item of repeatedPositions(scroll, 1.85, 67, 2)) {
    const x = Math.floor(item.x);
    ctx.fillStyle = item.index % 3 === 0 ? palette.metal : palette.road0;
    polygon(ctx, [[x - 18, 540], [x + 4, 509], [x + 31, 506], [x + 56, 540]]);
    ctx.fillStyle = '#07080d';
    polygon(ctx, [[x + 14, 540], [x + 35, 511], [x + 57, 540]]);
  }
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
    drawMoons(ctx, palette, options.scroll, phase.mix < .5 ? phase.current : phase.next);
    drawCloudBands(ctx, palette, options.scroll, options.time, phase.mix < .5 ? phase.current : phase.next);
    drawSectionFeatures(ctx, phase.current, basePalette, options.scroll, options.time, phase.current === phase.next ? 1 : 1 - phase.mix);
    if (phase.current !== phase.next) drawSectionFeatures(ctx, phase.next, nextPalette, options.scroll, options.time, phase.mix);
    drawHorizonEnergy(ctx, palette, options.time, intensity + shakeEnergy * .3);
    drawRoadBase(ctx, palette, options.scroll, phase.mix < .5 ? phase.current : phase.next);
    drawAsphaltTexture(ctx, palette, options.scroll);
    drawCracks(ctx, palette, options.scroll);
    drawLaneReflectors(ctx, palette, options.scroll, options.time);
    drawGuardrail(ctx, palette, options.scroll);
    drawRoadsideProps(ctx, palette, options.scroll, options.time, phase.mix < .5 ? phase.current : phase.next);
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
    for (const item of repeatedPositions(options.scroll, 2.46, 296, 2)) {
      if (item.index % 3 === 1) continue;
      const x = Math.floor(item.x);
      ctx.globalAlpha = .65 + velocity * .2;
      ctx.fillStyle = '#05060b';
      polygon(ctx, [[x - 52, 540], [x - 18, 516], [x + 11, 520], [x + 45, 540]]);
      ctx.fillStyle = palette.shoulder;
      ctx.globalAlpha = .34;
      polygon(ctx, [[x - 23, 540], [x - 3, 521], [x + 17, 525], [x + 31, 540]]);
    }
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

