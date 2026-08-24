import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4174/biker_cows';
const outputDir = path.resolve('.gauntlet/iteration-27/enemy-facing');
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto(`${baseURL}/?scene=brawler&hero=cassia`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const brawler = window.__BCFV_DEBUG__?.snapshot().brawler;
    return brawler?.status === 'running' && Object.values(brawler.assets).every(value => value === 'ready');
  });
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler.arenaLocked === true);
  await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler.enemies.some(enemy => enemy.kind === 'raider' && enemy.moving));
  const walkingRaider = await page.evaluate(() => window.__BCFV_DEBUG__.snapshot().brawler.enemies.find(enemy => enemy.kind === 'raider' && enemy.moving));
  const expectedWalkBase = walkingRaider.facing > 0 ? 0 : 4;
  if (walkingRaider.frame < expectedWalkBase || walkingRaider.frame > expectedWalkBase + 2) {
    throw new Error(`Raider walk frame ${walkingRaider.frame} faces backwards; expected row ${expectedWalkBase}-${expectedWalkBase + 2}`);
  }
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler.enemies.some(enemy => enemy.kind === 'raider' && enemy.attackPhase === 'contact'));
  const snapshot = await page.evaluate(() => window.__BCFV_DEBUG__.snapshot().brawler);
  const player = snapshot.players[0];
  const raider = snapshot.enemies.find(enemy => enemy.kind === 'raider' && enemy.attackPhase === 'contact');
  const targetDirection = Math.sign(player.x - raider.x) || raider.facing;
  const expectedContactFrame = raider.facing > 0 ? 7 : 3;
  const dataURL = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await writeFile(path.join(outputDir, `raider-contact-facing-${raider.facing}.png`), Buffer.from(dataURL.split(',')[1], 'base64'));
  if (raider.facing !== targetDirection) throw new Error(`Logical facing ${raider.facing} points away from player ${targetDirection}`);
  if (raider.frame !== expectedContactFrame) throw new Error(`Raider atlas frame ${raider.frame} points away; expected ${expectedContactFrame}`);
  await page.waitForFunction(maxHp => window.__BCFV_DEBUG__.snapshot().brawler.players[0].hp < maxHp, player.maxHp);
  const damagedPlayer = await page.evaluate(() => window.__BCFV_DEBUG__.snapshot().brawler.players[0]);
  if (errors.length) throw new Error(errors.join('\n'));
  const report = { ok: true, playerX: player.x, walkingRaider, expectedWalkBase, raider, targetDirection, expectedContactFrame, damage: { before: player.maxHp, after: damagedPlayer.hp }, errors };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
