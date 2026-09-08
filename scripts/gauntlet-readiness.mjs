import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Real browser evidence for an independent whole-game review. Scene shortcuts
// select starting points; all captured motion uses the production update loop.
const base = process.env.BCFV_URL ?? 'http://127.0.0.1:4173/biker_cows/';
const output = path.resolve(process.env.BCFV_CAPTURE_DIR ?? '.gauntlet/iteration-28/readiness');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(20000);
const report = { date: '2026-09-07', ok: false, captures: [], sequences: {}, checks: {}, errors: [], externalRequests: [], limitations: ['Scene shortcuts accelerate access; this capture pass does not prove an unassisted campaign clear.', 'Headless audio checks confirm an unlocked context and sound events, not subjective sound quality.', 'Frame capture incurs encoding overhead; use the separate performance benchmark for FPS.'] };
page.on('pageerror', e => report.errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
page.on('requestfailed', r => report.errors.push(`${r.url()}: ${r.failure()?.errorText}`));
page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(base).origin) report.externalRequests.push(r.url()); });
await page.addInitScript(() => {
  window.__auditAudio = { contexts: [], sounds: 0, music: 0 };
  const Context = window.AudioContext;
  if (Context) window.AudioContext = new Proxy(Context, { construct(Target, args) {
    const context = new Target(...args); window.__auditAudio.contexts.push(context); return context;
  } });
  window.addEventListener('venus:sfx', () => window.__auditAudio.sounds++);
  window.addEventListener('venus:music', () => window.__auditAudio.music++);
});
const snapshot = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
const open = async query => {
  await page.goto(new URL(query, base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__BCFV_DEBUG__);
  await page.waitForTimeout(220);
};
const shot = async name => {
  const data = await page.locator('canvas').evaluate(c => c.toDataURL());
  await writeFile(path.join(output, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  report.captures.push(`${name}.png`);
};
const sequence = async (name, count = 10, interval = 90) => {
  // Capture in-page on animation boundaries so slow disk/Playwright screenshots
  // cannot turn an eight-frame attack into a series of unrelated poses.
  const frames = await page.evaluate(async ({ count, interval }) => {
    const result = []; const canvas = document.querySelector('canvas');
    let previous = -Infinity;
    await new Promise(resolve => {
      const tick = time => {
        if (time - previous >= interval) {
          const s = window.__BCFV_DEBUG__.snapshot();
          result.push({ data: canvas.toDataURL(), time, state: s.state, health: s.roadRash?.health ?? s.brawler?.players?.[0]?.hp ?? s.health,
            distance: s.roadRash?.distance ?? s.brawler?.cameraX ?? s.elapsed, boss: s.roadRash?.boss ?? s.brawler?.boss ?? s.boss });
          previous = time;
        }
        if (result.length === count) resolve(); else requestAnimationFrame(tick);
      }; requestAnimationFrame(tick);
    }); return result;
  }, { count, interval });
  report.sequences[name] = [];
  for (let i = 0; i < frames.length; i++) {
    const { data, ...meta } = frames[i]; const file = `${name}-${String(i).padStart(2, '0')}.png`;
    await writeFile(path.join(output, file), Buffer.from(data.split(',')[1], 'base64'));
    report.sequences[name].push({ file, ...meta });
  }
};
const hold = async (keys, ms) => { for (const key of keys) await page.keyboard.down(key); await page.waitForTimeout(ms); };
const release = async () => { for (const key of ['KeyW','KeyA','KeyS','KeyD','KeyZ','KeyX','KeyC','ArrowRight','Numpad1']) await page.keyboard.up(key); };
try {
  if (process.env.BCFV_AUDIT_ONLY === 'miniboss') {
    await open('?scene=game&hero=bruna');
    await page.evaluate(() => window.__BCFV_DEBUG__.gotoScene('miniboss'));
    await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().boss?.kind === 'miniboss');
    await hold(['KeyZ'], 2200); await sequence('07-miniboss', 16, 75); await release();
    report.ok = report.errors.length === 0;
  } else {
  await open(''); await shot('00-menu');
  await page.keyboard.press('Enter'); await page.waitForTimeout(150); await shot('01-select');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80); await shot('02-select-nova');
  report.checks.menuSelection = { state: (await snapshot()).state, hero: (await snapshot()).hero };
  await page.keyboard.press('Enter'); await page.waitForTimeout(250); await shot('03-intro');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const before = await snapshot(); await hold(['KeyD','KeyZ'], 500);
  await sequence('04-rider-movement'); await release();
  const after = await snapshot();
  report.checks.riderControls = { beforeX: before.players[0].x, afterX: after.players[0].x, shotsBefore: before.players[0].shotsFired, shotsAfter: after.players[0].shotsFired };
  await page.keyboard.press('KeyP'); await page.waitForTimeout(80); await shot('05-pause');
  const paused = await snapshot(); await page.waitForTimeout(200); const stillPaused = await snapshot();
  await page.keyboard.press('KeyP'); await page.waitForTimeout(80);
  report.checks.pause = { paused: paused.state, stableElapsed: paused.elapsed === stillPaused.elapsed, resumed: (await snapshot()).state };
  report.checks.audio = await page.evaluate(() => ({ contexts: window.__auditAudio.contexts.map(c => c.state), sounds: window.__auditAudio.sounds, music: window.__auditAudio.music }));

  await open('?scene=game&time=105&hero=cassia'); await hold(['KeyZ'], 2500); await sequence('06-rider-combat', 12); await release();
  await open('?scene=game&hero=bruna'); await page.evaluate(() => window.__BCFV_DEBUG__.gotoScene('miniboss'));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().boss?.kind === 'miniboss');
  await hold(['KeyZ'], 2200); await sequence('07-miniboss', 12); await release();
  await open('?scene=road-rash&hero=cassia'); await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().roadRash?.status === 'racing');
  await hold(['KeyW'], 1400); await sequence('08-road-motion', 24, 95); await release();
  await open('?scene=road-rash-combat&hero=nova'); await sequence('09-road-combat', 12, 70);
  await open('?scene=road-rash-boss&hero=bruna');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().roadRash?.boss?.attacking, undefined, { timeout: 15000 });
  await sequence('10-road-king', 16, 60);
  for (const hero of ['cassia','bruna','nova']) {
    await open(`?scene=brawler-walk&hero=${hero}`); await sequence(`11-walk-${hero}`, 8, 100);
  }
  await open('?scene=brawler&hero=cassia'); await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler?.status === 'running');
  await hold(['KeyD'], 2250); await page.keyboard.down('KeyZ'); await sequence('12-brawler-combat', 12, 80); await release();
  await open('?scene=brawler-boss&hero=bruna'); await hold(['KeyD','KeyZ'], 1600); await page.keyboard.press('KeyX'); await sequence('13-forge-boss', 14, 85); await release();
  await open('?scene=coop&hero=cassia'); await hold(['KeyZ','Numpad1'], 1400); await sequence('14-coop', 8); await release();
  await open('?scene=rider-act-3&time=70&hero=nova'); await hold(['KeyZ'], 1800); await sequence('15-final-run', 10); await release();
  await open('?scene=boss&hero=bruna'); await hold(['KeyZ'], 2500); await sequence('16-final-boss', 14, 85); await release();
  await page.evaluate(() => window.__BCFV_DEBUG__.completeAct());
  await page.waitForFunction(() => ['win','outro'].includes(window.__BCFV_DEBUG__.snapshot().state));
  await shot('17-victory');
  await open('?scene=outro&panel=0'); await shot('18-outro-parade');
  await open('?scene=outro&panel=1'); await shot('19-outro-fireworks');
  await open('?scene=game&hero=cassia'); await page.evaluate(() => window.__BCFV_DEBUG__.damagePlayer(1,99999));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'continue'); await shot('20-continue');
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  report.checks.continue = { resumed: (await snapshot()).state, health: (await snapshot()).health };
  // Fresh-cache offline gameplay: preload a scene, block the network, keep playing.
  await open('?scene=road-rash-combat&hero=cassia');
  await page.context().setOffline(true); const offlineBefore = await snapshot(); await page.waitForTimeout(1200); const offlineAfter = await snapshot();
  report.checks.offline = { state: offlineAfter.state, advances: offlineAfter.roadRash.distance > offlineBefore.roadRash.distance };
  await page.context().setOffline(false);
  report.ok = report.errors.length === 0 && report.externalRequests.length === 0 && report.checks.offline.advances;
  }
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const groups = Object.entries(report.sequences).map(([name,frames]) => `<section><h2>${name}</h2><img class="sequence" data-frames='${JSON.stringify(frames.map(f=>f.file))}' src="${frames[0]?.file}"/><p>${frames.length} consecutive production frames</p></section>`).join('');
  await writeFile(path.join(output,'index.html'), `<!doctype html><meta charset="utf-8"><title>Whole-game review · 2026-09-07</title><style>body{background:#14101e;color:#eee;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:20px}img{width:100%;image-rendering:pixelated}h1{color:#ffd977}button{padding:10px}</style><h1>Actual gameplay captures · iteration 28</h1><button id="toggle">Pause motion</button><main>${report.captures.map(f=>`<section><h2>${f}</h2><img src="${f}"></section>`).join('')}${groups}</main><script>let play=true;document.querySelector('#toggle').onclick=()=>play=!play;setInterval(()=>{if(!play)return;document.querySelectorAll('.sequence').forEach(e=>{const f=JSON.parse(e.dataset.frames);e.dataset.i=((Number(e.dataset.i)||0)+1)%f.length;e.src=f[e.dataset.i]})},100)</script>`);
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks, errors: report.errors, externalRequests: report.externalRequests, sequences: Object.keys(report.sequences), error: report.error },null,2));
  await browser.close();
}
