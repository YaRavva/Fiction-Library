# 📋 Changelog: Интеграция Supabase Storage

**Дата:** 2025-10-02  
**Автор:** Система автоматической интеграции  
**Версия:** 1.0.0

---

## 🎯 Что было сделано

Реализована полная интеграция с Supabase Storage для безопасного хранения файлов книг (FB2) с использованием приватного bucket и signed URLs.

---

## ✅ Созданные файлы

### 1. Миграция базы данных
- **Файл:** `supabase/migrations/005_create_telegram_queue.sql`
- **Описание:** 
  - Создана таблица `telegram_download_queue` для управления очередью загрузок
  - Создана таблица `download_queue` (legacy, для обратной совместимости)
  - Добавлены RPC функции:
    - `get_next_download_task()` - атомарное получение следующей задачи
    - `complete_download_task()` - обновление статуса задачи
  - Добавлены индексы для оптимизации производительности

### 2. API Endpoint
- **Файл:** `src/app/api/admin/download-url/route.ts`
- **Endpoint:** `GET /api/admin/download-url`
- **Функционал:**
  - Генерация временных signed URLs для скачивания файлов
  - Проверка прав администратора
  - Поддержка параметров: `bookId`, `taskId`, `expiresIn`
  - Безопасный доступ к приватному bucket через service role

### 3. Worker (обновлен)
- **Файл:** `src/lib/telegram/worker.ts`
- **Изменения:**
  - Использует `serverSupabase` с service role key
  - Загружает файлы в приватный bucket `books`
  - Сохраняет `storage_path` в таблице `download_queue`
  - Обновляет статус книги в таблице `books`
  - Обрабатывает ошибки и retry логику

### 4. Документация
- **Файл:** `docs/storage-setup.md`
  - Полная инструкция по настройке Storage (8 шагов)
  - Настройка RLS политик
  - Примеры использования API
  - Troubleshooting и мониторинг
  
- **Файл:** `docs/quick-start-storage.md`
  - Быстрый старт за 5 минут
  - Минимальные шаги для запуска
  - Быстрые тесты

- **Файл:** `docs/CHANGELOG-storage.md` (этот файл)
  - История изменений
  - Список созданных файлов

### 5. Обновленные файлы
- **Файл:** `supabase/README.md`
  - Добавлена секция "Настройка Storage"
  - Обновлен список "Следующие шаги"
  - Ссылки на документацию

---

## 🔧 Технические детали

### Архитектура

```
┌─────────────┐
│  Telegram   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  DownloadWorker │ (src/lib/telegram/worker.ts)
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│  Supabase Storage    │ (private bucket: books)
│  + serverSupabase    │ (service role key)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  download_queue      │ (storage_path сохраняется)
│  books               │ (storage_path + sync_status)
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│  API Endpoint        │ (/api/admin/download-url)
│  Генерирует signed   │
│  URLs для скачивания │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Пользователь        │ (скачивает файл по signed URL)
└──────────────────────┘
```

### Безопасность

1. **Приватный bucket** - файлы недоступны напрямую
2. **Service role key** - используется только на сервере
3. **Signed URLs** - временные ссылки с ограниченным сроком действия
4. **Проверка прав** - только администраторы могут генерировать URLs
5. **RLS политики** - контроль доступа на уровне базы данных

### Переменные окружения

Требуются следующие переменные:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # ⚠️ Секретный!
SUPABASE_STORAGE_BUCKET=books
```

---

## 📊 Структура таблиц

### telegram_download_queue

```sql
CREATE TABLE telegram_download_queue (
  id UUID PRIMARY KEY,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  file_id TEXT,
  book_id UUID REFERENCES books(id),
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retry_count INT DEFAULT 0,
  priority INT DEFAULT 0,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### download_queue (legacy)

```sql
CREATE TABLE download_queue (
  id UUID PRIMARY KEY,
  telegram_message_id TEXT,
  telegram_file_id TEXT,
  filename TEXT,
  size BIGINT,
  status TEXT DEFAULT 'pending',
  attempts INT DEFAULT 0,
  last_error TEXT,
  storage_path TEXT,  -- ← Путь к файлу в Storage
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🚀 Как использовать

### 1. Запуск Worker

```typescript
import { DownloadWorker } from '@/lib/telegram/worker';

const worker = new DownloadWorker();
await worker.start();

// Проверка статуса
console.log(worker.getStatus());

// Остановка
worker.stop();
```

### 2. Добавление задачи в очередь

```typescript
import { DownloadQueue } from '@/lib/telegram/queue';

const queue = new DownloadQueue();
await queue.addTask({
  message_id: 'msg_123',
  channel_id: 'channel_456',
  file_id: 'telegram_file_id',
  book_id: 'book_uuid',
  priority: 1,
});
```

### 3. Генерация signed URL

```typescript
// Через API
const response = await fetch('/api/admin/download-url?bookId=abc-123&expiresIn=3600');
const { url, expiresAt, storagePath } = await response.json();

// Использование URL
window.location.href = url; // Скачивание файла
```

---

## 🧪 Тестирование

### Проверка миграции

```sql
-- Проверить таблицы
SELECT * FROM telegram_download_queue LIMIT 1;
SELECT * FROM download_queue LIMIT 1;

-- Проверить RPC функции
SELECT get_next_download_task();
```

### Проверка bucket

```sql
SELECT * FROM storage.buckets WHERE id = 'books';
-- Должен вернуть: public = false
```

### Проверка API

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/admin/download-url?bookId=YOUR_UUID"
```

---

## 📝 Следующие шаги

### Рекомендуется сделать:

1. **Создать bucket в Supabase Dashboard**
   - Имя: `books`
   - Public: ❌ ОТКЛЮЧЕНО

2. **Применить миграцию**
   - Выполнить `005_create_telegram_queue.sql` в SQL Editor

3. **Настроить RLS политики**
   - Разрешить service role полный доступ к bucket

4. **Протестировать Worker**
   - Добавить тестовую задачу
   - Запустить worker
   - Проверить загрузку файла

5. **Протестировать API**
   - Создать тестового админа
   - Сгенерировать signed URL
   - Скачать файл

### Опционально:

- Настроить автоматическую очистку старых файлов
- Добавить мониторинг размера bucket
- Настроить логирование операций с файлами
- Добавить rate limiting для API

---

## 🔗 Ссылки на документацию

- [Быстрый старт (5 минут)](./quick-start-storage.md)
- [Полная инструкция по настройке](./storage-setup.md)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Signed URLs Guide](https://supabase.com/docs/guides/storage/signed-urls)

---

## 📞 Поддержка

При возникновении проблем:

1. Проверьте [Troubleshooting](./storage-setup.md#-troubleshooting) в документации
2. Убедитесь, что все переменные окружения установлены
3. Проверьте логи worker'а и API
4. Проверьте RLS политики в Supabase Dashboard

---

## ✅ Checklist для деплоя

- [ ] Bucket `books` создан (приватный)
- [ ] Миграция `005_create_telegram_queue.sql` применена
- [ ] RLS политики настроены
- [ ] `SUPABASE_SERVICE_ROLE_KEY` установлен в production env
- [ ] `SUPABASE_STORAGE_BUCKET=books` установлен
- [ ] Worker протестирован локально
- [ ] API endpoint протестирован
- [ ] Мониторинг настроен
- [ ] Логирование настроено

---

**Статус:** ✅ Готово к использованию  
**Версия:** 1.0.0  
**Дата:** 2025-10-02

