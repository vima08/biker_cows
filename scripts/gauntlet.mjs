import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BMFM_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BMFM_BROWSER ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(process.env.BMFM_CAPTURE_DIR ?? '.gauntlet/latest');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(10_000);
page.setDefaultNavigationTimeout(15_000);
const runtimeErrors = [];
page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
});
page.on('requestfailed', request => {
  const url = request.url();
  if (!url.startsWith('data:')) runtimeErrors.push(`request: ${url} (${request.failure()?.errorText})`);
});

const shot = name => page.screenshot({ path: path.join(outputDir, `${name}.png`) });
const state = () => page.evaluate(() => window.__BMFM_DEBUG__.snapshot());
const assertState = async expected => {
  const current = await state();
  if (current.state !== expected) {
    throw new Error(`Expected state ${expected}, received ${current.state}: ${JSON.stringify(current)}`);
  }
  return current;
};

const checkpoints = {};
try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__BMFM_DEBUG__));
  checkpoints.menu = await assertState('title');
  await shot('menu');
  console.log('[gauntlet] menu');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  checkpoints.select = await assertState('select');
  await shot('select');
  console.log('[gauntlet] select');

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  checkpoints.start = await assertState('playing');

  await page.keyboard.down('KeyZ');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(900);
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(1300);
  await page.keyboard.up('ArrowRight');
  checkpoints.ride = await state();
  await shot('ride');
  await page.waitForTimeout(90);
  await shot('ride-sequence-a');
  await page.waitForTimeout(120);
  await shot('ride-sequence-b');
  await page.waitForTimeout(120);
  await shot('ride-sequence-c');
  console.log('[gauntlet] ride sequence');

  // One deterministic, real-update-loop combat sentence. The blaster projectile
  // travels through normal collision code and drives the raider's local hit timer.
  await page.keyboard.up('KeyZ');
  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('beat'));
  await page.waitForTimeout(120);
  checkpoints.beatStart = await assertState('playing');
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(24);
  await shot('combat-beat-0'); // muzzle / anticipation
  await page.keyboard.up('KeyZ');
  await page.waitForTimeout(200);
  await shot('combat-beat-1'); // clean projectile travel
  await page.waitForTimeout(440);
  await shot('combat-beat-2'); // contact / first crushed silhouette
  await page.waitForTimeout(180);
  await shot('combat-beat-3'); // recoil deformation after the contact flash
  await page.waitForTimeout(140);
  await shot('combat-beat-4'); // deformation held after flash
  await page.waitForTimeout(460);
  await shot('combat-beat-5'); // debris / recovery silhouette
  checkpoints.beatAftermath = await state();
  if (!checkpoints.beatAftermath.beat || checkpoints.beatAftermath.beat.riderReaction <= 0) {
    throw new Error(`Combat beat missed its real rider collision: ${JSON.stringify(checkpoints.beatAftermath)}`);
  }
  console.log('[gauntlet] combat beat: 24, 224, 664, 844, 984, 1444ms');

  await page.keyboard.down('KeyZ');
  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('miniboss'));
  await page.waitForTimeout(1800);
  checkpoints.combat = await assertState('playing');
  if (!checkpoints.combat.boss || checkpoints.combat.boss.kind !== 'miniboss') {
    throw new Error(`Miniboss did not spawn for combat capture: ${JSON.stringify(checkpoints.combat)}`);
  }
  await shot('combat');
  console.log('[gauntlet] combat');

  await page.keyboard.press('KeyP');
  await page.waitForTimeout(120);
  checkpoints.pause = await assertState('paused');
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(120);
  await assertState('playing');

  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('boss'));
  await page.waitForTimeout(1800);
  checkpoints.boss = await assertState('playing');
  if (!checkpoints.boss.boss || checkpoints.boss.boss.kind !== 'boss') {
    throw new Error(`Final boss did not spawn: ${JSON.stringify(checkpoints.boss)}`);
  }
  await shot('boss');
  console.log('[gauntlet] boss');

  for (let i = 0; i < 16; i += 1) {
    await page.keyboard.down(i % 2 === 0 ? 'ArrowUp' : 'ArrowDown');
    await page.waitForTimeout(350);
    await page.keyboard.up(i % 2 === 0 ? 'ArrowUp' : 'ArrowDown');
    if ((i + 1) % 4 === 0) console.log(`[gauntlet] boss exchange ${i + 1}/16`);
  }
  await page.keyboard.up('KeyZ');
  checkpoints.afterBossExchange = await state();
  await shot('boss-exchange');
  console.log('[gauntlet] boss exchange captured');

  // Exercise the real boss-death -> delayed victory -> restart path without
  // burning through a second full health bar in the software-rendered harness.
  await page.evaluate(() => {
    const game = window.redlineGame;
    const boss = game.enemies.find(enemy => enemy.kind === 'boss');
    if (!boss) throw new Error('Boss missing before victory transition check');
    boss.hp = 1;
  });
  await page.keyboard.down('KeyZ');
  await page.waitForFunction(() => window.__BMFM_DEBUG__.snapshot().state === 'win', undefined, { timeout: 45_000 });
  await page.keyboard.up('KeyZ');
  checkpoints.victory = await assertState('win');
  await shot('victory');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(180);
  checkpoints.restart = await assertState('playing');

  if (runtimeErrors.length) {
    throw new Error(`Browser runtime errors:\n${runtimeErrors.join('\n')}`);
  }
  const report = { ok: true, checkpoints, runtimeErrors };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await page.keyboard.up('KeyZ').catch(() => {});
  await browser.close();
}
