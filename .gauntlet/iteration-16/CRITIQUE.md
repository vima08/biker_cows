# Wave 16 — strict visual/gameplay critique

## Verdicts

- **Requested co-op scope: PASS.** The captured path and runtime facts cover a genuinely functional two-player loop: selection, distinct riders, independent held fire, owner-tagged projectiles, no friendly fire, targeted enemy damage, one-player-down continuation, both-down defeat, boss completion, and two-player restart.
- **Whole-game premium: NO.** This is a strong, unusually polished prototype, but continuous co-op action is not yet as immediately parseable as the best 16-bit references.

## Blind visual read

The two-player setup is understandable. The solo select screen advertises `TAB 2 PLAYERS`; the co-op screen switches to paired P1/P2 cards, separate cyan/pink focus, `P1 AD + Z READY` and `P2 LEFT/RIGHT + NUM1 READY`, then lists both full control sets. Modo and Vinnie are excellent co-op choices: huge blue/steel versus lean white/red/gold makes their silhouettes unmistakable whenever they are separated.

The play HUD is disciplined and readable: P1 left, team score/time centered, P2 right, with names, weapons, HP, armor, and special meter retained at a glance. In ordinary held fire, Modo's cyan three-lane spread and Vinnie's long pink laser are visually distinct and originate at convincing bike/barrel hardpoints. The fire and combat captures read as two different weapons owned by two different riders, not one undifferentiated effect cloud.

The state-change beats are clear. The enemy-hit frame marks Vinnie with an impact box while only P2's HP/armor falls. The one-down frame says `P2 DOWN` both in the HUD and at the wreck, while Modo remains visible and a simultaneous `+950` enemy destruction communicates that play continues. The defeat frame requires and displays both riders down before `BIKE WRECKED`. The boss has reference-grade scale and an obvious glowing weak point; the victory panel names `MODO + VINNIE`, and both defeat and victory offer an immediate ride-again path.

The solo menu/select/ride/combat/boss/victory chain shows no visual regression. It preserves the stronger single-player hierarchy, responsive muzzle/projectile alignment, large boss spectacle, and readable win/restart presentation.

## Runtime corroboration

`report.json` is green (`ok: true`, zero runtime errors). It records Modo + Vinnie with separate keyboard schemes, three chronological co-op ride/fire/combat samples, and projectile owners 1 and 2. Its friendly-fire probe crosses P1 fire through P2 while P2 remains at 90 HP; the production enemy collision then targets P2 for 18 total damage. With P2 down, state remains `playing` and one rider is alive; with both down, state becomes `lose`. Both defeat restart and victory restart return to `playing` with two players. The co-op boss resolves to `win` with two players, while solo independently reaches `win` and restarts to `playing`.

The still labeled friendly-fire does not visually prove immunity by itself, but the before/after runtime probe does. Conversely, the enemy-hit still and runtime loss reinforce each other well.

## Reference comparison

Against the local Thunder Force IV, Gunstar Heroes, Contra: Hard Corps, and Batman references (found under iteration 5 because the requested iteration-0 reference folder is absent), this build matches the important 16-bit virtues: bold silhouettes, economical HUD framing, high-contrast shots, oversized machinery, and a single dominant boss weak point. Its widescreen art and final boss presentation can look richer than the references. The references still win at preserving an instantly countable player/action read during the busiest live composition.

## Largest remaining gap

**Continuous co-op player/ownership readability during sustained, crowded play.** The opening ride and especially the boss exchange stack Modo and Vinnie almost directly on top of one another; at the boss, both riders also fire the same un-tinted red/white rocket streams. A player can stop being able to answer “where am I, and which firing cadence is mine?” without consulting the HUD. Preserve a small enforced formation offset or stronger per-player outline/ground marker, and carry P1/P2 color language into shared-weapon trails, muzzle flashes, and impact accents. That single improvement would make actual minute-to-minute co-op feel premium rather than merely make each required phase testable.
