import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(process.env.BCFV_CAPTURE_DIR ?? '.gauntlet/brawler-gait');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(30_000);
const runtimeErrors = [];
page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
page.on('requestfailed', request => runtimeErrors.push(`request: ${request.url()} (${request.failure()?.errorText})`));

const snapshot = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot().brawler.players[0]);
const canvasShot = async name => {
  const dataURL = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataURL.split(',')[1], 'base64'));
};

async function inspectAuthoredStrip(hero) {
  return page.evaluate(async heroId => {
    const image = new Image();
    image.src = new URL(`assets/brawler/${heroId}-brawler-walk-v2.png`, document.baseURI).href;
    await image.decode();
    const frameWidth = 256;
    const frameHeight = 192;
    if (image.naturalWidth !== frameWidth * 4 || image.naturalHeight !== frameHeight) {
      throw new Error(`${heroId} walk atlas must be 1024x192, got ${image.naturalWidth}x${image.naturalHeight}`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const normalizedMasks = [];
    const alphaPixels = [];
    for (let frame = 0; frame < 4; frame++) {
      context.clearRect(0, 0, frameWidth, frameHeight);
      context.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
      const rgba = context.getImageData(0, 0, frameWidth, frameHeight).data;
      const mask = new Uint8Array(frameWidth * frameHeight);
      let count = 0;
      let minX = frameWidth;
      let minY = frameHeight;
      let maxX = -1;
      let maxY = -1;
      for (let pixel = 0; pixel < mask.length; pixel++) {
        mask[pixel] = rgba[pixel * 4 + 3] > 16 ? 1 : 0;
        count += mask[pixel];
        if (mask[pixel]) {
          const x = pixel % frameWidth;
          const y = Math.floor(pixel / frameWidth);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      if (count < 500 || count > mask.length * .8) throw new Error(`${heroId} frame ${frame} has invalid transparent silhouette area: ${count}`);
      // Normalize the occupied bounds before comparison. This deliberately
      // makes a translated or uniformly scaled copy compare as the same pose;
      // only a real change to the actor silhouette can satisfy the gate.
      const normalized = new Uint8Array(64 * 64);
      const occupiedWidth = maxX - minX + 1;
      const occupiedHeight = maxY - minY + 1;
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const sourceX = minX + Math.min(occupiedWidth - 1, Math.floor((x + .5) / 64 * occupiedWidth));
          const sourceY = minY + Math.min(occupiedHeight - 1, Math.floor((y + .5) / 64 * occupiedHeight));
          normalized[y * 64 + x] = mask[sourceY * frameWidth + sourceX];
        }
      }
      normalizedMasks.push(normalized);
      alphaPixels.push(count);
    }
    const pairwiseSilhouetteDifference = [];
    for (let left = 0; left < 4; left++) {
      for (let right = left + 1; right < 4; right++) {
        let union = 0;
        let xor = 0;
        for (let pixel = 0; pixel < normalizedMasks[left].length; pixel++) {
          union += normalizedMasks[left][pixel] | normalizedMasks[right][pixel];
          xor += normalizedMasks[left][pixel] ^ normalizedMasks[right][pixel];
        }
        const ratio = xor / Math.max(1, union);
        pairwiseSilhouetteDifference.push({ frames: [left, right], ratio: Number(ratio.toFixed(4)) });
        if (ratio < .02) throw new Error(`${heroId} frames ${left}/${right} are translations/repeats, silhouette delta ${ratio}`);
      }
    }
    return { dimensions: [image.naturalWidth, image.naturalHeight], alphaPixels, pairwiseSilhouetteDifference };
  }, hero);
}

const report = {};
try {
  for (const hero of ['cassia', 'bruna', 'nova']) {
    await page.goto(`${baseURL}/?scene=brawler&hero=${hero}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(heroId => {
      const state = window.__BCFV_DEBUG__?.snapshot().brawler;
      return state?.status === 'running' && state.assets?.[`${heroId}Walk`] === 'ready';
    }, hero, { polling: 'raf' });

    const authoredStrip = await inspectAuthoredStrip(hero);
    const initial = await snapshot();
    if (initial.walkFrameDurationMs < 100 || initial.walkFrameDurationMs > 150) {
      throw new Error(`${hero} walk cel duration outside 100-150ms: ${initial.walkFrameDurationMs}`);
    }

    const samples = [];
    let priorPhase = initial.walkPhase;
    await page.keyboard.down('KeyD');
    const deadline = Date.now() + 2500;
    while (samples.length < 4 && Date.now() < deadline) {
      await page.waitForTimeout(8);
      const state = await snapshot();
      if (!state.moving || state.walkPhase === priorPhase) continue;
      priorPhase = state.walkPhase;
      const capturedAtMs = Date.now();
      await canvasShot(`${hero}-run-${String(samples.length).padStart(2, '0')}-frame-${state.frame}`);
      samples.push({
        capturedAtMs,
        frame: state.frame,
        phase: state.walkPhase,
        contact: state.walkContact,
        atlas: state.motionAtlas,
        pose: state.pose,
      });
    }
    await page.keyboard.up('KeyD');
    if (samples.length !== 4) throw new Error(`${hero} did not yield four consecutive walk cels`);
    if (new Set(samples.map(sample => sample.frame)).size !== 4) throw new Error(`${hero} repeated source frames: ${samples.map(sample => sample.frame)}`);
    if (samples.some(sample => sample.atlas !== 'walk')) throw new Error(`${hero} escaped dedicated walk atlas`);
    if (!samples.some(sample => sample.frame === 2 && sample.contact === 'right-contact')) {
      throw new Error(`${hero} frame 2 is not documented as lowered right-foot contact`);
    }
    if (samples.some(sample => sample.pose.offsetX !== 0 || sample.pose.offsetY !== 0 || sample.pose.rotation !== 0 || sample.pose.scaleX !== 1 || sample.pose.scaleY !== 1)) {
      throw new Error(`${hero} gait still fakes uniqueness with procedural transforms: ${JSON.stringify(samples)}`);
    }
    const captureIntervalsMs = samples.slice(1).map((sample, index) => sample.capturedAtMs - samples[index].capturedAtMs);
    report[hero] = {
      nominalFrameDurationMs: initial.walkFrameDurationMs,
      frames: samples.map(sample => sample.frame),
      phases: samples.map(sample => sample.phase),
      contacts: samples.map(sample => sample.contact),
      captureIntervalsMs,
      authoredStrip,
    };
  }
  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: true, runtimeErrors, heroes: report }, null, 2));
  console.log(JSON.stringify({ ok: true, runtimeErrors, heroes: report }, null, 2));
} catch (error) {
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: false, runtimeErrors, heroes: report, error: error instanceof Error ? error.stack : String(error) }, null, 2));
  throw error;
} finally {
  await browser.close();
}
