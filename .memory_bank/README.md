# Memory Bank - Система живой документации

## Что это такое

`Memory Bank` - это набор файлов, в которых хранится долгоживущий контекст проекта: технические ограничения, архитектурные правила, текущее состояние разработки и прогресс.

Для Fiction Library это внешний источник правды для разработчиков и ИИ-агентов между сессиями.

## Структура

```text
.memory_bank/
|- projectbrief.md
|- productContext.md
|- systemPatterns.md
|- techContext.md
|- activeContext.md
|- progress.md
|- ai-agent-instructions.md
\- README.md
```

## Что читать в начале работы

1. `activeContext.md` - что сейчас в работе.
2. `progress.md` - текущий статус и история прогресса.
3. `systemPatterns.md` - обязательные архитектурные паттерны.
4. `techContext.md` - актуальный стек, команды и инфраструктура.

## Базовые принципы

### Всегда

- сверять документацию с реальным состоянием кода;
- обновлять `activeContext.md` и `progress.md`, если меняется направление работы;
- использовать архитектурные правила из `systemPatterns.md`;
- проверять, что команды и версии совпадают с `package.json`.

### Никогда

- не опираться на устаревшие команды без проверки текущего репозитория;
- не описывать несуществующие скрипты или endpoint-ы;
- не расходиться с фактическим стеком и конфигурацией проекта.

## Актуальные технологические ориентиры

- `Next.js 16`
- `React 19`
- `TypeScript 5`
- `Tailwind CSS 4`
- `shadcn/ui` стиль `nova`
- `Supabase`
- `Cloud.ru S3`
- `Telegram / GramJS`
- `bun` как пакетный менеджер и runtime
- `Biome` для форматирования и линтинга

## Полезные команды

### Разработка

```powershell
bun install
bun run dev
bun run build
bun run lint
bun run check
```

### Memory Bank

```powershell
bun run memory-bank:update
bun run memory-bank:check
bun run memory-bank:setup-hooks
```

### Служебные скрипты

```powershell
bunx tsx src/scripts/get-all-metadata.ts
bunx tsx src/scripts/check-book-duplicates.ts
bunx tsx src/scripts/test-s3-connection.ts
```

## Где искать детали

- общая документация проекта: `README.md`
- технический стек: `techContext.md`
- архитектура и паттерны: `systemPatterns.md`
- Telegram-интеграция: `src/lib/telegram/README.md`
- служебные скрипты: `src/scripts/README.md`

## Цель

Memory Bank должен помогать быстро входить в контекст без догадок. Если код и документация расходятся, приоритет всегда у текущего кода, а документация должна быть обновлена.
