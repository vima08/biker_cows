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

| Действие | Клавиатура | Геймпад |
| --- | --- | --- |
| Движение / выбор | `WASD` или стрелки | D-pad / левый стик |
| Огонь / подтверждение | `Z`, `J` или `Space` | A |
| Прыжок | `X`, `K` или левый `Shift` | B |
| Спецприём | `C`, `L` или левый `Ctrl` | X |
| Пауза / назад | `P`, `Esc` или `Enter` | Start / Back |

Подсказка также всегда доступна на экране выбора героя.

## Байкеры

- **Throttle** — универсальный лидер: точный blaster и режим Redline Focus.
- **Modo** — медленнее, зато больше здоровья и брони: spread-shot и Metal Quake.
- **Vinnie** — самый быстрый и хрупкий: скоростной laser и White-Knuckle rush.

Оружие повышается до четвёртого уровня. В бою выпадают здоровье, броня, новое оружие, rapid fire и очковые бонусы. Непрерывные попадания увеличивают combo-множитель; лучшие результаты сохраняются в `localStorage`.

## Содержание вертикального среза

- заставка, главное меню и таблица рекордов;
- выбор из трёх заметно различающихся героев;
- 7:45 пути до финального штурма плюс бой с боссом;
- наземные riders/tanks/mines и воздушные drones/skimmers/pods;
- мини-босс, финальный Limburger Dreadnaught, победа и поражение;
- art-directed PNG sprite sheets для трёх героев, rider, 12-frame impact chain, воздушного roster, мини-босса и финального босса;
- authored Mars panorama, многослойный параллакс, дорожная перспектива и 2px material grid;
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

Smoke-тест использует установленный Microsoft Edge, проходит меню, выбор героя, движение, стрельбу, прыжок, исходный 8-кадровый regression beat и новый 12-кадровый material-impact beat с реальным столкновением, воздушный бой, мини-босса, паузу, финального босса, победу и рестарт. Он проверяет загрузку всех девяти локальных атласов и runtime/console errors, а также сохраняет реальные кадры в `.gauntlet/latest/`. Путь к другому Chromium можно передать через `BMFM_BROWSER`, адрес сервера — через `BMFM_URL`.

Отладочные сцены для локальной визуальной проверки:

- `?scene=select`
- `?scene=game&time=105&hero=vinnie`
- `?scene=miniboss&hero=throttle`
- `?scene=boss&hero=modo`
- `?scene=aerial&hero=throttle`
- `?scene=beat&hero=throttle`

## Локальный арт-пайплайн

Готовые игровые ассеты находятся в `public/assets/sprites/` и `public/assets/world/`. Их генерационные спецификации и provenance записаны в [`ASSET_PROMPTS.md`](ASSET_PROMPTS.md). Chroma-key sheets нормализуются в фиксированные 256×192 ячейки локальным PowerShell/System.Drawing-скриптом:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-5
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-6
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-7
powershell -ExecutionPolicy Bypass -File scripts/process_sprite_sheets.ps1 -SourceDirectory .gauntlet/iteration-9
```

Для запуска игры повторная генерация или обработка не нужны: production-ready PNG уже включены в проект.

## Progress workbench

После `npm run dev` откройте `/workbench/index.html`. Страница показывает лучшие реальные кадры Gauntlet-итераций, заключения независимого критика и сделанные улучшения.

## Правовой статус

Это некоммерческий локальный фанатский прототип. Biker Mice from Mars и имена персонажей принадлежат соответствующим правообладателям. Проект не содержит извлечённых материалов оригинального сериала или коммерческих игр.
