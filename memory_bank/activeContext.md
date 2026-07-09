# Active Context

## Текущий коммит
`f1cd02f67e07d9663bf64f1d93b8a805b5e7a03c` — fix: async embedding generation in telegram-files/index endpoint

## Текущий фокус
Рефакторинг UI админки: устранение дублирования логов между "Историей операций" и "Операционным журналом".
Теперь один источник логов в UI — блок "Операционный журнал".

## Что сделано в последней сессии
1. Убран раскрывающийся блок с логом и статистикой из `SyncResultsPanel`
2. При клике на элемент истории лог показывается в "Операционном журнале"
3. Добавлена кнопка "Вернуться к текущей сессии" для возврата к live-логу
4. Добавлен проп `onSelectResult` в `SyncResultsPanel` для передачи выбранной задачи
5. Добавлен интерфейс `SelectedSyncResult` в `page.tsx`

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
