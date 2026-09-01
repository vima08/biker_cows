# Biker Cows from Venus: Neon Stampede

Архитектура, описание модулей и инструкция по добавлению уровней находятся в [docs/](docs/README.md).

Законченная локальная браузерная игра из связанных аркадных секций: скоростной motorcycle shoot ’em up, промежуточная combat-race в духе 16-битных Road Rash и полноценный side-scrolling beat ’em up в Furnace District. Доступны три антропоморфные коровы-байкеры и локальный кооператив. Персонажи, мир, графика, музыка и звуки созданы специально для проекта. После установки зависимостей игра полностью автономна и не обращается к внешним API.

## Запуск

Нужен Node.js 20 или новее.

```bash
npm install
npm run dev
```

Vite покажет локальный адрес, обычно `http://localhost:5173`.

Production-сборка:

```bash
npm run build
npm run preview
```

## Управление

В одиночной игре: `WASD` или стрелки — движение; в Sulfur Run `W/S` отвечают за газ/тормоз, `A/D` за руление, `Z` за боковой удар; на байке `Z` стреляет, а в Furnace District собирает серию ударов. `X` — прыжок, `C` — спецприём, `P`/`Esc` — пауза. Поддерживаются совместимые клавиши `J/K/L`, `Space`, `Shift`, `Ctrl` и Gamepad API.

На выборе персонажей `Tab` включает локальный режим на двоих.

| Игрок | Выбор | Движение | Огонь | Прыжок | Спецприём |
| --- | --- | --- | --- | --- | --- |
| P1 | `A/D`, готовность `Z` | `WASD` | `Z` | `X` | `C` |
| P2 | стрелки, готовность `Numpad1` или `/` | стрелки | `Numpad1` или `/` | `Numpad2` | `Numpad3` |

Первый и второй геймпады управляют P1 и P2: левый стик/D-pad, A — огонь/готовность, B — прыжок, X — спецприём, Start — пауза. Friendly fire отключён; поражение наступает только после потери обеих героинь.

## Героини

- **Cassia** — сбалансированная капитан: точный blaster и Sunburst Focus.
- **Bruna** — тяжёлая кибермеханик: максимум здоровья и брони, spread-shot и Gravity Stomp. Её левая сегментированная киберрука согласована во всех ride, jump, sustained-fire, release и select-ассетах.
- **Nova** — самая быстрая и хрупкая: скоростной laser и Venus Rush.

Оружие улучшается до четвёртого уровня. Выпадают здоровье, броня, оружие, rapid fire и очковые бонусы; combo-множитель поощряет непрерывные попадания. Рекорды сохраняются локально.

## Что входит

- заставка с оригинальной Venus-панорамой, главное меню и таблица рекордов;
- три крупных select-портрета и три полных 8-frame gameplay atlas;
- отдельные 4-frame sustained-fire и 3-frame release-циклы каждой героини;
- расширенный вертикальный диапазон дороги: героини используют полосу от дальнего ограждения до нижнего foreground;
- дым выхлопа привязан к видимым выходам труб каждого байка во всех ride, fire, release и jump-позах;
- многослойный параллакс Venus, художественный базальтовый shoulder и корректно перекрывающие колёса foreground-камни;
- наземные и воздушные враги, Magma Mauler Mk.IV и Sulfur Dreadnought;
- несколько видов оружия, улучшения, pickups, combo, спецприёмы;
- полностью отдельный Stage 2 — **Furnace District**: belt-scrolling арены, 8-направленное движение, трёхударные серии, воздушные атаки, area-special, три класса уличных врагов, pickups и The Forge Overseer;
- промежуточный **Sulfur Run**: псевдо-3D combat-race, газ/тормоз, руление, боковые удары, трафик, масло, соперники, Road King и собственный continue-checkpoint;
- отдельные 8-frame пешие atlas’ы Cassia/Bruna/Nova, 12-frame Venus gang, 6-frame boss и два авторских слоя индустриального окружения;
- локальный кооператив без friendly fire;
- пауза, победа, поражение и рестарт;
- процедурный Web Audio рок-саундтрек и игровые SFX;
- screen shake, искры, дым, пыль, обломки, следы шин и staged explosions.

## Автоматическая проверка

В первом терминале:

```bash
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

Во втором (для production preview используйте порт `4173`):

```bash
npm run test:smoke
npm run test:wave18
npm run test:brawler
npm run test:road-rash
npm run test:campaign
npm run test:debug-scenes
```

Основной Gauntlet проходит solo и co-op маршруты первого уровня, проверяет 13/13 локальных atlas’ов, sustained/release/muzzle, impact chain, мини-босса, босса, победу и рестарт. `test:brawler` отдельно проверяет семь Stage-2 ассетов, реальный переход между уровнями, всех трёх героинь, co-op без friendly fire, шесть арен и The Forge Overseer. Обязательный gate — `runtimeErrors=[]`.

Переменные: `BCFV_BROWSER`, `BCFV_URL`, `BCFV_CAPTURE_DIR`.

Полезные сцены:

- `?scene=select`
- `?scene=game&time=105&hero=nova`
- `?scene=miniboss&hero=cassia`
- `?scene=boss&hero=bruna`
- `?scene=aerial&hero=cassia`
- `?scene=sustain&hero=bruna`
- `?scene=enemy-roster`
- `?scene=coop-select`
- `?scene=coop-boss`
- `?scene=brawler&hero=cassia`
- `?scene=brawler-boss&hero=bruna`
- `?scene=brawler-coop`
- `?scene=brawler-coop-boss`
- `?scene=brawler-walk&hero=cassia`
- `?scene=brawler-jump&hero=bruna`
- `?scene=brawler-air-attack&hero=nova`
- `?scene=road-rash&hero=cassia`
- `?scene=road-rash-combat&hero=cassia`
- `?scene=road-rash-boss&hero=cassia`
- `?scene=stage-transition&hero=bruna`

`hero=cassia|bruna|nova` выбирает героиню в поддерживающих её debug-сценах. Brawler-сцены `brawler-walk`, `brawler-jump` и `brawler-air-attack` фиксируют соответственно ходьбу, прыжок и воздушную атаку для визуальной/анимационной проверки. Road Rash-сцены открывают обычное движение, гарантированный ближний бой и сразу битву с Road King. `npm run test:debug-scenes` автоматически открывает все три brawler-сцены для каждой героини, снимает кадры в `.gauntlet/debug-scenes/`, а также проверяет `?art=vector` и runtime-переключатель арта.

### Runtime vector mode

Добавьте `?art=vector` к любому URL сцены, чтобы запустить процедурный/vector fallback вместо production-атласов, например:

```text
http://localhost:5173/?scene=brawler-walk&hero=cassia&art=vector
```

Без перезагрузки режим переключается через debug API в консоли браузера:

```js
window.__BCFV_DEBUG__.setArtEnabled(false); // vector fallback
window.__BCFV_DEBUG__.setArtEnabled(true);  // production authored art
```

Текущее состояние доступно в `window.__BCFV_DEBUG__.snapshot()` как `artEnabled` и `renderMode`.

## Арт-пайплайн

Production PNG лежат в `public/assets/`. Исходные chroma-листы Wave 17 находятся в `.gauntlet/iteration-17/raw/`. Нормализация в фиксированные ячейки 256×192:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-17/raw
```

Точечные исправления Wave 18 (две разные руки Bruna, перекрытие головы Nova и Venus shoulder):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/process_iteration18_art.ps1
```

Пешие герои, банда, босс, составная 4:1 панорама и перспективный пол Stage 2:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/process_brawler_art.ps1
```

Raw-мастера Stage 2 сохранены в `.gauntlet/iteration-19/raw/`, production-ассеты — в `public/assets/brawler/`.

Точные промпты и provenance: [ASSET_PROMPTS.md](ASSET_PROMPTS.md). Прогресс реальных браузерных кадров: `/workbench/index.html`.

## Лицензирование

Это самостоятельный локальный прототип с оригинальными персонажами и ассетами. Сторонние ROM, спрайты, музыка и звуки не используются.
