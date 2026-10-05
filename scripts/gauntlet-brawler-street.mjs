import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173/biker_cows';
const output = path.resolve('.gauntlet/brawler-street');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => errors.push(request.url()));
try {
  await page.goto(`${baseURL}/?scene=brawler-walk`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Object.values(window.__BCFV_DEBUG__.snapshot().brawler.assets).every(state => state === 'ready'));
  const report = await page.evaluate(async () => {
    const { StreetRibbon } = await import('./src/brawler/StreetRibbon.ts');
    const { BeatEmUpStage } = await import('./src/brawler/BeatEmUpStage.ts');
    const { FURNACE_DISTRICT: level } = await import('./src/levels/campaign.ts');
    const ribbon = new StreetRibbon(level.street);
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
    const ctx = canvas.getContext('2d');
    const stage = new BeatEmUpStage(ctx, { level, heroes: ['cassia'], debugScene: 'brawler-walk' });
    await Promise.all([stage.backdrop, ...Object.values(stage.heroSheets)].map(asset => new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        if (asset.state === 'ready') { clearInterval(timer); resolve(); }
        else if (asset.state === 'error') { clearInterval(timer); reject(Error(asset.path)); }
      }, 10);
    })));
    const frames = [];
    let start = 0;
    for (const section of level.street) {
      stage.cameraX = Math.min(start, level.length - 960);
      stage.players[0].x = stage.cameraX + 400;
      stage.draw(false);
      frames.push({ name: section.kind, cameraX: stage.cameraX, image: canvas.toDataURL('image/png') });
      start += section.width;
    }
    // Every ground pixel is covered, including both sides of every section seam.
    const seams = []; let end = 0;
    for (const section of level.street.slice(0, -1)) {
      end += section.width;
      for (const delta of [-1, 0, 1]) {
        ctx.clearRect(0, 0, 960, 540);
        ribbon.draw(ctx, end - 480 + delta);
        const pixels = ctx.getImageData(0, 302, 960, 238).data;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) throw Error(`Street gap at ${end}, ${delta}`);
      }
      seams.push(end);
    }
    // World features move exactly by camera displacement and return unchanged.
    const pixelsAt = camera => {
      ctx.clearRect(0, 0, 960, 540); ribbon.draw(ctx, camera);
      return ctx.getImageData(0, 302, 960, 238).data;
    };
    const before = pixelsAt(960); const after = pixelsAt(1080);
    for (let y = 0; y < 238; y++) for (let x = 0; x < 840; x++) for (let c = 0; c < 4; c++) {
      if (before[(y * 960 + x + 120) * 4 + c] !== after[(y * 960 + x) * 4 + c]) throw Error('Ground slipped against world coordinates');
    }
    const returned = pixelsAt(960);
    if (before.some((v, i) => v !== returned[i])) throw Error('Street changed on reverse travel');
    // A dash beginning in one section must resume in the next section.
    // Opaque coverage alone cannot detect a clipped road marking.
    for (const seam of [1000, 4700]) {
      ctx.clearRect(0, 0, 960, 540); ribbon.draw(ctx, seam - 480);
      const marking = ctx.getImageData(478, 444, 4, 2).data;
      for (let i = 4; i < marking.length; i++) {
        if (marking[i] !== marking[i % 4]) throw Error(`Road marking interrupted at ${seam}`);
      }
    }
    const placements = [];
    const fake = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fillRect() {}, drawImage(...args) { placements.push(args.slice(1)); } };
    for (const camera of [0, 1000, 2000, level.length - 960]) StreetRibbon.drawPanorama(fake, stage.backdrop.image, camera, level.length);
    const maxCamera = level.length - 960;
    if (placements[1][0] !== -180 || placements[2][0] !== -360) throw Error('Incorrect far parallax speed');
    const last = placements.at(-1);
    if (last[0] + last[2] < 960) throw Error('Panorama runs out before level end');
    return { length: start, seams, maxCamera, placements, frames };
  });
  assert.equal(report.length, 6700);
  for (const frame of report.frames) await writeFile(path.join(output, `${frame.name}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
  delete report.frames;
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
} finally {
  await browser.close();
}
