# 🖼️ Исправление загрузки обложек из Telegram

## Проблема

Обложки книг не загружались из Telegram в Supabase Storage bucket "covers", хотя bucket был создан и политики настроены.

## Причины

1. **Неправильный тип медиа**: Обложки в Telegram канале хранятся как `MessageMediaWebPage` (веб-превью), а не как обычные фото (`MessageMediaPhoto`)
2. **Отсутствие поддержки веб-превью**: Код синхронизации проверял только `media.photo`, но не `media.webpage.photo`
3. **Проблемы с инициализацией Supabase Admin клиента**: Клиент с `SERVICE_ROLE_KEY` инициализировался до загрузки переменных окружения

## Решение

### 1. Обновлен парсер медиа в `src/lib/telegram/sync.ts`

Добавлена поддержка `MessageMediaWebPage`:

```typescript
// Если это веб-превью (MessageMediaWebPage) - основной случай для обложек
if (anyMsg.media.className === 'MessageMediaWebPage' && anyMsg.media.webpage?.photo) {
    console.log(`  → Веб-превью с фото`);
    const photoBuffer = await this.telegramClient.downloadMedia(anyMsg.media.webpage.photo);
    // ... загрузка в Storage
}
```

### 2. Улучшен метод `downloadMedia` в `src/lib/telegram/client.ts`

Теперь поддерживает скачивание любых медиа-объектов:

```typescript
public async downloadMedia(messageOrMedia: any) {
    // Если это объект Photo (из веб-превью или альбома)
    if (messageOrMedia.className === 'Photo') {
        return await this.client.downloadMedia(messageOrMedia);
    }
    // ... другие типы медиа
}
```

### 3. Исправлена инициализация Supabase Admin в `src/lib/supabase.ts`

Сделана ленивая инициализация клиента:

```typescript
export const getSupabaseAdmin = () => {
  if (!_supabaseAdmin) {
    // Перечитываем переменные окружения при первом вызове
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (url && key) {
      _supabaseAdmin = createSupabaseClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
  }
  return _supabaseAdmin;
};
```

### 4. Добавлено подробное логирование

Теперь при синхронизации выводится детальная информация:
- Тип медиа в сообщении
- Процесс скачивания фото
- Процесс загрузки в Storage
- URL загруженной обложки

## Тестирование

### Скрипт для тестирования

Создан скрипт `src/scripts/test-cover-upload.ts` для проверки загрузки обложек:

```bash
npx tsx src/scripts/test-cover-upload.ts
```

### Скрипт для инспекции сообщений

Создан скрипт `src/scripts/inspect-telegram-message.ts` для детального просмотра структуры сообщений:

```bash
npx tsx src/scripts/inspect-telegram-message.ts
```

## Результаты

✅ **Обложки успешно загружаются!**

- Все обложки из веб-превью корректно скачиваются из Telegram
- Файлы загружаются в Supabase Storage bucket "covers"
- URL обложек сохраняются в поле `cover_url` таблиц `books` и `series`

### Пример успешной загрузки

```
📸 Обнаружено медиа в сообщении 4918 (тип: MessageMediaWebPage)
  → Веб-превью с фото
  → Скачиваем фото из веб-превью...
  → Загружаем в Storage: covers/4918_1759422797326.jpg
  ✅ Обложка загружена: https://ygqyswivvdtpgpnxrpzl.supabase.co/storage/v1/object/public/covers/4918_1759422797326.jpg
```

## Структура медиа в Telegram

Обложки в канале хранятся как веб-превью:

```javascript
{
  className: 'MessageMediaWebPage',
  webpage: {
    className: 'WebPage',
    url: 'https://telegra.ph/file/8755c6d4b934b286c82ef.jpg',
    type: 'photo',
    photo: {
      className: 'Photo',
      id: ...,
      sizes: [...]
    }
  }
}
```

## Следующие шаги

1. ✅ Запустить синхронизацию через админ панель
2. ✅ Проверить, что обложки отображаются в библиотеке
3. ⏳ Добавить обработку других типов медиа (если потребуется)

## Связанные файлы

- `src/lib/telegram/sync.ts` - основная логика синхронизации
- `src/lib/telegram/client.ts` - Telegram клиент
- `src/lib/supabase.ts` - Supabase клиенты и утилиты
- `src/scripts/test-cover-upload.ts` - тестовый скрипт
- `src/scripts/inspect-telegram-message.ts` - скрипт инспекции
- `docs/MIGRATION_006_COVERS.md` - документация по настройке Storage

## Дата исправления

2 октября 2025 года

