# AUTORUCM66CARSDB

Единый каталог auto.ru по 12 дилерам Crystal Motors.

## Архитектура

```
auto.ru → GitHub Actions (Python) → cars.csv в репо → GH Pages (index.html)
```

- **Скрапер**: `scripts/scrape.py` — фетчит дилерские страницы, разбирает встроенный SSR-state, мапит поля в строки CSV.
- **Расписание**: `.github/workflows/scrape.yml` — cron 00:00 / 04:00 / 13:00 МСК (21:00 / 01:00 / 10:00 UTC). Запуск руками: вкладка Actions → Scrape auto.ru → Run workflow.
- **Фронт**: `index.html` + `js/app.js` + `css/style.css`. Читает `cars.csv` из того же репо, рендерит карточки с фильтрами.

## Колонки CSV

`brand`, `model`, `title`, `url`, `price`, `city`, `year`, `country`, `seats`, `mileage`, `owners`, `condition`, `pts`, `trim`, `engine`, `transmission`, `drive`, `wheel`, `body`, `color`, `image_url`, `updated_at`

## GH Pages

Settings → Pages → Source: Deploy from branch → `main` / `/ (root)` → Save.
Сайт: https://frankiej13.github.io/AUTORUCM66CARSDB/

## Зеркало в Google Sheets (опционально)

В таблице [1N8c3SLHCoZ0cdL4EcD4rgAphu7AMPjxrxPBL7dkOSUY](https://docs.google.com/spreadsheets/d/1N8c3SLHCoZ0cdL4EcD4rgAphu7AMPjxrxPBL7dkOSUY)
на листе `AUTORUCM66CARSDB` в A1 вставьте:

```
=IMPORTDATA("https://raw.githubusercontent.com/FrankieJ13/AUTORUCM66CARSDB/main/cars.csv")
```

Лист сам подтянет актуальный CSV. Никакого сервис-аккаунта, никакой OAuth.

## Локальный запуск скрапера

```bash
python3 scripts/scrape.py cars.csv
```

Зависимостей нет, только стандартная библиотека Python 3.

## Почему не Apps Script

UrlFetchApp ходит из общего пула IP Google → auto.ru возвращает заглушку с `"isRobot":true` и пустым `listing`. Подтверждено логами. GitHub Actions IP-пулы у auto.ru не помечены, страница отдаётся нормально.
