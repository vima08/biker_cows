# NEXT_STEPS — Gauntlet handoff после Wave 17

Проект оставлен в полностью запускаемом состоянии. Wave 17 перевела игру на самостоятельный мир **Biker Cows from Venus: Neon Stampede**.

## Что работает

- полный маршрут: `title → select → level → miniboss → final boss → victory/defeat → restart`;
- Cassia, Bruna и Nova имеют собственные 8-frame ride/action, 4-frame sustained-fire, 3-frame release и select-портреты;
- левая киберрука Bruna сохраняет сторону, серебряные сегменты и cyan-joint во всех базовых, sustained, release и portrait кадрах;
- выхлоп Cassia, Bruna и Nova выходит из видимых труб байков во всех authored, sustained, release и jump-позах; runtime измеряет общий hardpoint рендера и эмиттера;
- новая стартовая Venus-панорама и новый gameplay horizon без прежней планетарной символики;
- локальный кооператив с независимыми героями, уроном, оружием, pickups и спецприёмами; friendly fire отключён;
- 13/13 atlas’ов, полный наземный/воздушный roster, мини-босс, финальный босс, музыка, SFX, пауза и локальные рекорды;
- старые публичные имена, UI-тексты, пути ассетов и документация удалены.

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

## Последняя проверка

- canonical report: [.gauntlet/iteration-17/report.json](.gauntlet/iteration-17/report.json) — `ok=true`, 13/13 ready, `runtimeErrors=[]`;
- [start screen](.gauntlet/iteration-17/menu.png);
- [character select](.gauntlet/iteration-17/select.png);
- [Nova select](.gauntlet/iteration-17/select-nova.png);
- [Bruna base](.gauntlet/iteration-17/bruna-base.png);
- [Bruna sustained fire](.gauntlet/iteration-17/sustain-bruna-03.png);
- [Bruna release](.gauntlet/iteration-17/release-bruna-10.png);
- [Bruna exhaust hardpoint](.gauntlet/iteration-17/exhaust-review/bruna-sustained.png);
- [exhaust hardpoint report](.gauntlet/iteration-17/exhaust-review/report.json) — `ok=true`, ошибки отсутствуют;
- [boss exchange](.gauntlet/iteration-17/boss-exchange.png);
- [co-op select](.gauntlet/iteration-17/coop-select.png);
- [co-op boss](.gauntlet/iteration-17/coop-boss-exchange.png).

Полный production run занял 115.3 с, прошёл solo и co-op; Cassia 6.58, Bruna 3.74, Nova 8.15, rapid Nova 13.78 выстр./с. Release-мосты прошли за 150–180 мс; muzzle origins остаются на стволах, а exhaust origins — на выходах труб байков.

## Текущий визуальный verdict

Новая тройка цельно читается в меню, select и gameplay; Bruna сохраняет киберруку во времени. Вертикальный срез выглядит как сильная оригинальная 16-битная браузерная игра. Whole-game premium verdict пока не зафиксирован независимым слепым критиком после смены IP.

## Один крупнейший оставшийся недостаток

**Читаемость максимального ракетного огня в финальном бою.** При Rockets Lv.4 длинные одинаковые smoke-ribbons перекрывают входящие телеграфы и weak point босса сильнее, чем новые герои или окружение.

## Точная следующая итерация

1. Заморозить персонажей, их анимации, muzzle hardpoints, cadence, damage и collision.
2. Сделать 10-секундную production boss-sequence с Rockets Lv.4 и двумя игроками.
3. Ограничить непрозрачность/длину перекрывающихся friendly smoke-ribbons, не уменьшая число реальных снарядов.
4. Добавить компактный owner-colour ember P1/P2 у muzzle, trail и impact.
5. Снять минимум 20 последовательных кадров; weak point и incoming telegraph должны быть различимы не менее чем в 18/20.
6. Сохранить `runtimeErrors=[]`, 13/13 ready, no-friendly-fire и полный solo/co-op маршрут.
