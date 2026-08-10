# NEXT STEPS — Gauntlet handoff after wave 9

Проект оставлен в полностью запускаемом состоянии. После исходных четырёх волн завершены ещё пять Gauntlet-волн: pipeline действительно переведён с code-generated actors на art-directed PNG sprite sheets, затем последовательно выровнены весь cast, boss, world/roster, material contract и 12-кадровая impact-chain.

## Что уже работает

- полный маршрут `title → menu → hero select → 7:45 stage → miniboss → final boss → victory/defeat → restart`;
- Throttle, Modo и Vinnie с разными HP/armor/speed/fire rate, стартовым оружием и special;
- blaster, spread, laser, rockets, четыре уровня усиления, rapid fire;
- ground/air waves, obstacles, pickups, combo, score и `localStorage` highscores;
- девять локальных art-directed атласов: три героя, обычный rider, 12-frame rider impact, boss core/body, Road Ripper и aerial roster;
- authored Mars panorama, многослойный параллакс, 2px road/material grid и ощущение скорости;
- authored jump/recoil/damage poses, hitstop, screen shake, вспышки, дым, пыль, искры, обломки и взрывы;
- процедурный Web Audio rock soundtrack, boss mode и полный набор SFX;
- keyboard + Gamepad API, подсказки, пауза, победа, поражение и рестарт;
- безопасный atlas fallback, debug scenes, Playwright Gauntlet automation и progress workbench;
- production build проходит;
- последний полный smoke: `ok=true`, `runtimeErrors=[]`, 9/9 atlas `ready`, menu-to-victory-to-restart и Vinnie/aerial regression проходят;
- wave-9 impact contract подтверждён runtime: один projectile, одно score award, contact `84×56`, hitstop `80 ms`, target delta `26×12 px / 10°`, damage hold `550 ms`, `12 = 3+5+4` debris.

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

Игра не требует внешних API или сети после установки зависимостей.

## Последние реальные кадры

- [Menu](public/workbench/captures/iteration-9/menu.png)
- [Ride](public/workbench/captures/iteration-9/ride.png)
- [Aerial combat](public/workbench/captures/iteration-9/aerial-combat.png)
- [Boss](public/workbench/captures/iteration-9/boss.png)
- [Victory](public/workbench/captures/iteration-9/victory.png)
- [Impact pre](public/workbench/captures/iteration-9/impact-00-pre.png)
- [Impact contact](public/workbench/captures/iteration-9/impact-04-contact.png)
- [Impact recoil](public/workbench/captures/iteration-9/impact-07-recoil-2.png)
- [Impact debris](public/workbench/captures/iteration-9/impact-08-debris-1.png)
- [Impact damage hold](public/workbench/captures/iteration-9/impact-10-damage-hold.png)
- [Impact recover](public/workbench/captures/iteration-9/impact-11-recover.png)

Полная локальная история iterations 0–9: `http://localhost:5173/workbench/index.html` после `npm run dev`.

## Последнее заключение независимого критика

Полный текст: [.gauntlet/iteration-9/CRITIQUE.md](.gauntlet/iteration-9/CRITIQUE.md).

Вердикт: **NO — premium/high-end 16-bit AAA-of-its-era bar ещё не достигнут.** При этом critic прямо признаёт большой наблюдаемый pass относительно wave 8: target acting, contact scale, hitstop и recoil silhouette стали убедительными; wave 9 уже выглядит как сильная коммерческая vertical slice. Runtime-метрики добросовестно закрыты, но visual acceptance не заменена счётчиками.

## Один крупнейший оставшийся недостаток

**Impact chain ещё не является одной непрерывной, пространственно зарегистрированной и материально читаемой передачей силы от ствола в конкретную часть цели.** Contact-star немного отделён от вилки, shooter recoil временно возвращается после neutral travel, три material-класса debris выглядят слишком прямоугольными, а scar/smoke недостаточно жёстко привязаны к вырванной панели. Это один корневой gap, повторяющийся в основном игровом цикле.

## Точная следующая итерация Gauntlet Loop — wave 10

Контент, UI и окружение снова заморожены. Следующий проход меняет только spatial/material registration того же одиночного выстрела:

1. Сохранить те же 12 production captures, фиксированные камеру, seed и координаты.
2. Поместить центр white impact core внутрь leading-edge bbox цели или не дальше 6 px; перекрыть вилку/обтекатель минимум на 16×16 px, rear halo рисовать за целью, sparks — перед ней.
3. Сделать shooter recoil непрерывным: смещение плеч/оружия ≥6 px от muzzle до travel-25 и монотонный возврат к travel-75; не возвращать firing pose в contact/hitstop.
4. Сохранить contact `≥84×56`, hitstop `≥66 ms` и достигнутый target delta `≥24×10 px / 8°`, но держать одну точку удара между travel/contact/hitstop с отклонением Y ≤4 px.
5. Заменить прямоугольные fragments на три узнаваемых материала: 3+ контурные синие панели ≥10×7 px, 5+ tapered metal sparks 12–24 px и 4+ трёхтоновые smoke/dust puffs 8–18 px. Две панели проходят дугу ≥48 px и меняют ориентацию ≥45°.
6. Привязать origin крупных фрагментов к impact/missing-panel edge в пределах 12 px; emitter/contact/damage origin должны расходиться не более чем на 6 px.
7. Удерживать missing/bent panel ≥14×14 px и attached smoke с основанием ≤8 px от scar не менее 550 ms. В recover контур всё ещё изменён ≥5%, но остаточных частиц минимум вдвое меньше, чем в debris-2.
8. Recovery wobble должен менять не только X: rotation корпуса `+4° / −3° / +2°`, fork compression/rebound ≥6 px, head/gun counterphase ≥4 px и согласованную contact shadow.
9. Сохранить runtime guardrails: ноль ошибок, один projectile create/consume, одно score award, никаких showcase-only кадров.
10. Новый свежий critic проводит blind shuffled-sequence test. Acceptance: 4/5 наблюдателей правильно восстанавливают причинный порядок и называют три материала; 4/5 выбирают wave 10 по contact accuracy, mass и aftermath.

После этой волны select portraits, victory tableau и финальная калибровка boss-exchange останутся polish-задачами; сейчас они не являются причиной отклонения premium verdict.
