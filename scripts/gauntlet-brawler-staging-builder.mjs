import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4177';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('.gauntlet/builder-brawler-staging');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(30_000);
const runtimeErrors = [];
page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });

const state = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot().brawler);
const waitReady = () => page.waitForFunction(() => {
  const b = window.__BCFV_DEBUG__?.snapshot().brawler;
  return b?.status === 'running' && Object.values(b.assets).every(value => value === 'ready');
});
const shot = async name => {
  const dataURL = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataURL.split(',')[1], 'base64'));
};

const held = new Set();
const setMovement = async wanted => {
  for (const key of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) {
    if (wanted.has(key) && !held.has(key)) { await page.keyboard.down(key); held.add(key); }
    if (!wanted.has(key) && held.has(key)) { await page.keyboard.up(key); held.delete(key); }
  }
};
const release = () => setMovement(new Set());

async function triggerFirstWave() {
  await setMovement(new Set(['KeyD']));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler?.arenaLocked === true);
  await release();
}

async function driveTowardNearest(attack = true) {
  const b = await state();
  const player = b.players.find(candidate => !candidate.downed);
  const enemies = b.enemies.filter(enemy => enemy.hp > 0);
  if (!player || !enemies.length) { await release(); return b; }
  const target = enemies.reduce((best, enemy) => Math.hypot(enemy.x - player.x, (enemy.y - player.y) * 1.45) < Math.hypot(best.x - player.x, (best.y - player.y) * 1.45) ? enemy : best);
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const wanted = new Set();
  if (Math.abs(dx) > 53) wanted.add(dx > 0 ? 'KeyD' : 'KeyA');
  if (Math.abs(dy) > 17) wanted.add(dy > 0 ? 'KeyS' : 'KeyW');
  await setMovement(wanted);
  if (attack && Math.abs(dx) < 59 && Math.abs(dy) < 27 && player.attackTimer <= .02 && !player.reactionPhase && b.hitStop <= .001) {
    await release();
    if (player.special >= 35 && enemies.length >= 3) await page.keyboard.press('KeyC');
    else await page.keyboard.press('KeyZ');
  }
  return b;
}

async function captureCombat(prefix, frameCount, intervalMs) {
  const samples = [];
  for (let frame = 0; frame < frameCount; frame++) {
    const b = await driveTowardNearest(true);
    const framing = b.combatFraming;
    const player = b.players[0];
    const attacker = framing ? b.enemies.find(enemy => enemy.id === framing.attackerId) : null;
    if (framing) samples.push({
      ...framing,
      cameraX: b.cameraX,
      playerReaction: player?.reactionPhase ?? null,
      enemyReaction: attacker?.reactionPhase ?? null,
      enemyAttack: attacker?.attackPhase ?? null,
    });
    await shot(`${prefix}-${String(frame).padStart(2, '0')}`);
    await page.waitForTimeout(intervalMs);
  }
  await release();
  return samples;
}

function summarize(samples, label) {
  const contacts = samples.filter(sample => sample.enemyAttack === 'contact' || sample.playerReaction || sample.enemyReaction);
  if (contacts.length < 3) throw new Error(`${label} captured fewer than three contact/reaction samples`);
  const central = contacts.filter(sample => sample.contactCenterX >= 192 && sample.contactCenterX <= 768);
  const minEdgeMargin = Math.min(...contacts.map(sample => sample.edgeMargin));
  const maxOverlap = Math.max(...contacts.map(sample => sample.overlapPixels));
  const minSeparation = Math.min(...contacts.map(sample => sample.renderSeparation));
  const reactionSamples = contacts.filter(sample => sample.playerReaction || sample.enemyReaction);
  const maxReactionSeparation = reactionSamples.length ? Math.max(...reactionSamples.map(sample => sample.renderSeparation)) : 0;
  if (central.length / contacts.length < .9) throw new Error(`${label} contact centering below 90%: ${central.length}/${contacts.length}`);
  if (minEdgeMargin < 6) throw new Error(`${label} clipped actor edge margin: ${minEdgeMargin}`);
  if (maxOverlap > 50) throw new Error(`${label} excessive body overlap: ${maxOverlap}`);
  if (minSeparation < 34) throw new Error(`${label} contact separation too small: ${minSeparation}`);
  if (maxReactionSeparation < 48) throw new Error(`${label} reaction beat did not open enough space: ${maxReactionSeparation}`);
  return {
    samples: samples.length,
    contacts: contacts.length,
    centeredRatio: Number((central.length / contacts.length).toFixed(3)),
    centerRange: [Math.min(...contacts.map(sample => sample.contactCenterX)), Math.max(...contacts.map(sample => sample.contactCenterX))],
    minEdgeMargin,
    maxOverlap,
    minSeparation,
    maxReactionSeparation,
  };
}

const report = {};
try {
  await page.goto(`${baseURL}/?scene=brawler&hero=bruna`, { waitUntil: 'networkidle' });
  await waitReady();
  await triggerFirstWave();
  await page.waitForFunction(() => {
    const b = window.__BCFV_DEBUG__.snapshot().brawler;
    return b.enemies.some(enemy => enemy.x - b.cameraX < 820);
  });
  for (let index = 0; index < 100; index++) {
    const b = await driveTowardNearest(false);
    if (b.combatFraming?.renderSeparation < 100) break;
    await page.waitForTimeout(32);
  }
  await release();
  const stageSamples = await captureCombat('stage2-intense', 28, 92);
  report.stage2 = summarize(stageSamples, 'stage2');

  await page.goto(`${baseURL}/?scene=brawler-boss&hero=bruna`, { waitUntil: 'networkidle' });
  await waitReady();
  for (let index = 0; index < 150; index++) {
    const b = await driveTowardNearest(false);
    if (b.combatFraming?.renderSeparation < 125) break;
    await page.waitForTimeout(30);
  }
  await release();
  const bossSamples = await captureCombat('boss-staging', 36, 92);
  report.boss = summarize(bossSamples, 'boss');

  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  console.log(JSON.stringify({ ok: true, runtimeErrors, report }, null, 2));
} finally {
  await release().catch(() => {});
  await browser.close();
}
