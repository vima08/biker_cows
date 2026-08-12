import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('.gauntlet/iteration-15/world-review');
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-gpu-compositing', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
  const baseUrl = process.env.BMFM_WORLD_URL ?? 'http://127.0.0.1:4195';
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__BMFM_DEBUG__));
  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('sustain', 0));
  await page.waitForTimeout(800);
  await canvasShot('ride-props-a');
  await page.waitForTimeout(480);
  await canvasShot('ride-props-b');
  await page.waitForTimeout(480);
  await canvasShot('ride-props-c');

  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('aerial'));
  await page.waitForTimeout(700);
  await canvasShot('late-section-props');
  const snapshot = await page.evaluate(() => window.__BMFM_DEBUG__.snapshot());
  const resource = await page.evaluate(() => {
    const item = performance.getEntriesByName(`${location.origin}/assets/world/roadside-props-sheet.png`)[0];
    return item ? { name: item.name, duration: item.duration, transferSize: item.transferSize } : null;
  });
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify({ ok: errors.length === 0, errors, resource, snapshot }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
