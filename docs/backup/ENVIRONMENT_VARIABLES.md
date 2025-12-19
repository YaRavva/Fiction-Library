# Конфигурация развертывания Fiction Library в Supabase

Этот документ описывает переменные окружения, необходимые для развертывания приложения Fiction Library в новом инстансе Supabase.

## Обязательные переменные окружения

### Конфигурация Supabase
- `SUPABASE_PROJECT_ID` - ID проекта Supabase
- `SUPABASE_ACCESS_TOKEN` - Токен доступа для Supabase CLI
- `NEXT_PUBLIC_SUPABASE_URL` - URL проекта Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Анонимный ключ для клиентских операций Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Ключ сервисной роли для серверных операций Supabase
- `SUPABASE_JWT_SECRET` - Секретный ключ JWT для аутентификации

### Интеграция с Telegram (Опционально)
- `TELEGRAM_BOT_TOKEN` - Токен Telegram бота
- `TELEGRAM_CHANNEL_ID` - ID Telegram канала с книгами

## Пример файла .env.local

```env
# Конфигурация Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Интеграция с Telegram (Опционально)
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_CHANNEL_ID=
```

## Процесс развертывания

1. Установите необходимые переменные окружения в вашем окружении развертывания
2. Запустите скрипт развертывания:
   ```bash
   ./supabase/scripts/deploy.sh
   ```

3. Для локальной разработки скопируйте пример файла .env.local и настройте его:
   ```bash
   cp .env.local.example .env.local
   ```

## Замечания по безопасности

- Никогда не коммитьте чувствительные ключи в систему контроля версий
- Регулярно меняйте ключи
- Используйте разные ключи для разных окружений
- Ограничьте доступ к переменным окружения в продакшене