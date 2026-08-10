# Iteration 8 integration / smoothing verdict

Status: **PASS**

- Production build passes (`tsc -b && vite build`, 9 modules).
- Full browser smoke passes: title, select, Modo ride, Throttle combat beat,
  miniboss, pause/resume, final boss, boss exchange, victory, restart, Vinnie,
  and the authored aerial wave.
- All 8 sprite atlases report `ready`; browser `runtimeErrors` is empty.
- The eight-frame impact sentence is a real update-loop collision and completes
  in 2100 ms (contact at 830 ms). Recovery regression is `+8 / -6 / +4`.
- Compared with iteration 7, the authored panorama is now the sole far horizon.
  It is cleaner without becoming empty: mesas, refinery silhouettes and stars
  carry the distance, while lamps, signs, guardrail, shoulders, road bands,
  reflectors and material events preserve near/mid depth and speed.
- Gameplay projectiles, boss shield/orb language, impacts, debris and explosions
  read as hard-edged pixel clusters. There are no gameplay Canvas gradients or
  blur; the remaining title gradient/blur is confined to the title screen.
- `combat-beat-6.png` presents the intended seven separated debris particles.
  The three fixed wobble captures visibly alternate right/left/right with decay.

Harness smoothing fixes in this wave:

1. Beat captures serialize the real gameplay canvas directly, preventing slow
   SwiftShader viewport PNG encoding from advancing the simulation by ~300 ms
   per frame.
2. Victory setup accepts both valid outcomes of the real boss exchange: a live
   boss is reduced to one HP, while an already-recorded real kill proceeds via
   the same delayed victory transition.

Primary evidence: `report.json`, `ride.png`, `combat.png`,
`combat-beat-0.png` through `combat-beat-7.png`, `wobble-a.png` through
`wobble-c.png`, `aerial-combat.png`, `boss.png`, `boss-exchange.png`,
`victory.png`, and `vinnie-ride.png` in this directory.
