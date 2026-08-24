import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4174/biker_cows';
const outputDir = path.resolve('.gauntlet/iteration-27/combo');
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto(`${baseURL}/?scene=brawler&hero=cassia`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().brawler?.status === 'running');
  const contacts = [];
  for (let step = 0; step < 3; step++) {
    await page.keyboard.press('KeyZ');
    await page.waitForFunction(expected => {
      const player = window.__BCFV_DEBUG__.snapshot().brawler.players[0];
      return player.attackStep === expected && player.attackPhase === 'contact';
    }, step);
    const player = await page.evaluate(() => window.__BCFV_DEBUG__.snapshot().brawler.players[0]);
    contacts.push({ step: player.attackStep, frame: player.frame, phase: player.attackPhase, duration: player.attackTimer });
    const dataURL = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
    await writeFile(path.join(outputDir, `contact-${step + 1}-frame-${player.frame}.png`), Buffer.from(dataURL.split(',')[1], 'base64'));
    await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler.players[0].attackTimer <= 0);
    await page.waitForTimeout(90);
  }
  const frames = contacts.map(contact => contact.frame);
  if (JSON.stringify(frames) !== JSON.stringify([3, 4, 5])) throw new Error(`Expected contact frames 3,4,5; got ${frames}`);
  if (errors.length) throw new Error(errors.join('\n'));
  const report = { ok: true, contacts, errors };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
