# Wave 11 — свежий независимый visual critique, viewer 1/5

## Итоговый вердикт

**AAA-of-its-era: NO.**

Полный продукт уже выглядит как сильный коммерческий 16-bit vertical slice: меню даёт убедительный cartridge-cover promise, gameplay-спрайты крупные и материальные, HUD стабилен, aerial wave расширяет roster, а boss и его damage states держат масштаб уровня лучших локальных референсов. Integration также объективно проходит: `report.json` сообщает `ok=true`, 10/10 готовых atlases, `runtimeErrors=[]`, один score transition и полный production route до kill/victory/restart.

Но заданный perceptual DoD является acceptance gate, и мой свежий blind result его не прошёл: **7/11 вместо ≥10/11**, macro-порядок нарушен, а три авторских класса материала без reveal названы не были. Поэтому технический `INTEGRATION PASS` не превращается в premium visual acceptance.

## Blind phase — зафиксировано до reveal

В blind-фазе были открыты только `.gauntlet/iteration-11/blind/frame-A.png` … `frame-L.png` и шесть gold/violet-пар. До фиксации результата я не читал source, report, integration verdict, NEXT, critiques и не открывал production captures.

### Мой causal order

**`B → I → E → K → C → G → D → J → F → L → A → H`**

Моё чтение: нейтраль → muzzle → ранний/поздний travel → две близкие contact-фазы → краткая промежуточная фаза → нарастающий recoil → debris peak → damaged aftermath.

### Три материала, названные мной blind

1. синяя окрашенная обшивка / металл;
2. хромированный металл двигателя / сталь;
3. чёрная резина колёс.

Это **не проходит** заданный material-naming gate. После reveal authored-набор читается как `blue armor → hot metal sparks → smoke/soot`; из него я точно назвал только blue armor. Я принял видимые материалы самого байка за три класса aftermath, значит production-секвенция не заставила нужные искры и дым победить в классификации без подсказки asset sheet.

### Blind A/B choices

- **Contact — gold.** Зарегистрированное бело-оранжевое ядро с холодным синим rim лучше внедрено в leading edge цели; violet поднимает цель раньше и делает связь с hit point слабее.
- **Mass — gold.** Gold даёт связный горизонтальный kick, отставание головы/корпуса и отделяющиеся детали; violet выглядит как цельный байк, поставленный на слишком высокий диагональный transform.
- **Aftermath — gold.** Gold лучше сохраняет повреждённый передний узел, attached smoke и опору массы; violet выглядит более целым и подвешенным.

Итог blind pair vote: **gold 3:0**.

Blind premium combat verdict до reveal был **NO**: контакт убедителен и стиль цельный, но вершина contact казалась почти продублированной, а вторичная фаза — недостаточно неизбежной по порядку.

## Reveal: production mapping и строгий score

Hidden order раскрыт только SHA-256-сопоставлением blind-файлов с реальными production captures:

- `A = impact-09-debris-2`
- `B = impact-00-pre`
- `C = impact-05-hitstop`
- `D = impact-11-recover`
- `E = impact-02-travel-25`
- `F = impact-07-recoil-2`
- `G = impact-04-contact`
- `H = impact-10-damage-hold`
- `I = impact-01-muzzle`
- `J = impact-06-recoil-1`
- `K = impact-03-travel-75`
- `L = impact-08-debris-1`

Истинный production order:

**`B → I → E → K → G → C → J → F → L → A → H → D`**

Правильно восстановленные соседние отношения: `B→I`, `I→E`, `E→K`, `J→F`, `F→L`, `L→A`, `A→H` — **7/11**. Ошибки: `K→G`, `G→C`, `C→J`, `H→D`.

Macro-gate `contact < recoil < debris < recover` также **FAIL**: production-recover `D` в моём blind order оказался до recoil `J/F`. Material gate — **FAIL**, 1/3 intended classes. Следовательно, обязательный DoD Wave 10 не закрыт.

## Что объективно улучшилось против iteration 10

Delta заметна и направлена ровно в нужную сторону.

- Blind adjacent score вырос с зафиксированных в iteration 10 **5/11** до **7/11**.
- Gold contact/hitstop удерживают одну posture family; прежний violet-contact преждевременно поднимал цель, а следующий кадр визуально распрямлял её.
- Новый recoil — последовательный горизонтальный удар через корпус, голову, вилку и тень. Старый `impact-06/07` читалcя как два слабо связанных высоких whole-bike transforms.
- Панель и tapered sparks теперь начинают путь в hitstop/recoil-1 и продолжают его через debris; missing/bent contour и smoke остаются на `frontHardpoint`.
- Wobble сохраняет меньшую амплитуду и контрфазу относительно peak recoil. Asset sheets подтверждают согласованный уровень пиксельной моделировки персонажей, техники, boss states и impact material.

Эта дельта закрывает большую часть буквальных требований прошлого билда, но не главный blind acceptance threshold.

## Ровно один крупнейший gap

**Повторяющийся hit gesture всё ещё не является самодостаточно читаемой причинно-материальной хореографией: соседние силуэты contact/hitstop/recoil/recover и момент появления authored materials не дают свежему зрителю неизбежно восстановить направление времени.**

Это один gap, а не отдельные проблемы «мало FX», «плохие assets» или «слабая физика». Assets качественные, зарегистрированный контакт точный, численная траектория монотонна; проваливается их совокупная перцептивная формулировка. `04/05` различаются слишком мало, а upright damaged `11` достаточно похож на раннюю реакцию, чтобы выпасть из tail. Одновременно blue armor доминирует над sparks/smoke настолько, что intended material triad без asset sheet не называется.

## Builder-ready DoD следующей волны

Сохранить `pre/muzzle/travel`, gold-направление и production runtime contract. Пересобрать только одну систему — **фазовую читаемость hit gesture** — и принять её по следующему единому causal-order gate:

1. `contact` остаётся первым зарегистрированным overlap-кадром с в основном целым target silhouette. `hitstop` обязан быть его явно более сжатым продолжением по shot/recoil vector: hardpoint delta **4–8 px**, body delta **2–4°**, без распрямления вилки, головы или оружия. В hitstop уже видны начало отрыва одной синей панели, минимум две горячие tapered sparks и компактный soot seed у scar.
2. `hitstop → recoil-1 → recoil-2` даёт монотонную ступень по всем четырём anchors — hardpoint, front wheel, head, gun. Ни один anchor не меняет знак; локальный reverse не более **2 px**. От contact к peak: горизонтальная проекция не меньше **38 px**, подъём **16–20 px**, угол **12–16°**. Соседние позы должны отличаться силуэтом, а не только общей трансляцией.
3. `recoil-2 → debris-1 → debris-2` сохраняет цель у recoil peak до начала возврата. Та же синяя панель и те же две sparks продолжают дуги; расстояние от scar строго возрастает в каждом sample, шаг **8–16 px**, без spawn/reset/teleport. Smoke остаётся attached к scar и растёт по диаметру/снижает value, а не конкурирует с панелями как фиолетовый декоративный blob.
4. `damage-hold → recover` получает однозначный поздний знак: hold остаётся минимум на **12 px** дальше по recoil vector и минимум на **5°** сильнее наклонён, чем recover; recover возвращает колёса к дороге, но сохраняет missing/bent contour не меньше **18×16 px** и smoke-base distance не больше **6 px** от того же moving node.
5. Материальная иерархия проверяется на production frames, не на отдельном sheet: при показе `hitstop/recoil/debris/hold` минимум **4 из 5** свежих зрителей без подсказки называют именно `blue painted armor`, `hot metal sparks`, `smoke/soot`. Ни один из intended классов нельзя заменять названием неповреждённого материала байка вроде rubber/chrome.
6. Финальный blind-тест: 12 кадров из одного production-выстрела, 960×540, фиксированные seed/camera/coordinates, без HUD, labels, filenames и знания версии. Минимум **4 из 5** свежих viewers получают **≥10/11** правильных adjacent relations; все 5 ставят `contact < recoil < debris peak < recover`. Viewer 1/5 этой волны дал 7/11, поэтому проход нельзя объявлять по внутренним метрикам.
7. Runtime guardrail сохраняется: `runtimeErrors=[]`, 10/10 atlases ready, один projectile create/consume, один score transition, hit/damage/emitter origins расходятся максимум на **6 px**, scar/smoke остаются attached, все 12 кадров снимаются из production runtime.

До прохождения этого единого perceptual gate честный full-product verdict остаётся **NO**. После него нынешняя визуальная система уже имеет достаточно сильные menu, roster, boss spectacle, HUD и world art для повторного AAA-of-era рассмотрения.

## Report / integration audit после visual verdict

После фиксации blind verdict прочитаны iteration-11 `report.json` и `INTEGRATION_VERDICT.md`, затем iteration-10 `CRITIQUE.md` и captures. Report подтверждает capture order, contact overlap `20×18 px`, contact/hitstop delta `7.21 px / 2°`, peak recoil `34×16 px / 14°`, ранние trajectories панели/двух sparks с шагами ниже 16 px, scar `18×16 px` и smoke-base distance 4 px. Integration корректно говорит **INTEGRATION PASS**, не заявляя AAA acceptance. Эти данные объясняют, что механизм реализован согласно контракту; они не отменяют независимый blind FAIL по order, macro и material naming.
