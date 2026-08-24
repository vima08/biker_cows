import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('.gauntlet/builder-ride-lane');
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
const heroGeometry = {
  cassia: { height: 156, anchorY: .74, wheelSourceY: 144, wheelRadius: 29, width: 208 },
  bruna: { height: 164, anchorY: .75, wheelSourceY: 151, wheelRadius: 29, width: 220 },
  nova: { height: 152, anchorY: .73, wheelSourceY: 148, wheelRadius: 28, width: 202 },
};
const report = { runtimeErrors, heroes: {}, fire: {}, lowerTarget: null, enemyIntegrity: null };

try {
  for (const hero of Object.keys(heroGeometry)) {
    await page.goto(`${baseURL}/?scene=game&hero=${hero}&time=92`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().atlas?.[window.__BCFV_DEBUG__.snapshot().hero]?.state === 'ready');
    await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { up: true, down: false }));
    await page.waitForFunction(() => {
      const state = window.__BCFV_DEBUG__.snapshot();
      return state.players[0].groundY === state.rideBounds.minY;
    });
    await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { up: false }));
    const upper = await snapshot();
    await canvasShot(`${hero}-upper`);

    await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { down: true }));
    await page.waitForFunction(() => {
      const state = window.__BCFV_DEBUG__.snapshot();
      return state.players[0].groundY === state.rideBounds.maxY;
    });
    await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { down: false }));
    const lower = await snapshot();
    await canvasShot(`${hero}-lower`);

    const geometry = heroGeometry[hero];
    const scaleX = geometry.width / 256;
    const scaleY = geometry.height / 192;
    const wheelRadius = geometry.wheelRadius * (scaleX + scaleY) * .5;
    const wheelBottom = lower.players[0].groundY + 38
      - geometry.height * geometry.anchorY + geometry.wheelSourceY * scaleY + wheelRadius;
    report.heroes[hero] = {
      upperGroundY: upper.players[0].groundY,
      lowerGroundY: lower.players[0].groundY,
      roadTop: lower.rideBounds.roadTop,
      roadBottom: lower.rideBounds.roadBottom,
      availableTravelPx: lower.rideBounds.maxY - lower.rideBounds.minY,
      wheelBottomPx: Number(wheelBottom.toFixed(2)),
      wheelRoadClearancePx: Number((lower.rideBounds.roadBottom - wheelBottom).toFixed(2)),
    };
    if (upper.players[0].groundY !== lower.rideBounds.minY || lower.players[0].groundY !== lower.rideBounds.maxY) {
      throw new Error(`${hero} did not reach both production lane bounds`);
    }
    if (wheelBottom > lower.rideBounds.roadBottom) throw new Error(`${hero} wheel leaves road at y=${wheelBottom}`);

    await page.evaluate(() => window.venusGame.debugSustain(false));
    const before = await snapshot();
    let sampledOrdinary = 0;
    let maxAbsVy = 0;
    for (let index = 0; index < 260; index += 1) {
      await page.waitForTimeout(25);
      const state = await snapshot();
      const ordinary = state.friendlyProjectiles.filter(projectile => !projectile.homing);
      sampledOrdinary += ordinary.length;
      for (const projectile of ordinary) maxAbsVy = Math.max(maxAbsVy, Math.abs(projectile.vy));
      if (index === 105) await canvasShot(`${hero}-horizontal-fire`);
    }
    const after = await snapshot();
    const triggerPulls = after.players[0].shotsFired - before.players[0].shotsFired;
    const projectilesPerPull = hero === 'bruna' ? 3 : 1;
    const emittedOrdinary = triggerPulls * projectilesPerPull;
    report.fire[hero] = { triggerPulls, emittedOrdinary, sampledOrdinary, maxAbsVy };
    if (maxAbsVy !== 0) throw new Error(`${hero} ordinary projectile received vertical velocity ${maxAbsVy}`);
  }

  const emittedTotal = Object.values(report.fire).reduce((sum, value) => sum + value.emittedOrdinary, 0);
  if (emittedTotal < 100) throw new Error(`Only ${emittedTotal} ordinary projectiles were emitted`);

  await page.goto(`${baseURL}/?scene=game&hero=cassia&time=92`, { waitUntil: 'networkidle' });
  const targetBefore = await page.evaluate(() => window.venusGame.debugRideLaneTarget('cassia'));
  await canvasShot('lower-grounded-target-before');
  await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { fire: true }));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().enemies === 0, undefined, { timeout: 3000 });
  await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { fire: false }));
  const targetAfter = await snapshot();
  await canvasShot('lower-grounded-target-hit');
  report.lowerTarget = {
    groundY: targetBefore.players[0].groundY,
    muzzleY: targetBefore.fireState.muzzleY,
    beforeEnemies: targetBefore.enemies,
    afterEnemies: targetAfter.enemies,
    horizontalHit: targetBefore.players[0].groundY === targetBefore.rideBounds.maxY && targetAfter.enemies === 0,
  };

  await page.evaluate(() => window.venusGame.debugEnemyRoster());
  const beforeEnemyFire = await snapshot();
  await page.waitForFunction(previousArmor => {
    const state = window.__BCFV_DEBUG__.snapshot();
    return state.enemyProjectiles.length > 0 || state.players[0].armor < previousArmor;
  }, beforeEnemyFire.players[0].armor, { timeout: 5000 });
  await page.waitForFunction(previousArmor => {
    const state = window.__BCFV_DEBUG__.snapshot();
    return state.players[0].armor < previousArmor;
  }, beforeEnemyFire.players[0].armor, { timeout: 5000 });
  const afterEnemyFire = await snapshot();
  await canvasShot('enemy-fire-intact');
  report.enemyIntegrity = {
    observedProjectiles: afterEnemyFire.enemyProjectiles.length,
    projectileVectors: afterEnemyFire.enemyProjectiles.slice(0, 4),
    armorBefore: beforeEnemyFire.players[0].armor,
    armorAfter: afterEnemyFire.players[0].armor,
    enemyFireObserved: afterEnemyFire.enemyProjectiles.length > 0,
    enemyCollisionObserved: afterEnemyFire.players[0].armor < beforeEnemyFire.players[0].armor,
  };
  if (!report.enemyIntegrity.enemyFireObserved || !report.enemyIntegrity.enemyCollisionObserved) {
    throw new Error(`Enemy projectile/collision path did not remain active: ${JSON.stringify(report.enemyIntegrity)}`);
  }
  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, emittedTotal, ...report }, null, 2));
} catch (error) {
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ...report, failure: String(error) }, null, 2));
  throw error;
} finally {
  await browser.close();
}
