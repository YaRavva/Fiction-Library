# ⚡ Быстрый старт: Настройка Storage за 5 минут

## Что нужно сделать прямо сейчас

### 1️⃣ Создать bucket в Supabase (2 минуты)

1. Откройте [Supabase Dashboard](https://app.supabase.com) → ваш проект
2. **Storage** → **New Bucket**
3. Имя: `books`, Public: ❌ **ОТКЛЮЧЕНО**
4. **Create bucket**

### 2️⃣ Добавить переменную окружения (1 минута)

Добавьте в ваш `.env` файл:

```env
SUPABASE_STORAGE_BUCKET=books
```

Убедитесь, что у вас уже есть:
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3️⃣ Применить миграцию (1 минута)

В Supabase Dashboard → **SQL Editor** → выполните файл:
```
supabase/migrations/005_create_telegram_queue.sql
```

### 4️⃣ Настроить RLS политики (1 минута)

В **SQL Editor** выполните:

```sql
-- Разрешаем service role полный доступ к bucket
CREATE POLICY "Service role full access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'books')
WITH CHECK (bucket_id = 'books');
```

---

## ✅ Готово!

Теперь вы можете:

### Использовать Worker для загрузки файлов:

```typescript
import { DownloadWorker } from '@/lib/telegram/worker';

const worker = new DownloadWorker();
await worker.start();
```

### Генерировать signed URLs для скачивания:

```typescript
// GET /api/admin/download-url?bookId=<uuid>
const response = await fetch('/api/admin/download-url?bookId=abc-123');
const { url } = await response.json();
// Используйте url для скачивания файла
```

---

## 📖 Подробная документация

Смотрите [storage-setup.md](./storage-setup.md) для полной инструкции.

---

## 🔍 Проверка работы

### Тест 1: Проверить bucket

```sql
SELECT * FROM storage.buckets WHERE id = 'books';
```

Должен вернуть одну строку с `public = false`.

### Тест 2: Проверить таблицы

```sql
SELECT COUNT(*) FROM telegram_download_queue;
SELECT COUNT(*) FROM download_queue;
```

Должны выполниться без ошибок.

### Тест 3: Проверить RPC функции

```sql
SELECT get_next_download_task();
```

Должна вернуть пустой результат (если очередь пуста).

---

## 🆘 Проблемы?

- **Bucket не создается**: проверьте права доступа в Supabase
- **Worker не работает**: убедитесь, что `SUPABASE_SERVICE_ROLE_KEY` установлен
- **API возвращает 403**: проверьте роль пользователя (`admin` в `user_profiles`)

Подробнее: [storage-setup.md](./storage-setup.md) → раздел Troubleshooting

