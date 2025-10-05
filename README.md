# Fiction Library

## 📖 О проекте

Fiction Library — это веб-приложение электронной библиотеки с интеграцией Telegram для автоматической синхронизации книг. Пользователи могут просматривать каталог книг, читать описания и скачивать файлы. Администраторы управляют контентом через синхронизацию с Telegram каналами.

### Ключевые особенности:
- Автоматическая синхронизация метаданных книг из Telegram канала
- Загрузка обложек и файлов книг
- Удобный каталог с поиском и фильтрацией
- Админ-панель для управления синхронизацией
- Современный UI на базе shadcn/ui

## 🚀 Быстрый старт

```bash
# Установка зависимостей
pnpm install

# Запуск в режиме разработки
pnpm dev

# Сборка для продакшена
pnpm build
```

## 🛠️ Технологический стек

- **Frontend**: Next.js 15.5.4 (TypeScript, React)
- **Стили**: Tailwind CSS
- **UI компоненты**: shadcn/ui (стиль: new-york)
- **Backend**: Supabase (PostgreSQL, Storage, Auth)
- **Интеграция**: Telegram Client API (GramJS)
- **Хостинг**: Vercel (планируется)
- **Пакетный менеджер**: pnpm

## 📋 Основные функции

1. **Аутентификация**: Email/Password через Supabase Auth
2. **Библиотека**: Каталог книг с обложками, поиск, пагинация
3. **Синхронизация**: Автоматическое получение данных из Telegram
4. **Админ-панель**: Управление синхронизацией, мониторинг
5. **Storage**: Хранение обложек и файлов книг в Supabase Storage

## 📚 Документация

Дополнительная документация доступна в папке `/docs`:

- [План разработки](./docs/DEVELOPMENT_PLAN.md)
- [Дневник разработки](./docs/DEVELOPMENT_JOURNAL.md)
- [Руководство администратора](./docs/ADMIN_GUIDE.md)
- [Техническое задание](./docs/PRD.md)
- [Система обработки файлов из Telegram](./docs/FILE_PROCESSING_SYSTEM.md)
- [Алгоритм релевантного поиска](./docs/RELEVANT_SEARCH_ALGORITHM.md)
- [Тестовые скрипты](./docs/TEST_SCRIPTS.md)

## 🔧 Переменные окружения

Для работы приложения необходимо создать файл `.env` со следующими переменными:

```env
# Telegram
TELEGRAM_API_ID=...
TELEGRAM_API_HASH=...
TELEGRAM_SESSION=...
TELEGRAM_METADATA_CHANNEL=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 📝 Лицензия

MIT

