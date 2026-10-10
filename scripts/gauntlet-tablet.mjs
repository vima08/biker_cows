import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
const url = 'http://127.0.0.1:4176/biker_cows/';
let browser;
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  browser = await chromium.launch({ executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const snapshot = () => page.evaluate(() => window.venusGame.snapshot());
  const goto = async scene => {
    await page.goto(`${url}?scene=${scene}&art=vector`);
    await page.waitForFunction(() => window.venusGame && !window.venusGame.snapshot().loading);
    await page.waitForTimeout(150);
  };
  const pointer = async (key, type, pointerId) => {
    if (key === 'KeyA' || key === 'KeyD') {
      await stick(type, pointerId, key === 'KeyD' ? 1 : -1);
      return;
    }
    await page.locator(`.tablet-controls button[data-keys="${key}"]`).evaluate((button, args) => {
      // Synthetic pointer IDs have no active browser pointer capture.
      button.setPointerCapture = () => {};
      button.dispatchEvent(new PointerEvent(args.type, { bubbles: true, pointerId: args.pointerId, pointerType: 'touch', button: 0 }));
    }, { type, pointerId });
  };
  const stick = async (type, pointerId, x = 0, y = 0) => {
    await page.locator('.tablet-stick').evaluate((node, args) => {
      node.setPointerCapture = () => {};
      const bounds = node.getBoundingClientRect();
      node.dispatchEvent(new PointerEvent(args.type, { bubbles: true, pointerId: args.pointerId,
        pointerType: 'touch', button: 0, clientX: bounds.left + bounds.width * (.5 + args.x * .32),
        clientY: bounds.top + bounds.height * (.5 + args.y * .32) }));
    }, { type, pointerId, x, y });
  };
  await goto('select');
  const first = (await snapshot()).hero;
  await stick('pointerdown', 1, 1);
  await page.waitForTimeout(100);
  await stick('pointerup', 1);
  await page.waitForTimeout(100);
  assert.notEqual((await snapshot()).hero, first, 'Touch selection must change the heroine');

  await goto('game');
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'playing');
  const before = (await snapshot()).players[0];
  await pointer('KeyD', 'pointerdown', 11);
  await pointer('KeyZ', 'pointerdown', 12);
  await page.waitForTimeout(350);
  const moving = (await snapshot()).players[0];
  assert(moving.x > before.x + 10, 'Move and fire must work simultaneously');
  assert(moving.shotsFired > before.shotsFired, 'Holding fire must produce shots');
  await pointer('KeyD', 'pointercancel', 11);
  await page.waitForTimeout(100);
  const released = (await snapshot()).players[0];
  await page.waitForTimeout(120);
  assert.equal((await snapshot()).players[0].x, released.x, 'Cancelled pointer must stop movement');
  assert((await snapshot()).players[0].fireHeld, 'Cancelling movement must preserve the other finger');
  const shotsBeforeJump = (await snapshot()).players[0].shotsFired;
  await pointer('KeyX', 'pointerdown', 13);
  await page.waitForTimeout(160);
  const firingJump = (await snapshot()).players[0];
  assert(firingJump.y < firingJump.groundY - 10, 'Touch jump must lift the rider while firing');
  assert(firingJump.fireHeld && firingJump.shotsFired > shotsBeforeJump, 'Jump must preserve sustained fire');
  await pointer('KeyX', 'pointerup', 13);
  await pointer('KeyZ', 'pointerup', 12);
  const stickBounds = await page.locator('.tablet-stick').boundingBox();
  const jumpBounds = await page.locator('.tablet-movement button[data-keys="KeyX"]').boundingBox();
  assert(jumpBounds.y + jumpBounds.height < stickBounds.y, 'Jump must sit above the stick on the left');
  assert.equal(await page.locator('.tablet-actions button[data-keys="KeyX"]').count(), 0);
  await page.locator('#game').tap({ position: { x: 500, y: 250 } });
  await page.locator('#game').click({ position: { x: 520, y: 260 } });
  await page.waitForTimeout(80);
  assert.equal((await snapshot()).state, 'playing', 'Touch and mouse taps on the playfield must never pause');
  // A small stick displacement must move more slowly than a full displacement.
  await stick('pointerdown', 14, -.4);
  const slowStart = (await snapshot()).players[0].x;
  await page.waitForTimeout(120);
  const slowDistance = slowStart - (await snapshot()).players[0].x;
  await stick('pointermove', 14, -1);
  const fastStart = (await snapshot()).players[0].x;
  await page.waitForTimeout(120);
  const fastDistance = fastStart - (await snapshot()).players[0].x;
  assert(slowDistance > 0 && fastDistance > slowDistance * 1.5, 'Stick displacement must control movement speed');
  await stick('pointermove', 14, .05, .05);
  const deadZoneX = (await snapshot()).players[0].x;
  await page.waitForTimeout(90);
  assert.equal((await snapshot()).players[0].x, deadZoneX, 'Stick center must have a dead zone');
  await stick('lostpointercapture', 14);
  await stick('pointerdown', 15, -.7, -.7);
  const diagonalStart = (await snapshot()).players[0];
  await page.waitForTimeout(100);
  const diagonalEnd = (await snapshot()).players[0];
  assert(diagonalEnd.x < diagonalStart.x && diagonalEnd.groundY < diagonalStart.groundY, 'Stick must support diagonal movement');
  await stick('pointerup', 15);
  await page.locator('.tablet-controls button[data-keys="KeyP"]').tap();
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'paused');
  await page.locator('#game').tap({ position: { x: 500, y: 250 } });
  await page.waitForTimeout(50);
  assert.equal((await snapshot()).state, 'paused', 'Playfield taps must not accidentally resume');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).tap();
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'playing');
  await mkdir('.gauntlet/tablet', { recursive: true });
  await page.screenshot({ path: path.resolve('.gauntlet/tablet/rider-stick.png') });

  await goto('brawler');
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'brawler');
  await page.waitForFunction(() => window.venusGame.snapshot().brawler.status === 'running');
  await page.locator('#game').tap({ position: { x: 500, y: 250 } });
  await page.waitForTimeout(50);
  assert.equal((await snapshot()).state, 'brawler', 'Brawler playfield taps must not pause');
  assert.equal(await page.getByRole('button', { name: 'Удар', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Прыжок', exact: true }).count(), 1);
  const brawlerBefore = (await snapshot()).brawler.players[0];
  await pointer('KeyD', 'pointerdown', 21);
  await pointer('KeyX', 'pointerdown', 22);
  await page.waitForTimeout(120);
  const jumping = (await snapshot()).brawler.players[0];
  assert(jumping.x > brawlerBefore.x, 'Brawler touch movement must move the player');
  assert(jumping.z > 0, 'Brawler jump button must lift the player');
  await pointer('KeyD', 'pointerup', 21);
  await pointer('KeyX', 'pointerup', 22);

  await goto('road-rash-combat');
  await page.locator('#game').tap({ position: { x: 500, y: 250 } });
  await page.waitForTimeout(50);
  assert.equal((await snapshot()).state, 'road-rash', 'Road Rash playfield taps must not pause');
  assert.equal(await page.getByRole('button', { name: 'Прыжок', exact: true }).count(), 0);
  await page.evaluate(() => Object.defineProperty(screen.orientation, 'angle', { configurable: true, value: 90 }));
  await page.getByRole('button', { name: 'Включить наклоны', exact: true }).tap();
  await page.waitForFunction(() => document.querySelector('[aria-pressed="true"]'));
  const tilt = beta => page.evaluate(value => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: value, gamma: 0 })), beta);
  await tilt(0);
  const initialLane = (await snapshot()).roadRash.lane;
  for (let i = 0; i < 12; i++) { await tilt(24); await page.waitForTimeout(25); }
  const rightLane = (await snapshot()).roadRash.lane;
  assert(rightLane > initialLane + .08, 'Landscape tilt must steer right');
  for (let i = 0; i < 12; i++) { await tilt(-24); await page.waitForTimeout(25); }
  assert((await snapshot()).roadRash.lane < rightLane - .08, 'Opposite tilt must steer left');
  await page.getByRole('button', { name: 'Центр руля', exact: true }).tap();
  await tilt(-24);
  const centered = (await snapshot()).roadRash.lane;
  await page.waitForTimeout(100);
  assert(Math.abs((await snapshot()).roadRash.lane - centered) < .015, 'Recalibration must restore neutral steering');
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(100);
  assert(await page.locator('.tablet-rotate').isVisible(), 'Portrait must show rotation guard');
  const frozen = (await snapshot()).roadRash.elapsed;
  await page.waitForTimeout(150);
  assert.equal((await snapshot()).roadRash.elapsed, frozen, 'Portrait must freeze gameplay');
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.waitForTimeout(100);
  assert((await snapshot()).roadRash.elapsed > frozen, 'Landscape must resume gameplay');
  await mkdir('.gauntlet/tablet', { recursive: true });
  await page.screenshot({ path: path.resolve('.gauntlet/tablet/road-rash.png') });

  // Opposite landscape orientation must reverse the sensor axis.
  await page.evaluate(() => Object.defineProperty(screen.orientation, 'angle', { configurable: true, value: 270 }));
  await page.getByRole('button', { name: 'Центр руля', exact: true }).tap();
  await tilt(0);
  const flippedLane = (await snapshot()).roadRash.lane;
  for (let i = 0; i < 12; i++) { await tilt(24); await page.waitForTimeout(25); }
  assert((await snapshot()).roadRash.lane < flippedLane - .08, 'Flipped landscape must reverse tilt axis');
  await page.getByRole('button', { name: 'Наклоны: вкл', exact: true }).tap();
  await pointer('KeyA', 'pointerdown', 31);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(50);
  const afterBlur = (await snapshot()).roadRash.lane;
  await page.waitForTimeout(100);
  assert.equal((await snapshot()).roadRash.lane, afterBlur, 'Blur must release held controls');

  // Permission rejection must leave a fully usable button panel.
  await page.evaluate(() => Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { configurable: true, value: async () => 'denied' }));
  await page.getByRole('button', { name: 'Включить наклоны', exact: true }).tap();
  await page.waitForFunction(() => document.querySelector('.tablet-sensor-status')?.textContent.includes('недоступны'));
  const fallbackLane = (await snapshot()).roadRash.lane;
  await pointer('KeyD', 'pointerdown', 41);
  await page.waitForTimeout(160);
  await pointer('KeyD', 'pointerup', 41);
  assert((await snapshot()).roadRash.lane > fallbackLane, 'Denied sensors must preserve button steering');

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await desktop.goto(url);
  await desktop.waitForFunction(() => window.venusGame);
  assert(await desktop.locator('.tablet-controls').isHidden(), 'Desktop must keep its existing controls');
  assert.deepEqual(errors, []);
  console.log('Tablet controls: selection, multitouch, cancellation, pause, stage panels, tilt, calibration, orientation, blur and desktop checks passed.');
} finally {
  await browser?.close();
  server.kill();
}
