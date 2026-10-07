# Presentation asset loading

The initial HTML shows a loading message while the JavaScript bundle downloads.
Once the game starts, `PresentationAssets` gates critical artwork by scene:

| Scene | Required images |
| --- | --- |
| Title | Cover illustration |
| Selection | Three-character portrait atlas |
| Intro | All four comic panels |
| Finale | Both ending panels |

The cover, intro/finale panels and all three active gameplay panoramas use JPG
at their original resolution (quality 88), reducing their combined download size
from 32.65 MB to 5.17 MB. PNG sources remain available for artwork edits; the game
loads only the JPG variants. After editing a source, regenerate them on Windows
with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/compress_backgrounds.ps1`.
Gameplay sprite sheets remain PNG.

The selection portrait atlas uses WebP (quality 90) with its original alpha
channel and 768 x 192 dimensions: 37,254 bytes instead of 175,768 bytes (79% smaller).
Its PNG source remains available for edits. Regenerate the WebP on Windows with
`node scripts/compress_portraits.mjs` (requires the installed Edge browser, or
set `BCFV_BROWSER` to another Chromium executable).

The loading screen replaces the scene until every required image has finished
decoding. Scene input and intro/finale timers stay frozen. Progress counts ready
files, not downloaded bytes. Portraits preload after the cover is ready; intro
panels preload during selection. Optional gameplay sprite sheets start after the
intro is ready or immediately for a direct gameplay/debug URL. Critical requests
use high priority; optional sprite/environment requests use low priority.

An attempt with no download activity for two minutes becomes an error. Each
received chunk restarts the deadline, allowing a slow but active download to
continue. Decoding also has a two-minute deadline. Failed
images can be retried with Enter, R, fire on a gamepad, or clicking the canvas.
Successful images remain available and are not requested again. After an error,
F (or the gamepad special button) explicitly allows the scene's existing
procedural/text fallback. Loading never silently chooses this fallback.
`art=vector` intentionally bypasses presentation artwork.

Validation: `npm run test:loading`. The browser harness uses fresh contexts and
held requests to check cover/portrait/intro/finale gates, progress, frozen input
and clocks, request reuse, decoding completion, errors/retries, timeout handling,
explicit fallback, vector mode and the initial HTML loader. Captures and the
report are saved under `.gauntlet/loading/`.
