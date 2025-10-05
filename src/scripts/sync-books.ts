import { TelegramSyncService } from '../lib/telegram/sync';

/**
 * Синхронизирует книги из Telegram канала
 * @param limit Количество книг для синхронизации
 * @returns Результат синхронизации
 */
export async function syncBooks(limit: number = 100) {
  try {
    console.log(`🚀 Запуск синхронизации книг из Telegram (лимит: ${limit})`);
    
    // Получаем экземпляр сервиса синхронизации
    const syncService = await TelegramSyncService.getInstance();
    
    // Скачиваем и обрабатываем файлы напрямую (без очереди)
    const results = await syncService.downloadAndProcessFilesDirectly(limit);
    
    const successCount = results.filter((result: { success?: boolean }) => result.success !== false).length;
    const failedCount = results.length - successCount;
    
    console.log(`✅ Синхронизация завершена: ${successCount} успешно, ${failedCount} с ошибками`);
    
    return {
      success: true,
      message: `Синхронизировано ${successCount} из ${results.length} файлов`,
      results,
      actions: [
        `Обработано файлов: ${results.length}`,
        `Успешно: ${successCount}`,
        `С ошибками: ${failedCount}`
      ]
    };
  } catch (error) {
    console.error('❌ Ошибка синхронизации книг:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка синхронизации',
      results: [],
      actions: []
    };
  }
}