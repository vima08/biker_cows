import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseURL = new URL(process.env.BCFV_URL ?? 'http://127.0.0.1:4173/biker_cows/');
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(process.env.BCFV_CAPTURE_DIR ?? '.gauntlet/iteration-27/road-rash');
const previewPort = Number(baseURL.port || (baseURL.protocol === 'https:' ? 443 : 80));
const previewHost = baseURL.hostname;
await mkdir(outputDir, { recursive: true });

const report = {
  ok: false,
  contract: 'road-rash movement -> close combat -> boss damage -> victory',
  baseURL: baseURL.href,
  preview: { startedByHarness: false, output: [] },
  captures: [],
  checkpoints: {},
  sequentialFrames: [],
  runtimeErrors: [],
  externalRequests: [],
};

const assert = (condition, message, details) => {
  if (!condition) throw new Error(`${message}${details === undefined ? '' : `\n${JSON.stringify(details, null, 2)}`}`);
};
const reachable = async () => {
  try {
    const response = await fetch(baseURL, { signal: AbortSignal.timeout(900) });
    return response.ok;
  } catch {
    return false;
  }
};
const waitForPreview = async (timeoutMs = 20_000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await reachable()) return;
    await new Promise(resolve => setTimeout(resolve, 180));
  }
  throw new Error(`Production preview did not become ready at ${baseURL.href}`);
};

let preview = null;
if (!(await reachable())) {
  assert(['127.0.0.1', 'localhost', '::1'].includes(previewHost), 'Refusing to start a local preview for a remote BCFV_URL', baseURL.href);
  preview = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', previewHost, '--port', String(previewPort), '--strictPort'], {
    cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  report.preview.startedByHarness = true;
  const collectOutput = chunk => {
    report.preview.output.push(...String(chunk).trim().split(/\r?\n/).filter(Boolean));
    report.preview.output = report.preview.output.slice(-20);
  };
  preview.stdout.on('data', collectOutput);
  preview.stderr.on('data', collectOutput);
  await waitForPreview();
}

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(30_000);
page.on('pageerror', error => report.runtimeErrors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') report.runtimeErrors.push(`console: ${message.text()}`); });
page.on('requestfailed', request => report.runtimeErrors.push(`request: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'unknown failure'})`));
page.on('request', request => {
  const url = request.url();
  if (/^https?:/i.test(url) && new URL(url).origin !== baseURL.origin) report.externalRequests.push(`${request.method()} ${url}`);
});

const state = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
const roadOf = snapshot => snapshot?.roadRash ?? null;
const entitiesOf = road => Array.isArray(road?.entities) ? road.entities : Array.isArray(road?.enemies) ? road.enemies : [];
const entityCount = road => entitiesOf(road).length || Number(road?.enemies ?? 0);
const healthOf = entity => Number.isFinite(entity?.health) ? Number(entity.health) : Number.isFinite(entity?.hp) ? Number(entity.hp) : null;
const bossHealth = road => healthOf(road?.boss);
const victoryOf = snapshot => {
  const status = String(roadOf(snapshot)?.status ?? snapshot?.state ?? '').toLowerCase();
  return ['victory', 'complete', 'completed', 'win', 'won'].includes(status) || snapshot?.state === 'win';
};

const capture = async (name, settleMs = 100) => {
  if (settleMs > 0) await page.waitForTimeout(settleMs);
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'visible' });
  const size = await canvas.evaluate(node => ({ width: node.width, height: node.height }));
  assert(size.width === 960 && size.height === 540, 'Expected the production 960x540 canvas', size);
  const filename = `${name}.png`;
  await canvas.screenshot({ path: path.join(outputDir, filename) });
  report.captures.push(filename);
};
const openScene = async (scene, hero = 'cassia') => {
  const url = new URL(`?scene=${scene}&hero=${hero}&gauntlet=${Date.now()}`, baseURL);
  await page.goto(url.href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__BCFV_DEBUG__?.snapshot));
  await page.waitForFunction(() => Boolean(window.__BCFV_DEBUG__.snapshot().roadRash));
  const snapshot = await state();
  assert(roadOf(snapshot), `${scene}: snapshot().roadRash contract is missing`, snapshot);
  assert(typeof roadOf(snapshot).status === 'string', `${scene}: roadRash.status is missing`, roadOf(snapshot));
  return snapshot;
};
const canvasSignature = () => page.locator('canvas').evaluate(canvas => {
  const context = canvas.getContext('2d');
  const { data } = context.getImageData(360, 330, 240, 210);
  let hash = 2166136261;
  for (let index = 0; index < data.length; index += 13) {
    hash ^= data[index];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
});
const setInput = value => page.evaluate(input => {
  if (typeof window.__BCFV_DEBUG__.setRoadRashInput !== 'function') throw new Error('Debug API setRoadRashInput(partial) is missing');
  return window.__BCFV_DEBUG__.setRoadRashInput(input);
}, value);
const fightUntilHit = async ({ boss = false, timeoutMs = 18_000, captureSequence = false } = {}) => {
  const before = roadOf(await state());
  const initialHits = Number(before.hits ?? 0);
  const initialBossHealth = bossHealth(before);
  const started = Date.now();
  let lastRoad = before;
  while (Date.now() - started < timeoutMs) {
    const road = roadOf(await state());
    lastRoad = road;
    if (boss && (Boolean(road?.bossDefeated) || Number(road?.hits ?? 0) > initialHits ||
        (bossHealth(road) !== null && bossHealth(road) < initialBossHealth))) {
      await setInput({ accelerate: false, brake: false, left: false, right: false, attack: false });
      return road;
    }
    const candidates = entitiesOf(road).filter(entity => entity.active !== false && (boss ? entity.kind === 'boss' : entity.kind === 'rival'));
    const target = candidates.sort((left, right) => Math.abs(left.relativeDistance) - Math.abs(right.relativeDistance))[0];
    if (!target) {
      await setInput({ accelerate: true, brake: false, left: false, right: false, attack: false });
      await page.waitForTimeout(80);
      continue;
    }
    const laneDelta = Number(target.lane) - Number(road.lane);
    const longitudinalReach = boss ? 76 : 58;
    const lateralReach = boss ? .62 : .48;
    const inRange = Math.abs(Number(target.relativeDistance)) < longitudinalReach && Math.abs(laneDelta) < lateralReach;
    if (captureSequence && inRange && report.sequentialFrames.length === 0) {
      await setInput({ accelerate: true, brake: false, left: laneDelta < -.06, right: laneDelta > .06, attack: true });
      for (let index = 0; index < 8; index++) {
        await page.waitForTimeout(25);
        const name = `03-road-rash-combat-${index}`;
        await capture(name, 0);
        report.sequentialFrames.push(`${name}.png`);
      }
      const afterSequence = roadOf(await state());
      if (Number(afterSequence.hits ?? 0) > initialHits) {
        await setInput({ accelerate: false, brake: false, left: false, right: false, attack: false });
        return afterSequence;
      }
    }
    await setInput({
      accelerate: true,
      brake: false,
      left: laneDelta < -.06,
      right: laneDelta > .06,
      attack: inRange,
    });
    await page.waitForTimeout(65);
    const after = roadOf(await state());
    const confirmed = boss
      ? (bossHealth(after) !== null && bossHealth(after) < initialBossHealth) ||
        Boolean(after?.bossDefeated) || Number(after?.hits ?? 0) > initialHits
      : Number(after.hits ?? 0) > initialHits;
    if (confirmed) {
      await setInput({ accelerate: false, brake: false, left: false, right: false, attack: false });
      return after;
    }
  }
  await setInput({ accelerate: false, brake: false, left: false, right: false, attack: false });
  throw new Error(`${boss ? 'Boss' : 'Combat'} autoplay did not confirm a hit within ${timeoutMs}ms\n${JSON.stringify({
    status: lastRoad?.status,
    health: lastRoad?.health,
    distance: lastRoad?.distance,
    speed: lastRoad?.speed,
    lane: lastRoad?.lane,
    hits: lastRoad?.hits,
    entities: entitiesOf(lastRoad),
  }, null, 2)}`);
};

const defeatBossWithRealInputs = async () => {
  const healthSequence = [];
  let road = roadOf(await state());
  let previousHealth = bossHealth(road);
  assert(previousHealth !== null && previousHealth > 0, 'Boss must be alive before the real-input fight', road?.boss);
  healthSequence.push(previousHealth);
  while (previousHealth > 0) {
    road = await fightUntilHit({ boss: true, timeoutMs: 20_000 });
    const nextHealth = road?.bossDefeated ? 0 : bossHealth(road);
    assert(nextHealth !== null && nextHealth < previousHealth,
      'Every boss exchange must confirm a new ordinary-input hit', { previousHealth, nextHealth, road });
    healthSequence.push(nextHealth);
    previousHealth = nextHealth;
    if (previousHealth > 0) {
      assert(road.status !== 'victory' && !road.finishReady && !road.finishVisible && !road.finishCrossed,
        'Finish or victory appeared before Road King was defeated', road);
    }
  }
  return { road, healthSequence };
};

const takeOneRoadKingHitWithOrdinaryInput = async (timeoutMs = 12_000) => {
  const before = roadOf(await state());
  const healthSequence = [Number(before.health)];
  const attackTrace = [];
  let capturedAttackFrames = 0;
  const started = Date.now();
  // No steering, attacking or debug damage: staying in Road King's lane is the
  // deliberately poor defensive choice this contract is meant to punish.
  await setInput({ accelerate: false, brake: false, left: false, right: false, attack: false });
  while (Date.now() - started < timeoutMs) {
    await page.waitForTimeout(50);
    const road = roadOf(await state());
    const health = Number(road.health);
    if (healthSequence.at(-1) !== health) healthSequence.push(health);
    if (road.boss?.attacking) attackTrace.push({
      elapsedMs: Date.now() - started,
      relativeDistance: road.boss.relativeDistance,
      laneDelta: Number((Number(road.boss.lane) - Number(road.lane)).toFixed(3)),
      health,
    });
    if (road.boss?.attacking && capturedAttackFrames < 6) {
      await capture(`04b-road-king-attack-${capturedAttackFrames}`, 0);
      capturedAttackFrames++;
    }
    if (health < Number(before.health)) {
      assert(attackTrace.length > 0, 'Player damage happened without a visible Road King attack phase', { before, road, healthSequence });
      return { before: Number(before.health), after: health, healthSequence, attackTrace };
    }
  }
  const after = roadOf(await state());
  throw new Error(`Road King did not damage an idle player through ordinary gameplay within ${timeoutMs}ms\n${JSON.stringify({
    beforeHealth: before.health,
    afterHealth: after.health,
    boss: after.boss,
    lane: after.lane,
    healthSequence,
    attackTrace,
  }, null, 2)}`);
};

try {
  const initial = await openScene('road-rash');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().roadRash?.status === 'racing');
  const initialRoad = roadOf(await state());
  await capture('01-road-rash-start');
  assert(Number.isFinite(initialRoad.distance) && Number.isFinite(initialRoad.speed) && Number.isFinite(initialRoad.health),
    'road-rash must expose numeric distance, speed and health', initialRoad);

  await setInput({ accelerate: true, brake: false, left: false, right: false, attack: false });
  await page.waitForTimeout(500);
  const acceleratedRoad = roadOf(await state());
  await setInput({ accelerate: true, brake: false, left: false, right: true, attack: false });
  await page.waitForTimeout(240);
  await setInput({ accelerate: false, brake: false, left: false, right: false, attack: false });
  const moved = await state();
  const movedRoad = roadOf(moved);
  await capture('02-road-rash-movement');
  assert(movedRoad.distance > initialRoad.distance, 'Acceleration did not advance road-rash distance', { before: initialRoad, after: movedRoad });
  assert(acceleratedRoad.speed > initialRoad.speed, 'Acceleration did not increase road-rash speed', { before: initialRoad.speed, after: acceleratedRoad.speed });
  assert(movedRoad.lane > initialRoad.lane, 'Right steering did not change the road-rash lane', { before: initialRoad.lane, after: movedRoad.lane });
  report.checkpoints.movement = {
    before: { distance: initialRoad.distance, speed: initialRoad.speed, health: initialRoad.health },
    accelerated: { distance: acceleratedRoad.distance, speed: acceleratedRoad.speed },
    after: { distance: movedRoad.distance, speed: movedRoad.speed, health: movedRoad.health, lane: movedRoad.lane },
  };

  const combatInitial = await openScene('road-rash-combat');
  const combatBefore = roadOf(combatInitial);
  assert(entityCount(combatBefore) > 0, 'road-rash-combat must expose at least one live enemy', combatBefore);
  const enemyHealthBefore = entitiesOf(combatBefore).reduce((sum, enemy) => sum + (healthOf(enemy) ?? 0), 0);
  const hitsBefore = Number(combatBefore.hits ?? 0);
  await fightUntilHit({ captureSequence: true });
  const combatAfter = roadOf(await state());
  const enemyHealthAfter = entitiesOf(combatAfter).reduce((sum, enemy) => sum + (healthOf(enemy) ?? 0), 0);
  const hitsAfter = Number(combatAfter.hits ?? 0);
  assert(hitsAfter > hitsBefore || enemyHealthAfter < enemyHealthBefore || entityCount(combatAfter) < entityCount(combatBefore),
    'Road-rash attack input produced no confirmed combat result', {
      hitsBefore, hitsAfter, enemyHealthBefore, enemyHealthAfter,
      enemiesBefore: entityCount(combatBefore), enemiesAfter: entityCount(combatAfter),
    });
  report.checkpoints.combat = {
    hitsBefore, hitsAfter, enemyHealthBefore, enemyHealthAfter,
    enemiesBefore: entityCount(combatBefore), enemiesAfter: entityCount(combatAfter),
  };

  const bossInitial = await openScene('road-rash-boss');
  const bossBefore = roadOf(bossInitial);
  assert(bossBefore.boss, 'road-rash-boss must expose roadRash.boss', bossBefore);
  const healthBefore = bossHealth(bossBefore);
  assert(healthBefore !== null && healthBefore > 0, 'Road-rash boss needs positive health', bossBefore.boss);
  await capture('04-road-rash-boss');
  assert(!bossBefore.finishReady && !bossBefore.finishVisible && !bossBefore.finishCrossed,
    'The finish must stay hidden while Road King is alive', bossBefore);
  const bossDamageToPlayer = await takeOneRoadKingHitWithOrdinaryInput();
  assert(bossDamageToPlayer.after === bossDamageToPlayer.before - 14,
    'Road King ordinary attack must deal exactly 14 HP once', bossDamageToPlayer);
  report.checkpoints.bossDamageToPlayer = bossDamageToPlayer;
  const bossFight = await defeatBossWithRealInputs();
  const bossAfter = bossFight.road;
  const healthAfter = bossAfter.bossDefeated ? 0 : bossHealth(bossAfter);
  assert(bossAfter.hits === 8, 'Road King must be defeated by exactly eight ordinary-input hits', bossAfter);
  await page.waitForFunction(() => {
    const road = window.__BCFV_DEBUG__.snapshot().roadRash;
    return road?.bossDefeatAnimating === true && road.bossDefeatProgress >= .34;
  });
  const bossDefeat = roadOf(await state());
  assert(bossDefeat.boss?.active && bossHealth(bossDefeat) === 0,
    'Road King silhouette must remain active at zero HP during the defeat phase', bossDefeat);
  assert(!bossDefeat.finishReady && !bossDefeat.finishVisible && !bossDefeat.finishCrossed,
    'Finish must remain hidden throughout Road King defeat animation', bossDefeat);
  await capture('05-road-rash-boss-defeat', 0);
  assert(healthAfter !== null && healthAfter < healthBefore, 'Real attack input did not damage the road-rash boss', { healthBefore, healthAfter, boss: bossAfter.boss });
  report.checkpoints.bossDamage = {
    before: healthBefore, after: healthAfter, hits: bossAfter.hits,
    healthSequence: bossFight.healthSequence,
    defeatFrame: { timer: bossDefeat.bossDefeatTimer, progress: bossDefeat.bossDefeatProgress, bossActive: bossDefeat.boss?.active },
  };
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().roadRash?.bossDefeatAnimating === false);

  report.performance = await page.evaluate(async () => {
    const samples = [];
    let previous = performance.now();
    await new Promise(resolve => {
      const tick = now => {
        samples.push(now - previous); previous = now;
        if (samples.length >= 120) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const sorted = samples.slice(5).sort((a,b)=>a-b);
    const average = sorted.reduce((sum,value)=>sum+value,0)/sorted.length;
    return { frames: sorted.length, averageMs: Number(average.toFixed(2)), p95Ms: Number(sorted[Math.floor(sorted.length*.95)].toFixed(2)), fps: Number((1000/average).toFixed(1)) };
  });
  assert(report.performance.p95Ms < 40, 'Road Rash boss scene is not smooth enough', report.performance);

  await setInput({ accelerate: true, brake: false, left: false, right: false, attack: false });
  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    const status = String(snapshot.roadRash?.status ?? snapshot.state ?? '').toLowerCase();
    return ['victory', 'complete', 'completed', 'win', 'won'].includes(status) || snapshot.state === 'win';
  }, undefined, { timeout: 20_000 });
  await setInput({ accelerate: false, brake: false, left: false, right: false, attack: false });
  const victory = await state();
  assert(victoryOf(victory), 'Road-rash boss completion did not reach victory', victory);
  await capture('06-road-rash-victory');
  report.checkpoints.victory = {
    state: victory.state,
    roadStatus: roadOf(victory)?.status ?? null,
    finishReady: roadOf(victory)?.finishReady ?? null,
  };

  await openScene('road-rash');
  await page.evaluate(() => window.__BCFV_DEBUG__.defeatRoadRash());
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'continue');
  const continueOffer = await state();
  assert(continueOffer.continue?.checkpoint?.runtime === 'road-rash', 'Road Rash defeat did not retain its continue checkpoint', continueOffer.continue);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'road-rash');
  const continued = await state();
  assert(continued.roadRash?.health === continued.roadRash?.maxHealth, 'Road Rash continue did not construct a fresh stage', continued.roadRash);
  report.checkpoints.continue = { offer: continueOffer.continue, restartedStatus: continued.roadRash?.status };

  const heroineSignatures = {};
  for (const hero of ['cassia', 'bruna', 'nova']) {
    const heroineScene = await openScene('road-rash', hero);
    await page.waitForFunction(expected => window.__BCFV_DEBUG__.snapshot().roadRash?.playerHero === expected, hero);
    await page.waitForTimeout(250);
    const heroineRoad = roadOf(await state());
    assert(heroineRoad.playerHero === hero, `Road Rash did not preserve selected heroine ${hero}`, heroineRoad);
    heroineSignatures[hero] = await canvasSignature();
    await capture(`07-road-rash-hero-${hero}`, 0);
  }
  assert(new Set(Object.values(heroineSignatures)).size === 3,
    'Cassia, Bruna and Nova must render as three distinct road-rash silhouettes', heroineSignatures);
  report.checkpoints.heroineIdentity = heroineSignatures;

  assert(report.runtimeErrors.length === 0, 'Console/page/request errors were recorded', report.runtimeErrors);
  assert(report.externalRequests.length === 0, 'Gameplay made external network requests', report.externalRequests);
  report.ok = true;
  console.log('[road-rash] PASS');
} catch (error) {
  report.error = error instanceof Error ? error.stack : String(error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await setInput({ accelerate: false, brake: false, left: false, right: false, attack: false }).catch(() => {});
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  if (preview) {
    preview.kill();
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 2_000);
      preview.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
}
