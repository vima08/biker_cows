import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const out = new URL('./', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.goto('http://127.0.0.1:4176', { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__BMFM_DEBUG__));
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
for (const name of ['throttle', 'modo', 'vinnie']) {
  const hero = await page.evaluate(() => window.__BMFM_DEBUG__.snapshot().hero);
  if (hero !== name) throw new Error(`expected ${name}, received ${hero}`);
  await page.screenshot({ path: `${out}select-${name}.png` });
  if (name !== 'vinnie') await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
}
if (errors.length) throw new Error(errors.join('\n'));
await browser.close();
console.log('captured throttle, modo, vinnie with zero runtime errors');
