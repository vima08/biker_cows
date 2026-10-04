# NEXT STEPS — iteration 33 handoff / 17 сентября 2026

Production остаётся полностью запускаемым на `public/assets/brawler/*-brawler-walk-v8.png`, но дефект повторяющейся ведущей ноги **не закрыт**. Независимый critic просмотрел live preview 960×540 и шесть 17-кадровых серий и поставил FAIL: маркеры левой ноги меняются, однако порядок перекрытия бедра/колена/ботинка и читаемая ведущая стопа остаются одинаковыми. Полный отзыв: `.gauntlet/iteration-32/critic/CRITIQUE.md`.

Начата следующая depth-swap итерация Cassia. Два удачных цельных контакта сохранены в `.gauntlet/iteration-33/raw/cassia-right-far-leg-depth.png` и `cassia-left-far-leg-depth.png`: ближняя нога перекрывает корень дальней ноги у таза даже тогда, когда остаётся сзади; дальняя нога заметно темнее, колени и размеры ботинок имеют разную глубину. Эти кадры ещё не подключены к production, потому что цикл без двух разных passing-фаз был бы очередным частичным исправлением.

Выполнение остановлено внешним лимитом imagegen: HTTP 429 `usage_limit_reached`, на момент остановки сброс ожидался примерно через 3 ч 17 мин. Игра, production build, текущий motion suite и полный brawler regression остаются PASS; это проверка стабильности, не художественное принятие v8.

Точная следующая итерация Gauntlet Loop:

1. Сгенерировать четыре разные passing-позы Cassia: по две на направление, отдельно near-leg swing и far-leg swing, используя два сохранённых depth-swap контакта.
2. Собрать временный walk-v9 только для Cassia: right contact → left-near passing → left contact → right-far passing; аналогично для левого rear-three-quarter ряда.
3. Снять 17 реальных кадров в каждом направлении и дать новому независимому critic слепую пару контактов при 960×540. Критерий: critic без меток фаз правильно указывает, какая анатомическая нога впереди.
4. Только после PASS перенести тот же near/far occlusion contract на Bruna и Nova; у Bruna фиксировать киберруку на анатомически левом плече.
5. Добавить side-on settle cel перед возвратом к hero/idle atlas, затем повторить полный gait и brawler regression.

## Архив iteration 32 — стабильный runtime, визуальный FAIL

Walk-v8 технически проходит четыре фазы, масштаб, консоль и network gate. Однако critic подтвердил, что это data-level pass, а не убедительная анатомическая смена ног. Не использовать старые `contactPairs` метрики как доказательство исправления: они измеряют разницу пикселей, а не identity/depth swap.

## Архив iteration 31 — отклонённая гипотеза освещения

Walk-v4 был возвращён пользователем: оба контактных кадра сохраняли одинаково освещённую ближнюю/переднюю ногу, поэтому движение снова читалось как постоянный шаг правой ногой. Production переключён на walk-v5. В первом контакте анатомически правая нога ведёт, а ближняя левая остаётся сзади; во втором левая выходит вперёд. При движении влево отношение обращено корректно для самостоятельно нарисованного заднего трёхчетвертного ракурса.

Исправление не режет фигуры и не меняет геометрию v4: `scripts/build-gait-v5.ps1` задаёт устойчивую near/far светлоту ниже таза. На реальном масштабе это делает анатомическую смену ног читаемой, сохраняя цельные torso/hip/leg кадры. Production: `public/assets/brawler/*-brawler-walk-v5.png`.

Регрессия `.gauntlet/iteration-31/canonical/` PASS: по 17 реальных кадров на героиню и направление, четыре фазы, перемещение >180 px, runtime errors 0, внешних HTTP(S) запросов 0. Добавлен тест самих пикселей: разность яркости контактов обязана менять сторону. Измеренные минимальные запасы: Bruna 4.35, Cassia 15.26, Nova 23.59; простой повтор правой ноги больше не пройдёт тест только благодаря имени `left-contact`.

Следующая визуальная проверка walk-v5: пользовательская оценка в движении и независимый critic; при необходимости усиливать не темноту, а отдельно нарисованный shoulder/hip counter-rotation. Общий крупнейший открытый дефект по последней независимой критике — неподвижная крупная разметка Road Rash.

## Архив iteration 30

Walk-v3 заменены production-атласами walk-v4. Все восемь кадров каждой героини теперь нарисованы как цельные фигуры: торс, таз, бёдра и ноги имеют непрерывную анатомию, палитру, контур и плотность деталей. Для движения влево сохранён самостоятельно нарисованный задний трёхчетвертной ракурс; Бруна не зеркалится и её анатомически левая киберрука не меняет сторону.

Первый цельный 4×2 проход генератора исправил стыки, но повторил контакт ног. Поэтому финальный v4 собирается из цельной базы и отдельно нарисованных цельных противоположных контактов — без разрезания персонажей на части. Сборщик: `scripts/build-gait-v4.ps1`; raw masters: `.gauntlet/iteration-30/raw/`; production: `public/assets/brawler/*-brawler-walk-v4.png`. v2/v3 сохранены для сравнения и отката.

Браузерная проверка `.gauntlet/iteration-30/canonical/index.html`: по 17 последовательных кадров каждой героини вправо и влево, все четыре фазы наблюдаются, перемещение >180 px; runtime errors 0, внешних HTTP(S) запросов 0. Production build PASS. Полный brawler regression PASS: 22 противника и Forge Overseer побеждены, friendly fire false (`.gauntlet/iteration-30/brawler/`). Новый независимый critic в этой волне не запускался; визуальный вывод основан на фактических сериях кадров, а не на атласах отдельно.

Промпты wave29 возвращены в единый `ASSET_PROMPTS.md`, отдельный `ASSET_PROMPTS_WAVE29.md` удалён. Туда же записаны шесть точных промптов wave30 и описание отбракованного первого результата.

Крупнейший общий открытый дефект по последней независимой критике остаётся прежним: неподвижная крупная разметка Road Rash. Следующая Gauntlet-волна — прокрутка ближнего полотна от visualDistance с двухсекундной серией движения, затем независимая критика и Road/campaign regression. Для walk-v4 следующий художественный контроль — плавность плечевого counter-swing при переходах 3→4→1 и соответствие масштаба атакующим кадрам в реальном бою.

## Архив iteration 29

Рабочий проект: `C:\Users\PC\Desktop\gitProjects\biker_cows`. Запуск: `npm install`, `npm run dev`; production: `npm run build`, `npm run preview`. База URL `/biker_cows/`.

Обновлены walk-v3 атласы всех трёх героинь: четыре фазы с противоположными контактами ног, отдельный ряд движения влево. Верх тела Бруны не отражается. Генерация целых персонажей снова давала повторяющуюся ведущую ногу; приняты отдельные нарисованные ноги и собраны противоположные фазы, а не переименованы старые кадры. Исходники: `.gauntlet/iteration-29/raw/`, сборщик `scripts/build-gait-v3.ps1`.

Вторичная анимация шарфов Cassia/Nova теперь работает при удержании огня, отпускании и прыжке независимо от неподвижного корпуса. У Bruna сохранены волосы и края жилета, шарф ей не добавлен. Исправлены статичная пауза, прямой URL минибосса, его HUD и цвета характеристик невыбранных героинь.

Доказательства: `.gauntlet/iteration-29/canonical/index.html` воспроизводит серии реальных кадров: по 17 кадров ходьбы в каждом направлении каждой героини и по 13 кадров непрерывной стрельбы. Там же report.json, select, miniboss, pause. `npm run test:brawler-gait` запускает актуальную проверку (BCFV_URL задаёт адрес preview). Старый тест v2 оставлен как архив, он больше не подключён к npm-команде.

В этой волне проведён ведущим агентом просмотр последовательностей и интеграционная проверка; нового независимого заключения нет. Последняя независимая оценка остаётся iteration 28: desktop demo 7/10, полный релиз 5/10, AAA-era NO. Не считать её оценкой новых кадров.

Крупнейший общий открытый дефект по последней критике: неподвижная крупная разметка Road Rash. Следующая Gauntlet-волна: отделить ближнее полотно, прокрутить его от visualDistance, снять не менее двух секунд движения, затем независимая критика и Road/campaign regression. Для новых walk-v3 отдельно оценить переходы плеч/таза и читаемость ближней ноги в масштабе 1×: замена контактов не означает завершённую художественную полировку. Road из кампании не удалять.

Проверки wave29: production build PASS; актуальный gait/scarf/pause/miniboss suite PASS, runtime errors 0, внешних HTTP(S) запросов 0. Полный brawler regression PASS: 22 противника, босс побеждён, friendly fire отключён. Отчёт `.gauntlet/iteration-29/brawler/`. Это не свидетельство полного прохождения обоих shooter-актов.

## Архив iteration 28

Дополнение проверки wave29: campaign contract PASS (`.gauntlet/iteration-29/campaign/report.json`), runtime errors 0. Road и Road King пройдены обычными контролами; прочие границы актов ускорены completeAct и проверяют маршрутизацию, не полное боевое прохождение.

Работа завершена по просьбе пользователя при приближении к лимиту. Проект собирается и запускается. Road Rash возвращён в кампанию по явному решению пользователя; прежний запрет ниже относится только к архиву.

Текущий маршрут: rider Act 1 / Magma Mauler → Sulfur Run / Road King → Furnace District / Forge Overseer → rider Act 3 / Sulfur Dreadnought → финал. В Road управляет P1; P2 возвращается в brawler, что явно обозначено в UI и README. Прямые debug URL остаются самостоятельными сценами.

Запуск: `npm ci`, `npm run dev` и напечатанный Vite URL с базой `/biker_cows/`. Production: `npm run build`, `npm run preview`. Проверенный текущий preview: `http://127.0.0.1:4287/biker_cows/`.

Проверено: production build и чистая offline-установка PASS; campaign contract PASS; полный Road обычными контролами — 43 с, 72 HP, King 8→0; полный brawler — 22 врага и Forge, Bruna 144/170 HP; standalone Road regression PASS; runtime/external errors отсутствуют. Остальные границы campaign ускорены debug completeAct — это не доказательство полного честного прохождения обоих shooter-актов. Повторный 12-секундный shooter benchmark: 59.91/59.89 FPS, p95 16.7/16.8 ms. Первый короткий замер не прошёл p95, оба отчёта сохранены.

Последний независимый critic: **desktop demo 7/10, полный релиз 5/10, AAA-era NO**. Просмотрены реальные последовательные PNG всех секций и 16-bit референсы; субъективный звук не прослушан. Полный отзыв: `.gauntlet/iteration-28/critic/CRITIQUE.md`. В `DEFECTS.md` внесены 12 актуальных открытых пунктов с доказательствами и критериями; тряска при переходе закрыта, отдельная проблема паузы открыта.

Последние кадры и проверки: `.gauntlet/iteration-28/readiness/index.html` (проигрывает серии), `readiness-miniboss/` (правильный минибосс), `campaign-contract/`, `road-regression/`, `brawler/`, `boss-performance-recheck/`. Лучшие кадры: `public/workbench/captures/iteration-28/`.

**Один крупнейший остаток:** крупные швы и оранжевая разметка Road Rash остаются визуально неподвижными. **Следующая Gauntlet-итерация:** отделить ближнее полотно от панорамы, прокручивать от visualDistance, записать ≥2 с движения на постоянной скорости, дать новому критику сравнить с Road Rash Genesis; после integration/smoothing повторить Road и campaign regression. Не удалять Road из кампании на основании AAA-оценки: пользователь уже разрешил его возврат. Остальные приоритеты — в DEFECTS.md.

---

# Архив — Gauntlet iteration 27 handoff

Дата handoff: 2026-09-02. Проект оставлен в собираемом и полностью играбельном состоянии. Road Rash намеренно остаётся только standalone test scene и не входит в основную кампанию.

## Что уже работает

- Authored panorama и `?art=vector` используют один горизонт/vanishing point `y≈323`; машины, бензовозы, байкеры и roadside props проецируются от него и больше не возникают из воздуха.
- Rider projection scale уменьшен до player `112×140`, rival `88×114`, Road King `108×134` против car `104` и tanker `132`; ближний бой дополнительно разводит экранные силуэты.
- Cassia, Bruna и Nova имеют отдельные rear-view силуэты, одежду и байки из `public/assets/road-rash/road-rash-heroines-atlas-v1.png`; harness фиксирует три разные render signatures.
- Road King самостоятельно сближается, телеграфирует удар и снимает ровно 14 HP. Босс честно побеждается восемью обычными вводами; финиш и victory закрыты до нулевого HP и завершения crash-анимации.
- Полностью работают `?art=vector` и `window.__BCFV_DEBUG__.setArtEnabled(false|true)`, включая отключение actor atlas без reload.
- Production campaign остаётся: rider Act 1 → brawler → rider Act 3 → final boss. Road Rash изолирован и имеет собственный continue.
- Последняя проверка: production build PASS; `test:road-rash` PASS; `test:campaign` PASS; `test:debug-scenes` PASS; 60 FPS, p95 16.8 ms, `runtimeErrors=[]`, `externalRequests=[]`.

## Как запустить

```powershell
npm install
npm run dev
```

Открыть `http://localhost:5173/?scene=road-rash&hero=cassia` (также `bruna` или `nova`). Для боя: `?scene=road-rash-combat`; для босса: `?scene=road-rash-boss`. Полная проверка:

```powershell
npm run build
npm run test:road-rash
npm run test:campaign
npm run test:debug-scenes
```

## Последние скриншоты и отчёты

- Полный run и JSON: `.gauntlet/iteration-27/road-rash/`
- Workbench: `public/workbench/index.html`, кадры `public/workbench/captures/iteration-27/`
- Movement: `.gauntlet/iteration-27/road-rash/02-road-rash-movement.png`
- Combat motion: `.gauntlet/iteration-27/road-rash/03-road-rash-combat-0.png` … `03-road-rash-combat-7.png`
- King attack: `.gauntlet/iteration-27/road-rash/04b-road-king-attack-0.png` … `04b-road-king-attack-2.png`
- Boss defeat/victory: `05-road-rash-boss-defeat.png`, `06-road-rash-victory.png`
- Heroine comparison: `07-road-rash-hero-cassia.png`, `07-road-rash-hero-bruna.png`, `07-road-rash-hero-nova.png`
- Vector proof: `.gauntlet/debug-scenes/vector-roadRash.png`, `vector-roadRashBoss.png`

## Последнее заключение независимого критика

Финальный свежий critic: **7.3/10, AAA-era NO**. Он подтвердил три отчётливо разные героини, механический урон Road King `100→86`, честные восемь попаданий и корректный finish gate. Согласование горизонта и уменьшение масштаба заметно улучшили глубину и читаемость, но motion road plane и attack choreography всё ещё уступают Road Rash Genesis и лучшим 16-bit action games.

## Один крупнейший оставшийся недостаток

Полотно дороги воспринимается слишком статичной иллюстрацией на высокой скорости: движущиеся рефлекторы и проекционные швы помогают, но крупная authored texture и центральная оранжевая секция визуально закреплены в кадре.

## Точная следующая итерация Gauntlet Loop

Разделить authored road foreground на 3–4 бесшовных perspective strips/texture bands и прокручивать их по `visualDistance`, сохраняя горизонт `y=323`. Затем записать 2–3 секунды одинакового 200+ KM/H движения в authored и vector режимах, провести слепое A/B рядом с Road Rash Genesis и усилить отдельными atlas/effect фазами Road King `anticipation → swing → contact → player recoil`. После integration/smoothing повторить `test:road-rash`, `test:campaign`, `test:debug-scenes` и новый независимый visual recheck. Не возвращать Road Rash в кампанию без явного решения пользователя.

---

# Архив — Gauntlet iteration 26 handoff

Дата handoff: 2026-09-01. Работа остановлена по просьбе пользователя при приближении к лимиту; проект оставлен в собираемом и полностью играбельном состоянии.

## Что уже работает в iteration 26

- Полная production-кампания проходит: Act 1 / Magma Mauler → Furnace District brawler → Act 3 / Sulfur Dreadnought → campaign win. `Sulfur Run` намеренно исключён из campaign registry и доступен только как самостоятельная экспериментальная сцена.
- Standalone Road Rash использует authored open-road 16-bit панораму, rider atlas v3 и отдельный traffic/roadside object atlas, псевдо-3D дорогу, боковые удары, направленный recoil, полноценное поражение Road King, victory/defeat и изолированный continue checkpoint.
- Terminal-состояния очищают attack/contact/recoil/flash; на victory игрок возвращается в neutral, оставшиеся боевые райдеры удаляются.
- Debug-сцены `?scene=brawler-walk`, `?scene=brawler-jump`, `?scene=brawler-air-attack` работают для `hero=cassia|bruna|nova`.
- Runtime vector mode: `?art=vector` и `window.__BCFV_DEBUG__.setArtEnabled(false|true)`; автоматический debug-scenes тест проверяет оба способа.
- `test:road-rash`, `test:campaign`, `test:debug-scenes` и production build прошли. Последний Road Rash прогон: 58.5 FPS, p95 16.8 ms, `runtimeErrors=[]`, `externalRequests=[]`.

## Как запустить

```powershell
npm install
npm run dev
```

Открыть адрес Vite из терминала. Production и основные контракты:

```powershell
npm run build
npm run test:road-rash
npm run test:campaign
npm run test:debug-scenes
```

## Последние скриншоты и отчёты

- Workbench: `public/workbench/index.html`
- Полная Road Rash-серия: `.gauntlet/iteration-26/road-rash/`
- Лучшие кадры: `public/workbench/captures/iteration-26/road-rash-movement.png`, `road-rash-combat.png`, `road-rash-boss.png`, `road-rash-boss-defeat.png`, `road-rash-victory.png`
- Road Rash report: `.gauntlet/iteration-26/road-rash/report.json`
- Campaign report: `.gauntlet/iteration-26/campaign-contract/report.json`
- Debug scenes report/captures: `.gauntlet/debug-scenes/`

## Последнее заключение независимого критика

Последняя независимая оценка: **8.8/10**, **AAA 16-bit era: YES**. Критик подтвердил цельные authored actors/traffic/roadside props, читаемую восьмифазную контактную серию, полноценный boss defeat и чистый neutral victory. Road Rash при этом остаётся standalone experimental-сценой и не возвращён в production campaign.

Один крупнейший оставшийся недостаток: дальний фон остаётся статичным, а дорога — почти идеально прямой с неизменным vanishing point, поэтому на длинной дистанции глубина и вариативность движения уступают лучшим 16-bit дорожным играм.

## Точная следующая итерация Gauntlet Loop

Добавить два-три дальних параллакс-слоя и очень мягкое изменение точки схода/кривизны трассы без переработки authored foreground. Затем записать длинный speed capture, проверить отсутствие рассинхронизации roadside atlas с дорогой и повторить слепое сравнение рядом с Road Rash Genesis, `test:road-rash`, `test:campaign` и `test:debug-scenes`.

---

# Архив: Gauntlet iteration 25 handoff

Дата handoff: 2026-08-24.

## Что уже работает

- Полный маршрут Stage 1 → Stage 2 → victory и прямые boss-маршруты проходят; solo/local co-op и отсутствие friendly fire сохранены.
- Добавлены 3 попытки, десятисекундный continue, возврат к checkpoint текущего уровня и окончательный game over после третьего поражения или тайм-аута.
- Линия езды Stage 1 поднята и ограничена видимой дорогой; обычные выстрелы идут горизонтально и поражают нижних наземных врагов.
- Debug-сцены: `?scene=brawler-walk`, `?scene=brawler-jump`, `?scene=brawler-air-attack`; героиня выбирается `&hero=cassia|bruna|nova`.
- Векторный режим: `?art=vector` или без перезагрузки `window.__BCFV_DEBUG__.setArtEnabled(false|true)`.
- Колёса всех героинь вращаются при sustained fire независимо от стабильной позы корпуса и hardpoints.
- В beat ’em up убран искусственный вертикальный hop, добавлен foot-lock по четырём фазам шага, atlas-враги заземлены относительно world-space тени.
- Знаки и фонари Stage 1 рисуются за передним слоем ограды; Stage 2 attempt badge встроен в HUD P1 и не перекрывает центральную панель.
- Runtime использует локальные same-origin assets; проверенные прогоны завершились без console/page/runtime errors.

## Как запустить

Репозиторий сейчас находится в `C:\Users\PC\Desktop\gitProjects\biker_cows`.

```powershell
npm install
npm run dev
```

Открыть адрес Vite из терминала (обычно `http://localhost:5173`). Production-проверка:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Основные проверки:

```powershell
npm run test:smoke
npm run test:brawler
npm run test:continue
node scripts/gauntlet-ride-lane-builder.mjs
node scripts/gauntlet-debug-scenes.mjs
node scripts/gauntlet-sustained-wheels-builder.mjs
node scripts/gauntlet-brawler-footing.mjs
```

## Последние доказательства

- Наблюдаемая витрина: `public/workbench/index.html`
- Continue: `.gauntlet/iteration-25/builder-continue/`
- Ride bounds и горизонтальный огонь: `.gauntlet/builder-ride-lane/`
- Debug/vector scenes: `.gauntlet/debug-scenes/`
- Sustained wheels: `.gauntlet/builder-sustained-wheels/`
- Walk/shadow footing: `.gauntlet/iteration-25/builder-brawler-footing/report.json`
- Финальная integration: `.gauntlet/iteration-25/integration/INTEGRATION.md`

Подтверждённые результаты iteration 25:

- continue contract — PASS; defeat stability — `8/8` terminal-кадров;
- полный shoot ’em up smoke — victory, boss/co-op routes PASS, runtime errors `[]`;
- полный brawler footing-прогон — victory, `22` противника, `101` попадание, runtime errors `[]`;
- walk footing — все героини в обе стороны прошли фазы `0/1/2/3`, 84 последовательных кадра;
- enemy alpha-ground residual: raider ≤`2.19 px`, bruiser `0.04 px`, shocker `0.22 px`;
- sustained fire — все 8 wheel-angle состояний у каждой героини, projectile origin delta `0 px`.

После последнего integration-микрофикса выбора lead attacker выполнен финальный полный brawler-прогон: victory, `22` противника, `97` подтверждённых попаданий, boss clear, runtime errors `[]`.

## Последнее независимое заключение

Последний независимый critic остаётся из Wave C: **8.4/10, AAA-era NO**; его blocker по длительному silhouette overlap был затем устранён Wave D и подтверждён измеримым alpha-mask contract. В iteration 25 новый независимый critic не запускался: пользователь явно попросил завершить работу из-за лимита. Эта итерация проверена builder-контрактами, полными маршрутами и отдельным integration/smoothing-прогоном.

## Последняя закрытая горячая точка

**Дефект просадки производительности shoot ’em up на минибоссе и боссе закрыт.** Production benchmark сохранён в `.gauntlet/boss-performance-production-final/report.json`: обе сцены держат около `60 FPS`, `p95 16.7–16.8 ms`, финальная boss-сцена больше не замедляет симуляцию до `0.35×` и работает на `0.975×`. Мини-босс усилен с `900` до `1400 HP`.

## Точная следующая итерация Gauntlet Loop

1. Ручным тестом проверить субъективную длительность боя с мини-боссом на `1400 HP` для всех трёх героинь.
2. При следующем изменении эффектов повторить `npm run test:boss-performance` на production build.
3. Повторить полный solo и co-op smoke, continue/defeat и boss victory без runtime errors.
4. После integration/smoothing привлечь нового независимого visual critic со свежим контекстом для menu/select/movement/intense combat/обоих боссов и слепого A/B с 16-битными референсами.
