# Active Context

## Текущий фокус
- Масштабная очистка проекта завершена: скрипты (41→16), миграции (32→1 baseline), auth-рефакторинг (33/37 роутов), зависимости, мёртвый код
- Деплой на Vercel успешен после фикса нулевых байтов и битых импортов
- Остаётся доработать: включить `ignoreBuildErrors: false`, ужесточить Biome rules

## Активные решения
- Auth вынесен в единый `requireAdminRequest()` — 33 роута используют его, 4 оставлены с оригинальным паттерном (cookie-аутентификация, Telegram relogin)
- Миграции БД консолидированы в `001_baseline.sql` — старые 32 файла удалены из git
- Biome: включены `noUnusedVariables: warn`, `noUnreachable: error`, `noEmptyCharacterClassInRegex: error`

## Блокеры
- Нет
