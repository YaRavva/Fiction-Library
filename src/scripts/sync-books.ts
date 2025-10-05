import { TelegramSyncService } from '../lib/telegram/sync';

/**
 * Синхронизирует книги из Telegram канала
 * @param limit Количество книг для синхронизации
 * @returns Результат синхронизации
 */
export async function syncBooks(limit: number = 10) {
  try {
    console.log(`🚀 Запуск синхронизации книг из Telegram (лимит: ${limit})`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Синхронизируем книги с учетом уже обработанных сообщений
    const results = await syncService.syncBooks(limit);
    
    const { processed, added, updated, skipped, errors, details } = results;
    
    console.log(`✅ Синхронизация завершена: ${processed} обработано, ${added} добавлено, ${updated} обновлено, ${skipped} пропущено, ${errors} ошибок`);
    
    // Форматируем детали для отображения с автором и названием вместо bookID
    const formattedDetails = details.map((detail: any) => {
      // Извлекаем информацию о книге из деталей
      const bookInfo = detail.bookTitle && detail.bookAuthor 
        ? `${detail.bookAuthor} - ${detail.bookTitle}`
        : detail.bookId || 'неизвестная книга';
      
      switch (detail.status) {
        case 'added':
          return `+ Добавлена книга: ${bookInfo} (сообщение ${detail.msgId})`;
        case 'updated':
          return `~ Обновлена книга: ${bookInfo} (сообщение ${detail.msgId})`;
        case 'skipped':
          return `→ Пропущено: сообщение ${detail.msgId} (${detail.reason})`;
        case 'error':
          return `❌ Ошибка: сообщение ${detail.msgId} (${detail.error})`;
        default:
          return `? Неизвестный статус: ${JSON.stringify(detail)}`;
      }
    });
    
    return {
      success: true,
      message: `Синхронизировано ${processed} из ${limit} сообщений`,
      results,
      actions: [
        `Обработано сообщений: ${processed}`,
        `Добавлено книг: ${added}`,
        `Обновлено книг: ${updated}`,
        `Пропущено: ${skipped}`,
        `Ошибок: ${errors}`,
        ...formattedDetails
      ]
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
      actions: []
    };
  }
}