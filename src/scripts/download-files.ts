import { TelegramSyncService } from '../lib/telegram/sync';

/**
 * Загружает отсутствующие файлы книг из Telegram
 * @param limit Количество файлов для загрузки (по умолчанию 50)
 * @returns Результат загрузки
 */
export async function downloadMissingFiles(limit: number = 50) {
  try {
    console.log(`🚀 Запуск загрузки отсутствующих файлов из Telegram (лимит: ${limit})`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Скачиваем и обрабатываем файлы напрямую с указанным лимитом
    const results = await syncService.downloadAndProcessFilesDirectly(limit);
    
    const successCount = results.filter((result: { success?: boolean }) => result.success !== false).length;
    const failedCount = results.length - successCount;
    
    console.log(`✅ Загрузка завершена: ${successCount} успешно, ${failedCount} с ошибками`);
    
    // Формируем отчет об операции
    let report = `Загрузка файлов завершена:\n`;
    report += `Обработано файлов: ${results.length}\n`;
    report += `Успешно: ${successCount}\n`;
    report += `С ошибками: ${failedCount}\n\n`;
    
    if (results.length > 0) {
      report += `Детали обработки:\n`;
      results.forEach((result: any, index: number) => {
        const status = result.success ? '✅' : '❌';
        report += `${index + 1}. ${status} ${result.filename || 'Без имени'} (ID: ${result.messageId})\n`;
        if (!result.success && result.error) {
          report += `   Ошибка: ${result.error}\n`;
        }
      });
    }
    
    return {
      success: true,
      message: `Загружено ${successCount} из ${results.length} файлов`,
      results,
      actions: [
        `Обработано файлов: ${results.length}`,
        `Успешно: ${successCount}`,
        `С ошибками: ${failedCount}`
      ],
      report
    };
  } catch (error) {
    console.error('❌ Ошибка загрузки файлов:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка загрузки',
      results: [],
      actions: [],
      report: `Ошибка загрузки файлов: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  }
}