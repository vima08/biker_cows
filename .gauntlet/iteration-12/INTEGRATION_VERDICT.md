# Wave 12 — integration / smoothing verdict

## Verdict

**PASS — wave 12 is integrated, deterministic, and visually coherent as a complete production route.**

This is an integration verdict, not the independent AAA visual-jury verdict. I inspected the final 960×540 production captures before using `report.json` as evidence, compared the impact sequence with iteration 11, and then checked wobble, miniboss, boss, boss exchange, victory, Vinnie, and the aerial encounter.

## Visual inspection

- `impact-04-contact` preserves the intact target silhouette and the registered white/hot/cyan contact hierarchy.
- `impact-05-hitstop` is now a distinct compressed phase rather than a second contact flash: the displaced blue panel, two hot sparks, and first soot seed are visible around the front hardpoint.
- `impact-06` through `impact-09` read as one mass transfer. Recoil reaches a clear peak and holds through recoil-2, debris-1, and debris-2 while the same panel and sparks move away from the scar.
- The blue panels, tapered hot sparks, and charcoal smoke remain visually separable. Shortening the two overlong sparks did not reduce their hierarchy.
- Attached smoke grows and darkens across the sequence instead of resetting. Damage-hold remains visibly farther and more rotated than recover; recover is grounded while the torn blue contour and attached soot remain.
- Wobble A/B/C show distinct positive/negative/positive body rotation, fork travel, head/gun counterphase, and matching shadow changes without clipping or pivot jumps.
- The normal encounter, Road Ripper, boss reveal/exchange, victory, Vinnie, and aerial roster retain consistent sprite scale, palette, pixel density, and HUD layering. No integration regression was found outside the impact chain.

Compared with iteration 11, wave 12 has substantially clearer phase uniqueness at hitstop, a longer readable peak hold, persistent material trajectories, and a more convincing late recovery.

## Runtime evidence

- canonical report: `ok=true`, `runtimeErrors=[]`, all 10 atlases `ready`;
- full route: menu → select → gameplay → miniboss → boss → victory → restart, plus Vinnie and aerial regression;
- production-simulation beat: `2100 ms`;
- contact bbox: `96×72 px`; contact→hitstop: `5.66 px / 2°`, compressed;
- four anchor families: maximum reverse `0 px`;
- contact→peak: `40×18 px / 14°`;
- recoil-2, debris-1, and debris-2: identical peak transform;
- persistent panel/spark material steps: `8.44–15.48 px`, without identity reset;
- smoke: diameter `12→44 px`, value `54→24`, base distance `4.47 px`;
- damage-hold→recover: `22.98 px / 6°`; recover wheel lift `0`;
- persistent scar: `18×16 px`; one projectile create/consume and one score transition.

## Integration fixes made

1. Corrected harness trajectory checks to use scar-local `dx/dy`; screen coordinates include target recoil and cannot measure material travel independently.
2. Restored the retained tapered-spark contract by aligning renderer and snapshot to `24/22/20/18/16 px`.
3. Exported the four real quantized smoke-puff diameters used by the renderer, restoring visual/runtime contract coverage.
4. Anchored the legacy eight-frame beat's final sample to absolute production simulation time (`beatOrigin + 2.10`) to remove contact-quantization timing flakes without widening its `1.95–2.14 s` gate.

## Verification

```text
npm run build: PASS
npm run test:smoke: PASS
report.json: ok=true, runtimeErrors=[]
```

Canonical evidence is in `.gauntlet/iteration-12/`; no unresolved wave-12 integration blocker remains.
