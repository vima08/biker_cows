import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4177';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('.gauntlet/builder-brawler-kinetics');
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

const state = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot().brawler);
const waitAssets = () => page.waitForFunction(() => {
  const brawler = window.__BCFV_DEBUG__?.snapshot().brawler;
  return brawler?.status === 'running' && Object.values(brawler.assets).every(value => value === 'ready');
});
const canvasShot = async name => {
  const dataURL = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataURL.split(',')[1], 'base64'));
};

const movement = new Set();
const setMovement = async wanted => {
  for (const key of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) {
    if (wanted.has(key) && !movement.has(key)) { await page.keyboard.down(key); movement.add(key); }
    if (!wanted.has(key) && movement.has(key)) { await page.keyboard.up(key); movement.delete(key); }
  }
};
const releaseMovement = () => setMovement(new Set());

async function approachNearest() {
  const brawler = await state();
  const player = brawler.players.find(candidate => !candidate.downed);
  const targets = brawler.enemies.filter(enemy => enemy.hp > 0);
  if (!player || !targets.length) { await releaseMovement(); return null; }
  const target = targets.reduce((best, enemy) => {
    const score = Math.hypot(enemy.x - player.x, (enemy.y - player.y) * 1.5);
    const prior = Math.hypot(best.x - player.x, (best.y - player.y) * 1.5);
    return score < prior ? enemy : best;
  });
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const wanted = new Set();
  if (Math.abs(dx) > 54) wanted.add(dx > 0 ? 'KeyD' : 'KeyA');
  if (Math.abs(dy) > 18) wanted.add(dy > 0 ? 'KeyS' : 'KeyW');
  await setMovement(wanted);
  return { brawler, player, target, dx, dy };
}

async function collectExchange(prefix, durationMs, filterKinds) {
  const attackPhases = Object.fromEntries(filterKinds.map(kind => [kind, new Set()]));
  const attackFrames = Object.fromEntries(filterKinds.map(kind => [kind, new Set()]));
  const playerReactions = new Set();
  const playerReactionFrames = new Set();
  let maxHitStop = 0;
  let maxParticles = 0;
  let maxFlash = 0;
  let maxPlayerRecoil = 0;
  const started = Date.now();
  let shot = 0;
  while (Date.now() - started < durationMs) {
    const brawler = await state();
    maxHitStop = Math.max(maxHitStop, brawler.hitStop);
    maxParticles = Math.max(maxParticles, brawler.impactParticles);
    for (const player of brawler.players) {
      if (player.reactionPhase) {
        playerReactions.add(player.reactionPhase);
        playerReactionFrames.add(player.frame);
        maxPlayerRecoil = Math.max(maxPlayerRecoil, Math.abs(player.pose.offsetX));
      }
      maxFlash = Math.max(maxFlash, player.hitFlash);
    }
    for (const enemy of brawler.enemies) {
      if (attackPhases[enemy.kind] && enemy.attackPhase) {
        attackPhases[enemy.kind].add(enemy.attackPhase);
        attackFrames[enemy.kind].add(enemy.frame);
      }
      maxFlash = Math.max(maxFlash, enemy.flash);
    }
    if (shot < 12 && Date.now() - started >= shot * 82) {
      await canvasShot(`${prefix}-${String(shot).padStart(2, '0')}`);
      shot++;
    }
    await page.waitForTimeout(14);
  }
  return {
    attackPhases: Object.fromEntries(Object.entries(attackPhases).map(([kind, phases]) => [kind, [...phases]])),
    attackFrames: Object.fromEntries(Object.entries(attackFrames).map(([kind, frames]) => [kind, [...frames]])),
    playerReactions: [...playerReactions],
    playerReactionFrames: [...playerReactionFrames],
    maxHitStop,
    maxParticles,
    maxFlash,
    maxPlayerRecoil,
  };
}

async function collectWalk(kind, durationMs = 3200) {
  const phases = new Set();
  const signatures = new Map();
  const started = Date.now();
  while (Date.now() - started < durationMs && phases.size < 4) {
    const brawler = await state();
    const enemy = brawler.enemies.find(candidate => candidate.kind === kind && candidate.moving);
    if (enemy) {
      phases.add(enemy.walkPhase);
      signatures.set(enemy.walkPhase, [enemy.frame, enemy.pose.offsetY, enemy.pose.rotation, enemy.pose.scaleX, enemy.pose.scaleY].join(':'));
    }
    await page.waitForTimeout(22);
  }
  const sortedPhases = [...phases].sort();
  const poseSignatures = sortedPhases.map(phase => signatures.get(phase));
  if (sortedPhases.join(',') !== '0,1,2,3') throw new Error(`${kind} did not traverse four walk phases: ${sortedPhases}`);
  if (new Set(poseSignatures).size !== 4) throw new Error(`${kind} walk poses are not distinct: ${poseSignatures}`);
  return { phases: sortedPhases, poseSignatures };
}

async function fightUntilWaveChanges(wave, timeoutMs = 75_000) {
  const started = Date.now();
  let lastJump = 0;
  while (Date.now() - started < timeoutMs) {
    const info = await approachNearest();
    if (!info) {
      const brawler = await state();
      if (brawler.wave !== wave || !brawler.arenaLocked) { await releaseMovement(); return; }
      if (brawler.status === 'defeat') throw new Error(`Wave ${wave} defeated player: ${JSON.stringify(brawler.players)}`);
      await page.waitForTimeout(40);
      continue;
    }
    if (info.brawler.wave !== wave || !info.brawler.arenaLocked) { await releaseMovement(); return; }
    if (Math.abs(info.dx) < 72 && Math.abs(info.dy) < 30 && Date.now() - lastJump > 950) {
      await page.keyboard.press('KeyX');
      lastJump = Date.now();
    }
    if (Math.abs(info.dx) < 58 && Math.abs(info.dy) < 26 && info.player.attackTimer <= .025 && !info.player.reactionPhase && info.brawler.hitStop <= .001) {
      await releaseMovement();
      if (info.player.special >= 35 && info.brawler.enemies.length >= 2) await page.keyboard.press('KeyC');
      else await page.keyboard.press('KeyZ');
    }
    await page.waitForTimeout(34);
  }
  const brawler = await state();
  throw new Error(`Wave ${wave} did not clear: ${JSON.stringify({ player: brawler.players[0], enemies: brawler.enemies })}`);
}

async function triggerWave(wave) {
  await setMovement(new Set(['KeyD']));
  await page.waitForFunction(expected => {
    const brawler = window.__BCFV_DEBUG__.snapshot().brawler;
    return brawler?.wave === expected && brawler.arenaLocked;
  }, wave, { timeout: 30_000 });
  await releaseMovement();
}

const report = {};
try {
  await page.goto(`${baseURL}/?scene=brawler&hero=bruna`, { waitUntil: 'networkidle' });
  await waitAssets();
  await triggerWave(0);
  await page.waitForFunction(() => {
    const b = window.__BCFV_DEBUG__.snapshot().brawler;
    return b.enemies.some(enemy => enemy.kind === 'raider' && enemy.moving && enemy.x - b.cameraX < 900);
  });
  report.raiderWalk = await collectWalk('raider');

  const approachStarted = Date.now();
  while (Date.now() - approachStarted < 12_000) {
    const info = await approachNearest();
    if (info && Math.abs(info.dx) < 66 && Math.abs(info.dy) < 24) break;
    await page.waitForTimeout(30);
  }
  await releaseMovement();
  report.raiderExchange = await collectExchange('raider-exchange', 4_500, ['raider']);

  await page.goto(`${baseURL}/?scene=brawler&hero=bruna`, { waitUntil: 'networkidle' });
  await waitAssets();
  await triggerWave(0);
  await fightUntilWaveChanges(0, 45_000);

  await triggerWave(1);
  await page.waitForFunction(() => {
    const b = window.__BCFV_DEBUG__.snapshot().brawler;
    return b.enemies.some(enemy => enemy.kind === 'bruiser' && enemy.moving && enemy.x - b.cameraX < 930)
      && b.enemies.some(enemy => enemy.kind === 'shocker' && enemy.moving && enemy.x - b.cameraX < 930);
  });
  report.bruiserWalk = await collectWalk('bruiser');
  report.shockerWalk = await collectWalk('shocker');
  const mixedApproachStarted = Date.now();
  while (Date.now() - mixedApproachStarted < 12_000) {
    const info = await approachNearest();
    if (info && Math.abs(info.dx) < 64 && Math.abs(info.dy) < 24) break;
    await page.waitForTimeout(30);
  }
  await releaseMovement();
  report.mixedExchange = await collectExchange('mixed-exchange', 9_000, ['raider', 'bruiser', 'shocker']);

  for (const [kind, data] of Object.entries({ raider: report.raiderExchange, bruiser: report.mixedExchange, shocker: report.mixedExchange })) {
    const phases = data.attackPhases[kind] ?? [];
    if (!['anticipation', 'contact', 'recovery'].every(phase => phases.includes(phase))) throw new Error(`${kind} attack phases missing: ${phases}`);
  }
  const reactions = new Set([...report.raiderExchange.playerReactions, ...report.mixedExchange.playerReactions]);
  if (!['hit-stun', 'knockback', 'ground', 'recovery'].every(phase => reactions.has(phase))) throw new Error(`Player reaction cascade missing: ${[...reactions]}`);
  const maxHitStop = Math.max(report.raiderExchange.maxHitStop, report.mixedExchange.maxHitStop);
  if (maxHitStop < .05 || maxHitStop > .09) throw new Error(`Hit stop outside 50-90ms contract: ${maxHitStop}`);
  if (Math.max(report.raiderExchange.maxParticles, report.mixedExchange.maxParticles) < 6) throw new Error('Impact emitted fewer than six particles');
  if (Math.max(report.raiderExchange.maxPlayerRecoil, report.mixedExchange.maxPlayerRecoil) < 4) throw new Error('Player recoil was below four pixels');

  await page.goto(`${baseURL}/?scene=brawler-boss&hero=bruna`, { waitUntil: 'networkidle' });
  await waitAssets();
  const bossApproachStarted = Date.now();
  while (Date.now() - bossApproachStarted < 12_000) {
    const info = await approachNearest();
    if (info && Math.abs(info.dx) < 106 && Math.abs(info.dy) < 28) break;
    await page.waitForTimeout(30);
  }
  await releaseMovement();
  report.bossExchange = await collectExchange('boss-exchange', 5_500, ['boss']);
  const bossPhases = report.bossExchange.attackPhases.boss;
  if (!['anticipation', 'contact', 'recovery'].every(phase => bossPhases.includes(phase))) throw new Error(`Boss attack phases missing: ${bossPhases}`);
  if (new Set(report.bossExchange.attackFrames.boss).size < 3) throw new Error(`Boss attack used fewer than three silhouettes: ${report.bossExchange.attackFrames.boss}`);

  await page.goto(`${baseURL}/?scene=brawler-boss&hero=bruna`, { waitUntil: 'networkidle' });
  await waitAssets();
  const phaseReactions = new Set();
  const phaseFrames = new Set();
  let sawPhaseShift = false;
  const phaseStarted = Date.now();
  let lastBossJump = 0;
  let phaseShot = 0;
  while (Date.now() - phaseStarted < 45_000) {
    const info = await approachNearest();
    if (!info) break;
    const boss = info.brawler.enemies.find(enemy => enemy.kind === 'boss');
    if (boss?.reactionPhase) { phaseReactions.add(boss.reactionPhase); phaseFrames.add(boss.frame); }
    if (boss?.phaseShifted) sawPhaseShift = true;
    if (boss?.phaseShifted && phaseShot < 10) {
      await canvasShot(`boss-phase-${String(phaseShot).padStart(2, '0')}`);
      phaseShot++;
    }
    if (boss?.phaseShifted && boss.reactionTimer <= .02) break;
    if (Math.abs(info.dx) < 130 && Date.now() - lastBossJump > 720) {
      await page.keyboard.press('KeyX');
      lastBossJump = Date.now();
    }
    if (Math.abs(info.dx) < 78 && Math.abs(info.dy) < 31 && info.player.attackTimer <= .025 && !info.player.reactionPhase) {
      await releaseMovement();
      if (info.player.special >= 35) await page.keyboard.press('KeyC');
      else await page.keyboard.press('KeyZ');
    }
    await page.waitForTimeout(28);
  }
  const finalBoss = (await state()).enemies.find(enemy => enemy.kind === 'boss');
  if (!sawPhaseShift) throw new Error('Boss phase shift was not triggered');
  if (!phaseReactions.has('phase-shift')) throw new Error(`Boss phase-shift pose missing: ${[...phaseReactions]}`);
  report.bossPhase = { reactions: [...phaseReactions], frames: [...phaseFrames], hp: finalBoss?.hp ?? 0 };

  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  console.log(JSON.stringify({ ok: true, runtimeErrors, report }, null, 2));
} finally {
  await releaseMovement().catch(() => {});
  await browser.close();
}
