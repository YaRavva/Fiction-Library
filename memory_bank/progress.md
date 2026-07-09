# Progress

## Контроль изменений
last_checked_commit: f1cd02f67e07d9663bf64f1d93b8a805b5e7a03c

## Changelog
- 2026-07-09: Рефакторинг UI админки — устранение дублирования логов
  - Убран раскрывающийся блок с логом и статистикой из "Истории операций"
  - При клике на элемент истории лог теперь показывается в "Операционном журнале"
  - Добавлена кнопка "Вернуться к текущей сессии" для возврата к live-логу
  - Устранено дублирование: один источник логов в UI — блок "Операционный журнал"

- 2026-07-09: Unified file matching + API consolidation
  - Создан `unified-file-matcher.ts` — гибридное сопоставление (lexical + embeddings)
  - Добавлена Telegram Cyrillic normalization (K→К, е→e и т.д.) в `book-file-scorer.ts`
  - Исправлен timeout enforcement в `auto-update/route.ts` (30 мин limits)
  - Консолидация API: 8 эндпоинтов → 4, удалены 3 мёртвых + 1 deprecated wrapper
  - Исправлена ссылка `bookOptions` → `booksWithoutFiles`
  - Удалены: `sync/route.ts`, `sync-files/route.ts`, `sync-async/route.ts`, `background-sync.ts`, `full-sync/route.ts`, `status/route.ts`

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
