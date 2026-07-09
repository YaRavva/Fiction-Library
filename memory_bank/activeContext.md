# Active Context

## Текущий коммит
`9afffb2` — fix: dynamic embedding limit based on inserted files count

## Текущий фокус
Улучшение индексации файлов Telegram: динамический лимит генерации эмбеддингов.
Все новые файлы теперь получают эмбеддинги в фоне после индексации.

## Что сделано в последней сессии
1. Заменён фиксированный лимит 10 на динамический = количество вставленных файлов
2. Все новые файлы теперь получают эмбеддинги в фоне
3. Добавлено поле `embeddings_queued` в статистику и детали операции
4. Добавлен лог о запуске фоновой генерации эмбеддингов

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
