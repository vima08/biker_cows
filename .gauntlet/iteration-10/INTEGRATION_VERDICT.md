# Wave 10 — Integration / Smoothing Verdict

## Verdict

**INTEGRATION PASS.** This is a production-integration verdict, not an independent
"AAA of its era" visual verdict. The fresh visual critic remains responsible for
that separate bar.

## Evidence reviewed

- Reviewed every production capture in `.gauntlet/iteration-10-runtime` before
  reading its report: impact `00`–`11`, wobble `a/b/c`, menu, select, ride,
  combat, aerial combat, boss, boss exchange, and victory.
- Compared impact `04`, `08`, `09`, `10`, and `11` directly with iteration 9.
- Rechecked the current-source canonical renders in `.gauntlet/iteration-10`.
- Canonical smoke report: `ok=true`, 10/10 atlases ready, 12 ordered impact
  captures, `runtimeErrors=[]`, victory and restart both reached.

## Impact-chain findings

- Contact is registered on the rider's front hardpoint: the white core overlaps
  the fork/body silhouette by `20x18 px`; the full burst occupies `96x72 px`.
- Rear halo is rendered before the enemy, while the core, rim, and sparks are
  rendered in the foreground. All five production layers are reported visible.
- No target reaction occurs in muzzle or travel frames. Throttle recoil returns
  monotonically (`8/10 -> 6/8 -> 2/3 -> 0/0` shoulder/gun).
- Target recoil is progressive and mass-bearing: it peaks at
  `-34/-16 px, -14 deg`, with fork lag, wheel lift, and changing contact shadow.
- Armor panels, tapered sparks, and smoke/dust are visually distinct; all three
  large panels originate within 12 px of the registered hit and then separate.
- The missing-panel scar and smoke remain attached to the moving damaged node;
  recovery preserves the contour change while reducing residual material from
  the 12-piece debris population to one attached smoke/scar element.
- Wobble `a/b/c` alternates direction with fork/head counterphase and three
  distinct shadows, so it reads as damped vehicle mass rather than sprite jitter.

## Regression findings

- Normal ride, combat, aerial roster, Road Ripper, boss exchange, victory, and
  restart remain visually and mechanically intact.
- Canonical combat beat is inside its authored envelope (`2120 ms`, contact at
  `850 ms`) and still comes from the normal projectile/collision update path.
- No source changes were necessary during this smoothing pass.

