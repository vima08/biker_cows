# NEXT_STEPS — Gauntlet handoff после Wave 16

Проект оставлен в полностью запускаемом состоянии. Wave 15 выровняла художественный стиль, исправила Модо и экран выбора; Wave 16 добавила настоящий локальный кооператив без friendly fire.

## Что работает

- полный solo-маршрут: `title → select → level → miniboss → final boss → victory/defeat → restart`;
- локальный режим на двоих с независимым выбором героев, движением, прыжком, стрельбой, HP, armor, оружием, улучшениями и спецприёмами;
- P1: `WASD / Z / X / C`; P2: `Arrows / Numpad1 / Numpad2 / Numpad3`; поддерживаются два геймпада;
- дружественные снаряды имеют `ownerId` и не наносят урон игрокам;
- враги выбирают живую цель, pickups получает коснувшийся игрок; один выбитый байкер остаётся видимым wreck-маркером, игра заканчивается только после потери обоих;
- совместный финальный босс, командная победа/поражение, restart на двоих и командные локальные рекорды;
- 13/13 art-directed игровых атласов, мужской портрет Винни, стабильная повязка Модо, authored tank/mine/pod и authored roadside/foreground props;
- сохранены solo sustained-fire, release bridge, bike muzzle hardpoints, impact chain, пауза, звук и весь старый маршрут.

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

Smoke в двух терминалах:

```bash
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
npm run test:smoke
```

После установки зависимостей игре не нужны внешние API или сеть.

## Последняя проверка

- canonical report: [.gauntlet/iteration-16/report.json](.gauntlet/iteration-16/report.json) — `ok=true`, 13/13 атласов ready, `runtimeErrors=[]`;
- integration verdict: [.gauntlet/iteration-16/INTEGRATION_VERDICT.md](.gauntlet/iteration-16/INTEGRATION_VERDICT.md) — PASS;
- independent critique: [.gauntlet/iteration-16/CRITIQUE.md](.gauntlet/iteration-16/CRITIQUE.md) — requested co-op scope PASS, whole-game premium NO;
- [co-op select](.gauntlet/iteration-16/coop-select.png);
- [co-op sustained combat](.gauntlet/iteration-16/coop-combat.png);
- [one rider down](.gauntlet/iteration-16/coop-one-down.png);
- [co-op boss exchange](.gauntlet/iteration-16/coop-boss-exchange.png);
- [team victory](.gauntlet/iteration-16/coop-victory.png).

Wave 15 corrective scope также принят свежим критиком: [.gauntlet/iteration-15/CRITIQUE_15B.md](.gauntlet/iteration-15/CRITIQUE_15B.md).

Workbench: `http://localhost:5173/workbench/index.html`.

## Последнее заключение независимого критика

Локальный co-op принят: экран подключения и выбора понятен, два персонажа и их HUD различимы, владельцы снарядов и muzzle origins независимы, friendly fire отсутствует, адресный вражеский урон/one-down/both-down/boss victory/restart подтверждены, solo-регрессии нет.

Whole-game premium verdict остаётся **NO**.

## Один крупнейший оставшийся недостаток

**Читаемость принадлежности игрока и его огня во время непрерывного плотного co-op боя.** Когда байки перекрываются, а оба игрока используют ракеты максимального уровня, одинаковые красно-белые снаряды и длинные дымовые ленты сливаются. Игроку приходится смотреть в HUD, чтобы мгновенно понять, где он и какой поток огня принадлежит ему.

## Точная следующая Gauntlet-итерация — Wave 17

1. Заморозить механику, cadence, damage, collision, уровень, solo и все принятые Wave 15/16 состояния.
2. Добавить мягкое formation-разведение активных игроков: не телепортировать и не запрещать обгон, но при почти полном наложении давать читаемую разницу по `y`/контактной тени и краткий цветной ground marker P1/P2.
3. Пронести цвет владельца в общие виды оружия: небольшой yellow/cyan ember у muzzle/trail/impact, не меняя основной цвет оружия и hitbox. Для ракет ограничить слияние соседних smoke-ribbons через stagger/decay, не уменьшая количество реальных снарядов.
4. Добавить production debug-сцену 10 секунд crowded co-op: оба игрока с Rockets Lv.4, пересечения траекторий, воздушные враги и финальный босс.
5. Снимать не меньше 20 последовательных кадров плюс контрольные `overlap`, `cross`, `separated`, `boss`; проверять, что P1/P2 и их текущий поток огня правильно определяются без HUD минимум в 18/20 кадров.
6. Сохранить `runtimeErrors=[]`, 13/13 ready, no-friendly-fire, targeted damage, one-down/both-down, совместную победу/restart и полный solo smoke.
7. После builder-pass вызвать отдельного integration/smoothing агента, затем свежего critic, который смотрит реальную 10-секундную последовательность и сравнивает её с Gunstar Heroes / Contra: Hard Corps по co-op action readability.

Не возвращаться к узкой оптимизации одиночного impact-chain, пока живая пользовательская проверка не выявит там новый игровой дефект.
