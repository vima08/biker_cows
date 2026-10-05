import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const base = process.env.BCFV_URL ?? 'http://127.0.0.1:4175/biker_cows/';
const output = path.resolve('.gauntlet/loading');
await mkdir(output, { recursive: true });
let preview, browser;
const errors = [];
const report = { ok: false, checks: [], errors };
const waitFor = (page, condition, argument) => page.waitForFunction(condition, argument);
const snapshot = page => page.evaluate(() => window.__BCFV_DEBUG__.snapshot());
const check = label => { report.checks.push(label); console.log(label); };
function gate() { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; }
try {
  let ready;
  try { ready = (await fetch(base)).ok; } catch {}
  if (!ready) {
    const url = new URL(base);
    assert(['127.0.0.1', 'localhost'].includes(url.hostname));
    preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--configLoader', 'runner', '--host', url.hostname, '--port', url.port, '--strictPort'], { windowsHide: true, stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
      try { ready = (await fetch(base)).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert(ready, 'Preview is ready');
  browser = await chromium.launch({ executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const freshPage = async () => {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    return page;
  };
  const page = await freshPage();
  const cover = gate(), portraits = gate(), panels = [gate(), gate(), gate(), gate()];
  const requests = { cover: 0, portraits: 0, panels: [0, 0, 0, 0] };
  await page.route('**/assets/venus-title-key-art.png', async route => { requests.cover++; await cover.promise; await route.continue(); });
  await page.route('**/assets/ui/cow-portraits-sheet.png', async route => { requests.portraits++; await portraits.promise; await route.continue(); });
  await page.route('**/assets/intro/*.png', async route => {
    const index = Number(route.request().url().match(/beach-0(\d)/)[1]) - 1;
    requests.panels[index]++; await panels[index].promise; await route.continue();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await waitFor(page, () => window.__BCFV_DEBUG__?.snapshot().loading?.scene === 'title');
  await page.keyboard.press('Enter');
  assert.equal((await snapshot(page)).loading.scene, 'title', 'A key cannot bypass the cover');
  assert.equal(requests.portraits, 0, 'Cover downloads before portrait prefetch');
  await page.locator('canvas').screenshot({ path: path.join(output, 'cover-loading.png') });
  cover.release();
  await waitFor(page, () => window.__BCFV_DEBUG__.snapshot().state === 'title');
  await page.keyboard.press('Enter');
  await waitFor(page, () => window.__BCFV_DEBUG__.snapshot().loading?.scene === 'select');
  await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight');
  const selection = await snapshot(page);
  assert.equal(selection.loading.scene, 'select');
  assert.equal(selection.hero, 'cassia', 'Selection inputs wait for portraits');
  portraits.release();
  await waitFor(page, () => window.__BCFV_DEBUG__.snapshot().state === 'select');
  await page.keyboard.press('Enter');
  await waitFor(page, () => window.__BCFV_DEBUG__.snapshot().loading?.scene === 'intro');
  for (let index = 0; index < 3; index++) {
    panels[index].release();
    await waitFor(page, count => window.__BCFV_DEBUG__.snapshot().loading?.ready === count, index + 1);
  }
  let intro = await snapshot(page);
  assert.equal(intro.loading.percent, 75); assert.equal(intro.intro.time, 0); assert.equal(intro.intro.skippable, false);
  await page.keyboard.press('Escape'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  intro = await snapshot(page);
  assert.equal(intro.loading.scene, 'intro'); assert.equal(intro.intro.panel, 0); assert.equal(intro.intro.time, 0);
  await page.locator('canvas').screenshot({ path: path.join(output, 'intro-75-percent.png') });
  panels[3].release();
  await waitFor(page, () => window.__BCFV_DEBUG__.snapshot().state === 'intro' && window.__BCFV_DEBUG__.snapshot().intro.time > .05);
  await page.keyboard.press('Enter');
  await waitFor(page, () => window.__BCFV_DEBUG__.snapshot().intro?.panel === 1);
  await page.keyboard.press('Escape');
  await waitFor(page, () => window.__BCFV_DEBUG__.snapshot().state === 'playing');
  await page.evaluate(() => window.__BCFV_DEBUG__.gotoScene('title'));
  await page.keyboard.press('Enter');
  await waitFor(page, () => window.__BCFV_DEBUG__.snapshot().state === 'select');
  assert.deepEqual(requests, { cover: 1, portraits: 1, panels: [1, 1, 1, 1] }, 'Loaded assets are reused');
  check('Cold browser: cover, portraits, intro gates; progress; frozen inputs/timers; reuse');
  await page.context().close();

  const decoded = await freshPage();
  await decoded.addInitScript(() => {
    const nativeDecode = HTMLImageElement.prototype.decode;
    const gate = new Promise(resolve => { window.releaseCoverDecode = resolve; });
    HTMLImageElement.prototype.decode = async function () {
      await nativeDecode.call(this);
      if (this.dataset.assetPath?.endsWith('venus-title-key-art.png')) await gate;
    };
  });
  await decoded.goto(base, { waitUntil: 'domcontentloaded' });
  await waitFor(decoded, () => window.venusGame?.titleArt.complete && window.venusGame.titleArt.naturalWidth > 0);
  assert.equal((await snapshot(decoded)).loading.scene, 'title', 'Downloading is not decoding');
  await decoded.evaluate(() => window.releaseCoverDecode());
  await waitFor(decoded, () => window.__BCFV_DEBUG__.snapshot().state === 'title');
  check('Image decoding finishes before the gate opens'); await decoded.context().close();

  const retry = await freshPage();
  let coverAttempts = 0, portraitAttempts = 0;
  await retry.route('**/assets/venus-title-key-art.png', route => ++coverAttempts === 1 ? route.abort('failed') : route.continue());
  await retry.route('**/assets/ui/cow-portraits-sheet.png', route => ++portraitAttempts === 1 ? route.abort('failed') : route.continue());
  await retry.goto(base, { waitUntil: 'domcontentloaded' });
  await waitFor(retry, () => window.__BCFV_DEBUG__?.snapshot().loading?.failed === 1);
  await retry.locator('canvas').screenshot({ path: path.join(output, 'retry.png') });
  await retry.keyboard.press('Enter');
  await waitFor(retry, () => window.__BCFV_DEBUG__.snapshot().state === 'title');
  await retry.keyboard.press('Enter');
  await waitFor(retry, () => window.__BCFV_DEBUG__.snapshot().loading?.scene === 'select' && window.__BCFV_DEBUG__.snapshot().loading.failed === 1);
  await retry.keyboard.press('Enter');
  await waitFor(retry, () => window.__BCFV_DEBUG__.snapshot().state === 'select');
  assert.equal(coverAttempts, 2); assert.equal(portraitAttempts, 2);
  check('Failed cover and portraits can be retried'); await retry.context().close();

  const fallback = await freshPage();
  await fallback.route('**/assets/intro/venus-beach-01-rest.png', route => route.abort('failed'));
  await fallback.goto(`${base}?scene=intro`, { waitUntil: 'domcontentloaded' });
  await waitFor(fallback, () => window.__BCFV_DEBUG__?.snapshot().loading?.failed === 1);
  assert.equal((await snapshot(fallback)).intro.time, 0);
  await fallback.keyboard.press('KeyF');
  await waitFor(fallback, () => window.__BCFV_DEBUG__.snapshot().state === 'intro' && window.__BCFV_DEBUG__.snapshot().intro.time > .05);
  await fallback.keyboard.press('Enter');
  await waitFor(fallback, () => window.__BCFV_DEBUG__.snapshot().intro?.panel === 1);
  check('Explicit fallback resumes intro timing'); await fallback.context().close();

  const vector = await freshPage();
  let artworkRequests = 0;
  vector.on('request', request => { if (/assets\/(intro|outro|ui\/cow-portraits)|venus-title-key-art/.test(request.url())) artworkRequests++; });
  await vector.goto(`${base}?scene=intro&art=vector`, { waitUntil: 'domcontentloaded' });
  await waitFor(vector, () => window.__BCFV_DEBUG__?.snapshot().intro?.time > .05);
  assert.equal((await snapshot(vector)).loading, null); assert.equal(artworkRequests, 0);
  check('Vector mode does not wait for authored images'); await vector.context().close();

  const outro = await freshPage();
  const finale = [gate(), gate()];
  await outro.route('**/assets/outro/*.png', async route => {
    const index = Number(route.request().url().match(/victory-0(\d)/)[1]) - 1;
    await finale[index].promise; await route.continue();
  });
  await outro.goto(`${base}?scene=outro`, { waitUntil: 'domcontentloaded' });
  await waitFor(outro, () => window.__BCFV_DEBUG__?.snapshot().loading?.scene === 'outro');
  finale[0].release();
  await waitFor(outro, () => window.__BCFV_DEBUG__.snapshot().loading?.ready === 1);
  await outro.keyboard.press('Escape'); await outro.keyboard.press('Enter');
  await outro.waitForTimeout(100);
  assert.equal((await snapshot(outro)).outro.time, 0);
  assert.equal((await snapshot(outro)).outro.panel, 0);
  finale[1].release();
  await waitFor(outro, () => window.__BCFV_DEBUG__.snapshot().state === 'outro' && window.__BCFV_DEBUG__.snapshot().outro.time > .05);
  await outro.keyboard.press('Enter');
  await waitFor(outro, () => window.__BCFV_DEBUG__.snapshot().outro?.panel === 1);
  check('Finale waits for both images and freezes its timer and skip controls');
  await outro.context().close();

  const streaming = await freshPage();
  await streaming.addInitScript(() => {
    const nativeTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => nativeTimeout(callback, delay === 120_000 ? 1000 : delay, ...args);
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, options) => {
      const response = await nativeFetch(input, options);
      if (!String(input).endsWith('venus-title-key-art.png')) return response;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const stream = new ReadableStream({ async start(controller) {
        const chunkSize = Math.ceil(bytes.length / 3);
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          await new Promise(resolve => nativeTimeout(resolve, 600));
          controller.enqueue(bytes.slice(offset, offset + chunkSize));
        }
        controller.close();
      } });
      return new Response(stream, { status: response.status, headers: response.headers });
    };
  });
  await streaming.goto(base, { waitUntil: 'domcontentloaded' });
  await waitFor(streaming, () => window.__BCFV_DEBUG__?.snapshot().loading?.scene === 'title');
  await streaming.waitForTimeout(1200);
  assert.equal((await snapshot(streaming)).loading.failed, 0, 'An active download can outlast the idle deadline');
  await waitFor(streaming, () => window.__BCFV_DEBUG__.snapshot().state === 'title');
  check('Slow streaming downloads reset the idle timeout on every received chunk');
  await streaming.context().close();

  const timedOut = await freshPage();
  await timedOut.addInitScript(() => {
    const nativeTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => nativeTimeout(callback, delay === 120_000 ? 1000 : delay, ...args);
    const nativeDecode = HTMLImageElement.prototype.decode;
    const gate = new Promise(resolve => { window.releaseCoverDecode = resolve; });
    HTMLImageElement.prototype.decode = async function () {
      await nativeDecode.call(this);
      if (this.dataset.assetPath?.endsWith('venus-title-key-art.png')) await gate;
    };
  });
  await timedOut.goto(base, { waitUntil: 'domcontentloaded' });
  await waitFor(timedOut, () => window.__BCFV_DEBUG__?.snapshot().loading?.failed === 1);
  await timedOut.evaluate(() => window.releaseCoverDecode());
  await timedOut.waitForTimeout(100);
  assert.equal((await snapshot(timedOut)).loading.failed, 1, 'Late decode cannot override an expired attempt');
  await timedOut.keyboard.press('Enter');
  await waitFor(timedOut, () => window.__BCFV_DEBUG__.snapshot().state === 'title');
  check('Stalled loading times out, ignores late completion, and can be retried');
  await timedOut.context().close();

  const boot = await freshPage();
  const bundle = gate();
  await boot.route('**/assets/index-*.js', async route => { await bundle.promise; await route.continue(); });
  await boot.goto(base, { waitUntil: 'commit' });
  await boot.locator('#boot-loader').waitFor({ state: 'visible' });
  assert.equal(await boot.evaluate(() => typeof window.__BCFV_DEBUG__), 'undefined');
  bundle.release();
  await waitFor(boot, () => Boolean(window.__BCFV_DEBUG__));
  await boot.locator('#boot-loader').waitFor({ state: 'detached' });
  check('Initial HTML shows loading before the JavaScript bundle arrives');
  await boot.context().close();
  assert.deepEqual(errors, []); report.ok = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close(); preview?.kill(); console.log(JSON.stringify(report));
}
