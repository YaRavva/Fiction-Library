import { config } from 'dotenv';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения из .env файла
config();

/**
 * Синхронизирует книги из Telegram канала
 * @param limit Количество книг для синхронизации
 * @returns Результат синхронизации
 */
export async function syncBooks(limit: number = 10) {
  try {
    console.log('🚀 Запуск синхронизации книг из Telegram (лимит: ' + limit + ')');
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Синхронизируем книги с учетом уже обработанных сообщений
    const results = await syncService.syncBooks(limit);
    
    const { processed, added, updated, skipped, errors, details } = results;
    
    console.log('✅ Синхронизация завершена: ' + processed + ' обработано, ' + added + ' добавлено, ' + updated + ' обновлено, ' + skipped + ' пропущено, ' + errors + ' ошибок');
    
    // Форматируем детали для отображения с автором и названием вместо bookID
    const formattedDetails = details.map((detail: any) => {
      // Извлекаем информацию о книге из деталей
      const bookInfo = detail.bookTitle && detail.bookAuthor 
        ? detail.bookAuthor + ' - ' + detail.bookTitle
        : detail.bookId || 'неизвестная книга';
      
      switch (detail.status) {
        case 'added':
          return '✅ Добавлена книга: ' + bookInfo + ' (сообщение ' + detail.msgId + ')';
        case 'updated':
          return '🔄 Обновлена книга: ' + bookInfo + ' (сообщение ' + detail.msgId + ')';
        case 'skipped':
          const reason = detail.reason || 'неизвестная причина';
          // Переводим причины на русский
          let russianReason = reason;
          switch (reason) {
            case 'existing book has better description':
              russianReason = 'у существующей книги лучшее описание';
              break;
            case 'existing book has genres':
              russianReason = 'у существующей книги есть жанры';
              break;
            case 'existing book has tags':
              russianReason = 'у существующей книги есть теги';
              break;
            case 'existing book has cover':
              russianReason = 'у существующей книги есть обложка';
              break;
            case 'existing book has telegram post id':
              russianReason = 'у существующей книги есть ID сообщения';
              break;
            case 'missing title or author':
              russianReason = 'отсутствует название или автор';
              break;
            case 'no text content':
              russianReason = 'сообщение без текста';
              break;
            case 'metadata complete':
              russianReason = 'метаданные полные';
              break;
          }
          return '⚠️ Пропущено: ' + bookInfo + ' (сообщение ' + detail.msgId + ', ' + russianReason + ')';
        case 'error':
          const error = detail.error || 'неизвестная ошибка';
          return '❌ Ошибка: ' + bookInfo + ' (сообщение ' + detail.msgId + ', ' + error + ')';
        default:
          return '❓ Неизвестный статус: ' + bookInfo + ' (сообщение ' + detail.msgId + ', ' + JSON.stringify(detail) + ')';
      }
    });
    
    // Создаем красивый отчет с иконками
    const reportLines = [
      '🚀 Результаты синхронизации книг (лимит: ' + limit + ')',
      '📊 Статистика:',
      '   ✅ Успешно обработано: ' + processed,
      '   📚 Добавлено книг: ' + added,
      '   🔄 Обновлено книг: ' + updated,
      '   ⚠️ Пропущено: ' + skipped,
      '   ❌ Ошибок: ' + errors,
      '', // Пустая строка для разделения
      ...formattedDetails
    ];
    
    return {
      success: true,
      message: 'Синхронизировано ' + processed + ' из ' + limit + ' сообщений',
      results,
      actions: reportLines
    };
  } catch (error) {
    console.error('❌ Ошибка синхронизации книг:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка синхронизации',
      results: {
        processed: 0,
        added: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
        details: []
      },
      actions: [
        '❌ Ошибка синхронизации: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка')
      ]
    };
  }
  // Удалены блоки finally с process.exit(0), так как они останавливают сервер разработки
}

// Если скрипт запущен напрямую, выполняем синхронизацию
if (require.main === module) {
  syncBooks(10)
    .then((result) => {
      console.log('Результат синхронизации:', result);
      // В контексте CLI скрипта можно завершить процесс
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Ошибка при выполнении скрипта:', error);
      // В контексте CLI скрипта можно завершить процесс
      process.exit(1);
    });
}