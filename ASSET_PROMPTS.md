# Asset generation provenance — Wave 17

Все перечисленные растровые ассеты созданы встроенным `imagegen`; внешний CLI не использовался. Chroma-листы обработаны локальным `scripts/process_sprite_sheets.ps1` в ячейки 256×192 с nearest-neighbour и удалением magenta matte. Raw masters сохранены в `.gauntlet/iteration-17/raw/`.

## Cassia — base 4×2

Production: `public/assets/sprites/cassia-sheet.png`.

> Use case: stylized-concept.
> Asset type: production 16-bit gameplay sprite sheet for an original browser shoot-'em-up titled Biker Cows from Venus.
> Input image: the supplied 4x2 motorcycle sheet is a pose, scale, grid, bike-mechanics and pixel-density reference only. Replace the rider completely; do not retain mouse anatomy, ears, tail, goggles design, scarf silhouette, clothing insignia, or facial identity.
> Primary request: create Cassia, an attractive adult anthropomorphic golden-brown cow biker woman and confident team captain, riding a red-and-gold futuristic muscle motorcycle. She has short swept dark auburn hair, compact cream horns, bovine ears, a broad pale muzzle, expressive emerald eyes, athletic feminine build, red neckerchief, cropped black armored biker jacket over a non-revealing fitted top, gloves and riding trousers. Clearly female adult, charismatic rather than sexualized. Give her a small Venus sun emblem that is original and not a letter/logo.
> Strict layout: exactly 8 isolated complete full-body rider-and-bike frames in a perfectly regular 4 columns x 2 rows grid, matching the reference cell scale, road baseline and right-facing orientation. Semantic order: neutral ride; jump anticipation; weapon firing recoil; deep front suspension compression; maximum chassis pitch/tire squash; rider counterbalance; rebound; recovery. Every frame keeps complete wheels, horns, ears, hair, rider and gun inside its cell. The bike gun must remain visibly at the front/nose so runtime muzzle hardpoints stay credible.
> Style/medium: premium late-era Sega Mega Drive pixel art, crisp nearest-neighbor clustered pixels, strong dark plum/navy contours, hard 3-5 shade ramps, copper/red/gold metal, no smoothing or modern vector forms.
> Scene/backdrop: perfectly flat exact #FF00FF chroma-key background across all empty pixels.
> Constraints: same consistent character identity, outfit, bike and proportions in all 8 cells; readable feminine bovine face/silhouette at gameplay scale; no mouse/rat features; no text, labels, UI, grid lines, projectile, muzzle flash, detached explosion, smoke, shadow outside sprites or watermark.

## Bruna — base 4×2

Production: `public/assets/sprites/bruna-sheet.png`. Первая генерация была отклонена: киберрука терялась в пяти позах. Принят только исправленный master.

Базовый prompt:

> Use case: stylized-concept.
> Asset type: production 16-bit gameplay sprite sheet for the original browser game Biker Cows from Venus.
> Input image: the supplied heavy blue motorcycle sheet is a pose, mass, grid, vehicle-mechanics and pixel-density reference only. Replace the rider completely; do not retain mouse anatomy, ears, tail, eyepatch, vest identity, facial structure or insignia.
> Primary request: create Bruna, an attractive adult anthropomorphic charcoal-gray cow biker woman and powerful cybernetic mechanic, riding a massive cobalt-blue triple-barrel combat motorcycle. She has swept-back black hair with one silver streak, short asymmetric ivory horns, broad bovine ears, pale gray muzzle, confident steel-blue eyes, very tall muscular feminine build, blue armored sleeveless riding coat, heavy gloves, practical trousers, and a polished segmented cybernetic LEFT arm. Both eyes visible; no eyepatch. Clearly adult female and formidable, stylish rather than sexualized. Original small Venus gear emblem only.
> Strict layout: exactly 8 isolated complete full-body rider-and-bike frames in a perfectly regular 4 columns x 2 rows grid, matching the reference cell scale, road baseline and right-facing orientation. Semantic order: heavy neutral ride; jump anticipation; triple-barrel firing with massive recoil; deep suspension load; maximum chassis pitch/tire squash; cyber-arm counterbalance; heavy rebound; recovery. Complete wheels, horns, ears, hair, rider and gun inside each cell. The triple-barrel muzzle must stay visible at the front for runtime hardpoints.
> Style/medium: premium late-era Sega Mega Drive pixel art, crisp clustered nearest-neighbor pixels, bold dark plum/navy contour, hard steel/cobalt/cyan 3-5 shade ramps, no smoothing or vector-flat forms.
> Scene/backdrop: perfectly flat exact #FF00FF chroma-key background.
> Constraints: same identity/outfit/bike/proportions across all cells; readable adult feminine bovine silhouette at gameplay scale; no rodents, no tail, no eyepatch, no text/UI/grid lines/projectile/muzzle flash/explosion/smoke/external shadow/watermark.

Точный corrective prompt:

> Use case: precise-object-edit.
> Asset type: corrective 4x2 gameplay sprite sheet for the original game Biker Cows from Venus.
> Input image: this is the exact edit target. Preserve the 4x2 grid, Bruna's cow face, horns, hair, outfit, all eight poses, motorcycle, triple-barrel gun, palette, pixel scale, road baselines, flat magenta background, and all unrelated pixels.
> Primary request: correct Bruna's cybernetic LEFT arm in every one of the 8 cells. The same anatomical left arm must be visibly mechanical from shoulder to glove in all frames: polished silver and gunmetal segmented upper arm and forearm plates, dark articulated joints, one small cyan joint light, and metal fingers. In neutral ride, crouch, compression and recovery poses, keep enough silver forearm and shoulder plating visible above or beside the handlebars so it never reads as a normal charcoal-fur arm and never disappears behind the controls. Her opposite arm remains organic charcoal-gray. Keep the cyber arm on the same side of her body in every pose.
> Constraints: change only the cyber-arm pixels and the minimum adjacent occlusion pixels needed to reveal it. Both eyes remain visible. No eyepatch. No pose drift, no expression change, no vehicle change, no gun change, no new accessories. Keep exactly four columns by two rows, identical canvas size and cell placement; no crop or resize. Preserve the exact flat #FF00FF chroma-key background. No projectile, muzzle flash, text, UI, grid lines or watermark.
> Avoid: two cyber arms, missing cyber arm, fur-covered cyber forearm, arm switching sides, robotic face or torso, extra arms, blurred or antialiased pixels.

## Nova — base 4×2

Production: `public/assets/sprites/nova-sheet.png`.

> Use case: stylized-concept.
> Asset type: production 16-bit gameplay sprite sheet for the original browser game Biker Cows from Venus.
> Input image: the supplied light racing-bike sheet is a pose, speed, grid, vehicle-mechanics and pixel-density reference only. Replace the rider completely; do not retain mouse anatomy, ears, tail, goggles shape, scarf identity, facial proportions or insignia.
> Primary request: create Nova, an attractive adult anthropomorphic white-and-black spotted cow biker woman and fearless speed ace, riding a narrow cream, crimson and solar-yellow futuristic racing motorcycle with a nose-mounted laser. She has a short swept platinum quiff, small dark-tipped horns, wide expressive bovine ears, white muzzle with one playful black cheek patch, amber visor, slim athletic feminine build, fitted black/crimson armored racing suit and a short fluttering magenta bandanna. Clearly adult female, cocky and elegant rather than sexualized. Original small Venus comet emblem only.
> Strict layout: exactly 8 isolated complete full-body rider-and-bike frames in a perfectly regular 4 columns x 2 rows grid, matching the reference cell scale, road baseline and right-facing orientation. Semantic order: fast neutral ride; jump anticipation; laser firing with sharp recoil; front-fork compression; maximum high-speed chassis pitch/tire squash; counter-torso; springy rebound; stylish recovery. Complete wheels, horns, ears, hair, rider and nose laser inside each cell. Keep the laser tip clearly visible for runtime muzzle hardpoints.
> Style/medium: premium late-era Sega Mega Drive pixel art, crisp clustered nearest-neighbor pixels, bold dark plum/navy contour, hard cream/crimson/gold 3-5 shade ramps, no smoothing or modern vector shapes.
> Scene/backdrop: perfectly flat exact #FF00FF chroma-key background.
> Constraints: consistent character/outfit/bike/proportions across all cells; readable adult feminine bovine silhouette at gameplay scale; no rodents, no long tail, no text/UI/grid lines/projectile/muzzle flash/explosion/smoke/external shadow/watermark.

Точный corrective prompt для удаления случайного beam:

> Use case: precise-object-edit.
> Asset type: corrective edit of the just-generated 4x2 Nova gameplay sprite sheet.
> Primary request: edit ONLY the third cell in the top row. Remove the thin detached red laser beam, glowing orange projectile dot and every energy pixel extending in front of the physical gun barrel. Reconstruct the gun muzzle as a clean dark/red metal tip, and restore the removed region to perfectly flat exact #FF00FF chroma background.
> Constraints: preserve the cow heroine, her face/horns/hair/outfit, motorcycle, gun body, pose, pixel scale, palette, grid placement, all other seven cells and every unrelated pixel. Keep exactly 4 columns x 2 rows, no crop or resize. No projectile, beam, muzzle flash, glow, smoke, text, UI, grid line or watermark.

## Sustained-fire 4×3

Production: `public/assets/sprites/cow-sustained-fire-sheet.png`.

> Use case: stylized-concept.
> Asset type: production sustained-fire gameplay sprite atlas for the original 16-bit browser game Biker Cows from Venus.
> Input images: Image 1 is the authoritative Cassia design and red/gold bike; Image 2 is authoritative Bruna and her heavy cobalt bike; Image 3 is authoritative Nova and her cream/crimson racing bike. Preserve their identities, palettes, bovine anatomy, outfits, vehicles and gameplay scale.
> Primary request: create a strict 4 columns x 3 rows sheet, exactly 12 isolated full rider-and-bike frames. Row 1 is Cassia, row 2 is Bruna, row 3 is Nova. Each row is a smooth four-frame loop for firing continuously while riding on level road: planted firing pose; small weapon recoil and torso absorption; settle-through pose; controlled return while still aiming. This is sustained automatic fire, so no frame returns to a neutral non-firing ride pose. Keep wheel contact and the same road baseline in every cell, with only subtle suspension and upper-body motion.
> Critical Bruna continuity: in every one of Bruna's four row-2 frames, her anatomical LEFT arm is the same conspicuous polished silver/gunmetal cybernetic arm from shoulder to metal glove, with segmented plates, dark joints and a small cyan joint light. It must remain visibly metallic above or beside the handlebar in all four frames and never become fur, vanish, or switch sides. Her other arm stays organic charcoal-gray.
> Strict layout: regular cells, one complete right-facing rider plus motorcycle per cell, consistent scale and lower-center pivot. Keep horns, ears, hair, wheels and weapons inside each cell. Physical muzzle stays visible at the front but do not draw any shot, projectile, beam, muzzle flash or detached effect.
> Style/medium: premium late-era Sega Mega Drive pixel art, crisp nearest-neighbor clusters, hard dark plum/navy outlines, controlled 3-5 shade ramps, no smoothing, no vector-flat forms.
> Scene/backdrop: perfectly flat exact #FF00FF chroma-key background across every empty pixel.
> Constraints: adult attractive anthropomorphic cow women, athletic and stylish rather than sexualized; no rodents, mouse features, text, UI, logos, grid lines, scene background, smoke, sparks, external cast shadows or watermark.

## Fire-release 3×3

Production: `public/assets/sprites/cow-fire-release-sheet.png`.

> Use case: stylized-concept.
> Asset type: production fire-release transition sprite atlas for the original 16-bit browser game Biker Cows from Venus.
> Input images: authoritative gameplay designs for Cassia, Bruna, Nova and their sustained-fire poses. Preserve identity, bovine anatomy, palette, outfit, motorcycle, visible gun, scale and right-facing orientation.
> Primary request: create a strict 3 columns x 3 rows sheet, exactly 9 isolated complete rider-and-bike frames. Row 1 Cassia, row 2 Bruna, row 3 Nova. Within every row, three authored 50ms transition frames after releasing a held trigger: frame A still forward with residual recoil; frame B shoulders and weapon settle halfway; frame C blends cleanly into grounded riding posture. Motion must feel smooth and restrained, with wheels on one constant road baseline, fixed lower-center pivot and no vertical pop.
> Critical Bruna continuity: every Bruna frame in row 2 must show the same anatomical LEFT arm as polished silver/gunmetal cybernetics from shoulder to glove, segmented plates, dark joints and small cyan joint light. It stays visibly metallic above/beside the handlebar and never turns to charcoal fur, vanishes, becomes the other arm or switches side. Her opposite arm remains organic.
> Strict layout: exact regular 3x3 grid, one complete sprite per cell, no overlap. Complete horns, ears, hair, wheels and weapon inside each cell. No projectile, beam, muzzle flash or detached effect.
> Style/medium: premium late-era Sega Mega Drive pixel art; crisp clustered nearest-neighbor pixels; hard dark plum/navy contours; controlled 3-5 shade ramps; no smoothing or vector-flat geometry.
> Scene/backdrop: perfectly flat exact #FF00FF chroma-key background across every empty pixel.
> Constraints: same adult attractive cow women as the references, athletic and stylish rather than sexualized; no mouse/rodent traits; no text, labels, UI, grid lines, scene, smoke, sparks, external shadow or watermark.

## Select portraits 3×1

Production: `public/assets/ui/cow-portraits-sheet.png`.

> Use case: stylized-concept.
> Asset type: production character-select portrait atlas for the original 16-bit browser game Biker Cows from Venus.
> Input images: authoritative gameplay designs for Cassia, Bruna and Nova. Preserve their exact fur colours, horns, hair, eyes, clothing palettes and personality; omit motorcycles.
> Primary request: create exactly three isolated waist-up adult anthropomorphic cow-woman portraits in one strict 3 columns x 1 row atlas. Left cell Cassia: golden-brown captain, emerald eyes, swept auburn hair, cream horns, red neckerchief, black armored jacket, confident welcoming half-smile. Center cell Bruna: charcoal-gray muscular cyber mechanic, black hair with silver streak, ivory horns, steel-blue eyes, cobalt sleeveless armored coat, calm formidable expression; her anatomical LEFT shoulder, upper arm and bent forearm are prominently visible as the same polished silver/gunmetal segmented cybernetic arm with dark joints and a cyan joint light, while her other arm is organic. Right cell Nova: white-and-black spotted speed ace, platinum quiff, dark-tipped horns, amber visor pushed up enough to show attitude, black/crimson racing suit, short magenta bandanna, mischievous grin.
> Composition: three-quarter busts facing slightly inward, consistent adult scale, head/horns/ears/both shoulders fully inside each equal cell, lower-center pivot and shared bottom baseline, generous magenta padding. Clearly attractive adult women with bovine muzzles and ears, strong individual silhouettes; heroic and stylish rather than sexualized.
> Style/medium: premium late-era Sega Mega Drive character-select pixel art, crisp clustered nearest-neighbour pixels, strong dark plum/navy contours, controlled 4-6 shade ramps, selective 1px highlights, dramatic warm Venus rim lighting, no smoothing.
> Scene/backdrop: perfectly flat exact #FF00FF chroma-key background corner to corner.
> Constraints: no motorcycles, weapons, text, names, UI frames, logos, scenery, cast shadows, grid lines, rodents, mouse ears/tails, human noses, cleavage, pin-up pose, watermark or antialiasing. Bruna must have exactly one cybernetic arm and it must not disappear or switch sides.

## Start-screen Venus key art

Production: `public/assets/venus-title-key-art.png`.

> Use case: stylized-concept.
> Asset type: wide start-screen key-art panorama for the original 16-bit action game Biker Cows from Venus.
> Input images: authoritative designs for Cassia, Bruna and Nova and their three motorcycles. Preserve their cow identities, fur colours, horns, hair, outfits, bikes and individual silhouettes. Bruna's anatomical LEFT arm must visibly remain a polished segmented silver/gunmetal cybernetic arm with cyan joint light.
> Primary request: an original cinematic 16:9 late-era Sega Mega Drive pixel-art panorama. The three adult anthropomorphic cow women race away from the viewer along a colossal elevated Venus skyway toward a distant sulfur-cloud fortress refinery. Cassia on the red/gold muscle bike leads in the center; muscular Bruna on the massive cobalt bike rides left with her silver cyberarm visibly gripping the bars; white-and-black Nova on the cream/crimson racer carves along the right. Golden acidic cloud layers, volcanic ridges, floating refinery platforms, turquoise lightning far below, hot-magenta highway lights, speed streaks and exhaust flames create scale and velocity. Keep the upper-left and center-left sky visually calmer and lower-contrast so the game's large logo and menu remain readable there; put the strongest fortress silhouette and brightest environmental focal point in the right third.
> Composition: complete riders and motorcycles in the lower half, dramatic road convergence, no cropped horns/wheels, readable cow ears and horn silhouettes. All three are attractive adult women, heroic and stylish rather than sexualized. Bruna has exactly one cybernetic left arm; no side switching.
> Style/medium: premium original 16-bit pixel illustration, crisp deliberate pixel clusters, hard stepped colour ramps, limited deep plum/cobalt/copper/gold/cyan palette, rich material detail, no smooth painting, no vector forms, no photographic texture.
> Constraints: no rodents, mice, rat ears or tails, no existing franchise characters, no text, logo, UI, lettering, watermark or copyright marks. No Earth or Mars, no round cratered moon; evoke Venus through dense luminous sulfur clouds and industrial floating geology.

## Gameplay Venus panorama

Production: `public/assets/world/venus-highway-panorama.png`.

> Use case: stylized-concept.
> Asset type: wide seamless-feeling gameplay background panorama for the original 16-bit game Biker Cows from Venus.
> Input image 1 supplies only the wide horizontal parallax composition, skyline density and lower-edge role. Input image 2 supplies the authoritative Venus sulfur-cloud, floating refinery and gold/plum/cyan palette. Replace the old planetary landscape completely.
> Primary request: a full-bleed very wide late-era Sega Mega Drive pixel-art Venus horizon: dense layered golden sulfur clouds with deep plum shadow bands, volcanic tessera ridges, suspended basalt shelves and a distant floating industrial refinery city with restrained cyan and hot-magenta hard lights. No moons, stars, cratered planets or open outer-space sky. Arrange at least five clear horizontal depth bands for parallax; keep the lower quarter dark and simple where the separately rendered highway begins. Make left and right edges visually compatible for a slow bounded pan.
> Style: crisp clustered nearest-neighbour pixels, hard stepped silhouettes, controlled 3-5 shade material ramps, high-end 16-bit palette discipline, no smoothing, blur, photorealism or vector-flat shapes.
> Constraints: no characters, cows, rodents, vehicles, enemies, road, UI, title, text, readable signage, logo or watermark. No Earth or Mars iconography.
