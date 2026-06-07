# AUTO.RU-CM66-CARS-DB

Единый каталог auto.ru по 12 городам Crystal Motors. GH Pages → CSV из Google Sheets → парсер на Apps Script.

## Архитектура

```
auto.ru (12 дилеров) → Apps Script (autoru-scraper.gs)
                       → Google Sheet (1N8c3SLHCoZ0cdL4EcD4rgAphu7AMPjxrxPBL7dkOSUY)
                       → опубликован как CSV
                       → index.html (GH Pages) рендерит карточки
```

## Установка (один раз)

### 1. Google Sheet — шапка
- Откройте таблицу [1N8c3SLHCoZ0cdL4EcD4rgAphu7AMPjxrxPBL7dkOSUY](https://docs.google.com/spreadsheets/d/1N8c3SLHCoZ0cdL4EcD4rgAphu7AMPjxrxPBL7dkOSUY).
- Расширения → Apps Script.
- Создайте файл `setup-headers.gs`, скопируйте содержимое [apps-script/setup-headers.gs](apps-script/setup-headers.gs).
- Запустите `setupHeaders` — создастся лист `AUTO.RU-CM66-CARS-DB` с 22 колонками.

### 2. Apps Script — парсер
- В том же проекте создайте файл `autoru-scraper.gs`, скопируйте [apps-script/autoru-scraper.gs](apps-script/autoru-scraper.gs).
- Запустите `installTriggers` — поставит ежедневные старты в 00:00, 04:00, 13:00.
- Разово запустите `startScrape` для проверки. Логи: View → Executions.

### 3. Публикация листа как CSV
- Файл → Поделиться → Опубликовать в Интернете.
- Лист: `AUTO.RU-CM66-CARS-DB`, формат: CSV. Опубликовать.
- Скопируйте `gid` вкладки (URL вида `…/edit#gid=12345`).
- В [js/config.js](js/config.js) подставьте `gid` в `csvUrl`.

### 4. GH Pages
- Settings → Pages → Source: Deploy from branch → `main` / `/ (root)` → Save.
- Через ~1 минуту сайт доступен на `https://frankiej13.github.io/AUTO.RU-CM66-CARS-DB/`.

## Колонки таблицы

`brand`, `model`, `title`, `url`, `price`, `city`, `year`, `country`, `seats`, `mileage`, `owners`, `condition`, `pts`, `trim`, `engine`, `transmission`, `drive`, `wheel`, `body`, `color`, `image_url`, `updated_at`

## Расписание

Apps Script запускает `startScrape` ежедневно в 00:00, 04:00, 13:00 (часовой пояс проекта). Каждый запуск чистит лист и обходит все 12 городов. 6-минутный лимит обходится через `continueScrape` (триггер каждые 5 мин, дорабатывает остаток).
