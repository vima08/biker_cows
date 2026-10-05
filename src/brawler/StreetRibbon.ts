import type { BrawlerStreetSection } from '../levels/types';

const VIEW_WIDTH = 960;
const HEIGHT = 540;
const FAR_SPEED = .18;

/** Finite, authored world strip, baked to half-resolution bitmaps once.
 * Buildings, street markings and props share the actors' world coordinates.
 * Only visible sections are submitted to the main canvas each frame. */
export class StreetRibbon {
  private readonly tiles: { start: number; end: number; image: HTMLCanvasElement }[] = [];

  constructor(sections: readonly BrawlerStreetSection[]) {
    let start = 0;
    for (const section of sections) {
      const image = document.createElement('canvas');
      image.width = Math.ceil(section.width / 2);
      image.height = HEIGHT / 2;
      const ctx = image.getContext('2d');
      if (!ctx) throw new Error('Cannot create street ribbon bitmap');
      ctx.scale(.5, .5);
      paintSection(ctx, section, start);
      this.tiles.push({ start, end: start + section.width, image });
      start += section.width;
    }
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number): void {
    ctx.imageSmoothingEnabled = false;
    // Quantize the camera once: adjacent tiles cannot round apart at their seam.
    const offset = Math.round(cameraX / 2) * 2;
    for (const tile of this.tiles) {
      if (tile.end < offset || tile.start > offset + VIEW_WIDTH) continue;
      ctx.drawImage(tile.image, tile.start - offset, 0, tile.end - tile.start, HEIGHT);
    }
  }

  static drawPanorama(ctx: CanvasRenderingContext2D, image: HTMLImageElement, cameraX: number, length: number): void {
    // Fit the complete camera travel into the source image. The same .18
    // screen-space ratio works in either direction and freezes in locked arenas.
    const width = Math.ceil((VIEW_WIDTH + Math.max(0, length - VIEW_WIDTH) * FAR_SPEED) / 2) * 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VIEW_WIDTH, 302); ctx.clip();
    ctx.drawImage(image, -Math.round(cameraX * FAR_SPEED / 2) * 2, 0, width, 322);
    ctx.fillStyle = '#18122544'; ctx.fillRect(0, 0, VIEW_WIDTH, 302);
    ctx.restore();
  }
}

function paintSection(ctx: CanvasRenderingContext2D, section: BrawlerStreetSection, start: number): void {
  const w = section.width;
  const rect = (x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, width, height);
  };
  const sign = (x: number, y: number, width: number, text: string, color = section.accent) => {
    rect(x - 4, y - 4, width + 8, 30, '#0d101a');
    rect(x, y, width, 22, '#27202d');
    rect(x, y, width, 2, color); rect(x, y + 20, width, 2, color);
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = color; ctx.fillText(text, x + width / 2, y + 16, width - 12);
  };
  const wall = (x: number, width: number, top: number, color: string) => {
    rect(x, top, width, 294 - top, '#12121d');
    rect(x + 6, top + 6, width - 12, 288 - top, color);
    for (let y = top + 16; y < 282; y += 16) {
      rect(x + 8, y, width - 16, 2, '#171720');
      for (let bx = x + 12 + (y % 32 ? 22 : 0); bx < x + width - 12; bx += 46) rect(bx, y - 14, 2, 14, '#1a1923');
    }
    rect(x - 4, top, width + 8, 6, '#73616b');
    rect(x, top + 6, width, 4, '#37323d');
    // Weathered masonry, roof ventilation and conduits give each facade depth.
    for (let i = 0; i < width; i += 6) {
      const seed = ((start + x + i * 71) * 313) >>> 0;
      rect(x + 10 + seed % Math.max(2, width - 24), top + 12 + (seed >>> 8) % Math.max(2, 262 - top), 4, 2, '#8a72752a');
    }
    rect(x + 16, top - 16, 44, 16, '#191e2a');
    for (let vx = 20; vx < 56; vx += 6) rect(x + vx, top - 12, 2, 10, '#52515f');
    rect(x + width - 26, top + 16, 6, 260 - top, '#171b28');
    rect(x + width - 24, top + 16, 2, 260 - top, '#6a535d');
    rect(x, 280, width, 14, '#12141d');
  };
  const window = (x: number, y: number, width: number, height: number, lit: boolean) => {
    rect(x - 4, y - 4, width + 8, height + 8, '#0b0e17');
    rect(x, y, width, height, lit ? '#426068' : '#242b3b');
    rect(x + 4, y + 4, width - 8, 4, lit ? '#a6bba3' : '#485363');
    rect(x + 6, y + 10, 2, height - 18, lit ? '#6d8582' : '#3e4656');
    rect(x + width / 2 - 2, y, 4, height, '#11151f');
    rect(x, y + height / 2, width, 4, '#11151f');
    rect(x - 6, y + height, width + 12, 4, '#665967');
  };
  const shutter = (x: number, width: number, y = 194) => {
    rect(x - 6, y - 6, width + 12, 294 - y, '#0c1018');
    rect(x, y, width, 286 - y, '#34333d');
    for (let sy = y + 4; sy < 284; sy += 8) {
      rect(x, sy, width, 2, '#59505a'); rect(x, sy + 2, width, 2, '#22232e');
    }
  };
  const lamp = (x: number, y = 116) => {
    rect(x - 4, y, 8, 302 - y, '#0e1520');
    rect(x, y + 8, 2, 288 - y, '#637079');
    rect(x - 28, y - 4, 36, 6, '#191a25');
    rect(x - 28, y + 2, 24, 6, '#f0bd78');
    rect(x - 30, y + 8, 28, 4, '#916043');
    rect(x - 10, 292, 20, 10, '#151722');
  };
  const car = (x: number, color: string, van = false) => {
    const y = 272;
    rect(x - 12, y + 20, van ? 242 : 226, 12, '#090d17aa');
    rect(x + 34, y + 12, 30, 20, '#080c14'); rect(x + 156, y + 12, 30, 20, '#080c14');
    rect(x + 42, y + 16, 14, 10, '#625763'); rect(x + 164, y + 16, 14, 10, '#625763');
    rect(x + 4, y - 10, 208, 30, '#0e121d');
    rect(x + 8, y - 8, 200, 22, color);
    rect(x + 46, y - (van ? 66 : 40), van ? 158 : 112, van ? 60 : 34, '#121720');
    rect(x + 50, y - (van ? 62 : 36), van ? 150 : 104, van ? 54 : 30, color);
    rect(x + 56, y - 32, 38, 22, '#344b60');
    if (!van) rect(x + 102, y - 32, 42, 22, '#344b60');
    else { rect(x + 104, y - 52, 2, 62, '#191d28'); sign(x + 114, y - 44, 76, 'FREIGHT', '#c6b094'); }
    rect(x + 60, y - 28, 28, 4, '#88a0a3');
    rect(x + 12, y - 6, 24, 6, '#ffe6a4'); rect(x + 196, y - 6, 10, 8, '#eb6566');
    rect(x, y + 10, 20, 6, '#9c9292'); rect(x + 194, y + 10, 22, 6, '#9c9292');
    rect(x + 74, y + 2, 86, 2, '#151b28');
  };
  const crate = (x: number, y: number, width = 52) => {
    rect(x, y, width, 36, '#16151d'); rect(x + 4, y + 4, width - 8, 28, '#6f5147');
    rect(x + 6, y + 8, width - 12, 4, '#a17d5c'); rect(x + 10, y + 4, 4, 28, '#322c2c');
    rect(x + width - 14, y + 4, 4, 28, '#322c2c');
  };

  // The pavement is continuous in world space; detail uses a stable world seed.
  rect(0, 294, w, 246, '#242331');
  rect(0, 302, w, 22, '#3e3945');
  rect(0, 324, w, 4, '#0b111d'); rect(0, 328, w, 2, '#6b5b61');
  rect(0, 330, w, 176, '#24232e');
  rect(0, 506, w, 34, '#141824'); rect(0, 506, w, 4, '#706069');
  // Include the preceding world mark: its tail may cross this section's edge.
  // Canvas clipping trims it without interrupting the pavement at tile seams.
  for (let wx = Math.floor(start / 80) * 80; wx < start + w; wx += 80) {
    rect(wx - start, 304, 2, 18, '#201f2c');
    rect(wx - start + 8, 518, 54, 2, '#31313d');
  }
  for (let wx = Math.floor(start / 156) * 156; wx < start + w; wx += 156) rect(wx - start, 444, 70, 4, '#796e6580');
  for (let i = 0; i < w / 3; i++) {
    const seed = ((start + i * 977) * 1597 + 337) >>> 0;
    rect(seed % (w / 2) * 2, 334 + ((seed >>> 9) % 82) * 2, 2 + (seed % 3) * 2, 2, seed % 2 ? '#49404a' : '#151b27');
  }
  // Low-contrast cracks, drain and a reflected sign beneath each block.
  for (const x of [180, w - 160]) {
    rect(x, 360, 4, 22, '#121a25'); rect(x + 4, 380, 22, 4, '#121a25'); rect(x + 22, 384, 4, 12, '#121a25');
    rect(x, 312, 58, 12, '#101720');
    for (let j = 4; j < 54; j += 8) rect(x + j, 314, 2, 8, '#62616a');
  }
  const manholeX = section.kind === 'crossroads' ? 92 : section.kind === 'depot' ? 650 : 530;
  rect(manholeX - 8, 396, 72, 20, '#111823');
  rect(manholeX, 392, 56, 24, '#4d4852'); rect(manholeX + 6, 396, 44, 16, '#252934');
  for (let x = 10; x < 48; x += 8) rect(manholeX + x, 398, 2, 12, '#72616b');
  // Repairs and faded paint change with the location instead of repeating a tile.
  if (section.kind === 'garage' || section.kind === 'depot') {
    rect(48, 350, 270, 64, '#1c202a');
    rect(52, 350, 262, 2, '#4e444a'); rect(314, 352, 2, 60, '#0f1823');
    for (let x = 76; x < w - 80; x += 184) { rect(x, 468, 4, 32, '#867965'); rect(x, 468, 96, 4, '#867965'); }
  }
  ctx.globalAlpha = .12;
  for (let i = 0; i < 7; i++) rect(120 + i * 12, 344 + i * 4, 220 - i * 24, 2, section.accent);
  ctx.globalAlpha = 1;

  if (section.kind === 'shops' || section.kind === 'market') {
    const market = section.kind === 'market';
    wall(0, 330, 138, '#3e303c'); wall(342, 304, 106, '#343344'); wall(664, w - 664, 152, '#47343b');
    for (const x of [26, 108, 214, 366, 460, 554, 690, 794, 892]) window(x, x < 340 ? 162 : x < 660 ? 128 : 176, 54, 42, x % 3 !== 0);
    sign(24, 220, 284, market ? 'SULFUR NOODLES' : 'VENUS RECORDS');
    sign(366, 192, 256, market ? 'NIGHT MARKET' : 'NEON SPARE PARTS');
    sign(690, 238, w - 714, market ? 'OPEN LATE' : 'BAR / 24H', '#e9b366');
    for (const x of [28, 128, 228, 376, 476, 566, 700, 804, 900]) {
      window(x, x < 330 ? 252 : x < 660 ? 230 : 266, 62, x > 660 ? 20 : 32, true);
      rect(x + 10, x < 330 ? 272 : x < 660 ? 248 : 272, 12, 12, '#a1766a');
    }
    for (let x = 350; x < 640; x += 24) rect(x, 218, 24, 10, (x / 24 | 0) % 2 ? '#b35f78' : '#d6af8d');
    if (market) {
      for (let x = 34; x < 316; x += 38) { rect(x, 244, 14, 16, '#e78866'); rect(x + 4, 240, 6, 4, '#f0bc85'); }
      crate(408, 272); crate(462, 278); crate(754, 270);
    } else car(718, '#664952');
    lamp(330); lamp(654, 142);
  } else if (section.kind === 'garage') {
    wall(0, w - 100, 154, '#423a3c');
    sign(92, 170, 500, section.label);
    shutter(64, 242, 212); shutter(354, 246, 212);
    window(656, 174, 118, 50, false);
    rect(690, 246, 58, 46, '#151823'); rect(736, 270, 6, 4, '#b6a184');
    sign(656, 232, 122, 'REPAIRS');
    car(340, '#8c644c');
    for (const x of [80, 118, 160]) { rect(x, 272, 32, 24, '#0f141f'); rect(x + 6, 276, 20, 4, '#4a4652'); }
    crate(802, 258); crate(850, 270); lamp(918);
    rect(14, 130, 42, 22, '#272a36'); rect(22, 136, 26, 8, '#68737b');
  } else if (section.kind === 'alley') {
    wall(0, 230, 92, '#353442'); wall(w - 240, 240, 116, '#3f323e');
    rect(230, 230, w - 470, 64, '#101722');
    for (let x = 238; x < w - 240; x += 18) rect(x, 222, 4, 70, '#62616c');
    rect(232, 242, w - 464, 4, '#303745'); sign(258, 210, 240, 'ASH LANE / NO ENTRY');
    for (const x of [26, 120, w - 210, w - 104]) window(x, 148, 58, 42, false);
    rect(154, 194, 10, 100, '#69616a'); rect(158, 200, 2, 92, '#b18e83');
    for (let y = 94; y < 258; y += 26) { rect(36, y, 112, 4, '#151824'); rect(48, y, 4, 26, '#5b5664'); rect(132, y, 4, 26, '#5b5664'); }
    rect(594, 244, 100, 48, '#344a48'); rect(586, 240, 116, 8, '#6a7a66');
    crate(506, 270); crate(460, 252); lamp(718, 158);
    rect(306, 346, 182, 4, '#51616a'); rect(330, 354, 142, 2, '#43515e');
  } else if (section.kind === 'crossroads') {
    wall(0, 178, 126, '#40343c'); wall(w - 190, 190, 144, '#393845');
    window(24, 166, 62, 64, true); shutter(w - 158, 122, 214);
    // A street recedes between the corner buildings, then crosses the walkable lane.
    rect(180, 270, w - 370, 58, '#252735');
    for (let i = 0; i < 4; i++) rect(434, 278 + i * 12, 6 + i * 2, 6, '#9b8979');
    rect(180, 302, w - 370, 26, '#252735');
    for (let x = 204; x < w - 206; x += 44) rect(x, 340, 24, 76, '#afa28a');
    rect(188, 430, w - 386, 4, '#b6a087');
    for (let x = 216; x < w - 208; x += 44) rect(x, 466, 24, 30, '#766d68');
    lamp(168); lamp(w - 182);
    for (const x of [160, w - 190]) {
      rect(x, 160, 24, 66, '#0a111a'); rect(x + 6, 168, 12, 12, '#ec786c');
      rect(x + 6, 188, 12, 12, '#685135'); rect(x + 6, 208, 12, 12, '#294944');
    }
    sign(232, 202, 408, section.label);
    rect(632, 224, 6, 72, '#67656d');
  } else if (section.kind === 'depot') {
    wall(0, w, 164, '#3b3740'); sign(70, 184, 370, section.label);
    shutter(56, 400, 220); shutter(674, 262, 200);
    for (let x = 494; x < 656; x += 40) {
      rect(x, 186, 34, 102, '#5b4b45'); rect(x + 4, 192, 4, 88, '#8c7052');
      rect(x + 28, 192, 2, 88, '#2c2931');
    }
    car(92, '#697271', true); crate(742, 256, 94); crate(840, 268, 68); crate(780, 220, 56);
    for (let x = 678; x < 932; x += 24) rect(x, 286, 14, 8, '#a38250');
    lamp(470, 126); lamp(966, 138);
  } else {
    wall(0, w, 108, '#352d35');
    for (const x of [40, 168, 782, 910]) {
      rect(x, 124, 34, 170, '#131824'); rect(x + 4, 132, 10, 150, '#827079');
      rect(x + 30, 126, 8, 168, '#55434a');
    }
    rect(290, 162, 426, 132, '#100e19'); rect(304, 172, 398, 122, '#533236');
    for (let x = 310; x < 700; x += 26) { rect(x, 180, 8, 110, '#251e29'); rect(x + 8, 180, 2, 110, '#b76f48'); }
    rect(490, 172, 12, 122, '#171721');
    sign(266, 124, 472, section.label);
    sign(346, 218, 310, 'OVERSEER / AUTHORIZED ONLY', '#f2b06c');
    for (let x = 290; x < 714; x += 24) rect(x, 286, 12, 10, '#d4a055');
    crate(76, 266); crate(836, 258); lamp(240, 122); lamp(744, 122);
    rect(250, 340, 506, 2, '#765143'); rect(286, 350, 428, 2, '#523b39');
    // Arena perimeter, anchored to the final street block rather than the viewport.
    for (let x = 116; x < w - 80; x += 58) rect(x, 486, 28, 8, '#a67f4d');
  }
  // Posters, tags and sagging overhead wiring stay attached to their block.
  if (section.kind !== 'crossroads') {
    rect(14, 242, 18, 28, '#ac9b85'); rect(18, 246, 10, 6, '#934f61'); rect(18, 256, 10, 2, '#3f3a46');
    ctx.font = 'bold italic 18px monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = '#887887'; ctx.fillText(section.kind === 'forge' ? 'NO GODS' : section.kind === 'alley' ? 'VENUS FREE' : 'COWS!', 54, 280);
  }
  ctx.strokeStyle = '#101522'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 94); ctx.quadraticCurveTo(w / 2, 138, w, 94); ctx.stroke();
  for (let x = 92; x < w; x += 216) {
    rect(x, 514, 6, 22, '#090f1a'); rect(x, 516, 2, 8, '#88726a');
  }
  rect(0, 294, w, 4, '#141924'); rect(0, 298, w, 4, '#81717a');
}
