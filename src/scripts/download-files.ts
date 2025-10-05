import { TelegramSyncService } from '../lib/telegram/sync';

/**
 * Загружает отсутствующие файлы книг из Telegram
 * @returns Результат загрузки
 */
export async function downloadMissingFiles() {
  try {
    console.log('🚀 Запуск загрузки отсутствующих файлов из Telegram');
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Скачиваем и обрабатываем файлы напрямую (без очереди)
    // Используем разумный лимит по умолчанию
    const results = await syncService.downloadAndProcessFilesDirectly(50);
    
    const successCount = results.filter((result: { success?: boolean }) => result.success !== false).length;
    const failedCount = results.length - successCount;
    
    console.log(`✅ Загрузка завершена: ${successCount} успешно, ${failedCount} с ошибками`);
    
    return {
      success: true,
      message: `Загружено ${successCount} из ${results.length} файлов`,
      results,
      actions: [
        `Обработано файлов: ${results.length}`,
        `Успешно: ${successCount}`,
        `С ошибками: ${failedCount}`
      ]
    };
  } catch (error) {
    console.error('❌ Ошибка загрузки файлов:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка загрузки',
      results: [],
      actions: []
    };
  }
}