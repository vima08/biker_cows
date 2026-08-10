# Gauntlet Visual Critique — iteration 5

## Verdict

**Premium / high-end 16-bit «AAA эпохи»: НЕТ.** Текущий уровень — сильный polished prototype с несколькими почти production-quality raster-ассетами, но не цельная high-end 16-bit игра. Главный экран обещает заметно более высокий класс, чем реально выдерживают select, основная трасса и boss encounter.

Runtime-проверка успешна: `report.json` имеет `ok: true`, `runtimeErrors: []`; все три atlas готовы, по 256×192 на frame. Это подтверждает стабильность сборки, но не меняет визуальный verdict.

## Blind-ish first read

- `menu.png` выглядит как дорогая обложка/ключевой арт: сильная диагональ дороги, насыщенный дальний план, уверенная типографическая иерархия, хороший focal contrast.
- `select.png` сразу падает на один-два visual tiers: портреты плоские, почти геометрические, с малым числом material cues и без той же плотности света/тени. Карточки читаются, но выглядят как placeholder UI рядом с title art.
- В `ride.png` Modo и дорожные враги выглядят плоскими vector-cutouts. В `combat.png` Throttle и rider уже значительно лучше, но потому ещё заметнее, что они «наклеены» на процедурную трассу.
- `boss.png` / `boss-exchange.png`: детальный raster core хорош сам по себе, но вставлен поверх огромного бело-серого chassis с другой техникой рисования, outline language и плотностью пикселя. Получается не единый босс, а atlas-фрагмент поверх схемы танка.
- `victory.png` функционально чист, однако это стандартная modal-panel концовка; она не возвращает богатство и кинематографичность title screen.

## Sprite sheets как чистые силуэты/кадры

- `throttle-sheet.png`: **сильный**. Мотоцикл, уши, шарф и линия спины дают узнаваемый силуэт; crouch, gun recoil, wheelie/backbend и recovery действительно нарисованы как разные poses, а не как scale/rotate одного кадра.
- `rider-sheet.png`: **сильный**. Idle/fire, squash, backbend и damaged poses читаются без контекста. Недостаток — «debris» представлен практически одной синей пластиной, поэтому sheet сам не обещает полноценного break event.
- `boss-core-sheet.png`: **лучший набор**. Рост свечения, crack, разлёт панелей, электричество и дым дают ясную authored deformation chain.
- На игровом экране Throttle и enemy rider читаются уверенно и не теряются. Но их rich raster density не совпадает с плоскими горами, фонарями, знаками, UFO и chassis. Это проблема не самих sheets, а их покрытия и интеграции.

## Сравнение с конкретными Mega Drive screenshots

| Референс | Что делает high-end кадр | Где iteration 5 проигрывает |
|---|---|---|
| Thunder Force IV | Огромный босс, вода, скалы, выстрелы и взрывы говорят на одном pixel/material языке; attack field мгновенно показывает угрозу и причинность | Core детален, chassis и среда — плоская геометрия; projectile stream читается, но попадание не становится большим экранным событием |
| Gunstar Heroes | Сегментированный boss имеет отчётливые суставы, authored break poses и крупные огненные контакты; фон не выпадает из общего shading grammar | Хорошие reaction poses rider есть, но contact мал, а break сводится к одной пластине; boss shell не поддерживает качество core |
| Contra: Hard Corps | Гигантский highway boss встроен в перспективу дороги; у каждого сегмента есть объём, outline и palette ramps, при этом маленький игрок остаётся читаем | Трасса оставляет большую пустую полосу, а boss воспринимается как белая пиктограмма с приклеенным механизмом |
| Batman MD | Даже сравнительно спокойная driving-сцена держится на dithered asphalt, фасадах, световых пятнах и одной приглушённой material palette | Повторяющиеся лампы/знаки и polygon mountains дают движение, но почти не дают material texture или ощущения места |

Локальные A/B refs: `.gauntlet/iteration-5/refs/thunder-force-iv.jpg`, `gunstar-heroes.jpg`, `contra-hard-corps.jpg`, `batman-md.jpg`.

## Критерии

- **Silhouette readability:** PASS для Throttle, rider и boss core; PARTIAL для Modo/Vinnie portraits и полного boss chassis.
- **Authored deformation:** PASS внутри трёх sheets; PARTIAL в реальном encounter из-за слабого contact/debris staging.
- **Sprite scale / pixel density:** размер Throttle и rider читаем, обновлённый rider не даёт scale pop. Но общий кадр смешивает rich 1× raster detail с крупными гладкими vector-плоскостями; это разрушает иллюзию единого 16-bit renderer.
- **Palette / material cohesion:** основные cyan/magenta/yellow accents согласованы. Material cohesion — FAIL: металл sprites, asphalt, горы, HUD и boss shell имеют разные способы shading и разную cluster density.
- **Parallax / speed:** PASS. В live preview дальнее небо, mountains/rail и дорожные маркеры движутся разными скоростями; поток врагов и непрерывный огонь создают темп. При этом повторяемость простых элементов не превращает скорость в богатую сценографию уровня референсов.
- **Impact causality:** PARTIAL. Направление атаки и реакция цели понятны, но самый важный контакт мал и spatially ambiguous; break event слишком слаб.
- **Boss integration:** FAIL. Core — authored object, chassis — отдельная плоская иллюстрация; единая масса, lighting и damage propagation не складываются.
- **HUD hierarchy:** PASS. Hero/HP слева, objective сверху по центру, weapon справа и boss bar снизу читаются быстро и не перекрывают action lane.
- **Title-to-game tier gap:** FAIL. `menu.png` — самый богатый кадр; `select.png`, Modo gameplay и boss shell не выдерживают его обещания.

## 8-frame impact beat

| Frame | Заявленная фаза | Статус | Визуальное основание |
|---:|---|---|---|
| 0 | muzzle | **PASS** | Один яркий launch shape привязан к направлению ствола; старт атаки читается мгновенно |
| 1 | early travel | **PASS** | Два снаряда формируют ясную горизонтальную траекторию от игрока |
| 2 | late travel | **PASS** | Снаряды дошли до правой трети и однозначно нацелены на rider |
| 3 | contact core | **PARTIAL** | Score/reaction уже изменились, на цели есть бело-синий glint, но главный жёлтый projectile ещё визуально отделён от силуэта; нет единой точки «projectile → burst → body» |
| 4 | target squash | **PARTIAL** | Crouched/hunched authored frame виден, но почти совпадает с frame 3 и не даёт отдельного silhouette-wide compression beat |
| 5 | recoil/backbend | **PASS** | Сильный новый силуэт: torso и gun откинуты назад, направление импульса очевидно |
| 6 | debris break | **FAIL** | Отлетает одна маленькая синяя пластина; нет burst volume, вторичных fragments или заметного разрушения массы |
| 7 | recovery wobble | **PARTIAL** | Возврат к idle и небольшие jitter accents есть, но затухающее колебание слишком тонко и в still почти неотличимо от обычного pose |

`report.json` подтверждает последовательность 20 → 220 → 550 → 830 → 1000 → 1170 → 1500 → 2130 ms и `riderReaction`, но runtime label не заменяет визуальное доказательство. Премиальный beat должен читаться без отчёта.

## Один крупнейший оставшийся gap

**Недостаточное покрытие и интеграция единого authored pixel-art языка: сильные raster sheets существуют как острова внутри заметно более дешёвого vector/procedural мира.**

Это один корневой gap, который одновременно создаёт title-to-game tier drop, ломает boss integration, делает Modo/Vinnie второсортными относительно Throttle и не позволяет эффектам попадания выглядеть частью материала сцены. Добавление ещё HUD-полировки или частиц его не закроет.

## Builder-ready следующая итерация

Сделать один **gameplay cohesion pass**, не меняя уже удачные HUD hierarchy, parallax timing и базовые atlas poses:

1. Зафиксировать общий native pixel grid для gameplay (рекомендуется 320×180 с integer 4× upscale в 1280×720 и nearest-neighbor).
2. Перевести в этот язык весь видимый gameplay set: road/rail, mountains/city, lamps/signs/UFO, miniboss, полный boss chassis и игровые образы Modo/Vinnie. У всех — одна outline policy, один top-left light direction, 3–4-step ramps на материал и те же cluster sizes, что у нормализованных Throttle/rider/core.
3. Пересобрать boss не как chassis + overlay: core должен быть конструктивно посажен в корпус, получать общий occlusion/shadow rim, а crack/debris из core-sheet должен распространяться на соседние панели корпуса.
4. Усилить только недоказанные impact phases: единый contact burst точно на silhouette edge/core, отдельный squash silhouette, 5–8 fragments разного размера и видимый decaying wobble. Не удлинять текущий 2.13 s beat.

### Measurable DoD

- На всех семи контрольных сценах (`menu`, `select`, `ride`, `combat`, `boss`, `boss-exchange`, `victory`) **100% персонажей, врагов и boss body** находятся на одном integer pixel grid; нет гладких vector diagonals/1–3 px screen lines рядом с 4× pixel clusters.
- Throttle, Modo и Vinnie имеют одинаковое production coverage: минимум drive/idle, fire, squash, recoil/backbend, damage/debris, recovery; ни один выбранный rider не откатывается к flat procedural silhouette.
- Boss chassis выдерживает grayscale silhouette test и palette test без core: минимум 3 читаемых material planes и 3-step shading; после вставки core его outline/свет/масштаб неотличимы по технике от корпуса.
- В `boss-exchange` contact burst центрирован в пределах **±8 screen px** от точки касания; flash имеет минимум **24×24 screen px**, а следующий frame показывает локальную деформацию корпуса, не только overlay glow.
- `debris break`: **5–8 fragments** в области не меньше **96×64 screen px**, минимум 2 размера и 2 траектории; `recovery wobble`: минимум **3 смены направления** с амплитудой 4–8 screen px и затуханием за 300–450 ms.
- Сохранить текущие runtime facts: `ok: true`, `runtimeErrors: []`, все atlas `ready`, contact остаётся в диапазоне **800–860 ms**, полный beat — **≤2130 ms**.
- Blind A/B на gameplay-only кадрах рядом с четырьмя refs: минимум **3 из 4 независимых оценок** не отмечают ни одного элемента как «приклеенный raster на vector background» и считают player, world и boss одним art tier.

До выполнения этого DoD называть результат premium/high-end 16-bit «AAA эпохи» нельзя.
