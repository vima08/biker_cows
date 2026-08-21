# Как добавить новый уровень

## Brawler-уровень на существующем runtime

1. Положите production-ассеты в `public/assets/brawler/<level-id>/` или другой стабильный каталог.
2. В `src/levels/campaign.ts` создайте `BrawlerLevelDefinition`.
3. Укажите уникальные `id` и `order`, длину мира, границы пола, босса, четыре atlas-пути и волны.
4. Добавьте definition в массив, переданный `LevelRegistry`.
5. Запустите `npm run build` и smoke-сценарий.

Последовательные brawler-уровни подхватываются переходом автоматически: после победы `VenusGame` спрашивает `campaign.nextAfter(currentLevelId)`.

Минимальный пример:

```ts
export const ORBITAL_DOCKS: BrawlerLevelDefinition = {
  id: 'orbital-docks',
  order: 3,
  runtime: 'brawler',
  title: 'ORBITAL DOCKS',
  subtitle: 'BREAK THE BLOCKADE',
  bossName: 'DOCK WARDEN',
  musicCue: 'brawler',
  length: 7200,
  floorFar: 300,
  floorNear: 478,
  assets: {
    backdrop: '/assets/brawler/orbital-docks/backdrop.png',
    floor: '/assets/brawler/orbital-docks/floor.png',
    enemies: '/assets/brawler/orbital-docks/enemies.png',
    boss: '/assets/brawler/orbital-docks/boss.png',
  },
  waves: [
    { at: 600, enemies: ['raider', 'shocker'] },
    { at: 6500, enemies: ['boss'] },
  ],
};
```

Текущий enemy atlas использует 4 колонки на направление и строки классов `raider`, `bruiser`, `shocker`; boss atlas — 3×2. Если нужны другие классы или раскладка, расширьте тип `BrawlerEnemyKind` и renderer вместе с definition.

## Уровень с новым типом gameplay

Для нового runtime недостаточно одной конфигурации. Добавьте небольшой класс с контрактом `update`, `draw`, `snapshot`, затем:

1. расширьте `LevelRuntime` и соответствующий `LevelDefinition`;
2. добавьте definition в `campaign.ts`;
3. создайте runtime в переходе `VenusGame`;
4. добавьте один debug query/метод и один smoke-сценарий.

Не добавляйте конфигурацию нового уровня прямо в `game.ts`: числовые параметры, подписи, волны и asset paths должны оставаться в definition.

## Артефакты проверки

Полные прогоны пишите в `.gauntlet/<run>/`. Этот каталог игнорируется целиком. В Workbench переносите только несколько итоговых кадров, которые документируют текущее production-состояние; промежуточные серии не коммитьте.
