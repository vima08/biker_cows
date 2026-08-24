# NEXT STEPS — Gauntlet iteration 25 handoff

Дата handoff: 2026-08-24. Итерация остановлена по просьбе пользователя из-за лимита; проект оставлен в собираемом и проходимом состоянии.

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

## Один крупнейший оставшийся недостаток

**Открыт дефект просадки производительности shoot ’em up на минибоссе и боссе.** Он сохранён неотмеченным в `DEFECTS.md`: в этой итерации не было достаточно воспроизводимого performance-профиля, поэтому исправление не заявлено без доказательства.

## Точная следующая итерация Gauntlet Loop

1. На production build записать frame-time/FPS и число actors/projectiles/particles на обычной дороге, минибоссе и боссе при одинаковом viewport.
2. Изолировать update/draw/asset bottleneck, задать измеримый бюджет кадра и оптимизировать только подтверждённую горячую точку.
3. Повторить полный solo и co-op smoke, continue/defeat и boss victory без runtime errors.
4. После integration/smoothing привлечь нового независимого visual critic со свежим контекстом для menu/select/movement/intense combat/обоих боссов и слепого A/B с 16-битными референсами.
