# Biker Cows from Venus: Neon Stampede

Законченная локальная браузерная игра: скоростной side-scrolling shoot ’em up с тремя антропоморфными коровами-байкерами, 8–10-минутным уровнем, мини-боссом, финальной битвой и кооперативом на двоих. Персонажи, мир, графика, музыка и звуки созданы специально для проекта. После установки зависимостей игра полностью автономна и не обращается к внешним API.

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

В одиночной игре: `WASD` или стрелки — движение, `Z` — огонь, `X` — прыжок, `C` — спецприём, `P`/`Esc` — пауза. Поддерживаются совместимые клавиши `J/K/L`, `Space`, `Shift`, `Ctrl` и Gamepad API.

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
- дым выхлопа привязан к видимым выходам труб каждого байка во всех ride, fire, release и jump-позах;
- многослойный параллакс Venus, авторские дорожные и foreground-пропы;
- наземные и воздушные враги, Magma Mauler Mk.IV и Sulfur Dreadnought;
- несколько видов оружия, улучшения, pickups, combo, спецприёмы;
- локальный кооператив без friendly fire;
- пауза, победа, поражение и рестарт;
- процедурный Web Audio рок-саундтрек и игровые SFX;
- screen shake, искры, дым, пыль, обломки, следы шин и staged explosions.

## Автоматическая проверка

В первом терминале:

```bash
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

Во втором:

```bash
npm run test:smoke
```

Gauntlet проходит solo и co-op маршруты, проверяет 13/13 локальных atlas’ов, sustained/release/muzzle, impact chain, мини-босса, босса, победу и рестарт. Кадры сохраняются в `.gauntlet/latest/`; обязательный gate — `runtimeErrors=[]`.

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

## Арт-пайплайн

Production PNG лежат в `public/assets/`. Исходные chroma-листы Wave 17 находятся в `.gauntlet/iteration-17/raw/`. Нормализация в фиксированные ячейки 256×192:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-17/raw
```

Точные промпты и provenance: [ASSET_PROMPTS.md](ASSET_PROMPTS.md). Прогресс реальных браузерных кадров: `/workbench/index.html`.

## Лицензирование

Это самостоятельный локальный прототип с оригинальными персонажами и ассетами. Сторонние ROM, спрайты, музыка и звуки не используются.
