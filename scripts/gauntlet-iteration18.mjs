import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(process.env.BCFV_CAPTURE_DIR ?? '.gauntlet/iteration-18');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-gpu-compositing', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(12_000);
const runtimeErrors = [];
page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
page.on('requestfailed', request => runtimeErrors.push(`request: ${request.url()} (${request.failure()?.errorText})`));

const canvasShot = async name => {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width !== 960 || canvas.height !== 540) throw new Error('Expected 960x540 game canvas');
    return canvas.toDataURL('image/png');
  });
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
};
const state = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
const setInput = (stateValue) => page.evaluate(value => window.__BCFV_DEBUG__.setPlayerInput(1, value), stateValue);

const loadHero = async hero => {
  await page.goto(`${baseURL}/?scene=sustain&hero=${hero}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__BCFV_DEBUG__));
  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    return Object.keys(snapshot.atlas ?? {}).length === 13 && Object.values(snapshot.atlas).every(sheet => sheet.state === 'ready');
  });
  await page.evaluate(() => window.__BCFV_DEBUG__.setDebugFireHeld(false));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().fireState?.bodyMode === 'ride', undefined, { polling: 'raf' });
};

const checkpoints = { heroes: {}, lowerSequence: [], nova: {}, bruna: {} };
try {
  for (const hero of ['cassia', 'bruna', 'nova']) {
    await loadHero(hero);
    await setInput({ up: true, down: false, right: false, left: false });
    await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().players[0].groundY <= 300.01, undefined, { polling: 'raf' });
    await setInput({ up: false });
    await page.waitForTimeout(80);
    const upper = await state();
    await canvasShot(`${hero}-upper-lane`);

    await setInput({ down: true });
    await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().players[0].groundY >= 453.99, undefined, { polling: 'raf' });
    await setInput({ down: false });
    await page.waitForTimeout(80);
    const lower = await state();
    await canvasShot(`${hero}-lower-lane`);

    const bounds = lower.rideBounds;
    if (!bounds || bounds.minY !== 300 || bounds.maxY !== 454 || upper.players[0].groundY !== 300 || lower.players[0].groundY !== 454) {
      throw new Error(`${hero} did not traverse the authored 300..454 road range`);
    }
    if (bounds.maxY - bounds.minY < 150 || bounds.minY > bounds.roadTop + 10) throw new Error(`Road range remains vertically cramped: ${JSON.stringify(bounds)}`);
    checkpoints.heroes[hero] = { upperY: upper.players[0].groundY, lowerY: lower.players[0].groundY, bounds };
  }

  await loadHero('cassia');
  await setInput({ down: true });
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().players[0].groundY >= 453.99, undefined, { polling: 'raf' });
  await setInput({ down: false, right: true });
  for (let index = 0; index < 4; index++) {
    await page.waitForTimeout(260);
    await canvasShot(`lower-foreground-${index}`);
    checkpoints.lowerSequence.push({ index, player: (await state()).players[0] });
  }
  await setInput({ right: false });

  await loadHero('nova');
  await setInput({ jump: true });
  await page.waitForFunction(() => {
    const fire = window.__BCFV_DEBUG__.snapshot().fireState;
    return fire?.jumpPose === true && fire.visibleBarrelHardpoint?.sheet === 'authored' && fire.visibleBarrelHardpoint.frame === 4;
  }, undefined, { polling: 'raf' });
  await setInput({ jump: false });
  checkpoints.nova.frame = (await state()).fireState.visibleBarrelHardpoint.frame;
  await canvasShot('nova-forward-head-frame');

  await loadHero('bruna');
  await canvasShot('bruna-organic-arm-base');
  await page.evaluate(() => window.__BCFV_DEBUG__.setDebugFireHeld(true));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().fireState?.bodyMode === 'sustained', undefined, { polling: 'raf' });
  for (let index = 0; index < 4; index++) {
    await page.waitForTimeout(115);
    await canvasShot(`bruna-organic-arm-sustain-${index}`);
  }
  const sustained = await state();
  await page.evaluate(() => window.__BCFV_DEBUG__.setDebugFireHeld(false));
  for (let index = 0; index < 3; index++) {
    await page.waitForTimeout(38);
    await canvasShot(`bruna-organic-arm-release-${index}`);
  }
  checkpoints.bruna = {
    sustainedSheet: sustained.fireState.visibleBarrelHardpoint.sheet,
    muzzleDelta: sustained.fireState.projectileOriginDeltaPx,
    exhaustDelta: sustained.fireState.exhaustOriginDeltaPx,
  };
  if (checkpoints.bruna.sustainedSheet !== 'sustained' || checkpoints.bruna.muzzleDelta > 6 || checkpoints.bruna.exhaustDelta > 8) {
    throw new Error(`Bruna hardpoint regression after arm correction: ${JSON.stringify(checkpoints.bruna)}`);
  }

  checkpoints.shoulderAsset = await page.evaluate(() => performance.getEntriesByName(`${location.origin}/assets/world/venus-shoulder-strip.png`).length > 0);
  if (!checkpoints.shoulderAsset) throw new Error('Authored Venus shoulder strip was not requested by the production renderer');
  if (runtimeErrors.length) throw new Error(`Runtime errors: ${runtimeErrors.join(' | ')}`);

  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: true, checkpoints, runtimeErrors }, null, 2));
  console.log('[iteration-18] PASS');
} catch (error) {
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: false, checkpoints, runtimeErrors, error: String(error?.stack ?? error) }, null, 2));
  throw error;
} finally {
  await browser.close();
}
