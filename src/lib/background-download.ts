import { TelegramSyncService } from './telegram/sync';
import { taskManager, TaskProgress } from './task-manager';

/**
 * Фоновый обработчик для загрузки файлов
 */
export class BackgroundDownloadHandler {
  /**
   * Запускает фоновую загрузку файлов
   * @param taskId ID задачи
   * @param limit Количество файлов для загрузки
   */
  static async startDownload(taskId: string, limit: number = 50): Promise<void> {
    try {
      // Обновляем статус задачи
      taskManager.updateTaskStatus(taskId, 'running', '📥 Получение списка файлов для загрузки...');
      
      // Получаем экземпляр сервиса синхронизации
      const syncService = await TelegramSyncService.getInstance();
      
      // Получаем список файлов для обработки
      const files = await syncService.getFilesToProcess(limit);
      
      if (files.length === 0) {
        taskManager.updateTaskStatus(taskId, 'completed', '✅ Нет файлов для загрузки');
        taskManager.updateTaskProgress(taskId, 100, '✅ Нет файлов для загрузки');
        return;
      }
      
      const totalFiles = files.length;
      let processedFiles = 0;
      const results: any[] = [];
      let successCount = 0;
      let failedCount = 0;
      
      taskManager.updateTaskProgress(taskId, 0, `📥 Найдено ${totalFiles} файлов для загрузки. Начинаем загрузку...`);
      
      // Для отслеживания истории обработанных файлов
      let processedFilesHistory = '';
      
      // Обрабатываем каждый файл по одному
      for (const file of files) {
        try {
          const progress = Math.round((processedFiles / totalFiles) * 100);
          const message = `${processedFilesHistory}\n📥 Загрузка файла ${processedFiles + 1}/${totalFiles}: ${file.filename || 'Без имени'} (ID: ${file.messageId})`;
          
          taskManager.updateTaskProgress(taskId, progress, message);
          
          // Обрабатываем файл
          const result = await syncService.processSingleFileById(file.messageId as number);
          results.push(result);
          
          if (result.success !== false) {
            successCount++;
            // Добавляем успешно обработанный файл в историю
            processedFilesHistory += `${processedFilesHistory ? ' ' : ''}✅ ${file.filename || 'Без имени'}`;
          } else {
            failedCount++;
            // Добавляем файл с ошибкой в историю
            processedFilesHistory += `${processedFilesHistory ? ' ' : ''}❌ ${file.filename || 'Без имени'}`;
          }
          
          processedFiles++;
          
          // Отправляем промежуточный результат
          const intermediateProgress = Math.round((processedFiles / totalFiles) * 100);
          const statusMessage = `${processedFilesHistory}\n📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Всего: ${processedFiles}/${totalFiles}`;
          taskManager.updateTaskProgress(taskId, intermediateProgress, statusMessage, result);
        } catch (error) {
          failedCount++;
          processedFiles++;
          const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
          const result = {
            messageId: file.messageId,
            filename: file.filename,
            success: false,
            error: errorMessage
          };
          results.push(result);
          
          // Добавляем файл с ошибкой в историю
          processedFilesHistory += `${processedFilesHistory ? ' ' : ''}❌ ${file.filename || 'Без имени'}`;
          
          // Отправляем промежуточный результат
          const intermediateProgress = Math.round((processedFiles / totalFiles) * 100);
          const statusMessage = `${processedFilesHistory}\n📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Всего: ${processedFiles}/${totalFiles}`;
          taskManager.updateTaskProgress(taskId, intermediateProgress, statusMessage, result);
        }
      }
      
      // Финальный прогресс
      const finalMessage = `${processedFilesHistory}\n🏁 Завершено: Успешно: ${successCount} | Ошибки: ${failedCount} | Всего: ${totalFiles}`;
      taskManager.updateTaskStatus(taskId, 'completed', finalMessage);
      taskManager.updateTaskProgress(taskId, 100, finalMessage, {
        successCount,
        failedCount,
        totalFiles,
        results
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка загрузки';
      taskManager.updateTaskStatus(taskId, 'failed', `❌ Ошибка: ${errorMessage}`);
      taskManager.updateTaskProgress(taskId, 100, `❌ Ошибка: ${errorMessage}`);
    }
  }
}