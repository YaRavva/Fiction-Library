# Использование обновленного алгоритма релевантности в Книжном Червя

## Общая информация

Книжной Червь (Book Worm) - это сервис для автоматической синхронизации книг из Telegram-каналов. Он состоит из нескольких компонентов:

1. [BookWormService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/book-worm-service.ts#L26-L1080) - основной сервис управления процессом
2. [TelegramFileService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/file-service.ts#L31-L725) - сервис для работы с файлами
3. [TelegramMetadataService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/metadata-service.ts#L18-L274) - сервис для работы с метаданными
4. [FileProcessingService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/file-processing-service.ts#L24-L937) - сервис для обработки файлов

## Использование алгоритма релевантности

### Основное использование

Обновленный алгоритм релевантности используется в [FileProcessingService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/file-processing-service.ts#L24-L937) через класс [MetadataExtractionService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/metadata-extraction-service.ts#L2-L268):

```typescript
// В файле file-processing-service.ts, строка 459
const bestMatch = MetadataExtractionService.selectBestMatch(uniqueMatches, searchTerms, title, author);
```

Этот вызов происходит при обработке каждого файла для поиска наиболее подходящей книги в базе данных.

### Путь выполнения

1. API-эндпоинт [/api/admin/book-worm](file:///c:/Users/Ravva/Fiction-Library/src/app/api/admin/book-worm/route.ts) вызывает [BookWormService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/book-worm-service.ts#L26-L1080)
2. [BookWormService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/book-worm-service.ts#L26-L1080) использует [TelegramFileService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/file-service.ts#L31-L725) для загрузки файлов
3. [TelegramFileService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/file-service.ts#L31-L725) делегирует обработку файлов [FileProcessingService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/file-processing-service.ts#L24-L937)
4. [FileProcessingService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/file-processing-service.ts#L24-L937) использует [MetadataExtractionService.selectBestMatch()](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/metadata-extraction-service.ts#L133-L255) для определения релевантности

### Обновления алгоритма

Алгоритм был обновлен 20 октября 2025 года с увеличением баллов за совпадения:
- Совпадение слов в названии: 5 → 8 баллов
- Совпадение слов в авторе: 3 → 5 баллов
- Полное совпадение всех слов: 20 → 30 баллов
- И другие улучшения

Порог релевантности временно понижен с 50 до 45 баллов для тестирования.

## Заключение

Книжной Червь использует обновленный алгоритм релевантности через [MetadataExtractionService](file:///c:/Users/Ravva/Fiction-Library/src/lib/telegram/metadata-extraction-service.ts#L2-L268), что обеспечивает более точное сопоставление файлов с книгами в базе данных.