import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = 'http://127.0.0.1:4186/biker_cows/';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', '4186', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const state = () => page.evaluate(() => window.venusGame.snapshot());
  const waitDialogue = () => page.waitForFunction(() => window.venusGame?.snapshot().dialogue);
  const nextLine = async () => {
    const remaining = (await state()).dialogue.linesLeft - 1;
    await page.keyboard.press('Enter');
    await page.waitForFunction(remaining => (window.venusGame.snapshot().dialogue?.linesLeft ?? 0) === remaining, remaining);
  };
  const view = name => page.waitForFunction(name => window.venusGame?.snapshot().journal.view === name && window.venusGame.snapshot().journal.open, name);
  const button = name => page.locator('.mission-journal').getByRole('button', { name, exact: true }).click();
  await mkdir('.gauntlet/boss-dialogue', { recursive: true });

  // A new roster must reach the actual runtime, without resetting campaign state.
  await page.goto(`${base}?art=vector`);
  await page.waitForFunction(() => window.venusGame?.snapshot().state === 'title');
  await page.evaluate(() => window.venusGame.setCoop(true));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'select');
  await page.keyboard.press('KeyZ'); await page.keyboard.press('Slash');
  await page.waitForFunction(() => window.venusGame.snapshot().state === 'intro');
  await page.keyboard.press('Escape'); await view('briefing');
  const choose = (player, hero) => page.getByRole('group', { name: `Героиня P${player}` }).getByRole('button', { name: hero.toUpperCase(), exact: true }).click();
  const initial = await state();
  await choose(1, 'Nova'); await choose(2, 'Cassia');
  let current = await state();
  assert.deepEqual(current.players.map(player => player.hero), ['nova', 'cassia']);
  assert.deepEqual(current.players.map(player => player.weapon), initial.players.map(player => player.weapon));
  assert.equal(current.score, initial.score);
  assert.deepEqual(current.campaign.history, initial.campaign.history);
  await page.screenshot({ path: '.gauntlet/boss-dialogue/roster.png' });
  await button('Начать миссию');
  await page.evaluate(() => window.venusGame.debugCompleteCurrentAct()); await view('victory');
  await button('Продолжить маршрут'); await view('briefing');
  await choose(1, 'Bruna'); await choose(2, 'Nova');
  current = await state();
  assert.deepEqual(current.roadRash.players.map(player => player.hero), ['bruna', 'nova']);
  await button('Начать миссию');
  await page.evaluate(() => window.venusGame.debugCompleteCurrentAct()); await view('victory');
  await button('Продолжить маршрут'); await view('briefing');
  await choose(1, 'Cassia'); await choose(2, 'Bruna');
  current = await state();
  assert.deepEqual(current.brawler.players.map(player => player.hero), ['cassia', 'bruna']);
  await button('Начать миссию');
  await page.evaluate(() => window.venusGame.debugCompleteCurrentAct()); await view('victory');
  await button('Продолжить маршрут'); await view('briefing');
  const beforeFinal = await state();
  await choose(1, 'Nova'); current = await state();
  assert.deepEqual(current.players.map(player => player.hero), ['nova', 'bruna']);
  assert.equal(current.score, beforeFinal.score);
  assert.deepEqual(current.campaign.history, beforeFinal.campaign.history);
  assert.deepEqual(current.players.map(player => player.weapon), beforeFinal.players.map(player => player.weapon));
  await button('Начать миссию');
  await page.waitForFunction(() => window.venusGame.snapshot().campaign.rider.elapsed > .1);
  await page.keyboard.press('KeyM'); await view('map'); await button('Задача миссии');
  assert.equal(await page.locator('.mission-roster').count(), 0, 'Cannot change heroes mid-level');

  await page.goto(`${base}?scene=game&story=1&art=vector`); await view('briefing');
  assert.equal(await page.locator('.mission-hero-options').count(), 1, 'Solo briefing has one player');
  await choose(1, 'Bruna'); assert.equal((await state()).players[0].hero, 'bruna');
  await button('О героине'); await view('dossier');
  assert((await page.locator('.mission-card h1').innerText()).includes('Bruna'), 'Dossier follows the new heroine');

  for (const [scene, hero, speaker, reply] of [
    ['miniboss', 'cassia', 'Magma Mauler Mk.IV', 'Cassia'],
    ['miniboss', 'nova', 'Magma Mauler Mk.IV', null],
    ['road-rash-boss', 'nova', 'Road King', null],
    ['brawler-boss', 'bruna', 'The Forge Overseer', 'Bruna'],
    ['brawler-boss', 'cassia', 'The Forge Overseer', null],
    ['brawler-coop-boss', 'cassia', 'The Forge Overseer', 'Bruna'],
    ['boss', 'cassia', 'Sulfur Tyrant', 'Cassia'],
  ]) {
    await page.goto(`${base}?scene=${scene}&hero=${hero}&art=vector`); await waitDialogue();
    current = await state(); assert.equal(current.dialogue.speaker, speaker);
    const elapsed = current.brawler?.elapsed ?? current.roadRash?.elapsed ?? current.campaign.rider.elapsed;
    await page.waitForTimeout(180); current = await state();
    assert.equal(current.brawler?.elapsed ?? current.roadRash?.elapsed ?? current.campaign.rider.elapsed, elapsed, 'Dialogue freezes combat');
    await page.screenshot({ path: `.gauntlet/boss-dialogue/${scene}-${hero}.png` });
    await nextLine();
    if (scene === 'boss') { await waitDialogue(); assert.equal((await state()).dialogue.speaker, speaker); await nextLine(); }
    if (reply) { await waitDialogue(); assert.equal((await state()).dialogue.speaker, reply); await nextLine(); }
    await page.waitForFunction(() => !window.venusGame.snapshot().dialogue);
    await page.waitForTimeout(150); assert.equal((await state()).dialogue, null, 'Exchange must not repeat');
  }
  // Each line also expires without input.
  await page.goto(`${base}?scene=brawler-boss&hero=nova&art=vector`); await waitDialogue();
  await page.waitForFunction(() => !window.venusGame.snapshot().dialogue, null, { timeout: 10_000 });
  assert.deepEqual(errors, []);
  console.log('Boss dialogue: four bosses, conditional replies, frozen combat, skip and expiry passed. Briefing roster: all runtimes, co-op, weapons and campaign progress passed.');
} finally { await browser?.close(); server.kill(); }
