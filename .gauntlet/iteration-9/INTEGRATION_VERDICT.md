# Wave 9 — integration / smoothing verdict

## Вердикт

**PASS как интеграционный релиз-кандидат.** Art-directed `riderImpact` встроен без заметного скачка масштаба, сломанного pivot или регрессии обычного столкновения. Двенадцатикадровая impact-chain визуально непрерывна, её контакт находится у передней (левой) кромки цели, а полный production smoke остаётся зелёным. Кодовых правок после проверки не потребовалось, поэтому повторный smoke намеренно не запускался.

Этот PASS относится к целостности wave 9, а не является независимым утверждением о достижении общего уровня «AAA своей эпохи». Экран выбора героя всё ещё художественно слабее gameplay-спрайтов, но он не входит в заявленный scope этой smoothing-волны.

## Что просмотрено в реальных кадрах

- Полный маршрут: `menu.png`, `select.png`, `ride.png`, `vinnie-ride.png`, `aerial-combat.png`, `combat.png`, `boss.png`, `boss-exchange.png`, `victory.png`.
- Предыдущая реальная collision-chain: `combat-beat-0.png` … `combat-beat-7.png`.
- Новая фиксированная chain: `impact-00-pre.png` … `impact-11-recover.png`.
- Recovery regression: `wobble-a.png`, `wobble-b.png`, `wobble-c.png`.

## Smoothing-проверка

- **Scale / palette:** новый rider сохраняет игровой масштаб и общую cobalt/steel/amber палитру roster. Более крупный технический draw box не даёт визуального «роста» цели, поскольку authored frames имеют иной внутренний padding.
- **Pivots:** переходы `pre → contact → recoil-1 → recoil-2 → damage-hold → recover` не прыгают между независимыми anchor points. Смещение и наклон нарастают в сторону отдачи и затем затухают.
- **Muzzle / travel:** `muzzle` не пуст и не задвоен; projectile различим на обеих стадиях travel. На contact/hitstop отдельная поза отдачи игрока сохраняется.
- **Contact:** трёхслойный burst расположен на визуальной leading edge райдера, не в пустом пространстве и не в центре корпуса. Белое ядро и cyan/orange оболочки читаются как локальный центр кадра.
- **Target reaction:** между исходным состоянием и `recoil-1` заметны не только translate, но и authored контрдвижение райдера/байка; `recoil-2` продолжает ту же дугу.
- **Material aftermath:** в `debris-1/2` одновременно читаются панели, металлические искры и smoke/dust; разные размеры, цвета и баллистика не смешиваются в один тип квадратов. `damage-hold` остаётся повреждённым минимум до контрольной отметки, затем приходит в `recover`.
- **Обычный gameplay hit:** реальная цепочка `combat-beat-0..7` использует `riderImpact` после физического попадания. До контакта существует ровно один friendly projectile; score меняется один раз, тайминг спавна/движения противника не сломан.
- **Boss flow:** `boss-exchange.png` следует реальному бою; затем `victory.state = win`, босс и враги удалены, а restart возвращает `state = playing`, score `0` и `elapsed = 0.2`.
- **Wobble:** контрольные положения `+8 / -6 / +4 px` различимы и используют тот же recovery renderer, не отдельный тестовый sprite path.

## Автоматические доказательства

Из `.gauntlet/iteration-9/report.json`:

- `ok: true`, `runtimeErrors: []`;
- 9 из 9 sprite atlases имеют `state: ready`; `riderImpact` содержит 12 кадров по `256×192`;
- impact stages: 12; `hitstopMs: 80`; `damageHoldMs: 550`;
- score transitions: `1`; fired projectiles: `1`;
- silhouette delta: `26 px X`, `12 px Y`, `10°`;
- contact bounding box: `84×56`, три слоя `#ff5a2c / #56eaff / #fffde3`;
- debris contract: 3 panels, 5 sparks, 4 smoke/dust, 2 long-arc panels;
- старый collision beat: `2120 ms`, contact `850 ms`, score `0 → 4`;
- Vinnie, aerial wave, miniboss, boss, victory и restart checkpoints присутствуют.

## Build

`npm run build` — **PASS** (`tsc -b && vite build`, 9 modules, production bundle создан).

## Изменения этой smoothing-проверки

Исходники не менялись: объективного integration-дефекта, оправдывающего новый production smoke, не обнаружено. Добавлен только этот verdict.
