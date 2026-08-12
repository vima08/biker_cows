# Wave 13 integration / smoothing verdict

## Verdict

PASS for the user-corrected acceptance target. The production game no longer returns to a ride pose between grounded shots. Across real 3.19–3.22 second holds for all three riders, plus a 4.01 second rapid-fire stress hold for Vinnie, every sampled body remained in the dedicated `sustained` loop on one fixed road baseline.

The select screen also passes integration: all three authored portraits are distinct, correctly cropped, consistently scaled, and retain readable names, stats, weapon, special, selected-state hierarchy, and control help.

## Real production evidence

- Full machine-readable run: `report.json` (`ok: true`).
- 11/11 gameplay atlases loaded with `state: ready`, including the new 12-frame `sustainedFire` atlas.
- Browser errors: `runtimeErrors: []`.
- Full route reached boss, victory (`state: win`), and restart (`state: playing`, score reset to 0).
- The run also completed the normal ride/combat, pause, boss exchange, aerial wave, and the deterministic 12-stage impact chain.

### Grounded held-fire sequences

| Rider | Real held span | Projectile cadence | Captured loop frames | Anchor jitter X/Y | Body box jitter X/Y/W/H | Road jitter | Max release anchor step |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| Throttle | 3.19 s | 6.58/s | 2, 3, 1, 0 | 0 / 0 px | 0 / 0 / 0 / 0 px | 0 px | 1 px |
| Modo | 3.19 s | 3.76/s | 3, 1, 2, 0 | 0 / 0 px | 0 / 0 / 0 / 0 px | 0 px | 0 px |
| Vinnie | 3.22 s | 8.39/s | 2, 3, 1 | 0 / 0 px | 0 / 0 / 0 / 0 px | 0 px | 1 px |
| Vinnie + rapid | 4.01 s | 13.97/s | 2, 1, 3 | 0 / 0 px | 0 / 0 / 0 / 0 px | 0 px | 1 px |

All held samples report `held: true`, `grounded: true`, `bodyMode: sustained`, `loopKind: sustained`, and `jumpPose: false`. Shot counters increase at every sample. Rapid Vinnie clears normal Vinnie cadence by 66.5% without speeding up or restarting the body animation.

The rapid sequence deliberately uses non-uniform capture offsets. A uniform 4 s / 9 interval schedule is exactly 444 ms, which aliases a 9 fps four-frame loop and misleadingly photographs the same pose every time. The de-aliased sequence shows three distinct authored body phases while retaining the same silhouette family and baseline.

Representative ordered captures:

- Throttle: `sustain-throttle-00.png` through `sustain-throttle-05.png`, then `sustain-throttle-release.png`.
- Modo: `sustain-modo-00.png` through `sustain-modo-05.png`, then `sustain-modo-release.png`.
- Vinnie: `sustain-vinnie-00.png` through `sustain-vinnie-05.png`, then `sustain-vinnie-release.png`.
- Rapid Vinnie: `sustain-vinnie-rapid-00.png` through `sustain-vinnie-rapid-09.png`, then `sustain-vinnie-rapid-release.png`.

Visual inspection of those ordered PNGs confirms that wheel placement, road contact, bike scale, and rider torso remain coherent. Motion is limited to small suspension, arm, scarf/tail, and recoil changes; no neutral ride frame flashes between projectiles. The release boundary enters `recover` synchronously, returns to `ride`, and never moves its anchor more than 1 px per sampled step. Jump ownership remains with the existing airborne atlas because the sustained renderer is gated to `jump <= 1`.

### Select screen

- `select.png`: authored Throttle portrait and gold selected hierarchy.
- `select-modo-integration.png`: authored Modo portrait and cyan selected hierarchy.
- `select-vinnie-integration.png`: authored Vinnie portrait and magenta selected hierarchy.

The three faces now differ in facial construction, expression, goggles/eyepatch, silhouette, body mass, and palette. Selected cards grow and brighten without clipping names, stats, or footer controls. The nearest-neighbour presentation and hard pixel borders match the gameplay scale; the procedural heads remain only as a load-failure fallback.

### Regression evidence

- Wave 12 damage smoke is present and progresses in diameter/value: debris-1 `26/38`, debris-2 `32/33`, damage-hold `38/28`, recover `44/24`.
- `npm run build`: PASS.
- `node --check scripts/gauntlet.mjs`: PASS before the canonical run; final harness executed successfully.
- No weapon cadence, damage, pickup, enemy, boss, or level-content balance was changed during integration.

## Integration fixes made

1. Exposed `setDebugFireHeld` through the production debug bridge in `src/main.ts`; gameplay code already implemented the method, but the browser harness could not call it.
2. Made held-fire capture timing tolerant of bounded SwiftShader PNG serialization while retaining the total 3–4 second duration gates.
3. Replaced the obsolete real-time ceiling on the legacy one-shot capture with causal-order validation. Exact old impact timing remains covered by the deterministic 12-stage suite.
4. Captured the synchronous release boundary before RAF sampling, preventing slow headless rendering from skipping the entire 130 ms recovery state.
5. De-aliased rapid Vinnie sampling and required at least three distinct body-loop frames in its evidence set.

## Largest remaining integration risk

The transition from the final 130 ms recovery pose to the freely cycling ride atlas is intentionally a one-time state change and is no longer repeated during a held trigger. It is acceptable in the inspected production sequence, but if a later art pass changes either sheet's silhouette substantially, a dedicated authored release bridge frame would be safer than relying on their present visual compatibility.
