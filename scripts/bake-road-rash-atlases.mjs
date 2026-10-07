// Bake whole silhouettes into padded cells. AI supplies the art; this step only
// isolates and packs it, retaining all unedited frames from the current assets.
import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { chromium } from 'playwright-core';
import { deflateSync } from 'node:zlib';

// Encode the packed RGBA bytes directly, avoiding canvas premultiplication
// rounding when preserving unedited translucent edge pixels.
function pngFromRgba(rgba, width, height) {
  const crc32 = data => {
    let crc = -1;
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    return (crc ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]), length = Buffer.alloc(4), crc = Buffer.alloc(4);
    length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body)); return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const [heroineWindupPath, rivalWindupPath] = process.argv.slice(2);
assert(heroineWindupPath && rivalWindupPath, 'Usage: node scripts/bake-road-rash-atlases.mjs <heroine-windup.png> <rival-windup.png>');
const base = process.env.BCFV_URL ?? 'http://127.0.0.1:4186/biker_cows/';
const output = '.gauntlet/road-rash-review/raw';
await mkdir(output, { recursive: true });
const targets = ['road-rash-heroines-atlas-v1', 'road-rash-riders-atlas-v3'];
const corrected = await Promise.all([heroineWindupPath, rivalWindupPath].map(async file => `data:image/png;base64,${(await readFile(file)).toString('base64')}`));
const source = ts.transpileModule(await readFile('src/roadRash/riderAtlas.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace('export function prepareRiderAtlas', 'window.prepareRiderAtlas = function prepareRiderAtlas');
const browser = await chromium.launch({
  executablePath: process.env.BCFV_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
});
try {
  const page = await browser.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: source });
  const results = await page.evaluate(async ({ targets, corrected, base }) => {
    const load = async url => { const image = new Image(); image.src = url; await image.decode(); return image; };
    const results = [];
    for (let index = 0; index < targets.length; index++) {
      const original = window.prepareRiderAtlas(await load(new URL(`assets/road-rash/${targets[index]}.png`, base).href));
      const edit = window.prepareRiderAtlas(await load(corrected[index]));
      const packed = new Uint8Array(3072 * 1024 * 4);
      let preservedFrames = 0;
      for (let row = 0; row < 3; row++) for (let frame = 0; frame < 6; frame++) {
        // Nova's windup was already authored on the right; retain it exactly.
        const replace = frame === 1 && (index === 1 || row < 2);
        const sprite = (replace ? edit : original).frames[row][frame];
        if (sprite.width !== 512) throw new Error('Expected source frames at original pixel scale');
        const x = frame * 512, y = Math.floor(row * 1024 / 3);
        const sourcePixels = sprite.getContext('2d').getImageData(0, 0, 512, sprite.height);
        for (let line = 0; line < sprite.height; line++) packed.set(sourcePixels.data.subarray(line * 512 * 4, (line + 1) * 512 * 4), ((y + line) * 3072 + x) * 4);
        if (!replace) {
          const before = sourcePixels.data;
          for (let line = 0; line < sprite.height; line++) for (let i = 0; i < 512 * 4; i++) {
            if (before[line * 512 * 4 + i] !== packed[((y + line) * 3072 + x) * 4 + i]) throw new Error('Unedited frame changed during packing');
          }
          preservedFrames++;
        }
      }
      let binary = ''; for (let i = 0; i < packed.length; i += 16384) binary += String.fromCharCode(...packed.subarray(i, i + 16384));
      results.push({ name: targets[index], preservedFrames, rgba: btoa(binary) });
    }
    return results;
  }, { targets, corrected, base });
  for (const result of results) {
    const target = `public/assets/road-rash/${result.name}.png`;
    await copyFile(target, `${output}/${result.name}-before-packing.png`);
    await writeFile(target, pngFromRgba(Buffer.from(result.rgba, 'base64'), 3072, 1024));
    console.log(`${result.name}: packed 18 frames; ${result.preservedFrames} unedited frames verified byte-for-byte`);
  }
} finally { await browser.close(); }
