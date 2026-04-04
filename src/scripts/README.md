# Служебные скрипты проекта

В каталоге `src/scripts` находятся одноразовые и операционные TypeScript-скрипты для поддержки библиотеки, Telegram-интеграции, S3 и данных Supabase.

Все скрипты запускаются напрямую через `bunx tsx`.

```powershell
bunx tsx src/scripts/<script-name>.ts
```

## Основные группы

### Telegram и метаданные

- `get-all-metadata.ts` - выгрузка метаданных из Telegram;
- `index-telegram-posts.ts` - запуск индексирования постов Telegram;
- `analyze-processed-messages.ts` - анализ обработанных сообщений;
- `get-telegram-stats.ts` - чтение статистики Telegram;
- `get-current-stats.ts` - быстрый срез текущих метрик;
- `update-telegram-stats-simple.ts` - упрощенное обновление статистики;
- `update-telegram-stats-real.ts` - обновление статистики на основе реальных данных;
- `check-telegram-stats-table.ts` - проверка структуры таблицы статистики;
- `show-telegram-stats-structure.ts` - вывод структуры статистических данных.

### Книги, дедупликация и качество данных

- `check-book-duplicates.ts` - проверка дубликатов книг;
- `find-book-duplicates.ts` - поиск потенциальных дублей;
- `remove-book-duplicates.ts` - удаление/слияние дублей;
- `recover-series-books.ts` - восстановление связей по сериям;
- `add_book_metadata.ts` - добавление или переобработка метаданных;
- `cleanup-empty-metadata-books.ts` - чистка книг с пустыми метаданными;
- `clear-empty-channel-messages.ts` - чистка пустых сообщений канала;
- `clear-telegram-file-id.ts` - сброс `telegram_file_id` в служебных сценариях.

### Проверки содержимого библиотеки

- `count-total-books.ts` - подсчет общего числа книг;
- `count-unique-books.ts` - подсчет уникальных книг;
- `count-books-without-covers.ts` - книги без обложек;
- `check-book-record.ts` - просмотр конкретной записи книги;
- `check-book-filename.ts` - проверка имени файла книги;
- `check-books-covers.ts` - проверка состояния обложек;
- `check-real-books.ts` - проверка реального набора данных в библиотеке;
- `check-all-stats.ts` - агрегированная проверка статистики;
- `check-stats-data.ts` - диагностика данных статистики.

### S3 и файловое хранилище

- `test-s3-connection.ts` - проверка подключения к S3;
- `check-storage-buckets.ts` - проверка доступности бакетов;
- `analyze-s3-storage.ts` - анализ содержимого хранилища;
- `cleanup-s3-storage.ts` - чистка неконсистентных объектов;
- `cleanup-incorrect-file.ts` - удаление/починка неверно привязанных файлов;
- `clear_covers_bucket.ts` - очистка бакета обложек;
- `reupload_covers.ts` - повторная загрузка обложек;
- `sync-missing-covers.ts` - догрузка отсутствующих обложек.

### Технические и отладочные

- `check_and_create_tables.ts` - проверка и создание служебных таблиц;
- `temp-matcher.ts` - временный сценарий для тестирования алгоритма сопоставления.

## Примеры запуска

```powershell
# Получить метаданные из Telegram
bunx tsx src/scripts/get-all-metadata.ts

# Проверить дубликаты книг
bunx tsx src/scripts/check-book-duplicates.ts

# Проверить подключение к S3
bunx tsx src/scripts/test-s3-connection.ts

# Догрузить отсутствующие обложки
bunx tsx src/scripts/sync-missing-covers.ts
```

## Требования к окружению

Большинство скриптов используют `.env` из корня проекта. Минимальный набор зависит от сценария:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_SESSION`
- `TELEGRAM_METADATA_CHANNEL`
- `TELEGRAM_METADATA_CHANNEL_ID`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `S3_COVERS_BUCKET_NAME`

## Замечания

- Скрипты в этой папке не покрыты единым CLI-слоем. Перед запуском полезно открыть конкретный файл и проверить ожидаемые аргументы.
- Часть скриптов предназначена для ручного обслуживания production-данных, поэтому запускать их лучше осознанно и на актуальной резервной копии базы.
