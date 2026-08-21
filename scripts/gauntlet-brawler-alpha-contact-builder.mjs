import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BCFV_URL ?? 'http://127.0.0.1:4178';
const executablePath = process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve('.gauntlet/builder-brawler-alpha-contact');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(30_000);
const runtimeErrors = [];
page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
page.on('requestfailed', request => runtimeErrors.push(`request: ${request.url()} (${request.failure()?.errorText})`));

// Track the exact atlas draws that produced the latest real game frame. The
// contract reconstructs each actor's opaque component with the same source cel
// and transform, then measures their alpha-mask intersection. This avoids using
// center-distance proxies for silhouettes with capes, weapons and empty padding.
await page.addInitScript(() => {
  const originalRAF = window.requestAnimationFrame.bind(window);
  const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  window.__actorDrawRecords = [];
  window.requestAnimationFrame = callback => originalRAF(time => {
    window.__actorDrawRecords = [];
    callback(time);
  });
  CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
    const mainCanvas = document.querySelector('canvas');
    if (mainCanvas && this.canvas === mainCanvas && image instanceof HTMLImageElement) {
      const matrix = this.getTransform();
      window.__actorDrawRecords.push({
        image,
        src: image.currentSrc || image.src,
        args,
        matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f],
        alpha: this.globalAlpha,
      });
    }
    return originalDrawImage.call(this, image, ...args);
  };
  window.__measureActorAlpha = brawler => {
    const framing = brawler?.combatFraming;
    if (!framing) return null;
    const records = window.__actorDrawRecords ?? [];
    const near = (record, x, y) => Math.abs(record.matrix[4] - x) <= 22 && Math.abs(record.matrix[5] - y) <= 22;
    const playerRecords = records.filter(record => /bruna-brawler-(?:sheet|reaction-sheet)\.png/i.test(record.src) && near(record, framing.playerScreenX, framing.playerScreenY));
    const enemyPattern = framing.attackerKind === 'boss' ? /forge-overseer-sheet\.png/i : /venus-gang-sheet\.png/i;
    const enemyRecords = records.filter(record => enemyPattern.test(record.src) && near(record, framing.enemyScreenX, framing.enemyScreenY));
    if (!playerRecords.length || !enemyRecords.length) return { error: `missing draw component p=${playerRecords.length} e=${enemyRecords.length}` };

    const cropLeft = Math.max(0, Math.floor(Math.min(framing.playerScreenX, framing.enemyScreenX) - 180));
    const cropTop = Math.max(0, Math.floor(Math.min(framing.playerScreenY, framing.enemyScreenY) - 230));
    const cropRight = Math.min(960, Math.ceil(Math.max(framing.playerScreenX, framing.enemyScreenX) + 180));
    const cropBottom = Math.min(540, Math.ceil(Math.max(framing.playerScreenY, framing.enemyScreenY) + 45));
    const sampleScale = .5;
    const sampleLeft = Math.floor(cropLeft * sampleScale);
    const sampleTop = Math.floor(cropTop * sampleScale);
    const sampleRight = Math.ceil(cropRight * sampleScale);
    const sampleBottom = Math.ceil(cropBottom * sampleScale);
    const cropWidth = sampleRight - sampleLeft;
    const cropHeight = sampleBottom - sampleTop;
    const raster = selected => {
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 270;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingEnabled = false;
      for (const record of selected) {
        context.save();
        context.setTransform(
          record.matrix[0] * sampleScale,
          record.matrix[1] * sampleScale,
          record.matrix[2] * sampleScale,
          record.matrix[3] * sampleScale,
          record.matrix[4] * sampleScale,
          record.matrix[5] * sampleScale,
        );
        context.globalAlpha = record.alpha;
        originalDrawImage.call(context, record.image, ...record.args);
        context.restore();
      }
      return context.getImageData(sampleLeft, sampleTop, cropWidth, cropHeight).data;
    };
    const playerPixels = raster(playerRecords);
    const enemyPixels = raster(enemyRecords);
    let playerArea = 0;
    let enemyArea = 0;
    let intersection = 0;
    let playerX = 0;
    let playerY = 0;
    let enemyX = 0;
    let enemyY = 0;
    let playerMinX = 960;
    let playerMaxX = -1;
    let enemyMinX = 960;
    let enemyMaxX = -1;
    let playerMinY = 540;
    let playerMaxY = -1;
    let enemyMinY = 540;
    let enemyMaxY = -1;
    for (let pixel = 0; pixel < cropWidth * cropHeight; pixel++) {
      const playerOpaque = playerPixels[pixel * 4 + 3] >= 24;
      const enemyOpaque = enemyPixels[pixel * 4 + 3] >= 24;
      if (!playerOpaque && !enemyOpaque) continue;
      const x = (sampleLeft + pixel % cropWidth) / sampleScale;
      const y = (sampleTop + Math.floor(pixel / cropWidth)) / sampleScale;
      if (playerOpaque) {
        playerArea++;
        playerX += x;
        playerY += y;
        playerMinX = Math.min(playerMinX, x);
        playerMaxX = Math.max(playerMaxX, x);
        playerMinY = Math.min(playerMinY, y);
        playerMaxY = Math.max(playerMaxY, y);
      }
      if (enemyOpaque) {
        enemyArea++;
        enemyX += x;
        enemyY += y;
        enemyMinX = Math.min(enemyMinX, x);
        enemyMaxX = Math.max(enemyMaxX, x);
        enemyMinY = Math.min(enemyMinY, y);
        enemyMaxY = Math.max(enemyMaxY, y);
      }
      if (playerOpaque && enemyOpaque) intersection++;
    }
    if (!playerArea || !enemyArea) return { error: `empty mask p=${playerArea} e=${enemyArea}` };
    const scale = document.querySelector('canvas').getBoundingClientRect().width / 960;
    const playerCentroid = { x: playerX / playerArea, y: playerY / playerArea };
    const enemyCentroid = { x: enemyX / enemyArea, y: enemyY / enemyArea };
    return {
      playerArea,
      enemyArea,
      intersection,
      overlapRatio: intersection / Math.min(playerArea, enemyArea),
      centroidSeparationPx: Math.hypot(enemyCentroid.x - playerCentroid.x, enemyCentroid.y - playerCentroid.y) * scale,
      playerCentroidX: playerCentroid.x * scale,
      enemyCentroidX: enemyCentroid.x * scale,
      playerBounds: [playerMinX * scale, playerMinY * scale, (playerMaxX + 1) * scale, (playerMaxY + 1) * scale],
      enemyBounds: [enemyMinX * scale, enemyMinY * scale, (enemyMaxX + 1) * scale, (enemyMaxY + 1) * scale],
      edgeMarginPx: Math.min(playerMinX, 960 - playerMaxX - 1, enemyMinX, 960 - enemyMaxX - 1) * scale,
      scale,
    };
  };
});

const state = () => page.evaluate(() => window.__BCFV_DEBUG__.snapshot().brawler);
const waitReady = () => page.waitForFunction(() => {
  const brawler = window.__BCFV_DEBUG__?.snapshot().brawler;
  return brawler?.status === 'running' && Object.values(brawler.assets).every(value => value === 'ready');
});

const movementKeys = ['KeyA', 'KeyD', 'KeyW', 'KeyS'];
const held = new Set();
async function setMovement(wanted) {
  for (const key of movementKeys) {
    if (wanted.has(key) && !held.has(key)) { await page.keyboard.down(key); held.add(key); }
    if (!wanted.has(key) && held.has(key)) { await page.keyboard.up(key); held.delete(key); }
  }
}
const releaseAll = async () => {
  await setMovement(new Set());
  await page.keyboard.up('KeyZ').catch(() => {});
};

async function approachContact() {
  for (let attempt = 0; attempt < 320; attempt++) {
    const brawler = await state();
    const player = brawler.players.find(candidate => !candidate.downed);
    const target = brawler.enemies.filter(enemy => enemy.hp > 0).reduce((best, enemy) => {
      if (!best) return enemy;
      return Math.hypot(enemy.x - player.x, (enemy.y - player.y) * 1.5) < Math.hypot(best.x - player.x, (best.y - player.y) * 1.5) ? enemy : best;
    }, null);
    if (!player || !target) { await page.waitForTimeout(30); continue; }
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    if (Math.abs(dx) <= 61.5 && Math.abs(dy) < 28) { await setMovement(new Set()); return; }
    const wanted = new Set();
    if (Math.abs(dx) > 58) wanted.add(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dy) > 18) wanted.add(dy > 0 ? 'KeyS' : 'KeyW');
    await setMovement(wanted);
    await page.waitForTimeout(30);
  }
  throw new Error('Could not reach collision-gated contact strip');
}

function longestOverlapRun(samples, threshold = .35) {
  let longest = 0;
  let startedAt = null;
  for (const sample of samples) {
    if (sample.mask.overlapRatio > threshold) {
      if (startedAt === null) startedAt = sample.wallMs;
      longest = Math.max(longest, sample.wallMs - startedAt);
    } else startedAt = null;
  }
  return Math.round(longest);
}

function summarize(samples, label, startHits) {
  const valid = samples.filter(sample => !sample.mask.error);
  if (valid.length < 40) throw new Error(`${label}: insufficient real alpha samples ${valid.length}`);
  const overlapRunMs = longestOverlapRun(valid);
  const maxOverlapRatio = Math.max(...valid.map(sample => sample.mask.overlapRatio));
  const minEdgeMarginPx = Math.min(...valid.map(sample => sample.mask.edgeMarginPx));
  const confirmedHits = Math.max(...valid.map(sample => sample.confirmedHits)) - startHits;
  const hitIndex = valid.findIndex(sample => sample.confirmedHits > startHits);
  if (hitIndex < 0) throw new Error(`${label}: no confirmed hit during held-right+attack run`);
  const pre = valid[Math.max(0, hitIndex - 2)];
  const contact = valid[hitIndex];
  const reactionWindow = valid.slice(hitIndex, hitIndex + 6);
  const reaction = reactionWindow.reduce((best, sample) => sample.mask.centroidSeparationPx > best.mask.centroidSeparationPx ? sample : best, reactionWindow[0]);
  const targetDirection = Math.sign(contact.enemyWorldX - contact.playerWorldX) || 1;
  const targetRecoilPx = Math.max(0, ...reactionWindow.map(sample => (sample.mask.enemyCentroidX - pre.mask.enemyCentroidX) * targetDirection));
  if (overlapRunMs > 200) throw new Error(`${label}: >35% opaque overlap persisted ${overlapRunMs}ms`);
  if (maxOverlapRatio > .72) throw new Error(`${label}: single-frame contact swallowed ${Math.round(maxOverlapRatio * 100)}% of the smaller silhouette`);
  if (reaction.mask.centroidSeparationPx < 32) throw new Error(`${label}: reaction separation ${reaction.mask.centroidSeparationPx}px`);
  if (targetRecoilPx < 12) throw new Error(`${label}: target alpha-component recoil only ${targetRecoilPx}px`);
  if (minEdgeMarginPx < 8) throw new Error(`${label}: actor clipped, edge margin ${minEdgeMarginPx}px`);
  return {
    durationMs: Math.round(valid.at(-1).wallMs - valid[0].wallMs),
    alphaSamples: valid.length,
    confirmedHits,
    longestOver35OverlapRunMs: overlapRunMs,
    maxOpaqueOverlapPct: Number((maxOverlapRatio * 100).toFixed(2)),
    preContactSeparationPx: Number(pre.mask.centroidSeparationPx.toFixed(2)),
    contactSeparationPx: Number(contact.mask.centroidSeparationPx.toFixed(2)),
    reactionSeparationPx: Number(reaction.mask.centroidSeparationPx.toFixed(2)),
    targetAlphaRecoilPx: Number(targetRecoilPx.toFixed(2)),
    minSafeZoneEdgePx: Number(minEdgeMarginPx.toFixed(2)),
    contactCenterRange: [
      Math.min(...valid.map(sample => sample.contactCenterX)),
      Math.max(...valid.map(sample => sample.contactCenterX)),
    ],
  };
}

async function heldContactRun(label) {
  await approachContact();
  await page.waitForTimeout(100);
  const initial = await state();
  const startHits = initial.confirmedHits;
  const samples = [];
  let frame = 0;
  const sampleFrame = async () => {
    const measured = await page.evaluate(() => {
      const brawler = window.__BCFV_DEBUG__.snapshot().brawler;
      return { brawler, mask: window.__measureActorAlpha(brawler), wallMs: performance.now() };
    });
    if (measured.mask && !measured.mask.error && measured.brawler.combatFraming) {
      const player = measured.brawler.players.find(candidate => !candidate.downed) ?? measured.brawler.players[0];
      const enemy = measured.brawler.enemies.find(candidate => candidate.id === measured.brawler.combatFraming.attackerId);
      samples.push({
        wallMs: measured.wallMs,
        mask: measured.mask,
        confirmedHits: measured.brawler.confirmedHits,
        contactCenterX: measured.brawler.combatFraming.contactCenterX * measured.mask.scale,
        playerWorldX: player?.x ?? 0,
        enemyWorldX: enemy?.x ?? 0,
      });
      if (frame % 8 === 0) await page.screenshot({ path: path.join(outputDir, `${label}-${String(frame).padStart(3, '0')}.png`) });
      frame++;
    }
  };
  // Include the critic's passive pre-input hold: collision must not collapse
  // simply because both AI and player have settled at their approach boundary.
  const passiveStarted = Date.now();
  while (Date.now() - passiveStarted < 800) {
    await sampleFrame();
    await page.waitForTimeout(80);
  }
  for (let settle = 0; settle < 80; settle++) {
    const brawler = await state();
    const player = brawler.players.find(candidate => !candidate.downed);
    const activeContact = brawler.enemies.some(enemy => enemy.attackPhase === 'contact');
    if (player && !player.reactionPhase && !activeContact) break;
    await sampleFrame();
    await page.waitForTimeout(32);
  }
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyZ');
  const started = Date.now();
  while (Date.now() - started < 8_500) {
    await sampleFrame();
    await page.waitForTimeout(80);
  }
  await releaseAll();
  return summarize(samples, label, startHits);
}

async function prepareScene(kind) {
  const scene = kind === 'boss' ? 'brawler-boss' : 'brawler';
  await page.goto(`${baseURL}/?scene=${scene}&hero=bruna`, { waitUntil: 'networkidle' });
  await waitReady();
  if (kind === 'normal') {
    await setMovement(new Set(['KeyD']));
    await page.waitForFunction(() => window.__BCFV_DEBUG__.snapshot().brawler?.arenaLocked === true);
    await page.waitForFunction(() => {
      const brawler = window.__BCFV_DEBUG__.snapshot().brawler;
      return brawler?.enemies.some(enemy => enemy.x - brawler.cameraX < 820);
    });
    await setMovement(new Set());
  }
}

async function aggregateConfirmedContacts(kind, desiredContacts = 20) {
  let contacts = 0;
  let reloads = 0;
  const hitsPerReload = [];
  while (contacts < desiredContacts && reloads < 8) {
    await releaseAll();
    await prepareScene(kind);
    reloads++;
    let localHits = 0;
    while (contacts < desiredContacts && localHits < 8) {
      const current = await state();
      const player = current.players.find(candidate => !candidate.downed);
      if (!player || current.status !== 'running' || !current.enemies.length) break;
      await approachContact();
      for (let settle = 0; settle < 80; settle++) {
        const brawler = await state();
        const activePlayer = brawler.players.find(candidate => !candidate.downed);
        if (activePlayer && activePlayer.attackTimer <= .02 && !activePlayer.reactionPhase && !brawler.enemies.some(enemy => enemy.attackPhase === 'contact')) break;
        await page.waitForTimeout(25);
      }
      const before = await state();
      const beforeHits = before.confirmedHits;
      await page.keyboard.press('KeyZ');
      try {
        await page.waitForFunction(expected => window.__BCFV_DEBUG__.snapshot().brawler?.confirmedHits > expected, beforeHits, { timeout: 1_250 });
      } catch {
        continue;
      }
      contacts++;
      localHits++;
      await page.waitForTimeout(90);
    }
    hitsPerReload.push(localHits);
  }
  if (contacts < desiredContacts) throw new Error(`${kind}: only ${contacts}/${desiredContacts} aggregate confirmed contacts across ${reloads} safe reloads`);
  return { confirmedContacts: contacts, reloads, hitsPerReload };
}

const report = {};
try {
  await prepareScene('normal');
  report.normal = await heldContactRun('normal-held-contact');

  await prepareScene('boss');
  report.boss = await heldContactRun('boss-held-contact');
  report.normal.aggregate = await aggregateConfirmedContacts('normal');
  report.boss.aggregate = await aggregateConfirmedContacts('boss');

  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  const result = { ok: true, viewport: '1440x900', runtimeErrors, report };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await releaseAll().catch(() => {});
  await browser.close();
}
