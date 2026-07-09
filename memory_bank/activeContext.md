# Active Context

## Текущий коммит
`c430ee0` — refactor: consolidate Telegram sync API — remove dead endpoints and duplication

## Текущий фокус
Завершён рефакторинг API и unified file matching. Все 17 тестов проходят, билд чистый.
Следующий шаг: выбор нового направления для оптимизации или нового фичи.

## Что сделано в последней сессии
1. `unified-file-matcher.ts` — гибридное сопоставление файлов (0.6×lexical + 0.4×embedding)
2. Telegram Cyrillic normalization в `book-file-scorer.ts` (K→К, е→e и т.д.)
3. Timeout enforcement в `auto-update/route.ts` (30 мин limits)
4. Консолидация API: удалены 3 мёртвых эндпоинта, 1 мёртвый сервис
5. Исправлена ссылка `bookOptions` → `booksWithoutFiles` в `book-worm-service.ts`
6. Удалены deprecated wrappers (`telegram-files.ts`, `telegram-file-service.ts`, `background-sync.ts`)

## Активные решения
- Auth вынесен в единый `requireAdminRequest()` — 33 роута используют его
- Миграции БД консолидированы в `001_baseline.sql`
- Biome: включены `noUnusedVariables: warn`, `noUnreachable: error`, `noEmptyCharacterClassInRegex: error`
- Hybrid matching: 0.6×lexical + 0.4×embedding scoring через pgvector + Voyage AI (1024-dim)

## Known Issues
- `sync_job_results` status может застрять в "running" если insert fails silently
- Vercel Deployment Protection блокирует unauthenticated curl к preview deployments

## Блокеры
- Нет
