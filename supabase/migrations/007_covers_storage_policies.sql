-- Fiction Library Database Schema
-- Migration 007: Covers Storage Policies
--
-- Создание политик доступа для публичного bucket covers

-- Политика: Публичный доступ на чтение для всех
CREATE POLICY "Public read access for covers"
ON storage.objects
FOR SELECT
USING (bucket_id = 'covers');

-- Политика: Загрузка файлов только для аутентифицированных пользователей
CREATE POLICY "Authenticated users can upload covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'covers');

-- Политика: Обновление файлов только для аутентифицированных пользователей
CREATE POLICY "Authenticated users can update covers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'covers')
WITH CHECK (bucket_id = 'covers');

-- Политика: Удаление файлов только для аутентифицированных пользователей
CREATE POLICY "Authenticated users can delete covers"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'covers');

-- Проверка созданных политик
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname LIKE '%covers%';

