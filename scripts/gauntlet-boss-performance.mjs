import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(process.env.BCFV_CAPTURE_DIR ?? '.gauntlet/boss-performance');
const sampleMs = Number(process.env.BCFV_PERF_SAMPLE_MS ?? 6_000);
const cpuThrottle = Number(process.env.BCFV_CPU_THROTTLE ?? 1);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(30_000);
if (cpuThrottle > 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
}

const runtimeErrors = [];
page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
});
page.on('requestfailed', request => {
  runtimeErrors.push(`request: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'unknown failure'})`);
});

const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
};

async function measure(scene) {
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__BCFV_DEBUG__));
  await page.evaluate(target => window.__BCFV_DEBUG__.gotoScene(target), scene);
  await page.waitForFunction(expected => window.__BCFV_DEBUG__?.snapshot().boss?.kind === expected,
    scene === 'boss' ? 'boss' : 'miniboss');
  await page.waitForTimeout(700);

  const setup = await page.evaluate(() => {
    const game = window.venusGame;
    const initial = window.__BCFV_DEBUG__.snapshot();
    const player = game.players[0];
    const boss = game.enemies.find(enemy => enemy.kind === 'boss' || enemy.kind === 'miniboss');
    player.hp = 1_000_000;
    player.armor = 1_000_000;
    player.rapid = 999;
    player.weapon = 'blaster';
    player.weaponRank = 4;
    player.debugInput = { fire: true };
    boss.maxHp = 100_000_000;
    boss.hp = boss.kind === 'boss' ? 40_000_000 : 100_000_000;
    game.__bossPerfTimings = {};
    for (const method of ['draw', 'drawWorld', 'drawEnemy', 'drawHud', 'updatePlaying']) {
      const original = game[method].bind(game);
      const timing = game.__bossPerfTimings[method] = { calls: 0, totalMs: 0, maximumMs: 0 };
      game[method] = (...args) => {
        const started = performance.now();
        const result = original(...args);
        const duration = performance.now() - started;
        timing.calls += 1;
        timing.totalMs += duration;
        timing.maximumMs = Math.max(timing.maximumMs, duration);
        return result;
      };
    }
    return { initialBossHealth: initial.boss.maxHealth, kind: boss.kind };
  });

  const start = await page.evaluate(() => {
    const game = window.venusGame;
    const boss = game.enemies.find(enemy => enemy.kind === 'boss' || enemy.kind === 'miniboss');
    return { bossTime: boss.t, shotsFired: game.players[0].shotsFired };
  });

  const sample = await page.evaluate(duration => new Promise(resolve => {
    const game = window.venusGame;
    const frameTimes = [];
    const counts = [];
    const longTasks = [];
    let previous = performance.now();
    const started = previous;
    const observer = typeof PerformanceObserver === 'undefined' ? null : new PerformanceObserver(list => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    });
    try { observer?.observe({ type: 'longtask', buffered: true }); } catch { /* not supported */ }
    const countTimer = setInterval(() => counts.push({
      shots: game.shots.length,
      particles: game.particles.length,
      enemies: game.enemies.length,
      impacts: game.riderImpacts.length,
    }), 100);
    const tick = now => {
      frameTimes.push(now - previous);
      previous = now;
      if (now - started < duration) requestAnimationFrame(tick);
      else {
        clearInterval(countTimer);
        observer?.disconnect();
        const boss = game.enemies.find(enemy => enemy.kind === 'boss' || enemy.kind === 'miniboss');
        resolve({ frameTimes: frameTimes.slice(2), counts, longTasks, wallSeconds: (now - started) / 1000, bossTime: boss?.t ?? 0, shotsFired: game.players[0].shotsFired, timings: game.__bossPerfTimings });
      }
    };
    requestAnimationFrame(tick);
  }), sampleMs);

  await page.locator('canvas').screenshot({ path: path.join(outputDir, `${scene}.png`) });
  const deltas = sample.frameTimes;
  const maxCount = key => Math.max(0, ...sample.counts.map(item => item[key]));
  return {
    scene,
    bossKind: setup.kind,
    initialBossHealth: setup.initialBossHealth,
    frames: deltas.length,
    fps: Number((deltas.length / sample.wallSeconds).toFixed(2)),
    frameTimeMs: {
      average: Number((deltas.reduce((sum, value) => sum + value, 0) / deltas.length).toFixed(2)),
      p95: Number(percentile(deltas, .95).toFixed(2)),
      p99: Number(percentile(deltas, .99).toFixed(2)),
      maximum: Number(Math.max(...deltas).toFixed(2)),
      over25ms: deltas.filter(value => value > 25).length,
      over34ms: deltas.filter(value => value > 34).length,
    },
    simulationRate: Number(((sample.bossTime - start.bossTime) / sample.wallSeconds).toFixed(3)),
    shotsFired: sample.shotsFired - start.shotsFired,
    peakObjects: { shots: maxCount('shots'), particles: maxCount('particles'), enemies: maxCount('enemies'), impacts: maxCount('impacts') },
    longTasks: { count: sample.longTasks.length, maximumMs: Number(Math.max(0, ...sample.longTasks).toFixed(2)) },
    timings: Object.fromEntries(Object.entries(sample.timings).map(([name, timing]) => [name, {
      calls: timing.calls,
      averageMs: Number((timing.totalMs / Math.max(1, timing.calls)).toFixed(3)),
      maximumMs: Number(timing.maximumMs.toFixed(2)),
    }])),
  };
}

try {
  const scenes = [];
  for (const scene of ['miniboss', 'boss']) scenes.push(await measure(scene));
  const productionPass = cpuThrottle > 1 || scenes.every(scene =>
    scene.fps >= 55 && scene.frameTimeMs.p95 <= 20 && scene.simulationRate >= .95 && scene.peakObjects.particles <= 120
  );
  const minibossHealthPass = scenes.find(scene => scene.scene === 'miniboss')?.initialBossHealth >= 1400;
  const report = { ok: runtimeErrors.length === 0 && productionPass && minibossHealthPass, sampleMs, cpuThrottle, baseURL, scenes, acceptance: { productionPass, minibossHealthPass }, runtimeErrors };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  await browser.close();
}
