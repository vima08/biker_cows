import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('.gauntlet/iteration-17/exhaust-review');
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const canvasShot = async name => {
  const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await writeFile(path.join(outputDir, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
};
const evidence = {};
try {
  for (const hero of ['cassia', 'bruna', 'nova']) {
    await page.goto(`http://127.0.0.1:4173/?scene=sustain&hero=${hero}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Object.values(window.__BCFV_DEBUG__.snapshot().atlas).every(sheet => sheet.state === 'ready'));
    await page.evaluate(() => window.__BCFV_DEBUG__.setDebugFireHeld(true));
    await page.waitForTimeout(640);
    const sustained = await page.evaluate(() => window.__BCFV_DEBUG__.snapshot().fireState);
    if (sustained.visibleExhaustHardpoint.sheet !== 'sustained') throw new Error(`${hero} sustained exhaust sheet mismatch`);
    await canvasShot(`${hero}-sustained`);

    const released = await page.evaluate(() => window.__BCFV_DEBUG__.setDebugFireHeld(false).fireState);
    if (released.visibleExhaustHardpoint.sheet !== 'release') throw new Error(`${hero} release exhaust sheet mismatch`);
    await canvasShot(`${hero}-release`);

    await page.evaluate(() => window.__BCFV_DEBUG__.gotoScene('game', 20));
    await page.waitForTimeout(520);
    const ride = await page.evaluate(() => window.__BCFV_DEBUG__.snapshot().fireState);
    if (ride.visibleExhaustHardpoint.sheet !== 'authored') throw new Error(`${hero} ride exhaust sheet mismatch`);
    await canvasShot(`${hero}-ride`);

    await page.evaluate(() => window.__BCFV_DEBUG__.setPlayerInput(1, { jump: true }));
    await page.waitForTimeout(110);
    const jump = await page.evaluate(() => window.__BCFV_DEBUG__.snapshot().fireState);
    if (!jump.jumpPose || jump.visibleExhaustHardpoint.sheet !== 'authored') throw new Error(`${hero} jump exhaust mismatch`);
    await canvasShot(`${hero}-jump`);
    evidence[hero] = { sustained: sustained.visibleExhaustHardpoint, release: released.visibleExhaustHardpoint, ride: ride.visibleExhaustHardpoint, jump: jump.visibleExhaustHardpoint };
  }
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: true, errors, evidence }, null, 2));
} finally {
  await browser.close();
}
if (errors.length) throw new Error(errors.join('\n'));
