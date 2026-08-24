import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(process.env.BCFV_CAPTURE_DIR ?? '.gauntlet/iteration-25/builder-continue');
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

const state = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
const capture = async name => {
  // Capture a settled production frame, never the frame boundary on which a
  // debug action changed modes between requestAnimationFrame callbacks.
  await page.waitForTimeout(120);
  await page.locator('canvas').screenshot({ path: path.join(outputDir, `${name}.png`) });
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const report = { stage1: {}, stage2: {}, countdown: {}, runtimeErrors };

try {
  await page.goto(`${baseURL}/?scene=game&hero=cassia`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().state === 'playing');
  const initial = await state();
  assert(initial.continue.attempts.current === 1 && initial.continue.attempts.remaining === 3, 'Campaign must begin at attempt 1/3');
  assert(initial.continue.checkpoint.stage === 1, 'Initial checkpoint must be Stage 1');

  await page.evaluate(() => window.__BCFV_DEBUG__.damagePlayer(1, 9999));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'continue');
  const firstDefeat = await state();
  assert(firstDefeat.continue.attempts.current === 2, 'First defeat must offer attempt 2');
  assert(firstDefeat.continue.continues === 2 && firstDefeat.continue.countdown > 0, 'First defeat must expose two credits and an active countdown');
  assert(firstDefeat.cameraFeedback.shake === 0 && firstDefeat.cameraFeedback.flash === 0 && firstDefeat.cameraFeedback.hitStop === 0, 'Continue screen must clear transient camera feedback');
  await capture('stage1-continue-attempt-2');

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'playing');
  const stage1Restart = await state();
  assert(stage1Restart.stage === 1 && stage1Restart.hero === 'cassia', 'Stage 1 continue must preserve checkpoint and hero');
  assert(stage1Restart.continue.attempts.remaining === 2, 'Accepting continue must not consume another attempt');

  await page.evaluate(() => window.__BCFV_DEBUG__.damagePlayer(1, 9999));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'continue');
  const secondDefeat = await state();
  assert(secondDefeat.continue.attempts.current === 3 && secondDefeat.continue.continues === 1, 'Second defeat must offer final attempt');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'playing');
  await page.evaluate(() => window.__BCFV_DEBUG__.damagePlayer(1, 9999));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'lose');
  const exhausted = await state();
  assert(exhausted.continue.attempts.remaining === 0 && exhausted.continue.exhausted, 'Third defeat must produce final game over');
  await capture('stage1-final-game-over');
  report.stage1 = { initial: initial.continue, firstDefeat: firstDefeat.continue, restart: stage1Restart.continue, secondDefeat: secondDefeat.continue, exhausted: exhausted.continue };

  await page.goto(`${baseURL}/?scene=brawler&hero=bruna`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().state === 'brawler');
  await page.evaluate(() => window.__BCFV_DEBUG__.defeatStage(2));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'continue');
  const stage2Defeat = await state();
  assert(stage2Defeat.stage === 2 && stage2Defeat.continue.checkpoint.stage === 2, 'Stage 2 defeat must store the brawler checkpoint');
  assert(stage2Defeat.continue.checkpoint.levelId === 'furnace-district', 'Stage 2 checkpoint must identify Furnace District');
  await capture('stage2-continue');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'brawler');
  const stage2Restart = await state();
  assert(stage2Restart.stage === 2 && stage2Restart.brawler, 'Stage 2 continue must construct a fresh brawler stage');
  assert(stage2Restart.hero === 'bruna', 'Stage 2 continue must preserve the chosen hero');
  report.stage2 = { defeat: stage2Defeat.continue, restart: stage2Restart.continue };

  await page.evaluate(() => window.__BCFV_DEBUG__.defeatStage(2));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'continue');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'title');
  assert((await state()).state === 'title', 'Escape from continue must return to title');

  await page.evaluate(() => window.__BCFV_DEBUG__.defeatStage(1));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'continue');
  const countdownStart = (await state()).continue.countdown;
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'lose', null, { timeout: 12_000 });
  const timeoutState = await state();
  assert(timeoutState.continue.exhausted && timeoutState.continue.attempts.remaining === 2, 'Countdown expiry must end the campaign without consuming a phantom attempt');
  report.countdown = { start: countdownStart, final: timeoutState.continue };

  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: true, ...report }, null, 2));
  console.log(JSON.stringify({ ok: true, stage1: report.stage1, stage2: report.stage2, countdown: report.countdown, runtimeErrors }, null, 2));
} finally {
  await browser.close();
}
