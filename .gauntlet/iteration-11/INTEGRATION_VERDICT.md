# Wave 11 — Integration / Smoothing Verdict

## Verdict

**INTEGRATION PASS.** This is a production-integration verdict, not the independent visual jury or an AAA acceptance claim.

The current production build completed the canonical browser route with `ok=true`, all 10 local atlases ready, 12 ordered impact captures, the legacy eight-frame beat, recovery wobble, combat, pause, boss exchange and real boss kill, victory, restart, Vinnie, and the authored aerial wave. `runtimeErrors=[]`.

## Visual pass before report read

- Inspected `impact-00` through `impact-11` in order at the native 960×540 canvas size, then compared the contact, hitstop, both recoil, both debris, hold, and recover frames directly with iteration 10.
- `impact-04` and `impact-05` remain one posture family but read in the intended contact → compressed hitstop order. The final hardpoint delta is 7.21 px and the body-angle delta is 2°, inside the 8 px / 4° gate.
- `impact-06` and `impact-07` are a monotonic, increasing recoil gesture, not an alternating recovery wobble. The target progresses from 20×10 px / 8° to the retained 34×16 px / 14° peak; the later `wobble-a/b/c` remains visibly smaller and alternates sign.
- A recognizable blue panel and two tapered sparks are present by recoil-1. Their positions continue through debris-2 with maximum sampled steps below 16 px; there is no visual teleport or material reset.
- The 18×16 scar and smoke root remain attached to the same `frontHardpoint` node from recoil-1 through recover. Smoke-base distance remains 4 px in every sampled pose.
- Menu, select, ride, combat, aerial combat, boss, boss exchange, and victory retain the established atlas scale, pivoting, pixel density, palette, and HUD hierarchy. No asset, pivot, or scale regression was found.

## Objective integration fixes

The first smoke exposed two stale Wave-10 harness assumptions and one 2 px quantization edge:

1. The obsolete recoil-1 `24 px` threshold was aligned with the authored two-step Wave-11 curve: recoil-1 must reach 20×10 px / 8°, while the independent peak assertion still requires 34×16 px / 14° at recoil-2.
2. Hitstop horizontal translation was reduced from 4 px to 2 px so the quantized hardpoint remains within the 8 px same-family gate.
3. Spark A's final sample was moved by 1 px on each axis, removing a quantized 16.97 px hop while preserving its continuous outgoing arc. The obsolete requirement that debris-1 world positions remain within 12 px of their origin was removed; initial proximity is already asserted at hitstop/recoil-1 and conflicts with continuous outward travel by debris-1.

## Report evidence

- Build: `npm run build` — pass.
- Smoke: `.gauntlet/iteration-11/report.json` — `ok=true`.
- Atlas readiness: 10/10; `riderImpact` has 12 frames.
- Impact order: `pre → muzzle → travel-25 → travel-75 → contact → hitstop → recoil-1 → recoil-2 → debris-1 → debris-2 → damage-hold → recover`.
- Projectile lifecycle: one create and one consume; one score transition.
- Causal peak: 34 px × 16 px / 14°.
- Legacy beat clock: production simulation, 2130 ms total, contact at 860 ms.
- Boss route: boss encounter, exchange, real kill, `win`, then restart to `playing`.
- Runtime/network/browser errors: none.

The integration layer is ready for a fresh independent visual critic. That critic must decide perceptual ordering and the AAA-of-its-era bar without using this verdict as a cue.
