import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(process.env.BCFV_CAPTURE_DIR ?? '.gauntlet/iteration-19/canonical');
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
const canvasShot = async name => {
  const dataURL = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width !== 960 || canvas.height !== 540) throw new Error('Expected 960x540 production canvas');
    return canvas.toDataURL('image/png');
  });
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataURL.split(',')[1], 'base64'));
};
const waitAssets = async () => page.waitForFunction(() => {
  const assets = window.__BCFV_DEBUG__?.snapshot().brawler?.assets;
  return assets && Object.values(assets).length >= 7 && Object.values(assets).every(value => value === 'ready');
});

const movement = new Set();
const setMovement = async wanted => {
  for (const key of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) {
    if (wanted.has(key) && !movement.has(key)) { await page.keyboard.down(key); movement.add(key); }
    if (!wanted.has(key) && movement.has(key)) { await page.keyboard.up(key); movement.delete(key); }
  }
};
const releaseMovement = () => setMovement(new Set());

async function autoplay({ timeoutMs = 190_000, capturePrefix = 'full' } = {}) {
  const started = Date.now();
  let lastWave = -1;
  let lastJump = 0;
  let capturedCombat = false;
  let capturedBoss = false;
  while (Date.now() - started < timeoutMs) {
    const snapshot = await state();
    const brawler = snapshot.brawler;
    if (!brawler) throw new Error('Brawler snapshot disappeared during autoplay');
    if (brawler.status === 'victory' || brawler.status === 'defeat') {
      await releaseMovement();
      return snapshot;
    }
    if (brawler.status === 'intro') { await page.waitForTimeout(80); continue; }

    if (brawler.wave !== lastWave) {
      lastWave = brawler.wave;
      await canvasShot(`${capturePrefix}-wave-${String(lastWave).padStart(2, '0')}`);
    }
    const player = brawler.players.find(candidate => !candidate.downed);
    if (!player) { await page.waitForTimeout(80); continue; }
    const targets = brawler.enemies.filter(enemy => enemy.hp > 0);
    if (!targets.length) {
      await setMovement(new Set(['KeyD']));
      await page.waitForTimeout(70);
      continue;
    }

    const target = targets.reduce((best, enemy) => {
      const current = Math.hypot(enemy.x - player.x, (enemy.y - player.y) * 1.5);
      const prior = Math.hypot(best.x - player.x, (best.y - player.y) * 1.5);
      return current < prior ? enemy : best;
    });
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const wanted = new Set();
    if (Math.abs(dx) > 48) wanted.add(dx > 0 ? 'KeyD' : 'KeyA');
    else if (Math.abs(dx) > 12) wanted.add(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dy) > 18) wanted.add(dy > 0 ? 'KeyS' : 'KeyW');
    await setMovement(wanted);

    const inRange = Math.abs(dx) < 62 && Math.abs(dy) < 30;
    if (inRange && player.attackTimer <= .025) {
      await releaseMovement();
      if (player.special >= 35 && (target.kind === 'boss' || targets.length >= 3)) await page.keyboard.press('KeyC');
      else await page.keyboard.press('KeyZ');
      if (!capturedCombat && brawler.wave >= 1) { await page.waitForTimeout(80); await canvasShot(`${capturePrefix}-combat`); capturedCombat = true; }
    }
    if (target.kind === 'boss' && !capturedBoss && Math.abs(dx) < 210) { await canvasShot(`${capturePrefix}-boss-exchange`); capturedBoss = true; }
    const jumpInterval = target.kind === 'boss' ? 720 : 1150;
    if (Date.now() - lastJump > jumpInterval && Math.abs(dx) < 125) { await page.keyboard.press('KeyX'); lastJump = Date.now(); }
    await page.waitForTimeout(65);
  }
  throw new Error(`Autoplay exceeded ${timeoutMs}ms`);
}

const checkpoints = {};
try {
  await page.goto(`${baseURL}/?scene=brawler&hero=cassia`, { waitUntil: 'networkidle' });
  await waitAssets();
  await canvasShot('stage-2-intro');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler?.status === 'running');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1750); await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler?.arenaLocked === true);
  await canvasShot('cassia-first-wave');
  checkpoints.firstWave = (await state()).brawler;

  for (const hero of ['cassia', 'bruna', 'nova']) {
    await page.goto(`${baseURL}/?scene=brawler-boss&hero=${hero}`, { waitUntil: 'networkidle' });
    await waitAssets();
    await page.waitForFunction(() => {
      const b = window.__BCFV_DEBUG__.snapshot().brawler;
      return b?.boss && b.enemies.some(enemy => enemy.kind === 'boss' && enemy.x - b.cameraX < 820);
    });
    await canvasShot(`${hero}-boss-ready`);
    await page.keyboard.press('KeyZ'); await page.waitForTimeout(90); await canvasShot(`${hero}-attack`);
    await page.keyboard.press('KeyX'); await page.waitForTimeout(80); await canvasShot(`${hero}-jump`);
  }

  await page.goto(`${baseURL}/?scene=brawler-coop-boss`, { waitUntil: 'networkidle' });
  await waitAssets();
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler?.players.length === 2);
  await page.waitForTimeout(800);
  const coopBefore = (await state()).brawler.players.map(player => player.hp);
  await page.keyboard.press('Numpad1');
  await page.waitForTimeout(80);
  const p2Attack = (await state()).brawler.players.find(player => player.id === 2)?.attackTimer ?? 0;
  if (p2Attack <= 0) throw new Error('Stage 2 P2 attack input did not reach the production player state');
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(120);
  const coopAfter = (await state()).brawler.players.map(player => player.hp);
  if (coopBefore[1] !== coopAfter[1]) throw new Error(`Stage 2 friendly fire changed P2 HP: ${coopBefore[1]} -> ${coopAfter[1]}`);
  await canvasShot('coop-no-friendly-fire');
  checkpoints.coop = { before: coopBefore, after: coopAfter, p2Attack, players: (await state()).brawler.players };

  await page.goto(`${baseURL}/?scene=stage-transition&hero=bruna`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'road-rash', undefined, { timeout: 15_000 });
  await canvasShot('stage-1-to-road-rash-transition');
  checkpoints.transition = { state: (await state()).state, stage: (await state()).stage };

  await page.goto(`${baseURL}/?scene=brawler-boss&hero=bruna`, { waitUntil: 'networkidle' });
  await waitAssets();
  const final = await autoplay({ timeoutMs: 80_000, capturePrefix: 'boss-clear' });
  if (final.state !== 'win' && final.brawler?.status !== 'victory') throw new Error(`Boss route did not win: ${JSON.stringify(final.brawler)}`);
  await canvasShot('stage-2-victory');
  checkpoints.bossClear = final.brawler;

  await page.goto(`${baseURL}/?scene=brawler&hero=bruna`, { waitUntil: 'networkidle' });
  await waitAssets();
  const fullRoute = await autoplay({ timeoutMs: 330_000, capturePrefix: 'production' });
  if (fullRoute.state !== 'win' && fullRoute.brawler?.status !== 'victory') throw new Error(`Full Stage 2 route did not win: ${JSON.stringify(fullRoute.brawler)}`);
  await canvasShot('production-stage-2-victory');
  checkpoints.fullRoute = fullRoute.brawler;

  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  const report = { ok: true, runtimeErrors, checkpoints };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  const report = { ok: false, runtimeErrors, checkpoints, error: error instanceof Error ? error.stack : String(error) };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await releaseMovement().catch(() => {});
  await browser.close();
}
