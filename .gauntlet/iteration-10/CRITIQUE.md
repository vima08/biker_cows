# Wave 10 — свежий независимый visual critique

## Итоговый вердикт

**NO — строгая premium/high-end 16-bit AAA-of-its-era планка ещё не достигнута.**

Wave 10 — сильный коммерческий vertical slice с дорогими gameplay-спрайтами, убедительным boss scale и теперь уже действительно материальным одиночным попаданием. Относительно wave 9 исправлены почти все буквальные симптомы прежнего DoD: выстрел больше не вызывает реакцию до контакта, impact внедрён в передний hardpoint, shooter не возвращается к firing pose после нейтрали, цветные блоки заменены изогнутыми панелями/искрой/дымом, а missing-panel scar остаётся на цели в hold/recover. В прямом blind A/B новая версия выигрывает все три пары.

Но premium-bar требует, чтобы двенадцать неподписанных кадров складывались в один неизбежный физический жест. Этого пока нет: после travel я ошибочно переставил contact/hitstop и почти весь recoil/debris tail. Значит, отдельные дорогие кадры уже есть, а безошибочная причинная хореография между ними ещё нет. Production/integration pass из отчёта это не опровергает: он подтверждает корректную реализацию, но не perceptual ordering.

## Blind phase — зафиксированный результат до reveal

Я открыл `frame-A.png` … `frame-L.png` строго по алфавиту, затем шесть `set-amber-*` / `set-cyan-*`, не читая report, source, NEXT, старые critiques и не открывая другие iteration-10 captures.

### Восстановленный мной causal order

**`D → I → B → G → E → K → F → J → C → H → L → A`**

Видимое прочтение было таким: `D` — anticipation/прицеливание; `I` — muzzle; `B`, `G` — две позиции projectile travel; `E`, `K` — две удерживаемые фазы контакта; `F`, `J` — выброс материала и первый отход цели; `C`, `H` — damaged hold/recover с дымящимся передним узлом; `L`, `A` — поздний inertial wobble.

После reveal выяснилась авторская последовательность **`D → I → B → G → K → E → L → A → J → F → C → H`**: `I/B/G/K/E/L/A/J/F/C/H` соответствуют production `impact-01` … `impact-11`, а `D` служит предвыстрельной фазой. Я правильно восстановил anticipation, muzzle и обе точки travel, но поменял местами contact/hitstop и вынес обе recoil-фазы в конец. Это не ретроспективная правка blind result, а главный диагностический факт.

### Материалы debris / aftermath, различимые без подписей

- синие окрашенные изогнутые бронепанели с тёмной металлической изнанкой и светлым кантом;
- бело-жёлто-оранжевые металлические искры/горячая стружка;
- фиолетовый дым/сажевые клубы;
- в cyan-варианте — крупные плоские коричневые и синие прямоугольные блоки и белые полосы, читающиеся как абстрактный procedural debris, а не как части именно этого байка.

### Blind A/B choices

- **Contact — amber.** Белое горячее ядро, оранжевое кольцо и холодный синий rear rim внедрены в переднюю вилку/обтекатель. Cyan — плоская comic-star, висящая перед целью.
- **Mass — amber.** Реакция проходит через весь силуэт: подъём переднего колеса, наклон байка, отставание корпуса/головы и изменение опоры. Cyan добавляет блоки у hardpoint, но они не усиливают вес и выглядят наложением.
- **Aftermath — amber.** Потерянная синяя секция и дым остаются на переднем узле цели. Cyan оставляет большое облако прямоугольников посреди дороги, пространственно оторванное от повреждения.

Итог blind pair vote: **amber 3:0**.

## Visual verdict по обязательным gates

### Единый registered contact — PASS

`impact-03` доводит tip снаряда по той же горизонтальной lane, а `impact-04` ставит яркое ядро непосредственно на leading edge цели. Burst частично уходит за силуэт холодным halo и частично лежит перед ним горячим core/sparks, поэтому энергия выглядит вошедшей в вилку, а не наклейкой в воздухе. Это однозначный premium-level delta против wave 9.

### Shooter continuity — PASS

В `impact-01` Throttle получает ясную firing pose; в `02/03` отдача монотонно затухает; в `04/05` firing pose не появляется повторно. В blind-порядке `I → B → G` был восстановлен без ошибок. Старый temporal reset wave 9 устранён.

### Material readability — PASS

`impact-material-chroma.png` показывает единый authored набор: layered impact, curved blue armor, tapered hot sparks, трёхтонный дым и attached burnt fairing. В production `impact-08/09` панели сохраняют цвет, контур, блик и кривизну исходной детали; искры имеют отдельную температуру и баллистику; дым мягче и тяжелее. Эти три класса называются без report. Файла `impact-material-sheet.png` среди iteration-10 captures нет; визуально проверен фактически предоставленный `impact-material-chroma.png`, тогда как report указывает runtime asset `/assets/sprites/impact-material-sheet.png`.

### Attached scar — PASS

В `impact-10/11` исчезновение передней синей панели меняет контур цели, а дым сидит на том же повреждённом узле при смене позы. Aftermath больше не превращается в независимое облако в центре экрана. Даже без labels `C/H` были распознаны как hold/recover и поставлены рядом.

### Recover / wobble — TECHNICAL PASS, PREMIUM SEQUENCING NOT YET PASS

`wobble-a/b/c` уже не выглядят простым whole-sprite translate: меняются наклон переднего узла, контрфаза райдера/оружия и контактная тень. По сравнению с wave 9 масса стала лучше. Однако в полной blind-цепи `L/A` были прочитаны как поздний wobble, а не как ранний recoil: сами крайние позы сильны, но соседние переходы не дают достаточно однозначных направленных признаков.

### Full-product coherence — STRONG SLICE, BELOW UNIFORM PREMIUM FINISH

`menu.png` остаётся самым дорогим экраном: перспектива дороги, крепость, тройка байков и neon hierarchy дают убедительный cartridge-cover promise. `vinnie-ride.png`, `aerial-combat.png`, `combat.png` и особенно `boss.png` подтверждают roster breadth и крупный 16-bit spectacle. HUD стабилен между героями и encounter types.

`select.png` с геометрическими фронтальными портретами заметно проще великолепных gameplay sprites; `boss-exchange.png` перегружен параллельными ракетными следами и абстрактными квадратами; `victory.png` остаётся чистым, но общим overlay. Это реальные polish-задачи, однако не отдельный главный blocker: повторяющийся combat gesture важнее единичных shell screens, а его нынешний perceptual gap уже достаточен для NO.

## Сравнение с локальными референсами

- **Gunstar Heroes** мгновенно показывает причинный распад: крупные части всё ещё узнаются как бывшее тело объекта, а огонь связывает их с источником разрушения. Wave 10 теперь сопоставима по материальности fragments, но ещё уступает по неизбежности временного порядка.
- **Thunder Force IV** сохраняет главный impact story даже в экстремальном шуме. Wave 10 выигрывает чистотой registered contact, но `boss-exchange` пока менее оркестрирован по траекториям и negative space.
- **Contra Hard Corps** задаёт bar огромной, активно деформирующейся угрозы. `boss.png` этот gate по масштабу и доминированию проходит.
- **Batman MD** значительно проще по детализации, зато направление «ствол → снаряд → цель» абсолютно бесспорно. Wave 10 уже столь же ясна до contact; неоднозначность начинается только в aftermath timing.

## Delta относительно iteration 9

Delta крупная и видна без runtime facts.

- В wave 9 `impact-03` уже показывал откинутую цель до того, как projectile достиг её; в wave 10 цель остаётся нейтральной до зарегистрированного контакта.
- Wave-9 contact был detached лососевой starburst; wave 10 использует пиксельно смоделированный white/orange/blue burst, перекрывающий target silhouette.
- В wave 9 hitstop возвращал стрелка к firing pose; wave 10 сохраняет монотонный возврат.
- Wave-9 `08–11` выбрасывали коричневые/cyan прямоугольники в середину дороги; wave 10 заменяет их синими деталями самой цели, горячими искрами и attached smoke/scar.
- Standalone wobble получил fork/head counterphase и более осмысленную тень вместо преимущественного X-shift.

Таким образом, wave-9 DoD закрыт по registered contact, shooter continuity, трём визуальным материалам, происхождению debris, attached scar и multi-part wobble. Оставшаяся проблема обнаружена уже более строгим blind sequencing gate.

## Ровно один крупнейший gap

**Aftermath ещё не образует безошибочно направленную причинную хореографию от contact/hitstop через recoil и отрыв материала к damaged recover.**

Это один gap. Его наблюдаемый симптом — не «мало FX» и не «плохие assets», а невозможность правильно упорядочить уже качественные неподписанные кадры: `K/E` визуально допускают обратный порядок, `L/A` выглядят убедительным поздним затухающим wobble, а `J/F` — более ранним выбросом. Особенно мешает то, что в `impact-04` цель сильнее сжата вперёд, в `impact-05` снова выглядит вертикальнее, затем резко переходит в чистый recoil, а первые явно отделившиеся материалы появляются только после обеих recoil-поз.

## Измеримый DoD следующей волны

Один фиксированный production-выстрел с неизменными seed, камерой и координатами должен снова дать 12 кадров `pre → muzzle → travel-25 → travel-75 → contact → hitstop → recoil-1 → recoil-2 → debris-1 → debris-2 → damage-hold → recover` при 960×540 и пройти единый **causal-order gate**:

1. От `contact` до `recoil-2` проекция hardpoint, переднего колеса, головы и оружия на авторский recoil-вектор не меняет знак; обратный локальный скачок любого из этих anchors между соседними кадрами — не более **3 px**, а суммарный пик остаётся не меньше нынешних **34 px / 16 px / 14°**.
2. `contact` и `hitstop` сохраняют один и тот же target posture family: разница угла корпуса между ними не более **4°**, смещение hardpoint не более **8 px**; `hitstop` не может визуально распрямлять цель перед дальнейшим recoil.
3. Минимум одна узнаваемая синяя панель и две tapered sparks начинают отделяться в `hitstop` или `recoil-1` в радиусе **12 px** от registered hit. К `debris-1/2` их дуга продолжается без teleport более чем на **16 px** между соседними samples.
4. Missing/bent contour площадью не менее **14×14 px** читается уже в `recoil-1`, остаётся на том же moving node через `recover`, а основание attached smoke отклоняется от scar не более чем на **8 px**.
5. В новом blind-тесте без HUD, labels, filenames и знания версии минимум **4 из 5** свежих зрителей восстанавливают не менее **10 из 11** правильных соседних отношений всей последовательности; все 5 ставят contact перед recoil, recoil перед debris peak и debris peak перед recover; минимум **4 из 5** называют три материала: blue armor, hot metal sparks, smoke/soot.
6. Runtime guardrail сохраняется: `runtimeErrors=[]`, один projectile создаётся/поглощается один раз, score меняется один раз, hit/damage/emitter origins расходятся максимум на **6 px**, все кадры снимаются из production runtime.

До прохождения этого causal-order gate честный вердикт остаётся **NO**. После него select portraits, victory tableau и калибровка clutter в boss exchange будут remaining polish, а не основанием удерживать premium verdict.

## Report / integration audit после visual verdict

Только после фиксации visual verdict прочитаны `report.json` и `INTEGRATION_VERDICT.md`. Report сообщает `ok=true`, готовность 10/10 atlases, 12 ordered impact captures, отсутствие runtime errors, реальный boss kill, victory и restart. Integration verdict отдельно и корректно формулирует **INTEGRATION PASS**, не подменяя независимый AAA verdict; он подтверждает `20×18 px` overlap core с hardpoint, peak recoil `-34/-16 px, -14°`, 12-piece debris population, attached scar/smoke и трёхфазный wobble. Все эти факты согласуются с тем, что assets и runtime contract существенно улучшены. Они не меняют **NO**, потому что оставшийся gate измеряет воспринимаемую направленность соседних кадров, а blind phase её не подтвердила.
