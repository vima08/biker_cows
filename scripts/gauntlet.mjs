import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BMFM_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.BMFM_BROWSER ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = path.resolve(process.env.BMFM_CAPTURE_DIR ?? '.gauntlet/latest');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(10_000);
page.setDefaultNavigationTimeout(15_000);
const runtimeErrors = [];
page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
});
page.on('requestfailed', request => {
  const url = request.url();
  if (!url.startsWith('data:')) runtimeErrors.push(`request: ${url} (${request.failure()?.errorText})`);
});

const shot = name => page.screenshot({ path: path.join(outputDir, `${name}.png`) });
// Beat frames come straight from the real gameplay canvas. With SwiftShader,
// encoding the full browser viewport can take hundreds of milliseconds while
// requestAnimationFrame keeps advancing, distorting the authored 2.1s beat.
// Canvas serialization captures the exact rendered frame without page chrome
// or any mutation to gameplay state.
const canvasShot = async name => {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Gameplay canvas missing');
    if (canvas.width !== 960 || canvas.height !== 540) {
      throw new Error(`Expected 960x540 production canvas, received ${canvas.width}x${canvas.height}`);
    }
    return canvas.toDataURL('image/png');
  });
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
};
const state = () => page.evaluate(() => window.__BMFM_DEBUG__.snapshot());
const waitForElapsed = target => page.waitForFunction(
  elapsed => window.__BMFM_DEBUG__.snapshot().elapsed >= elapsed,
  target,
  { timeout: 5_000, polling: 'raf' },
);
const assertState = async expected => {
  const current = await state();
  if (current.state !== expected) {
    throw new Error(`Expected state ${expected}, received ${current.state}: ${JSON.stringify(current)}`);
  }
  return current;
};

const checkpoints = {};
try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__BMFM_DEBUG__));
  await page.waitForFunction(() => {
    const atlas = window.__BMFM_DEBUG__.snapshot().atlas;
    return atlas && Object.keys(atlas).length === 12 && Object.values(atlas).every(sheet => sheet.state === 'ready');
  });
  checkpoints.atlas = (await state()).atlas;
  if (Object.keys(checkpoints.atlas).length !== 12 || checkpoints.atlas.riderImpact?.frames !== 12 ||
      !checkpoints.atlas.impactMaterial || !checkpoints.atlas.sustainedFire || checkpoints.atlas.fireRelease?.frames !== 9) {
    throw new Error(`Expected 12 atlases including riderImpact, impactMaterial, sustainedFire and 9-frame fireRelease, received ${JSON.stringify(checkpoints.atlas)}`);
  }
  checkpoints.menu = await assertState('title');
  await shot('menu');
  console.log('[gauntlet] menu');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  checkpoints.select = await assertState('select');
  await shot('select');
  console.log('[gauntlet] select');

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  checkpoints.start = await assertState('playing');
  if (checkpoints.start.hero !== 'modo') {
    throw new Error(`Hero select did not start Modo: ${JSON.stringify(checkpoints.start)}`);
  }

  await page.keyboard.down('KeyZ');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(900);
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(1300);
  await page.keyboard.up('ArrowRight');
  checkpoints.ride = await state();
  await shot('ride');
  await page.waitForTimeout(90);
  await shot('ride-sequence-a');
  await page.waitForTimeout(120);
  await shot('ride-sequence-b');
  await page.waitForTimeout(120);
  await shot('ride-sequence-c');
  console.log('[gauntlet] ride sequence');

  // One deterministic, real-update-loop combat sentence. The blaster projectile
  // travels through normal collision code and drives the raider's local hit timer.
  // Targets use gameplay elapsed time, so screenshot encoding cannot reorder the beat.
  await page.keyboard.up('KeyZ');
  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('beat'));
  await page.waitForTimeout(120);
  checkpoints.beatStart = await assertState('playing');
  if (checkpoints.beatStart.hero !== 'throttle') {
    throw new Error(`Combat beat did not start Throttle: ${JSON.stringify(checkpoints.beatStart)}`);
  }
  const beatOrigin = checkpoints.beatStart.elapsed;
  const beatFrames = [];
  const captureBeatFrame = async (index, label) => {
    const frameState = await state();
    // This timestamp is the production simulation clock sampled before PNG
    // serialization.  It deliberately excludes screenshot encoder latency.
    const simulationMs = Math.round((frameState.elapsed - beatOrigin) * 1_000);
    beatFrames.push({
      index,
      label,
      offsetMs: simulationMs,
      simulationMs,
      score: frameState.score,
      riderReaction: frameState.beat?.riderReaction ?? 0,
      shots: frameState.beat?.shots ?? 0,
    });
    await canvasShot(`combat-beat-${index}`);
  };

  await page.keyboard.down('KeyZ');
  await waitForElapsed(beatOrigin + .024);
  await captureBeatFrame(0, 'muzzle');
  await page.keyboard.up('KeyZ');

  await waitForElapsed(beatOrigin + .20);
  await captureBeatFrame(1, 'early travel');
  await waitForElapsed(beatOrigin + .54);
  await captureBeatFrame(2, 'late travel');

  await page.waitForFunction(
    startScore => {
      const snapshot = window.__BMFM_DEBUG__.snapshot();
      return snapshot.beat?.riderReaction > 0 && snapshot.score > startScore;
    },
    checkpoints.beatStart.score,
    { timeout: 5_000, polling: 'raf' },
  );
  checkpoints.beatContact = await state();
  const contactElapsed = checkpoints.beatContact.elapsed;
  await captureBeatFrame(3, 'contact core');

  await waitForElapsed(contactElapsed + .08);
  await captureBeatFrame(4, 'target squash');
  await waitForElapsed(contactElapsed + .28);
  await captureBeatFrame(5, 'recoil/backbend');
  await waitForElapsed(contactElapsed + .67);
  await captureBeatFrame(6, 'debris break');
  // Keep the legacy sentence on its authored absolute simulation timeline.
  // Contact can quantize by a few update ticks under SwiftShader; anchoring the
  // last sample to contact made an otherwise identical beat exceed 2.14s.
  await waitForElapsed(beatOrigin + 2.10);
  await captureBeatFrame(7, 'recovery wobble');

  checkpoints.beatAftermath = await state();
  checkpoints.beatFrames = beatFrames;
  const beatDurationMs = beatFrames.at(-1)?.simulationMs ?? 0;
  checkpoints.beatTiming = {
    clock: 'production-simulation',
    durationMs: beatDurationMs,
    contactMs: beatFrames[3]?.simulationMs ?? null,
    authoredWindowMs: [1_950, 2_140],
    captureLatencyExceededAuthoredWindow: beatDurationMs > 2_140,
  };
  if (!checkpoints.beatContact.beat || checkpoints.beatContact.beat.riderReaction <= 0 ||
      checkpoints.beatContact.score <= checkpoints.beatStart.score ||
      checkpoints.beatAftermath.score <= checkpoints.beatStart.score) {
    throw new Error(`Combat beat missed its real rider collision: ${JSON.stringify(checkpoints.beatAftermath)}`);
  }
  // The later deterministic 12-stage impact suite owns exact phase timing.
  // This real-update-loop pass owns collision validity and causal ordering; PNG
  // encoding may advance production RAF beyond the old 2.14s capture window.
  if (beatFrames.length !== 8 || beatFrames.some((frame, index) => index > 0 && frame.simulationMs < beatFrames[index - 1].simulationMs)) {
    throw new Error(`Combat beat capture lost causal ordering: ${JSON.stringify(beatFrames)}`);
  }
  const beatSchedule = beatFrames.map(frame => `${frame.index}:${frame.label}@${frame.simulationMs}ms`).join(', ');
  console.log(`[gauntlet] combat beat: ${beatSchedule}`);

  // Wave 12 impact contract: twelve frozen instants use the production entity,
  // projectile, atlas and FX renderers with a fixed camera.  State assertions
  // make the causal sentence independently reviewable instead of timing a PNG
  // encoder against requestAnimationFrame.
  const impactFrames = [];
  const impactNames = ['pre','muzzle','travel-25','travel-75','contact','hitstop','recoil-1','recoil-2','debris-1','debris-2','damage-hold','recover'];
  for (let index = 0; index < impactNames.length; index += 1) {
    const staged = await page.evaluate(frame => window.__BMFM_DEBUG__.gotoScene(`impact-${frame}`), index);
    if (staged.state !== 'playing' || staged.impact?.stage !== index || staged.impact.label !== impactNames[index]) {
      throw new Error(`Impact stage ${index} did not freeze deterministically: ${JSON.stringify(staged)}`);
    }
    impactFrames.push({ score: staged.score, ...staged.impact });
    // Two RAF boundaries guarantee the canvas contains this staged pose rather
    // than the previous one when canvas.toDataURL runs immediately afterwards.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await canvasShot(`impact-${String(index).padStart(2,'0')}-${impactNames[index]}`);
  }
  const requireImpact = (condition, message, evidence) => {
    if (!condition) throw new Error(`Wave 12 impact contract: ${message}: ${JSON.stringify(evidence)}`);
  };
  const finite = value => Number.isFinite(value);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const poseDelta = (a, b) => ({
    x: Math.abs(b.x - a.x),
    y: Math.abs(b.y - a.y),
    angle: Math.abs(b.angle - a.angle),
  });
  const scoreTransitions = impactFrames.reduce(
    (count, frame, index) => count + (index > 0 && frame.score !== impactFrames[index - 1].score ? 1 : 0), 0,
  );
  const prePose = impactFrames[0].targetPose;
  const recoilPose = impactFrames[6].targetPose;
  const recoil2Pose = impactFrames[7].targetPose;
  const silhouetteDelta = poseDelta(prePose, recoilPose);
  const contactFreezeDelta = poseDelta(impactFrames[4].targetPose, impactFrames[5].targetPose);
  const contact = impactFrames[4].contact;
  const travel75 = impactFrames[3].projectile;
  const debris1 = impactFrames[8].material;
  const debris2 = impactFrames[9].material;
  const damageHold = impactFrames[10].damage;
  const recovered = impactFrames[11].damage;
  const phaseMetrics = impactFrames[4].phaseMetrics;

  // Wave 12 exposes measurable body anchors and three persistent fragments.
  // Treat this as a required production schema: silently skipping a missing
  // field would turn the causal-order gate into a screenshot-only opinion.
  const anchorNames = ['hardpoint', 'frontWheel', 'head', 'gun'];
  const causalFrames = impactFrames.slice(4, 8);
  const anchoredFrames = impactFrames.slice(4);
  const phaseAnchors = impactFrames[4].phaseAnchors;
  const phaseAnchorNames = ['contact', 'hitstop', 'recoil1', 'recoil2', 'debris1', 'debris2', 'damageHold', 'recover'];
  const hasPoint = point => point && finite(point.x) && finite(point.y);
  requireImpact(impactFrames.every(frame => Number.isInteger(frame.targetPose?.spriteFrame)),
    'targetPose.spriteFrame schema missing', impactFrames.map(frame => frame.targetPose));
  requireImpact(anchoredFrames.every(frame =>
      hasPoint(frame.anchors?.recoilVector) && finite(frame.anchors?.bodyAngle) &&
      finite(frame.anchors?.adjacentReversePx) && anchorNames.every(name =>
        hasPoint(frame.anchors?.[name]) && finite(frame.anchors[name].projection) &&
        finite(frame.anchors[name].adjacentDelta) && finite(frame.anchors[name].reversePx))),
    'anchor projection schema missing from contact through recover', anchoredFrames.map(frame => frame.anchors));
  requireImpact(phaseAnchors && phaseAnchorNames.every(phase =>
      hasPoint(phaseAnchors[phase]?.recoilVector) && finite(phaseAnchors[phase]?.bodyAngle) &&
      anchorNames.every(name => hasPoint(phaseAnchors[phase]?.[name]) &&
        finite(phaseAnchors[phase][name].projection) && finite(phaseAnchors[phase][name].reversePx))),
    'phaseAnchors schema missing a contact-to-recover phase or body anchor', phaseAnchors);
  requireImpact(impactFrames.slice(5, 10).every(frame =>
      frame.trajectory && ['earlyPanel', 'sparkA', 'sparkB'].every(name => {
        const sample = frame.trajectory[name];
        return typeof sample?.id === 'string' && hasPoint(sample) && finite(sample.dx) && finite(sample.dy) &&
          finite(sample.sampleDelta) && finite(sample.distanceFromScar) && finite(sample.distanceStep);
      })),
    'persistent panel/spark identity, position or scar-distance schema missing', impactFrames.slice(5, 10).map(frame => frame.trajectory));
  requireImpact(impactFrames.slice(5).every(frame => frame.smoke?.active === true &&
      typeof frame.smoke.node === 'string' && finite(frame.smoke.baseDistance) &&
      finite(frame.smoke.diameter) && finite(frame.smoke.value)),
    'attached smoke diameter/value schema missing from hitstop through recover', impactFrames.slice(5).map(frame => frame.smoke));
  requireImpact(impactFrames.slice(6).every(frame => {
    const scar = frame.trajectory?.scar;
    return scar?.active === true && typeof scar.node === 'string' && hasPoint(scar) &&
      finite(scar.w) && finite(scar.h) && finite(scar.smokeBaseX) && finite(scar.smokeBaseY) && finite(scar.distance);
  }), 'persistent scar schema missing from recoil-1 through recover', impactFrames.slice(6).map(frame => frame.trajectory?.scar));
  requireImpact(phaseMetrics &&
      finite(phaseMetrics.contactToHitstop?.hardpointDeltaPx) && finite(phaseMetrics.contactToHitstop?.bodyDeltaDeg) &&
      typeof phaseMetrics.contactToHitstop?.compressed === 'boolean' &&
      finite(phaseMetrics.contactToPeak?.horizontalPx) && finite(phaseMetrics.contactToPeak?.verticalPx) &&
      finite(phaseMetrics.contactToPeak?.angleDeg) && finite(phaseMetrics.recoilMonotonic?.maxReversePx) &&
      phaseMetrics.debrisPeakHold?.recoil2 && phaseMetrics.debrisPeakHold?.debris1 && phaseMetrics.debrisPeakHold?.debris2 &&
      finite(phaseMetrics.holdRecover?.projectionGapPx) && finite(phaseMetrics.holdRecover?.angleGapDeg) &&
      finite(phaseMetrics.holdRecover?.recoverWheelLift),
    'phase-readability metrics schema missing', phaseMetrics);

  requireImpact(impactFrames.length === 12, 'capture count/order changed', impactFrames.map(frame => frame.label));
  requireImpact(impactFrames.every((frame, index) => frame.stage === index && frame.label === impactNames[index]),
    'capture names/order changed', impactFrames.map(frame => ({ stage: frame.stage, label: frame.label })));
  requireImpact(impactFrames.every(frame => finite(frame.fixedHit?.x) && finite(frame.fixedHit?.y)),
    'fixed hit coordinate missing', impactFrames.map(frame => frame.fixedHit));
  requireImpact(impactFrames.every(frame => distance(frame.fixedHit, impactFrames[0].fixedHit) < .01),
    'fixed hit coordinate drifted between captures', impactFrames.map(frame => frame.fixedHit));

  requireImpact(finite(travel75?.tipY) && finite(contact?.coreCenterY) && Math.abs(travel75.tipY - contact.coreCenterY) <= 4,
    'projectile/contact Y registration exceeded 4px', { projectileTip: travel75, contact });
  requireImpact(finite(contact?.coreCenterX) && finite(contact?.leadingEdgeX) &&
      Math.abs(contact.coreCenterX - contact.leadingEdgeX) <= 6,
    'white core missed the leading edge by more than 6px', contact);
  requireImpact(contact?.overlapW >= 16 && contact?.overlapH >= 16,
    'contact core did not overlap target by 16x16px', contact);
  requireImpact(contact?.bboxW >= 84 && contact?.bboxH >= 56,
    'contact bbox fell below 84x56px', contact);
  const visibleLayers = contact?.layers ?? {};
  requireImpact(['rearHalo', 'hotRing', 'core', 'reflectedRim', 'foregroundSparks'].every(layer => visibleLayers[layer] === true),
    'contact layer metadata is missing a visible production layer', visibleLayers);
  requireImpact(distance(contact.damageOrigin, contact.emitterOrigin) <= 6 &&
      distance(contact.damageOrigin, impactFrames[4].fixedHit) <= 6 &&
      distance(contact.emitterOrigin, impactFrames[4].fixedHit) <= 6,
    'contact, damage and emitter origins diverged by more than 6px', {
      fixedHit: impactFrames[4].fixedHit,
      damageOrigin: contact.damageOrigin,
      emitterOrigin: contact.emitterOrigin,
    });
  const firstOverlapEvidence = {
    consumesBeforeContact: impactFrames.slice(0, 4).map(frame => frame.projectile?.consumed),
    contactConsumes: impactFrames[4].projectile?.consumed,
    intactSilhouette: contact?.intactSilhouette,
    contourChangedPct: impactFrames[4].damage?.contourChangedPct,
  };
  requireImpact(contact?.intactSilhouette === true && impactFrames[4].damage?.contourChangedPct === 0 &&
      firstOverlapEvidence.consumesBeforeContact.every(consumed => consumed === 0) &&
      firstOverlapEvidence.contactConsumes === 1,
    'contact is not the first overlap with an intact target silhouette', firstOverlapEvidence);

  const hitstopReadability = impactFrames[5].hitstop;
  requireImpact(hitstopReadability?.active === true && hitstopReadability.panelVisible === true &&
      hitstopReadability.sparksVisible >= 2 && hitstopReadability.sootVisible === true &&
      hitstopReadability.posture?.compressed === true && hitstopReadability.posture?.noStraightening === true &&
      hitstopReadability.posture.hardpointDeltaPx >= 4 && hitstopReadability.posture.hardpointDeltaPx <= 8 &&
      hitstopReadability.posture.bodyDeltaDeg >= 2 && hitstopReadability.posture.bodyDeltaDeg <= 4,
    'hitstop lost compressed same-family posture or its panel/two-spark/soot seed', hitstopReadability);

  const shooterPre = impactFrames[0].shooterPose;
  const shooterMuzzle = impactFrames[1].shooterPose;
  const shooterTravel25 = impactFrames[2].shooterPose;
  const shooterTravel75 = impactFrames[3].shooterPose;
  requireImpact(Math.abs(shooterMuzzle.shoulderRecoil - shooterPre.shoulderRecoil) >= 6 &&
      Math.abs(shooterTravel25.shoulderRecoil - shooterPre.shoulderRecoil) >= 6 &&
      Math.abs(shooterMuzzle.gunRecoil - shooterPre.gunRecoil) >= 6 &&
      Math.abs(shooterTravel25.gunRecoil - shooterPre.gunRecoil) >= 6,
    'shooter recoil did not persist through travel-25', { shooterPre, shooterMuzzle, shooterTravel25 });
  requireImpact(Math.abs(shooterTravel75.shoulderRecoil - shooterPre.shoulderRecoil) <=
      Math.abs(shooterTravel25.shoulderRecoil - shooterPre.shoulderRecoil) &&
      Math.abs(shooterTravel75.gunRecoil - shooterPre.gunRecoil) <=
      Math.abs(shooterTravel25.gunRecoil - shooterPre.gunRecoil),
    'shooter recoil failed to return monotonically by travel-75', { shooterPre, shooterTravel25, shooterTravel75 });
  requireImpact(!impactFrames[4].shooterPose.firingPose && !impactFrames[5].shooterPose.firingPose,
    'firing pose re-fired at contact/hitstop', [impactFrames[4].shooterPose, impactFrames[5].shooterPose]);

  const preContactTargetDeltas = impactFrames.slice(1, 4).map(frame => poseDelta(prePose, frame.targetPose));
  requireImpact(preContactTargetDeltas.every(delta => delta.x < .01 && delta.y < .01 && delta.angle < .01),
    'target reacted before contact', preContactTargetDeltas);
  requireImpact(impactFrames[5].hitstopMs >= 66 &&
      contactFreezeDelta.x <= 8 && contactFreezeDelta.y <= 8,
    'hitstop duration/pose registration failed', { hitstopMs: impactFrames[5].hitstopMs, contactFreezeDelta });
  // Recoil-1 is deliberately the first monotonic step (20/10/8); the full
  // 34/16/14 peak is asserted below at recoil-2.  Keeping the old 24px gate
  // here incorrectly rejected the smoother two-step Wave 11 progression.
  requireImpact(silhouetteDelta.x >= 20 && silhouetteDelta.y >= 10 && silhouetteDelta.angle >= 8,
    'recoil-1 mass fell below 20px/10px/8deg', silhouetteDelta);
  requireImpact(Math.abs(recoil2Pose.headCounterphase) >= 4 && Math.abs(recoil2Pose.forkOffset) >= 6 &&
      recoil2Pose.wheelLift >= 12,
    'recoil-2 counterphase/fork/wheel lift failed', recoil2Pose);
  const shadowDelta = Math.max(
    Math.abs(recoil2Pose.shadowOffset - prePose.shadowOffset),
    Math.abs(recoil2Pose.shadowWidth - prePose.shadowWidth),
  );
  requireImpact(shadowDelta >= 16, 'recoil-2 contact shadow delta fell below 16px', { prePose, recoil2Pose, shadowDelta });

  const causalAnchorEvidence = Object.fromEntries(anchorNames.map(name => {
    const projections = causalFrames.map(frame => frame.anchors[name].projection);
    const adjacentDeltas = projections.slice(1).map((projection, index) => projection - projections[index]);
    const reversePx = adjacentDeltas.map(delta => Math.max(0, -delta));
    return [name, {
      projections,
      adjacentDeltas,
      reversePx,
      reportedReversePx: causalFrames.map(frame => frame.anchors[name].reversePx),
    }];
  }));
  requireImpact(Object.values(causalAnchorEvidence).every(anchor =>
      anchor.reversePx.every(reverse => reverse <= 2) && anchor.reportedReversePx.every(reverse => reverse <= 2)) &&
      causalFrames.every(frame => frame.anchors.adjacentReversePx <= 2) &&
      phaseMetrics.recoilMonotonic.maxReversePx <= 2,
    'contact to recoil-2 anchor projection reversed by more than 2px', causalAnchorEvidence);

  const contactTarget = impactFrames[4].targetPose;
  const peakTargetDelta = impactFrames.slice(5, 8).reduce((peak, frame) => ({
    x: Math.max(peak.x, Math.abs(frame.targetPose.x - contactTarget.x)),
    y: Math.max(peak.y, Math.abs(frame.targetPose.y - contactTarget.y)),
    angle: Math.max(peak.angle, Math.abs(frame.anchors.bodyAngle - impactFrames[4].anchors.bodyAngle)),
  }), { x: 0, y: 0, angle: 0 });
  const phasePeak = phaseMetrics.contactToPeak;
  requireImpact(peakTargetDelta.x >= 38 && peakTargetDelta.y >= 16 && peakTargetDelta.y <= 20 &&
      peakTargetDelta.angle >= 12 && peakTargetDelta.angle <= 16 &&
      phasePeak.horizontalPx >= 38 && phasePeak.verticalPx >= 16 && phasePeak.verticalPx <= 20 &&
      phasePeak.angleDeg >= 12 && phasePeak.angleDeg <= 16,
    'contact-to-peak transform left the 38px / 16-20px / 12-16deg gate', { peakTargetDelta, phasePeak });
  const contactHitstopAnchorDelta = distance(impactFrames[4].anchors.hardpoint, impactFrames[5].anchors.hardpoint);
  const contactHitstopAngleDelta = Math.abs(impactFrames[5].anchors.bodyAngle - impactFrames[4].anchors.bodyAngle);
  requireImpact(contactHitstopAngleDelta >= 2 && contactHitstopAngleDelta <= 4 &&
      contactHitstopAnchorDelta >= 4 && contactHitstopAnchorDelta <= 8 &&
      phaseMetrics.contactToHitstop.compressed === true,
    'contact/hitstop left its compressed posture family', { contactHitstopAngleDelta, contactHitstopAnchorDelta, phase: phaseMetrics.contactToHitstop });
  requireImpact([4, 4, 5, 7].every((spriteFrame, index) =>
      impactFrames[index + 4].targetPose.spriteFrame === spriteFrame),
    'contact/recoil sprite-frame progression changed', impactFrames.slice(4, 8).map(frame => frame.targetPose.spriteFrame));

  const peakHoldFrames = impactFrames.slice(7, 10);
  const peakHoldEvidence = peakHoldFrames.map(frame => ({
    stage: frame.stage,
    pose: frame.targetPose,
    deltaFromPeak: poseDelta(recoil2Pose, frame.targetPose),
    hardpointProjection: frame.anchors.hardpoint.projection,
  }));
  requireImpact(peakHoldEvidence.every(({ deltaFromPeak }) =>
      deltaFromPeak.x <= 2 && deltaFromPeak.y <= 2 && deltaFromPeak.angle <= 2),
    'recoil-2/debris-1/debris-2 did not hold the target near peak before return', peakHoldEvidence);

  const trajectoryNames = ['earlyPanel', 'sparkA', 'sparkB'];
  const trajectoryEvidence = Object.fromEntries(trajectoryNames.map(name => {
    const samples = impactFrames.slice(5, 10).map((frame, offset) => ({
      stage: offset + 5,
      ...frame.trajectory[name],
    }));
    // `x/y` are screen coordinates and therefore include the rider's authored
    // recoil. Material continuity is measured in scar-local `dx/dy`; otherwise
    // the same attached node falsely appears to teleport when the target moves.
    const computedDeltas = samples.map((sample, index) => index === 0 ? 0 :
      Math.hypot(sample.dx - samples[index - 1].dx, sample.dy - samples[index - 1].dy));
    // The scar-local vector is the canonical renderer input. Recomputing from
    // rounded screen coordinates mixes anchor quantization into material travel.
    const scarDistances = samples.map(sample => Math.hypot(sample.dx, sample.dy));
    const scarDistanceSteps = scarDistances.map((value, index) => index === 0 ? 0 : value - scarDistances[index - 1]);
    return [name, { samples, computedDeltas, scarDistances, scarDistanceSteps }];
  }));
  requireImpact(Object.values(trajectoryEvidence).every(({ samples, scarDistances }) =>
      scarDistances[0] <= 12 || scarDistances[1] <= 12),
    'panel and two sparks did not originate by hitstop/recoil-1 within 12px', trajectoryEvidence);
  requireImpact(Object.values(trajectoryEvidence).every(({ samples, computedDeltas }) =>
      samples.every(sample => sample.sampleDelta <= 16) && computedDeltas.slice(1).every(delta => delta <= 16)),
    'panel/spark trajectory teleported by more than 16px before debris-2', trajectoryEvidence);
  requireImpact(Object.values(trajectoryEvidence).every(({ samples, scarDistances, scarDistanceSteps }) =>
      new Set(samples.map(sample => sample.id)).size === 1 &&
      scarDistances.every((value, index) => Math.abs(value - samples[index].distanceFromScar) <= 1) &&
      scarDistanceSteps.slice(1).every(step => step >= 8 && step <= 16) &&
      samples.slice(1).every((sample, index) => sample.distanceFromScar > samples[index].distanceFromScar &&
        sample.distanceStep >= 8 && sample.distanceStep <= 16)),
    'same panel/two sparks did not move strictly away from the scar in 8-16px steps', trajectoryEvidence);

  const smokeEvidence = impactFrames.slice(5).map(frame => ({ stage: frame.stage, ...frame.smoke }));
  const smokeNode = smokeEvidence[0].node;
  requireImpact(smokeEvidence.every(smoke => smoke.active && smoke.node === smokeNode && smoke.baseDistance <= 6) &&
      smokeEvidence.slice(1).every((smoke, index) =>
        smoke.diameter > smokeEvidence[index].diameter && smoke.value < smokeEvidence[index].value),
    'smoke detached, reset, failed to grow, or failed to lower value', smokeEvidence);

  const scarEvidence = impactFrames.slice(6).map((frame, offset) => {
    const scar = frame.trajectory.scar;
    return {
      stage: offset + 6,
      ...scar,
      computedSmokeDistance: Math.hypot(scar.smokeBaseX - scar.x, scar.smokeBaseY - scar.y),
    };
  });
  const scarNode = scarEvidence[0].node;
  requireImpact(scarEvidence.every(scar => scar.active && scar.node === scarNode && scar.node === smokeNode &&
      scar.w >= 18 && scar.h >= 16 && scar.distance <= 6 && scar.computedSmokeDistance <= 6 &&
      finite(scar.smokeDiameter) && finite(scar.smokeValue)),
    '18x16 scar did not remain attached to one node with smoke within 6px', scarEvidence);

  requireImpact(debris1?.panels >= 3 && debris1?.sparks >= 5 && debris1?.smokeDust >= 4,
    'three material populations are incomplete', debris1);
  requireImpact(debris1.panelSizes?.filter(size => size.w >= 10 && size.h >= 7).length >= 3,
    'three outlined armor panels do not meet 10x7px', debris1.panelSizes);
  requireImpact(debris1.sparkLengths?.filter(length => length >= 12 && length <= 24).length >= 5,
    'five tapered sparks do not meet 12-24px', debris1.sparkLengths);
  requireImpact(debris1.smokeDiameters?.filter(diameter => diameter >= 8 && diameter <= 18).length >= 4,
    'four smoke puffs do not meet 8-18px', debris1.smokeDiameters);
  requireImpact(debris2?.panelArcs?.filter(arc => arc >= 48).length >= 2 &&
      debris2?.panelRotations?.filter(rotation => Math.abs(rotation) >= 45).length >= 2,
    'two panel arcs did not clear 48px/45deg', { arcs: debris2?.panelArcs, rotations: debris2?.panelRotations });
  // Wave 11 samples the same authored fragments continuously from hitstop to
  // debris-2.  By debris-1 they must have travelled away from the scar; their
  // origin-at-hit gate is therefore covered by the trajectory start assertion
  // above rather than incorrectly constraining their later world positions.

  requireImpact(damageHold?.holdMs >= 550 && damageHold.missingPanelW >= 18 && damageHold.missingPanelH >= 16 &&
      damageHold.smokeBaseDistance <= 6 && damageHold.holdRecoverProjectionPx >= 12 &&
      damageHold.holdRecoverAngleDeg >= 5,
    'damage hold/scar/attached smoke contract failed', damageHold);
  requireImpact(recovered?.recoverGrounded === true && recovered.missingPanelW >= 18 && recovered.missingPanelH >= 16 &&
      recovered.smokeBaseDistance <= 6 && recovered.node === scarNode && recovered.contourChangedPct >= 5 &&
      recovered.particleCount <= debris2.particleCount * .5 &&
      phaseMetrics.holdRecover.projectionGapPx >= 12 && phaseMetrics.holdRecover.angleGapDeg >= 5 &&
      phaseMetrics.holdRecover.recoverWheelLift === 0,
    'recover did not preserve contour or halve residual particles', { recovered, debris2Particles: debris2.particleCount });

  const projectileCreates = Math.max(...impactFrames.map(frame => frame.projectile?.created ?? -1));
  const projectileConsumes = Math.max(...impactFrames.map(frame => frame.projectile?.consumed ?? -1));
  const projectileCreateTransitions = impactFrames.reduce((count, frame, index) =>
    count + (index > 0 && frame.projectile.created > impactFrames[index - 1].projectile.created ? 1 : 0), 0);
  const projectileConsumeTransitions = impactFrames.reduce((count, frame, index) =>
    count + (index > 0 && frame.projectile.consumed > impactFrames[index - 1].projectile.consumed ? 1 : 0), 0);
  const scoreAwards = Math.max(...impactFrames.map(frame => frame.scoreAwards ?? -1));
  requireImpact(scoreTransitions === 1 && scoreAwards === 1,
    'score was not awarded exactly once', { scoreTransitions, scoreAwards });
  requireImpact(projectileCreates === 1 && projectileConsumes === 1 &&
      projectileCreateTransitions === 1 && projectileConsumeTransitions === 1,
    'projectile was not created/consumed exactly once', {
      projectileCreates, projectileConsumes, projectileCreateTransitions, projectileConsumeTransitions,
    });

  checkpoints.impactChain = {
    captureContract: { width: 960, height: 540, names: impactNames },
    frames: impactFrames,
    scoreTransitions,
    projectileLifecycle: {
      creates: projectileCreates,
      consumes: projectileConsumes,
      createTransitions: projectileCreateTransitions,
      consumeTransitions: projectileConsumeTransitions,
    },
    silhouetteDelta,
    contactFreezeDelta,
    causalOrder: {
      spriteFrames: impactFrames.slice(4, 8).map(frame => frame.targetPose.spriteFrame),
      anchors: causalAnchorEvidence,
      peakTargetDelta,
      contactHitstop: {
        bodyAngleDelta: contactHitstopAngleDelta,
        hardpointDelta: contactHitstopAnchorDelta,
      },
      trajectories: trajectoryEvidence,
      scar: scarEvidence,
      phaseReadability: {
        firstOverlap: firstOverlapEvidence,
        hitstop: hitstopReadability,
        metrics: phaseMetrics,
        peakHold: peakHoldEvidence,
        smoke: smokeEvidence,
        recover: {
          projectionGapPx: damageHold.holdRecoverProjectionPx,
          angleGapDeg: damageHold.holdRecoverAngleDeg,
          grounded: recovered.recoverGrounded,
          missingContour: { width: recovered.missingPanelW, height: recovered.missingPanelH },
          smokeBaseDistance: recovered.smokeBaseDistance,
        },
      },
    },
    contactRegistration: {
      hit: impactFrames[4].fixedHit,
      projectileTip: { x: travel75.tipX, y: travel75.tipY },
      core: { x: contact.coreCenterX, y: contact.coreCenterY },
      leadingEdge: { x: contact.leadingEdgeX, y: contact.leadingEdgeY },
      overlap: { width: contact.overlapW, height: contact.overlapH },
      bbox: { width: contact.bboxW, height: contact.bboxH },
      layers: visibleLayers,
    },
    materialContract: { debris1, debris2, damageHold, recovered },
  };
  console.log(`[gauntlet] wave 12 impact chain: phase-readable contact / peak hold / continuous materials / late recover, peak ${JSON.stringify(peakTargetDelta)}`);

  // Fixed recovery regression views reuse the gameplay pose function while
  // keeping screenshot encoding outside the original eight-frame timer.
  const wobbleRegression = [];
  for (const [stage, expectedSign] of [['a', 1], ['b', -1], ['c', 1]]) {
    const staged = await page.evaluate(scene => window.__BMFM_DEBUG__.gotoScene(scene), `wobble-${stage}`);
    const wobbleX = staged.beat?.wobbleX ?? 0;
    if (Math.sign(wobbleX) !== expectedSign) {
      throw new Error(`Recovery wobble-${stage} lost sign ${expectedSign}: ${JSON.stringify(staged.beat)}`);
    }
    wobbleRegression.push({
      stage,
      wobbleX,
      angle: staged.beat?.wobbleAngle,
      forkOffset: staged.beat?.forkOffset,
      counterphase: staged.beat?.counterphase,
      shadowOffset: staged.beat?.shadowOffset,
      shadowWidth: staged.beat?.shadowWidth,
    });
    await shot(`wobble-${stage}`);
  }
  if (!(Math.abs(wobbleRegression[0].wobbleX) > Math.abs(wobbleRegression[1].wobbleX) &&
        Math.abs(wobbleRegression[1].wobbleX) > Math.abs(wobbleRegression[2].wobbleX))) {
    throw new Error(`Recovery wobble failed + / - / + decay: ${JSON.stringify(wobbleRegression)}`);
  }
  const wobbleAngles = wobbleRegression.map(frame => frame.angle);
  const forkTravel = Math.max(...wobbleRegression.map(frame => frame.forkOffset)) -
    Math.min(...wobbleRegression.map(frame => frame.forkOffset));
  if (!(wobbleAngles[0] >= 4 && wobbleAngles[1] <= -3 && wobbleAngles[2] >= 2 &&
        forkTravel >= 6 && wobbleRegression.every(frame => Math.abs(frame.counterphase) >= 4) &&
        wobbleRegression.every(frame => frame.shadowOffset !== frame.wobbleX) &&
        new Set(wobbleRegression.map(frame => `${frame.shadowOffset}:${frame.shadowWidth}`)).size === 3)) {
    throw new Error(`Recovery wobble lost rotation/fork/counterphase/contact-shadow contract: ${JSON.stringify({wobbleRegression,forkTravel})}`);
  }
  checkpoints.wobbleRegression = wobbleRegression;
  console.log(`[gauntlet] recovery wobble: ${wobbleRegression.map(frame => `${frame.stage}:${frame.wobbleX}`).join(', ')}`);

  await page.keyboard.down('KeyZ');
  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('miniboss'));
  await page.waitForTimeout(1800);
  checkpoints.combat = await assertState('playing');
  if (!checkpoints.combat.boss || checkpoints.combat.boss.kind !== 'miniboss') {
    throw new Error(`Miniboss did not spawn for combat capture: ${JSON.stringify(checkpoints.combat)}`);
  }
  await shot('combat');
  console.log('[gauntlet] combat');

  await page.keyboard.press('KeyP');
  await page.waitForTimeout(120);
  checkpoints.pause = await assertState('paused');
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(120);
  await assertState('playing');

  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('boss'));
  await page.waitForTimeout(1800);
  checkpoints.boss = await assertState('playing');
  if (!checkpoints.boss.boss || checkpoints.boss.boss.kind !== 'boss') {
    throw new Error(`Final boss did not spawn: ${JSON.stringify(checkpoints.boss)}`);
  }
  await shot('boss');
  console.log('[gauntlet] boss');

  for (let i = 0; i < 16; i += 1) {
    await page.keyboard.down(i % 2 === 0 ? 'ArrowUp' : 'ArrowDown');
    await page.waitForTimeout(350);
    await page.keyboard.up(i % 2 === 0 ? 'ArrowUp' : 'ArrowDown');
    if ((i + 1) % 4 === 0) console.log(`[gauntlet] boss exchange ${i + 1}/16`);
  }
  await page.keyboard.up('KeyZ');
  checkpoints.afterBossExchange = await state();
  await shot('boss-exchange');
  console.log('[gauntlet] boss exchange captured');

  // Exercise the real boss-death -> delayed victory -> restart path without
  // burning through a second full health bar in the software-rendered harness.
  checkpoints.victorySetup = await page.evaluate(() => {
    const game = window.redlineGame;
    const boss = game.enemies.find(enemy => enemy.kind === 'boss');
    if (boss) {
      boss.hp = 1;
      return 'armed-live-boss';
    }
    // A strong randomized exchange may legitimately finish the boss before
    // the deterministic one-HP shortcut. Accept that real kill and continue
    // through the same delayed victory transition instead of treating it as
    // a missing-entity harness failure.
    if (game.bossDefeated || game.mode === 'win') return 'real-kill-during-exchange';
    throw new Error('Boss missing before victory transition check without a recorded defeat');
  });
  await page.keyboard.down('KeyZ');
  await page.waitForFunction(() => window.__BMFM_DEBUG__.snapshot().state === 'win', undefined, { timeout: 45_000 });
  await page.keyboard.up('KeyZ');
  checkpoints.victory = await assertState('win');
  await shot('victory');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(180);
  checkpoints.restart = await assertState('playing');

  // Keep a real third-hero production capture in every full Gauntlet report.
  // This catches per-sheet pivot, muzzle, and scale regressions that the Modo
  // ride and Throttle combat sentence cannot expose.
  await page.goto(new URL('/?scene=game&hero=vinnie', baseURL).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__BMFM_DEBUG__));
  await page.waitForFunction(() => {
    const snapshot = window.__BMFM_DEBUG__.snapshot();
    return snapshot.hero === 'vinnie' && snapshot.atlas &&
      Object.keys(snapshot.atlas).length === 12 && Object.values(snapshot.atlas).every(sheet => sheet.state === 'ready');
  });
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(850);
  await page.keyboard.up('KeyZ');
  await page.keyboard.up('ArrowRight');
  checkpoints.vinnieRide = await assertState('playing');
  if (checkpoints.vinnieRide.hero !== 'vinnie') {
    throw new Error(`Vinnie debug capture selected the wrong hero: ${JSON.stringify(checkpoints.vinnieRide)}`);
  }
  await shot('vinnie-ride');
  console.log('[gauntlet] Vinnie ride');

  // Wave 13 sustained-fire contract. Each sequence is driven by the production
  // keyboard path for at least three seconds, while the deterministic debug
  // latch makes the exact release boundary inspectable between RAF samples.
  const captureSustainedFire = async ({ hero, rapid = false, count, durationMs, prefix }) => {
    await page.keyboard.up('KeyZ').catch(() => {});
    await page.goto(new URL(`/?scene=game&hero=${hero}`, baseURL).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(expectedHero => {
      const snapshot = window.__BMFM_DEBUG__?.snapshot();
      return snapshot?.hero === expectedHero && snapshot.atlas &&
        Object.keys(snapshot.atlas).length === 12 &&
        Object.values(snapshot.atlas).every(sheet => sheet.state === 'ready');
    }, hero);
    const staged = await page.evaluate(rapidFlag => window.__BMFM_DEBUG__.gotoScene('sustain', rapidFlag), rapid ? 1 : 0);
    if (staged.state !== 'playing' || staged.hero !== hero || !staged.fireState) {
      throw new Error(`Sustained-fire scene failed for ${hero}/${rapid ? 'rapid' : 'normal'}: ${JSON.stringify(staged)}`);
    }

    await page.keyboard.down('KeyZ');
    await page.evaluate(() => window.__BMFM_DEBUG__.setDebugFireHeld(true));
    await page.waitForFunction(() => window.__BMFM_DEBUG__.snapshot().fireState?.held === true);
    const origin = (await state()).elapsed;
    const samples = [];
    for (let index = 0; index < count; index += 1) {
      // Fourteen samples over four seconds advance by ~308 ms.  That interval
      // cannot alias the 444 ms authored body cycle, unlike the old ten-sample
      // schedule whose 444 ms spacing repeatedly landed on one animation cell.
      const target = origin + .16 + (durationMs / 1_000) * index / (count - 1);
      await waitForElapsed(target);
      const snapshot = await state();
      const fire = snapshot.fireState;
      if (!fire) throw new Error(`Missing fireState during ${prefix}-${index}: ${JSON.stringify(snapshot)}`);
      samples.push({
        index,
        elapsed: snapshot.elapsed,
        held: fire.held,
        grounded: fire.grounded,
        bodyMode: fire.bodyMode,
        loopKind: fire.loopKind,
        loopFrame: fire.loopFrame,
        shotsFired: fire.shotsFired,
        recoilOffset: fire.recoilOffset,
        anchorX: fire.anchorX,
        anchorY: fire.anchorY,
        anchorBaseX: fire.anchorBaseX,
        anchorBaseY: fire.anchorBaseY,
        roadBaseline: fire.roadBaseline,
        bodyBBox: fire.bodyBBox,
        rapid: fire.rapid,
        jumpPose: fire.jumpPose,
        releaseBlend: fire.releaseBlend,
      });
      await canvasShot(`${prefix}-${String(index).padStart(2, '0')}`);
    }

    const requireSustain = (condition, message, evidence) => {
      if (!condition) throw new Error(`Wave 13 sustained fire (${prefix}): ${message}: ${JSON.stringify(evidence)}`);
    };
    const numeric = value => Number.isFinite(value);
    requireSustain(samples.length === count && samples.every(sample =>
        sample.held === true && sample.grounded === true && sample.bodyMode === 'sustained' &&
        sample.loopKind === 'sustained' && Number.isInteger(sample.loopFrame) &&
        sample.loopFrame >= 0 && sample.loopFrame <= 3 && sample.jumpPose === false &&
        sample.rapid === rapid && numeric(sample.shotsFired) && numeric(sample.recoilOffset) &&
        numeric(sample.anchorX) && numeric(sample.anchorY) && numeric(sample.anchorBaseX) &&
        numeric(sample.anchorBaseY) && numeric(sample.roadBaseline) &&
        sample.bodyBBox && ['x','y','w','h'].every(key => numeric(sample.bodyBBox[key]))),
      'held/grounded fire-loop schema or no-jump invariant failed', samples);

    const elapsedSpanMs = Math.round((samples.at(-1).elapsed - samples[0].elapsed) * 1_000);
    const sampleIntervalsMs = samples.slice(1).map((sample, index) =>
      Math.round((sample.elapsed - samples[index].elapsed) * 1_000));
    const expectedIntervalMs = durationMs / (count - 1);
    // Canvas PNG serialization under SwiftShader advances RAF while encoding;
    // allow that bounded capture cost without weakening the total held-time gate.
    const captureIntervalToleranceMs = Math.max(280, expectedIntervalMs * .5);
    requireSustain(elapsedSpanMs >= durationMs - 80 &&
        sampleIntervalsMs.every(interval => Math.abs(interval - expectedIntervalMs) <= captureIntervalToleranceMs),
      'samples were not evenly spaced across the required held-fire duration', { elapsedSpanMs, sampleIntervalsMs, expectedIntervalMs });

    const shotDeltas = samples.slice(1).map((sample, index) => sample.shotsFired - samples[index].shotsFired);
    requireSustain(shotDeltas.every(delta => delta > 0),
      'shotsFired did not increase at every sustained sample', { shots: samples.map(sample => sample.shotsFired), shotDeltas });

    const range = values => Math.max(...values) - Math.min(...values);
    const normalizedAnchorX = samples.map(sample => sample.anchorX + sample.recoilOffset);
    const anchorBBox = {
      minX: Math.min(...normalizedAnchorX), maxX: Math.max(...normalizedAnchorX),
      minY: Math.min(...samples.map(sample => sample.anchorY)), maxY: Math.max(...samples.map(sample => sample.anchorY)),
    };
    const bodyBBoxBase = samples.map(sample => ({
      x: sample.bodyBBox.x + sample.recoilOffset,
      y: sample.bodyBBox.y,
      w: sample.bodyBBox.w,
      h: sample.bodyBBox.h,
    }));
    const bodyBBoxJitter = {
      x: range(bodyBBoxBase.map(box => box.x)), y: range(bodyBBoxBase.map(box => box.y)),
      w: range(bodyBBoxBase.map(box => box.w)), h: range(bodyBBoxBase.map(box => box.h)),
    };
    const anchorJitter = { x: anchorBBox.maxX - anchorBBox.minX, y: anchorBBox.maxY - anchorBBox.minY };
    const roadJitter = range(samples.map(sample => sample.roadBaseline));
    const normalizedAnchorError = Math.max(...samples.map((sample, index) => Math.max(
      Math.abs(normalizedAnchorX[index] - sample.anchorBaseX),
      Math.abs(sample.anchorY - sample.anchorBaseY),
      Math.abs(sample.anchorBaseY - sample.roadBaseline),
    )));
    requireSustain(anchorJitter.x <= 6 && anchorJitter.y <= 4 && bodyBBoxJitter.x <= 6 &&
        bodyBBoxJitter.y <= 4 && bodyBBoxJitter.w <= 2 && bodyBBoxJitter.h <= 2 &&
        roadJitter <= 4 && normalizedAnchorError <= .01,
      'body anchor/bbox or road baseline jitter exceeded the grounded contract', { anchorJitter, bodyBBoxJitter, roadJitter, normalizedAnchorError, anchorBBox });

    await page.keyboard.up('KeyZ');
    // Capture the synchronous release boundary before a slow SwiftShader RAF
    // can consume the entire 130 ms recovery during PNG-heavy test runs.
    const releasedAt = await page.evaluate(() => window.__BMFM_DEBUG__.setDebugFireHeld(false));
    const release = [{ elapsed: releasedAt.elapsed, ...releasedAt.fireState }];
    for (const delay of [50, 50, 80, 120, 160]) {
      await page.waitForTimeout(delay);
      const snapshot = await state();
      release.push({ elapsed: snapshot.elapsed, ...snapshot.fireState });
    }
    await canvasShot(`${prefix}-release`);
    const releaseChain = [{
      anchorX: samples.at(-1).anchorX,
      anchorY: samples.at(-1).anchorY,
      releaseBlend: samples.at(-1).releaseBlend,
    }, ...release];
    const anchorPops = releaseChain.slice(1).map((sample, index) =>
      Math.hypot(sample.anchorX - releaseChain[index].anchorX, sample.anchorY - releaseChain[index].anchorY));
    const releaseBlends = release.map(sample => sample.releaseBlend);
    requireSustain(release.every(sample => sample && sample.held === false && sample.grounded === true && sample.jumpPose === false) &&
        release.some(sample => sample.bodyMode === 'recover') && release.at(-1).bodyMode === 'ride' &&
        anchorPops.every(pop => pop <= 6) &&
        releaseBlends.slice(1).every((blend, index) => blend <= releaseBlends[index] + .001),
      'explicit release did not recover smoothly to ride or produced an anchor pop', { release, anchorPops, releaseBlends });

    const shotCount = samples.at(-1).shotsFired - samples[0].shotsFired;
    const fireLoopFrames = [...new Set(samples.map(sample => sample.loopFrame))];
    requireSustain(!rapid || fireLoopFrames.length >= 3,
      'rapid-fire capture aliased the body loop instead of showing motion', { fireLoopFrames, samples });
    return {
      hero, rapid, capturePrefix: prefix, count, durationMs: elapsedSpanMs,
      sampleIntervalsMs, samples, shotDeltas, shotCount,
      cadenceShotsPerSecond: Number((shotCount / Math.max(.001, elapsedSpanMs / 1_000)).toFixed(2)),
      fireLoopFrames,
      anchorBBox, anchorJitter, bodyBBoxJitter, roadJitter, normalizedAnchorError,
      release: { samples: release, anchorPops, returnedToRide: release.at(-1).bodyMode === 'ride' },
      jumpPoseObserved: samples.some(sample => sample.jumpPose),
    };
  };

  const sustainedThrottle = await captureSustainedFire({ hero: 'throttle', count: 6, durationMs: 3_200, prefix: 'sustain-throttle' });
  const sustainedModo = await captureSustainedFire({ hero: 'modo', count: 6, durationMs: 3_200, prefix: 'sustain-modo' });
  const sustainedVinnie = await captureSustainedFire({ hero: 'vinnie', count: 6, durationMs: 3_200, prefix: 'sustain-vinnie' });
  const sustainedVinnieRapid = await captureSustainedFire({ hero: 'vinnie', rapid: true, count: 14, durationMs: 4_000, prefix: 'sustain-vinnie-rapid' });
  if (sustainedVinnieRapid.cadenceShotsPerSecond <= sustainedVinnie.cadenceShotsPerSecond * 1.25) {
    throw new Error(`Vinnie rapid cadence failed to clear normal cadence by 25%: ${JSON.stringify({ normal: sustainedVinnie.cadenceShotsPerSecond, rapid: sustainedVinnieRapid.cadenceShotsPerSecond })}`);
  }
  checkpoints.sustainedFire = {
    contract: { canvas: { width: 960, height: 540 }, grounded: true, normalDurationMinMs: 3_000, rapidDurationMinMs: 4_000, anchorJitterMax: { x: 6, y: 4 }, releasePopMaxPx: 6 },
    throttle: sustainedThrottle,
    modo: sustainedModo,
    vinnie: sustainedVinnie,
    vinnieRapid: sustainedVinnieRapid,
  };
  console.log(`[gauntlet] sustained fire: throttle ${sustainedThrottle.cadenceShotsPerSecond}/s, modo ${sustainedModo.cadenceShotsPerSecond}/s, Vinnie ${sustainedVinnie.cadenceShotsPerSecond}/s, rapid ${sustainedVinnieRapid.cadenceShotsPerSecond}/s`);

  // Wave 14 release bridge.  Each production requestAnimationFrame is copied
  // to a private canvas and only encoded after the motion window is complete.
  // Unlike a chain of Playwright screenshots, this cannot skip the 150 ms
  // authored recovery while the software renderer encodes a previous frame.
  // Every file is therefore one sequential real canvas frame spanning the
  // final ~250 ms of held fire and at least 300 ms after release.
  const captureReleaseBridge = async ({ hero, rapid = false }) => {
    const capturePrefix = `release-${hero}${rapid ? '-rapid' : ''}`;
    await page.keyboard.up('KeyZ').catch(() => {});
    await page.goto(new URL(`/?scene=game&hero=${hero}`, baseURL).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(expectedHero => {
      const snapshot = window.__BMFM_DEBUG__?.snapshot();
      return snapshot?.hero === expectedHero && snapshot.atlas &&
        Object.keys(snapshot.atlas).length === 12 &&
        Object.values(snapshot.atlas).every(sheet => sheet.state === 'ready');
    }, hero);
    const staged = await page.evaluate(rapidFlag => window.__BMFM_DEBUG__.gotoScene('sustain', rapidFlag), rapid ? 1 : 0);
    if (staged.state !== 'playing' || staged.hero !== hero || !staged.fireState) {
      throw new Error(`Release bridge scene failed for ${capturePrefix}: ${JSON.stringify(staged)}`);
    }

    await page.keyboard.down('KeyZ');
    await page.evaluate(() => window.__BMFM_DEBUG__.setDebugFireHeld(true));
    await page.waitForFunction(() => window.__BMFM_DEBUG__.snapshot().fireState?.held === true, undefined, { polling: 'raf' });
    // Let the authored sustained loop settle before this capture's final hold window.
    await page.waitForTimeout(120);

    let rawCapture;
    try {
      rawCapture = await page.evaluate(async ({ holdMs, postReleaseMs }) => {
        const api = window.__BMFM_DEBUG__;
        const canvas = document.querySelector('canvas');
        if (!api || !(canvas instanceof HTMLCanvasElement)) throw new Error('Release bridge debug API/canvas missing');
        if (canvas.width !== 960 || canvas.height !== 540) {
          throw new Error(`Expected 960x540 release canvas, received ${canvas.width}x${canvas.height}`);
        }

        const startElapsed = api.snapshot().elapsed;
        let releaseIssuedElapsed = null;
        const frames = [];
        return await new Promise((resolve, reject) => {
          let rafCount = 0;
          const finish = () => {
            // Encode only after the complete motion window has been copied.
            // Encoding a 960x540 PNG inside every RAF throttled SwiftShader to
            // ~30 fps and hid every other recovery pose; lightweight canvas
            // copies preserve the actual production-RAF cadence.
            const serialized = frames.map(({ frozenCanvas, ...metadata }) => ({
              ...metadata,
              pngBase64: frozenCanvas.toDataURL('image/png').split(',')[1],
            }));
            resolve({ startElapsed, releaseIssuedElapsed, frames: serialized });
          };
          const sample = () => {
            try {
              rafCount += 1;
              const snapshot = api.snapshot();
              const fire = snapshot.fireState;
              if (!fire) throw new Error(`fireState missing at RAF ${rafCount}`);
              const frozenCanvas = document.createElement('canvas');
              frozenCanvas.width = canvas.width;
              frozenCanvas.height = canvas.height;
              const frozenContext = frozenCanvas.getContext('2d');
              if (!frozenContext) throw new Error(`2D freeze context missing at RAF ${rafCount}`);
              frozenContext.drawImage(canvas, 0, 0);
              frames.push({
                elapsed: snapshot.elapsed,
                held: fire.held,
                grounded: fire.grounded,
                bodyMode: fire.bodyMode,
                loopKind: fire.loopKind,
                loopFrame: fire.loopFrame,
                releaseFrame: fire.releaseFrame,
                releaseElapsedMs: fire.releaseElapsedMs,
                releaseDurationMs: fire.releaseDurationMs,
                recoilOffset: fire.recoilOffset,
                anchorX: fire.anchorX,
                anchorY: fire.anchorY,
                anchorBaseX: fire.anchorBaseX,
                anchorBaseY: fire.anchorBaseY,
                roadBaseline: fire.roadBaseline,
                bodyBBox: fire.bodyBBox,
                silhouetteChangePct: fire.silhouetteChangePct,
                frozenCanvas,
              });

              // The crossing frame is still a genuinely rendered held-fire
              // image.  Release is latched immediately afterwards, then the
              // next production RAF updates and renders authored frame zero.
              if (releaseIssuedElapsed === null && (snapshot.elapsed - startElapsed) * 1_000 >= holdMs) {
                const released = api.setDebugFireHeld(false);
                releaseIssuedElapsed = released.elapsed;
              }

              const postReleaseElapsed = releaseIssuedElapsed === null ? -1 :
                (snapshot.elapsed - releaseIssuedElapsed) * 1_000;
              if (releaseIssuedElapsed !== null && postReleaseElapsed >= postReleaseMs && frames.length >= 12) {
                finish();
                return;
              }
              if (rafCount >= 90) {
                reject(new Error(`Release bridge exceeded 90 RAF samples (${JSON.stringify({ startElapsed, releaseIssuedElapsed, postReleaseElapsed, frames: frames.length })})`));
                return;
              }
              requestAnimationFrame(sample);
            } catch (error) {
              reject(error);
            }
          };
          requestAnimationFrame(sample);
        });
      }, { holdMs: 250, postReleaseMs: 300 });
    } finally {
      await page.keyboard.up('KeyZ').catch(() => {});
    }

    const frames = [];
    for (let index = 0; index < rawCapture.frames.length; index += 1) {
      const { pngBase64, ...metadata } = rawCapture.frames[index];
      const file = `${capturePrefix}-${String(index).padStart(2, '0')}.png`;
      await writeFile(path.join(outputDir, file), Buffer.from(pngBase64, 'base64'));
      frames.push({ index, file, ...metadata });
    }

    const requireRelease = (condition, message, evidence) => {
      if (!condition) throw new Error(`Wave 14 release bridge (${capturePrefix}): ${message}: ${JSON.stringify(evidence)}`);
    };
    const numeric = value => Number.isFinite(value);
    const metricRange = values => Math.max(...values) - Math.min(...values);
    const intervalsMs = frames.slice(1).map((frame, index) =>
      Math.round((frame.elapsed - frames[index].elapsed) * 1_000));
    const sortedIntervalsMs = [...intervalsMs].sort((a, b) => a - b);
    const medianIntervalMs = sortedIntervalsMs[Math.floor(sortedIntervalsMs.length / 2)];
    const meanIntervalMs = intervalsMs.reduce((sum, interval) => sum + interval, 0) / intervalsMs.length;
    // Headless SwiftShader may render at 25-60 fps depending on host load.  We
    // capture every production RAF (the 60fps-equivalent sampling strategy),
    // retain at least twelve images, and separately require all three 50 ms
    // authored release frames; the report records measured cadence honestly.
    requireRelease(frames.length >= 12 && intervalsMs.every(interval => interval > 0 && interval <= 40),
      'capture skipped a production RAF or fell below twelve sequential frames', {
        count: frames.length, intervalsMs, medianIntervalMs, meanIntervalMs,
      });

    const heldFrames = frames.filter(frame => frame.held === true);
    const releasedFrames = frames.filter(frame => frame.held === false);
    requireRelease(heldFrames.length >= 2 && releasedFrames.length >= 4 &&
        heldFrames.every(frame => frame.grounded === true && frame.bodyMode === 'sustained' &&
          frame.loopKind === 'sustained' && frame.releaseFrame === -1) &&
        frames.slice(0, heldFrames.length).every(frame => frame.held === true) &&
        frames.slice(heldFrames.length).every(frame => frame.held === false),
      'held fire entered ride/neutral or the release boundary reversed', {
        held: heldFrames.map(frame => ({ index: frame.index, mode: frame.bodyMode, releaseFrame: frame.releaseFrame })),
        released: releasedFrames.map(frame => ({ index: frame.index, mode: frame.bodyMode, releaseFrame: frame.releaseFrame })),
      });

    const recoveryFrames = releasedFrames.filter(frame => frame.bodyMode === 'recover');
    const firstRideIndex = releasedFrames.findIndex(frame => frame.bodyMode === 'ride');
    const releaseFrameOrder = [...new Set(recoveryFrames.map(frame => frame.releaseFrame))];
    const noBackwardReleaseFrame = recoveryFrames.slice(1).every((frame, index) =>
      frame.releaseFrame >= recoveryFrames[index].releaseFrame);
    requireRelease(releaseFrameOrder.length === 3 && releaseFrameOrder.every((frame, index) => frame === index) &&
        noBackwardReleaseFrame && firstRideIndex > recoveryFrames.length - 1 &&
        releasedFrames.slice(0, firstRideIndex).every(frame => frame.bodyMode === 'recover') &&
        releasedFrames.slice(firstRideIndex).every(frame => frame.bodyMode === 'ride'),
      'authored release frames did not progress 0 -> 1 -> 2 before ride', {
        releaseFrameOrder, firstRideIndex,
        frames: releasedFrames.map(frame => ({ index: frame.index, mode: frame.bodyMode, releaseFrame: frame.releaseFrame, releaseElapsedMs: frame.releaseElapsedMs })),
      });

    const firstRide = releasedFrames[firstRideIndex];
    const bridgeDurationMs = Math.round((firstRide.elapsed - rawCapture.releaseIssuedElapsed) * 1_000);
    requireRelease(bridgeDurationMs >= 120 && bridgeDurationMs <= 180,
      'recover-to-ride transition left the authored 120-180 ms window', { bridgeDurationMs, releaseIssuedElapsed: rawCapture.releaseIssuedElapsed, firstRide });

    requireRelease(frames.every(frame => frame.grounded === true && numeric(frame.anchorX) && numeric(frame.anchorY) &&
        numeric(frame.anchorBaseX) && numeric(frame.anchorBaseY) && numeric(frame.roadBaseline) &&
        frame.bodyBBox && ['x','y','w','h'].every(key => numeric(frame.bodyBBox[key]))),
      'ground/base/top-edge metric schema is incomplete', frames);
    const wheelBaseAnchorJitter = {
      anchorX: metricRange(frames.map(frame => frame.anchorX)),
      anchorY: metricRange(frames.map(frame => frame.anchorY)),
      baseX: metricRange(frames.map(frame => frame.anchorBaseX)),
      baseY: metricRange(frames.map(frame => frame.anchorBaseY)),
      road: metricRange(frames.map(frame => frame.roadBaseline)),
    };
    requireRelease(Object.values(wheelBaseAnchorJitter).every(delta => delta <= 1),
      'wheel/base anchor moved by more than 1 px across release', wheelBaseAnchorJitter);

    const topEdgeStepPx = frames.slice(1).map((frame, index) =>
      Math.abs(frame.bodyBBox.y - frames[index].bodyBBox.y));
    requireRelease(topEdgeStepPx.every(delta => delta <= 4),
      'body top edge moved by more than 4 px between consecutive frames', { topEdgeStepPx });

    const silhouetteValues = frames.map(frame => frame.silhouetteChangePct);
    const silhouetteExposed = silhouetteValues.every(numeric);
    requireRelease(!silhouetteExposed || silhouetteValues.every(value => value <= 15),
      'runtime-exposed silhouette change exceeded 15 percent', { silhouetteValues });
    const firstFrameMs = Math.round((frames[0].elapsed - rawCapture.startElapsed) * 1_000);
    const renderedHoldMs = Math.round((rawCapture.releaseIssuedElapsed - frames[0].elapsed) * 1_000);
    const renderedPostReleaseMs = Math.round((frames.at(-1).elapsed - rawCapture.releaseIssuedElapsed) * 1_000);
    requireRelease(renderedHoldMs >= 200 && renderedPostReleaseMs >= 290,
      'capture did not cover the requested hold/release windows', { firstFrameMs, renderedHoldMs, renderedPostReleaseMs });

    return {
      hero,
      rapid,
      capturePrefix,
      frameCount: frames.length,
      timing: {
        clock: 'production-simulation / one real requestAnimationFrame per PNG',
        cadence: 'every sequential production RAF captured; PNG encoded after frame copies',
        intervalsMs,
        medianIntervalMs,
        meanIntervalMs: Number(meanIntervalMs.toFixed(2)),
        renderedHoldMs,
        renderedPostReleaseMs,
        bridgeDurationMs,
      },
      releaseFrameOrder,
      wheelBaseAnchorJitter,
      topEdgeStepPx,
      silhouette: silhouetteExposed ? {
        source: 'runtime fireState.silhouetteChangePct',
        thresholdPct: 15,
        values: silhouetteValues,
      } : {
        source: 'real canvas PNG sequence; runtime metric not exposed',
        thresholdPct: null,
        values: null,
        evidenceFiles: frames.map(frame => frame.file),
      },
      frames,
    };
  };

  const releaseThrottle = await captureReleaseBridge({ hero: 'throttle' });
  const releaseModo = await captureReleaseBridge({ hero: 'modo' });
  const releaseVinnie = await captureReleaseBridge({ hero: 'vinnie' });
  const releaseVinnieRapid = await captureReleaseBridge({ hero: 'vinnie', rapid: true });
  checkpoints.releaseBridge = {
    contract: {
      canvas: { width: 960, height: 540 },
      capture: 'one real production RAF per canvas copy; sequential PNG encoding after capture',
      holdWindowMs: 250,
      postReleaseWindowMinMs: 300,
      frameCountMin: 12,
      authoredFrameOrder: [0, 1, 2],
      bridgeDurationMs: [120, 180],
      wheelBaseAnchorJitterMaxPx: 1,
      consecutiveTopEdgeMovementMaxPx: 4,
      exposedSilhouetteChangeMaxPct: 15,
    },
    throttle: releaseThrottle,
    modo: releaseModo,
    vinnie: releaseVinnie,
    vinnieRapid: releaseVinnieRapid,
  };
  console.log(`[gauntlet] release bridge: ${[releaseThrottle, releaseModo, releaseVinnie, releaseVinnieRapid].map(result => `${result.capturePrefix} ${result.frameCount}f/${result.timing.bridgeDurationMs}ms`).join(', ')}`);

  // P0 muzzle-origin contract.  The first real projectile created after each
  // latch is captured inside the same production RAF that rendered the muzzle,
  // so the image and hardpoint metadata describe one frame rather than two
  // adjacent animation cells.  Ground capture also takes the very next release
  // frame, proving that the short muzzle pulse does not jump back to the head.
  const captureMuzzleOrigin = async hero => {
    const writeCapturedFrame = async (file, captured) => {
      await writeFile(path.join(outputDir, file), Buffer.from(captured.pngBase64, 'base64'));
      const { pngBase64, ...metadata } = captured;
      return { file, ...metadata };
    };
    const requireMuzzle = (condition, message, evidence) => {
      if (!condition) throw new Error(`Wave 14 muzzle origin (${hero}): ${message}: ${JSON.stringify(evidence)}`);
    };
    const numeric = value => Number.isFinite(value);
    const validate = (sample, expectedMode, expectedSheet) => {
      const fire = sample.fireState;
      requireMuzzle(fire && fire.bodyMode === expectedMode && fire.visibleBarrelHardpoint?.sheet === expectedSheet &&
          numeric(fire.visibleBarrelHardpoint.x) && numeric(fire.visibleBarrelHardpoint.y) &&
          numeric(fire.muzzleX) && numeric(fire.muzzleY) && fire.projectileOrigin?.hero === hero &&
          numeric(fire.projectileOrigin.x) && numeric(fire.projectileOrigin.y) &&
          numeric(fire.projectileOriginDeltaPx),
        `${expectedMode} muzzle/projectile schema is incomplete`, sample);
      const deltaToVisibleBarrelPx = Math.hypot(
        fire.projectileOrigin.x - fire.visibleBarrelHardpoint.x,
        fire.projectileOrigin.y - fire.visibleBarrelHardpoint.y,
      );
      const muzzleToVisibleBarrelPx = Math.hypot(
        fire.muzzleX - fire.visibleBarrelHardpoint.x,
        fire.muzzleY - fire.visibleBarrelHardpoint.y,
      );
      requireMuzzle(deltaToVisibleBarrelPx <= 6 && muzzleToVisibleBarrelPx <= .01 && fire.projectileOriginDeltaPx <= .01,
        `${expectedMode} projectile/muzzle did not originate at the visible barrel`, {
          deltaToVisibleBarrelPx, muzzleToVisibleBarrelPx,
          runtimeProjectileOriginDeltaPx: fire.projectileOriginDeltaPx,
          visibleBarrelHardpoint: fire.visibleBarrelHardpoint,
          projectileOrigin: fire.projectileOrigin,
        });
      return {
        deltaToVisibleBarrelPx: Number(deltaToVisibleBarrelPx.toFixed(3)),
        muzzleToVisibleBarrelPx: Number(muzzleToVisibleBarrelPx.toFixed(3)),
        runtimeProjectileOriginDeltaPx: fire.projectileOriginDeltaPx,
      };
    };

    await page.keyboard.up('KeyZ').catch(() => {});
    await page.goto(new URL(`/?scene=game&hero=${hero}`, baseURL).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(expectedHero => {
      const snapshot = window.__BMFM_DEBUG__?.snapshot();
      return snapshot?.hero === expectedHero && snapshot.atlas &&
        Object.keys(snapshot.atlas).length === 12 &&
        Object.values(snapshot.atlas).every(sheet => sheet.state === 'ready');
    }, hero);
    await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('sustain', 0));
    await page.evaluate(() => window.__BMFM_DEBUG__.setDebugFireHeld(false));
    await page.waitForFunction(() => window.__BMFM_DEBUG__.snapshot().fireState?.bodyMode === 'ride', undefined, { polling: 'raf' });
    await page.waitForTimeout(280);

    await page.keyboard.down('KeyZ');
    const groundRaw = await page.evaluate(async expectedHero => {
      const api = window.__BMFM_DEBUG__;
      const canvas = document.querySelector('canvas');
      if (!api || !(canvas instanceof HTMLCanvasElement)) throw new Error('Muzzle-origin debug API/canvas missing');
      const baselineShots = api.snapshot().fireState?.shotsFired ?? -1;
      api.setDebugFireHeld(true);
      return await new Promise((resolve, reject) => {
        let rafCount = 0;
        const shotStep = () => {
          try {
            rafCount += 1;
            const snapshot = api.snapshot();
            const fire = snapshot.fireState;
            if (fire?.shotsFired > baselineShots && fire.projectileOrigin && fire.bodyMode === 'sustained') {
              const sustained = {
                hero: snapshot.hero,
                elapsed: snapshot.elapsed,
                fireState: fire,
                pngBase64: canvas.toDataURL('image/png').split(',')[1],
              };
              api.setDebugFireHeld(false);
              requestAnimationFrame(() => {
                // Keep the sustained frame and release-frame resolver in one
                // page task; no external screenshot latency can intervene.
                const finishRelease = () => {
                  try {
                    rafCount += 1;
                    const releaseSnapshot = api.snapshot();
                    const releaseFire = releaseSnapshot.fireState;
                    if (releaseFire?.held === false && releaseFire.bodyMode === 'recover' && releaseFire.releaseFrame === 0) {
                      resolve({
                        sustained,
                        release: {
                          hero: releaseSnapshot.hero,
                          elapsed: releaseSnapshot.elapsed,
                          fireState: releaseFire,
                          pngBase64: canvas.toDataURL('image/png').split(',')[1],
                        },
                      });
                      return;
                    }
                    if (rafCount >= 12) {
                      reject(new Error(`Release muzzle frame zero was not rendered for ${expectedHero}: ${JSON.stringify(releaseFire)}`));
                      return;
                    }
                    requestAnimationFrame(finishRelease);
                  } catch (error) {
                    reject(error);
                  }
                };
                finishRelease();
              });
              return;
            }
            if (rafCount >= 12) {
              reject(new Error(`First sustained projectile was not observed for ${expectedHero}: ${JSON.stringify(fire)}`));
              return;
            }
            requestAnimationFrame(shotStep);
          } catch (error) {
            reject(error);
          }
        };
        requestAnimationFrame(shotStep);
      });
    }, hero);
    await page.keyboard.up('KeyZ');

    // A clean scene avoids carrying ground-shot cooldown into the airborne
    // sample.  Jump and projectile both still travel through production input,
    // update, spawn and draw code.
    await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('sustain', 0));
    await page.evaluate(() => window.__BMFM_DEBUG__.setDebugFireHeld(false));
    await page.waitForFunction(() => window.__BMFM_DEBUG__.snapshot().fireState?.bodyMode === 'ride', undefined, { polling: 'raf' });
    await page.waitForTimeout(280);
    await page.keyboard.press('KeyX');
    await page.waitForFunction(() => window.__BMFM_DEBUG__.snapshot().fireState?.bodyMode === 'airborne', undefined, { polling: 'raf' });
    await page.keyboard.down('KeyZ');
    const jumpRaw = await page.evaluate(async expectedHero => {
      const api = window.__BMFM_DEBUG__;
      const canvas = document.querySelector('canvas');
      if (!api || !(canvas instanceof HTMLCanvasElement)) throw new Error('Jump muzzle debug API/canvas missing');
      const baselineShots = api.snapshot().fireState?.shotsFired ?? -1;
      api.setDebugFireHeld(true);
      return await new Promise((resolve, reject) => {
        let rafCount = 0;
        const step = () => {
          try {
            rafCount += 1;
            const snapshot = api.snapshot();
            const fire = snapshot.fireState;
            if (fire?.shotsFired > baselineShots && fire.projectileOrigin && fire.bodyMode === 'airborne') {
              api.setDebugFireHeld(false);
              resolve({
                hero: snapshot.hero,
                elapsed: snapshot.elapsed,
                fireState: fire,
                pngBase64: canvas.toDataURL('image/png').split(',')[1],
              });
              return;
            }
            if (rafCount >= 24 || fire?.grounded === true) {
              reject(new Error(`First airborne projectile was not observed for ${expectedHero}: ${JSON.stringify(fire)}`));
              return;
            }
            requestAnimationFrame(step);
          } catch (error) {
            reject(error);
          }
        };
        requestAnimationFrame(step);
      });
    }, hero);
    await page.keyboard.up('KeyZ');

    requireMuzzle(groundRaw.sustained.hero === hero && groundRaw.release.hero === hero && jumpRaw.hero === hero,
      'capture switched hero unexpectedly', { groundRaw, jumpRaw });
    const sustainedFile = `muzzle-${hero}-sustained.png`;
    const releaseFile = `muzzle-${hero}-release.png`;
    const jumpFile = `muzzle-${hero}-jump.png`;
    const sustained = await writeCapturedFrame(sustainedFile, groundRaw.sustained);
    const release = await writeCapturedFrame(releaseFile, groundRaw.release);
    const jump = await writeCapturedFrame(jumpFile, jumpRaw);
    const sustainedMetrics = validate(sustained, 'sustained', 'sustained');
    const releaseMetrics = validate(release, 'recover', 'release');
    const jumpMetrics = validate(jump, 'airborne', 'authored');
    requireMuzzle(release.fireState.releaseFrame === 0,
      'release muzzle was not captured on authored bridge frame zero', release.fireState);
    requireMuzzle(sustained.fireState.projectileOrigin.sheet === 'sustained' &&
        jump.fireState.projectileOrigin.sheet === 'authored' &&
        sustained.fireState.projectileOrigin.frame === sustained.fireState.visibleBarrelHardpoint.frame &&
        jump.fireState.projectileOrigin.frame === jump.fireState.visibleBarrelHardpoint.frame,
      'projectile origin metadata did not preserve the body sheet/frame that fired it', { sustained, jump });
    return {
      hero,
      contract: { projectileToVisibleBarrelMaxPx: 6, muzzleToVisibleBarrelMaxPx: .01, runtimeOriginDeltaMaxPx: .01 },
      sustained: { ...sustainedMetrics, sample: sustained },
      release: { ...releaseMetrics, sample: release },
      jump: { ...jumpMetrics, sample: jump },
    };
  };

  const muzzleThrottle = await captureMuzzleOrigin('throttle');
  const muzzleModo = await captureMuzzleOrigin('modo');
  const muzzleVinnie = await captureMuzzleOrigin('vinnie');
  checkpoints.projectileOrigin = {
    contract: {
      productionFirstProjectile: true,
      heroes: ['throttle', 'modo', 'vinnie'],
      poses: ['sustained', 'release-frame-0', 'airborne'],
      projectileToVisibleBarrelMaxPx: 6,
    },
    throttle: muzzleThrottle,
    modo: muzzleModo,
    vinnie: muzzleVinnie,
  };
  console.log(`[gauntlet] projectile origin: ${[muzzleThrottle, muzzleModo, muzzleVinnie].map(result => `${result.hero} ${result.sustained.deltaToVisibleBarrelPx}/${result.release.deltaToVisibleBarrelPx}/${result.jump.deltaToVisibleBarrelPx}px`).join(', ')}`);

  // A real aerial-wave integration capture: both authored aerial classes are
  // spawned into the normal update/collision/render loop and fire gameplay shots.
  await page.evaluate(() => window.__BMFM_DEBUG__.gotoScene('aerial'));
  await page.waitForTimeout(620);
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(260);
  checkpoints.aerialCombat = await assertState('playing');
  await page.keyboard.up('KeyZ');
  if (checkpoints.aerialCombat.hero !== 'throttle' || checkpoints.aerialCombat.enemies < 2 || checkpoints.aerialCombat.boss) {
    throw new Error(`Aerial integration scene was not live: ${JSON.stringify(checkpoints.aerialCombat)}`);
  }
  await shot('aerial-combat');
  console.log('[gauntlet] aerial combat');

  if (runtimeErrors.length) {
    throw new Error(`Browser runtime errors:\n${runtimeErrors.join('\n')}`);
  }
  const report = { ok: true, checkpoints, runtimeErrors };
  await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await page.keyboard.up('KeyZ').catch(() => {});
  await browser.close();
}
