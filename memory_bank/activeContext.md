# Active Context

## Текущий коммит
`b76d215` — feat: embedding generation progress tracking

## Текущий фокус
Admin improvements: stuck job recovery, bulk embedding generation, monitoring UI.

## Что сделано в последней сессии
1. Fix stuck jobs: auto-cleanup stale running jobs (>60 min), 30-min timeout for auto-update, recovery in saveSyncResult()
2. Bulk embeddings: POST /api/admin/embeddings/generate endpoint with batch processing (150 files, 20 per API call)
3. Monitoring: useEmbeddingPolling hook, EmbeddingProgress component with progress bar, retry utility with exponential backoff
4. Refactored TelegramFilesIndexer to use reusable EmbeddingProgress component

## Активные решения
- Auth вынесен в единый `requireAdminRequest()` — 33 роута используют его
- Миграции БД консолидированы в `001_baseline.sql`
- Biome: включены `noUnusedVariables: warn`, `noUnreachable: error`, `noEmptyCharacterClassInRegex: error`
- Hybrid matching: 0.6×lexical + 0.4×embedding scoring через pgvector + Voyage AI (1024-dim)

## Known Issues
- Vercel Deployment Protection блокирует unauthenticated curl к preview deployments
- Biome: 147 warnings (noExplicitAny, noUnusedImports) — pre-existing, не блокируют билд

## Блокеры
- Нет
