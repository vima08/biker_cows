# Gauntlet Visual Critique — iteration 7

## Verdict

**Premium / high-end 16-bit «AAA эпохи»: пока НЕТ.** Это сильный polished vertical slice и заметный шаг выше iteration 6 по encounter coverage: `ROAD-RIPPER MK.IV` перестал быть плоской процедурной заглушкой, aerial roster теперь authored raster, а новая панорама сама по себе выглядит как качественный игровой background. Главные riders, miniboss и финальный boss уже способны продавать кадр.

Но целый экран всё ещё не держит одну планку. Дорогие sprites и панорама соседствуют с крупными полосами простой Canvas-геометрии: треугольным midground, гладкими зданиями, лампами, rail и почти пустым асфальтом. `select` остаётся резко дешевле `menu` и gameplay. Мягкие glow/gradient FX конфликтуют с жёстким pixel clustering персонажей. По локальным Mega Drive refs это уже убедительнее как современный fan prototype, но ещё не цельнее как лучший серийный 16-bit production.

**Строгая оценка: 7.4/10 как визуальный vertical slice; не premium gate.** Самые дорогие отдельные assets — да. Единый дорогой кадр во всех состояниях — нет.

## Blind-ish first read captures

| Capture | Оценка | Что читается |
|---|---|---|
| `menu.png` | **PASS / premium** | Лучший экран набора: сложная цитадель, диагональ дороги, крупная техника, уверенная типографика и сфокусированный neon contrast. Обещает коммерческий art tier. |
| `select.png` | **FAIL** | Три bust-портрета собраны из плоских овальных масс, с почти одинаковыми глазами/мордами и минимальным material shading. После title art это резкий tier drop; после просмотра gameplay sheets несоответствие likeness ещё очевиднее. |
| `ride.png` | **PARTIAL+** | Modo и новые корабли имеют хорошую массу и детализацию. Однако fine-grain sprite art лежит на широких гладких полигонах midground/road; персонаж выглядит помещённым поверх сцены, а не освещённым ею. |
| `vinnie-ride.png` | **PARTIAL+** | Vinnie отлично узнаваем, жёлто-красный байк и laser дают свой игровой характер. Brown dust — редкий полезный контакт с дорогой, но laser и hit bubble слишком гладко светятся для языка sprites. |
| `aerial-combat.png` | **PASS по roster / PARTIAL по сцене** | Два ясно различных aerial archetype — синий drone и серый strike craft — хорошо читаются даже в группе из четырёх. Они существенно лучше UFO iteration 6, но их material density снова подчёркивает простоту домов/rail под ними. |
| `combat.png` | **PASS-** | Road Ripper — крупный, узнаваемый, правильно фиолетовый, с убедительной массой, оружием и mechanical breakup. Это главное улучшение итерации. Справа он немного упирается в crop, а procedural city за ним заметно дешевле самого miniboss. |
| `boss.png` | **PASS по boss / PARTIAL по full frame** | Body/core читаются как единая лимбургерская war machine: общий purple metal, ribbing, tracks, orange core и близкая detail frequency. Boss больше не выглядит сборкой из двух чужих стилей. Purple energy column и дым/ракеты принадлежат другому, более мягкому FX-языку. |
| `boss-exchange.png` | **PARTIAL+** | Обмен огнём и опасность понятны, boss сохраняет dominance. Но десятки одинаковых blurred purple spheres превращаются в overlay поверх сцены, а не в кластерные 16-bit projectiles; силуэтный шум растёт быстрее драматизма. |
| `victory.png` | **PARTIAL** | Иерархия и результат ясны, overlay аккуратен. По сравнению с `menu` это функциональная modal card без character payoff, authored victory pose или богатого destruction tableau. |

## Актуальные 8 sheets и panorama

- `throttle-sheet.png`, `modo-sheet.png`, `vinnie-sheet.png`: сильные hero silhouettes, индивидуальные машины и 8 полезных poses. На уровне одного кадра — premium. Между poses местами дрейфуют пропорции головы, оружия, вилки и колёс; это скорее набор красивых key poses, чем безупречно стабильная покадровая модель.
- `rider-sheet.png`: хороший 6-frame enemy vocabulary с hit deformation и повреждённой бронёй. Главный остаточный дефект — destruction/debris всё ещё сводится в основном к одной синей панели и нескольким specks.
- `road-ripper-sheet.png`: **большой PASS относительно iteration 6.** Шесть состояний показывают fire, armour opening, smoke и полноценный wreck. Силуэт, материал и фиолетовая палитра согласованы с boss family.
- `aerials-sheet.png`: **PASS по coverage.** Это фактически два archetype по четыре состояния, а не восемь кадров одного аппарата; оба имеют move/fire/damage-варианты и различимы по форме. Серый craft ближе к authored shooter sprite, синий drone немного проще, но оба несравнимо лучше прежних геометрических UFO.
- `boss-body-sheet.png` + `boss-core-sheet.png`: совместимая lighting/outline policy и убедительная damage escalation. Раздельные слои визуально больше не выдают монтаж в captures. Core остаётся чуть более контрастным и детальным, но это работает как focal hierarchy.
- `mars-highway-panorama.png`: сам по себе один из лучших assets проекта — цельные mesas, industrial skyline, глубина по value и понятные pixel clusters. Проблема не в панораме, а в её использовании: в captures нижнюю authored половину перекрывает новый ряд плоских треугольных гор/домов, а поверх качественных mesas повторяется второй более дешёвый landscape. В `combat` и `boss` procedural city/temple band закрывает ещё больше полезной детализации. Получается premium far background за procedural midground, а не единый мир.

## Delta относительно iteration 6

| Область | Iteration 7 | Статус изменения |
|---|---|---|
| World / material cohesion | Появилась действительно хорошая panorama, но procedural midground, props и road сохранены и теперь контрастируют с ней ещё сильнее | **PARTIAL improvement** |
| Panorama vs procedural midground | Authored mesas/city видны, но дублируются и перекрываются треугольными горами, гладкими домами и rail band | **Новый asset PASS, integration FAIL** |
| Road Ripper | Вместо vector-like placeholder — подробный 6-state raster war car с damage chain | **PASS, крупный gap закрыт** |
| Aerial roster | Вместо одинаковых простых UFO — два raster archetype, 8 atlas cells, в capture читаются 4 противника | **PASS по roster, PARTIAL по world integration** |
| Hero / boss consistency | Сильная планка iteration 6 сохранена; boss и core по-прежнему цельны, новые miniboss/aerials ближе к их tier | **PASS / held** |
| Select / title gap | Практически без визуального сдвига; flat portraits всё ещё следуют сразу за лучшим premium экраном | **FAIL / unchanged** |
| Impact debris / wobble | Capture chain визуально почти повторяет iteration 6: contact ясен, поздняя амплитуда мала, debris беден, wobble не доказан | **FAIL/PARTIAL / unchanged** |
| FX pixel language | Жёлтые bullets читаются, но bloom, дым, laser и purple orbs остаются smooth/high-res overlays относительно жёстких sprites | **PARTIAL / unchanged** |

## Сравнение с локальными refs

- **Thunder Force IV:** iteration 7 уже сопоставим по размеру и внутренней сложности главного boss. Референс всё ещё сильнее в общей материальной связности: boss, environment, shots, explosions и debris используют одну плотность пикселя и одну ramp logic.
- **Contra: Hard Corps:** здесь убедительные крупные машины и хорошая экранная угроза, но у Contra даже простой road/background не спорит с boss способом рисования. В iteration 7 виден переход между detailed raster и smooth procedural shapes.
- **Gunstar Heroes:** референс намного сильнее продаёт impact через крупную деформацию, огонь и множество частей, сохраняющих энергию после контакта. Текущий rider beat хорош до попадания и быстро сдувается после него.
- **Batman MD:** panorama iteration 7 богаче по дальнему плану, но асфальт Batman лучше ощущается материалом благодаря texture, light pools и устойчивой scale discipline. Здесь большая action lane слишком долго остаётся почти однотонной.

## 8-frame combat beat

| Beat | Report label / offset | Статус | Визуальное основание |
|---:|---|---|---|
| 0 | `muzzle`, 50 ms | **PASS** | Launch shape появляется на линии ствола; направление атаки понятно. Muzzle/contact мог бы быть жёстче и менее blurred, но причинность начинается корректно. |
| 1 | `early travel`, 270 ms | **PASS** | Два bullets отделились от героя и идут по чистой action lane. |
| 2 | `late travel`, 570 ms | **PASS** | Projectiles дошли до правой половины на высоте torso; цель и траектория не теряются. |
| 3 | `contact core`, 830 ms | **PASS** | Cyan-white contact сидит прямо на rider silhouette; score меняется `0 → 4`, reaction в отчёте достигает `1.75`. Это лучший ударный кадр цепочки. |
| 4 | `target squash`, 1050 ms | **PARTIAL** | Цель компактнее/ниже, появились синие элементы, score уже `8`; однако silhouette change мал для отдельного сильного squash beat. |
| 5 | `recoil/backbend`, 1330 ms | **PARTIAL** | Pose отгибается и приподнимается, но в игровом масштабе слишком близка к соседним кадрам; direction reversal не имеет крупного ясного arc. |
| 6 | `debris break`, 1650 ms | **FAIL** | Одна заметная синяя панель плюс несколько микрочастиц в тесной зоне — не полноценный break. Нет 5–8 fragments, двух размеров/материалов и широкого разлёта. |
| 7 | `recovery wobble`, 2130 ms | **PARTIAL** | Возврат к ride pose читается; `riderReaction=0.6` подтверждает состояние. Но один still не показывает три затухающие смены направления, а silhouette почти совпадает с обычным idle. |

`report.json` подтверждает длительность beat `2130 ms`, contact в `830 ms`, два shots на контакте и спад reaction `1.75 → 1.68 → 1.4 → 1.08 → 0.6`. То есть логическая огибающая существует. Визуально же последние 1.3 секунды несут слишком мало amplitude: числовой wobble не заменяет видимую смену silhouette, а разрушение не получает debris vocabulary уровня Gunstar/Thunder Force.

## Runtime facts после визуального чтения

- `ok: true`, `runtimeErrors: []`.
- Все 8 atlas entries — `ready`, каждая cell `256×192`: три hero sheets по 8 frames; rider, boss core/body и Road Ripper по 6; aerials — 8.
- `aerialCombat`: 4 enemies; кадр действительно показывает оба новых archetype.
- `combat/pause`: Road Ripper зарегистрирован как miniboss; это не декоративный still.
- `boss`: `3430/3500 HP`; после exchange — `2546/3500`, у героя падают health/armor. `victory.state = win`, score `30271`.

Эти факты подтверждают functional coverage, но premium verdict остаётся визуальным: `ready` atlas не устраняет разницу material language между atlas и сценой.

## Один крупнейший оставшийся gap

**Нет единого world/material/pixel contract между premium raster actors и окружающим их midground/road/FX.**

Это важнее отдельного select portrait или ещё одного enemy frame, потому что gap присутствует почти в каждом gameplay capture. Новая панорама, Road Ripper и aerial ships доказывают, что authored качество уже есть; экран теряет его на границах слоёв. Детальные sprites имеют мелкую кластерную фактуру, outline и направленный light, тогда как foreground/midground построены длинными гладкими полигонами, однотонными полосами и мягкими blooms. Именно это создаёт эффект «дорогие вырезки поверх прототипной трассы» и не даёт назвать результат high-end 16-bit AAA.

## Measurable next DoD — закрыть world/material gap

Следующая итерация проходит gate только если выполнены **все** пункты:

1. В `ride`, `vinnie-ride`, `aerial-combat`, `combat` и `boss` нет видимого procedural mountain/building silhouette длиннее **80 logical px** или выше **24 logical px**. Дублирующий треугольный landscape удалён; authored panorama остаётся единственным дальним Mars horizon.
2. Road, rail, lamps/signs и encounter-specific midground заменены raster tiles/sheets с одной outline policy, top-left light и **минимум 3 tonal steps** на metal/rock/asphalt. Никакого smooth scaling: все игровые слои компонуются через один integer nearest-neighbour grid.
3. Каждый из пяти контрольных gameplay captures содержит минимум **3 материально различимых authored planes** кроме неба: textured road, shaded rail/props, textured panorama/midground. На road lane — минимум **3 локальных material events** на экран (patch/crack/light pool/tyre mark/debris), не перекрывающих combat readability.
4. Bullets, laser, boss orbs, impact flash, smoke и explosion используют hard-edged sprite clusters: glow не выходит дальше **2 logical px** от solid core; нет гладких radial-gradient discs без пиксельного ядра и минимум двух жёстких ramp rings.
5. Blind A/B на пяти gameplay captures против iteration 7: минимум **4 из 5 независимых reviewers** не называют player/enemy/boss «наклеенным raster на vector/procedural background»; минимум **4 из 5** считают panorama, road и props частью того же art set, что Road Ripper.

Пока этот gate не закрыт, дальнейшая полировка HUD или ещё более детальный boss даст слабее отдачу, чем интеграция уже созданных сильных assets в один мир.
