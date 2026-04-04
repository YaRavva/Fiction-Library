# Fiction Library

## Описание

Fiction Library - это веб-приложение электронной библиотеки на `Next.js`, которое объединяет пользовательский каталог книг, админ-панель и инструменты синхронизации контента из Telegram.

Проект ориентирован на два основных сценария:

- читатели просматривают каталог, открывают карточки книг, читают и скачивают файлы;
- администраторы управляют синхронизацией, обработкой файлов, статистикой и фоновыми задачами через встроенные API и админский интерфейс.

## Ключевые возможности

- каталог книг с маршрутами `src/app/library`, `src/app/book/[id]`, `src/app/my-books`, `src/app/reader`;
- аутентификация через Supabase Auth;
- админ-панель в `src/app/admin` для запуска синхронизации и мониторинга;
- интеграция с Telegram через `GramJS` для импорта метаданных и привязки файлов;
- хранение файлов книг и обложек в S3-совместимом хранилище;
- набор служебных скриптов для диагностики, чистки данных и поддержки библиотеки.

## Технологический стек

- `Next.js 16`
- `React 19`
- `TypeScript 5`
- `Tailwind CSS 4`
- `shadcn/ui` со стилем `nova`
- `Supabase` для БД, аутентификации и части серверной логики
- `Cloud.ru S3` / S3-совместимое хранилище для файлов
- `Telegram` (`telegram`, `node-telegram-bot-api`)
- `Biome` для линтинга и форматирования
- `bun` как пакетный менеджер и рантайм для команд проекта

## Быстрый старт

### Установка зависимостей

```powershell
bun install
```

### Запуск в разработке

```powershell
bun run dev
```

### Сборка и запуск production-версии

```powershell
bun run build
bun run start
```

По умолчанию приложение доступно по адресу `http://localhost:3000`.

## Основные команды

### Разработка

```powershell
bun run dev
bun run build
bun run start
```

### Проверка качества кода

```powershell
bun run lint
bun run format
bun run check
```

### Memory Bank

```powershell
bun run memory-bank:update
bun run memory-bank:check
bun run memory-bank:setup-hooks
```

### Запуск TypeScript-скриптов

В проекте нет отдельного npm-скрипта под каждый служебный сценарий. Скрипты из `src/scripts` запускаются напрямую через `bunx tsx`.

```powershell
bunx tsx src/scripts/get-all-metadata.ts
bunx tsx src/scripts/index-telegram-posts.ts
bunx tsx src/scripts/check-book-duplicates.ts
```

Подробный список находится в `src/scripts/README.md`.

## Переменные окружения

Создайте `.env` в корне проекта. Ниже приведены основные переменные, которые реально используются текущим кодом.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Telegram
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION=
TELEGRAM_METADATA_CHANNEL=
TELEGRAM_METADATA_CHANNEL_ID=

# S3 / Cloud.ru
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ru-central-1
S3_BUCKET_NAME=books
S3_COVERS_BUCKET_NAME=covers

# Автоматизация
BOOKWORM_GITHUB_ACTION_TOKEN=
CRON_AUTH_TOKEN=
```

Примечания:

- `TELEGRAM_METADATA_CHANNEL` используется клиентом Telegram для получения канала по ссылке или username.
- `TELEGRAM_METADATA_CHANNEL_ID` используется в части сервисов синхронизации и статистики.
- `S3_COVERS_BUCKET_NAME` нужен для загрузки и переобработки обложек.

## Структура проекта

```text
fiction-library/
|- src/
|  |- app/                  # App Router страницы и API
|  |- components/           # UI и прикладные React-компоненты
|  |- lib/                  # Сервисы, интеграции и бизнес-логика
|  |- scripts/              # Служебные TypeScript-скрипты
|  |- types/                # Общие типы
|  \- middleware.ts         # Middleware для auth / Supabase
|- supabase/                # SQL-миграции, deploy и конфиг
|- docs/                    # Локальная документация по отдельным задачам
|- .memory_bank/            # Живая документация проекта
\- public/                 # Статика
```

## Ключевые маршруты

- `/library` - основной каталог;
- `/book/[id]` - страница книги;
- `/my-books` - пользовательская библиотека;
- `/reader` - страница чтения;
- `/auth/login`, `/auth/register` - аутентификация;
- `/admin` - админ-панель;
- `/api/admin/*` - серверные операции админки;
- `/api/cron/*` - cron-endpoints для автоматизации.

Корневой маршрут `/` сейчас перенаправляет на `/library`.

## Telegram и Book Worm

Интеграция с Telegram сосредоточена в `src/lib/telegram/`.

Основные части:

- `client.ts` - подключение к Telegram и работа с каналами;
- `metadata-service.ts` - импорт и обработка метаданных;
- `file-service.ts` и `file-processing-service*.ts` - обработка файлов книг;
- `book-worm-service.ts` - orchestration-слой для полной и инкрементальной синхронизации.

Синхронизация запускается в основном через API админки:

- `POST /api/admin/book-worm` с `mode: "update"`;
- `POST /api/admin/book-worm/full-sync` для полной синхронизации;
- `GET /api/admin/book-worm/status` для статуса;
- `GET` и `POST /api/admin/book-worm/auto-update` для автообновления.

## Скрипты и обслуживание данных

В `src/scripts/` находятся утилиты для:

- анализа Telegram-метаданных и статистики;
- диагностики состояния базы и файлов;
- дедупликации книг;
- синхронизации и переобработки обложек;
- проверки S3-хранилища и служебной чистки.

Актуальный обзор см. в `src/scripts/README.md`.

## Supabase

Каталог `supabase/` содержит:

- SQL-миграции схемы и политик безопасности;
- оптимизированный набор миграций для начального разворачивания;
- `deploy.sql` и вспомогательные скрипты для применения изменений.

Базовые сведения по настройке есть в `supabase/README.md`.

## Документация

- `.memory_bank/README.md` - обзор системы живой документации;
- `.memory_bank/techContext.md` - актуальный технический контекст;
- `.memory_bank/systemPatterns.md` - архитектурные паттерны;
- `src/lib/telegram/README.md` - детали Telegram-интеграции;
- `src/scripts/README.md` - обзор служебных скриптов.

## Текущее состояние документации

Документация синхронизирована с текущими:

- командами на `bun` вместо `pnpm`;
- зависимостями из `package.json`;
- фактическими маршрутами `src/app`;
- существующими API endpoint-ами и файлами в `src/scripts`.
