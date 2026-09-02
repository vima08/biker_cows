# NEXT STEPS — Gauntlet iteration 27 handoff

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
