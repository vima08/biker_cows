# NEXT STEPS — Gauntlet handoff

Проект оставлен в полностью запускаемом состоянии. Четыре крупные Gauntlet-волны завершены; дальнейший качественный скачок упёрся в объективный предел процедурных code-generated спрайтов, а не в незаконченный игровой цикл.

## Что уже работает

- полный маршрут `title → menu → hero select → 7:45 stage → miniboss → final boss → victory/defeat → restart`;
- Throttle, Modo и Vinnie с разными HP/armor/speed/fire rate, стартовым оружием и special;
- blaster, spread, laser, rockets, четыре уровня усиления, rapid fire;
- ground/air enemy waves, obstacles, pickups, combo, score и `localStorage` highscores;
- четыре визуальные зоны уровня и 5+ параллакс-планов;
- анимация байков, прыжки, отдача, damage states, пыль, дым, искры, обломки, screen shake;
- процедурный Web Audio rock soundtrack, boss mode и полный набор SFX;
- keyboard + Gamepad API, подсказки, пауза, победа, поражение и рестарт;
- debug scenes и Playwright Gauntlet automation;
- production build и чистая установка проверены;
- финальный smoke: `ok=true`, `runtimeErrors=[]`, реальное попадание в combat beat, miniboss/boss paths работают.
- boss-death transition, экран победы и restart проверены тем же реальным browser run.

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

Автоматизированная проверка:

```bash
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
npm run test:smoke
```

## Последние реальные кадры

- [Menu](public/workbench/captures/iteration-4/menu.png)
- [Ride](public/workbench/captures/iteration-4/ride.png)
- [Miniboss combat](public/workbench/captures/iteration-4/combat.png)
- [Boss exchange](public/workbench/captures/iteration-4/boss-exchange.png)
- [Victory](public/workbench/captures/iteration-4/victory.png)
- [Combat beat: muzzle](public/workbench/captures/iteration-4/combat-beat-0.png)
- [Combat beat: projectile](public/workbench/captures/iteration-4/combat-beat-1.png)
- [Combat beat: contact](public/workbench/captures/iteration-4/combat-beat-2.png)
- [Combat beat: recovery](public/workbench/captures/iteration-4/combat-beat-5.png)

Полная локальная страница прогресса: `http://localhost:5173/workbench/index.html` после `npm run dev`.

## Последнее заключение независимого критика

Полный текст: [.gauntlet/iteration-4/CRITIQUE.md](.gauntlet/iteration-4/CRITIQUE.md).

Вердикт: это сильный, цельный и технически рабочий fan prototype, но ещё не убедительный premium/high-end 16-bit slice уровня «AAA своей эпохи». Muzzle и полёт снаряда проходят строгую проверку; contact слаб, recoil-деформация не проходит, debris/recovery проходит частично. Runtime подтверждает реальное событие (`runtimeErrors=[]`, boss HP уменьшается, score/combo растут), но инженерный state не заменяет нарисованные экстремальные poses.

## Один крупнейший оставшийся недостаток

**Authored frame-by-frame sprite acting и impact deformation.** Текущие кодовые спрайты хорошо перемещаются и покрываются эффектами, но target contact/recoil/recovery shapes недостаточно отличаются в чёрном силуэте. Это также сохраняет разрыв между богатым title key art и более геометричным gameplay.

## Точная следующая итерация Gauntlet Loop

Сменить pipeline, не расширяя контент:

1. Зафиксировать внутренний sprite canvas 160×90 или 240×135 и общий nearest-neighbor scale.
2. Создать вручную/арт-направленно три небольших PNG sprite sheets: `Throttle+bike`, обычный `rider`, weak-point section финального босса. Не генерировать их runtime-полигонами.
3. Для Throttle нарисовать минимум 8 отдельных кадров: neutral, anticipation, muzzle/recoil, fork compression, maximum frame pitch, counter-torso, rebound, recovery.
4. Для rider нарисовать минимум 5 отдельных кадров: pre-hit, contact squash, recoil/back-bend, debris break, recovery wobble. Контуры каждого соседнего кадра должны различаться без glow/частиц.
5. Встроить sheets через atlas metadata; оставить текущую физику, scoring, environment, HUD и AudioSystem без изменений.
6. Переснять один фиксированный beat на 8 последовательных кадров: muzzle → early travel → late travel → contact core → target squash → recoil → debris → recovery.
7. Новый свежий critic сначала оценивает чёрные silhouettes без CRT/FX, затем финальный composite рядом с `Contra: Hard Corps`/`Gunstar Heroes`. Приёмка только если причинная цепочка восстанавливается без знания управления.

Это следующий pass с максимальной отдачей; новые уровни, UI и фоновые слои до него добавлять не следует.
