import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('.gauntlet/iteration-25/builder-brawler-footing');
const reuseShots = process.env.BCFV_REUSE_SHOTS === '1';
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(30_000);
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

const brawler = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot().brawler);
const waitReady = () => page.waitForFunction(() => {
  const stage = window.__BCFV_DEBUG__?.snapshot().brawler;
  return stage?.status === 'running' && Object.values(stage.assets).every(value => value === 'ready');
});
const shot = name => page.screenshot({ path: path.join(outputDir, `${name}.png`) });

async function captureTwelve(prefix) {
  const samples = [];
  for (let index = 0; index < 12; index++) {
    await page.waitForTimeout(100);
    samples.push(await brawler());
    if (!reuseShots) await shot(`${prefix}-${String(index).padStart(2, '0')}`);
  }
  return samples;
}

async function heroDirection(hero, direction) {
  if (direction === 'right') {
    await page.goto(`${baseURL}/?scene=brawler-walk&hero=${hero}`, { waitUntil: 'networkidle' });
    await waitReady();
  } else {
    await page.goto(`${baseURL}/?scene=brawler&hero=${hero}`, { waitUntil: 'networkidle' });
    await waitReady();
    await page.keyboard.down('KeyD'); await page.waitForTimeout(850); await page.keyboard.up('KeyD');
    await page.keyboard.down('KeyA');
  }
  const samples = await captureTwelve(`${hero}-${direction}`);
  if (direction === 'left') {
    await page.keyboard.up('KeyA');
    // The 100ms visual cadence can alias a fast two-beat pair. Re-center and
    // sample the same real movement at 22ms solely for phase coverage.
    await page.keyboard.down('KeyD'); await page.waitForTimeout(850); await page.keyboard.up('KeyD');
    await page.keyboard.down('KeyA');
  }
  const phaseSamples = [];
  for (let index = 0; index < 42; index++) { await page.waitForTimeout(22); phaseSamples.push((await brawler()).players[0]); }
  if (direction === 'left') await page.keyboard.up('KeyA');
  const players = samples.map(sample => sample.players[0]);
  const phases = [...new Set(phaseSamples.filter(player => player.moving).map(player => player.walkPhase))].sort();
  if (phases.join(',') !== '0,1,2,3') throw new Error(`${hero} ${direction} missing gait phases: ${phases}`);
  if (players.some(player => player.moving && player.pose.offsetY !== 0)) throw new Error(`${hero} ${direction} lifted a grounded sprite`);
  const signatures = phases.map(phase => {
    const player = phaseSamples.find(candidate => candidate.walkPhase === phase);
    return [player.frame, player.pose.rotation, player.pose.scaleX, player.pose.scaleY].join(':');
  });
  if (new Set(signatures).size !== 4) throw new Error(`${hero} ${direction} does not show four weight-transfer silhouettes`);
  return { phases, signatures, xDelta: Number((players.at(-1).x - players[0].x).toFixed(2)) };
}

async function alphaBottom(url, frames, columns, rows, outputHeight, correction) {
  return page.evaluate(async ({ url, frames, columns, rows, outputHeight, correction }) => {
    const image = new Image(); image.src = url; await image.decode();
    const frameWidth = image.naturalWidth / columns, frameHeight = image.naturalHeight / rows;
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return frames.map(frame => {
      const sx = (frame % columns) * frameWidth, sy = Math.floor(frame / columns) * frameHeight;
      let bottom = -1;
      for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) {
        if (pixels[((sy + y) * canvas.width + sx + x) * 4 + 3] > 16) bottom = Math.max(bottom, y);
      }
      const transparentGutter = frameHeight - 1 - bottom;
      return { frame, bottom, residualPx: Number((correction - transparentGutter * outputHeight / frameHeight).toFixed(2)) };
    });
  }, { url, frames, columns, rows, outputHeight, correction });
}

const report = { viewport: '1440x900', heroes: {}, enemyApproach: {}, alphaGrounding: {}, jumpShadow: {} };
try {
  for (const hero of ['cassia', 'bruna', 'nova']) {
    report.heroes[hero] = {
      right: await heroDirection(hero, 'right'),
      left: await heroDirection(hero, 'left'),
    };
  }

  await page.goto(`${baseURL}/?scene=brawler&hero=cassia`, { waitUntil: 'networkidle' });
  await waitReady();
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler?.enemies.some(enemy => enemy.moving), null, { timeout: 20_000 });
  await page.keyboard.up('KeyD');
  const enemyFrames = await captureTwelve('enemy-approach');
  const common = enemyFrames.flatMap(frame => frame.enemies).filter(enemy => enemy.kind !== 'boss' && enemy.moving);
  if (!common.length) throw new Error('No real enemy approach was captured');
  if (common.some(enemy => enemy.pose.offsetY !== 0)) throw new Error('A walking common enemy lifted its sprite root above the ground plane');
  report.enemyApproach = Object.fromEntries(['raider', 'bruiser', 'shocker'].map(kind => {
    const enemies = common.filter(enemy => enemy.kind === kind);
    return [kind, { samples: enemies.length, phases: [...new Set(enemies.map(enemy => enemy.walkPhase))].sort() }];
  }));

  const heroSizes = { cassia: 130, bruna: 138, nova: 126 };
  for (const hero of ['cassia', 'bruna', 'nova']) {
    const right = await alphaBottom(`/biker_cows/assets/brawler/${hero}-brawler-sheet.png`, [0, 1, 2], 4, 4, heroSizes[hero], 3);
    const left = await alphaBottom(`/biker_cows/assets/brawler/${hero}-brawler-sheet.png`, [8, 9, 10], 4, 4, heroSizes[hero], 3);
    report.alphaGrounding[hero] = { right, left };
    if ([...right, ...left].some(frame => Math.abs(frame.residualPx) > 1)) throw new Error(`${hero} boot grounding residual exceeded 1px`);
  }
  const enemyMetrics = {
    raider: await alphaBottom('/biker_cows/assets/brawler/venus-gang-sheet.png', [0, 1, 2, 3, 4, 5, 6, 7], 4, 6, 114, 20),
    bruiser: await alphaBottom('/biker_cows/assets/brawler/venus-gang-sheet.png', [8, 9, 10, 12, 13, 14], 4, 6, 142, 3),
    shocker: await alphaBottom('/biker_cows/assets/brawler/venus-gang-sheet.png', [16, 17, 18, 20, 21, 22], 4, 6, 118, 9),
  };
  report.alphaGrounding.enemies = enemyMetrics;
  if (Object.values(enemyMetrics).flat().some(frame => Math.abs(frame.residualPx) > 2.5)) throw new Error('Enemy foot grounding residual exceeded 2.5px');

  await page.goto(`${baseURL}/?scene=brawler-jump&hero=nova`, { waitUntil: 'networkidle' });
  await waitReady();
  const jump = await captureTwelve('nova-jump-shadow');
  const jumpPlayers = jump.map(frame => frame.players[0]);
  report.jumpShadow = { worldYRange: Number((Math.max(...jumpPlayers.map(player => player.y)) - Math.min(...jumpPlayers.map(player => player.y))).toFixed(3)), maxZ: Math.max(...jumpPlayers.map(player => player.z)) };
  if (report.jumpShadow.worldYRange > .01 || report.jumpShadow.maxZ < 20) throw new Error(`Jump ground anchor moved: ${JSON.stringify(report.jumpShadow)}`);
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: true, errors, ...report }, null, 2));
  console.log(JSON.stringify({ ok: true, errors, ...report }, null, 2));
} finally {
  await browser.close();
}
