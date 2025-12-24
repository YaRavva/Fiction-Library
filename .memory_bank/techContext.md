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
```bash
# Telegram API
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_SESSION=your_session_string
TELEGRAM_METADATA_CHANNEL=your_channel_username

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cloud.ru S3
AWS_ACCESS_KEY_ID=your_tenant_id:your_key_id
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ru-central-1
S3_BUCKET_NAME=books

# GitHub Actions (опционально)
BOOKWORM_GITHUB_ACTION_TOKEN=your_github_token
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
- **Стиль**: new-york (shadcn/ui)
- **Темы**: Поддержка светлой и темной тем
- **Кастомные цвета**: Определены в CSS переменных

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