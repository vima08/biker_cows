# Gauntlet Visual Critique — iteration 6

## Verdict

**Premium / high-end 16-bit «AAA эпохи»: НЕТ.** Это уже заметно более сильный polished prototype, чем iteration 5: три игровых героя получили полноценные raster sheets, а финальный boss впервые выглядит как один цельный объект, а не как хороший core поверх чужого chassis. Но цельной high-end 16-bit игрой кадр всё ещё не является. Дорогие hero/boss sprites остаются островами внутри плоского procedural/vector мира; `select` по-прежнему выглядит на один-два production tier ниже `menu`, а большая часть обычных врагов и miniboss не получила того же authored raster coverage.

Коротко по трём заявленным улучшениям:

- **3 hero coverage — существенный PASS на уровне ассетов и игровой идентичности.** Throttle, Modo и Vinnie теперь имеют по 8 различимых authored frames и все показаны в gameplay. Однако полный runtime reaction cycle визуально доказан только для Throttle; Modo/Vinnie доказаны отдельными drive/fire/hit состояниями, не всей цепочкой.
- **Full boss cohesion — PASS.** `boss-body-sheet` и `boss-core-sheet` говорят на одном языке; в `boss.png` это единая фиолетовая skull-like war machine с общей перспективой, светом, outline и damage logic. Главный дефект iteration 5 закрыт.
- **Contact / debris / wobble — смешанный результат.** Contact теперь читается точно и заслуживает PASS. Debris всё ещё слишком мал и редок — FAIL. Wobble обозначен, но в контрольном still не доказывает затухающую смену направлений — PARTIAL.

## Blind-ish first read — до `report.json`

### Контрольные сцены

- `menu.png` остаётся самым дорогим кадром: плотный key art, сильная диагональ трассы, сложный силуэт цитадели, хороший цветовой фокус и уверенная типографика. Он продаёт игру почти как готовый premium product.
- `select.png` сразу обрушает это обещание. Три лица собраны из крупных плоских геометрических масс; глаза, морды, уши и одежда почти не имеют material shading. Это не стилистическая экономия уровня 16-bit portrait art, а другой, более дешёвый способ рисования. Особенно заметно теперь, когда реальные Modo/Vinnie sheets значительно богаче своих select-портретов.
- `ride.png` впервые убедительно показывает Modo как настоящего production-персонажа. Его серебряное тело, объём рук, мотоцикл и пушка имеют ясный силуэт и хорошую внутреннюю иерархию. `ride-sequence-a/b/c` подтверждает drive/fire/hit variation, хотя между соседними кадрами движение корпуса довольно сдержанное.
- `vinnie-ride.png` доказывает третьего героя в реальном gameplay: Vinnie хорошо отличается от двух остальных по бело-красной палитре, спортивной геометрии байка и вытянутому laser silhouette. Герой выглядит дорого; атакованный объект справа снова выглядит простым геометрическим знаком.
- `combat.png`: Throttle уверенно читается, огонь и HUD имеют понятную причинность, но `ROAD-RIPPER MK.IV` — плоский angular/vector miniboss. Богатый герой слева и упрощённая фиолетовая машина справа выглядят как элементы из разных art pipelines.
- `boss.png` — крупнейший успех итерации. Корпус больше не белая схема: это цельная тяжёлая машина с читаемыми бронеплитами, гусеницами, рёбрами, орудиями и встроенным core. Масса и угроза считываются сразу, а Throttle остаётся видимым, несмотря на масштаб босса.
- `boss-exchange.png` сохраняет цельность boss silhouette под плотным bullet field. Локальный оранжевый contact в core и мелкие обломки у основания работают. Но размытые purple orbs и дымный rocket trail имеют более мягкую, современную additive/blur обработку, чем жёсткий raster boss; это локальный style mismatch, хотя уже не проблема конструкции самого босса.
- `victory.png` функционально чист и читаем, но всё ещё выглядит как стандартное модальное окно поверх приглушённого gameplay. После столь сильного title и крупного босса финалу не хватает authored victory tableau, крупного character pose или разрушенного boss silhouette.

### Все шесть sprite sheets

- `throttle-sheet.png` — сильный production sheet: idle/fire, compression, lean/backbend, damage и recovery дают разные линии спины, шарфа, передней вилки и колёс.
- `modo-sheet.png` — крупный качественный апгрейд iteration 5. Все восемь кадров сохраняют массу и характер Modo; металлические руки, трёхствольная пушка и тяжёлый байк не распадаются при смене poses. Некоторые состояния отличаются скорее torso lean, чем новым общим силуэтом, но это уже полноценный atlas, не flat substitute.
- `vinnie-sheet.png` — столь же полноценный набор. Sport-bike silhouette, белая шерсть, красный scarf/gear и длинное оружие дают отличную читаемость; extreme crouch и wheel/recovery poses выражены лучше, чем у Modo.
- `rider-sheet.png` остаётся хорошим authored enemy sheet с fire, squash/backbend и damaged states. Слабое место прежнее: debris vocabulary почти исчерпывается одной синей пластиной и несколькими крошечными точками.
- `boss-body-sheet.png` — самый важный новый набор. Шесть кадров не просто меняют glow: броня проседает, core cavity раскрывается, у основания появляются fragments, в поздних состояниях есть smoke. Повреждение затрагивает массу корпуса.
- `boss-core-sheet.png` хорошо дополняет body: рост свечения, crack, выломанные панели, electricity и smoke читаются как последовательная damage chain. Core больше не требует чужой оболочки, чтобы выглядеть эффектно.

Сами sheets имеют высокое качество. Их проблема теперь не authored deformation, а то, что трасса, props, UFO/обычные враги, miniboss и select portraits не получили сопоставимого покрытия и material density.

## Runtime facts — после визуального чтения

`report.json` — валидный production run: `ok: true`, `runtimeErrors: []`. Все шесть atlas имеют `state: ready`, frame size `256×192`: Throttle, Modo и Vinnie по 8 frames, rider, boss body и boss core по 6.

Отчёт подтверждает реальное покрытие героев: старт сделан за Modo, `ride` фиксирует Modo с тремя врагами, отдельный `vinnieRide` фиксирует Vinnie с laser, а combat/boss/victory пройдены за Throttle. Это важное функциональное улучшение, но `ready` не доказывает, что каждый pose одинаково хорошо читается в конечном масштабе.

Impact beat имеет длительность `2140 ms`, contact на `840 ms`. В contact score меняется `0 → 4`, `riderReaction` достигает `1.75`, затем падает до `0.45` к recovery. Это подтверждает логику последовательности, но визуальный статус отдельных фаз ниже основан на captures, а не на labels.

Boss path также реален: `boss.png` фиксирует `3348/3500 HP`, `boss-exchange.png` — `2396/3500 HP`, score растёт `48 → 258`, затем есть `state: win` и restart. То есть цельный boss asset не является workbench mockup; он реально участвует в encounter.

## Improvement относительно iteration 5

| Область | Iteration 5 | Iteration 6 | Итог |
|---|---|---|---|
| Три героя | Только Throttle держал production raster tier; Modo в gameplay выглядел flat, Vinnie не был доказан | Три отдельных 8-frame sheets; Modo и Vinnie реально показаны в ride/fire/hit контексте | **Большой прогресс / PASS**, с оговоркой о неполном runtime proof всех фаз Modo/Vinnie |
| Full boss cohesion | Детальный core был приклеен к бело-серому chassis другого стиля | Body и core — согласованные 6-frame sheets; единая масса, lighting, outline и damage progression | **Главный gap закрыт / PASS** |
| Contact | Малый glint и spatial ambiguity между projectile и телом | В frame 3 cyan-white burst сидит непосредственно на target silhouette, projectile исчезает в точке удара | **Заметный прогресс / PASS** |
| Debris | Одна маленькая синяя пластина | Одна основная пластина плюс несколько слишком мелких specks; площадь события всё ещё мала | **Незначительный прогресс / FAIL** |
| Recovery wobble | Почти неотличимый от idle jitter | Есть purple vibration accents и возврат pose, но still не показывает затухающую смену направлений | **Слабый прогресс / PARTIAL** |
| Environment / material grid | Raster actors были «наклеены» на polygon mountains, пустой asphalt и простые props | Сильные actors стали ещё лучше, а mountains/road/lamps/signs остались почти теми же; контраст tier усилился | **Не закрыто / FAIL** |
| Select/title gap | Flat geometric portraits против дорогого title art | Select визуально почти не поднялся, хотя gameplay likeness героев теперь даёт готовую планку | **Не закрыто / FAIL** |
| Enemy/miniboss coverage | Один хороший rider на фоне flat enemy vocabulary | Rider остаётся хорош, но UFO/drones и `ROAD-RIPPER MK.IV` всё ещё procedural/vector | **Не закрыто / PARTIAL по roster, FAIL по miniboss** |

## Сравнение с локальными Mega Drive refs

| Референс | Что iteration 6 уже догнал | Где всё ещё проигрывает |
|---|---|---|
| Thunder Force IV | Финальный boss теперь имеет сопоставимо убедительную единую массу и внутреннюю детализацию | В референсе boss, вода, скалы, explosions и projectiles используют один material/pixel язык; здесь boss богаче дороги, города и мягких purple FX |
| Gunstar Heroes | Boss body/core damage chain теперь действительно authored и распространяется на корпус | Обычный rider impact всё ещё не имеет крупного fire/contact volume и убедительного multi-fragment break |
| Contra: Hard Corps | Размер boss и читаемость маленького игрока работают; корпус больше не распадается на chassis + overlay | Референс конструктивно встраивает гиганта в перспективу дороги; здесь flat highway остаётся пустой сценой под богатым sprite |
| Batman MD | Ночная палитра и скоростная читаемость уже есть | Asphalt, фасады, light pools и props не имеют плотного dithering/material variation; окружение не создаёт конкретного места |

Именно поэтому новый boss может конкурировать с референсами как отдельный asset, но полный gameplay frame пока не конкурирует с ними как единая сцена.

## 8-frame impact beat

| Frame | Фаза из report | Статус | Визуальное основание |
|---:|---|---|---|
| 0 | muzzle | **PASS** | Яркий жёлтый launch shape находится у линии ствола; направление атаки мгновенно понятно |
| 1 | early travel | **PASS** | Один projectile ясно отделён от игрока и движется по пустой action lane к цели |
| 2 | late travel | **PASS** | Projectile дошёл до правой половины, остаётся на высоте target torso; причинность не теряется |
| 3 | contact core | **PASS** | Cyan-white burst расположен прямо на rider silhouette, старый жёлтый projectile больше не висит отдельно; это явный `projectile → contact → body` |
| 4 | target squash | **PARTIAL** | Цель сидит ниже и компактнее, рядом остаются синие частицы, но новый silhouette недостаточно отличается от contact pose, чтобы стать отдельным сильным beat |
| 5 | recoil/backbend | **PARTIAL** | Есть небольшой rebound по высоте/позе, но в конечном масштабе он слишком близок к frames 4/6; заявленный backbend из sheet не продаётся как сильный direction change |
| 6 | debris break | **FAIL** | Видна одна основная синяя пластина и несколько крошечных specks в малой области; нет 5–8 fragments, двух размеров и широкого разлёта |
| 7 | recovery wobble | **PARTIAL** | Purple vibration marks показывают нестабильность, но один capture почти совпадает с обычным riding pose и не доказывает минимум три затухающие смены направления |

Последовательность стала причинно чище именно в contact. Но premium impact должен сохранять силу после контакта: сейчас кадры 4–7 теряют amplitude быстрее, чем в Thunder Force IV/Gunstar Heroes.

## Критерии

- **Hero silhouette / coverage:** PASS для трёх sheets и трёх игровых identities; PARTIAL для runtime-доказательства полного reaction cycle Modo/Vinnie.
- **Full boss integration:** PASS внутри boss; body/core воспринимаются одной машиной. PARTIAL для его интеграции в flat environment.
- **Authored deformation:** PASS у heroes и boss sheets; PARTIAL у rider encounter из-за слабых late beat phases.
- **Impact causality:** PASS до contact включительно; PARTIAL для squash/recoil; FAIL для debris; PARTIAL для wobble.
- **Environment / material cohesion:** FAIL. Raster density, outline/shading и pixel cluster size героев/босса не совпадают с polygon mountains, простыми city blocks, signage, lamps, UFO и почти пустым asphalt.
- **Enemy/miniboss coverage:** PARTIAL в целом. Rider хорош; воздушные archetypes и miniboss ниже production tier.
- **HUD hierarchy:** PASS. Hero/status, objective, weapon и boss bar быстро читаются и не мешают action lane.
- **Title/select/game tier:** FAIL. Hero/boss gameplay приблизился к title, но `select`, world, miniboss и victory всё ещё дают явный tier drop.
- **Finale payoff:** PARTIAL. Победа функциональна, но не соответствует масштабу boss encounter и качеству menu art.

## Один крупнейший оставшийся gap

**Неполное покрытие единого authored raster/material grid на world-side контенте.**

Теперь проблема видна особенно чётко: premium heroes и цельный premium boss уже существуют, но road/rail, mountains/city, lamps/signs, UFO/drones, miniboss и select portraits выполнены более плоской процедурной геометрией. Это один корневой gap, а не набор косметических мелочей. Он одновременно создаёт эффект «дорогой sprite на дешёвой сцене», удерживает title/select tier gap и оставляет большую часть encounter roster ниже качества главных персонажей.

Новый HUD pass, ещё один glow или дополнительная частица этот gap не закроют.

## Builder-ready следующая итерация

Сделать один **world + roster cohesion pass**, сохранив текущие hero sheets, boss body/core composition, HUD hierarchy и timing contact.

### P0 — единый pixel/material contract

1. Рендерить gameplay в логический framebuffer `320×180`, выводить в `1280×720` только integer `4× nearest-neighbor`. Не использовать scanline overlay как замену общей pixel grid.
2. Подготовить production exports actors на этом native grid: hero envelope ориентировочно `58–66 × 42–50` logical px, rider `44–52 × 34–42`, boss `105–120 × 50–62`. Downsample должен быть pre-baked и вручную очищен, а не сделан browser smoothing.
3. Убрать из финального gameplay anti-aliased Canvas/SVG geometry для scenery и enemies. Зафиксировать одну outline policy, top-left light и 3–4-step material ramps для металла, асфальта, камня/зданий и emissive FX.

### P0 — authored environment и enemy coverage

1. Перевести в raster tiles/sprites road surface, lower road edge, rail, mountains/city, lamps и signs. Сохранить текущий parallax timing, но заменить плоские заливки на material clusters: asphalt dither/patches, rail highlights/shadows, façade windows/pipes и локальные light pools.
2. Сделать authored sheets для всех реально видимых non-rider threats: UFO/air drone и `ROAD-RIPPER MK.IV`. Rider sheet можно оставить.
3. Не менять финального boss ради ещё одной вариации: его внутренний cohesion уже достаточен. Нужна интеграция мира вокруг него — shared ground contact shadow, дорожный light spill и 2–3 foreground debris/road elements, связывающих его с трассой.

### P1 — select и последние impact phases

1. Заменить три flat portraits на authored raster busts, основанные на реальных hero sheets: одинаковый outline, минимум три tonal steps на fur/skin и три на gear/metal, уникальный silhouette каждого героя. Не собирать лица из CSS/Canvas primitives.
2. Для rider debris нарисовать отдельный fragment set, а не только одну синюю панель. Wobble доказывать короткой capture sequence, а не только runtime scalar.
3. Victory получить хотя бы один authored payoff layer: крупный hero pose или разрушенный boss silhouette за панелью. Это P1 после world/enemy coverage, не вместо него.

### Measurable DoD

- Все gameplay captures создаются через `320×180 → 4× nearest` без smooth scaling; actor, enemy, environment и FX edges лежат на одном 4-screen-px cluster grid. Исключения — только целочисленные full-screen post-process passes.
- В `ride`, `vinnie-ride`, `combat`, `boss` нет procedural/vector silhouettes для road props, UFO/drones или miniboss. Каждый видимый enemy — raster sheet: обычный archetype имеет минимум **4 states** (`move`, `fire`, `hit`, `destroy`), miniboss — минимум **6** (`idle/move`, `fire`, `hit`, `damage-1`, `damage-2`, `destroy`).
- Каждый gameplay frame показывает минимум **3 читаемых material planes** кроме неба: textured asphalt, shaded rail/prop plane и textured city/mountain plane. В road band есть минимум **3 material events** на ширину экрана — patches, light pools, cracks, tyre marks или debris — без потери свободной action lane.
- `select`: каждый герой имеет raster bust не меньше **64×64 logical px**, минимум **3 tonal steps** на лице/шерсти и gear, одну общую outline/light policy; нет плоской Canvas/CSS face geometry. Blind reviewer узнаёт всех трёх без имён.
- `debris break`: **5–8 видимых fragments** в области минимум **24×16 logical px** (`96×64 screen px`), минимум 2 размера, 2 trajectories и 2 material colors; основная панель не считается более чем одним fragment.
- `recovery wobble`: отдельные captures доказывают минимум **3 смены направления** с offsets примерно `+2 / -2 / +1 / 0 logical px`, затухание за **300–450 ms**. Purple accent сам по себе не засчитывается без движения silhouette.
- Сохранить текущие runtime guarantees: `ok: true`, `runtimeErrors: []`, все 6 atlas `ready`, три героя реально стартуют в gameplay, contact остаётся **800–860 ms**, полный beat — **≤2140 ms**.
- Blind A/B против четырёх локальных refs: минимум **3 из 4 независимых оценок** не отмечают ни player, ни enemy/miniboss, ни boss как «наклеенный raster на vector background»; `select` оценивается не более чем на один tier ниже `menu`.

До выполнения этого world/roster DoD результат нельзя честно называть premium/high-end 16-bit «AAA эпохи», даже при уже действительно сильных hero и boss sheets.
