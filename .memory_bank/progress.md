# Progress

## Контроль изменений
last_checked_commit: a451d77

## Changelog
- 2026-07-08: Очистка и оптимизация проекта
  - 41 скрипт → 16 (удалены 23 диагностических дубликата)
  - 32 конфликтующие миграции → 1 baseline (001_baseline.sql)
  - Auth: 33/37 админ-роутов переведены на единый requireAdminRequest()
  - Добавлена аутентификация в sync-books и sync-stats (отсутствовала)
  - Удалены зависимости: motion, node-telegram-bot-api, cross-env
  - Удалены API-заглушки universal-sync, index-posts
  - Удалён мёртвый код: cloud-ru-file-upload.ts, _old/, backup .json/.sql
  - Фиксы: нулевые байты в 7+ файлах, битые импорты createClient
  - Vercel: деплой успешен (после 4 попыток)
