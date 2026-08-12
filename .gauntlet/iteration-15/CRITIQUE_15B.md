# Wave 15b — независимый visual critique

## Verdict

**Scope: PASS.**

**Whole-game premium: NO.** Узкая правка решает оба заявленных blocker’а, но один заметный runtime-артефакт всё ещё мешает считать весь кадр финально отполированным.

## A — Vinnie select

**PASS.** В `select-vinnie.png` имя, subtitle, selected badge, portrait и stat/weapon-зоны собраны в ясную иерархию и не конфликтуют между собой. Кадрирование сопоставимо с Throttle/Modo, голова и плечи хорошо заполняют верх карты. Обновлённый Vinnie однозначно читается как взрослый мужчина: более массивные шея/плечи, выраженная челюсть, уверенная улыбка и зрелые пропорции лица. Выбранная карта остаётся разборчивой на яркой magenta-подложке. Сравнение с `select-throttle.png`, `select-modo.png` и исходным `hero-portraits-sheet.png` подтверждает цельность трио.

## B — right-facing gameplay Modo

**PASS.** В `modo-15b-runtime-base.png`, всех `modo-15b-runtime-sustain-*.png`, всех `modo-15b-runtime-release-*.png` и contact sheet:

- viewer-left/rear ухо заметно увеличено и посажено дальше назад;
- viewer-right/front открытый глаз отделён от повязки и расположен ближе к носу;
- чёрная форма читается как односторонняя eye patch, не как sunglasses;
- решение сохраняется между base, sustain и release без смены стороны или потери глаза.

Сверка с исходным `before-modo-sheet.png` и текущим `public/assets/sprites/modo-sheet.png` подтверждает, что исправление присутствует именно в рабочем атласе, а не только в отдельном proof-кадре.

## Enemy / world

**PASS сохраняется.** `enemy-roster-live.png` по-прежнему показывает разборчивые силуэты и роли наземных/воздушных противников. `ride-props-a/b/c.png` и `late-section-props.png` сохраняют связную Mars-highway глубину, authored roadside props и достаточное разделение gameplay-плана от фона. Новые hero/select изменения эту часть не ухудшили.

## Ровно один следующий gap

Убрать непрозрачные коричнево-бежевые прямоугольные блоки у стыка таза/сиденья Modo, особенно очевидные в `modo-15b-runtime-contact.png` и также заметные в обычных base/sustain кадрах. Сейчас они выглядят как случайные маски/заплатки поверх спрайта и являются главным препятствием для whole-game premium verdict.
