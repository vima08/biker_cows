# Wave 16 integration / smoothing verdict

Verdict: **PASS — local co-op is integrated end to end with no blocking solo regression.** This is an integration verdict, not a claim that every presentation beat has reached premium polish.

## Evidence inspected

- Canonical automation: `report.json` (`ok: true`, 13/13 atlases ready, `runtimeErrors: []`).
- Co-op: `coop-select.png`, `coop-ride.png`, `coop-fire.png`, `coop-combat.png`, `coop-friendly-fire.png`, `coop-enemy-hit.png`, `coop-one-down.png`, `coop-defeat.png`, `coop-boss-exchange.png`, `coop-victory.png`.
- Solo regression: `menu.png`, `select.png`, `ride.png`, `combat.png`, `boss.png`, `boss-exchange.png`, `victory.png`.
- Production build: `npm run build` passed after the integration changes.

## Integration findings

- Selection hierarchy is clear: yellow P1 and cyan P2 rails identify independent Modo/Vinnie choices; the footer exposes both keyboard mappings, both readiness actions, gamepads 1+2, and the Tab escape back to one player. The three character cards remain legible behind the two active frames.
- Rider scale and pivots are coherent. Modo appropriately reads heavier/larger than Vinnie; the staggered ground lanes keep both bikes identifiable even when their silhouettes partially overlap. Neither rider floats above the road or clips through the lower HUD.
- The two compact top HUD blocks are symmetric and readable, with separate HP, armor, special, weapon, and DOWN state. The centered team score/timer establishes a useful shared hierarchy without hiding play space.
- Sustained fire is owner-readable: Modo's cyan spread and Vinnie's magenta laser originate at distinct bike hardpoints. The canonical snapshot recorded 34 P1 shots and 70 P2 shots, both held-fire states, owner IDs 1 and 2, and distinct muzzle coordinates.
- Combat clutter is high but controlled: projectile families remain color-coded and foreground rocks do not erase both riders simultaneously. Enemy contact gives a visible hit frame/shield cue and only the targeted P2 vitals changed (HP/armor 90/15 to 84.96/2.04).
- Friendly fire is disabled in the real projectile path: a P1 projectile crossed P2's collision rectangle and both riders' HP/armor remained exactly unchanged.
- Team failure flow is correct. One rider down leaves state `playing`; both riders down transition to `lose`; restart restores two live riders. The added persistent dimmed wreck, smoke, pointer, and `P2 DOWN` beacon now make the one-down state unambiguous in the world as well as the HUD.
- Boss flow is intact and readable. `coop-boss-exchange.png` contains the complete boss silhouette, full boss bar, two riders, and visible rocket streams; the snapshot records an intact 720/720 boss and projectiles from both owners. The run then reaches `win`, and victory restart preserves two-player mode.
- Ending cards now identify the team in both defeat and victory (`MODO + VINNIE` in player colors); saved local score names also preserve the team pairing. Solo endings keep the original single-rider identity.
- Solo menu, select, ride, miniboss combat, final boss, explosion exchange, victory, and restart gates all passed in the same canonical run.

## Changes made during smoothing

1. Added a persistent world-space downed-rider wreck/readout instead of relying on a transient explosion.
2. Added two-rider identity to win/lose cards and co-op high-score labels.
3. Removed a harness input race by placing consecutive character-select taps on distinct animation frames; no production input timing was changed.

## Remaining premium gap (non-blocking)

During simultaneous max-rank rocket fire the long smoke ribbons from both riders merge into one broad band. Ownership remains inferable from muzzle origins and lanes, and the boss silhouette/bar stay readable, so this is not an integration failure. A future premium pass could give P1/P2 rocket exhaust subtly different accent embers or stagger the ribbon decay without altering damage, cadence, or collision logic.
