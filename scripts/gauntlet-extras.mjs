import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.env.BCFV_URL ?? 'http://127.0.0.1:4182/biker_cows/';
let preview, browser;
const errors = [];
try {
  let ready = false;
  try { ready = (await fetch(base)).ok; } catch {}
  if (!ready) {
    const url = new URL(base);
    preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--configLoader', 'runner', '--host', url.hostname, '--port', url.port, '--strictPort'], { windowsHide: true, stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
      try { ready = (await fetch(base)).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert(ready, 'Preview is available');
  browser = await chromium.launch({ executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => window.__BCFV_DEBUG__?.snapshot().state === 'title');
  await page.evaluate(() => localStorage.setItem('venus-stampede-highscores', '[{"name":"TEST","score":12345}]'));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => window.__BCFV_DEBUG__.snapshot().state), 'extras');
  for (const name of ['Cassia — Кассия', 'Bruna — Бруна', 'Nova — Нова']) {
    await page.locator('.extras-list').getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.extras-portrait figcaption')?.textContent !== 'Загрузка портрета…');
    assert(!(await page.locator('.extras-portrait').innerText()).includes('не загрузился'));
    assert((await page.locator('.extras-reader').innerText()).includes('Биография.'));
  }
  await page.getByRole('button', { name: 'Боссы', exact: true }).click();
  assert.equal(await page.locator('.extras-list button').count(), 4);
  await page.locator('.extras-list button').nth(1).click();
  await page.waitForFunction(() => document.querySelector('.extras-portrait figcaption')?.textContent === 'Road King');
  await page.getByRole('button', { name: 'Рядовые враги', exact: true }).click();
  assert.equal(await page.locator('.extras-list button').count(), 11);
  await page.getByRole('button', { name: 'Карта мира', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.extras-map-viewport img')?.naturalWidth > 0);
  await page.getByRole('button', { name: 'Увеличить карту' }).click();
  assert((await page.locator('.extras-map-tools').innerText()).includes('150%'));
  await page.getByRole('button', { name: 'Вписать', exact: true }).click();
  assert((await page.locator('.extras-map-tools').innerText()).includes('100%'));
  await page.getByRole('button', { name: 'История мира', exact: true }).click();
  await page.locator('.extras-list').getByRole('button', { name: 'Предыстория', exact: true }).click();
  assert((await page.locator('.extras-reader').innerText()).includes('День переворота'));
  await page.getByRole('button', { name: 'Сюжет игры', exact: true }).click();
  await page.locator('.extras-list').getByRole('button', { name: 'Акт III — последний рывок', exact: true }).click();
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.querySelector('.extras-reader').scrollTop > 0);
  await mkdir('.gauntlet/extras', { recursive: true });
  await page.getByRole('button', { name: 'Героини', exact: true }).click();
  await page.screenshot({ path: '.gauntlet/extras/heroines.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.locator('.extras-reader').evaluate(node => node.clientHeight > 200));
  assert(await page.locator('.extras').evaluate(node => node.scrollWidth <= node.clientWidth));
  await page.screenshot({ path: '.gauntlet/extras/mobile.png' });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => window.__BCFV_DEBUG__.snapshot().state), 'title');
  assert.equal(await page.evaluate(() => localStorage.getItem('venus-stampede-highscores')), '[{"name":"TEST","score":12345}]');
  await page.setViewportSize({ width: 1280, height: 800 });
  const bounds = await page.locator('#game').boundingBox();
  await page.mouse.click(bounds.x + bounds.width * 240 / 960, bounds.y + bounds.height * 435 / 540);
  await dialog.waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '← В меню · Esc', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  // Return preserves the Extras selection. Up must select Play, not Clear records.
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().state === 'select');
  assert.deepEqual(errors, []);
  console.log('Extras: portraits, bosses, enemies, map zoom, lore, story, scrolling, mobile layout, return, record preservation and Play passed.');
} finally { await browser?.close(); preview?.kill(); }
