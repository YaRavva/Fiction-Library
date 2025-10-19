# Обновление админ-панели для использования нового endpoint полной синхронизации

## Общее описание

Обновлена админ-панель для использования нового API endpoint для полной синхронизации Книжного Червя. Это решает проблему с ошибкой `spawn npx ENOENT`, которая возникала при попытке запуска полной синхронизации через старый механизм.

## Изменения

### 1. Обновлена функция handleRunBookWorm

В файле [src/app/admin/page.tsx](file:///c:/Users/Ravva/Fiction-Library/src/app/admin/page.tsx) обновлена функция [handleRunBookWorm](file:///c:/Users/Ravva/Fiction-Library/src/app/admin/page.tsx#L149-L222) для использования разных endpoint'ов в зависимости от режима:

```typescript
// Для полной синхронизации используем новый dedicated endpoint
const endpoint = mode === 'full' ? '/api/admin/book-worm/full-sync' : '/api/admin/book-worm';

// Вызываем API endpoint для запуска синхронизации
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({ mode }),
})
```

### 2. Кнопка "Полная" теперь работает корректно

Кнопка "Полная" в разделе синхронизации теперь использует новый endpoint и не вызывает ошибку `spawn npx ENOENT`.

## Преимущества

1. **Решение проблемы с запуском**: Полная синхронизация теперь работает в любых средах
2. **Совместимость**: Нет необходимости в наличии `npx` в системе
3. **Надежность**: Устранена ошибка, которая мешала запуску полной синхронизации
4. **Прозрачность**: Пользователь получает четкое сообщение об успешном запуске

## Технические детали

### Endpoint'ы:
- **Полная синхронизация**: `/api/admin/book-worm/full-sync`
- **Обновление**: `/api/admin/book-worm` (остается без изменений)

### Режимы работы:
- **full**: Использует новый endpoint для прямого запуска полной синхронизации
- **update**: Продолжает использовать существующий endpoint

## Проверка работы

1. Откройте админ-панель
2. Перейдите в раздел "Синхронизация"
3. Нажмите кнопку "Полная"
4. Убедитесь, что синхронизация запускается без ошибок

## См. также

- [API_FULL_SYNC_ENDPOINT.md](file:///c:/Users/Ravva/Fiction-Library/API_FULL_SYNC_ENDPOINT.md) - документация по новому API endpoint
- [/api/admin/book-worm/full-sync](file:///c:/Users/Ravva/Fiction-Library/src/app/api/admin/book-worm/full-sync/route.ts) - реализация нового endpoint
- [/api/admin/book-worm](file:///c:/Users/Ravva/Fiction-Library/src/app/api/admin/book-worm/route.ts) - существующий endpoint