import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173/biker_cows';
const output = path.resolve('.gauntlet/rider-depth');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(request.url()));
  await page.goto(`${baseURL}/?scene=game`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Object.values(window.__BCFV_DEBUG__.snapshot().atlas).every(sheet => sheet.state === 'ready'));
  const report = await page.evaluate(async () => {
    const { VenusGame } = await import('./src/game.ts');
    const { setArtEnabled } = await import('./src/debug/runtime.ts');
    const { playerRoadDepth } = await import('./src/rider/depth.ts');
    const canvas = document.createElement('canvas');
    const container = document.createElement('div');
    container.append(canvas); // Tablet controls require a canvas parent.
    const game = new VenusGame(canvas); // No animation loop: deterministic frames.
    const ctx = canvas.getContext('2d');
    const p = game.players[0];
    game.shots = []; game.particles = []; game.pickups = []; game.enemies = [];
    game.distance = 0; game.time = 0; game.shake = 0;
    p.x = 220; p.y = 300; p.jump = 0; p.invuln = 0;
    p.fireHeld = false; p.fireReleaseElapsed = -1; p.kineticClock = 0;
    // Load optional environment sheets before collecting draw calls.
    game.drawWorld();
    await new Promise(resolve => setTimeout(resolve, 700));
    game.drawWorld();
    const checks = [];
    const check = (condition, name) => { if (!condition) throw Error(name); checks.push(name); };
    const originals = { player: game.drawPlayer, enemy: game.drawEnemy, downed: game.drawDownedPlayer, pickup: game.drawPickup };
    const drawImage = ctx.drawImage.bind(ctx);
    let trace = [];
    ctx.drawImage = (...args) => {
      const image = args[0];
      if (image.src?.includes('roadside-props-sheet')) {
        const cell = Math.round(args[1] / (image.naturalWidth / 4)) + 4 * Math.round(args[2] / (image.naturalHeight / 2));
        trace.push(`prop:${cell}`);
      }
      drawImage(...args);
    };
    game.drawPlayer = player => trace.push(`player:${player.id}`);
    game.drawDownedPlayer = player => trace.push(`downed:${player.id}`);
    game.drawEnemy = enemy => trace.push(enemy.kind);
    game.drawPickup = () => trace.push('pickup');
    const render = () => { trace = []; game.bossEnvironmentCacheValid = false; game.drawWorld(); return [...trace]; };
    const before = (a, b) => trace.includes(a) && trace.includes(b) && trace.indexOf(a) < trace.indexOf(b);
    game.spawnEnemy('mine', 220, 400);
    render(); check(before('player:1', 'mine'), 'Near mine occludes distant rider');
    game.enemies[0].y = 280;
    render(); check(before('mine', 'player:1'), 'Near rider occludes distant mine');
    p.jump = 90;
    render(); check(before('mine', 'player:1'), 'Jump preserves road depth'); p.jump = 0;
    game.enemies = []; p.y = 200;
    render(); check(before('player:1', 'prop:0'), 'Far rider passes behind rail');
    p.y = 250;
    render(); check(before('prop:0', 'player:1'), 'Near rider passes in front of rail');
    // Inject a position beyond normal input bounds to check both sides of signs.
    p.y = 200;
    render(); check(before('player:1', 'prop:2'), 'Rider behind sign contact');
    p.y = 300;
    render(); check(before('prop:2', 'player:1'), 'Rider in front of sign contact');
    const downed = { ...p, id: 2, y: 260, alive: false, downed: true };
    game.players.push(downed);
    render(); check(before('downed:2', 'player:1'), 'Distant wreck stays behind live rider');
    downed.y = 400;
    render(); check(before('player:1', 'downed:2'), 'Near wreck occludes live rider');
    game.players.pop();
    game.spawnEnemy('tank', 220, 300);
    game.pickups = [{ x: 220, y: 400, kind: 'health', t: 0 }];
    render(); check(before('tank', 'pickup') && trace.at(-1) === 'pickup', 'Near pickup stays above actors and foreground scenery');
    game.pickups[0].y = 260;
    render(); check(before('tank', 'pickup') && trace.at(-1) === 'pickup', 'Distant pickup stays above actors and foreground scenery');
    game.enemies = []; game.spawnEnemy('rider', 220, 280);
    game.riderImpacts = [{ enemyId: game.enemies[0].id, age: .3, localX: 0, localY: 0 }];
    const rear = game.drawImpactRear, front = game.drawImpactForeground;
    game.drawImpactRear = () => trace.push('impact-rear');
    game.drawImpactForeground = () => trace.push('impact-front');
    p.y = 350; render();
    check(before('impact-rear', 'rider') && before('rider', 'impact-front') && before('impact-front', 'player:1'), 'Attached hit effects remain behind nearer rider');
    game.drawImpactRear = rear; game.drawImpactForeground = front; game.riderImpacts = [];
    const fillRect = ctx.fillRect.bind(ctx);
    ctx.fillRect = (...args) => {
      if (args[0] === 0 && args[1] === 294 && args[2] === 960 && args[3] === 8) trace.push('fallback-rail');
      fillRect(...args);
    };
    for (const authored of [true, false]) {
      setArtEnabled(authored);
      for (const kind of ['drone', 'skimmer']) for (const altitude of [245, 295, 340]) {
        game.enemies = []; game.spawnEnemy(kind, 220, altitude);
        render();
        check(before(authored ? 'prop:0' : 'fallback-rail', kind) && before('player:1', kind) && before(kind, 'pickup') && trace.at(-1) === 'pickup', `${kind} at y=${altitude} flies in front of rail and behind pickups (${authored ? 'bitmap' : 'fallback'})`);
      }
    }
    setArtEnabled(true); ctx.fillRect = fillRect;
    game.drawPlayer = originals.player; game.drawEnemy = originals.enemy;
    game.drawDownedPlayer = originals.downed; game.drawPickup = originals.pickup;
    ctx.drawImage = drawImage;
    game.pickups = []; game.enemies = [];
    const frames = [];
    for (let hero = 0; hero < 3; hero++) {
      p.heroIndex = hero;
      const contact = playerRoadDepth(p);
      p.jump = 70;
      check(playerRoadDepth(p) === contact, `Hero ${hero}: depth independent of airborne pose`);
      p.jump = 0;
      for (const lane of [250, 300, 404]) {
        p.y = lane; game.drawWorld();
        frames.push({ name: `hero-${hero}-lane-${lane}`, image: canvas.toDataURL() });
      }
    }
    p.heroIndex = 0; p.y = 300;
    for (const kind of ['drone', 'skimmer']) {
      game.enemies = []; game.spawnEnemy(kind, 220, 280); game.drawWorld();
      frames.push({ name: `${kind}-in-front-of-rail`, image: canvas.toDataURL() });
    }
    for (const lane of [280, 350, 400]) {
      game.enemies = []; game.spawnEnemy('mine', 220, lane); game.drawWorld();
      frames.push({ name: `mine-${lane}`, image: canvas.toDataURL() });
    }
    const bitmap = () => [...ctx.getImageData(170, 350, 100, 100).data];
    const mine = game.enemies[0];
    ctx.clearRect(0, 0, 960, 540); mine.flash = 0; game.drawEnemy(mine); const normal = bitmap();
    ctx.clearRect(0, 0, 960, 540); mine.flash = .09; game.drawEnemy(mine); const hit = bitmap();
    check(normal.some((value, i) => value !== hit[i]), 'Authored mine visibly reacts to hit');
    game.enemies = []; game.spawnEnemy('pod', 220, 400); const pod = game.enemies[0];
    ctx.clearRect(0, 0, 960, 540); pod.flash = 0; game.drawEnemy(pod); const normalPod = bitmap();
    ctx.clearRect(0, 0, 960, 540); pod.flash = .09; game.drawEnemy(pod); const hitPod = bitmap();
    check(normalPod.some((value, i) => value !== hitPod[i]), 'Authored pod visibly reacts to hit');
    let bodyAlpha = 0;
    ctx.drawImage = (...args) => { bodyAlpha = ctx.globalAlpha; drawImage(...args); };
    game.drawDownedPlayer({ ...p, alive: false, downed: true });
    check(Math.abs(bodyAlpha - .46) < .001, `Downed bitmap uses intended .46 opacity (actual ${bodyAlpha})`);
    const rockAlpha = [];
    ctx.drawImage = (...args) => {
      if (args[0].src?.includes('roadside-props-sheet') && args[2] > 0 && args[3] > 0) rockAlpha.push(ctx.globalAlpha);
      drawImage(...args);
    };
    game.enemies = []; game.drawWorld();
    check(rockAlpha.length > 0 && rockAlpha.every(alpha => alpha === 1), 'Solid foreground rocks are opaque');
    ctx.drawImage = drawImage;
    setArtEnabled(false); game.drawWorld();
    frames.push({ name: 'vector-fallback', image: canvas.toDataURL() });
    setArtEnabled(true);
    return { checks, frames };
  });
  for (const frame of report.frames) await writeFile(path.join(output, `${frame.name}.png`), Buffer.from(frame.image.split(',')[1], 'base64'));
  delete report.frames;
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ ...report, errors }, null, 2));
  console.log(JSON.stringify({ ok: true, ...report, errors }, null, 2));
} finally {
  await browser.close();
}
