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
      let skippedCount = 0;
      
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
          
          if (result.skipped) {
            skippedCount++;
            // Добавляем пропущенный файл в историю
            const bookInfo = result.bookAuthor && result.bookTitle ? 
              `${result.bookAuthor} - ${result.bookTitle}` : 
              'Книга не найдена';
            const fileSize = result.fileSize && typeof result.fileSize === 'number' ? 
              `${Math.round(result.fileSize / 1024)} КБ` : 
              'размер неизвестен';
            const fileInfo = result.filename ? 
              `${result.filename} (${fileSize})` : 
              'Файл без имени';
            processedFilesHistory += `${processedFilesHistory ? '\n' : ''}⚠️ ${bookInfo}, ${fileInfo}, Пропущено: ${result.reason || 'Неизвестная причина'}`;
          } else if (result.success !== false) {
            successCount++;
            // Добавляем успешно обработанный файл в историю
            const bookInfo = result.bookAuthor && result.bookTitle ? 
              `${result.bookAuthor} - ${result.bookTitle}` : 
              'Книга без названия';
            const fileSize = result.fileSize && typeof result.fileSize === 'number' ? 
              `${Math.round(result.fileSize / 1024)} КБ` : 
              'размер неизвестен';
            const fileInfo = result.filename ? 
              `${result.filename} (${fileSize})` : 
              'Файл без имени';
            processedFilesHistory += `${processedFilesHistory ? '\n' : ''}✅ ${bookInfo}, ${fileInfo}, Файл успешно обработан и привязан к книге`;
          } else {
            failedCount++;
            // Добавляем файл с ошибкой в историю
            const fileSize = result.fileSize && typeof result.fileSize === 'number' ? 
              `${Math.round(result.fileSize / 1024)} КБ` : 
              'размер неизвестен';
            const fileInfo = result.filename ? 
              `${result.filename} (${fileSize})` : 
              'Файл без имени';
            processedFilesHistory += `${processedFilesHistory ? '\n' : ''}❌ ${fileInfo}, Ошибка: ${result.error || 'Неизвестная ошибка'}`;
          }
          
          processedFiles++;
          
          // Отправляем промежуточный результат
          const intermediateProgress = Math.round((processedFiles / totalFiles) * 100);
          const statusMessage = `${processedFilesHistory}\n📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Пропущено: ${skippedCount} | Всего: ${processedFiles}/${totalFiles}`;
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
          const fileSize = file.fileSize && typeof file.fileSize === 'number' ? 
            `${Math.round(file.fileSize / 1024)} КБ` : 
            'размер неизвестен';
          const fileInfo = file.filename ? 
            `${file.filename} (${fileSize})` : 
            'Файл без имени';
          processedFilesHistory += `${processedFilesHistory ? '\n' : ''}❌ ${fileInfo}, Ошибка: ${errorMessage}`;
          
          // Отправляем промежуточный результат
          const intermediateProgress = Math.round((processedFiles / totalFiles) * 100);
          const statusMessage = `${processedFilesHistory}\n📊 Прогресс: Успешно: ${successCount} | Ошибки: ${failedCount} | Пропущено: ${skippedCount} | Всего: ${processedFiles}/${totalFiles}`;
          taskManager.updateTaskProgress(taskId, intermediateProgress, statusMessage, result);
        }
      }
      
      // Финальный прогресс
      const finalMessage = `${processedFilesHistory}\n🏁 Завершено: Успешно: ${successCount} | Ошибки: ${failedCount} | Пропущено: ${skippedCount} | Всего: ${totalFiles}`;
      taskManager.updateTaskStatus(taskId, 'completed', finalMessage);
      taskManager.updateTaskProgress(taskId, 100, finalMessage, {
        successCount,
        failedCount,
        skippedCount,
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