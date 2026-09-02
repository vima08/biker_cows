# Архитектура

## Общая схема

```text
main.ts
  ├─ AudioEventBridge ── AudioSystem
  └─ VenusGame
       ├─ InputController
       ├─ HighScoreStore
       ├─ LevelRegistry ── campaign definitions
       ├─ RiderPoseResolver
       ├─ Stage 1 rider simulation/rendering
       └─ BeatEmUpStage
            ├─ Brawler hero catalog
            ├─ Brawler level definition
            └─ ImageAsset fallbacks
```

`main.ts` — composition root. Он создаёт зависимости и публикует debug API, но не содержит игровую логику.

`VenusGame` — координатор кампании и тестовых сцен. Основная цепочка переключает title/select/intro/rider/brawler/end; экспериментальный road-rash запускается только через отдельные debug URL и не изменяет прогресс кампании.

`BeatEmUpStage` — runtime belt-scrolling уровня. Геометрия, волны, подписи и пути к ассетам приходят через `BrawlerLevelDefinition`; класс не привязан к имени Furnace District.

`RoadRashStage` — автономный pseudo-3D combat-race runtime Sulfur Run: перспектива, скорость, трафик, melee, Road King, snapshot и debug-переходы.

## Правила зависимостей

1. `core` ничего не знает о героях и уровнях.
2. `levels` содержит данные кампании и не импортирует render/runtime-классы.
3. `rider` и `brawler` содержат доменные типы и каталоги своих режимов.
4. Только `VenusGame` выбирает следующий runtime по данным `LevelRegistry`.
5. Звук вызывается через `GameEvents`; Web Audio подключается один раз в `main.ts`.

Такое направление зависимостей не даёт конфигурации уровня разрастаться внутри игрового цикла.

## Жизненный цикл кадра

1. `InputController.pollGamepads()` синхронизирует gamepad-состояние.
2. `VenusGame.update(dt)` обновляет только активную сцену.
3. Rider runtime обновляет сущности сам; brawler runtime делегируется `BeatEmUpStage.update()`.
4. Активный runtime рисует кадр в общий canvas.
5. Однокадровые нажатия очищаются через `InputController.endFrame()`.

## Стабильные точки расширения

- Кампания: `LevelDefinition` и `LevelRegistry`.
- Brawler-уровень: `BrawlerLevelDefinition` с волнами и ассетами.
- Герой на мотоцикле: `rider/catalog.ts` и `RiderPoseResolver`.
- Brawler-герой: единая запись в `brawler/catalog.ts`.
- Аудио: новое семантическое событие в игровом коде и его mapping в `AudioEventBridge`.

`game.ts`, `art.ts` и `environment.ts` всё ещё содержат крупные специализированные render-процедуры. Они изолированы от новых каталогов; дальнейшее дробление можно делать по render-системам без изменения контрактов уровней.
