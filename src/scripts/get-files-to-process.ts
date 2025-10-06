import { TelegramSyncService } from '../lib/telegram/sync';

/**
 * Скрипт для получения списка файлов для обработки без их непосредственной обработки
 * @param limit Количество файлов для получения (по умолчанию 10)
 */
export async function getFilesToProcess(limit: number = 10) {
  try {
    console.log(`🚀 Получаем список файлов для обработки (лимит: ${limit})`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Получаем список файлов для обработки
    const files = await syncService.getFilesToProcess(limit);
    
    console.log(`✅ Получено ${files.length} файлов для обработки`);
    
    // Формируем отчет
    let report = `Список файлов для обработки:\n`;
    report += `Всего файлов: ${files.length}\n\n`;
    
    if (files.length > 0) {
      report += `Детали:\n`;
      files.forEach((file: any, index: number) => {
        report += `${index + 1}. ${file.filename || 'Без имени'} (ID: ${file.messageId})\n`;
      });
    }
    
    return {
      success: true,
      message: `Получено ${files.length} файлов для обработки`,
      files,
      report
    };
  } catch (error) {
    console.error('❌ Ошибка получения списка файлов:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка',
      files: [],
      report: `Ошибка получения списка файлов: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    const limit = process.argv[2] ? parseInt(process.argv[2], 10) : 10;
    const result = await getFilesToProcess(limit);
    console.log(result.report);
  })();
}