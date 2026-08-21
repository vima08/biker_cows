import { chromium } from 'playwright-core';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('requestfailed', request => errors.push(`request: ${request.url()} (${request.failure()?.errorText})`));

try {
  await page.goto(`${baseURL}/?scene=game&hero=cassia`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().state === 'playing');
  const before = await page.evaluate(() => window.__BCFV_DEBUG__.damagePlayer(1, 9999));
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'lose');
  const samples = [];
  for (let index = 0; index < 8; index++) {
    await page.waitForTimeout(45);
    const state = await page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
    samples.push({ state: state.state, feedback: state.cameraFeedback });
  }
  if (samples.some(sample => sample.state !== 'lose' || sample.feedback.shake !== 0 || sample.feedback.flash !== 0)) {
    throw new Error(`Defeat feedback was not stable: ${JSON.stringify(samples)}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ ok: true, before: before.cameraFeedback, samples, errors }, null, 2));
} finally {
  await browser.close();
}
