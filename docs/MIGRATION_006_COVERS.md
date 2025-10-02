# 📦 Миграция 006: Storage для обложек книг

## Описание

Эта миграция создает публичный bucket "covers" в Supabase Storage для хранения обложек книг, загружаемых из Telegram.

## Что делает миграция

1. **Создает bucket "covers"**
   - Публичный доступ на чтение
   - Для хранения изображений обложек

2. **Настраивает RLS политики**
   - Service role может загружать, читать, обновлять и удалять файлы
   - Все пользователи могут читать файлы (публичный доступ)

## Применение миграции

### ✅ Bucket уже создан

Если вы уже создали bucket "covers", переходите к настройке политик ниже.

### Создание bucket (если еще не создан)

#### Вариант 1: Через UI (проще)

1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Перейдите в **Storage** → **Buckets**
3. Нажмите **New Bucket**
4. Заполните:
   - **Name**: `covers`
   - **Public bucket**: ✅ **Включено**
5. Нажмите **Create bucket**

#### Вариант 2: Через SQL

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;
```

---

## Настройка политик доступа

**ВАЖНО:** Политики нужно создавать через UI, так как SQL требует прав суперпользователя.

### Шаг 1: Открыть настройки политик

1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Перейдите в **Storage** → **Policies**
3. Найдите bucket **covers** в списке
4. Нажмите **New Policy**

### Шаг 2: Создать политику для service role (загрузка)

1. Нажмите **New Policy**
2. Выберите **Custom Policy**
3. Заполните:
   - **Policy name**: `Service role can manage covers`
   - **Allowed operation**: Выберите **All** (INSERT, SELECT, UPDATE, DELETE)
   - **Target roles**: `service_role`
   - **USING expression**: `bucket_id = 'covers'`
   - **WITH CHECK expression**: `bucket_id = 'covers'`
4. Нажмите **Save policy**

### Шаг 3: Создать политику для публичного чтения

1. Нажмите **New Policy**
2. Выберите **Custom Policy**
3. Заполните:
   - **Policy name**: `Public can view covers`
   - **Allowed operation**: Выберите **SELECT**
   - **Target roles**: `public`
   - **USING expression**: `bucket_id = 'covers'`
4. Нажмите **Save policy**

### Альтернатива: Использовать шаблоны

Supabase предлагает готовые шаблоны политик:

1. Нажмите **New Policy**
2. Выберите **Get started quickly** → **Allow public read access**
3. Примените для bucket `covers`

## Проверка успешного применения

### 1. Проверка bucket

```sql
-- Проверяем, что bucket создан
SELECT * FROM storage.buckets WHERE id = 'covers';
```

Ожидаемый результат:
```
id     | name   | public
-------|--------|--------
covers | covers | true
```

### 2. Проверка политик

```sql
-- Проверяем политики для bucket covers
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE '%covers%';
```

Ожидаемый результат: 5 политик
- Service role can upload covers
- Service role can read covers
- Service role can update covers
- Service role can delete covers
- Anyone can view covers

### 3. Тестовая загрузка

Попробуйте загрузить тестовое изображение через API:

```typescript
import { serverSupabase } from '@/lib/supabase';

const testBuffer = Buffer.from('test');
const { data, error } = await serverSupabase.storage
  .from('covers')
  .upload('test.jpg', testBuffer, {
    contentType: 'image/jpeg',
  });

console.log('Upload result:', { data, error });
```

## Откат миграции (если нужно)

Если что-то пошло не так, можно откатить изменения:

```sql
-- Удаляем политики
DROP POLICY IF EXISTS "Service role can upload covers" ON storage.objects;
DROP POLICY IF EXISTS "Service role can read covers" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update covers" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete covers" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view covers" ON storage.objects;

-- Удаляем bucket (ВНИМАНИЕ: удалит все файлы!)
DELETE FROM storage.buckets WHERE id = 'covers';
```

## Использование после применения

После применения миграции синхронизация из Telegram будет автоматически:

1. Извлекать изображения обложек из сообщений
2. Загружать их в bucket "covers"
3. Сохранять URL в поле `cover_url` таблиц `books` и `series`

Пример URL обложки:
```
https://ваш-проект.supabase.co/storage/v1/object/public/covers/12345_1696234567890.jpg
```

## Troubleshooting

### Ошибка: "bucket already exists"

Это нормально, миграция использует `ON CONFLICT DO NOTHING`. Bucket уже создан.

### Ошибка: "policy already exists"

Миграция сначала удаляет существующие политики, затем создает новые. Если ошибка сохраняется, удалите политики вручную:

```sql
DROP POLICY IF EXISTS "Service role can upload covers" ON storage.objects;
-- и т.д. для всех политик
```

Затем запустите миграцию снова.

### Ошибка: "permission denied"

Убедитесь, что вы используете service role key в переменной окружения `SUPABASE_SERVICE_ROLE_KEY`.

## Следующие шаги

После применения миграции:

1. ✅ Запустите синхронизацию через админ панель
2. ✅ Проверьте, что обложки загружаются в bucket "covers"
3. ✅ Убедитесь, что обложки отображаются в библиотеке

## Связанные файлы

- `src/lib/telegram/sync.ts` - код загрузки обложек
- `src/lib/telegram/parser.ts` - парсер метаданных
- `src/app/api/admin/sync/route.ts` - API синхронизации

