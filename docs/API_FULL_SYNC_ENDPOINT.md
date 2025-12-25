# Новый API Endpoint для полной синхронизации

## Общее описание

Добавлен новый API endpoint для запуска полной синхронизации Книжного Червя напрямую, без использования spawn процессов. Это решает проблему с ошибкой `spawn npx ENOENT`, которая возникала в production средах.

## Endpoint

```
POST /api/admin/book-worm/full-sync
```

## Параметры

### Headers
- `Authorization: Bearer [token]` - Токен авторизации администратора

### Body
Нет обязательных параметров

## Ответ

### Успешный ответ
```json
{
  "success": true,
  "message": "Book Worm full sync started",
  "mode": "full",
  "status": "processing"
}
```

### Ошибки
- `401 Unauthorized` - Отсутствует или неверный токен авторизации
- `403 Forbidden` - Пользователь не является администратором
- `500 Internal Server Error` - Внутренняя ошибка сервера

## Особенности реализации

1. Запускает полную синхронизацию напрямую в контексте запроса
2. Не использует spawn процессов, что решает проблему с `npx ENOENT`
3. Асинхронно выполняет синхронизацию без ожидания завершения
4. Возвращает ответ сразу после запуска процесса

## Использование

Отправьте POST запрос на `/api/admin/book-worm/full-sync` с заголовком авторизации:

```bash
curl -X POST \
  http://localhost:3000/api/admin/book-worm/full-sync \
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN'
```

## Преимущества

- Работает в любых средах (локально и на Vercel)
- Не зависит от наличия npx в системе
- Более надежный и стабильный способ запуска полной синхронизации
- Сохраняет асинхронное выполнение для избежания таймаутов

## См. также

- [/api/admin/book-worm](file:///c:/Users/Ravva/Fiction-Library/src/app/api/admin/book-worm/route.ts) - Основной endpoint Книжного Червя
- [/api/admin/book-worm/status](file:///c:/Users/Ravva/Fiction-Library/src/app/api/admin/book-worm/status/route.ts) - Endpoint для проверки статуса