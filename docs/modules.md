# Модули

| Модуль | Ответственность |
| --- | --- |
| `src/main.ts` | Сборка приложения, debug API, запуск игры |
| `src/core/InputController.ts` | Клавиатура, pointer, два gamepad и frame-based input |
| `src/core/AudioEventBridge.ts` | Перевод игровых событий в музыку и SFX |
| `src/core/GameEvents.ts` | Независимая от аудиодвижка публикация событий |
| `src/core/HighScoreStore.ts` | Валидация, сортировка и сохранение рекордов |
| `src/core/ImageAsset.ts` | Асинхронная загрузка изображения и состояние fallback |
| `src/levels/LevelRegistry.ts` | Упорядоченный каталог и переход к следующему уровню |
| `src/levels/campaign.ts` | Единственный список production-уровней |
| `src/rider/types.ts` | Состояние сущностей motorcycle shoot ’em up |
| `src/rider/catalog.ts` | Герои, intro-панели, размеры и hardpoints атласов |
| `src/rider/RiderPoseResolver.ts` | Кадры тела, muzzle/exhaust hardpoints |
| `src/game.ts` | Оркестрация сцен и runtime Stage 1 |
| `src/roadRash/` | Runtime Sulfur Run: pseudo-3D дорога, трафик, melee и Road King |
| `src/brawler/types.ts` | Состояние сущностей beat ’em up |
| `src/brawler/catalog.ts` | Характеристики и atlas-пути героев |
| `src/brawler/BeatEmUpStage.ts` | Симуляция и отображение brawler-уровня |
| `src/beatEmUp.ts` | Совместимый facade для старых импортов |
| `src/environment.ts` | Фон, дорога и foreground Stage 1 |
| `src/art.ts` | Процедурные pixel-art fallback-рендеры |
| `src/spriteAtlas.ts` | Загрузка и выбор кадров Stage 1 |

## Где хранить новые файлы

- Общий сервис без игровой терминологии — `src/core/`.
- Контракт и production-конфигурация уровня — `src/levels/`.
- Логика только motorcycle-режима — `src/rider/`.
- Логика только beat ’em up — `src/brawler/`.
- Production PNG — `public/assets/<режим или уровень>/`.
- Временные отчёты и raw-кадры — `.gauntlet/` (Git их игнорирует).
- Небольшая публичная витрина — `public/workbench/captures/showcase/`.
