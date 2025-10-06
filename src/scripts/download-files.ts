import { TelegramSyncService } from '../lib/telegram/sync';

/**
 * Получает список отсутствующих файлов книг из Telegram для обработки
 * @param limit Количество файлов для получения (по умолчанию 50)
 * @returns Список файлов для обработки
 */
export async function downloadMissingFiles(limit: number = 50) {
  try {
    console.log(`🚀 Получаем список отсутствующих файлов из Telegram (лимит: ${limit})`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Получаем список файлов для обработки
    const files = await syncService.getFilesToProcess(limit);
    
    const successCount = files.length;
    
    console.log(`✅ Получен список из ${successCount} файлов для обработки`);
    
    // Формируем отчет об операции
    let report = `Список файлов для загрузки:\n`;
    report += `Файлов для обработки: ${files.length}\n\n`;
    
    if (files.length > 0) {
      report += `Детали:\n`;
      files.forEach((file: any, index: number) => {
        report += `${index + 1}. ${file.filename || 'Без имени'} (ID: ${file.messageId})\n`;
      });
    }
    
    return {
      success: true,
      message: `Получен список из ${successCount} файлов для обработки`,
      files,
      actions: [
        `Файлов для обработки: ${files.length}`
      ],
      report
    };
  } catch (error) {
    console.error('❌ Ошибка получения списка файлов:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка загрузки',
      files: [],
      actions: [],
      report: `Ошибка получения списка файлов: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  }
}

/**
 * Обрабатывает список файлов по одному
 * @param files Список файлов для обработки
 * @returns Результаты обработки
 */
export async function processFiles(files: any[]) {
  try {
    console.log(`🚀 Начинаем обработку ${files.length} файлов`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    
    // Обрабатываем каждый файл по одному
    for (const file of files) {
      try {
        console.log(`📥 Обрабатываем файл: ${file.filename || 'Без имени'} (ID: ${file.messageId})`);
        const result = await syncService.processSingleFileById(file.messageId as number);
        results.push(result);
        
        if (result.success !== false) {
          successCount++;
          console.log(`✅ Файл ${file.filename || 'Без имени'} успешно обработан`);
        } else {
          failedCount++;
          console.log(`❌ Ошибка обработки файла ${file.filename || 'Без имени'}: ${result.error}`);
        }
      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        results.push({
          messageId: file.messageId,
          filename: file.filename,
          success: false,
          error: errorMessage
        });
        console.log(`❌ Ошибка обработки файла ${file.filename || 'Без имени'}: ${errorMessage}`);
      }
    }
    
    console.log(`✅ Обработка завершена: ${successCount} успешно, ${failedCount} с ошибками`);
    
    // Формируем отчет об операции
    let report = `Обработка файлов завершена:\n`;
    report += `Обработано файлов: ${files.length}\n`;
    report += `Успешно: ${successCount}\n`;
    report += `С ошибками: ${failedCount}\n\n`;
    
    if (results.length > 0) {
      report += `Детали обработки:\n`;
      results.forEach((result: any, index: number) => {
        const status = result.success !== false ? '✅' : '❌';
        report += `${index + 1}. ${status} ${result.filename || 'Без имени'} (ID: ${result.messageId})\n`;
        if (result.success === false && result.error) {
          report += `   Ошибка: ${result.error}\n`;
        }
      });
    }
    
    return {
      success: true,
      message: `Обработано ${successCount} из ${files.length} файлов`,
      results,
      actions: [
        `Обработано файлов: ${files.length}`,
        `Успешно: ${successCount}`,
        `С ошибками: ${failedCount}`
      ],
      report
    };
  } catch (error) {
    console.error('❌ Ошибка обработки файлов:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка обработки',
      results: [],
      actions: [],
      report: `Ошибка обработки файлов: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  }
}