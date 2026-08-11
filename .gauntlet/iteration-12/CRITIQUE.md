# Wave 12 — свежий независимый visual critique, viewer 1/5

## Итоговый вердикт

**AAA-of-its-era, полный продукт: NO.**

Как complete vertical slice продукт уже очень силён: title/menu дают убедительный cartridge-cover promise, игровые герои и техника держат крупную материальную пиксельную моделировку, HUD стабилен, aerial roster и Road Ripper расширяют production breadth, а boss/body/core damage states дают масштаб и spectacle уровня лучших локальных 16-bit референсов. По сравнению с `Batman`, `Contra: Hard Corps`, `Gunstar Heroes` и `Thunder Force IV` это не выглядит учебным макетом: иерархия кадра, палитра, силуэты и объём контента коммерчески убедительны.

Но обязательный perceptual gate не пройден. Мой свежий blind order дал **5/11** правильных directed adjacent relations вместо требуемых **≥10/11**; строгий macro-order production-фаз также не восстановлен. Поэтому корректный integration PASS не равен premium visual acceptance.

## Blind phase — зафиксировано до reveal

До фиксации результата я открыл только `.gauntlet/iteration-12/blind/frame-A.png` … `frame-L.png` и scarlet/teal пары. Я не читал report, integration verdict, source, NEXT или прежние critiques и не открывал production captures.

### Зафиксированный causal order

**`F → C → K → E → A → J → D → I → H → L → G → B`**

Blind-чтение было таким: neutral/pre → muzzle → два travel → две contact-фазы → ранний recoil → продолжение recoil/debris → поздний damaged recovery. Projectile travel был безошибочно причинным; неопределённость началась ровно в момент удара.

### Материалы, реально распознанные blind

Я назвал все три intended класса:

1. **blue painted armor** — отделившиеся синие панели;
2. **hot metal sparks** — бело-жёлто-оранжевые tapered выбросы;
3. **smoke/soot** — attached тёмный/фиолетовый дым у повреждённого front hardpoint.

Итого material naming: **PASS, 3/3**, но с важной оговоркой: smoke уверенно читался в teal, а в production-selected scarlet он слабый и местами похож на низкоконтрастные квадратные артефакты. Blue armor и hot sparks читаются уверенно в обоих вариантах.

### Blind scarlet / teal vote

- **Contact — tie.** Изображения визуально одинаковы; ни один вариант не даёт преимущества.
- **Mass — teal.** Attached фиолетовый soot seed лучше привязывает разрыв к scar и разделяет blue panel, hot sparks и массу байка. Scarlet чище, но настолько редуцирован, что кадр легче прочитать как whole-bike lift с несколькими случайными штрихами.
- **Aftermath — teal.** Фиолетовый attached smoke и горячая точка дают ясный damaged-state residue. В scarlet чёрный квадратный дым теряется на дороге и слабее объясняет состояние переднего узла.

Итог pair vote: **teal 2, tie 1, scarlet 0**. Полный production sequence использует scarlet mass/aftermath, то есть blind-предпочтение не подтверждает выбранное решение.

Blind premium verdict был **NO**: контакт выглядит энергично и дорого, но временное направление после него не становится неизбежным.

## Reveal: true mapping и строгий score

Истинное соответствие production captures:

- `A = impact-05-hitstop`
- `B = impact-10-damage-hold`
- `C = impact-01-muzzle`
- `D = impact-08-debris-1`
- `E = impact-03-travel-75`
- `F = impact-00-pre`
- `G = impact-11-recover`
- `H = impact-06-recoil-1`
- `I = impact-09-debris-2`
- `J = impact-04-contact`
- `K = impact-02-travel-25`
- `L = impact-07-recoil-2`

Production order:

**`F → C → K → E → J → A → H → L → D → I → B → G`**

Правильные directed adjacent relations: `F→C`, `C→K`, `K→E`, `H→L`, `D→I` — **5/11**. Обратные пары `A→J` и `G→B` не получают балл при строгой проверке. Ошибки: `E→J`, `J→A`, `A→H`, `L→D`, `I→B`, `B→G`.

Macro `contact < recoil < debris < recover`: **FAIL**. В blind order production-debris `D/I` оказался перед production-recoil `H/L`, а production-recover `G` — перед damage-hold `B`. Сами крупные категории существуют, но их настоящее направление времени не читается.

## Полный продукт, report и integration

Visual audit всех iteration-12 main scenes, ride sequence, combat beats, wobble, impact captures и десяти atlas sheets подтверждает высокий общий floor. Menu, gameplay sprites, aerials, Road Ripper и boss states едины по масштабу, плотности пикселя и палитре. Wobble A/B/C достаточно различим и не конкурирует с hit reaction. Boss exchange намеренно перегружен, но остаётся кульминационным кадром, а victory сохраняет читаемую иерархию.

`report.json` объективно подтверждает исправную механику: `ok=true`, `runtimeErrors=[]`, 10 atlases ready, один projectile create/consume и один score transition. Contact зарегистрирован точно (`20×18 px` overlap, `96×72 px` bbox); contact→hitstop сжат до `5.66 px / 2°`; contact→peak достигает `40×18 px / 14°`; reverse по четырём anchor families равен `0 px`; smoke численно растёт `12→44 px` и темнеет `54→24`; damage-hold→recover отличается на `22.98 px / 6°`, recover grounded, scar сохраняется `18×16 px`.

`INTEGRATION_VERDICT.md` корректно ставит **PASS** интеграции и отдельно не присваивает AAA verdict. Числа доказывают, что contract реализован; blind result доказывает, что зритель всё ещё не может надёжно прочитать его temporal grammar.

## Delta против iteration 11

Wave 12 локально улучшила две вещи. `hitstop` больше не выглядит почти вторым contact explosion: теперь это компактная фаза с началом панели, искрами и soot seed. Scarlet-вариант также убрал декоративный фиолетовый blob из recoil/mass, а peak displacement вырос с примерно `34×16 px` до `40×18 px`, recovery получил более сильный поздний разрыв.

Однако perceptual outcome ухудшился: мой строгий blind score снизился с iteration-11 **7/11** до **5/11**. Одинаковый peak transform у `recoil-2`, `debris-1` и `debris-2` оставляет материалам слишком мало силы, чтобы задать порядок; scarlet-cleanup одновременно ослабил smoke как поздний маркер. В результате более корректная численная физика стала менее очевидной как последовательность неподготовленному зрителю.

## Ровно один крупнейший gap

**Normal-hit gesture всё ещё не является самодостаточной причинно-материальной хореографией: silhouette progression и material evolution не кодируют однозначное направление времени от contact через recoil/debris к recover.**

Это один gap, объединяющий все наблюдаемые симптомы. Исправлять следует не общий арт, HUD, roster или boss spectacle, а только временную формулировку повторяющегося удара.

Builder-ready acceptance для следующей версии: сохранить `pre/muzzle/travel`, registered contact, общий peak `40×18 px / 14°`, persistent blue-panel trajectories и runtime contracts, но переразвести четыре поздние ступени визуально. `contact` должен иметь целый target silhouette; `hitstop` — компактный compressed scar seed без второго full burst; `recoil-1/2` — заметно возрастающую массу; `debris-1/2` — тот же peak hold, но с безошибочно возрастающим количеством/дистанцией blue armor, hot sparks и attached soot; `damage-hold` — самый дальний повреждённый остаток; `recover` — grounded возврат с сохранённым scar, но меньшим углом и ясно более поздним, рассеивающимся smoke tail. Production-selected treatment обязан оставить smoke видимым на тёмной дороге без возврата к декоративному blob.

Финальный acceptance остаётся прежним и должен проверяться fresh blind viewers: минимум **4 из 5** получают **≥10/11** directed adjacent relations на 12 production frames; все 5 ставят production-фазы в `contact < recoil < debris < recover`; минимум 4 из 5 без подсказки называют `blue painted armor`, `hot metal sparks`, `smoke/soot`. Пока этот единый gate не пройден, честный full-product verdict остаётся **NO**.
