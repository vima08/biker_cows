import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4177';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
const outputDir = path.resolve('.gauntlet/builder-brawler-motion');
await mkdir(outputDir, { recursive: true });
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

const player = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot().brawler?.players[0]);
const canvasShot = async name => {
  const dataURL = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataURL.split(',')[1], 'base64'));
};
const waitUntilRunning = async () => {
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().brawler?.status === 'running');
  await page.waitForFunction(() => Object.values(window.__BCFV_DEBUG__.snapshot().brawler.assets).every(value => value === 'ready'));
};

const report = {};
try {
  for (const hero of ['cassia', 'bruna', 'nova']) {
    await page.goto(`${baseURL}/?scene=brawler&hero=${hero}`, { waitUntil: 'networkidle' });
    await waitUntilRunning();
    const directions = {};
    for (const [key, label, expectedBase] of [['KeyD', 'right', 0], ['KeyA', 'left', 8]]) {
      const samples = [];
      const capturedPhases = new Set();
      await page.keyboard.down(key);
      const started = Date.now();
      while (Date.now() - started < 1100) {
        await page.waitForTimeout(28);
        const state = await player();
        samples.push({ phase: state.walkPhase, frame: state.frame, gaitDistance: state.gaitDistance, pose: state.pose });
        if (!capturedPhases.has(state.walkPhase)) {
          capturedPhases.add(state.walkPhase);
          await canvasShot(`${hero}-${label}-walk-${state.walkPhase}`);
        }
      }
      await page.keyboard.up(key);
      const phases = [...new Set(samples.map(sample => sample.phase))].sort();
      const frames = [...new Set(samples.map(sample => sample.frame))].sort();
      const poseSignatures = phases.map(phase => {
        const sample = samples.find(candidate => candidate.phase === phase);
        return [sample.frame, sample.pose.offsetY, sample.pose.rotation, sample.pose.scaleX, sample.pose.scaleY].join(':');
      });
      if (phases.join(',') !== '0,1,2,3') throw new Error(`${hero} ${label} did not traverse four gait phases: ${phases}`);
      if (new Set(poseSignatures).size !== 4) throw new Error(`${hero} ${label} gait phases are not visually distinct: ${poseSignatures}`);
      if (frames.some(frame => frame < expectedBase || frame > expectedBase + 2)) throw new Error(`${hero} ${label} escaped locomotion frames: ${frames}`);
      directions[label] = { phases, frames, poseSignatures, distance: Number((samples.at(-1).gaitDistance - samples[0].gaitDistance).toFixed(2)) };
    }

    await page.keyboard.press('KeyZ');
    const attackPhases = new Set();
    const attackFrames = new Set();
    for (let index = 0; index < 14; index++) {
      await page.waitForTimeout(18);
      const state = await player();
      if (state.attackPhase) attackPhases.add(state.attackPhase);
      if (state.attackTimer > 0) attackFrames.add(state.frame);
    }
    if (![...attackPhases].includes('windup') || ![...attackPhases].includes('contact') || ![...attackPhases].includes('recovery')) {
      throw new Error(`${hero} ground attack phases missing: ${[...attackPhases]}`);
    }

    await page.keyboard.press('KeyX');
    await page.waitForTimeout(100);
    await page.keyboard.press('KeyZ');
    const airborneFrames = new Set();
    const airbornePhases = new Set();
    for (let index = 0; index < 18; index++) {
      await page.waitForTimeout(20);
      const state = await player();
      if (state.airborneAttack) {
        airborneFrames.add(state.frame);
        if (state.attackPhase) airbornePhases.add(state.attackPhase);
      }
    }
    if (airborneFrames.has(7) || airborneFrames.has(15)) throw new Error(`${hero} airborne attack reused hurt frame: ${[...airborneFrames]}`);
    report[hero] = { directions, attackPhases: [...attackPhases], attackFrames: [...attackFrames], airbornePhases: [...airbornePhases], airborneFrames: [...airborneFrames] };
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ ok: true, errors, heroes: report }, null, 2));
} finally {
  await browser.close();
}
