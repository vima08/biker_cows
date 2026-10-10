import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = 'http://127.0.0.1:4185/biker_cows/';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', '4185', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const state = () => page.evaluate(() => window.venusGame.snapshot());
  const waitView = view => page.waitForFunction(view => window.venusGame.snapshot().journal?.open && window.venusGame.snapshot().journal.view === view, view);
  const press = name => page.locator('.mission-journal').getByRole('button', { name, exact: true }).click();
  await mkdir('.gauntlet/missions', { recursive: true });

  // Enter through the real campaign menu. Escape skips only the beach intro.
  await page.goto(`${base}?art=vector`);
  await page.waitForFunction(() => window.venusGame?.snapshot().state === 'title' && !window.venusGame.snapshot().loading);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'select');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'intro');
  await page.keyboard.press('Escape');
  await waitView('briefing');
  assert.equal((await state()).journal.segment, 0);
  assert(await page.locator('.mission-journal .world-map-marker').isVisible());
  assert(await page.locator('.tablet-controls').isHidden());
  const frozen = (await state()).campaign.rider.elapsed;
  await page.waitForTimeout(180);
  assert.equal((await state()).campaign.rider.elapsed, frozen, 'Briefing must freeze gameplay');
  await press('О героине'); await waitView('dossier');
  assert((await page.locator('.mission-dossier').innerText()).includes('Биография'));
  await press('Назад'); await waitView('briefing');
  await page.screenshot({ path: '.gauntlet/missions/briefing.png' });
  await press('Начать миссию');
  await page.waitForFunction(() => !window.venusGame.snapshot().journal.open);
  await page.waitForTimeout(100);
  assert((await state()).campaign.rider.elapsed > frozen);
  await page.keyboard.press('KeyM'); await waitView('map');
  const mapElapsed = (await state()).campaign.rider.elapsed;
  await page.waitForTimeout(100);
  assert.equal((await state()).campaign.rider.elapsed, mapElapsed);
  await press('Вернуться в игру');

  for (let segment = 0; segment < 4; segment++) {
    await page.evaluate(() => window.venusGame.debugCompleteCurrentAct());
    await waitView('victory');
    assert.equal((await state()).journal.segment, segment);
    const oldScore = (await state()).score;
    await press('Прочитать биографию босса'); await waitView('dossier');
    const body = await page.locator('.mission-dossier').innerText();
    assert(body.includes('После победы'), `Boss ${segment} must show its actual archive biography`);
    const pausedState = await state();
    await page.waitForTimeout(150);
    assert.equal((await state()).score, oldScore, 'Reading cannot advance or double-commit score');
    assert.equal((await state()).roadRash?.elapsed, pausedState.roadRash?.elapsed);
    if (segment === 1) await page.screenshot({ path: '.gauntlet/missions/boss-dossier.png' });
    await press('Назад'); await waitView('victory');
    await press(segment === 3 ? 'К эпилогу' : 'Продолжить маршрут');
    if (segment < 3) {
      await waitView('briefing');
      assert.equal((await state()).journal.segment, segment + 1);
      await press('Начать миссию');
      await page.waitForFunction(() => !window.venusGame.snapshot().journal.open && !window.venusGame.snapshot().loading);
    }
  }
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'outro');
  assert.deepEqual((await state()).journal.defeated, [0,1,2,3]);
  assert.deepEqual((await state()).journal.read, [0,1,2,3]);

  // Reading is optional, and the archive remains accessible from the pause map.
  await page.goto(`${base}?scene=road-rash-boss&story=1&art=vector`);
  await waitView('briefing'); await press('Начать миссию');
  await page.evaluate(() => window.venusGame.debugCompleteCurrentAct());
  await waitView('victory'); await press('Продолжить маршрут');
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'win');
  assert.deepEqual((await state()).journal.read, [], 'Continue must allow skipping biography');
  await page.goto(`${base}?scene=game&art=vector`);
  await page.waitForFunction(() => window.venusGame?.snapshot().state === 'playing');
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'paused');
  await page.keyboard.press('KeyM'); await waitView('map');
  await press('Вернуться в игру');
  assert.equal((await state()).state, 'paused', 'Closing the map must preserve the existing pause');

  // Extras uses the same clipped map viewer. Fullscreen Escape returns to Extras.
  await page.goto(`${base}?art=vector`);
  await page.waitForFunction(() => window.venusGame?.snapshot().state === 'title' && !window.venusGame.snapshot().loading);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.locator('.extras-tabs').getByRole('button', { name: 'Карта мира', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.extras-map-viewport img')?.naturalWidth > 0);
  await page.getByRole('button', { name: 'Увеличить карту', exact: true }).click();
  assert.equal(await page.locator('.world-map').getAttribute('data-zoom'), '1.5');
  assert(await page.locator('.extras-map-viewport').evaluate(node => getComputedStyle(node).overflow === 'hidden'));
  await page.getByRole('button', { name: 'На весь экран', exact: true }).click();
  const viewport = await page.locator('.world-map.is-fullscreen').boundingBox();
  assert(viewport.width >= 1178 && viewport.height >= 818, 'Expanded map must fill the screen');
  await page.getByRole('button', { name: 'Увеличить карту', exact: true }).click();
  const beforePan = Number(await page.locator('.world-map').getAttribute('data-pan-x'));
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(150); await page.keyboard.up('ArrowRight');
  assert(Number(await page.locator('.world-map').getAttribute('data-pan-x')) < beforePan, 'Arrows must pan the map');
  assert.equal((await state()).state, 'extras', 'Map arrows cannot switch archive sections');
  const bounds = await page.locator('.extras-map-viewport').boundingBox();
  const beforeDrag = Number(await page.locator('.world-map').getAttribute('data-pan-y'));
  await page.mouse.move(bounds.x + 300, bounds.y + 200); await page.mouse.down();
  await page.mouse.move(bounds.x + 350, bounds.y + 250, { steps: 4 }); await page.mouse.up();
  assert(Number(await page.locator('.world-map').getAttribute('data-pan-y')) > beforeDrag, 'Dragging must pan the map');
  await page.getByRole('button', { name: 'Вписать', exact: true }).click();
  assert.equal(await page.locator('.world-map').getAttribute('data-zoom'), '1');
  assert.equal(await page.locator('.world-map').getAttribute('data-pan-x'), '0');
  // Two active touch pointers zoom the clipped viewport without browser scrolling.
  await page.locator('.extras-map-viewport').evaluate(node => {
    node.setPointerCapture = () => {};
    const bounds = node.getBoundingClientRect(), x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
    const send = (type, id, px) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', button: 0, clientX: px, clientY: y }));
    send('pointerdown', 51, x - 70); send('pointerdown', 52, x + 70);
    send('pointermove', 52, x + 140); send('pointerup', 51, x - 70); send('pointerup', 52, x + 140);
  });
  assert(Number(await page.locator('.world-map').getAttribute('data-zoom')) > 1.4, 'Pinch must zoom the map');
  await page.screenshot({ path: '.gauntlet/missions/extras-map-fullscreen.png' });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.world-map.is-fullscreen'));
  assert.equal(await page.locator('.world-map.is-fullscreen').count(), 0);
  assert.equal((await state()).state, 'extras');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'title');
  assert.deepEqual(errors, []);
  console.log('Missions: real campaign entry, four briefings, four optional boss dossiers, frozen gameplay, route markers, epilogue, fullscreen map, keyboard pan and drag passed.');
} finally { await browser?.close(); server.kill(); }
