# Инструкция по синхронизации файлов из Telegram

## Обзор

Эта инструкция описывает, как использовать новую функциональность для синхронизации файлов из приватного канала "Архив для фантастики", загрузки их в бакет books и установки связи с книгами в БД.

## Архитектура

1. **TelegramSyncService** - сервис для работы с Telegram API
2. **Очередь загрузок** - таблица `telegram_download_queue` в БД
3. **DownloadWorker** - worker, который обрабатывает задачи из очереди
4. **API endpoints** - для управления процессом синхронизации

## Использование

### 1. Сканирование канала и добавление файлов в очередь

#### Через API (рекомендуется):
```bash
curl -X POST http://localhost:3000/api/admin/sync-files \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "addToQueue": true}'
```

#### Через скрипт:
```bash
npx tsx src/scripts/sync-archive-files.ts [--limit=N] [--no-queue]
```

### 2. Запуск worker'а для обработки очереди

#### Через скрипт:
```bash
npx tsx src/scripts/start-download-worker.ts
```

Worker будет непрерывно обрабатывать задачи из очереди загрузок:
- Скачивать файлы из Telegram
- Загружать их в Supabase Storage (бакет books)
- Создавать записи в таблице books
- Обновлять статус задач в очереди

### 3. Мониторинг через интерфейс

В админке доступен компонент очереди загрузки с кнопкой "Синхронизировать файлы".

## Конфигурация

Убедитесь, что в .env файлах установлены следующие переменные:

```
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_SESSION=your_session_string
TELEGRAM_FILES_CHANNEL=your_files_channel_url
TELEGRAM_FILES_CHANNEL_HASH=your_files_channel_hash
```

## Решение проблем

### Проблемы с доступом к каналу

1. Убедитесь, что вы являетесь участником канала "Архив для фантастики"
2. Проверьте правильность TELEGRAM_FILES_CHANNEL и TELEGRAM_FILES_CHANNEL_HASH
3. Запустите `npx tsx src/scripts/test-telegram-connection.ts` для проверки подключения

### Проблемы с загрузкой файлов

1. Проверьте логи worker'а
2. Убедитесь, что у service role есть доступ к Supabase Storage
3. Проверьте, что бакет books существует и доступен

## Безопасность

- Все API endpoints защищены проверкой прав администратора
- Worker использует service role для доступа к Supabase
- Не храните чувствительные данные в логах