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

### 4. Применение миграций
В Supabase Dashboard → SQL Editor выполните миграции по порядку:

1. **001_initial_schema.sql** - Основная схема БД
2. **002_security_policies.sql** - Политики безопасности (RLS)
3. **003_utility_functions.sql** - Полезные функции
4. **004_sample_data.sql** - Тестовые данные (опционально)

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
4. ⏳ Настроить Next.js интеграцию
5. ⏳ Реализовать Telegram интеграцию