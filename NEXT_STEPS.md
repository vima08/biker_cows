# NEXT STEPS — Gauntlet iteration 24 / Wave D handoff

Дата handoff: 2026-08-21. Работа остановлена по внешнему лимиту в полностью собираемом и проходимом состоянии.

## Что уже работает

- Полный маршрут Stage 1 → Stage 2 → victory проходит автоматически; прямые boss-маршруты обоих уровней также завершаются победой.
- Solo и local co-op запускаются; friendly fire между игроками отсутствует.
- Все строки в `DEFECTS.md` закрыты проверенными `[x]`.
- Ride-цикл использует только согласованные позы; подвеска, колёса, одежда/волосы и hardpoints двигаются согласованно.
- Sustained fire не теряет оружие и сохраняет видимые muzzle/exhaust origins.
- Beat ’em up имеет четырёхфазную ходьбу героинь и обычных врагов, отдельную воздушную атаку, attack anticipation/contact/recovery, hit-stop, recoil, particles и каскадные hurt/down/recovery реакции.
- Обычный бой и Forge Overseer удерживаются в camera safe-zone. Wave D добавила body collision, target-specific hurtbox reach и post-contact separation.
- Stage 1 boss имеет три фазовых attack-pattern, крупный локальный impact и видимый recoil.
- Defeat стабилен: восемь последовательных terminal-кадров сохраняют `shake=0`, `flash=0`, `hitStop=0`.
- Runtime использует только локальные same-origin assets; console/page/request errors в проверенных маршрутах отсутствуют.
- Чистая установка через `npm ci --ignore-scripts --no-audit --no-fund` и production build проверены.

## Как запустить

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
node scripts/gauntlet-defeat-stability.mjs
node scripts/gauntlet-stage1-temporal-builder.mjs
node scripts/gauntlet-brawler-alpha-contact-builder.mjs
```

## Последние доказательства

- Наблюдаемая витрина: `public/workbench/index.html`
- Wave D alpha report: `.gauntlet/builder-brawler-alpha-contact/report.json`
- Wave D normal sequence: `.gauntlet/builder-brawler-alpha-contact/normal-held-contact-*.png`
- Wave D boss sequence: `.gauntlet/builder-brawler-alpha-contact/boss-held-contact-*.png`
- Stage 1 temporal sequence: `.gauntlet/builder-stage1-temporal/`
- Последний независимый аудит и 480 кадров: `.gauntlet/iteration-24/CRITIQUE_WAVE_C.md`, `.gauntlet/iteration-24/critic-wave-c/`
- Финальная Wave D integration: `.gauntlet/iteration-24/INTEGRATION_WAVE_D.md`

Финальные Wave D метрики:

- normal: max opaque overlap `12.17%`, longest overlap >35% `0 ms`, recoil `24.03 px`;
- Forge: max opaque overlap `39.19%` только в одном contact-кадре, longest overlap >35% `0 ms`, recoil `57.42 px`;
- по `20` подтверждённых damaging contacts для normal и boss;
- полный Stage 2: victory, `22` противника, `101` попадание, runtime errors `[]`.

## Последнее независимое заключение

Wave C critic: **8.4/10, AAA-era NO**. Статика, палитра, детализация, Stage 1 motion/impact, UI и общая цельность признаны уровнем дорогого retro-AAA. Единственный blocker — Stage 2 spatial hit resolution: до Wave D пассивный enemy approach удерживал opaque silhouette overlap >35% в течение `2267 ms`.

Wave D была создана строго после этого verdict и проходит его измеримый DoD, но новый независимый critic не был запущен из-за внешнего лимита.

## Один крупнейший оставшийся недостаток

**Нет свежего независимого Wave D verdict на реальной игре.** Автоматический alpha-mask contract показывает устранение последнего blocker, но строгий слепой visual critic ещё должен подтвердить, что новые body gates и расширенные hurtboxes визуально ощущаются естественным контактом, а не невидимым зазором/whiff.

## Точная следующая итерация Gauntlet Loop

1. Запустить production build на `127.0.0.1:4173`.
2. Создать нового critic со свежим контекстом, запретив чтение diff, этого файла и предыдущих отчётов до собственного verdict.
3. Снять menu/select, 12×100 ms Stage 1 ride, Stage 1 intense/boss, затем Stage 2 input-neutral approach, sustained-right combat и controlled Forge combat на 1440×900.
4. Набрать минимум 20 damaging contacts normal + 20 boss и измерить реальные opaque alpha masks: >35% overlap ≤200 ms в ≥95% контактов, safe-zone 5–95%, contact 20–80%, reaction separation ≥32 px или recoil ≥12 px, burst ≥32 px.
5. Повторить blind A/B рядом с Thunder Force IV, Gunstar Heroes, Contra: Hard Corps и Batman MD.
6. Если critic даёт AAA-era YES — зафиксировать Wave D как visual baseline. Если NO — исправлять только названный им один крупнейший разрыв, затем снова integration/smoothing и fresh-critic pass.
