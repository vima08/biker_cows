import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.env.BCFV_URL ?? 'http://127.0.0.1:4186/biker_cows/';
const output = '.gauntlet/road-rash-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BCFV_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(async base => {
    const { RoadRashStage } = await import(new URL('src/roadRash/RoadRashStage.ts', base).href);
    const runtime = await import(new URL('src/debug/runtime.ts', base).href);
    window.reviewRuntime = runtime;
    window.reviewStage = new RoadRashStage({ debugSkipIntro: true, playerHero: 'nova', secondPlayerHero: 'cassia' });
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
    document.body.replaceChildren(canvas); document.body.style.margin = '0';
    window.reviewCtx = canvas.getContext('2d');
  }, base);
  await page.waitForFunction(() => window.reviewStage.heroinesAtlasCanvas && window.reviewStage.ridersAtlasCanvas && window.reviewStage.panorama.complete);
  const report = await page.evaluate(() => {
    const s = window.reviewStage, ctx = window.reviewCtx;
    const checks = [];
    const check = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
    const far = s.project(620, 0);
    check(far.scale === 0 && far.y === 334 && far.x === 466, 'Calibrated vanishing point and zero distant scale');
    for (let distance = 0; distance <= 620; distance += 10) {
      const p = s.project(distance, 0);
      check(p.y - 134 * p.scale >= 334 - 1e-8, `Tallest road sprite grounded below horizon at dz=${distance}`);
    }
    const player = s.riders[0]; s.rider = player;
    player.lane = .72; player.lean = 0;
    const drawHero = s.drawHeroineAtlasFrame;
    const recorded = [];
    s.drawHeroineAtlasFrame = function(ctx, frame, x, y, w, h, flip) {
      recorded.push({ frame, flip, x: ctx.getTransform().e }); return true;
    };
    s.drawPlayer(ctx);
    check(Math.abs(recorded.at(-1).x - s.project(0, player.lane).x) <= .5, 'Player and same-lane traffic share their screen anchor');
    const directions = [];
    for (const hero of ['cassia', 'bruna', 'nova']) for (const side of [-1, 1]) {
      player.hero = hero; player.attackSide = side; player.playerRecoil = 0; player.attackConnected = false;
      for (const timer of [.66, .5, .3, .1]) {
        player.attackTimer = timer; s.drawPlayer(ctx);
        const pose = recorded.at(-1);
        const authoredSide = 1;
        check(authoredSide * (pose.flip ? -1 : 1) === side, `${hero} attack direction ${side}, timer ${timer}`);
        check(pose.frame !== 3, `${hero} miss has no contact flash`);
        directions.push({ hero, side, timer, ...pose });
      }
    }
    player.hero = 'nova'; player.attackTimer = 0; player.playerRecoil = .4; player.attackSide = -1;
    s.drawPlayer(ctx);
    check(recorded.at(-1).frame === 4 && recorded.at(-1).flip, 'Hurt pose and facing survive attack timer expiry');
    s.drawHeroineAtlasFrame = drawHero;
    player.playerRecoil = 0;

    const drawEnemy = s.drawRidersAtlasFrame;
    let enemyPose;
    s.drawRidersAtlasFrame = function(ctx, row, frame, x, y, w, h, flip) { enemyPose = { frame, flip }; return true; };
    for (const kind of ['rival', 'boss']) for (const side of [-1, 1]) {
      const enemy = { kind, lane: -.3, distance: 25, hp: 5, attackSide: side, attackTimer: .7, hitFlash: 0, reactionTimer: 0, wobble: 0 };
      s.drawRival(ctx, enemy, 400, 500, 1);
      check(enemyPose.frame === 1 && (enemyPose.flip ? -1 : 1) === side, `${kind} windup faces committed side ${side}`);
      enemy.attackTimer = .2; s.drawRival(ctx, enemy, 400, 500, 1);
      check(enemyPose.frame === 2 && (enemyPose.flip ? -1 : 1) === side, `${kind} active frame faces committed side ${side}`);
      enemy.attackTimer = 0; enemy.reactionTimer = .4; s.drawRival(ctx, enemy, 400, 500, 1);
      check((enemyPose.flip ? -1 : 1) === side, `${kind} recoil facing survives timer expiry ${side}`);
    }
    s.drawRidersAtlasFrame = drawEnemy;

    const beforeRng = s.rngState; s.shake = 5;
    s.draw(ctx); s.draw(ctx);
    check(s.rngState === beforeRng, 'Repeated drawing and shake never consume simulation RNG');
    s.shake = 0;

    const order = [], shadows = [];
    const saved = { player: s.drawPlayer, vehicle: s.drawVehicle, rival: s.drawRival, oil: s.drawOil, prop: s.drawRoadObjectAtlasFrame };
    s.drawPlayer = function() { order.push(`player${this.rider.id}`); };
    s.drawVehicle = function(ctx, entity) { order.push(entity.id); };
    s.drawRoadObjectAtlasFrame = () => true;
    const entity = (id, distance) => ({ id, kind: 'car', lane: 0, distance, active: true });
    s.entities = [entity(101, s.distance + 100), entity(102, s.distance - 10)];
    s.drawWorldObjects(ctx);
    check(order.join(',') === '101,player1,player2,102', 'World sprites and both players sort by distance');
    Object.assign(s, { drawPlayer: saved.player, drawVehicle: saved.vehicle, drawRival: saved.rival, drawOil: saved.oil, drawRoadObjectAtlasFrame: saved.prop });
    const ellipse = ctx.ellipse.bind(ctx);
    ctx.ellipse = function(x, y, ...args) { if (y === 524 && args[0] === 38) shadows.push(x); return ellipse(x, y, ...args); };
    s.entities = []; s.draw(ctx); ctx.ellipse = ellipse;
    check(shadows.length === 2 && shadows[0] !== shadows[1], 'Both cooperative riders have a road shadow');

    window.reviewRuntime.setArtEnabled(false);
    s.bossDefeatTimer = .7;
    const boss = { id: 103, kind: 'boss', lane: .4, distance: 20, speed: 100, hp: 0, maxHp: 8, active: true, attackTimer: 0, hitFlash: 0, reactionTimer: 0, recoilSide: 1, wobble: 0, color: '#facc15' };
    ctx.clearRect(0, 0, 960, 540); s.drawRival(ctx, boss, 500, 510, 1);
    const crashPixels = ctx.getImageData(0, 0, 960, 540).data;
    let opaque = 0; for (let i = 3; i < crashPixels.length; i += 4) if (crashPixels[i] > 200) opaque++;
    check(opaque > 1000, 'Vector boss crash retains an opaque rider silhouette');
    s.bossDefeatTimer = 1.05 * .01;
    ctx.clearRect(0, 0, 960, 540); s.drawRival(ctx, boss, 500, 510, 1);
    const faded = ctx.getImageData(0, 0, 960, 540).data;
    let maxAlpha = 0; for (let i = 3; i < faded.length; i += 4) maxAlpha = Math.max(maxAlpha, faded[i]);
    check(maxAlpha < 128, `Vector boss crash fades through all nested drawing operations (max alpha ${maxAlpha})`);
    s.bossDefeatTimer = 0; window.reviewRuntime.setArtEnabled(true);

    // A committed enemy swing retains its side even if another cooperative rider moves closer.
    const [p1, p2] = s.riders;
    p1.lane = -.4; p2.lane = .4; p1.invulnerability = 0; p2.invulnerability = 0;
    s.distance = 0;
    const enemy = { ...boss, kind: 'rival', hp: 5, distance: 20, lane: 0, reactionTimer: 0, attackTimer: .22, attackCooldown: 1, attackSide: 1, attackTargetId: 2 };
    s.entities = [enemy]; s.rider = p1; const hp1 = p1.hp; s.resolveContacts();
    check(p1.hp === hp1, 'Enemy right swing cannot damage a rider on its left');
    s.rider = p2; const hp2 = p2.hp; s.resolveContacts();
    check(p2.hp === hp2 - 10, 'Enemy committed swing damages its visible target');

    s.rider = p1; p1.attackTimer = .35; p1.attackConnected = false; p1.attackSide = 1;
    enemy.lane = -.05; enemy.attackTimer = .22; enemy.reactionTimer = 0; p1.invulnerability = 0;
    const before = p1.hp; s.resolveContacts();
    check(enemy.attackTimer === 0 && enemy.reactionTimer > 0 && p1.hp === before, 'Interrupted enemy attack cannot retaliate through hit stun');
    s.entities = []; p1.attackTimer = 0; p1.attackConnected = false; p1.playerRecoil = 0; p2.playerRecoil = 0;
    s.particles = []; s.shake = 0; s.impactFlash = 0; s.impactFreeze = 0;
    for (const rider of s.riders) { rider.hitFlash = 0; rider.invulnerability = 0; rider.hp = 100; }
    p1.lane = -.32; p2.lane = .32; p1.hero = 'nova'; p2.hero = 'cassia'; s.rider = p1;
    return { ok: true, checks, directions, far, crashOpaquePixels: opaque };
  });
  await page.evaluate(() => window.reviewStage.draw(window.reviewCtx));
  await page.locator('canvas').screenshot({ path: `${output}/coop-nova-cassia.png` });
  for (const hero of ['cassia', 'bruna', 'nova']) {
    await page.evaluate(hero => {
      const s = window.reviewStage; s.riders = [s.riders[0]]; s.rider = s.riders[0]; s.rider.lane = 0; s.rider.hero = hero;
      s.rider.speed = 72; s.rider.hp = 100; s.rider.invulnerability = 0; s.rider.hitFlash = 0;
      s.draw(window.reviewCtx);
    }, hero);
    await page.locator('canvas').screenshot({ path: `${output}/${hero}-ride.png` });
    for (const side of [-1, 1]) {
      const poses = await page.evaluate(side => {
        const s = window.reviewStage, c = document.createElement('canvas'); c.width = 960; c.height = 540;
        const ctx = c.getContext('2d'); ctx.fillStyle = '#282038'; ctx.fillRect(0, 0, 960, 540);
        const poses = [.66, .5, .3, .1];
        poses.forEach((timer, i) => {
          const cell = document.createElement('canvas'); cell.width = 240; cell.height = 270;
          const cc = cell.getContext('2d'); cc.translate(-360, -255);
          s.rider.attackTimer = timer; s.rider.attackSide = side; s.rider.playerRecoil = 0; s.rider.attackConnected = false;
          s.drawPlayer(cc); ctx.drawImage(cell, i * 240, 0);
        });
        s.rider.attackTimer = 0;
        return c.toDataURL().split(',')[1];
      }, side);
      await writeFile(`${output}/${hero}-attack-${side}.png`, Buffer.from(poses, 'base64'));
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ ...report, errors }, null, 2));
  console.log(`[road-rash-review] PASS (${report.checks.length} assertions)`);
} finally {
  await browser.close();
}
