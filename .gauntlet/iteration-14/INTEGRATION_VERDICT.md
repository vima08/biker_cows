# Wave 14 integration / smoothing verdict

Verdict: **PASS**. The canonical Wave 14 capture matches the current source and no integration defect requiring a code change was found.

## Priority checks

- Grounded held fire stays exclusively in the authored `sustained` body mode for Throttle, Modo, Vinnie, and rapid-fire Vinnie. Across the 3.2 s normal and 4.0 s rapid captures, wheel/body anchors have `0 px` X/Y jitter and never snap to a ride or jump pose.
- Vinnie's observed cadence rises from `8.44 shots/s` to `13.5 shots/s` under rapid fire while retaining the same stable body anchor.
- Trigger release traverses authored frames `0 -> 1 -> 2` for all three heroes (and the separate rapid-Vinnie pass), then returns to ride. Measured bridge duration is 150-180 ms and the road/wheel-base anchor remains at `0 px` jitter.
- The first production projectile and muzzle flash now share the visible bike barrel/nose hardpoint. Grounded sustained and airborne deltas are `0 px` for every hero; the release-frame-0 delta is 2.291 px for Throttle, 1.72 px for Modo, and 1.766 px for Vinnie, all below the 6 px contract. The screenshots visibly place the shot below the head line and at the machine-mounted weapon.
- The select screen still uses the authored, distinct three-character portrait set with a strong selected-card hierarchy and readable controls/stats.

## Whole-route checks

- Canonical report: `ok: true`, 12/12 atlases ready, `runtimeErrors: []`.
- Route exercised: title -> select -> start -> ride -> normal combat -> pause -> boss exchange -> victory -> restart.
- The scripted collision beat completed in the production simulation window without capture latency overrunning the authored sequence.
- Final boss was active and damageable in the boss exchange; victory reached `state: win`; restart returned to `state: playing`, score 0, elapsed 0.22 s.
- No visual regression was found in menu, select, combat, aerial combat, boss, victory, or the existing impact sequence.

## Evidence reviewed

- `integration-review/muzzle-all.png`
- `integration-review/sustain-throttle.png`
- `integration-review/sustain-modo.png`
- `integration-review/sustain-vinnie-rapid.png`
- `integration-review/release-throttle.png`
- `integration-review/release-modo.png`
- `integration-review/release-vinnie.png`
- `integration-review/release-vinnie-rapid.png`
- `integration-review/route.png`
- `integration-review/impact.png`
- `report.json`

## Build hygiene

- `npm run build`: pass
- `node --check scripts/gauntlet.mjs`: pass
- `git diff --check`: pass (line-ending notices only)

No source edit was made during smoothing: the persisted canonical capture already proves the user-visible fixes against the current source.
