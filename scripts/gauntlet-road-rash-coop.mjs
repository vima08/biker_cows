import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const output = path.resolve('.gauntlet/road-rash-coop');
await mkdir(output, { recursive: true });
const define = { 'import.meta.env.BASE_URL': JSON.stringify('/biker_cows/') };
const stagePath = path.join(output, 'stage.mjs');
await build({ entryPoints: ['src/roadRash/RoadRashStage.ts'], bundle: true, platform: 'node', format: 'esm', define, outfile: stagePath });
const { RoadRashStage } = await import(pathToFileURL(stagePath).href);
const makeStage = extra => new RoadRashStage({ debugSkipIntro: true, playerHero: 'cassia', secondPlayerHero: 'bruna', ...extra });
const tick = (stage, p1 = {}, p2 = {}, frames = 30) => {
  for (let i = 0; i < frames; i++) stage.update(1 / 60, p1, p2);
};
const stage = makeStage();
tick(stage, { left: true, accelerate: true }, { right: true, brake: true });
let players = stage.snapshot().players;
assert(players[0].lane < -.6 && players[1].lane > .6, 'Both players steer independently');
assert(players[0].speed > players[1].speed, 'P2 has an independent throttle/brake');
assert.equal(new RoadRashStage({ debugSkipIntro: true }).snapshot().players.length, 1);

const fight = makeStage({ debugCombat: true });
fight.entities[0].distance = fight.distance + 28;
fight.entities[0].lane = .65;
tick(fight, {}, { attack: true }, 55);
assert(fight.snapshot().hits > 0, 'P2 can damage a rival');
assert.equal(fight.snapshot().players[0].health, 100, 'P2 attacks do not hurt P1');
const bossFight = makeStage({ debugBoss: true });
bossFight.entities[0].distance = bossFight.distance + 28;
tick(bossFight, {}, { attack: true }, 75);
assert(bossFight.snapshot().boss.hp < bossFight.snapshot().boss.maxHp, 'P2 can damage Road King');

const survivor = makeStage();
survivor.riders[0].hp = 0;
tick(survivor, {}, { left: true, accelerate: true });
assert.equal(survivor.defeated, false, 'The surviving rider can continue');
assert(survivor.snapshot().players[1].lane < .1);
survivor.riders[1].hp = 0;
tick(survivor, {}, {}, 1);
assert.equal(survivor.defeated, true, 'Defeat requires both riders to be down');
stage.debugDefeat();
assert(stage.snapshot().players.every(player => !player.alive));
fight.debugCompleteVictory();
assert(fight.snapshot().players.every(player => player.attackTimer === 0), 'Victory clears both attack states');

const spriteProbe = await build({ entryPoints: ['src/spriteAtlas.ts'], bundle: true, format: 'iife', globalName: 'SpriteProbe', define, write: false });
const port = 4174;
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { windowsHide: true, stdio: 'ignore' });
let browser;
try {
  const url = `http://127.0.0.1:${port}/biker_cows/`;
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { ready = (await fetch(url)).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert(ready, 'Preview started');
  browser = await chromium.launch({ executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${url}?scene=road-rash-coop-boss&hero=cassia`, { waitUntil: 'networkidle' });
  const road = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot().roadRash);
  assert.equal((await road()).players.length, 2);
  const before = await road();
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Numpad1');
  await page.waitForTimeout(160);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('Numpad1');
  const after = await road();
  assert(after.players[1].lane > before.players[1].lane + .04, 'P2 keyboard controls reach the stage');
  assert(after.players[1].attackTimer > 0, 'P2 keyboard starts an attack');
  assert(Math.abs(after.players[0].lane - before.players[0].lane) < .02, 'P2 steering does not steer P1');
  await page.locator('canvas').screenshot({ path: path.join(output, 'coop-road.png') });
  await page.evaluate(() => window.__BCFV_DEBUG__.completeAct());
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'win');

  await page.goto(`${url}?scene=game&hero=bruna`, { waitUntil: 'networkidle' });
  const spread = await page.evaluate(() => {
    const game = window.venusGame;
    game.shots = [];
    game.player.weapon = 'spread'; game.player.weaponRank = 3;
    game.firePlayer(game.player);
    return game.shots.map(shot => ({ x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy }));
  });
  assert.equal(spread.length, 5);
  assert(spread[0].vy < -150 && spread[4].vy > 150, 'Blue pellets have a wide fan');
  assert.equal(spread[2].vy, 0);
  assert(spread.every(shot => shot.x === spread[0].x && shot.y === spread[0].y), 'Every pellet starts at the barrel');
  await page.addScriptTag({ content: spriteProbe.outputFiles[0].text });
  const alpha = await page.evaluate(async () => {
    await SpriteProbe.preloadSpriteSheets();
    const sample = (id, frame, width, height, x, y) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      SpriteProbe.drawSpriteFrame(ctx, id, frame, 0, 0, { width, height, anchorX: 0, anchorY: 0 });
      return ctx.getImageData(x, y, 1, 1).data[3];
    };
    return [sample('bruna', 2, 256, 192, 122, 98), sample('bruna', 5, 256, 192, 142, 86), sample('sustainedFire', 5, 256, 192, 144, 90), sample('bruna', 0, 256, 192, 71, 52)];
  });
  assert.deepEqual(alpha, [0, 0, 0, 255], 'Enclosed matte is transparent and the armor highlight survives');
  await page.goto(`${url}?scene=coop`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__BCFV_DEBUG__.completeAct());
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'road-rash');
  assert.equal((await road()).players.length, 2, 'The campaign enters Road Rash with both players');
  await page.evaluate(() => window.__BCFV_DEBUG__.completeAct());
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'brawler');
  const campaign = await page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
  assert.equal(campaign.campaign.activePlayers, 2, 'Coop remains active after Road Rash');
  assert.equal(campaign.brawler.players.length, 2, 'Both riders enter the brawler section');
  assert.deepEqual(errors, []);
  console.log('[road-rash-coop / spread / Bruna alpha] PASS');
} finally {
  await browser?.close();
  preview.kill();
}
