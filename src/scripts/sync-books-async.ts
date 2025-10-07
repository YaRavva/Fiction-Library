import { config } from 'dotenv';
import { TelegramSyncService } from '../lib/telegram/sync';

// Загружаем переменные окружения из .env файла
config();

/**
 * Асинхронно синхронизирует метаданные из Telegram канала с отображением прогресса
 * @param limit Количество сообщений для синхронизации
 * @param progressCallback Функция обратного вызова для отображения прогресса
 */
export async function syncBooksAsync(
  limit: number = 10, 
  progressCallback?: (progress: number, message: string, result?: any) => void
) {
  try {
    console.log(`🚀 Запуск асинхронной синхронизации метаданных из Telegram (лимит: ${limit})`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Начинаем синхронизацию метаданных
    if (progressCallback) {
      progressCallback(0, '📥 Начинаем синхронизацию метаданных...');
    }
    
    console.log('📥 Начинаем синхронизацию метаданных...');
    
    // Выполняем синхронизацию
    const results = await syncService.syncBooks(limit);
    
    // Для отслеживания истории обработанных сообщений
    let processedMessagesHistory = '';
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let processedCount = 0;
    
    if (progressCallback) {
      progressCallback(0, `📥 Обработано ${results.details.length} сообщений...`);
    }
    
    console.log(`📥 Обработано ${results.details.length} сообщений...`);
    
    // Обрабатываем результаты
    for (const detail of results.details) {
      processedCount++;
      const progress = Math.round((processedCount / results.details.length) * 100);
      
      // Извлекаем информацию о книге из деталей
      const typedDetail = detail as { 
        bookTitle?: string; 
        bookAuthor?: string; 
        bookId?: string; 
        msgId?: string;
        status: string;
        reason?: string;
        error?: string;
      };
      
      const bookInfo = typedDetail.bookTitle && typedDetail.bookAuthor 
        ? `${typedDetail.bookAuthor} - ${typedDetail.bookTitle}`
        : typedDetail.bookId || 'неизвестная книга';
      
      let statusMessage = '';
      
      switch (typedDetail.status) {
        case 'added':
          addedCount++;
          processedMessagesHistory += `${processedMessagesHistory ? '\n' : ''}✅ Добавлена книга: ${bookInfo} (сообщение ${typedDetail.msgId})`;
          statusMessage = `Добавлена книга: ${bookInfo}`;
          console.log(`✅ ${statusMessage}`);
          break;
        case 'updated':
          updatedCount++;
          processedMessagesHistory += `${processedMessagesHistory ? '\n' : ''}🔄 Обновлена книга: ${bookInfo} (сообщение ${typedDetail.msgId})`;
          statusMessage = `Обновлена книга: ${bookInfo}`;
          console.log(`🔄 ${statusMessage}`);
          break;
        case 'skipped':
          skippedCount++;
          const reason = typedDetail.reason || 'неизвестная причина';
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
            case 'book already exists in database':
              russianReason = 'книга уже существует в базе данных';
              break;
            case 'book already exists':
              russianReason = 'книга уже существует в базе данных';
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
          processedMessagesHistory += `${processedMessagesHistory ? '\n' : ''}⚠️ Пропущено: ${bookInfo} (сообщение ${typedDetail.msgId}, ${russianReason})`;
          statusMessage = `Пропущено: ${bookInfo} (${russianReason})`;
          console.log(`⚠️ ${statusMessage}`);
          break;
        case 'error':
          errorCount++;
          const error = typedDetail.error || 'неизвестная ошибка';
          processedMessagesHistory += `${processedMessagesHistory ? '\n' : ''}❌ Ошибка: ${bookInfo} (сообщение ${typedDetail.msgId}, ${error})`;
          statusMessage = `Ошибка: ${bookInfo} (${error})`;
          console.log(`❌ ${statusMessage}`);
          break;
      }
      
      // Отправляем промежуточный результат
      if (progressCallback) {
        const intermediateProgress = Math.round((processedCount / results.details.length) * 100);
        const statusMessage = `${processedMessagesHistory}\n📊 Прогресс: Добавлено: ${addedCount} | Обновлено: ${updatedCount} | Пропущено: ${skippedCount} | Ошибок: ${errorCount} | Всего: ${processedCount}/${results.details.length}`;
        progressCallback(intermediateProgress, statusMessage, detail);
      }
      
      console.log(`📊 Прогресс: Добавлено: ${addedCount} | Обновлено: ${updatedCount} | Пропущено: ${skippedCount} | Ошибок: ${errorCount} | Всего: ${processedCount}/${results.details.length}`);
    }
    
    // Финальный прогресс
    const finalMessage = `${processedMessagesHistory}\n🏁 Завершено: Добавлено: ${addedCount} | Обновлено: ${updatedCount} | Пропущено: ${skippedCount} | Ошибок: ${errorCount} | Всего: ${results.details.length}`;
    if (progressCallback) {
      progressCallback(100, finalMessage);
    }
    
    console.log(`🏁 Завершено: Добавлено: ${addedCount} | Обновлено: ${updatedCount} | Пропущено: ${skippedCount} | Ошибок: ${errorCount} | Всего: ${results.details.length}`);
    
    // Формируем отчет об операции
    let report = `🚀 Результаты синхронизации метаданных\n`;
    report += `📊 Статистика:\n`;
    report += `  ✅ Добавлено: ${addedCount}\n`;
    report += `  🔄 Обновлено: ${updatedCount}\n`;
    report += `  ⚠️  Пропущено: ${skippedCount}\n`;
    report += `  ❌ Ошибок: ${errorCount}\n`;
    report += `  📚 Всего: ${results.details.length}\n\n`;
    
    if (processedMessagesHistory) {
      report += `${processedMessagesHistory}\n`;
    }
    
    return {
      success: true,
      message: finalMessage,
      results,
      actions: [
        `Обработано сообщений: ${results.details.length}`,
        `Добавлено: ${addedCount}`,
        `Обновлено: ${updatedCount}`,
        `Пропущено: ${skippedCount}`,
        `Ошибок: ${errorCount}`
      ],
      report
    };
  } catch (error) {
    console.error('❌ Ошибка асинхронной синхронизации метаданных:', error);
    if (progressCallback) {
      progressCallback(100, `❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
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
      actions: [],
      report: `❌ Ошибка асинхронной синхронизации метаданных: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    const limit = process.argv[2] ? parseInt(process.argv[2], 10) : 10;
    
    // Простой callback для отображения прогресса в консоли
    const progressCallback = (progress: number, message: string, result?: any) => {
      console.log(`\n[Прогресс: ${progress}%]\n${message}`);
    };
    
    const result = await syncBooksAsync(limit, progressCallback);
    console.log('\n' + result.report);
  })();
}