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
// Beat frames come straight from the real gameplay canvas. With SwiftShader,
// encoding the full browser viewport can take hundreds of milliseconds while
// requestAnimationFrame keeps advancing, distorting the authored 2.1s beat.
// Canvas serialization captures the exact rendered frame without page chrome
// or any mutation to gameplay state.
const canvasShot = async name => {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Gameplay canvas missing');
    return canvas.toDataURL('image/png');
  });
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
};
const state = () => page.evaluate(() => window.__BMFM_DEBUG__.snapshot());
const waitForElapsed = target => page.waitForFunction(
  elapsed => window.__BMFM_DEBUG__.snapshot().elapsed >= elapsed,
  target,
  { timeout: 5_000, polling: 'raf' },
);
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
  await page.waitForFunction(() => {
    const atlas = window.__BMFM_DEBUG__.snapshot().atlas;
    return atlas && Object.keys(atlas).length === 9 && Object.values(atlas).every(sheet => sheet.state === 'ready');
  });
  checkpoints.atlas = (await state()).atlas;
  if (Object.keys(checkpoints.atlas).length !== 9 || checkpoints.atlas.riderImpact?.frames !== 12) {
    throw new Error(`Expected 9 atlases including 12-frame riderImpact, received ${JSON.stringify(checkpoints.atlas)}`);
  }
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
  if (checkpoints.start.hero !== 'modo') {
    throw new Error(`Hero select did not start Modo: ${JSON.stringify(checkpoints.start)}`);
  }

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
  // Targets use gameplay elapsed time, so screenshot encoding cannot reorder the beat.
  await page.keyboard.up('KeyZ');
  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('beat'));
  await page.waitForTimeout(120);
  checkpoints.beatStart = await assertState('playing');
  if (checkpoints.beatStart.hero !== 'throttle') {
    throw new Error(`Combat beat did not start Throttle: ${JSON.stringify(checkpoints.beatStart)}`);
  }
  const beatOrigin = checkpoints.beatStart.elapsed;
  const beatFrames = [];
  const captureBeatFrame = async (index, label) => {
    const frameState = await state();
    beatFrames.push({
      index,
      label,
      offsetMs: Math.round((frameState.elapsed - beatOrigin) * 1_000),
      score: frameState.score,
      riderReaction: frameState.beat?.riderReaction ?? 0,
      shots: frameState.beat?.shots ?? 0,
    });
    await canvasShot(`combat-beat-${index}`);
  };

  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(24);
  await captureBeatFrame(0, 'muzzle');
  await page.keyboard.up('KeyZ');

  await waitForElapsed(beatOrigin + .20);
  await captureBeatFrame(1, 'early travel');
  await waitForElapsed(beatOrigin + .54);
  await captureBeatFrame(2, 'late travel');

  await page.waitForFunction(
    startScore => {
      const snapshot = window.__BMFM_DEBUG__.snapshot();
      return snapshot.beat?.riderReaction > 0 && snapshot.score > startScore;
    },
    checkpoints.beatStart.score,
    { timeout: 2_000, polling: 'raf' },
  );
  checkpoints.beatContact = await state();
  const contactElapsed = checkpoints.beatContact.elapsed;
  await captureBeatFrame(3, 'contact core');

  await waitForElapsed(contactElapsed + .08);
  await captureBeatFrame(4, 'target squash');
  await waitForElapsed(contactElapsed + .28);
  await captureBeatFrame(5, 'recoil/backbend');
  await waitForElapsed(contactElapsed + .67);
  await captureBeatFrame(6, 'debris break');
  await waitForElapsed(contactElapsed + 1.27);
  await captureBeatFrame(7, 'recovery wobble');

  checkpoints.beatAftermath = await state();
  checkpoints.beatFrames = beatFrames;
  const beatDurationMs = beatFrames.at(-1)?.offsetMs ?? 0;
  checkpoints.beatTiming = { durationMs: beatDurationMs, contactMs: beatFrames[3]?.offsetMs ?? null };
  if (!checkpoints.beatContact.beat || checkpoints.beatContact.beat.riderReaction <= 0 ||
      checkpoints.beatContact.score <= checkpoints.beatStart.score ||
      checkpoints.beatAftermath.score <= checkpoints.beatStart.score) {
    throw new Error(`Combat beat missed its real rider collision: ${JSON.stringify(checkpoints.beatAftermath)}`);
  }
  // The complete causal sentence remains inside the authored 2.14s ceiling.
  if (beatFrames.length !== 8 || beatDurationMs < 1_950 || beatDurationMs > 2_140) {
    throw new Error(`Combat beat timing left its 1.95–2.14s capture envelope: ${JSON.stringify(beatFrames)}`);
  }
  const beatSchedule = beatFrames.map(frame => `${frame.index}:${frame.label}@${frame.offsetMs}ms`).join(', ');
  console.log(`[gauntlet] combat beat: ${beatSchedule}`);

  // Wave 9 impact contract: twelve frozen instants use the production entity,
  // projectile, atlas and FX renderers with a fixed camera.  State assertions
  // make the causal sentence independently reviewable instead of timing a PNG
  // encoder against requestAnimationFrame.
  const impactFrames = [];
  const impactNames = ['pre','muzzle','travel-25','travel-75','contact','hitstop','recoil-1','recoil-2','debris-1','debris-2','damage-hold','recover'];
  for (let index = 0; index < impactNames.length; index += 1) {
    const staged = await page.evaluate(frame => window.__BMFM_DEBUG__.gotoScene(`impact-${frame}`), index);
    if (staged.state !== 'playing' || staged.impact?.stage !== index || staged.impact.label !== impactNames[index]) {
      throw new Error(`Impact stage ${index} did not freeze deterministically: ${JSON.stringify(staged)}`);
    }
    impactFrames.push({ score: staged.score, ...staged.impact });
    // Two RAF boundaries guarantee the canvas contains this staged pose rather
    // than the previous one when canvas.toDataURL runs immediately afterwards.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await canvasShot(`impact-${String(index).padStart(2,'0')}-${impactNames[index]}`);
  }
  const scoreTransitions=impactFrames.reduce((count,frame,index)=>count+(index>0&&frame.score!==impactFrames[index-1].score?1:0),0);
  const prePose=impactFrames[0].targetPose,recoilPose=impactFrames[6].targetPose;
  const silhouetteDelta={x:Math.abs(recoilPose.x-prePose.x),y:Math.abs(recoilPose.y-prePose.y),angle:Math.abs(recoilPose.angle-prePose.angle)};
  const debris=impactFrames[8].particleContract;
  if (impactFrames.length!==12 || impactFrames[5].hitstopMs<66 || impactFrames[10].damageHoldMs<500 ||
      scoreTransitions!==1 || impactFrames[3].score!==0 || impactFrames[4].score<=impactFrames[3].score ||
      Math.max(...impactFrames.map(frame=>frame.shots))!==1 || impactFrames.at(-1).firedProjectiles!==1 ||
      silhouetteDelta.x<24 || silhouetteDelta.y<10 || silhouetteDelta.angle<8 ||
      !debris || debris.total<12 || debris.panels<3 || debris.sparks<5 || debris.smokeDust<4 || debris.longArcPanels<2) {
    throw new Error(`Impact contract failed: ${JSON.stringify({impactFrames,scoreTransitions,silhouetteDelta})}`);
  }
  checkpoints.impactChain={frames:impactFrames,scoreTransitions,silhouetteDelta,contactBbox:{width:84,height:56,layers:['#ff5a2c','#56eaff','#fffde3']}};
  console.log(`[gauntlet] 12-frame impact chain: one shot / one score, delta ${JSON.stringify(silhouetteDelta)}`);

  // Fixed recovery regression views reuse the gameplay pose function while
  // keeping screenshot encoding outside the original eight-frame timer.
  const wobbleRegression = [];
  for (const [stage, expectedSign] of [['a', 1], ['b', -1], ['c', 1]]) {
    const staged = await page.evaluate(scene => window.__BMFM_DEBUG__.gotoScene(scene), `wobble-${stage}`);
    const wobbleX = staged.beat?.wobbleX ?? 0;
    if (Math.sign(wobbleX) !== expectedSign) {
      throw new Error(`Recovery wobble-${stage} lost sign ${expectedSign}: ${JSON.stringify(staged.beat)}`);
    }
    wobbleRegression.push({ stage, wobbleX });
    await shot(`wobble-${stage}`);
  }
  if (!(Math.abs(wobbleRegression[0].wobbleX) > Math.abs(wobbleRegression[1].wobbleX) &&
        Math.abs(wobbleRegression[1].wobbleX) > Math.abs(wobbleRegression[2].wobbleX))) {
    throw new Error(`Recovery wobble failed + / - / + decay: ${JSON.stringify(wobbleRegression)}`);
  }
  checkpoints.wobbleRegression = wobbleRegression;
  console.log(`[gauntlet] recovery wobble: ${wobbleRegression.map(frame => `${frame.stage}:${frame.wobbleX}`).join(', ')}`);

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
  checkpoints.victorySetup = await page.evaluate(() => {
    const game = window.redlineGame;
    const boss = game.enemies.find(enemy => enemy.kind === 'boss');
    if (boss) {
      boss.hp = 1;
      return 'armed-live-boss';
    }
    // A strong randomized exchange may legitimately finish the boss before
    // the deterministic one-HP shortcut. Accept that real kill and continue
    // through the same delayed victory transition instead of treating it as
    // a missing-entity harness failure.
    if (game.bossDefeated || game.mode === 'win') return 'real-kill-during-exchange';
    throw new Error('Boss missing before victory transition check without a recorded defeat');
  });
  await page.keyboard.down('KeyZ');
  await page.waitForFunction(() => window.__BMFM_DEBUG__.snapshot().state === 'win', undefined, { timeout: 45_000 });
  await page.keyboard.up('KeyZ');
  checkpoints.victory = await assertState('win');
  await shot('victory');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(180);
  checkpoints.restart = await assertState('playing');

  // Keep a real third-hero production capture in every full Gauntlet report.
  // This catches per-sheet pivot, muzzle, and scale regressions that the Modo
  // ride and Throttle combat sentence cannot expose.
  await page.goto(new URL('/?scene=game&hero=vinnie', baseURL).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__BMFM_DEBUG__));
  await page.waitForFunction(() => {
    const snapshot = window.__BMFM_DEBUG__.snapshot();
    return snapshot.hero === 'vinnie' && snapshot.atlas &&
      Object.keys(snapshot.atlas).length === 9 && Object.values(snapshot.atlas).every(sheet => sheet.state === 'ready');
  });
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(850);
  await page.keyboard.up('KeyZ');
  await page.keyboard.up('ArrowRight');
  checkpoints.vinnieRide = await assertState('playing');
  if (checkpoints.vinnieRide.hero !== 'vinnie') {
    throw new Error(`Vinnie debug capture selected the wrong hero: ${JSON.stringify(checkpoints.vinnieRide)}`);
  }
  await shot('vinnie-ride');
  console.log('[gauntlet] Vinnie ride');

  // A real aerial-wave integration capture: both authored aerial classes are
  // spawned into the normal update/collision/render loop and fire gameplay shots.
  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('aerial'));
  await page.waitForTimeout(620);
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(260);
  checkpoints.aerialCombat = await assertState('playing');
  await page.keyboard.up('KeyZ');
  if (checkpoints.aerialCombat.hero !== 'throttle' || checkpoints.aerialCombat.enemies < 2 || checkpoints.aerialCombat.boss) {
    throw new Error(`Aerial integration scene was not live: ${JSON.stringify(checkpoints.aerialCombat)}`);
  }
  await shot('aerial-combat');
  console.log('[gauntlet] aerial combat');

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
