# Технический контекст: Fiction Library

## Основной стек

### Runtime и язык

- `bun@1.3.1` - пакетный менеджер и runtime проекта;
- `TypeScript 5` - основной язык приложения и скриптов;
- `SQL / PostgreSQL` - миграции и запросы Supabase.

### Frontend

- `next@^16.1.4`
- `react@^19.2.3`
- `react-dom@^19.2.3`
- App Router структура в `src/app`

### UI и стили

- `tailwindcss@4`
- `@tailwindcss/postcss@4`
- `next-themes@^0.4.6`
- `class-variance-authority@^0.7.1`
- `clsx@^2.1.1`
- `tailwind-merge@^3.3.1`
- `lucide-react@^0.544.0`
- `framer-motion@^12.23.26`
- `motion@^12.23.26`

### Shadcn-конфигурация

Файл `components.json`:

- `style`: `nova`
- `baseColor`: `stone`
- `iconLibrary`: `phosphor`
- `css`: `src/app/globals.css`
- `rsc`: `true`
- `tsx`: `true`

### Backend и данные

- `@supabase/supabase-js@^2.58.0`
- `@supabase/ssr@^0.7.0`
- `@supabase/auth-ui-react@^0.4.7`
- `@supabase/auth-ui-shared@^0.1.8`

### Telegram и файлы

- `telegram@^2.26.22`
- `node-telegram-bot-api@^0.67.0`
- `big-integer@^1.6.52`
- AWS SDK v3 для S3-совместимого хранилища

### Инструменты качества

- `@biomejs/biome@^2.3.11`
- форматирование и lint выполняются через `Biome`

## Команды проекта

Команды определены в `package.json`:

```powershell
bun run dev
bun run build
bun run start
bun run lint
bun run format
bun run check
bun run memory-bank:update
bun run memory-bank:check
bun run memory-bank:setup-hooks
```

Для ad-hoc TypeScript-скриптов используется `bunx tsx`.

```powershell
bunx tsx src/scripts/get-all-metadata.ts
```

## Структура приложения

### Пользовательские маршруты

- `/library`
- `/book/[id]`
- `/my-books`
- `/reader`
- `/auth/login`
- `/auth/register`
- `/auth/reset-password`
- `/auth/verify-email`

### Административные маршруты

- `/admin`
- `/api/admin/book-worm/*`
- `/api/admin/sync*`
- `/api/admin/duplicates*`
- `/api/admin/file-search*`
- `/api/admin/telegram-files*`

### Cron и сервисные endpoint-ы

- `/api/cron/download-files`
- `/api/cron/deduplicate`
- `/api/download/[bookId]`
- `/api/reader/[bookId]`
- `/api/cloud-ru-download`

## Инфраструктура данных

### Supabase

Используется для:

- таблиц библиотеки;
- пользовательских профилей и ролей;
- аутентификации;
- части административных операций.

Каталог `supabase/` содержит:

- `migrations/` - исторические миграции;
- `migrations_optimized/` - сокращенный набор для начального разворачивания;
- `deploy.sql` - сводный SQL для деплоя;
- `config.toml` - конфигурацию проекта Supabase.

### S3 / Cloud.ru

S3-совместимое хранилище используется для:

- файлов книг через `S3_BUCKET_NAME`;
- обложек через `S3_COVERS_BUCKET_NAME`.

### Telegram

Telegram-интеграция реализована в `src/lib/telegram/`.

Ключевые сервисы:

- `TelegramService`
- `TelegramMetadataService`
- `TelegramFileService`
- `BookWormService`

## Переменные окружения

### Обязательные для локального запуска приложения

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Для Telegram-синхронизации

```env
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION=
TELEGRAM_METADATA_CHANNEL=
TELEGRAM_METADATA_CHANNEL_ID=
```

### Для S3-хранилища

```env
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ru-central-1
S3_BUCKET_NAME=books
S3_COVERS_BUCKET_NAME=covers
```

### Для автоматизации

```env
BOOKWORM_GITHUB_ACTION_TOKEN=
CRON_AUTH_TOKEN=
```

## Развертывание

Актуальная документация репозитория предполагает два основных сценария:

- локальная разработка и запуск через `bun`;
- deployment Next.js-приложения на совместимую платформу с поддержкой environment variables и server routes.

При любом деплое нужно обеспечить:

- переменные Supabase;
- доступ к Telegram для сервисов синхронизации;
- доступ к S3-совместимому хранилищу;
- секреты для cron / GitHub automation при использовании автообновления.

## Ограничения и наблюдения

- документация должна опираться на `package.json`, а не на исторические инструкции;
- в проекте есть много операционных скриптов без единого CLI-фасада, поэтому документацию по ним нужно поддерживать вручную;
- часть исторических документов и `_old/` содержит устаревшие реализации и не должна считаться источником актуального состояния.
