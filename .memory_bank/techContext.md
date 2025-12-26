# Технический Контекст: Fiction Library

## Языки программирования и версии

### Основной стек
- **TypeScript**: ^5.0 (строгая типизация, современный синтаксис)
- **JavaScript**: ES2022+ (для скриптов и конфигурации)
- **SQL**: PostgreSQL диалект (для миграций и запросов)

### Версии Node.js
- **Минимальная**: Node.js 18.17.0
- **Рекомендуемая**: Node.js 20.x LTS
- **Максимальная**: Node.js 21.x

## Фреймворки и основные зависимости

### Frontend Framework
```json
{
  "next": "15.5.9",
  "react": "19.1.0",
  "react-dom": "19.1.0"
}
```

### UI и Стилизация
```json
{
  "tailwindcss": "^4",
  "@tailwindcss/postcss": "^4",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.3.1",
  "next-themes": "^0.4.6"
}
```

**shadcn/ui конфигурация** (`components.json`):
- **Style**: nova (более мягкие углы и тени)
- **Base Color**: stone (теплый серый)
- **Theme**: amber (accent цвет - золотисто-оранжевый)
- **Icon Library**: phosphor (для новых компонентов через CLI)
- **Font**: Figtree (Google Fonts через Next.js font optimization)
- **Radius**: default (0.5rem)
- **CSS Variables**: OKLCH цветовое пространство

### UI Компоненты (Radix UI + shadcn/ui)
```json
{
  "@radix-ui/react-avatar": "^1.1.10",
  "@radix-ui/react-checkbox": "^1.3.3",
  "@radix-ui/react-collapsible": "^1.1.1",
  "@radix-ui/react-dropdown-menu": "^2.1.16",
  "@radix-ui/react-label": "^2.1.7",
  "@radix-ui/react-progress": "^1.1.7",
  "@radix-ui/react-select": "^2.2.6",
  "@radix-ui/react-separator": "^1.1.7",
  "@radix-ui/react-slot": "^1.2.3",
  "@radix-ui/react-tooltip": "^1.2.8"
}
```

### База данных и Backend
```json
{
  "@supabase/supabase-js": "^2.58.0",
  "@supabase/ssr": "^0.7.0",
  "@supabase/auth-ui-react": "^0.4.7",
  "@supabase/auth-ui-shared": "^0.1.8"
}
```

### Облачное хранилище (AWS S3 Compatible)
```json
{
  "@aws-sdk/client-s3": "^3.908.0",
  "@aws-sdk/credential-providers": "^3.908.0",
  "@aws-sdk/s3-request-presigner": "^3.913.0",
  "@aws-sdk/types": "^3.901.0",
  "@smithy/node-http-handler": "^4.4.0"
}
```

### Telegram интеграция
```json
{
  "telegram": "^2.26.22",
  "node-telegram-bot-api": "^0.66.0",
  "big-integer": "^1.6.52"
}
```

### Утилиты и обработка данных
```json
{
  "@tanstack/react-table": "^8.21.3",
  "jszip": "^3.10.1",
  "lucide-react": "^0.544.0"
}
```

**Примечание**: В проекте используются иконки из `lucide-react`. Параметр `iconLibrary: phosphor` в `components.json` влияет только на новые компоненты, добавляемые через CLI `shadcn`.

## Конфигурация баз данных

### Supabase PostgreSQL
- **Версия**: PostgreSQL 15+
- **Расширения**: 
  - `uuid-ossp` (для UUID генерации)
  - `pg_trgm` (для полнотекстового поиска)
  - `btree_gin` (для составных индексов)

### Основные таблицы
```sql
-- Книги
books (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  series TEXT,
  series_number INTEGER,
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Файлы книг
book_files (
  id UUID PRIMARY KEY,
  book_id UUID REFERENCES books(id),
  filename TEXT NOT NULL,
  file_size BIGINT,
  file_format TEXT,
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Очередь загрузок
download_queue (
  id UUID PRIMARY KEY,
  book_id UUID REFERENCES books(id),
  status TEXT DEFAULT 'pending',
  telegram_message_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
)

-- Статистика Telegram
telegram_stats (
  id UUID PRIMARY KEY,
  messages_processed INTEGER DEFAULT 0,
  files_downloaded INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  files_without_metadata INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

## Внешние сервисы

### Cloud.ru S3 Storage
- **Endpoint**: `https://s3.cloud.ru`
- **Region**: `ru-central-1`
- **Bucket**: `books` (настраивается через переменные окружения)
- **Аутентификация**: Access Key + Secret Key

### Telegram API
- **API ID/Hash**: Получается через https://my.telegram.org
- **Session**: Строка сессии для авторизации
- **Каналы**: 
  - Публичные каналы для метаданных
  - Приватные архивы для файлов

### GitHub Actions (для автоматизации)
- **Webhook**: Для запуска синхронизации по расписанию
- **Token**: Personal Access Token для API вызовов

## Особенности локального окружения

### Переменные окружения (.env)

#### Обязательные переменные для развертывания
```bash
# Конфигурация Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Дополнительные Supabase переменные для развертывания
SUPABASE_PROJECT_ID=your_project_id
SUPABASE_ACCESS_TOKEN=your_access_token
SUPABASE_JWT_SECRET=your_jwt_secret

# Cloud.ru S3 Storage
AWS_ACCESS_KEY_ID=your_tenant_id:your_key_id
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ru-central-1
S3_BUCKET_NAME=books
```

#### Опциональные переменные для Telegram интеграции
```bash
# Telegram API (для синхронизации)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_SESSION=your_session_string
TELEGRAM_METADATA_CHANNEL_ID=your_metadata_channel_id
TELEGRAM_FILES_CHANNEL_ID=your_files_channel_id

# Telegram Bot (альтернативный способ)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=your_channel_id
```

#### Дополнительные переменные
```bash
# GitHub Actions (для автоматизации)
BOOKWORM_GITHUB_ACTION_TOKEN=your_github_token

# Cron авторизация (для защиты endpoints)
CRON_AUTH_TOKEN=your_cron_token
```

### Пример файла .env.local
```env
# Конфигурация Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Интеграция с Telegram (Опционально)
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_CHANNEL_ID=
```

### Безопасность переменных окружения
- **Никогда не коммитьте** чувствительные ключи в систему контроля версий
- **Регулярно меняйте ключи** доступа для повышения безопасности
- **Используйте разные ключи** для разных окружений (development/staging/production)
- **Ограничьте доступ** к переменным окружения в продакшене
- **Используйте принцип минимальных привилегий** для всех API ключей

## Развертывание и деплой

### Платформа развертывания: Vercel

#### Подготовка к деплою
1. **Переменные окружения**: Установить все необходимые переменные в настройках проекта Vercel
2. **Конфигурация Supabase**: Убедиться в правильной настройке базы данных и Storage
3. **Настройки проекта**: Проверить корректность конфигурации

#### Настройки проекта Vercel
- **Framework Preset**: Next.js
- **Build Command**: `next build`
- **Output Directory**: `.next`
- **Install Command**: `pnpm install`
- **Node.js Version**: 18.x (рекомендуется)

#### Автоматический деплой через GitHub
1. Подключить репозиторий к Vercel
2. Выбрать правильную корневую директорию
3. Установить переменные окружения в настройках проекта
4. Настроить автоматический деплой при push в main ветку

#### Ручной деплой через CLI
```bash
# Установить Vercel CLI
npm install -g vercel

# Авторизоваться
vercel login

# Деплой в production
vercel --prod

# Деплой в preview
vercel
```

### Альтернативные способы развертывания

#### Самостоятельный хостинг на Node.js
```bash
# Сборка проекта
pnpm build

# Запуск в production режиме
pnpm start

# Или с PM2 для production
pm2 start ecosystem.config.js
```

#### Docker развертывание
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Процесс развертывания Supabase

#### Создание нового проекта Supabase
```bash
# Установить Supabase CLI
npm install -g supabase

# Инициализация проекта
supabase init

# Запуск локально для разработки
supabase start

# Деплой в production
supabase db push
```

#### Настройка базы данных
1. Создать необходимые таблицы через миграции
2. Настроить Row Level Security (RLS) политики
3. Создать Storage buckets для файлов
4. Настроить функции и триггеры

### Мониторинг после деплоя

#### Проверка работоспособности
1. **Главная страница**: Проверить загрузку и отображение
2. **Аутентификация**: Тестировать вход и регистрацию
3. **API endpoints**: Проверить доступность всех API маршрутов
4. **База данных**: Убедиться в корректном подключении к Supabase
5. **Файловое хранилище**: Проверить загрузку и отображение изображений

#### Инструменты мониторинга Vercel
- **Analytics**: Отслеживание посещаемости и производительности
- **Logs**: Просмотр логов выполнения функций
- **Performance Monitoring**: Мониторинг Web Vitals и времени загрузки
- **Error Tracking**: Автоматическое отслеживание ошибок

### Решение проблем при деплое

#### Частые ошибки
1. **Environment Variables**: Проверить правильность установки всех переменных
2. **Supabase Connection**: Убедиться в корректности URL и ключей
3. **Build Errors**: Проверить логи сборки на наличие ошибок TypeScript
4. **CORS Issues**: Настроить правильные домены в Supabase
5. **Image Optimization**: Добавить домены в next.config.ts

#### Отладка
```bash
# Локальная проверка сборки
pnpm build

# Проверка типов TypeScript
pnpm type-check

# Линтинг кода
pnpm lint

# Проверка переменных окружения
vercel env ls
```
```

### Пакетный менеджер
- **Основной**: pnpm (workspace поддержка)
- **Альтернативы**: npm, yarn (совместимость сохранена)
- **Workspace**: Настроен через `pnpm-workspace.yaml`

### Инструменты разработки
```json
{
  "eslint": "^9",
  "eslint-config-next": "15.5.7",
  "typescript": "^5",
  "tsx": "^4.20.6",
  "cross-env": "^10.1.0",
  "dotenv": "^17.2.3"
}
```

### Сборка и развертывание
- **Development**: `pnpm dev` (Turbopack для быстрой сборки)
- **Production**: `pnpm build && pnpm start`
- **Платформы**: Vercel, самостоятельный хостинг на Node.js

## Ограничения и требования

### Производительность
- **Размер бандла**: < 1MB для основного чанка
- **Время сборки**: < 2 минут для полной сборки
- **Memory usage**: < 512MB для Node.js процесса

### Совместимость браузеров
- **Минимальные версии**:
  - Chrome 90+
  - Firefox 88+
  - Safari 14+
  - Edge 90+

### Файловые ограничения
- **Максимальный размер файла**: 100MB
- **Поддерживаемые форматы**: FB2, ZIP, PDF, EPUB, TXT
- **Кодировка**: UTF-8 для всех текстовых файлов

### Безопасность
- **HTTPS**: Обязательно для продакшена
- **CSP**: Content Security Policy настроен в next.config.ts
- **CORS**: Ограничен доменами проекта

## Специфические конфигурации

### Next.js конфигурация (next.config.ts)
```typescript
const nextConfig = {
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  images: {
    domains: ['supabase.co', 's3.cloud.ru'],
  },
}
```

### TypeScript конфигурация (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Tailwind конфигурация
- **Стиль**: nova (shadcn/ui)
- **Base Color**: stone (теплый серый)
- **Accent Theme**: amber (золотисто-оранжевый)
- **Шрифт**: Figtree (Google Fonts)
- **Темы**: Поддержка светлой и темной тем
- **Кастомные цвета**: Определены в CSS переменных (OKLCH цветовое пространство)

## Мониторинг и логирование

### Логирование
- **Уровни**: ERROR, WARN, INFO, DEBUG
- **Формат**: JSON для структурированных логов
- **Ротация**: По размеру файла (10MB) и времени (7 дней)

### Метрики
- **Performance**: Web Vitals через Next.js
- **Errors**: Автоматический сбор ошибок JavaScript
- **API**: Время ответа и статус коды

### Мониторинг здоровья системы
- **Health check**: `/api/health` endpoint
- **Database**: Проверка подключения к Supabase
- **Storage**: Проверка доступности S3
- **Telegram**: Проверка API соединения