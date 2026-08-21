import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(process.env.BCFV_CAPTURE_DIR ?? '.gauntlet/iteration-23/before');
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

const snapshot = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
const canvasShot = async name => {
  const dataURL = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width !== 960 || canvas.height !== 540) throw new Error('Expected 960x540 production canvas');
    return canvas.toDataURL('image/png');
  });
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataURL.split(',')[1], 'base64'));
};
const waitStage = async () => {
  await page.waitForFunction(() => {
    const brawler = window.__BCFV_DEBUG__?.snapshot().brawler;
    return brawler?.status === 'running' && Object.values(brawler.assets).every(value => value === 'ready');
  }, undefined, { polling: 'raf' });
};
const captureHeld = async (prefix, key, count, intervalMs) => {
  const samples = [];
  await page.keyboard.down(key);
  for (let index = 0; index < count; index++) {
    await page.waitForTimeout(intervalMs);
    await canvasShot(`${prefix}-${String(index).padStart(2, '0')}`);
    samples.push((await snapshot()).brawler.players[0]);
  }
  await page.keyboard.up(key);
  return samples;
};

const checkpoints = {};
try {
  for (const hero of ['cassia', 'bruna', 'nova']) {
    await page.goto(`${baseURL}/?scene=brawler&hero=${hero}`, { waitUntil: 'networkidle' });
    await waitStage();
    const walkRight = await captureHeld(`${hero}-walk-right`, 'KeyD', 10, 230);
    if (![1, 2].every(frame => walkRight.some(sample => sample.frame === frame && sample.facing === 1))) throw new Error(`${hero} right walk did not show both authored steps`);

    await page.goto(`${baseURL}/?scene=brawler&hero=${hero}`, { waitUntil: 'networkidle' });
    await waitStage();
    await page.keyboard.down('KeyD'); await page.waitForTimeout(900); await page.keyboard.up('KeyD');
    const walkLeft = await captureHeld(`${hero}-walk-left`, 'KeyA', 10, 230);
    if (![9, 10].every(frame => walkLeft.some(sample => sample.frame === frame && sample.facing === -1))) throw new Error(`${hero} left walk did not show both authored steps`);

    await page.goto(`${baseURL}/?scene=brawler&hero=${hero}`, { waitUntil: 'networkidle' });
    await waitStage();
    const attackFrames = [];
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press('KeyZ');
      await page.waitForTimeout(90);
      await canvasShot(`${hero}-attack-cycle-${String(index).padStart(2, '0')}`);
      attackFrames.push((await snapshot()).brawler.players[0].frame);
      await page.waitForTimeout(185);
    }
    if (![3, 4, 5].every(frame => attackFrames.includes(frame))) throw new Error(`${hero} ground combo missed authored frames: ${attackFrames}`);

    await page.waitForTimeout(450);
    await page.keyboard.press('KeyX');
    await page.waitForTimeout(80);
    await page.keyboard.press('KeyZ');
    const airFrames = [];
    for (let index = 0; index < 5; index++) {
      await page.waitForTimeout(50);
      await canvasShot(`${hero}-air-combat-${String(index).padStart(2, '0')}`);
      airFrames.push((await snapshot()).brawler.players[0]);
    }
    if (!airFrames.some(sample => sample.airborneAttack && sample.frame === 7)) throw new Error(`${hero} never rendered the right-facing airborne attack frame`);

    await page.waitForTimeout(520);
    await page.keyboard.down('KeyA'); await page.waitForTimeout(100); await page.keyboard.up('KeyA');
    const attackLeftFrames = [];
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press('KeyZ');
      await page.waitForTimeout(90);
      await canvasShot(`${hero}-attack-left-${String(index).padStart(2, '0')}`);
      attackLeftFrames.push((await snapshot()).brawler.players[0].frame);
      await page.waitForTimeout(185);
    }
    if (![11, 12, 13].every(frame => attackLeftFrames.includes(frame))) throw new Error(`${hero} left combo missed authored frames: ${attackLeftFrames}`);

    await page.waitForTimeout(450);
    await page.keyboard.press('KeyX');
    await page.waitForTimeout(80);
    await page.keyboard.press('KeyZ');
    const airLeftFrames = [];
    for (let index = 0; index < 5; index++) {
      await page.waitForTimeout(50);
      await canvasShot(`${hero}-air-left-${String(index).padStart(2, '0')}`);
      airLeftFrames.push((await snapshot()).brawler.players[0]);
    }
    if (!airLeftFrames.some(sample => sample.airborneAttack && sample.frame === 15)) throw new Error(`${hero} never rendered the left-facing airborne attack frame`);

    await page.goto(`${baseURL}/?scene=brawler-boss&hero=${hero}`, { waitUntil: 'networkidle' });
    await waitStage();
    await page.keyboard.down('KeyD'); await page.waitForTimeout(2050); await page.keyboard.up('KeyD');
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press('KeyZ');
      await page.waitForTimeout(135);
      await canvasShot(`${hero}-ground-combat-${String(index).padStart(2, '0')}`);
      await page.waitForTimeout(105);
    }

    checkpoints[hero] = { walkRight, walkLeft, attackFrames, airFrames, attackLeftFrames, airLeftFrames, combat: (await snapshot()).brawler };
  }

  await page.goto(`${baseURL}/?scene=brawler&hero=cassia`, { waitUntil: 'networkidle' });
  await waitStage();
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1900); await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler?.arenaLocked === true, undefined, { polling: 'raf' });
  for (let index = 0; index < 14; index++) {
    await page.waitForTimeout(220);
    await canvasShot(`enemy-walk-${String(index).padStart(2, '0')}`);
  }
  checkpoints.enemyWalk = (await snapshot()).brawler;

  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: true, runtimeErrors, checkpoints }, null, 2));
} catch (error) {
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: false, runtimeErrors, checkpoints, error: error instanceof Error ? error.stack : String(error) }, null, 2));
  throw error;
} finally {
  await browser.close();
}
