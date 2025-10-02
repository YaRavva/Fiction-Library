-- Fiction Library Database Schema
-- Migration 006: Covers Storage Bucket
--
-- ВАЖНО: Эта миграция создает только bucket.
-- Политики нужно создать через Supabase Dashboard → Storage → Policies
--
-- Инструкция:
-- 1. Выполните этот SQL для создания bucket
-- 2. Перейдите в Storage → Buckets → covers → Policies
-- 3. Создайте политики через UI (см. docs/MIGRATION_006_COVERS.md)

-- Создание bucket для обложек книг
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Проверка создания bucket
SELECT
  id,
  name,
  public,
  created_at
FROM storage.buckets
WHERE id = 'covers';

