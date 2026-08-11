# NEXT STEPS — Gauntlet handoff after wave 12

Проект оставлен в полностью запускаемом состоянии. После перехода на art-directed PNG sheets завершены waves 5–12; последние три волны были посвящены только повторяющемуся normal-hit gesture и не расширяли контент.

## Что уже работает

- полный маршрут `title → select → 7:45 stage → miniboss → final boss → victory/defeat → restart`;
- Throttle, Modo и Vinnie с разными характеристиками, оружием и special;
- четыре оружия, четыре уровня усиления, rapid fire, pickups, combo, score и локальные рекорды;
- ground/air roster, obstacles, Road Ripper и большой Dreadnaught;
- 10 локальных art-directed атласов: герои, rider, 12-frame rider impact, authored material FX, aerial roster и боссы;
- authored Mars panorama, параллакс, 2px material grid, screen shake и hard-edged FX;
- procedural Web Audio rock soundtrack и SFX без внешних API;
- keyboard/Gamepad, пауза, победа, поражение и рестарт;
- Playwright Gauntlet harness, 12-frame production impact capture, blind A/B workbench;
- последний canonical smoke: `ok=true`, 10/10 atlas `ready`, `runtimeErrors=[]`, один projectile create/consume и одно score award;
- проверены real boss kill, victory, restart, Vinnie и aerial regression;
- wave-12 contract: contact/hitstop `5.69 px / 2°`, peak `40×18 px / 14°`, reverse anchors `0`, material steps `8.44–15.48 px`, smoke `12→44 px`, hold→recover `22.98 px / 6°`, grounded recover с scar `18×16`.

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

Smoke:

```bash
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
npm run test:smoke
```

После установки зависимостей игре не нужны сеть или внешние API.

## Последние реальные кадры

- [Menu](public/workbench/captures/iteration-12/menu.png)
- [Ride](public/workbench/captures/iteration-12/ride.png)
- [Aerial combat](public/workbench/captures/iteration-12/aerial-combat.png)
- [Boss](public/workbench/captures/iteration-12/boss.png)
- [Victory](public/workbench/captures/iteration-12/victory.png)
- [Contact](public/workbench/captures/iteration-12/impact-04-contact.png)
- [Hitstop](public/workbench/captures/iteration-12/impact-05-hitstop.png)
- [Recoil peak](public/workbench/captures/iteration-12/impact-07-recoil-2.png)
- [Debris](public/workbench/captures/iteration-12/impact-08-debris-1.png)
- [Damage hold](public/workbench/captures/iteration-12/impact-10-damage-hold.png)
- [Recover](public/workbench/captures/iteration-12/impact-11-recover.png)

Workbench iterations 0–12: `http://localhost:5173/workbench/index.html`.

## Последнее заключение независимого критика

Полный текст: [.gauntlet/iteration-12/CRITIQUE.md](.gauntlet/iteration-12/CRITIQUE.md).

Вердикт: **NO — AAA-of-its-era bar ещё не достигнут.** Полный продукт признан сильной коммерческой vertical slice; menu, roster, world, HUD и boss spectacle не выглядят учебным прототипом. Integration полностью проходит, material triad впервые названа `3/3`, но свежий blind viewer восстановил только `5/11` directed adjacent relations и не восстановил macro-order.

Wave 12 является честной регрессией perceptual sequencing относительно wave 11 (`5/11` против `7/11`), хотя её численная физика строже. Peak, удерживаемый одинаковым transform через recoil/debris, сделал соседние фазы менее различимыми; production smoke оказался слабее прежнего treatment.

## Один крупнейший оставшийся недостаток

**Normal-hit gesture всё ещё не является самодостаточной причинно-материальной хореографией: silhouette progression и material evolution не кодируют однозначное направление времени от contact через recoil/debris к recover.**

Registered contact, shooter continuity, material origins, scar и runtime lifecycle уже приняты. Больше не нужно добавлять FX или численные assertions; требуется новый authored visual storyboard поздних фаз.

## Точная следующая итерация — wave 13

1. Заморозить `pre/muzzle/travel`, зарегистрированную точку удара, projectile lifecycle, score, world, UI и все encounter paths.
2. Создать отдельный `rider-impact-tail-sheet.png` с шестью не взаимозаменяемыми силуэтами: `contact`, `hitstop`, `recoil`, `debris peak`, `damage hold`, `recover`. До composite проверить их как чёрные силуэты без HUD/FX.
3. `contact`: в основном целый target; `hitstop`: явно более сжатый fork/head/gun и только начало panel/sparks/soot; `recoil`: максимальная направленная масса; `debris peak`: тот же общий импульс, но silhouette ломают явно отделившиеся authored панели; `hold`: самый дальний и наклонённый повреждённый остаток; `recover`: колёса на дороге, меньший угол, scar сохраняется, дым распадается по ветру.
4. Не удерживать одинаковый whole-bike transform на `recoil/debris1/debris2`. Каждый соседний кадр должен иметь уникальный чёрный contour и направленный marker времени.
5. Сохранить `blue armor` и `hot sparks`; вернуть более видимый attached smoke из wave 11, но перерисовать его как расширяющийся/рассеивающийся tail, а не декоративный blob.
6. Сначала провести blind silhouette test только по шести поздним фазам. Acceptance: 5/5 ставят их в правильный порядок; лишь затем интегрировать в 12 production captures.
7. Финальный 12-frame gate без HUD/labels/filenames: минимум 4/5 свежих viewers получают ≥10/11 directed adjacency, все 5 дают `contact < recoil < debris < recover`, минимум 4/5 называют `blue painted armor`, `hot metal sparks`, `smoke/soot`.
8. Сохранить runtime guardrails: `runtimeErrors=[]`, 10/10 atlases, один projectile create/consume, одно score award, полный boss→victory→restart route.

Это следующий pipeline shift: не ещё одна настройка transforms, а authored silhouette storyboard. Select portraits, victory tableau и boss-exchange clutter остаются polish-задачами после прохождения этого gate.
