# Wave 13 strict visual critique

## Verdict

**PASS for the corrected held-fire acceptance; near-premium rather than fully premium 16-bit.** The production captures finally hold a coherent grounded firing silhouette for the whole trigger hold. Across the 3.19-3.22 s rider sequences and the 4.01 s rapid-Vinnie sequence, I saw **zero neutral-ride flashes**, zero road-baseline jumps, and no accidental airborne pose. The new select screen also passes: it is no longer embarrassing and is a dramatic art-tier improvement over iteration 12.

The single largest remaining user-visible gap is **the end of the firing animation**: release preserves the wheel/road anchor, but the sustained silhouette still hands back to the neutral ride silhouette as a visible pose pop rather than through an authored bridge.

## Blind visual findings

### Grounded held fire - corrected primary gate

- `sustain-throttle-00..05`, `sustain-modo-00..05`, `sustain-vinnie-00..05`, and especially `sustain-vinnie-rapid-00..09` stay inside one recognizable firing family. No rider drops upright into a neutral ride frame between shots.
- Wheel contact and bike scale are unusually stable. The restrained 0-2 px recoil movement reads as suspension rather than whole-body teleporting; the road baseline stays locked.
- Throttle has the clearest speed cues through the scarf and changing crouch. Modo keeps an appropriately heavy, planted mass. Vinnie remains clean and readable even under the much denser laser stream.
- Rapid Vinnie is stable but intentionally restrained: the beam stream carries more of the cadence than the body, while the wheels, ear/hair, and tail move only subtly. That is acceptable for the corrected stability target, though one more weapon-synchronous upper-body accent would raise the animation tier.
- The jump comparison is only partial. `aerial-combat.png` contains aerial enemies but the rider is visually grounded, and the report confirms `jumpPose: false` there. The earlier ride checkpoint verifies an airborne Modo state, but this evidence set does not fully show a held-fire ground-to-jump-to-land sequence. I saw no regression, but this is not a strong visual sign-off on that handoff.

### Release transition - the remaining gap

The post-release captures keep their hubs/baseline stable, but the head, torso, and overall negative space change at once when ride resumes. Throttle is the clearest pop: the deep firing crouch becomes the tall neutral pose. Modo and Vinnie do the same at smaller amplitude.

The runtime report's `0-1 px` release result measures the draw anchor, not the opaque sprite silhouette. Comparing the actual final held atlas phase used by each capture with ride frame 0 at the same anchor gives:

| Capture | Top opaque-edge change | Alpha-mask change |
| --- | ---: | ---: |
| Throttle | 32.5 rendered px | 31.5% |
| Modo | 13.8 rendered px | 15.7% |
| Vinnie normal | 15.0 rendered px | 23.1% |
| Vinnie rapid | 18.1 rendered px | 24.0% |

This explains why the release can look like a snap even while the reported anchor is perfect. It is a one-time flaw, not the old repeated held-fire flaw, but it is now the most conspicuous break in otherwise stable rider animation.

### Select screen - second gate

- The three portraits now have immediate identities: Throttle's green goggles and warm captain silhouette, Modo's massive cybernetic arm/eyepatch, and Vinnie's white hair, grin, and red racing suit. They are consistent in crop, lighting, finish, and scale.
- Selected-card enlargement, rider-color bloom, dimmed neighbors, the `SELECTED` tag, and weapon/special colors create a clear hierarchy without losing names or stats. The footer help remains readable.
- The portraits are more painterly than the gameplay sprites, but the scanline/pixel treatment and shared palette integrate them well enough with the title and HUD. Compared with iteration 12's placeholder heads, this is a genuine finished-screen transformation.

### Combat / boss regression

`menu.png`, `ride.png`, `combat.png`, `boss.png`, `boss-exchange.png`, and `victory.png` remain coherent and feature-complete. The boss silhouette is imposing, parallax/background depth is strong, and combat effects retain clear faction colors. `boss-exchange.png` is deliberately busy, but the rider, attack direction, score events, and boss damage remain legible. Nothing in wave 13 visually regressed this layer. Against the local Contra/Gunstar/Thunder Force/Batman references, the game now competes well on static detail and screen composition; sprite-transition continuity is the remaining difference from the best reference-tier animation.

## Exact next measurable DoD

Author a real sustained-to-ride release bridge for all three riders and verify it from production at 60 fps:

1. Capture the final 250 ms of a grounded hold plus the first 300 ms after release for Throttle, Modo, Vinnie, and rapid Vinnie.
2. Use at least **three distinct authored bridge poses over 120-180 ms**; do not hold one firing frame and then swap directly to ride.
3. After wheel-hub alignment, every consecutive release frame must keep both wheel hubs/road contact within **1 px**, move the rider's top opaque edge by no more than **4 rendered px**, and keep silhouette XOR/union change at or below **15%**.
4. The head/shoulders must progress monotonically from firing crouch to ride posture, with no backward pose reversal, no airborne frame, and no neutral ride frame while `held` is true.
5. The same continuous captures must retain the current held-fire result: **0 neutral flashes during the full 3-5 s hold**, fixed road baseline, and no browser/runtime errors.

Meeting that DoD would close the one visible animation discontinuity without disturbing the corrected held-fire win.
