# Supabase Configuration для Fiction Library

## 🚀 Быстрая настройка

### 1. Создание проекта в Supabase
1. Перейдите на [supabase.com](https://supabase.com)
2. Создайте новый проект
3. Выберите регион (рекомендуется ближайший к пользователям)
4. Дождитесь завершения создания проекта

### 2. Получение credentials
После создания проекта в разделе Settings → API:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **Anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
- **Service role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Обновление .env файла
Замените заглушки в `.env` файле на реальные значения:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 4. Применение миграций в облачной Supabase
В Supabase Dashboard → SQL Editor выполните миграции по порядку:

**Шаг 1:** Скопируйте и выполните `001_initial_schema.sql`
- Создает основные таблицы (series, books, user_profiles, etc.)
- Настраивает индексы для производительности
- Добавляет триггеры для обновления timestamp'ов

**Шаг 2:** Скопируйте и выполните `002_security_policies.sql`
- Включает Row Level Security (RLS)
- Настраивает политики доступа
- Создает функцию автоматического создания профиля при регистрации

**Шаг 3:** Скопируйте и выполните `003_utility_functions.sql`
- Добавляет функции для поиска и статистики
- Создает RPC функции для клиентского вызова
- Настраивает рекомендательную систему

**Шаг 4:** (Опционально) Выполните `004_sample_data.sql`
- Добавляет тестовые книги и серии
- Полезно для проверки работоспособности

## 📋 Структура базы данных

### Основные таблицы:
- **series** - Циклы книг
- **books** - Отдельные книги
- **user_profiles** - Профили пользователей
- **user_books** - Избранные книги пользователей
- **reading_history** - История чтения
- **user_bookmarks** - Закладки
- **user_ratings** - Оценки и отзывы

### Ключевые функции:
- `search_content()` - Полнотекстовый поиск
- `get_book_recommendations()` - Рекомендации книг
- `get_user_reading_stats()` - Статистика чтения
- `get_popular_books()` - Популярные книги

## 🔒 Безопасность

### Row Level Security (RLS):
- ✅ Включен для всех таблиц
- ✅ Пользователи видят только свои данные
- ✅ Публичный контент (книги/серии) доступен всем
- ✅ Админы имеют права на управление контентом

### Роли пользователей:
- **reader** - Обычный пользователь (по умолчанию)
- **admin** - Администратор (может управлять книгами)

## 📚 Storage настройка

Для файлов книг создайте bucket в Storage:
1. Перейдите в Storage → Create bucket
2. Название: `books`
3. Настройте политики доступа:
   - Публичное чтение файлов
   - Загрузка только для админов

## 🧪 Тестирование

После применения миграций можно:
- Проверить созданные таблицы в Table Editor
- Протестировать функции в SQL Editor
- Создать тестового пользователя через Authentication

## 📝 Следующие шаги

1. ✅ Создать проект Supabase
2. ✅ Обновить .env файл
3. ✅ Применить миграции
4. ✅ Настроить Next.js интеграцию
5. ✅ Создать страницы аутентификации
6. ✅ Реализовать основной интерфейс библиотеки
7. ✅ Настроить Telegram интеграцию для загрузки книг
8. ✅ Настроить Supabase Storage для хранения файлов
9. ⏳ Создать админ-панель для управления контентом
10. ⏳ Добавить FB2 reader компонент

## 📦 Настройка Storage

Для хранения файлов книг используется Supabase Storage с приватным bucket.

**Быстрый старт (5 минут):** См. [docs/quick-start-storage.md](../docs/quick-start-storage.md)

**Подробная инструкция:** См. [docs/storage-setup.md](../docs/storage-setup.md)

### Основные компоненты:

- **Bucket**: `books` (приватный)
- **Worker**: `src/lib/telegram/worker.ts` - загружает файлы из Telegram
- **API**: `/api/admin/download-url` - генерирует signed URLs
- **Queue**: `telegram_download_queue` - управляет очередью загрузок