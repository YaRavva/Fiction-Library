-- SQL скрипт для отображения структуры таблицы telegram_stats

-- Показать структуру таблицы
\d telegram_stats;

-- Или альтернативно, получить информацию о колонках
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'telegram_stats'
ORDER BY ordinal_position;

-- Показать индексы таблицы
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'telegram_stats';

-- Показать комментарии к таблице
SELECT 
    obj_description('telegram_stats'::regclass, 'pg_class') as table_comment;

-- Показать существующие данные в таблице
SELECT * FROM telegram_stats;

-- Подсчитать количество записей в таблице
SELECT COUNT(*) as row_count FROM telegram_stats;