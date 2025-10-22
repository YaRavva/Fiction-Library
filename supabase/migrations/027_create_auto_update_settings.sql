-- Миграция для создания таблицы настроек автообновления

-- Создаем таблицу, если она не существует
CREATE TABLE IF NOT EXISTS auto_update_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT FALSE,
  interval INTEGER DEFAULT 30, -- в минутах
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE
);

-- Убедимся, что у нас есть только одна запись с id=1
INSERT INTO auto_update_settings (id, enabled, interval, last_run, next_run)
SELECT 1, false, 30, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM auto_update_settings WHERE id = 1);