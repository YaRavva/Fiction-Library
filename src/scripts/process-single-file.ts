import { TelegramSyncService } from '../lib/telegram/sync';

/**
 * Скрипт для обработки одного файла по ID сообщения
 * @param messageId ID сообщения с файлом
 */
export async function processSingleFile(messageId: number) {
  try {
    console.log(`🚀 Начинаем обработку файла из сообщения ${messageId}`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Обрабатываем файл
    const result = await syncService.processSingleFileById(messageId);
    
    const success = result.success !== false;
    
    console.log(`${success ? '✅' : '❌'} Обработка файла завершена: ${result.filename || 'Без имени'} (ID: ${result.messageId})`);
    
    // Формируем отчет
    let report = `Обработка файла завершена:\n`;
    report += `Файл: ${result.filename || 'Без имени'} (ID: ${result.messageId})\n`;
    report += `Статус: ${success ? 'Успешно' : 'Ошибка'}\n`;
    
    if (!success && result.error) {
      report += `Ошибка: ${result.error}\n`;
    }
    
    if (result.bookTitle && result.bookAuthor) {
      report += `Книга: ${result.bookAuthor} - ${result.bookTitle}\n`;
    }
    
    if (result.fileSize) {
      report += `Размер файла: ${result.fileSize} байт\n`;
    }
    
    if (result.fileUrl) {
      report += `URL файла: ${result.fileUrl}\n`;
    }
    
    return {
      success,
      message: success ? `Файл ${result.filename || 'Без имени'} успешно обработан` : `Ошибка обработки файла: ${result.error}`,
      result,
      report
    };
  } catch (error) {
    console.error('❌ Ошибка обработки файла:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка',
      result: null,
      report: `Ошибка обработки файла: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  if (process.argv.length < 3) {
    console.log('Использование: npx tsx process-single-file.ts <messageId>');
    process.exit(1);
  }
  
  const messageId = parseInt(process.argv[2], 10);
  if (isNaN(messageId)) {
    console.log('Ошибка: messageId должен быть числом');
    process.exit(1);
  }
  
  (async () => {
    const result = await processSingleFile(messageId);
    console.log(result.report);
  })();
}