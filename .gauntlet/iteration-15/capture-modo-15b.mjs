import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('.gauntlet/iteration-15');
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-gpu-compositing', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache', Pragma: 'no-cache' });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('requestfailed', request => errors.push(`request: ${request.url()} (${request.failure()?.errorText})`));

const canvasShot = async name => {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Gameplay canvas missing');
    return canvas.toDataURL('image/png');
  });
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
};

try {
  const baseUrl = process.env.BMFM_MODO_URL ?? 'http://127.0.0.1:4173';
  await page.goto(`${baseUrl}/?modo15b=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__BMFM_DEBUG__));
  await page.evaluate(() => window.redlineGame.debugStart('modo'));
  await page.waitForTimeout(450);
  await canvasShot('modo-15b-runtime-base');

  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('sustain'));
  for (let index = 0; index < 4; index++) {
    await page.waitForTimeout(130);
    await canvasShot(`modo-15b-runtime-sustain-${index}`);
  }

  await page.evaluate(() => window.__BMFM_DEBUG__.setDebugFireHeld(false));
  for (const [index, delay] of [20, 45, 65].entries()) {
    await page.waitForTimeout(delay);
    await canvasShot(`modo-15b-runtime-release-${index}`);
  }

  const snapshot = await page.evaluate(() => window.__BMFM_DEBUG__.snapshot());
  const atlas = snapshot.atlas.modo;
  const report = { ok: errors.length === 0 && snapshot.hero === 'modo' && atlas?.state === 'ready', errors, atlas, snapshot };
  await writeFile(path.join(outputDir, 'modo-15b-runtime-report.json'), JSON.stringify(report, null, 2));
  if (!report.ok) throw new Error(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
