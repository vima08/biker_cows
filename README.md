# Biker Mice from Mars: Redline Rampage

Законченное локальное браузерное фан-демо: скоростной side-scrolling shoot ’em up с тремя байкерами, 8–10-минутным уровнем, мини-боссом и финальной битвой. Вся игровая графика, музыка и звуки созданы для этого прототипа; ROM, спрайты, музыка и другие ресурсы существующих игр не используются. После установки зависимостей игра полностью автономна и не обращается к внешним API.

## Запуск

Нужен Node.js 20 или новее.

```bash
npm install
npm run dev
```

Vite покажет локальный адрес, обычно `http://localhost:5173`. После установки зависимостей игра не делает внешних сетевых запросов.

Production-сборка и локальный просмотр:

```bash
npm run build
npm run preview
```

Собранные файлы появляются в `dist/`.

## Управление

Одиночная игра сохраняет прежнюю раскладку: `WASD` или стрелки — движение, `Z` — огонь, `X` — прыжок, `C` — спецприём, `P`/`Esc` — пауза. Также работают совместимые клавиши `J/K/L`, `Space`, `Shift` и `Ctrl`.

На экране выбора нажмите `Tab`, чтобы включить локальный режим на двоих:

| Игрок | Выбор героя | Движение | Огонь | Прыжок | Спецприём |
| --- | --- | --- | --- | --- | --- |
| P1 | `A/D`, готовность `Z` | `WASD` | `Z` | `X` | `C` |
| P2 | стрелки, готовность `Numpad1` или `/` | стрелки | `Numpad1` или `/` | `Numpad2` | `Numpad3` |

Первый и второй подключённые геймпады управляют P1 и P2 соответственно: левый стик/D-pad, A — огонь/готовность, B — прыжок, X — спецприём, Start — пауза. Подсказки обеих раскладок показаны прямо на экране выбора.

## Байкеры

- **Throttle** — универсальный лидер: точный blaster и режим Redline Focus.
- **Modo** — медленнее, зато больше здоровья и брони: spread-shot и Metal Quake.
- **Vinnie** — самый быстрый и хрупкий: скоростной laser и White-Knuckle rush.

Оружие повышается до четвёртого уровня. В бою выпадают здоровье, броня, новое оружие, rapid fire и очковые бонусы. Непрерывные попадания увеличивают combo-множитель; лучшие результаты сохраняются в `localStorage`.

## Содержание вертикального среза

- заставка, главное меню и таблица рекордов;
- выбор из трёх заметно различающихся героев;
- полноценный локальный кооператив: независимый выбор героев, движение, прыжки, здоровье, броня, оружие, улучшения и спецприёмы; friendly fire отключён, а поражение наступает только после потери обоих байкеров;
- 7:45 пути до финального штурма плюс бой с боссом;
- наземные riders/tanks/mines и воздушные drones/skimmers/pods;
- мини-босс, финальный Limburger Dreadnaught, победа и поражение;
- тринадцать art-directed PNG atlases: три героя, отдельные sustained-fire и release-bridge sheets, rider, 12-frame impact chain, material-FX sheet, полный наземный и воздушный roster, мини-босс и финальный босс;
- непрерывная наземная стрельба использует устойчивую четырёхфазную боевую стойку каждого героя без возврата в neutral ride между выстрелами; rapid-fire Vinnie проверен отдельной четырёхсекундной последовательностью;
- отпускание огня проходит через три авторские переходные позы за 150 мс; вспышка и физический снаряд рождаются из размеченного ствола/носа каждого байка в ride, sustained, release и jump состояниях;
- экран выбора использует три крупных авторских pixel-art портрета вместо процедурных лиц; портрет Винни выполнен как взрослый мужской персонаж, а повязка Модо согласована во всех игровых циклах;
- authored Mars panorama, многослойный параллакс, дорожная перспектива, 2px material grid и отдельный атлас рельсов, фонарей, знаков, обломков и foreground-камней;
- screen shake, жёсткие pixel-art вспышки, дым, пыль, искры, раздельные обломки и взрывы;
- полностью процедурный Web Audio rock-саундтрек и игровые SFX;
- клавиатура, Gamepad API, пауза и рестарт.

## Автоматическая проверка

В первом терминале запустите фиксированный тестовый порт:

```bash
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

Во втором:

```bash
npm run test:smoke
```

Smoke-тест использует установленный Microsoft Edge и сохраняет реальные кадры в `.gauntlet/latest/`. Он проходит весь solo-маршрут, sustained/release/muzzle и impact-регрессии, воздушный бой, мини-босса, финального босса, победу и рестарт. Отдельный co-op-маршрут проверяет независимый выбор и огонь обоих игроков, владельцев снарядов, отсутствие friendly fire, адресный вражеский урон, продолжение игры после потери одного байкера, поражение обоих, совместную победу над боссом и рестарт на двоих. Gate также требует 13/13 локальных атласов и `runtimeErrors=[]`. Путь к другому Chromium передаётся через `BMFM_BROWSER`, адрес сервера — через `BMFM_URL`.

Отладочные сцены для локальной визуальной проверки:

- `?scene=select`
- `?scene=game&time=105&hero=vinnie`
- `?scene=miniboss&hero=throttle`
- `?scene=boss&hero=modo`
- `?scene=aerial&hero=throttle`
- `?scene=beat&hero=throttle`
- `?scene=sustain&hero=vinnie`
- `?scene=enemy-roster`
- `?scene=coop-select`
- `?scene=coop`
- `?scene=coop-boss`

## Локальный арт-пайплайн

Готовые игровые ассеты находятся в `public/assets/sprites/`, `public/assets/ui/` и `public/assets/world/`. Их генерационные спецификации и provenance записаны в [`ASSET_PROMPTS.md`](ASSET_PROMPTS.md). Chroma-key sheets нормализуются в фиксированные 256×192 ячейки локальным PowerShell/System.Drawing-скриптом:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-5
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-6
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-7
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-9
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-10
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-13
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-14
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-15
```

Для запуска игры повторная генерация или обработка не нужны: production-ready PNG уже включены в проект.

## Progress workbench

После `npm run dev` откройте `/workbench/index.html`. Страница показывает лучшие реальные кадры Gauntlet-итераций, заключения независимого критика и сделанные улучшения.

## Правовой статус

Это некоммерческий локальный фанатский прототип. Biker Mice from Mars и имена персонажей принадлежат соответствующим правообладателям. Проект не содержит извлечённых материалов оригинального сериала или коммерческих игр.
