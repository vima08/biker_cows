# Wave 15 — strict visual critique

## Verdict

**Wave15 scope: NO.**

**Premium whole-game verdict: NO.** Игра уже выглядит как сильный, цельный modern-16-bit vertical slice, но до premium-планки референсов ещё не дотягивает по боевой визуальной режиссуре и чистоте всех обязательных состояний.

`report.json` формально зелёный (`ok: true`, runtime errors отсутствуют, atlas/assets decoded), но это подтверждает работу сценария, а не визуальную корректность кадров.

## Проверка фокуса Wave15

1. **Enemy roster и road/foreground props — PASS.** Tank, mine и pod в `enemy-roster-0..2.png` теперь выглядят как полноценный authored pixel art, совпадают с общей фиолетово-синей техникой и не оставляют прежнего vector/style gap. Guardrail, lamps, sign, wreckage и обе группы камней в `world-authored-props-0..2.png` также выдержаны в той же палитре, контуре и плотности деталей. В сравнении с Thunder Force IV / Gunstar Heroes / Batman MD / Contra Hard Corps это убедительное современное развитие 16-bit языка, а не чужеродный UI-vector слой.

2. **Повязка Модо — FAIL.** В portrait/select она находится на viewer-left и читается правильно. Но в фактическом gameplay atlas и во всех проверенных кадрах `modo-base.png`, `sustain-modo-00..05.png`, `release-modo-00..23.png` чёрная масса сидит на viewer-right глазу, тогда как открытый красноватый глаз остаётся viewer-left. На увеличениях `modo-face-r*` / `modo-face-s*` тёмная горизонталь дополнительно образует bridge и периодически читается как sunglasses. Это не единичный transitional frame, а системная ошибка всего игрового набора поз.

3. **Vinnie adult male — PASS.** Новый selected portrait имеет взрослые мужские пропорции: широкие плечи, развитая грудь/шея, выраженная челюсть; персонаж больше не читается подростком или женским вариантом. Однако сам `select-vinnie.png` визуально сломан: верхний заголовок срезан краем кадра, центральная карточка Модо почти пустая, а служебный `SELECTED` конфликтует с верхом портрета. Это отдельный full-game regression, даже при успешном редизайне Винни.

4. **No regression full game — FAIL.** Menu, ride, authored enemies/props, aerial, miniboss, boss, hit chain и victory в целом сохранили качество и читаемость; runtime report чистый. Но некорректный Vinnie select layout и системно неверное лицо Модо не позволяют принять требование «без регрессий».

## Крупнейший следующий визуальный gap

**Единая authored combat-FX система для всех выстрелов, ракет и boss patterns.** Сейчас высокодетальные герои, враги и окружение соседствуют с доминирующими на экране плоскими cyan/orange прямоугольниками, бело-красными «брусками»-ракетами и геометрическими квадратными кольцами. Нужен один согласованный sprite-atlas язык с формой снаряда, emissive core, trail, muzzle/impact family и читаемым масштабом для каждого оружия и босса — это самый широкий оставшийся style gap и главный барьер к premium whole-game уровню.
