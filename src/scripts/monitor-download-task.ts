import { taskManager } from '../lib/task-manager';

/**
 * Мониторит прогресс фоновой задачи загрузки файлов
 * @param taskId ID задачи
 * @param interval Интервал проверки в миллисекундах (по умолчанию 2000ms)
 */
export async function monitorDownloadTask(taskId: string, interval: number = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    // Регистрируем callback для получения прогресса
    taskManager.registerProgressCallback(taskId, (progress) => {
      console.log(`[${progress.progress}%] ${progress.message}`);
      
      // Если есть результат, выводим дополнительную информацию
      if (progress.result && progress.result.bookTitle && progress.result.bookAuthor) {
        console.log(`      Книга: ${progress.result.bookAuthor} - ${progress.result.bookTitle}`);
      }
    });
    
    // Периодически проверяем статус задачи
    const checkStatus = () => {
      const taskStatus = taskManager.getTaskStatus(taskId);
      
      if (!taskStatus) {
        console.log('❌ Задача не найдена');
        taskManager.unregisterProgressCallback(taskId);
        reject(new Error('Task not found'));
        return;
      }
      
      // Проверяем, завершена ли задача
      if (taskStatus.status === 'completed') {
        console.log('✅ Задача завершена успешно');
        console.log(`📊 Результат: ${taskStatus.message}`);
        taskManager.unregisterProgressCallback(taskId);
        resolve();
        return;
      }
      
      if (taskStatus.status === 'failed') {
        console.log('❌ Задача завершена с ошибкой');
        console.log(`📊 Ошибка: ${taskStatus.message}`);
        taskManager.unregisterProgressCallback(taskId);
        reject(new Error(taskStatus.message));
        return;
      }
      
      // Если задача еще выполняется, продолжаем мониторинг
      if (Date.now() - startTime > 30 * 60 * 1000) { // 30 минут таймаут
        console.log('⏰ Таймаут мониторинга (30 минут)');
        taskManager.unregisterProgressCallback(taskId);
        resolve();
        return;
      }
      
      // Планируем следующую проверку
      setTimeout(checkStatus, interval);
    };
    
    // Начинаем мониторинг
    checkStatus();
  });
}

// Если скрипт запущен напрямую
if (require.main === module) {
  if (process.argv.length < 3) {
    console.log('Использование: npx tsx monitor-download-task.ts <taskId>');
    process.exit(1);
  }
  
  const taskId = process.argv[2];
  console.log(`🔍 Мониторинг задачи ${taskId}...`);
  
  monitorDownloadTask(taskId).then(() => {
    console.log('✅ Мониторинг завершен');
  }).catch((error) => {
    console.error('❌ Ошибка мониторинга:', error);
  });
}