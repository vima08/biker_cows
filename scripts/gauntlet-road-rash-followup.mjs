import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.env.BCFV_URL ?? 'http://127.0.0.1:4186/biker_cows/';
const output = '.gauntlet/road-rash-followup';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BCFV_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__BCFV_DEBUG__));
  await page.evaluate(() => {
    window.renderFollowupGame = window.venusGame.draw.bind(window.venusGame);
    window.venusGame.draw = () => {};
  });
  const collisions = await page.evaluate(async base => {
    const { RoadRashStage } = await import(new URL('src/roadRash/RoadRashStage.ts', base).href);
    window.followupStage = new RoadRashStage({ debugSkipIntro: true });
    const makeEntity = (kind, overrides = {}) => ({ id: 1, kind, lane: .2, distance: 100, speed: 200,
      hp: kind === 'boss' ? 8 : 5, maxHp: kind === 'boss' ? 8 : 5, active: true,
      attackCooldown: 1, attackTimer: .25, hitFlash: 0, reactionTimer: 0, recoilSide: 0, wobble: 0, color: '#40d0cc', ...overrides });
    const fixture = (kind, enemyKind = 'rival', hp) => {
      const stage = new RoadRashStage({ debugSkipIntro: true, courseLength: 100000 });
      stage.rider.lane = -.85; stage.nextSpawnAt = Infinity;
      const enemy = makeEntity(enemyKind, hp === undefined ? {} : { hp });
      const obstacle = makeEntity(kind, { id: 2, speed: kind === 'oil' ? 0 : 90 });
      stage.entities = [enemy, obstacle];
      return { stage, enemy, obstacle };
    };
    const results = [];
    for (const kind of ['car', 'truck', 'oil']) {
      const { stage, enemy, obstacle } = fixture(kind);
      stage.update(1 / 60);
      const firstHp = enemy.hp;
      results.push({ kind, hp: enemy.hp, speed: enemy.speed, laneGap: Math.abs(enemy.lane - obstacle.lane),
        attackTimer: enemy.attackTimer, reactionTimer: enemy.reactionTimer, obstacleActive: obstacle.active, playerHealth: stage.rider.hp });
      // A second contact during cooldown must still separate the bike, without
      // applying damage on every rendered frame.
      enemy.distance = obstacle.distance; enemy.lane = obstacle.lane;
      stage.resolveEnemyObstacleContacts(new Map());
      results.at(-1).cooldownHpUnchanged = enemy.hp === firstHp;
      results.at(-1).cooldownSeparated = Math.abs(enemy.lane - obstacle.lane) >= .39;
      stage.distance = obstacle.distance; stage.rider.lane = obstacle.lane;
      stage.resolveContacts();
      results.at(-1).playerCanStillHitObstacle = stage.rider.hp < 100 && !obstacle.active;
    }
    const swept = fixture('car'); swept.enemy.distance = 170; swept.obstacle.distance = 110;
    swept.stage.resolveEnemyObstacleContacts(new Map([[1, { distance: 80, lane: .2 }], [2, { distance: 110, lane: .2 }]]));
    const miss = fixture('truck'); miss.enemy.lane = -.7; miss.obstacle.lane = .7;
    miss.stage.update(1 / 60);
    const death = fixture('truck', 'rival', 1); death.stage.update(1 / 60);
    const boss = fixture('truck', 'boss'); boss.stage.update(1 / 60);
    return { results, sweptBlocked: swept.enemy.hp === 4 && swept.enemy.distance < swept.obstacle.distance,
      missUnhurt: miss.enemy.hp === 5 && miss.enemy.obstacleCooldown === 0,
      environmentalDeath: !death.enemy.active && death.stage.score === 0 && death.stage.rivalsDefeated === 0,
      bossInterrupted: boss.enemy.hp === 8 && boss.enemy.attackTimer === 0 && boss.enemy.reactionTimer > 0 };
  }, base);
  for (const result of collisions.results) {
    assert.equal(result.hp, result.kind === 'truck' ? 3 : result.kind === 'car' ? 4 : 5);
    assert(result.speed < 150 && result.laneGap >= .39 && result.attackTimer === 0 && result.reactionTimer > 0);
    assert(result.obstacleActive && result.playerHealth === 100);
    assert(result.cooldownHpUnchanged && result.cooldownSeparated && result.playerCanStillHitObstacle);
  }
  assert(collisions.sweptBlocked && collisions.missUnhurt && collisions.environmentalDeath && collisions.bossInterrupted);

  const titles = await page.evaluate(() => {
    const game = window.venusGame, ctx = document.querySelector('canvas').getContext('2d');
    const saved = { mode: game.mode, completedStage: game.completedStage };
    const original = ctx.fillText, records = [];
    ctx.fillText = function(text, x, y, ...rest) {
      if (text === 'DISTRICT LIBERATED!') records.push({ x, y, width: this.measureText(text).width, font: this.font });
      return original.call(this, text, x, y, ...rest);
    };
    try {
      game.mode = 'win'; game.completedStage = 2; game.drawEnding();
      window.__BCFV_DEBUG__.gotoScene('brawler');
      game.brawler.status = 'victory'; game.brawler.drawResult();
    } finally { ctx.fillText = original; game.mode = saved.mode; game.completedStage = saved.completedStage; }
    return records;
  });
  assert.equal(titles.length, 3); // ending text has its own shadow pass
  assert(titles[0].width <= 440 && titles[1].width <= 440 && titles[2].width <= 472);
  await page.waitForFunction(() => Object.values(window.venusGame.brawler.snapshot().assets).every(state => state === 'ready'));
  await page.evaluate(() => { const g = window.venusGame; g.mode = 'win'; g.completedStage = 2; window.renderFollowupGame(); });
  await page.locator('canvas').screenshot({ path: `${output}/district-liberated.png` });

  await page.waitForFunction(() => window.followupStage.finishArch.complete && window.followupStage.finishArch.naturalWidth > 0 && window.followupStage.panorama.complete && window.followupStage.heroinesAtlasCanvas);
  const finish = await page.evaluate(() => {
    const stage = window.followupStage, ctx = document.querySelector('canvas').getContext('2d');
    const c = document.createElement('canvas'); c.width = stage.finishArch.naturalWidth; c.height = stage.finishArch.naturalHeight;
    c.getContext('2d').drawImage(stage.finishArch, 0, 0);
    const openingAlpha = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height * .65), 1, 1).data[3];
    stage.distance = stage.courseLength - 90; stage.visualDistance = stage.distance; stage.entities = [];
    stage.stateTimer = 8;
    const order = [], drawFinish = stage.drawFinish, drawPlayer = stage.drawPlayer;
    stage.drawFinish = function(...args) { order.push('finish'); return drawFinish.apply(this, args); };
    stage.drawPlayer = function(...args) { order.push('player'); return drawPlayer.apply(this, args); };
    stage.draw(ctx); const beforeVictory = [...order]; order.length = 0;
    stage.bossDefeated = true; stage.bossDefeatTimer = .5;
    stage.draw(ctx); const duringCrash = [...order]; order.length = 0;
    stage.bossDefeatTimer = 0; stage.draw(ctx);
    const beforeCrossing = [...order]; order.length = 0;
    stage.distance = stage.courseLength + 10; stage.draw(ctx);
    const afterCrossing = [...order];
    stage.distance = stage.courseLength - 90; stage.draw(ctx);
    return { openingAlpha, beforeVictory, duringCrash, beforeCrossing, afterCrossing, snapshot: stage.snapshot() };
  });
  assert.equal(finish.openingAlpha, 0, 'Finish art has a transparent passage');
  assert.deepEqual(finish.beforeVictory, ['player'], 'Finish stays hidden until Road King is defeated');
  assert.deepEqual(finish.duringCrash, ['player'], 'Finish waits for the visible boss crash');
  assert.deepEqual(finish.beforeCrossing, ['finish', 'player']);
  assert.deepEqual(finish.afterCrossing, ['player', 'finish']);
  assert(finish.snapshot.finishVisible);
  await page.locator('canvas').screenshot({ path: `${output}/finish-arch.png` });
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ ok: true, collisions, titles, finish, errors }, null, 2));
  console.log('[road-rash-followup] PASS: enemy hazards, title bounds, transparent finish art and depth order');
} finally { await browser.close(); }
