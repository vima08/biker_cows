import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('.gauntlet/builder-stage1-temporal');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const runtimeErrors = [];
page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
page.on('requestfailed', request => runtimeErrors.push(`request: ${request.url()} :: ${request.failure()?.errorText}`));

const canvasShot = async name => {
  const dataURL = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataURL.split(',')[1], 'base64'));
};
const snapshot = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
const delta = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const range = values => Math.max(...values) - Math.min(...values);
const maxConsecutiveDelta = (samples, selector) => samples.slice(1).reduce((peak, sample, index) => Math.max(peak, delta(selector(samples[index]), selector(sample))), 0);

const report = { runtimeErrors };
try {
  await page.goto(`${baseURL}/?scene=game&hero=cassia&time=92`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().fireState?.kineticPose);
  await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { right: true }));
  const locomotion = [];
  for (let index = 0; index < 12; index += 1) {
    if (index) await page.waitForTimeout(100);
    const state = await snapshot();
    const pose = state.fireState.kineticPose;
    locomotion.push({
      index,
      signature: pose.signature,
      cycleIndex: pose.cycleIndex,
      suspensionY: pose.suspensionY,
      chassisPitch: pose.chassisPitch,
      secondaryA: pose.secondaryA,
      secondaryB: pose.secondaryB,
      muzzle: { x: state.fireState.muzzleX - state.fireState.anchorBaseX, y: state.fireState.muzzleY - state.fireState.anchorBaseY },
      exhaust: { x: state.fireState.exhaustX - state.fireState.anchorBaseX, y: state.fireState.exhaustY - state.fireState.anchorBaseY },
    });
    await canvasShot(`ride-${String(index).padStart(2, '0')}`);
  }
  await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { right: false }));

  const poseKeys = new Set(locomotion.map(sample => [sample.suspensionY, sample.chassisPitch, sample.secondaryA, sample.secondaryB].join(':')));
  const suspensionRangePx = range(locomotion.map(sample => sample.suspensionY));
  const secondaryRangePx = Math.max(range(locomotion.map(sample => sample.secondaryA)), range(locomotion.map(sample => sample.secondaryB)));
  const pitchTravelPx = range(locomotion.map(sample => Math.sin(sample.chassisPitch) * 92));
  const maxMuzzleStepPx = maxConsecutiveDelta(locomotion, sample => sample.muzzle);
  const maxExhaustStepPx = maxConsecutiveDelta(locomotion, sample => sample.exhaust);
  report.locomotion = {
    samples: locomotion,
    uniquePoseCount: poseKeys.size,
    suspensionRangePx,
    secondaryRangePx,
    pitchTravelPx: Number(pitchTravelPx.toFixed(2)),
    maxMuzzleStepPx: Number(maxMuzzleStepPx.toFixed(2)),
    maxExhaustStepPx: Number(maxExhaustStepPx.toFixed(2)),
  };
  if (poseKeys.size < 4) throw new Error(`Stage 1 ride exposed fewer than four poses: ${poseKeys.size}`);
  if (suspensionRangePx < 6 || secondaryRangePx < 12) throw new Error(`Stage 1 ride articulation is too small: suspension=${suspensionRangePx}, secondary=${secondaryRangePx}`);
  if (maxMuzzleStepPx > 12 || maxExhaustStepPx > 12) throw new Error(`Stage 1 hardpoint discontinuity: muzzle=${maxMuzzleStepPx}, exhaust=${maxExhaustStepPx}`);

  await page.goto(`${baseURL}/?scene=boss&hero=bruna`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().boss?.kind === 'boss');
  await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { fire: true }));
  const bossStrip = [];
  for (let index = 0; index < 12; index += 1) {
    if (index) await page.waitForTimeout(100);
    const state = await snapshot();
    bossStrip.push({
      index,
      health: state.boss.health,
      phase: state.boss.attack?.phase,
      signature: state.boss.attack?.signature,
      pose: state.boss.attack?.pose,
      hitStop: state.cameraFeedback.hitStop,
      bursts: state.stageOneTemporal.impactBursts,
    });
    await canvasShot(`boss-${String(index).padStart(2, '0')}`);
  }

  let beforeHit = await snapshot();
  const deadline = Date.now() + 3500;
  while (Date.now() < deadline) {
    await page.waitForTimeout(16);
    const current = await snapshot();
    if (current.boss.health < beforeHit.boss.health) {
      await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { fire: false }));
      await canvasShot('boss-confirmed-impact');
      const impact = current;
      const reactionSamples = [];
      let reaction = current;
      let reactionCaptured = false;
      for (let sample = 0; sample < 16; sample += 1) {
        await page.waitForTimeout(25);
        const candidate = await snapshot();
        reactionSamples.push({ phase: candidate.boss.attack?.phase, pose: candidate.boss.attack?.pose, hitStop: candidate.cameraFeedback.hitStop });
        if (Math.abs(candidate.boss.attack?.pose?.x ?? 0) > Math.abs(reaction.boss.attack?.pose?.x ?? 0)) {
          reaction = candidate;
          await canvasShot('boss-confirmed-reaction');
          reactionCaptured = true;
        }
      }
      if (!reactionCaptured) await canvasShot('boss-confirmed-reaction');
      const maxBurstDiameter = Math.max(0, ...impact.stageOneTemporal.impactBursts.map(burst => burst.diameter));
      const reactionRecoilPx = reaction.boss.attack?.pose?.x ?? 0;
      const burstSafe = impact.stageOneTemporal.impactBursts.every(burst => {
        const radius = burst.diameter / 2;
        return burst.x - radius >= 0 && burst.x + radius <= 960 && burst.y - radius >= 58 && burst.y + radius <= 486;
      });
      report.confirmedBossHit = {
        healthBefore: beforeHit.boss.health,
        healthAfter: impact.boss.health,
        impactPhase: impact.boss.attack?.phase,
        impactPose: impact.boss.attack?.pose,
        hitStopMs: Number((impact.cameraFeedback.hitStop * 1000).toFixed(1)),
        maxBurstDiameter,
        burstSafe,
        reactionPhase: reaction.boss.attack?.phase,
        reactionPose: reaction.boss.attack?.pose,
        reactionRecoilPx,
        reactionSamples,
      };
      if (maxBurstDiameter < 32) throw new Error(`Boss impact burst is smaller than 32 px: ${maxBurstDiameter}`);
      if (Math.abs(reactionRecoilPx) < 12) throw new Error(`Boss reaction recoil is smaller than 12 px: ${reactionRecoilPx}`);
      if (!burstSafe) throw new Error(`Boss burst clipped or entered HUD: ${JSON.stringify(impact.stageOneTemporal.impactBursts)}`);
      break;
    }
    beforeHit = current;
  }
  await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { fire: false }));
  if (!report.confirmedBossHit) throw new Error('No confirmed production boss hit observed');

  const bossPoseKeys = new Set(bossStrip.map(sample => [sample.signature, sample.pose?.x, sample.pose?.y, sample.pose?.scaleX, sample.pose?.scaleY].join(':')));
  report.bossStrip = { samples: bossStrip, uniquePoseCount: bossPoseKeys.size };
  if (bossPoseKeys.size < 4) throw new Error(`Stage 1 boss strip exposed fewer than four silhouettes: ${bossPoseKeys.size}`);
  if (runtimeErrors.length) throw new Error(`Runtime errors: ${JSON.stringify(runtimeErrors)}`);
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser.close();
}
