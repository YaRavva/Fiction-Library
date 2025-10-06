# Скрипты для работы с файлами Telegram

## Асинхронная загрузка файлов

### download-files-async.ts
Асинхронная загрузка отсутствующих файлов книг с отображением прогресса.

Использование:
```bash
npx tsx download-files-async.ts [limit]
```

### monitor-download-task.ts
Мониторинг прогресса фоновой задачи загрузки файлов.

Использование:
```bash
npx tsx monitor-download-task.ts <taskId>
```

### full-download-test.ts
Полный тест асинхронной загрузки файлов с отображением прогресса.

Использование:
```bash
npx tsx full-download-test.ts
```

### process-files-batch.ts
Пакетная обработка файлов с отображением прогресса.

Использование:
```bash
npx tsx process-files-batch.ts [limit]
```

### process-single-file.ts
Обработка одного файла по ID сообщения.

Использование:
```bash
npx tsx process-single-file.ts <messageId>
```

### get-files-to-process.ts
Получение списка файлов для обработки без их непосредственной обработки.

Использование:
```bash
npx tsx get-files-to-process.ts [limit]
```