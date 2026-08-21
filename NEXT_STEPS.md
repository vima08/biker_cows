# NEXT_STEPS — Gauntlet handoff после Wave 23

Проект оставлен в полностью запускаемом состоянии. Wave 23 исправила directional animation второго уровня: у героинь появились отчётливо разные шаги с чередованием ведущей ноги, самостоятельные левые/правые боевые позы, воздушные атаки и исправленные удары Bruna. Враги больше не используют независимо нарисованные двусмысленные направления.

## Что работает

- сквозной маршрут `title → select → Stage 1 → Stage-1 boss → Stage 2: Furnace District → Forge Overseer → victory → restart`;
- Stage 1 и Stage 2 поддерживают solo и локальный co-op без friendly fire;
- Cassia, Bruna и Nova имеют 16-frame directional brawler atlases: right idle/walk/attacks/jump/air attack и отдельно нарисованный left-набор;
- в двухфазном цикле ходьбы каждой героини видны разные ведущие ноги, а не две вариации правого шага;
- Bruna не отражается для ключевого левого finisher: она разворачивается спиной к камере и бьёт в пол своей анатомически левой киберрукой;
- у Bruna сохранена одна левая киберрука и одна правая органическая рука;
- raider, bruiser и shocker при движении влево используют один авторитетный left-facing atlas; движение вправо использует только его точное пиксельное зеркало;
- полноценный Stage-2 run, boss clear, victory, restart и co-op/no-friendly-fire остаются рабочими;
- игра запускается без внешних API во время исполнения.

## Как запустить

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
npm run preview
```

Основные проверки:

```bash
npm run test:wave18
npm run test:brawler
node scripts/gauntlet-brawler-motion.mjs
node scripts/gauntlet-brawler-enemy-direction.mjs
```

Для browser harness нужен preview на `127.0.0.1:4173`; адрес можно изменить через `BCFV_URL`.

## Последние результаты

- полный Stage-2 regression на финальном enemy atlas: [.gauntlet/iteration-23/full-stage2-directional/report.json](.gauntlet/iteration-23/full-stage2-directional/report.json) — `ok=true`, `runtimeErrors=[]`, 22 defeated, Forge Overseer defeated, victory;
- directional hero motion: [.gauntlet/iteration-23/final-motion/report.json](.gauntlet/iteration-23/final-motion/report.json) — все три героини показали оба walk frames, три удара в обе стороны и отдельные воздушные атаки;
- enemy direction: [.gauntlet/iteration-23/enemy-direction-final/report.json](.gauntlet/iteration-23/enemy-direction-final/report.json) — `ok=true`, `runtimeErrors=[]`, все три класса показали left-facing walk rows `5/6`, `13/14`, `21/22`; разворот вправо использовал зеркальные строки;
- `npm run build`, `node --check` и `git diff --check` проходят.

Ключевые кадры:

- [Cassia — правая нога впереди](.gauntlet/iteration-23/final-motion/cassia-walk-right-02.png)
- [Cassia — левая нога впереди](.gauntlet/iteration-23/final-motion/cassia-walk-right-00.png)
- [Bruna — исправленный cyber hook](.gauntlet/iteration-23/final-motion/bruna-attack-cycle-01.png)
- [Bruna — back-facing left ground smash](.gauntlet/iteration-23/final-motion/bruna-attack-left-02.png)
- [Bruna — отдельная воздушная атака влево](.gauntlet/iteration-23/final-motion/bruna-air-left-00.png)
- [Gang — начало подхода влево](.gauntlet/iteration-23/enemy-direction-final/enemy-left-mixed-04.png)
- [Gang — несколько секунд спустя](.gauntlet/iteration-23/enemy-direction-final/enemy-left-mixed-12.png)

## Последний визуальный вывод

Запрошенный directional scope принят: в последовательностях ходьбы действительно чередуются ноги; Bruna имеет отдельную rear-view атаку, а не зеркальный удар неправильной рукой; airborne attacks существуют в обе стороны. Враги больше не пятятся: при подходе справа их лицо, грудь, оружие и ведущий шаг направлены к героине, а противоположный разворот является точным зеркалом того же дизайна.

## Один крупнейший оставшийся недостаток

Обычные враги теперь имеют убедительные idle/walk/attack направления, но реакция на попадание и поражение всё ещё в основном строится на вспышке, переносе, частицах и вращении целого спрайта. На фоне новых героинь это остаётся самым заметным анимационным упрощением Stage 2.

## Точная следующая итерация Gauntlet

Создать `venus-gang-reactions` 4×3: строки raider/bruiser/shocker, колонки `contact compression → recoil → airborne knockback → grounded defeat`. Подключить кадры к реальным collisions, убрать whole-sprite death rotation и снять для каждого класса шестикадровую последовательность `attack → contact → recoil → launch → landing → defeat`. Сохранить текущий directional atlas, физику, damage, camera, full clear, co-op/no-friendly-fire, Stage-1 gate и `runtimeErrors=[]`.
