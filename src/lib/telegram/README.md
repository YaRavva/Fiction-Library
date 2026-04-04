# Telegram integration

Этот каталог содержит основную интеграцию проекта с Telegram и orchestration-логику сервиса `Book Worm`.

## Состав каталога

- `client.ts` - singleton-клиент `GramJS`, подключение и доступ к каналам;
- `metadata-service.ts` - импорт и обработка метаданных книг;
- `metadata-extraction-service.ts` - извлечение структурированных данных из сообщений;
- `file-service.ts` - фасад для обработки файлов книг;
- `file-processing-service.ts` - базовая обработка файлов;
- `file-processing-service-enhanced.ts` - расширенная обработка и привязка файлов;
- `book-worm-service.ts` - сервис полной и инкрементальной синхронизации;
- `sync.ts` - синхронизационные сценарии поверх Telegram и Supabase;
- `update-stats.ts` - обновление статистики Telegram;
- `parser.ts` - парсер метаданных сообщений;
- `utils/` - вспомогательные утилиты.

## Основные переменные окружения

```env
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION=
TELEGRAM_METADATA_CHANNEL=
TELEGRAM_METADATA_CHANNEL_ID=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ru-central-1
S3_BUCKET_NAME=books
S3_COVERS_BUCKET_NAME=covers
```

## Как устроена синхронизация

### 1. Подключение к Telegram

`TelegramService` из `client.ts` поднимает единый клиент и переиспользует соединение между вызовами.

Клиент использует:

- `TELEGRAM_METADATA_CHANNEL` для получения сущности канала по ссылке или username;
- `TELEGRAM_METADATA_CHANNEL_ID` в сервисах, где нужен явный идентификатор канала для логирования и запросов.

### 2. Импорт метаданных

`TelegramMetadataService`:

- читает сообщения канала;
- извлекает название, автора, описание и дополнительные поля;
- записывает новые или обновляет существующие книги в Supabase;
- обрабатывает обложки и складывает их в `S3_COVERS_BUCKET_NAME`.

### 3. Обработка файлов книг

`TelegramFileService` и `file-processing-service*.ts`:

- получают список файлов из Telegram;
- извлекают имя файла и дополнительные признаки;
- ищут подходящую книгу в базе;
- загружают файл в `S3_BUCKET_NAME`;
- сохраняют связь книги и файла в БД.

### 4. Book Worm

`BookWormService` объединяет импорт метаданных и привязку файлов.

Поддерживаемые сценарии на уровне приложения:

- update sync - инкрементальная синхронизация новых данных;
- full sync - полная повторная синхронизация;
- index/full processing через административные endpoint-ы.

## Актуальные точки входа

Сейчас Book Worm запускается преимущественно через API админки, а не через набор отдельных CLI-команд из старой документации.

### Административные endpoint-ы

- `POST /api/admin/book-worm`
  - принимает `mode: "update" | "index" | "full"`;
  - `full` перенаправляет на выделенный endpoint;
  - `update` выполняет синхронизацию в рамках запроса.

- `POST /api/admin/book-worm/full-sync`
  - запускает полную синхронизацию;
  - возвращает статус запуска сразу, обработка продолжается асинхронно.

- `GET /api/admin/book-worm/status`
  - отдает статус последней синхронизации по данным БД.

- `GET /api/admin/book-worm/auto-update`
  - возвращает настройки автообновления.

- `POST /api/admin/book-worm/auto-update`
  - запускает проверку необходимости автообновления;
  - поддерживает доступ как от администратора, так и от GitHub Actions через `BOOKWORM_GITHUB_ACTION_TOKEN`.

## Важные таблицы и поля

По текущей документации и коду используются следующие сущности:

- `books` - основная библиотека;
- `telegram_processed_messages` - отслеживание обработанных сообщений;
- `auto_update_settings` - настройки автообновления;
- `user_profiles` - роли пользователей, включая `admin`.

В коде встречаются поля:

- `books.telegram_post_id`
- `books.telegram_file_id`
- `books.file_url`
- `telegram_processed_messages.processed_at`

## Практические замечания

- Старые инструкции с командами вида `npx tsx src/scripts/run-book-worm.ts` больше не отражают текущее состояние каталога `src/scripts`.
- Для ручной диагностики используйте скрипты из `src/scripts`, а для штатной синхронизации - админку и `src/app/api/admin/book-worm/*`.
- Если нужен запуск по расписанию, в проекте уже есть cron-endpoint-ы в `src/app/api/cron` и GitHub Actions workflow в `.github/workflows/`.
