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

## Wave 18 — Bruna arm material correction

Generated with the built-in `imagegen` tool in `precise-object-edit` mode. Raw masters are in `.gauntlet/iteration-18/raw/`; deterministic processing is `scripts/process_iteration18_art.ps1`.

Base atlas prompt:

> Use case: precise-object-edit. Asset type: production 4 columns × 2 rows gameplay sprite atlas for Bruna, an original adult anthropomorphic cow biker in a premium late-era 16-bit game. Input image 1 is the exact edit target and authoritative 8-frame atlas. Input image 2 is the authoritative anatomy/material reference: Bruna's LEFT arm is the silver segmented cyberarm attached to the cyan-lit shoulder joint; her RIGHT arm is organic charcoal-gray fur. Correct only Bruna's anatomical RIGHT organic arm in all 8 cells. She faces screen-right. The organic RIGHT arm is the nearer/front arm that originates from the non-cyber shoulder/chest side and reaches the motorcycle controls; render it consistently as charcoal-gray fur with the existing black glove or dark cuff. Remove every accidental silver plate, steel band, cyan joint, or mechanical finger from this right arm. Preserve the anatomical LEFT cyberarm exactly as a continuous silver segmented limb from the round cyan-lit shoulder joint through forearm and hand in every pose. Retain the exact 4×2 cell order, pose, motorcycle position, scale, baseline, frame spacing and complete silhouettes. Preserve every other feature and keep the transparent background. Exactly one cyberarm (LEFT) and one organic arm (RIGHT) in every cell. Avoid two metal arms, partly metal right arm, arm switching, pose drift, smoothing, background, text or watermark.

Sustained-fire prompt:

> Use case: precise-object-edit. Asset type: production 4 columns × 3 rows sustained-fire sprite atlas. Image 1 is the exact edit target; rows are Cassia, Bruna and Nova. Image 2 is the corrected authoritative Bruna anatomy/material reference. Edit only the middle Bruna row so all four poses consistently show one silver segmented LEFT cyberarm attached to the cyan-lit shoulder joint and one fully organic charcoal-gray RIGHT/front arm reaching the controls. The right arm has gray fur and a dark glove/cuff, with no plates or cyan mechanisms. Preserve exact grid, firing cadence, bikes, scale, baseline and transparent background. Keep Cassia and Nova unchanged. Avoid two metal arms, material switching, pose drift, blur, text or watermark.

Release prompt:

> Use case: precise-object-edit. Asset type: production 3 columns × 3 rows fire-release sprite atlas. Image 1 is the exact edit target; rows are Cassia, Bruna and Nova. Image 2 is the corrected authoritative Bruna anatomy/material reference. Edit only the middle Bruna row so all three release poses consistently show one silver segmented LEFT cyberarm attached to the cyan-lit shoulder joint and one fully organic charcoal-gray RIGHT/front arm. Preserve exact 3×3 order, poses, motorcycle position, scale, baseline, spacing and all non-arm pixels. Keep Cassia and Nova unchanged. Avoid two metal arms, partially metal right arm, arm switching, pose drift, smoothing, background, text or watermark.

The release result received a second background-only pass:

> Use case: background-extraction. Replace only the solid black background surrounding the nine complete sprites with a perfectly flat exact #FF00FF chroma-key field. Preserve every sprite pixel, black outline, 3×3 cell, pose, scale and alignment exactly. Do not redraw, resize, recolor or smooth any sprite. Avoid gradients, texture, halos, grid lines, text and watermark.

## Wave 18 — Nova low-duck overlap

Production: corrected bottom-left cell in `public/assets/sprites/nova-sheet.png`.

> Use case: precise-object-edit. Asset type: production 4 columns × 2 rows gameplay sprite atlas for Nova. The input is the exact authoritative atlas. Correct only cell 5, bottom-left, where Nova leans very low over the motorcycle. Her complete head, muzzle, goggles, white forelock and both horns must render visibly in front of the cream/red front fairing and handlebar silhouette, with a clean dark contour separating face from machinery. Restore the hidden lower muzzle/cheek contour over the fairing while keeping the same aerodynamic duck pose. Retain exact grid, all other seven cells, bike position, body pose, scale, baseline and transparent background. Avoid enlarging the head, changing the pose or bike, smoothing, text and watermark.

## Wave 18 — Venus shoulder strip

Production: `public/assets/world/venus-shoulder-strip.png`.

> Use case: stylized-concept. Asset type: wide horizontally scrolling near-foreground terrain strip for an original late-era 16-bit Venus highway game. Image 1 is a real gameplay reference for palette, pixel density and the role of the flat bottom strip. Image 2 is the authoritative material reference for the existing purple basalt rocks. Create a standalone, wide, seamless-feeling Venus highway shoulder: layered dark-plum asphalt lip, fractured basalt plates, compact rusty-red gravel, thin hot-orange mineral seams, sparse cyan mineral glints and depth shadows. Transition from a near-black low-detail upper edge into richer broken volcanic ground below. Use crisp nearest-neighbour clustered pixels, hard stepped silhouettes and controlled shade ramps. Terrain only; no characters, vehicles, enemies, UI, signs, rails, lamps, buildings, sky, text, logo or watermark. Avoid gradients, blur, photorealism, flat empty fields and tall objects rising into the action lane.

## Waves 19–21 — Furnace District beat ’em up

Generated with the built-in `imagegen` tool in sprite-sheet and wide-environment modes. Raw outputs are preserved in `.gauntlet/iteration-19/raw/`; deterministic matte removal, shared-scale normalization and panorama composition are in `scripts/process_brawler_art.ps1`. Production files are in `public/assets/brawler/`.

### Cassia / Bruna / Nova on-foot atlases

Shared contract for each 4×2 atlas:

> Use case: game sprite sheet. Create an original late-era 16-bit side-scrolling beat-'em-up character atlas from the provided authoritative Biker Cows from Venus gameplay and portrait references. The heroine fights on foot; no motorcycle, gun, vehicle, text or UI. Output a strict 4 columns × 2 rows sheet, eight complete non-overlapping cells on a perfectly flat exact #FF00FF chroma-key background. Same side-view scale, ground baseline, proportions and lighting; face screen-right. Row-major semantics: combat idle; walk A; walk B with opposite foot; fast jab; heavy cross or signature kick; wide spinning/ground-smash finisher; airborne forward attack; hit reaction/knockback. Premium late-Mega-Drive pixel art: hard 1–2 px clusters, dark outlines, controlled 4–6 shade ramps, no antialiasing, gradients or blur. Generous padding; nothing crosses a cell border; no labels or dividers.

Cassia identity clause:

> Adult anthropomorphic brown cow, swept auburn hair, small cream horns, green eyes, red scarf, black biker vest and pants, gold/orange sun accents, athletic feminine build. Finisher has a restrained red/orange scarf arc.

Bruna identity/anatomy clause:

> Adult anthropomorphic charcoal-grey cow, black swept hair, horns, blue sleeveless biker vest, dark pants, large powerful feminine build. In every cell Bruna's anatomical LEFT arm is fully cybernetic from shoulder to hand, silver segmented metal with cyan light; her anatomical RIGHT arm is entirely organic charcoal-grey fur and black glove. Never swap the arms, make both arms metal, or put metal plates on the organic right arm. Organic-right jab, cyber-left hook and cyber-left ground-smash.

Nova identity clause:

> Adult anthropomorphic white-and-black spotted cow, swept white forelock, short horns, orange visor, magenta scarf, fitted black/white/red racing leathers and athletic hotshot attitude. Fast palm jab, high roundhouse and acrobatic spinning finisher. Keep face, forelock and horns in front of torso/limbs with no layer accidents.

### Venus street gang 4×3

> Use case: game sprite sheet. Create a wholly original enemy gang atlas for a late-era 16-bit side-scrolling beat-'em-up in the Furnace District of Venus. Strict 4 columns × 3 rows, twelve isolated full-body sprites on flat exact #FF00FF. All face screen-left, shared baseline per row, generous padding. Row 0: lean purple alien street raider with respirator and armored boots — idle, walk A, walk B, punch. Row 1: massive ochre/graphite horned refinery bruiser with furnace gauntlets — idle, walk A, walk B, haymaker. Row 2: wiry teal bio-electric Venusian shocker with cable-whip forearms — idle, walk A, walk B, electric lunge. Three immediately distinct silhouettes; hard 1–2 px clusters, black/plum contours, cyan/magenta/rust highlights; no smoothing, gradients, labels, vehicles or guns.

### The Forge Overseer 3×2

> Use case: game sprite sheet. Create a wholly original final boss atlas: THE FORGE OVERSEER, a towering broad-shouldered female Venusian industrial warlord with crimson skin, four small swept horns, black-violet armored foundry coat, one huge glowing orange furnace gauntlet and one articulated cyan shock claw. Strong asymmetrical silhouette, fighting on foot and facing screen-left. Strict 3 columns × 2 rows on flat exact #FF00FF: idle command pose; stalking walk; furnace-gauntlet windup; crushing punch; hit recoil with sparks; defeated kneeling/falling. Consistent large gameplay scale/baseline; premium hard-cluster 16-bit rendering; no text, UI, scenery or outside-franchise imagery.

### Furnace District panorama pair

First plate:

> Create an original extra-wide late-era 16-bit background for Stage 2, Furnace District, on Venus. Golden sulfur clouds, layered black-violet foundries, copper pipes, furnace mouths, catwalks, cyan coolant windows, magenta warning lamps and distant floating platforms. Left-to-right progression: refinery gates, pipe canyon, smelter plaza, monumental forge tower. Keep bottom 28% dark and low-contrast for a separate floor. No characters, vehicles, text or UI; crisp 2px-equivalent clusters and controlled material ramps.

Continuation plate:

> Create a second panorama placed immediately to the right of the first. Preserve sulfur sky, horizon, material density and lighting; add new copper pipe canyons, cyan coolant towers, suspended smelter vats, catwalk silhouettes and a forge-arena entrance. Make the left edge compatible with the first plate's right edge; no repeated landmarks, characters, words or logos.

### Authored perspective floor

> Create an extra-wide 16-bit walkable factory floor only, seen as a classic belt-scrolling oblique ground plane. Dark black-violet steel and volcanic panels, copper seams, grated channels, rivets, cyan coolant strips, magenta lamps and orange furnace reflections. Strong perspective scaling from small far-edge details to large near panels; keep the middle combat lane readable. Seam-friendly edges; no walls, skyline, actors, tall props, text or UI; hard pixel clusters only.

## Venus beach opening comic

Generated as four separate 16:9 `illustration-story` assets with the built-in `imagegen` tool. Production files are in `public/assets/intro/`.

Shared prompt contract:

> Use case: illustration-story. Asset type: 16:9 opening comic cinematic panel for a retro arcade browser game. Images 1-3 are the authoritative identity, color and motorcycle references for Cassia, Bruna and Nova. Scene: a peaceful retro-futuristic Venusian beach inspired by the broad visual idea of a Southern California pier and boardwalk, with alien palms, turquoise ocean, a distant original pier, warm peach sky and two small moons; no real landmarks or brands. Subjects: exactly three clearly adult anthropomorphic cow biker heroines. Cassia is golden-brown with swept auburn mane, small horns and green eyes. Bruna is tall, muscular and charcoal-gray with black mane, horns and a clearly segmented silver cybernetic left arm. Nova is slim and white-furred with swept white hair, dark horns and magenta accents. Style: polished hand-painted 1990s Saturday-morning arcade comic illustration, strong ink contours, halftone texture and readable silhouettes. One cinematic widescreen panel with room at the bottom for runtime captions. Preserve identity, fur colors, horns, hair and body types. Tasteful non-sexual beach attire; no embedded panels, speech balloons, captions, letters, logos, trademarks, watermark or border.

Panel requests:

> 01 REST: Cassia relaxes on a striped towel and sunbathes in a tasteful yellow-orange two-piece bikini and sunglasses. Nova actively carves across a turquoise wave on a futuristic surfboard in a sporty red-and-white surf suit. Bruna performs a standing dumbbell curl in a blue athletic crop top and training shorts, with her cybernetic left arm clearly visible. All three activities must read in one peaceful golden-hour establishing shot.

> 02 BLAST: Continue the same vacation. Cassia sits up, Nova balances on her board and turns toward shore, and Bruna lowers her dumbbells. A spectacular non-graphic orange-magenta explosion blooms far behind the pier; the heroines react with alert determination. Preserve the same outfits. No injuries or gore.

> 03 JACKETS: The three heroines decisively pull on their signature black biker leather jackets over their beach and athletic outfits. Cassia wears gold accents, Bruna a blue-lined heavy jacket with her silver left arm visible, and Nova a sleek red-and-white jacket. Smoke rises behind the pier. Their red-gold chopper, heavy blue cruiser and white-red sportbike wait nearby. Energetic diagonal composition.

> 04 RIDE: The heroines, now in their signature jackets, leap onto their distinct motorcycles and accelerate toward camera-right. Cassia rides the red-gold chopper, Bruna the heavy blue cruiser and Nova the white-red sportbike. Rear wheels throw sand and boardwalk dust; hair and jackets stream in the wind; orange-magenta smoke rises far behind the pier. Heroic low angle and strong forward motion, without combat or weapons.

## Wave 23 — authored directional brawler motion

Generated with the built-in `imagegen` tool in `game sprite sheet` and `precise single-frame production game sprite` modes. Raw masters are preserved in `.gauntlet/iteration-23/raw/`; deterministic chroma removal, shared-scale normalization, cell replacement and enemy mirroring are implemented in `scripts/process_brawler_motion_art.ps1`. Production atlases are:

- `public/assets/brawler/cassia-brawler-sheet.png`;
- `public/assets/brawler/bruna-brawler-sheet.png`;
- `public/assets/brawler/nova-brawler-sheet.png`;
- `public/assets/brawler/venus-gang-sheet.png`.

Hero directional contract:

> Create a strict 4 columns × 4 rows late-era 16-bit beat-'em-up atlas for one authoritative Biker Cows from Venus heroine, on flat exact #FF00FF. Rows 0–1 face screen-right and rows 2–3 are separately authored screen-left poses, not simple mirrored artwork. Within each direction provide idle, two unmistakably different walk poses with opposite anatomical legs leading, three distinct grounded attacks, jump pose and airborne attack. Keep a fixed baseline, scale and lower-center pivot. Preserve the heroine's identity and asymmetry. Bruna always has one anatomical-left silver segmented cyberarm and one anatomical-right organic arm; her left-facing cyber ground-smash is a back-to-camera pose so the same cyberarm strikes the floor. No vehicle, gun, UI, labels, smoothing or effects baked outside the body.

Opposite-stride correction contract used for the six single-cell masters `cassia/bruna/nova-opposite-{right,left}-chroma.png`:

> Produce one complete side-view walk frame matching the supplied heroine, scale, palette and baseline. The anatomical LEFT knee and boot must be unmistakably forward and visibly ahead of the pelvis; the anatomical RIGHT leg is the rear support leg. Do not merely recolor or slightly bend the existing right-leg-forward pose. Preserve directional facing and all asymmetric anatomy. Exact #FF00FF background; no shadow, effect, labels or crop.

Bruna correction contract used for `bruna-pose-correction-chroma.png`:

> Create a strict 3 × 2 corrective atlas for Bruna. Preserve her anatomical-left silver/cyan segmented cyberarm and anatomical-right organic arm. The right-facing heavy-hook cell must be a clean readable cyberarm strike with intact anatomy. The left-facing finisher must be independently drawn from a rear three-quarter/back-to-camera view, striking the floor only with the same cybernetic left arm; never mirror the right-facing pose or transfer metal to the organic arm. Flat exact #FF00FF, fixed gameplay scale and baseline.

Enemy direction is deliberately not regenerated per direction. The authoritative raw `enemy-roster-chroma.png` contains raider, bruiser and shocker facing screen-left. `process_brawler_motion_art.ps1` copies that row exactly for leftward movement and constructs the rightward row only by a deterministic horizontal pixel mirror. This removes the ambiguous backward-walking silhouettes produced by independently generated direction rows.

## Wave 29 — isolated-limb gait experiment

Accepted generated limb parts were assembled into walk-v3 PNGs using `scripts/build-gait-v3.ps1`. Whole-character generations were not accepted as complete gait cycles because the leading legs repeated. Directional sheets supplied left-facing upper bodies only. Raw inputs remain in `.gauntlet/iteration-29/raw/`; the superseded v3 assets are preserved beside the current production atlases.

### Leg parts

> Use case: stylized-concept. Asset type: cutout limb animation parts for a 16-bit pixel-art game. Generate EXACTLY TWELVE ISOLATED SINGLE LEGS, in strict 4 columns x 3 rows on perfectly uniform GREEN #00FF00. Each cell contains ONE LEG ONLY from hip socket to shoe, no second leg, no torso, no character head. Every single leg's hip socket starts at SAME upper center of its cell. ALL BOOT TOES FACE RIGHT in ALL cells. Columns: 1 trailing leg -- thigh and shin stretch diagonally DOWN LEFT from hip, boot heel raised on toe; 2 passing leg -- thigh angles down RIGHT, knee bent so ankle curls behind under hip, boot hovering; 3 leading leg -- thigh and shin extend diagonally DOWN RIGHT, boot heel planted toe slightly raised; 4 support leg -- straight almost VERTICAL thigh/shin, boot flat on shared bottom ground line. These are four poses of ONE SAME LEFT LEG, not paired legs. Row1 Cassia leg: black leather pants with gold seam/studs, black biker boot with three gold buckles. Row2 Bruna leg: heavy blue denim trousers, sturdy dark black heavy biker boot with silver buckles. Row3 Nova leg: white cow fur thigh with a few charcoal spots, red kneeguard and red/white racing boot. All legs fleshy organic, NONE robotic. Preserve same thigh/calf proportions across row, generous empty padding around each leg. Retro16bit hard pixel clusters, dark outline, 4-color material shade ramps. Cell hip seams flat and open for assembly beneath existing pelvis. No cast shadows, gradients, text, grid lines, ground, effects, heads, arms, torsos, COMPLETE CHARACTERS or PAIRS OF LEGS. Single leg each cell, twelve limbs total.

### Cassia directional torso

> Use case: sketch-to-render. Image 1 is the STRICT POSE AND OCCLUSION GUIDE, image 2 is Cassia's costume/identity/pixel-art reference ONLY. Render image 1's EIGHT POSES as Cassia, a brown cow heroine with auburn mane, horns, red scarf, black/gold biker gear. 4 columns x 2 rows. Preserve EXACT leg positions, near/far overlap and arm swings from guide. CYAN limbs in guide are NEAR camera and PURPLE limbs FAR from camera: replace colors with natural costume colors but preserve their occlusion. Top row facing RIGHT: in column1 near left leg points diagonally DOWN LEFT, far right leg DOWN RIGHT; column3 near left leg points DOWN RIGHT, far right leg DOWN LEFT. This reversal of which leg OVERLAPS the other is the entire purpose. Her near thigh has gold sun marking: place that marking on the diagonal BACK leg in top-left, on diagonal FRONT leg in top-third. Bottom row faces LEFT, camera sees her BACK/RIGHT side, follow guide precisely. Natural four-phase walk, heels/toes planted, same pelvis pivot and body/head sizes. Use sharp low-resolution 16-bit pixel clusters and limited colors. Background must be perfectly flat solid #00FF00 GREEN throughout, no gradient, no halo, no ground, no cast shadows. REMOVE guide lines and all text/labels. NO posed copies from reference 2: it is costume reference, guide 1 controls anatomy. Every complete sprite centered in its grid cell with generous padding.

### Bruna directional torso

> Use case: sketch-to-render. Image 1 controls EXACT eight walk poses and near/far limb overlap. Image 2 controls Bruna character appearance only, NOT leg positions. Create 4 columns x 2 rows pixel-art animation sheet, pure uniform #00FF00 green background. Bruna is the same muscular charcoal cow woman, black hair, ivory horns, sleeveless cobalt-blue biker vest, dark trousers and boots. Anatomical LEFT ARM is cybernetic silver with cyan joint; RIGHT ARM is organic dark fur. Top row faces RIGHT, near side is LEFT: near cyber ARM swings forward in column1, backward in column3; near LEFT LEG extends diagonally BACK to screen-left in column1 and FORWARD to screen-right in column3. Far organic arm and far right leg swing oppositely. The near thigh must OVERLAP the other at hip: do not redraw two identical leading legs. Top col2 right support left passes, top col4 left support right passes. Bottom row faces LEFT in back-three-quarter view: show BACK of vest, organic RIGHT ARM nearest camera, cybernetic LEFT ARM on far side still visibly silver (never swap metal arm). Bottom col1 near RIGHT leg extends toward screen LEFT; bottom col3 near RIGHT leg extends BACK screen RIGHT and FAR LEFT boot extends toward screen LEFT. Follow guide cyan near/purple far silhouettes; replace guide colors with actual clothes. No high knee kicks, normal full contact walk. Every head same size, pelvis position and body height stable; natural knees and counter-swing, crisp hard-cluster 16-bit art matching image2. No text, grid lines, effects, weapons, scenery, shadow or gradient. Exactly 8 full-body sprites, each inside cell with padding.

### Nova directional torso

> Use case: sketch-to-render. Convert the eight exact stick-figure poses in Image1 to pixel-art Nova from upper-body reference Image2. Create one 4 columns by 2 rows sprite sheet on perfectly solid uniform GREEN #00FF00. The guide controls anatomy: CYAN is the near leg and arm, PURPLE far limbs. Top row RIGHT facing: column1 near LEFT leg BEHIND pelvis screen-left and FAR leg in FRONT screen-right; column3 near LEFT leg in FRONT screen-right and FAR leg BEHIND screen-left. Use near leg's bright WHITE THIGH and RED KNEEPAD to make it unmistakable: white thigh/red knee screen-left in column1, screen-right in column3. Column2 far leg grounded near knee passing, column4 near leg grounded far knee passing. Bottom LEFT-facing row: independently draw rear three-quarter view, near RIGHT leg front screen-left in column1, back screen-right in column3; match guide occlusion. Same attractive athletic adult white cow woman, black spots, short horns, platinum quiff, amber visor, magenta neck scarf, black/white/red racing gear, red kneepads, red/white shoes. Natural grounded walk with normal knee flexion, not kicking. Same pelvis center, height and scale all cells. Crisp retro16bit clusters like reference, sharp dark contours, four shade ramps. Absolutely no shadow, gradient, text, grid, guide lines, bikes or props. Full body each cell with ample margin.

## Wave 30 — unified full-body gait

Generated with the built-in imagegen tool. The first pass supplied coherent 4 x 2 full-body bases; its repeated contact geometry was not accepted as the finished cycle. A second, narrowly scoped pass supplied the opposite right/left contact frames. `scripts/build-gait-v4.ps1` deterministically normalizes the full sprites and substitutes those contacts without cutting bodies at the waist. Raw masters: `.gauntlet/iteration-30/raw/`; production: `*-brawler-walk-v4.png`.

### Cassia complete base

> Use case: stylized-concept.
> Asset type: production 16-bit pixel-art character walk sprite sheet.
> Input images: Image 1 is Cassia's authoritative identity, costume, proportions, pixel rendering and right-facing torso reference. Image 2 is only a directional and gait guide; redraw every complete character as one unified figure and do not splice or preserve its mismatched leg construction.
> Primary request: create exactly eight complete full-body Cassia walk sprites in a strict 4 columns × 2 rows atlas. Top row faces screen-right; bottom row faces screen-left and is independently authored from rear three-quarter view, never a horizontal mirror. Four phases per row: right/near leg trailing with opposite leg leading; passing pose with lifted trailing foot; right/near leg leading with opposite leg trailing; opposite passing pose. Opposite contacts must be unmistakable in columns 1 and 3.
> Identity: attractive adult golden-brown anthropomorphic cow biker heroine, swept auburn mane, small ivory horns, green eyes, red neck scarf, fitted black leather biker outfit with gold sun motif, gold seams and buckled black boots.
> Anatomy/integration: draw every frame from head through pelvis through both boots as one continuous body. Natural hip sockets, consistent thigh thickness, knees aligned under the pelvis, believable counter-swing of shoulders and arms. No seam or abrupt palette/detail change at waist or hips. Same head size, shoulder width, pelvis height, overall height and ground baseline in every cell. Moderate grounded stride, no splits or high kicks.
> Style/medium: late-era 16-bit arcade pixel art, crisp hard pixel clusters, dark 1–2 pixel contour, restrained four-tone ramps, same density and finish as Image 1.
> Layout: generous transparent-looking isolation on perfectly uniform chroma GREEN #00FF00; each sprite centered in an equal cell with ample padding, no overlap.
> Constraints: exactly eight complete sprites; no motorcycle, weapon, effects, cast shadow, scenery, text, grid lines, labels, gradients, halos or watermark. All scarf, tail and limbs remain fully inside their cells.

### Cassia opposite contacts

> Use case: stylized-concept.
> Asset type: two corrective production walk-contact sprites.
> Input image: authoritative Cassia identity, scale, outfit, pixel rendering and unified anatomy reference.
> Primary request: draw exactly TWO complete full-body Cassia walk-contact sprites in one horizontal 2-column × 1-row image. Cell 1 faces SCREEN RIGHT: her anatomical LEFT leg, the camera-near leg carrying the gold sun hip marking, must extend FORWARD to screen-right with its boot clearly furthest right; her anatomical RIGHT leg is the darker rear support reaching screen-left. Cell 2 faces SCREEN LEFT from rear three-quarter view: her anatomical LEFT leg, now camera-far, must extend FORWARD to screen-left with its boot clearly furthest left; her anatomical RIGHT camera-near leg supports behind toward screen-right. These must be the opposite contacts missing from the supplied sheet.
> Identity: same adult golden-brown cow heroine, auburn mane, horns, red scarf, black/gold biker gear.
> Anatomy: redraw each from head through pelvis through both boots as one continuous body; coherent hip sockets and thick thighs; natural shoulder counter-swing; moderate grounded stride. Match supplied character height, proportions, baseline, dark contour and limited pixel palette.
> Backdrop/layout: genuinely transparent background; equal cells, centered full silhouettes, ample padding.
> Constraints: exactly two sprites, no duplicated leading-leg pose, no splice at waist, no motorcycle, weapon, shadow, effects, text, grid, labels, scenery or watermark.

### Bruna complete base

> Use case: stylized-concept.
> Asset type: production 16-bit pixel-art character walk sprite sheet.
> Input images: Image 1 is Bruna's authoritative identity, clothing, muscular proportions, pixel rendering and right-facing torso reference. Image 2 is only a gait/direction diagnostic; redraw every full character as one coherent figure and remove its waist/leg splice.
> Primary request: create exactly eight complete full-body Bruna walk sprites in a strict 4 columns × 2 rows atlas. Top row faces screen-right. Bottom row faces screen-left from an independently authored rear three-quarter view, not a mirror. Four natural phases per row: near leg trailing/opposite leg leading; passing; near leg leading/opposite leg trailing; opposite passing. Columns 1 and 3 must show opposite anatomical legs in front.
> Identity/asymmetry: tall muscular adult charcoal-gray anthropomorphic cow biker heroine, black mane, ivory horns, cobalt sleeveless biker vest, dark blue jeans, heavy black boots. Her anatomical LEFT ARM is always the segmented silver cybernetic arm with cyan joint lights. Her anatomical RIGHT ARM is always organic charcoal fur. Facing right, cyberarm is camera-near; facing left, organic right arm is camera-near and the cyberarm remains visible on the far side. Never swap which arm is metal.
> Anatomy/integration: each sprite is drawn continuously from torso into pelvis into both legs. Broad stable pelvis appropriate to her muscular torso, consistent thick thighs and calves, believable hip joints, natural arm counter-swing. No thin pasted legs, waist seam, duplicated limb, or sudden change in palette/detail. Same head, shoulders, pelvis height, overall scale and ground baseline in all cells. Grounded heavy walk, no splits or high kicks.
> Style/medium: late-era 16-bit arcade pixel art matching Image 1, crisp pixel clusters, dark contour, limited material ramps.
> Layout: perfectly uniform chroma GREEN #00FF00, equal cells, full silhouettes centered with ample padding.
> Constraints: exactly eight complete sprites; no motorcycle, weapon, effects, cast shadow, scenery, text, grids, labels, gradients, halos or watermark.

### Bruna opposite contacts

> Use case: stylized-concept.
> Asset type: two corrective production walk-contact sprites.
> Input image: authoritative Bruna identity, muscular scale, clothing, pixel rendering and coherent anatomy reference.
> Primary request: draw exactly TWO complete full-body Bruna walk-contact sprites in one horizontal 2-column × 1-row image. Cell 1 faces SCREEN RIGHT: her anatomical LEFT leg, on the same camera-near side as her silver cybernetic LEFT ARM, extends FORWARD to screen-right and its boot is clearly furthest right; anatomical RIGHT leg supports behind to screen-left. Cell 2 faces SCREEN LEFT from rear three-quarter view: her anatomical LEFT leg on the cyberarm/far side extends FORWARD to screen-left and its boot is clearly furthest left; anatomical RIGHT camera-near leg supports behind toward screen-right. These are opposite contacts missing from the supplied sheet.
> Critical invariant: anatomical LEFT ARM is silver segmented cybernetic with cyan joints in both cells; anatomical RIGHT ARM remains organic dark fur. Never swap them.
> Anatomy: whole continuous figure, broad pelvis matching torso, thick integrated thighs, no waist seam, natural grounded stride and counter-swing. Match supplied scale, baseline, contours and pixel palette.
> Backdrop/layout: genuinely transparent; two equal cells with ample padding.
> Constraints: exactly two sprites; no duplicated contact, thin pasted legs, extra limbs, motorcycle, weapon, shadow, effects, text, grid, scenery or watermark.

### Nova complete base

> Use case: stylized-concept.
> Asset type: production 16-bit pixel-art character walk sprite sheet.
> Input images: Image 1 is Nova's authoritative identity, costume, proportions and pixel rendering reference. Image 2 is only a gait/direction guide; redraw each full character as a unified body rather than combining its torso and leg pieces.
> Primary request: create exactly eight complete full-body Nova walk sprites in a strict 4 columns × 2 rows atlas. Top row faces screen-right. Bottom row faces screen-left in an independently drawn rear three-quarter view, never a horizontal mirror. Four natural walk phases: near leg trailing/opposite leg leading; passing; near leg leading/opposite leg trailing; opposite passing. Columns 1 and 3 visibly reverse which anatomical leg overlaps and leads.
> Identity: athletic adult white-furred anthropomorphic cow biker heroine with sparse charcoal spots, platinum swept quiff, short dark horns, amber visor, magenta scarf, fitted black/white/red racing leathers, red kneepads and red-white boots.
> Anatomy/integration: render head, torso, hips, thighs, knees and boots as one coherent sprite per cell. Keep athletic but substantial thigh/calf proportions consistent with torso, continuous black/white/red costume panels across the hip, natural joints and arm counter-swing. No waist seam, paper-thin legs, detached boots, extra limb, or detail-density mismatch. Same head size, pelvis height, total scale and shared ground baseline. Moderate grounded stride, no high kick or split.
> Style/medium: late-era 16-bit arcade pixel art matching Image 1, crisp clusters, dark contour, limited four-tone ramps.
> Layout: perfectly uniform chroma GREEN #00FF00, equal cells, full silhouettes centered with ample padding.
> Constraints: exactly eight complete sprites; no motorcycle, weapon, effects, cast shadow, scenery, text, grid lines, labels, gradients, halos or watermark. Keep scarf and tail fully inside every cell.

### Nova opposite contacts

> Use case: stylized-concept.
> Asset type: two corrective production walk-contact sprites.
> Input image: authoritative Nova identity, athletic proportions, costume, pixel rendering and coherent anatomy reference.
> Primary request: draw exactly TWO complete full-body Nova walk-contact sprites in a horizontal 2-column × 1-row image. Cell 1 faces SCREEN RIGHT: anatomical LEFT camera-near leg with its bright white thigh and red kneepad extends FORWARD to screen-right, boot clearly furthest right; anatomical RIGHT leg supports behind to screen-left. Cell 2 faces SCREEN LEFT from rear three-quarter view: anatomical LEFT camera-far leg extends FORWARD to screen-left, its red kneepad and boot clearly furthest left; anatomical RIGHT camera-near leg supports behind toward screen-right. These are the opposite contacts missing from the supplied sheet.
> Identity: same adult white cow heroine with charcoal spots, platinum quiff, amber visor, magenta scarf, black/white/red racing outfit.
> Anatomy: complete unified figures from head through hips to boots, athletic consistent thighs, continuous costume panels, natural counter-swing, moderate grounded stride. Match supplied scale, baseline, crisp contour and limited pixel palette.
> Backdrop/layout: genuinely transparent; equal cells, full silhouettes with padding.
> Constraints: exactly two sprites; no duplicated leading-leg pose, waist splice, extra limbs, motorcycle, weapon, shadow, effects, text, grid, scenery or watermark.


## Wave 32 — staged anatomical gait with persistent leg markers

Generated with the built-in `imagegen` tool. The accepted chain follows front identity anchor → neutral directional profile → separately requested right/left contacts → passing pose synthesized from the accepted contact pair. Raw production masters are copied by `scripts/build-gait-v8.ps1` to `.gauntlet/iteration-32/raw/`; normalized production atlases are `public/assets/brawler/*-brawler-walk-v8.png`. Walk-v5's luminance-only hypothesis was rejected by the user and is not production.

### Cassia — front identity anchor

> Use case: identity-preserve.
> Asset type: one production 16-bit pixel-art character anchor.
> Input image: Image 1 is Cassia's authoritative game identity and costume reference.
> Primary request: draw exactly ONE complete full-body Cassia standing ANFAS, straight toward the camera, in a neutral relaxed stance with both boots parallel and equally visible. This front view is an anatomical identity anchor for later walk frames.
> Identity: adult golden-brown anthropomorphic cow heroine, symmetrical ivory horns, swept auburn mane, green eyes, red neck scarf, black leather biker outfit with gold sun emblems and gold-trimmed buckled boots.
> Anatomy: clear separate LEFT and RIGHT hips, thighs, knees and boots; natural adult proportions; arms relaxed at the sides; body centered on a fixed baseline.
> Style: crisp late-era 16-bit arcade pixel art matching Image 1, limited palette and hard dark contour.
> Backdrop: genuinely transparent.
> Constraints: one character only, true front view, no twist, no walking, no motorcycle, weapon, shadow, effects, text, grid, scenery or watermark.

### Cassia — neutral right profile

> Use case: identity-preserve.
> Asset type: one production 16-bit pixel-art character anchor.
> Input image: Image 1 is the authoritative front-view Cassia anatomy and identity anchor.
> Primary request: rotate the same character exactly 90 degrees into a clean neutral SIDE PROFILE facing SCREEN RIGHT. She stands still with both legs vertical, knees straight but relaxed, and both boots together on one shared baseline. No walking pose yet.
> Identity/invariants: preserve the exact same adult Cassia face, horns, auburn mane, red scarf, black/gold leather outfit, body proportions, leg thickness and boot design from Image 1. Preserve anatomical left/right identity internally. Arms rest neutrally; tail hangs naturally.
> Style: same crisp late-era 16-bit arcade pixel art and scale as Image 1.
> Backdrop: genuinely transparent.
> Constraints: exactly one complete full-body sprite; strict side profile; feet together; no stride, no three-quarter front view, no motorcycle, weapon, shadow, effects, text, scenery or watermark.

### Cassia — neutral left profile

> Use case: identity-preserve.
> Asset type: one production 16-bit pixel-art character anchor.
> Input image: Image 1 is the authoritative front-view cassia anatomy and identity anchor.
> Primary request: rotate the same character into a clean neutral profile facing SCREEN LEFT. Stand still, both legs vertical and both boots together on one baseline. No walking yet.
> Identity tracking: The gold sun emblem remains permanently on the anatomical LEFT thigh.
> Preserve exact face, horns, hair, outfit, body proportions, leg thickness, pixel style and left/right identity from Image 1.
> Backdrop: genuinely transparent.
> Constraints: exactly one complete sprite; no stride; no mirrored redesign; no swapped marker or arm; no motorcycle, weapon, shadow, effects, text, scenery or watermark.

### Bruna — front identity anchor

> Use case: identity-preserve.
> Asset type: one production 16-bit pixel-art character anchor.
> Input image: Image 1 is Bruna's authoritative game identity and costume reference.
> Primary request: draw exactly ONE complete full-body Bruna standing ANFAS, straight toward the camera, neutral, with both boots parallel and equally visible.
> Identity: tall muscular adult charcoal-gray cow heroine, black mane, ivory horns, cobalt sleeveless biker vest, dark blue jeans and heavy black boots. Her ANATOMICAL LEFT ARM is always segmented silver cybernetic with cyan joints; anatomical RIGHT ARM is organic dark fur.
> Anatomy: clear separate left/right hips, thighs, knees and boots, natural muscular proportions, arms relaxed, fixed baseline.
> Style: crisp late-era 16-bit arcade pixel art matching Image 1.
> Backdrop: genuinely transparent.
> Constraints: one character, true front view, no walking, no swapped cyberarm, no motorcycle, weapon, shadow, effects, text, scenery or watermark.

### Bruna — neutral right profile

> Use case: identity-preserve.
> Asset type: one production 16-bit pixel-art character anchor.
> Input image: Image 1 is the authoritative front-view bruna anatomy and identity anchor.
> Primary request: rotate the same character into a clean neutral profile facing SCREEN RIGHT. Stand still, both legs vertical and both boots together on one baseline. No walking yet.
> Identity tracking: The segmented silver/cyan cyberarm remains permanently the anatomical LEFT arm; organic arm remains right.
> Preserve exact face, horns, hair, outfit, body proportions, leg thickness, pixel style and left/right identity from Image 1.
> Backdrop: genuinely transparent.
> Constraints: exactly one complete sprite; no stride; no mirrored redesign; no swapped marker or arm; no motorcycle, weapon, shadow, effects, text, scenery or watermark.

### Bruna — neutral left profile

> Use case: identity-preserve.
> Asset type: one production 16-bit pixel-art character anchor.
> Input image: Image 1 is the authoritative front-view bruna anatomy and identity anchor.
> Primary request: rotate the same character into a clean neutral profile facing SCREEN LEFT. Stand still, both legs vertical and both boots together on one baseline. No walking yet.
> Identity tracking: The segmented silver/cyan cyberarm remains permanently the anatomical LEFT arm; organic arm remains right.
> Preserve exact face, horns, hair, outfit, body proportions, leg thickness, pixel style and left/right identity from Image 1. Use an independently authored rear-three-quarter profile: organic right arm is camera-near and the left cyberarm remains visible on the far side.
> Backdrop: genuinely transparent.
> Constraints: exactly one complete sprite; no stride; no mirrored redesign; no swapped marker or arm; no motorcycle, weapon, shadow, effects, text, scenery or watermark.

### Nova — front identity anchor

> Use case: identity-preserve.
> Asset type: one production 16-bit pixel-art character anchor.
> Input image: Image 1 is Nova's authoritative game identity and costume reference.
> Primary request: draw exactly ONE complete full-body Nova standing ANFAS, straight toward camera, neutral, both boots parallel and equally visible.
> Identity: athletic adult white cow heroine, platinum quiff, dark horns, amber visor, magenta scarf, black-white-red racing outfit, red kneepads and red-white boots. Add one natural CHARCOAL COW SPOT on her ANATOMICAL LEFT outer thigh above the red kneepad; keep the anatomical RIGHT thigh mostly white. This stable spot identifies the left leg in later frames.
> Anatomy: clear separate left/right hips, thighs, knees and boots, natural athletic proportions, arms relaxed, fixed baseline.
> Style: crisp late-era 16-bit arcade pixel art matching Image 1.
> Backdrop: genuinely transparent.
> Constraints: one character, true front view, no walking, no motorcycle, weapon, shadow, effects, text, scenery or watermark.

### Nova — neutral right profile

> Use case: identity-preserve.
> Asset type: one production 16-bit pixel-art character anchor.
> Input image: Image 1 is the authoritative front-view nova anatomy and identity anchor.
> Primary request: rotate the same character into a clean neutral profile facing SCREEN RIGHT. Stand still, both legs vertical and both boots together on one baseline. No walking yet.
> Identity tracking: The large charcoal spot remains permanently on the anatomical LEFT outer thigh; anatomical RIGHT thigh stays mostly white.
> Preserve exact face, horns, hair, outfit, body proportions, leg thickness, pixel style and left/right identity from Image 1.
> Backdrop: genuinely transparent.
> Constraints: exactly one complete sprite; no stride; no mirrored redesign; no swapped marker or arm; no motorcycle, weapon, shadow, effects, text, scenery or watermark.

### Nova — neutral left profile

> Use case: identity-preserve.
> Asset type: one production 16-bit pixel-art character anchor.
> Input image: Image 1 is the authoritative front-view nova anatomy and identity anchor.
> Primary request: rotate the same character into a clean neutral profile facing SCREEN LEFT. Stand still, both legs vertical and both boots together on one baseline. No walking yet.
> Identity tracking: The large charcoal spot remains permanently on the anatomical LEFT outer thigh; anatomical RIGHT thigh stays mostly white.
> Preserve exact face, horns, hair, outfit, body proportions, leg thickness, pixel style and left/right identity from Image 1.
> Backdrop: genuinely transparent.
> Constraints: exactly one complete sprite; no stride; no mirrored redesign; no swapped marker or arm; no motorcycle, weapon, shadow, effects, text, scenery or watermark.

### Cassia right-facing — right leg forward

> Use case: identity-preserve.
> Asset type: one production 16-bit pixel-art walk keyframe.
> Input image: Image 1 is Cassia standing in neutral profile facing screen-right.
> Primary request: make exactly ONE clear step forward with her ANATOMICAL RIGHT LEG.
> Unambiguous costume tracking: the large GOLD SUN EMBLEM belongs to her ANATOMICAL LEFT THIGH. That SUN-MARKED LEFT LEG MUST STAY BEHIND at screen-left as the rear support leg. The OTHER, UNMARKED RIGHT THIGH/KNEE/BOOT must move forward toward screen-right and its boot must be the rightmost boot. The sun emblem must remain fully visible on the REAR thigh, never on the forward thigh.
> This is the visual acceptance test: forward leg has NO sun emblem; rear leg HAS the sun emblem.
> Preserve Cassia's identity, neutral profile viewpoint, proportions, black/gold outfit, pixel style, transparency, scale and baseline. Natural opposite arm swing.
> Constraints: exactly one full-body sprite; do not put the sun-marked leg forward; no second pose, text, labels, arrows, shadow, scenery, vehicle, weapon or watermark.

### Cassia right-facing — left leg forward

> Use case: identity-preserve.
> Asset type: one production 16-bit pixel-art walk keyframe.
> Input image: Image 1 is Cassia standing in neutral profile facing screen-right.
> Primary request: keep her facing screen-right and make her take ONE clear natural step FORWARD WITH HER ANATOMICAL LEFT LEG. Move the LEFT thigh, LEFT knee and LEFT boot together forward toward screen-right. The RIGHT leg stays behind as the rear support leg. Let arms counter-swing naturally.
> This is specifically the LEFT-LEG-FORWARD keyframe, the anatomical opposite of a right-leg-forward step.
> Constraints: preserve the exact character identity, costume, profile viewpoint, body proportions, pixel-art style, transparency, scale and ground baseline from Image 1. Exactly one full-body sprite. No right-leg-forward pose, no second pose, no text, labels, arrows, shadow, scenery, vehicle, weapon or watermark.

### Cassia left-facing — right leg forward marker correction

> Edit only the leg identity marker in this LEFT-FACING Cassia walk frame. This is RIGHT LEG FORWARD. Remove the gold sun emblem from the forward thigh on the SCREEN-LEFT side. Put that exact single gold sun emblem on the trailing thigh on the SCREEN-RIGHT side, because the trailing leg is her anatomical LEFT leg. Do not change pose, silhouette, boot positions, face, torso, scarf, arms, pixel-art style, scale, palette or transparency. Exactly one thigh sun emblem, on the rear screen-right leg. No text, no glow, transparent background.

### Cassia left-facing — left leg forward

> Edit the supplied Cassia neutral LEFT-FACING profile into one isolated full-body 16-bit pixel-art WALK CONTACT pose, transparent background. She travels toward SCREEN-LEFT. This exact frame is LEFT LEG FORWARD: her anatomical LEFT boot, unmistakably belonging to the leg with the gold sun emblem on its thigh, is planted far ahead toward screen-left; her anatomical RIGHT leg without that thigh emblem trails behind toward screen-right. Keep the sun emblem physically attached to the forward LEFT thigh. Make the two boots clearly separated by at least one boot length. Natural counter-swing arms, confident motion, no bike, no weapon. Preserve face, red scarf, outfit, proportions and chunky Genesis-era pixels. Do not mirror the design, do not swap or duplicate the sun emblem, no text, no glow, no floor, transparent background.

### Bruna right-facing — right leg forward

> Edit the supplied Bruna neutral RIGHT-FACING profile into one isolated full-body 16-bit pixel-art WALK CONTACT pose, transparent background. She travels toward SCREEN-RIGHT. This exact frame is RIGHT LEG FORWARD: her anatomical RIGHT boot is planted far ahead toward screen-right and her anatomical LEFT leg trails behind toward screen-left. To make anatomy auditable, add and preserve one narrow CYAN METAL KNEE STRAP only on the anatomical LEFT jeans leg; in this frame that marked LEFT leg must be the trailing screen-left leg. Her anatomical LEFT ARM is the silver cybernetic arm: it naturally swings FORWARD toward screen-right, opposite the forward right leg. Her organic right arm swings back. Boots separated by at least one boot length. Preserve face, vest, jeans, muscular build, cyberarm and chunky Genesis-era pixels. Do not mirror the design; never put metal on the organic arm; no bike, no weapon, no text, no floor, transparent background.

### Bruna right-facing — left leg forward

> Edit the supplied Bruna neutral RIGHT-FACING profile into one isolated full-body 16-bit pixel-art WALK CONTACT pose, transparent background. She travels toward SCREEN-RIGHT. This exact frame is LEFT LEG FORWARD: her anatomical LEFT boot is planted far ahead toward screen-right and her anatomical RIGHT leg trails behind toward screen-left. To make anatomy auditable, add and preserve one narrow CYAN METAL KNEE STRAP only on the anatomical LEFT jeans leg; in this frame that marked LEFT leg must be the forward screen-right leg. Her anatomical LEFT ARM is the silver cybernetic arm: it naturally swings BACK toward screen-left, opposite the forward left leg. Her organic right arm swings forward. Boots separated by at least one boot length. Preserve face, vest, jeans, muscular build, cyberarm and chunky Genesis-era pixels. Do not mirror the design; never put metal on the organic arm; no bike, no weapon, no text, no floor, transparent background.

### Bruna left-facing — right leg forward

> Edit the supplied Bruna neutral LEFT-FACING profile into one isolated full-body 16-bit pixel-art WALK CONTACT pose, transparent background. She travels toward SCREEN-LEFT. This exact frame is RIGHT LEG FORWARD: her anatomical RIGHT boot is planted far ahead toward screen-left and her anatomical LEFT leg trails behind toward screen-right. Add exactly one narrow CYAN METAL KNEE STRAP only on the anatomical LEFT jeans leg; here the marked LEFT leg is the trailing screen-right leg. Her anatomical LEFT ARM is the silver cybernetic arm and swings FORWARD toward screen-left, opposite the forward right leg; her organic right arm swings back. Boots separated by at least one boot length. Preserve the rear three-quarter left-facing view, face, vest, jeans, muscular build and chunky Genesis-era pixels. Never mirror the design, never put metal on the organic right arm, no bike, no weapon, no text, no floor, transparent background.

### Bruna left-facing — left leg forward

> Edit the supplied Bruna neutral LEFT-FACING profile into one isolated full-body 16-bit pixel-art WALK CONTACT pose, transparent background. She travels toward SCREEN-LEFT. This exact frame is LEFT LEG FORWARD: her anatomical LEFT boot is planted far ahead toward screen-left and her anatomical RIGHT leg trails behind toward screen-right. Add exactly one narrow CYAN METAL KNEE STRAP only on the anatomical LEFT jeans leg; here the marked LEFT leg is the forward screen-left leg. Her anatomical LEFT ARM is the silver cybernetic arm and swings BACK toward screen-right, opposite the forward left leg; her organic right arm swings forward. Boots separated by at least one boot length. Preserve the rear three-quarter left-facing view, face, vest, jeans, muscular build and chunky Genesis-era pixels. Never mirror the design, never put metal on the organic right arm, no bike, no weapon, no text, no floor, transparent background.

### Nova right-facing — right leg forward

> Edit the supplied Nova neutral RIGHT-FACING profile into one isolated full-body 16-bit pixel-art WALK CONTACT pose, transparent background. She travels toward SCREEN-RIGHT. This exact frame is RIGHT LEG FORWARD: her mostly WHITE anatomical RIGHT leg and red boot are planted far ahead toward screen-right. Her anatomical LEFT leg, unmistakably identified by the large natural CHARCOAL-BLACK hide patch on the outer thigh, trails behind toward screen-left. Keep that same charcoal patch physically attached to the trailing LEFT thigh. Boots separated by at least one boot length, natural opposite arm swing, scarf streams behind. Preserve visor, red armor, cow markings, proportions and chunky Genesis-era pixels. Do not mirror or duplicate the charcoal marker; no bike, no weapon, no text, no floor, transparent background.

### Nova right-facing — left leg forward marker correction

> Edit only Nova's upper-thigh hide markings in this RIGHT-FACING walk frame. This is LEFT LEG FORWARD. Remove the large charcoal-black S-shaped patch from the trailing upper thigh on SCREEN-LEFT. Paint that same single large charcoal-black S-shaped hide patch on the forward upper thigh on SCREEN-RIGHT, because that forward leg is her anatomical LEFT leg. Do not change pose, silhouette, boot positions, knee armor, lower-leg spots, face, torso, scarf, arms, pixel-art style, scale, palette or transparency. The marked left thigh is screen-right and forward; the screen-left trailing thigh is mostly white. No text, no glow, transparent background.

### Nova left-facing — right leg forward marker correction

> Edit only Nova's upper-thigh hide markings in this LEFT-FACING walk frame. This is RIGHT LEG FORWARD. Remove the large charcoal-black S-shaped patch from the forward upper thigh on SCREEN-LEFT. Paint that same single large charcoal-black S-shaped hide patch on the trailing upper thigh on SCREEN-RIGHT, because that trailing leg is her anatomical LEFT leg. Do not change pose, silhouette, boot positions, knee armor, lower-leg spots, face, torso, scarf, arms, pixel-art style, scale, palette or transparency. The marked left thigh is screen-right and rear; the screen-left forward thigh is mostly white. No text, no glow, transparent background.

### Nova left-facing — left leg forward

> Edit the supplied Nova neutral LEFT-FACING profile into one isolated full-body 16-bit pixel-art WALK CONTACT pose, transparent background. She travels toward SCREEN-LEFT. This exact frame is LEFT LEG FORWARD: her anatomical LEFT leg, unmistakably identified by the large natural CHARCOAL-BLACK hide patch on the outer thigh, and its red boot are planted far ahead toward screen-left. Her mostly white anatomical RIGHT leg trails behind toward screen-right. Keep that same charcoal patch physically attached to the forward LEFT thigh. Boots separated by at least one boot length, natural opposite arm swing, scarf streams behind toward screen-right. Preserve visor, red armor, cow markings, proportions and chunky Genesis-era pixels. Do not mirror or duplicate the charcoal marker; no bike, no weapon, no text, no floor, transparent background.

### Cassia — right-facing passing pose

> Using the two supplied contact poses as strict character references, create ONE isolated full-body 16-bit pixel-art WALK PASSING pose of the same heroine traveling toward SCREEN-RIGHT. This is the exact in-between frame: the rear foot has lifted and passes close beside the planted foot, knees overlap naturally, torso keeps the same three-quarter camera angle and the arms pass through their counter-swing. Preserve the same head size, body proportions, outfit, palette, facial design, silhouette thickness and Genesis-era pixel scale as the two contact references. The gold sun emblem remains attached only to her anatomical LEFT thigh. Do not turn into a narrow pure side profile. Do not mirror the character design. No bike, no weapon, no extra limbs, no text, no floor, transparent background.

### Cassia — left-facing passing pose

> Using the two supplied contact poses as strict character references, create ONE isolated full-body 16-bit pixel-art WALK PASSING pose of the same heroine traveling toward SCREEN-LEFT. This is the exact in-between frame: the rear foot has lifted and passes close beside the planted foot, knees overlap naturally, torso keeps the same three-quarter camera angle and the arms pass through their counter-swing. Preserve the same head size, body proportions, outfit, palette, facial design, silhouette thickness and Genesis-era pixel scale as the two contact references. The gold sun emblem remains attached only to her anatomical LEFT thigh. Do not turn into a narrow pure side profile. Do not mirror the character design. No bike, no weapon, no extra limbs, no text, no floor, transparent background.

### Bruna — right-facing passing pose

> Using the two supplied contact poses as strict character references, create ONE isolated full-body 16-bit pixel-art WALK PASSING pose of the same heroine traveling toward SCREEN-RIGHT. This is the exact in-between frame: the rear foot has lifted and passes close beside the planted foot, knees overlap naturally, torso keeps the same three-quarter camera angle and the arms pass through their counter-swing. Preserve the same head size, body proportions, outfit, palette, facial design, silhouette thickness and Genesis-era pixel scale as the two contact references. Her silver cybernetic arm is always the anatomical LEFT arm, her organic arm is always the anatomical RIGHT arm, and the single cyan knee strap remains only on the anatomical LEFT leg. Do not turn into a narrow pure side profile. Do not mirror the character design. No bike, no weapon, no extra limbs, no text, no floor, transparent background.

### Bruna — left-facing passing pose

> Using the two supplied contact poses as strict character references, create ONE isolated full-body 16-bit pixel-art WALK PASSING pose of the same heroine traveling toward SCREEN-LEFT. This is the exact in-between frame: the rear foot has lifted and passes close beside the planted foot, knees overlap naturally, torso keeps the same three-quarter camera angle and the arms pass through their counter-swing. Preserve the same head size, body proportions, outfit, palette, facial design, silhouette thickness and Genesis-era pixel scale as the two contact references. Her silver cybernetic arm is always the anatomical LEFT arm, her organic arm is always the anatomical RIGHT arm, and the single cyan knee strap remains only on the anatomical LEFT leg. Do not turn into a narrow pure side profile. Do not mirror the character design. No bike, no weapon, no extra limbs, no text, no floor, transparent background.

### Nova — right-facing passing pose

> Using the two supplied contact poses as strict character references, create ONE isolated full-body 16-bit pixel-art WALK PASSING pose of the same heroine traveling toward SCREEN-RIGHT. This is the exact in-between frame: the rear foot has lifted and passes close beside the planted foot, knees overlap naturally, torso keeps the same three-quarter camera angle and the arms pass through their counter-swing. Preserve the same head size, body proportions, outfit, palette, facial design, silhouette thickness and Genesis-era pixel scale as the two contact references. The large charcoal S-shaped hide patch remains attached only to her anatomical LEFT upper thigh. Do not turn into a narrow pure side profile. Do not mirror the character design. No bike, no weapon, no extra limbs, no text, no floor, transparent background.

### Nova — left-facing passing pose

> Using the two supplied contact poses as strict character references, create ONE isolated full-body 16-bit pixel-art WALK PASSING pose of the same heroine traveling toward SCREEN-LEFT. This is the exact in-between frame: the rear foot has lifted and passes close beside the planted foot, knees overlap naturally, torso keeps the same three-quarter camera angle and the arms pass through their counter-swing. Preserve the same head size, body proportions, outfit, palette, facial design, silhouette thickness and Genesis-era pixel scale as the two contact references. The large charcoal S-shaped hide patch remains attached only to her anatomical LEFT upper thigh. Do not turn into a narrow pure side profile. Do not mirror the character design. No bike, no weapon, no extra limbs, no text, no floor, transparent background.


## Wave 33 — Cassia depth-swap contacts (partial, not production)

Generated with the built-in `imagegen` tool. These two accepted contact masters are stored in `.gauntlet/iteration-33/raw/`. They are intentionally not connected to production until four distinct passing poses can be generated and independently accepted. The passing-pose batch was stopped by HTTP 429 `usage_limit_reached`.

### Cassia right-facing — far right leg leads with near-left depth occlusion

> Edit this Cassia RIGHT-FACING right-leg-forward walk contact into a decisive THREE-QUARTER DEPTH-SWAP pose. Keep her anatomical RIGHT boot planted furthest toward screen-right and her anatomical LEFT boot trailing toward screen-left. CRITICAL OCCLUSION: the anatomical LEFT leg is the CAMERA-NEAR leg, identified by the gold sun emblem. Although it trails, its lit left thigh must visibly cross IN FRONT OF the pelvis seam and OCCLUDE the root of the forward right thigh. The anatomical RIGHT leg leading toward screen-right is CAMERA-FAR: draw its entire thigh, knee, shin and boot darker/desaturated and clearly BEHIND the near left leg at the hip. Show different knee silhouettes and heel/toe angles; do not merely move or recolor the sun emblem. Strong opposite shoulder/arm swing. Preserve exact face, scarf, outfit and late-16-bit pixel style. One whole full-body sprite, transparent background, no bike, no text, no floor, no glow.

### Cassia left-facing — far left leg leads with near-right depth occlusion

> Edit this Cassia LEFT-FACING left-leg-forward walk contact into a decisive REAR THREE-QUARTER DEPTH-SWAP pose. Keep her anatomical LEFT boot planted furthest toward screen-left and her anatomical RIGHT boot trailing toward screen-right. CRITICAL OCCLUSION: the anatomical RIGHT leg without the sun emblem is the CAMERA-NEAR leg. Although it trails, its lit right thigh must visibly cross IN FRONT OF the pelvis seam and OCCLUDE the root of the forward left thigh. The anatomical LEFT leg leading toward screen-left, identified by the gold sun emblem, is CAMERA-FAR: draw its entire thigh, knee, shin and boot darker/desaturated and clearly BEHIND the near right leg at the hip. Show different knee silhouettes and heel/toe angles; do not merely move or recolor the sun emblem. Strong opposite shoulder/arm swing. Preserve exact face, scarf, outfit and late-16-bit pixel style. One whole full-body sprite, transparent background, no bike, no text, no floor, no glow.
