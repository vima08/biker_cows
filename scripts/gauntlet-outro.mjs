import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4174/biker_cows';
const outputDir = path.resolve('.gauntlet/iteration-28/outro');
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('requestfailed', request => errors.push(`request: ${request.url()} (${request.failure()?.errorText})`));
const state = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
const shot = async name => {
  const dataURL = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataURL.split(',')[1], 'base64'));
};

try {
  await page.goto(`${baseURL}/?scene=rider-act-3&time=160&hero=cassia`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().boss?.kind === 'boss');
  await page.evaluate(() => window.__BCFV_DEBUG__.completeAct());
  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    return snapshot.state === 'outro' && snapshot.outro?.panel === 0 && snapshot.outro.assetReady;
  }, undefined, { timeout: 20_000 });
  const parade = await state();
  await page.waitForTimeout(650);
  await shot('01-parade');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const snapshot = window.__BCFV_DEBUG__.snapshot();
    return snapshot.state === 'outro' && snapshot.outro?.panel === 1 && snapshot.outro.assetReady;
  });
  const fireworks = await state();
  await page.waitForTimeout(650);
  await shot('02-fireworks');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'win');
  const win = await state();
  if (parade.outro.total !== 2 || fireworks.outro.total !== 2) throw new Error('Outro does not expose exactly two panels');
  if (!win.campaign.history.includes('campaign-win')) throw new Error('Campaign history lost campaign-win after outro');
  if (errors.length) throw new Error(errors.join('\n'));
  const report = { ok: true, route: ['final-boss', 'outro-parade', 'outro-fireworks', 'win'], parade: parade.outro, fireworks: fireworks.outro, history: win.campaign.history, errors };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
