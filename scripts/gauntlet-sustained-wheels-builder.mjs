import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4184/biker_cows';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('.gauntlet/builder-sustained-wheels');
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
const span = values => Math.max(...values) - Math.min(...values);
const report = { runtimeErrors, durationSeconds: 3.2, heroes: {} };

try {
  for (const hero of ['cassia', 'bruna', 'nova']) {
    await page.goto(`${baseURL}/?scene=sustain&hero=${hero}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().fireState?.wheelMotion?.active);
    const samples = [];
    const capturedAngles = new Set();
    for (let index = 0; index < 33; index += 1) {
      if (index) await page.waitForTimeout(100);
      const state = await page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
      const fire = state.fireState;
      samples.push({
        elapsedMs: index * 100,
        bodyMode: fire.bodyMode,
        bodyFrame: fire.visibleBarrelHardpoint.frame,
        bodyX: fire.bodyBBox.x,
        bodyY: fire.bodyBBox.y,
        muzzleX: fire.muzzleX,
        muzzleY: fire.muzzleY,
        exhaustX: fire.exhaustX,
        exhaustY: fire.exhaustY,
        projectileOriginDeltaPx: fire.projectileOriginDeltaPx,
        chassisActive: fire.kineticPose.active,
        wheelActive: fire.wheelMotion.active,
        independentFromBody: fire.wheelMotion.independentFromBody,
        wheelAngleIndex: fire.wheelMotion.angleIndex,
      });
      if (!capturedAngles.has(fire.wheelMotion.angleIndex)) {
        capturedAngles.add(fire.wheelMotion.angleIndex);
        await canvasShot(`${hero}-wheel-${String(fire.wheelMotion.angleIndex).padStart(2, '0')}`);
      }
    }

    const wheelAngles = [...new Set(samples.map(sample => sample.wheelAngleIndex))].sort((a, b) => a - b);
    const bodyXSpan = span(samples.map(sample => sample.bodyX));
    const bodyYSpan = span(samples.map(sample => sample.bodyY));
    const muzzleTravelPx = Math.hypot(
      span(samples.map(sample => sample.muzzleX)),
      span(samples.map(sample => sample.muzzleY)),
    );
    const exhaustTravelPx = Math.hypot(
      span(samples.map(sample => sample.exhaustX)),
      span(samples.map(sample => sample.exhaustY)),
    );
    const maxProjectileOriginDeltaPx = Math.max(0, ...samples.map(sample => sample.projectileOriginDeltaPx ?? 0));
    report.heroes[hero] = {
      samples: samples.length,
      wheelAngles,
      uniqueWheelAngles: wheelAngles.length,
      bodyFrames: [...new Set(samples.map(sample => sample.bodyFrame))],
      bodyXSpan,
      bodyYSpan,
      muzzleTravelPx: Number(muzzleTravelPx.toFixed(3)),
      exhaustTravelPx: Number(exhaustTravelPx.toFixed(3)),
      maxProjectileOriginDeltaPx,
      chassisAlwaysNeutral: samples.every(sample => !sample.chassisActive),
      wheelAlwaysActive: samples.every(sample => sample.wheelActive),
      independentFromBody: samples.every(sample => sample.independentFromBody),
    };

    if (wheelAngles.length < 8) throw new Error(`${hero}: only ${wheelAngles.length} wheel angle states observed`);
    if (bodyXSpan !== 0 || bodyYSpan !== 0) throw new Error(`${hero}: sustained body anchor moved (${bodyXSpan}, ${bodyYSpan})`);
    if (muzzleTravelPx > 3 || exhaustTravelPx > 3) throw new Error(`${hero}: hardpoint travel exceeded 3px (${muzzleTravelPx}, ${exhaustTravelPx})`);
    if (maxProjectileOriginDeltaPx > .01) throw new Error(`${hero}: projectile missed visible barrel by ${maxProjectileOriginDeltaPx}px`);
    if (!report.heroes[hero].chassisAlwaysNeutral || !report.heroes[hero].wheelAlwaysActive || !report.heroes[hero].independentFromBody) {
      throw new Error(`${hero}: wheel/body independence contract failed`);
    }
  }
  if (runtimeErrors.length) throw new Error(`Runtime errors: ${JSON.stringify(runtimeErrors)}`);
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser.close();
}
