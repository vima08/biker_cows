# NEXT STEPS — Gauntlet handoff after wave 14

Проект оставлен в полностью запускаемом состоянии. Wave 13 исправила длительную стрельбу и экран выбора; wave 14 добавила authored release-переход и перенесла реальные точки рождения снарядов с линии головы на видимые пушки/носы байков.

## Что уже работает

- полный маршрут `title → select → 7:45 stage → miniboss → final boss → victory/defeat → restart`;
- три разных героя, четыре оружия, четыре уровня улучшения, rapid fire, pickups, combo, score и локальные рекорды;
- наземные и воздушные враги, препятствия, Road Ripper и Limburger Dreadnaught;
- 12 локальных art-directed атласов, authored Mars panorama, параллакс, hard-pixel FX, rock soundtrack и SFX;
- устойчивый четырёхкадровый grounded sustained-fire loop каждого героя: зажатая кнопка больше не переключает тело обратно в neutral ride между выстрелами;
- rapid Vinnie проверен 4 секунды / 54 выстрела без neutral-frame snap и с нулевым drift опоры/bbox;
- после отпускания огня воспроизводятся три authored release-позы `0 → 1 → 2` за 150–180 мс;
- для каждого героя размечены muzzle hardpoints authored/sustained/release кадров: muzzle flash и физический projectile используют одну точку на пушке/носе байка, в том числе в прыжке;
- небольшой общий ballistic lift возвращает снаряд к боевой линии без телепорта и debug-only обходов; реальный collision beat снова попадает в rider;
- character select использует три крупных авторских портрета с отдельными силуэтами, лицами, светом и selected hierarchy;
- keyboard/Gamepad, пауза, победа, поражение и рестарт;
- канонический smoke: `ok=true`, 12/12 atlases ready, `runtimeErrors=[]`, boss kill → victory → restart проходит.

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

После установки зависимостей игра не требует сети или внешних API.

## Последняя проверка

- canonical report: [.gauntlet/iteration-14/report.json](.gauntlet/iteration-14/report.json);
- integration verdict: [.gauntlet/iteration-14/INTEGRATION_VERDICT.md](.gauntlet/iteration-14/INTEGRATION_VERDICT.md);
- independent critique: [.gauntlet/iteration-14/CRITIQUE.md](.gauntlet/iteration-14/CRITIQUE.md);
- [all muzzle hardpoints](.gauntlet/iteration-14/integration-review/muzzle-all.png);
- [Throttle release contact sheet](.gauntlet/iteration-14/integration-review/release-throttle.png);
- [Modo release contact sheet](.gauntlet/iteration-14/integration-review/release-modo.png);
- [Vinnie rapid release contact sheet](.gauntlet/iteration-14/integration-review/release-vinnie-rapid.png);
- [rapid Vinnie sustained fire](.gauntlet/iteration-14/integration-review/sustain-vinnie-rapid.png);
- [new character select](.gauntlet/iteration-14/select.png);
- [boss exchange](.gauntlet/iteration-14/boss-exchange.png);
- [verified victory](.gauntlet/iteration-14/victory.png).

Workbench iterations 0–14: `http://localhost:5173/workbench/index.html`.

## Последнее заключение независимого критика

Все скорректированные пользователем критерии получили **PASS**:

- длительный зажатый огонь и rapid Vinnie — PASS;
- происхождение muzzle/projectile из пушки/носа, а не головы — PASS;
- трёхкадровый release bridge — PASS;
- новый character select — PASS;
- полный маршрут без визуальной регрессии — PASS.

Критик отдельно подтвердил: у sustained/jump отклонение origin от hardpoint равно `0 px`, у release — `1.720–2.291 px` при лимите `6 px`; release длится 150–180 мс и держит колёса/дорогу без дрейфа.

## Один крупнейший оставшийся недостаток

**Читаемость пикового боя с финальным боссом.** В `boss-exchange.png` пересекающиеся ракеты и диагонали дыма временами доминируют над центральной/правой частью playfield: зрелищность высокая, но силуэт boss/core и входящие опасные линии могут читаться медленнее, чем в лучших 16-битных шутерах.

## Точная следующая итерация — wave 15

1. Заморозить героев, select, sustained/release, muzzle hardpoints, cadence, damage, collision, enemy schedule и весь маршрут.
2. Добавить debug-сцену worst-case boss exchange: `Rockets Lv.4`, multiplier `x1.3`, непрерывный огонь и максимальная штатная атака босса.
3. Записать 10 секунд реального 960×540 gameplay с выборкой каждые 100 мс.
4. Ввести единый VFX budget для центральной области `x=240–720, y=120–460`: ограничить суммарную площадь friendly rocket smoke, сокращать lifetime/размер дальних клубов и объединять перекрывающиеся хвосты.
5. Разнести визуальные приоритеты: incoming telegraphs и boss/core поверх friendly smoke; ракета/impact остаются яркими, их хвосты быстрее уходят в тёмный низкоконтрастный material ramp.
6. Не удалять зрелищность и не снижать количество реальных снарядов — менять только presentation/layering/decay.
7. Acceptance по 100 кадрам: минимум 90% кадров сохраняют узнаваемые player и boss/core silhouettes; каждая входящая damage lane имеет незакрытый telegraph не менее 250 мс; friendly rocket/smoke закрывает не более 25% центральной области.
8. После builder pass запустить отдельный integration/smoothing pass, затем свежего critic, который смотрит полные 10 секунд в движении и сравнивает wave 14/15 без подсказки версии.
9. Сохранить `runtimeErrors=[]`, 12/12 ready, реальную победу и рестарт.

Не возвращаться к прежней узкой оптимизации single-hit/debris sequence, если новая пользовательская проверка не обнаружит там реальную игровую проблему.
