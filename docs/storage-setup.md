# 📦 Настройка Supabase Storage для Fiction Library

## Обзор

Этот документ описывает настройку Supabase Storage для хранения файлов книг (FB2) с использованием приватного bucket и signed URLs для безопасного доступа.

---

## 🎯 Архитектура хранения

### Компоненты системы:

1. **Supabase Storage Bucket** (`books`) - приватное хранилище файлов
2. **Worker** (`src/lib/telegram/worker.ts`) - загружает файлы из Telegram в Storage
3. **API Endpoint** (`/api/admin/download-url`) - генерирует временные signed URLs
4. **Download Queue** (`download_queue` table) - отслеживает статус загрузок

### Поток данных:

```
Telegram → Worker → Supabase Storage (private bucket)
                          ↓
                    storage_path сохраняется в БД
                          ↓
                    API генерирует signed URL
                          ↓
                    Пользователь скачивает файл
```

---

## 🚀 Шаг 1: Создание Bucket в Supabase

### Через Supabase Dashboard:

1. Откройте ваш проект в [Supabase Dashboard](https://app.supabase.com)
2. Перейдите в **Storage** → **Buckets**
3. Нажмите **New Bucket**
4. Заполните форму:
   - **Name**: `books`
   - **Public bucket**: ❌ **ОТКЛЮЧЕНО** (важно для безопасности!)
   - **File size limit**: `50 MB` (или больше, если нужно)
   - **Allowed MIME types**: оставьте пустым или укажите `application/octet-stream, application/x-fictionbook+xml`
5. Нажмите **Create bucket**

### Через SQL (альтернатива):

```sql
-- Создание bucket через SQL
INSERT INTO storage.buckets (id, name, public)
VALUES ('books', 'books', false);
```

---

## 🔒 Шаг 2: Настройка RLS политик для Storage

Приватный bucket требует настройки Row Level Security (RLS) политик для контроля доступа.

### Политика 1: Разрешить service role полный доступ

```sql
-- Разрешаем service role (серверу) загружать файлы
CREATE POLICY "Service role can upload files"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'books');

-- Разрешаем service role читать файлы
CREATE POLICY "Service role can read files"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'books');

-- Разрешаем service role обновлять файлы
CREATE POLICY "Service role can update files"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'books');

-- Разрешаем service role удалять файлы
CREATE POLICY "Service role can delete files"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'books');
```

### Политика 2: Запретить публичный доступ

```sql
-- Убедитесь, что анонимные пользователи НЕ могут читать файлы напрямую
-- (доступ только через signed URLs)
-- Эта политика уже применяется по умолчанию для приватных buckets
```

### Применение политик:

1. Откройте **Storage** → **Policies** в Supabase Dashboard
2. Выберите bucket `books`
3. Добавьте политики выше через **New Policy** → **Custom Policy**

---

## 🔑 Шаг 3: Настройка переменных окружения

Убедитесь, что в вашем `.env` файле есть следующие переменные:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# ⚠️ ВАЖНО: Service Role Key - только для сервера!
# НЕ КОММИТЬТЕ этот ключ в репозиторий!
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Storage Configuration
SUPABASE_STORAGE_BUCKET=books

# Telegram Configuration (для worker)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_SESSION=your_session_string
```

### Где найти ключи:

1. **SUPABASE_URL** и **ANON_KEY**: Settings → API → Project URL / anon public
2. **SERVICE_ROLE_KEY**: Settings → API → service_role key (⚠️ секретный!)

---

## 🛠️ Шаг 4: Применение миграций

Примените миграцию для создания таблиц очереди и RPC функций:

```bash
# В Supabase Dashboard → SQL Editor
# Выполните файл: supabase/migrations/005_create_telegram_queue.sql
```

Или через Supabase CLI:

```bash
supabase db push
```

---

## 📝 Шаг 5: Использование API

### Генерация signed URL для скачивания:

```typescript
// Пример запроса к API
const response = await fetch('/api/admin/download-url?bookId=<uuid>&expiresIn=3600', {
  headers: {
    'Authorization': `Bearer ${userToken}`,
  },
});

const data = await response.json();
// {
//   url: "https://...supabase.co/storage/v1/object/sign/books/...",
//   expiresAt: "2025-10-02T12:00:00.000Z",
//   storagePath: "book_123.fb2"
// }
```

### Параметры API:

- `bookId` (UUID) - ID книги из таблицы `books`
- `taskId` (UUID) - ID задачи из таблицы `download_queue` (альтернатива bookId)
- `expiresIn` (number) - время жизни URL в секундах (по умолчанию 3600 = 1 час)

### Требования:

- Пользователь должен быть аутентифицирован
- Пользователь должен иметь роль `admin` в таблице `user_profiles`

---

## 🔄 Шаг 6: Запуск Worker

Worker автоматически обрабатывает очередь загрузок из Telegram:

```typescript
import { DownloadWorker } from '@/lib/telegram/worker';

// Создаем и запускаем worker
const worker = new DownloadWorker();
await worker.start();

// Проверяем статус
const status = worker.getStatus();
console.log('Worker running:', status.isRunning);

// Останавливаем worker
worker.stop();
```

### Как работает Worker:

1. Получает задачу из очереди (`telegram_download_queue`)
2. Скачивает файл из Telegram
3. Загружает файл в Supabase Storage (bucket `books`)
4. Сохраняет `storage_path` в таблице `download_queue`
5. Обновляет статус книги в таблице `books` (если есть `book_id`)
6. Помечает задачу как `done` или `error`

---

## 🧪 Шаг 7: Тестирование

### Проверка загрузки файла:

```typescript
import { DownloadQueue } from '@/lib/telegram/queue';

const queue = new DownloadQueue();

// Добавляем задачу в очередь
await queue.addTask({
  message_id: 'test_message_123',
  channel_id: 'test_channel',
  file_id: 'telegram_file_id',
  priority: 1,
});

// Проверяем статистику
const stats = await queue.getQueueStats();
console.log('Pending tasks:', stats.pending);
```

### Проверка signed URL:

```bash
# Через curl (замените токен и bookId)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/admin/download-url?bookId=YOUR_BOOK_UUID"
```

---

## 🔐 Безопасность

### ✅ Рекомендации:

1. **Никогда не храните `SUPABASE_SERVICE_ROLE_KEY` в клиентском коде**
2. **Используйте signed URLs** вместо публичных ссылок
3. **Ограничьте время жизни signed URLs** (рекомендуется 1-24 часа)
4. **Проверяйте права доступа** перед генерацией signed URLs
5. **Логируйте все операции** с файлами для аудита

### ❌ Чего избегать:

- ❌ Не делайте bucket публичным
- ❌ Не передавайте service role key в frontend
- ❌ Не создавайте signed URLs с бесконечным сроком действия
- ❌ Не храните чувствительные данные в именах файлов

---

## 🧹 Шаг 8: Очистка старых файлов (опционально)

Создайте SQL функцию для автоматической очистки:

```sql
-- Функция для удаления файлов старше 30 дней
CREATE OR REPLACE FUNCTION cleanup_old_files()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Удаляем записи из download_queue
  DELETE FROM download_queue
  WHERE status = 'done'
    AND updated_at < now() - interval '30 days';
  
  -- TODO: Удалить файлы из Storage через API
END;
$$;

-- Создаем cron job (требуется pg_cron extension)
SELECT cron.schedule(
  'cleanup-old-files',
  '0 2 * * *', -- каждый день в 2:00
  'SELECT cleanup_old_files();'
);
```

---

## 📊 Мониторинг

### Проверка размера bucket:

```sql
-- Общий размер файлов в bucket
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as total_size
FROM storage.objects
WHERE bucket_id = 'books'
GROUP BY bucket_id;
```

### Статистика очереди:

```sql
-- Статус задач в очереди
SELECT 
  status,
  COUNT(*) as count
FROM telegram_download_queue
GROUP BY status;
```

---

## 🆘 Troubleshooting

### Проблема: "Failed to upload file"

**Решение:**
- Проверьте, что `SUPABASE_SERVICE_ROLE_KEY` установлен правильно
- Убедитесь, что bucket `books` существует
- Проверьте RLS политики для service role

### Проблема: "Signed URL returns 403"

**Решение:**
- Убедитесь, что файл существует в Storage
- Проверьте, что signed URL не истек
- Убедитесь, что `storage_path` правильный

### Проблема: "Worker не обрабатывает задачи"

**Решение:**
- Проверьте, что миграция `005_create_telegram_queue.sql` применена
- Убедитесь, что RPC функции созданы
- Проверьте логи worker'а на наличие ошибок

---

## 📚 Дополнительные ресурсы

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Signed URLs Guide](https://supabase.com/docs/guides/storage/signed-urls)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✅ Checklist

- [ ] Создан bucket `books` (приватный)
- [ ] Применены RLS политики для Storage
- [ ] Настроены переменные окружения (включая SERVICE_ROLE_KEY)
- [ ] Применена миграция `005_create_telegram_queue.sql`
- [ ] Протестирован API endpoint `/api/admin/download-url`
- [ ] Запущен и протестирован Worker
- [ ] Настроен мониторинг и логирование

