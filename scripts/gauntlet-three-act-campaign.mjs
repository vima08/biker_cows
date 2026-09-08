import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(process.env.BCFV_CAPTURE_DIR ?? '.gauntlet/iteration-28/campaign-contract');
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
page.on('console', message => {
  if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
});
page.on('requestfailed', request => {
  runtimeErrors.push(`request: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'unknown failure'})`);
});

const assert = (condition, message, details) => {
  if (!condition) throw new Error(`${message}${details === undefined ? '' : `\n${JSON.stringify(details, null, 2)}`}`);
};
const state = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
const campaignOf = snapshot => {
  assert(snapshot?.campaign, 'Campaign snapshot contract is missing');
  return snapshot.campaign;
};
const actOf = snapshot => snapshot.act ?? campaignOf(snapshot).act;
const segmentOf = snapshot => snapshot.segment ?? campaignOf(snapshot).segment;
const playerHeroes = snapshot => snapshot.state === 'brawler'
  ? (snapshot.brawler?.players ?? []).map(player => player.hero)
  : (snapshot.players ?? []).map(player => player.hero);
const capture = async name => {
  await page.waitForTimeout(100);
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'visible' });
  const size = await canvas.evaluate(node => ({ width: node.width, height: node.height }));
  assert(size.width === 960 && size.height === 540, 'Expected the production 960x540 canvas', size);
  await canvas.screenshot({ path: path.join(outputDir, `${name}.png`) });
};
const record = (label, snapshot) => {
  report.observed.push({
    label,
    state: snapshot.state,
    act: actOf(snapshot),
    segment: segmentOf(snapshot),
    transition: snapshot.campaign?.transition ?? null,
    historyLength: snapshot.campaign?.history?.length ?? 0,
    coop: snapshot.coop,
    heroes: playerHeroes(snapshot),
  });
};
const assertCoop = (snapshot, heroes, label) => {
  const activeHeroes = playerHeroes(snapshot);
  assert(snapshot.coop === true && snapshot.coopEnabled === true, `${label}: co-op flag was not retained`, snapshot);
  assert(activeHeroes.length === 2, `${label}: expected two active players`, activeHeroes);
  assert(activeHeroes[0] === heroes[0] && activeHeroes[1] === heroes[1], `${label}: selected co-op heroes changed`, { expected: heroes, actual: activeHeroes });
};
const completeAct = async () => page.evaluate(() => {
  const api = window.__BCFV_DEBUG__;
  if (typeof api?.completeAct !== 'function') throw new Error('Debug API completeAct() is missing');
  return api.completeAct();
});
const setRoadInput = input => page.evaluate(value => window.__BCFV_DEBUG__.setRoadRashInput(value), input);

// The road segment must be traversed and its boss beaten through the same held
// controls as a human player. No teleport, health editing or completeAct here.
const driveRoadWithOrdinaryInputs = async (prefix, timeoutMs = 100_000) => {
  const result = await page.evaluate(async timeout => {
    const api = window.__BCFV_DEBUG__;
    const started = performance.now(), healthSequence = [], captures = [];
    let previousHealth = null, crashCaptured = false;
    const stop = () => api.setRoadRashInput({ accelerate: false, brake: false, left: false, right: false, attack: false });
    const shot = label => captures.push({ label, data: document.querySelector('canvas').toDataURL() });
    return await new Promise(resolve => {
      const tick = () => {
        const s = api.snapshot(), r = s.roadRash, boss = r?.boss;
        const fail = message => { stop(); resolve({ error: message, road: r, healthSequence }); };
        if (!r || s.state !== 'road-rash') return fail('Road exited before verified finish');
        if (r.defeated || r.health <= 0) return fail('Ordinary-input road traversal lost the rider');
        if (performance.now() - started > timeout) return fail('Ordinary-input road traversal timed out');
        if (boss && previousHealth !== boss.hp) {
          if (previousHealth !== null && boss.hp !== previousHealth - 1) return fail('Boss HP skipped an ordinary hit');
          previousHealth = boss.hp; healthSequence.push(boss.hp);
          if (healthSequence.length === 1) shot('boss');
        }
        if (!r.bossDefeated && (r.finishReady || r.finishVisible || r.finishCrossed || r.completed)) return fail('Premature finish');
        if (r.bossDefeatAnimating && !crashCaptured) { shot('boss-crash'); crashCaptured = true; }
        if (r.completed) {
          stop(); shot('victory');
          return resolve({ seconds: +((performance.now()-started)/1000).toFixed(1), road: r, healthSequence, captures });
        }
        const hazards = r.entities.filter(e => ['car','truck','oil'].includes(e.kind) && e.relativeDistance > -26 && e.relativeDistance < 300);
        const targetLane = boss && boss.hp > 0 && Math.abs(boss.relativeDistance) < 90 ? boss.lane : r.lane;
        const danger = lane => hazards.reduce((total,e) => {
          const dz = Math.max(0,e.relativeDistance), clearance = e.kind === 'truck' ? .46 : .37;
          const crossing = (e.lane-r.lane)*(e.lane-lane) <= 0;
          return total + Math.max(0,clearance-Math.abs(lane-e.lane))*8000/(dz+24) + (crossing && dz<70 ? 50 : 0);
        },Math.abs(lane-targetLane)*3);
        const wanted = [-.88,-.6,-.3,0,.3,.6,.88,targetLane].sort((a,b)=>danger(a)-danger(b))[0];
        const delta = wanted-r.lane;
        api.setRoadRashInput({ accelerate:true,brake:false,left:delta<-.045,right:delta>.045,attack:true });
        requestAnimationFrame(tick);
      }; requestAnimationFrame(tick);
    });
  }, timeoutMs);
  assert(!result.error, result.error, result);
  assert(result.road.bossDefeated && result.road.finishCrossed && !result.road.bossDefeatAnimating,'Road victory bypassed its boss/finish gate',result.road);
  assert(JSON.stringify(result.healthSequence) === JSON.stringify([8,7,6,5,4,3,2,1,0]),'Road King was not defeated with eight ordinary attacks',result.healthSequence);
  for (const frame of result.captures) await writeFile(path.join(outputDir,`${prefix}-${frame.label}.png`),Buffer.from(frame.data.split(',')[1],'base64'));
  delete result.captures;
  return result;
};


const report = {
  ok: false,
  contract: 'rider act 1 -> miniboss -> Road Rash + Road King -> brawler -> rider final run -> boss -> win',
  scope: 'Campaign routing/checkpoints/loadout; Road Rash traversal and King use ordinary controls. Other act boundaries use completeAct and are not full combat completion evidence.',
  observed: [],
  timing: null,
  continue: null,
  history: null,
  routes: null,
  runtimeErrors,
};

try {
  await page.goto(`${baseURL}/?scene=coop&hero=cassia`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().state === 'playing');

  const act1 = await state();
  assert(actOf(act1) === 1, 'Campaign did not start in rider act 1', act1.campaign);
  assert(segmentOf(act1) === 'rider-pre-miniboss', 'Act 1 has the wrong segment', act1.campaign);
  const coopHeroes = [...act1.selectedHeroes];
  assert(coopHeroes.length === 2, 'Co-op selection must retain two heroes', coopHeroes);
  assertCoop(act1, coopHeroes, 'rider act 1');
  record('rider-act-1', act1);
  await capture('01-rider-act-1');

  const timing = campaignOf(act1).timing;
  assert(timing, 'Campaign timing metadata is missing');
  const sourcePostMinibossSeconds = timing.originalBossAtSeconds - timing.minibossAtSeconds;
  assert(timing.minibossAtSeconds === 145, 'Source miniboss boundary must remain 145 seconds', timing);
  assert(timing.originalBossAtSeconds === 465, 'Source final boss boundary must remain 465 seconds', timing);
  assert(timing.originalPostMinibossSeconds === sourcePostMinibossSeconds, 'Reported source tail does not match bossAtSeconds - minibossAtSeconds', timing);
  assert(sourcePostMinibossSeconds === 320, 'Unexpected source post-miniboss duration', timing);
  assert(timing.act3BossAtSeconds * 2 === sourcePostMinibossSeconds, 'Act 3 must be exactly twice as fast as the source post-miniboss section', timing);
  assert(timing.act3BossAtSeconds === 160, 'Act 3 final boss boundary must be 160 seconds', timing);
  report.timing = {
    source: `${timing.originalBossAtSeconds} - ${timing.minibossAtSeconds} = ${sourcePostMinibossSeconds}s`,
    act3: `${timing.act3BossAtSeconds}s`,
    ratio: sourcePostMinibossSeconds / timing.act3BossAtSeconds,
    metadata: timing,
  };

  await page.evaluate(() => window.__BCFV_DEBUG__.gotoScene('miniboss'));
  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    return (snapshot.act ?? snapshot.campaign?.act) === 1 && snapshot.boss?.kind === 'miniboss';
  });
  const miniboss = await state();
  assertCoop(miniboss, coopHeroes, 'act 1 miniboss');
  record('act-1-miniboss', miniboss);
  await capture('02-act-1-miniboss');

  await completeAct();
  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    return (snapshot.act ?? snapshot.campaign?.act) === 1 && snapshot.boss === null;
  });
  const minibossDefeated = await state();
  assertCoop(minibossDefeated, coopHeroes, 'miniboss defeat transition');
  record('miniboss-defeated', minibossDefeated);
  await capture('03-miniboss-defeated');

  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    return snapshot.state === 'road-rash' && (snapshot.act ?? snapshot.campaign?.act) === 2;
  }, undefined, { timeout: 20_000 });
  const roadEntry = await state();
  assertCoop(roadEntry, coopHeroes, 'road act 2 retained team');
  assert(!roadEntry.campaign.standalone && roadEntry.campaign.activePlayers === 1, 'Campaign road should retain its route with P1 driving', roadEntry.campaign);
  assert(roadEntry.roadRash.playerHero === coopHeroes[0], 'Road Rash changed the selected P1 heroine', roadEntry.roadRash);
  const roadEntryScore = roadEntry.score;
  record('road-rash-act-2', roadEntry);
  await capture('03b-road-rash-entry');

  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'paused');
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'road-rash');
  const roadRestart = await state();
  assert(!roadRestart.campaign.standalone && segmentOf(roadRestart) === 'road-rash', 'Pause restart converted campaign road to standalone', roadRestart.campaign);
  assert(JSON.stringify(roadRestart.campaign.history) === JSON.stringify(roadEntry.campaign.history), 'Road restart duplicated campaign history', roadRestart.campaign);
  assert(roadRestart.continue.attempts.current === roadEntry.continue.attempts.current, 'Pause restart consumed a continue', roadRestart.continue);

  await page.evaluate(() => window.__BCFV_DEBUG__.defeatRoadRash());
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'continue');
  const roadContinue = await state();
  assert(segmentOf(roadContinue) === 'road-rash' && roadContinue.continue.checkpoint.runtime === 'road-rash', 'Road continue lost runtime identity', roadContinue);
  assert(!roadContinue.campaign.standalone, 'Road continue lost campaign participation', roadContinue.campaign);
  await capture('03c-road-rash-continue');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'road-rash');
  const roadContinued = await state();
  assertCoop(roadContinued, coopHeroes, 'road continue retained team');
  assert(!roadContinued.campaign.standalone && roadContinued.roadRash.health === roadContinued.roadRash.maxHealth, 'Road continue did not restore a fresh campaign stage', roadContinued);
  assert(roadContinued.score === roadEntryScore, 'Road continue changed the committed campaign score', { roadEntryScore, score: roadContinued.score });
  report.roadContinue = { offered: roadContinue.continue, restarted: roadContinued.continue, standalone: roadContinued.campaign.standalone };
  report.road = await driveRoadWithOrdinaryInputs('03d-road-rash');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'brawler', undefined, { timeout: 15_000 });
  const brawler = await state();
  assert(segmentOf(brawler) === 'brawler', 'Act 2 has the wrong campaign segment', brawler.campaign);
  assertCoop(brawler, coopHeroes, 'brawler act 2');
  assert(brawler.score === roadEntryScore + report.road.road.score, 'Road score was lost or committed more than once', { before: roadEntryScore, road: report.road.road.score, after: brawler.score });
  assert(brawler.campaign.activePlayers === 2, 'P2 did not rejoin after Road Rash', brawler.campaign);
  record('brawler-act-2', brawler);
  await capture('04-brawler-act-2');

  await completeAct();
  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    return snapshot.state === 'brawler'
      && (snapshot.act ?? snapshot.campaign?.act) === 2
      && snapshot.brawler?.status === 'victory';
  }, undefined, { timeout: 20_000 });
  const brawlerVictory = await state();
  assert(brawlerVictory.brawler?.status === 'victory', 'Brawler completion did not enter the real victory state', brawlerVictory.brawler);
  assertCoop(brawlerVictory, coopHeroes, 'brawler victory');
  record('brawler-victory', brawlerVictory);
  await capture('05-brawler-victory');

  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    return snapshot.state === 'playing' && (snapshot.act ?? snapshot.campaign?.act) === 3;
  }, undefined, { timeout: 20_000 });
  const act3 = await state();
  assert(segmentOf(act3) === 'rider-post-miniboss', 'Act 3 has the wrong campaign segment', act3.campaign);
  assertCoop(act3, coopHeroes, 'rider act 3');
  assert(act3.campaign.rider.sourceStart === 145 && act3.campaign.rider.sourceEnd === 465, 'Act 3 source interval is not the original post-miniboss section', act3.campaign.rider);
  assert(act3.campaign.rider.duration === 160, 'Act 3 duration is not 160 seconds', act3.campaign.rider);
  assert(act3.campaign.rider.timelineRate === 2, 'Act 3 source timeline must advance at 2x rate', act3.campaign.rider);
  const act1Loadout = act1.players.map(player => ({ id: player.id, hero: player.hero, weapon: player.weapon, weaponRank: player.weaponRank }));
  const act3Loadout = act3.players.map(player => ({ id: player.id, hero: player.hero, weapon: player.weapon, weaponRank: player.weaponRank }));
  assert(JSON.stringify(act3Loadout) === JSON.stringify(act1Loadout), 'Rider weapon loadout was reset across the brawler act', { act1Loadout, act3Loadout });
  report.loadout = { act1: act1Loadout, act3: act3Loadout, retained: true };
  record('rider-act-3', act3);
  await capture('06-rider-act-3');

  await page.evaluate(() => window.__BCFV_DEBUG__.damagePlayer(1, 99_999));
  await page.evaluate(() => window.__BCFV_DEBUG__.damagePlayer(2, 99_999));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'continue');
  const act3Continue = await state();
  assert(actOf(act3Continue) === 3, 'Act 3 defeat lost the campaign act', act3Continue.campaign);
  assert(act3Continue.continue.checkpoint.stage === 3, 'Continue did not retain the rider act 3 checkpoint', act3Continue.continue);
  assert(act3Continue.continue.checkpoint.runtime === 'rider', 'Act 3 checkpoint has the wrong runtime', act3Continue.continue);
  assertCoop(act3Continue, coopHeroes, 'act 3 continue');
  await capture('07-act-3-continue');

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    return snapshot.state === 'playing' && (snapshot.act ?? snapshot.campaign?.act) === 3;
  });
  const act3Restart = await state();
  assert(segmentOf(act3Restart) === 'rider-post-miniboss', 'Continue restarted the wrong campaign segment', act3Restart.campaign);
  assertCoop(act3Restart, coopHeroes, 'act 3 restart');
  report.continue = { offered: act3Continue.continue, restarted: act3Restart.continue, heroes: coopHeroes };
  record('rider-act-3-restarted', act3Restart);
  await capture('08-act-3-restarted');

  await page.evaluate(seconds => window.__BCFV_DEBUG__.gotoScene('rider-act-3', seconds), timing.act3BossAtSeconds);
  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    return snapshot.state === 'playing'
      && (snapshot.act ?? snapshot.campaign?.act) === 3
      && snapshot.boss?.kind === 'boss';
  });
  const finalBoss = await state();
  assertCoop(finalBoss, coopHeroes, 'final rider boss');
  assert(finalBoss.campaign.rider.elapsed === 160, 'Final boss did not occur at the compressed act boundary', finalBoss.campaign.rider);
  assert(finalBoss.campaign.rider.sourceElapsed === 465, 'Final boss did not map to the original 465 second endpoint', finalBoss.campaign.rider);
  record('final-rider-boss', finalBoss);
  await capture('09-final-rider-boss');

  await completeAct();
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'outro', undefined, { timeout: 20_000 });
  await capture('10-outro-parade');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().outro?.panel === 1);
  await capture('10b-outro-fireworks');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'win');
  const win = await state();
  assert(actOf(win) === 3, 'Campaign win lost the final act identity', win.campaign);
  assertCoop(win, coopHeroes, 'campaign win');
  record('campaign-win', win);
  await capture('10c-campaign-win');

  const observedActs = report.observed.map(item => item.act);
  assert(JSON.stringify(observedActs) === JSON.stringify([1, 1, 1, 2, 2, 2, 3, 3, 3, 3]), 'Observed campaign order is not rider -> Road Rash -> brawler -> rider', report.observed);
  assert(
    JSON.stringify(win.campaign.history) === JSON.stringify(['miniboss-defeated', 'road-rash-victory', 'brawler-victory', 'boss-defeated', 'campaign-win']),
    'Campaign history contains an unexpected route',
    win.campaign,
  );
  report.history = win.campaign.history;

  // Legacy/debug routes are part of the production review harness. The
  // stage-transition route must enter Road Rash, while the
  // standalone rider boss remains a self-contained victory route.
  await page.goto(`${baseURL}/?scene=stage-transition&hero=bruna`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().boss?.kind === 'miniboss');
  await capture('11-stage-transition-miniboss');
  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    return snapshot.state === 'road-rash' && (snapshot.act ?? snapshot.campaign?.act) === 2;
  }, undefined, { timeout: 20_000 });
  const stageTransition = await state();
  assert(stageTransition.segment === 'road-rash' && !stageTransition.campaign.standalone, 'stage-transition did not enter campaign Road Rash', stageTransition.campaign);
  await capture('12-stage-transition-road-rash');

  await page.goto(`${baseURL}/?scene=road-rash-boss&hero=nova`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().roadRash?.boss);
  const standaloneRoadEntry = await state();
  assert(standaloneRoadEntry.campaign.standalone, 'Road debug scene must remain standalone', standaloneRoadEntry.campaign);
  report.standaloneRoad = await driveRoadWithOrdinaryInputs('12b-standalone-road');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'win');
  const standaloneRoadWin = await state();
  assert(standaloneRoadWin.campaign.standalone && standaloneRoadWin.brawler === null, 'Standalone road incorrectly advanced into the campaign', standaloneRoadWin);

  await page.goto(`${baseURL}/?scene=boss&hero=bruna`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().boss?.kind === 'boss');
  await capture('13-standalone-boss');
  await completeAct();
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'win', undefined, { timeout: 20_000 });
  const standaloneBossWin = await state();
  assert(standaloneBossWin.state === 'win', 'Standalone rider boss no longer reaches its victory screen', standaloneBossWin);
  await capture('14-standalone-boss-win');
  report.routes = {
    stageTransition: { state: stageTransition.state, act: actOf(stageTransition), segment: segmentOf(stageTransition) },
    standaloneBoss: { state: standaloneBossWin.state, bossDefeated: standaloneBossWin.bossDefeated },
    standaloneRoad: { state: standaloneRoadWin.state, standalone: standaloneRoadWin.campaign.standalone },
  };
  assert(runtimeErrors.length === 0, 'Runtime/page/request errors were recorded', runtimeErrors);

  report.ok = true;
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = error instanceof Error ? error.stack : String(error);
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
