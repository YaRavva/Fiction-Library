# Таблица telegram_stats

## Общее описание

Таблица `telegram_stats` используется для хранения статистики по работе с Telegram каналами. В отличие от описанной в миграциях структуры, реальная структура таблицы имеет другие поля.

## Структура таблицы

| Название колонки | Тип данных | Nullable | Значение по умолчанию | Описание |
|------------------|------------|----------|----------------------|----------|
| id | uuid | NO | uuid_generate_v4() | Уникальный идентификатор записи |
| date | date | NO | null | Дата, за которую собрана статистика |
| messages_processed | integer | YES | 0 | Количество обработанных сообщений |
| files_downloaded | integer | YES | 0 | Количество загруженных файлов |
| errors_count | integer | YES | 0 | Количество ошибок |
| created_at | timestamp with time zone | YES | now() | Время создания записи |
| updated_at | timestamp with time zone | YES | now() | Время последнего обновления записи |

## Индексы

- Первичный ключ: `id`
- Индекс по полю `date` для быстрого поиска статистики по датам

## Использование

### Получение статистики

```sql
-- Получить всю статистику
SELECT * FROM telegram_stats;

-- Получить статистику за конкретную дату
SELECT * FROM telegram_stats WHERE date = '2025-10-19';

-- Получить статистику за последние 7 дней
SELECT * FROM telegram_stats 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

### Добавление новой записи

```sql
-- Добавить новую запись
INSERT INTO telegram_stats (
    date,
    messages_processed,
    files_downloaded,
    errors_count
) VALUES (
    '2025-10-19',
    3162,
    1132,
    158
);
```

### Обновление существующей записи

```sql
-- Обновить запись за конкретную дату
UPDATE telegram_stats 
SET 
    messages_processed = 3200,
    files_downloaded = 1150,
    errors_count = 150,
    updated_at = NOW()
WHERE date = '2025-10-19';
```

## Скрипты для работы с таблицей

### Получение структуры таблицы

Файл: [src/scripts/show-telegram-stats-structure.ts](file:///c:/Users/Ravva/Fiction-Library/src/scripts/show-telegram-stats-structure.ts)

Показывает структуру таблицы и её содержимое.

Запуск:
```bash
npx tsx src/scripts/show-telegram-stats-structure.ts
```

### Обновление статистики

Файл: [src/scripts/update-telegram-stats-real.ts](file:///c:/Users/Ravva/Fiction-Library/src/scripts/update-telegram-stats-real.ts)

Обновляет статистику в таблице с реальными данными из базы.

Запуск:
```bash
npx tsx src/scripts/update-telegram-stats-real.ts
```

## Поля статистики

- **date**: Дата, за которую собрана статистика
- **messages_processed**: Количество обработанных сообщений из Telegram каналов
- **files_downloaded**: Количество успешно загруженных файлов
- **errors_count**: Количество ошибок, возникших при обработке
- **created_at**: Время создания записи
- **updated_at**: Время последнего обновления записи

## Примеры данных

```
{
  "id": "e54bc609-3091-49f2-a099-bbe4755bbe9a",
  "date": "2025-10-19",
  "messages_processed": 3162,
  "files_downloaded": 1132,
  "errors_count": 158,
  "created_at": "2025-10-19T16:42:44.000Z",
  "updated_at": "2025-10-19T16:42:50.000Z"
}
```

## API endpoints

Статистика также доступна через API endpoints:

- `GET /api/admin/telegram-stats` - Получение последней статистики
- `POST /api/admin/telegram-stats` - Обновление статистики