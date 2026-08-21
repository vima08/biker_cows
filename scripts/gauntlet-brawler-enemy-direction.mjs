import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(process.env.BCFV_CAPTURE_DIR ?? '.gauntlet/iteration-23/enemy-direction');
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
const waitStage = () => page.waitForFunction(() => {
  const brawler = window.__BCFV_DEBUG__?.snapshot().brawler;
  return brawler?.status === 'running' && Object.values(brawler.assets).every(value => value === 'ready');
}, undefined, { polling: 'raf' });

const movement = new Set();
const setMovement = async wanted => {
  for (const key of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) {
    if (wanted.has(key) && !movement.has(key)) { await page.keyboard.down(key); movement.add(key); }
    if (!wanted.has(key) && movement.has(key)) { await page.keyboard.up(key); movement.delete(key); }
  }
};
const releaseMovement = () => setMovement(new Set());

const clearFirstWave = async () => {
  const started = Date.now();
  while (Date.now() - started < 25_000) {
    const state = (await snapshot()).brawler;
    if (state.wave > 0 || !state.arenaLocked) { await releaseMovement(); return; }
    const player = state.players[0];
    const targets = state.enemies.filter(enemy => enemy.hp > 0);
    if (!targets.length) { await page.waitForTimeout(60); continue; }
    const target = targets.reduce((best, enemy) => Math.hypot(enemy.x - player.x, enemy.y - player.y) < Math.hypot(best.x - player.x, best.y - player.y) ? enemy : best);
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const wanted = new Set();
    if (Math.abs(dx) > 48) wanted.add(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dy) > 18) wanted.add(dy > 0 ? 'KeyS' : 'KeyW');
    await setMovement(wanted);
    if (Math.abs(dx) < 62 && Math.abs(dy) < 30 && player.attackTimer <= .025) {
      await releaseMovement();
      if (player.special >= 35) await page.keyboard.press('KeyC');
      else await page.keyboard.press('KeyZ');
    }
    await page.waitForTimeout(55);
  }
  throw new Error('First wave did not clear');
};

const checkpoints = { firstApproach: [], mixedApproach: [], mixedReturn: [] };
try {
  await page.goto(`${baseURL}/?scene=brawler&hero=cassia`, { waitUntil: 'networkidle' });
  await waitStage();
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1850); await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler?.arenaLocked === true);

  for (let index = 0; index < 14; index++) {
    await page.waitForTimeout(180);
    await canvasShot(`enemy-left-first-${String(index).padStart(2, '0')}`);
    checkpoints.firstApproach.push((await snapshot()).brawler.enemies);
  }
  const firstMoving = checkpoints.firstApproach.flat().filter(enemy => enemy.moving);
  if (!firstMoving.length || firstMoving.some(enemy => enemy.facing !== -1 || ![5, 6].includes(enemy.frame))) {
    throw new Error(`First approach did not use left-facing walk row: ${JSON.stringify(firstMoving)}`);
  }

  await clearFirstWave();
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler?.wave === 1 && window.__BCFV_DEBUG__.snapshot().brawler?.arenaLocked === true);
  await page.keyboard.up('KeyD');

  for (let index = 0; index < 18; index++) {
    await page.waitForTimeout(180);
    await canvasShot(`enemy-left-mixed-${String(index).padStart(2, '0')}`);
    checkpoints.mixedApproach.push((await snapshot()).brawler.enemies);
  }
  const mixedMoving = checkpoints.mixedApproach.flat().filter(enemy => enemy.moving);
  const requiredKinds = ['raider', 'bruiser', 'shocker'];
  for (const kind of requiredKinds) {
    const samples = mixedMoving.filter(enemy => enemy.kind === kind && enemy.facing === -1);
    const base = kind === 'bruiser' ? 8 : kind === 'shocker' ? 16 : 0;
    if (!samples.length || samples.some(enemy => ![base + 5, base + 6].includes(enemy.frame))) {
      throw new Error(`${kind} did not use its authored screen-left walk row: ${JSON.stringify(samples)}`);
    }
  }

  // Cross the pack and keep recording: the same enemies must turn and use
  // the exact mirrored screen-right walk row, not moonwalk with their backs.
  await page.keyboard.press('KeyX');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(2300); await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler?.enemies.some(enemy => enemy.moving && enemy.facing === 1), undefined, { polling: 'raf' });
  for (let index = 0; index < 14; index++) {
    await page.waitForTimeout(180);
    await canvasShot(`enemy-right-mixed-${String(index).padStart(2, '0')}`);
    checkpoints.mixedReturn.push((await snapshot()).brawler.enemies);
  }
  const returning = checkpoints.mixedReturn.flat().filter(enemy => enemy.moving && enemy.facing === 1);
  const returningKinds = new Set();
  for (const kind of requiredKinds) {
    const samples = returning.filter(enemy => enemy.kind === kind);
    const base = kind === 'bruiser' ? 8 : kind === 'shocker' ? 16 : 0;
    if (!samples.length) continue;
    returningKinds.add(kind);
    if (samples.some(enemy => ![base + 1, base + 2, base + 3].includes(enemy.frame))) {
      throw new Error(`${kind} did not use its mirrored screen-right walk row: ${JSON.stringify(samples)}`);
    }
  }
  if (returningKinds.size < 2) throw new Error(`Fewer than two enemy classes visibly turned right: ${[...returningKinds]}`);

  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: true, runtimeErrors, checkpoints }, null, 2));
} catch (error) {
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: false, runtimeErrors, checkpoints, error: error instanceof Error ? error.stack : String(error) }, null, 2));
  throw error;
} finally {
  await releaseMovement().catch(() => {});
  await browser.close();
}
