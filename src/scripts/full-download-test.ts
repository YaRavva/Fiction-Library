import { taskManager } from '../lib/task-manager';
import { BackgroundDownloadHandler } from '../lib/background-download';

/**
 * Полный тест асинхронной загрузки файлов с отображением прогресса
 */
async function fullDownloadTest() {
  try {
    console.log('🚀 Полный тест асинхронной загрузки файлов');
    console.log('=====================================');
    
    // Создаем ID задачи
    const taskId = `full-test-${Date.now()}`;
    
    // Создаем задачу
    const task = taskManager.createTask(taskId);
    console.log(`✅ Создана задача: ${taskId}`);
    
    // Для хранения истории обработанных файлов
    let processedFilesHistory = '';
    
    // Регистрируем callback для прогресса
    taskManager.registerProgressCallback(taskId, (progress) => {
      // Очищаем консоль для лучшего отображения
      console.clear();
      
      console.log('🚀 Полный тест асинхронной загрузки файлов');
      console.log('=====================================');
      console.log(`✅ Задача: ${taskId}`);
      console.log(`📈 Прогресс: ${progress.progress}%`);
      console.log('');
      
      // Разбираем сообщение для отображения
      const messageLines = progress.message ? progress.message.split('\n') : []
      if (messageLines.length > 0) {
        // Первая строка - обработанные файлы
        if (messageLines[0]) {
          console.log(`Обработанные файлы: ${messageLines[0]}`);
        }
        
        // Остальные строки - текущий статус
        for (let i = 1; i < messageLines.length; i++) {
          if (messageLines[i]) {
            console.log(messageLines[i]);
          }
        }
      } else {
        console.log(progress.message || '');
      }
      
      // Если есть результат, выводим дополнительную информацию
      if (progress.result) {
        if (progress.result.bookTitle && progress.result.bookAuthor) {
          console.log(`      📘 Книга: ${progress.result.bookAuthor} - ${progress.result.bookTitle}`);
        }
        if (progress.result.fileSize) {
          console.log(`      📏 Размер: ${Math.round(progress.result.fileSize / 1024)} KB`);
        }
      }
    });
    
    console.log('\n📥 Запуск фоновой загрузки файлов...');
    console.log('-------------------------------------');
    
    // Запускаем фоновую загрузку
    await BackgroundDownloadHandler.startDownload(taskId, 3); // Тестируем с 3 файлами
    
    // Ждем завершения задачи
    let isCompleted = false;
    while (!isCompleted) {
      const taskStatus = taskManager.getTaskStatus(taskId);
      if (taskStatus && (taskStatus.status === 'completed' || taskStatus.status === 'failed')) {
        isCompleted = true;
      } else {
        // Ждем 1 секунду перед следующей проверкой
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Получаем финальный статус задачи
    const finalStatus = taskManager.getTaskStatus(taskId);
    if (finalStatus) {
      console.log('\n=====================================');
      console.log('📊 Финальный результат:');
      console.log(`   Статус: ${finalStatus.status}`);
      console.log(`   Прогресс: ${finalStatus.progress}%`);
      
      // Разбираем финальное сообщение
      const messageLines = finalStatus.message ? finalStatus.message.split('\n') : []
      if (messageLines.length > 0) {
        console.log(`   Обработанные файлы: ${messageLines[0]}`);
        for (let i = 1; i < messageLines.length; i++) {
          if (messageLines[i]) {
            console.log(`   ${messageLines[i]}`);
          }
        }
      }
      
      if (finalStatus.result) {
        if (finalStatus.result.successCount !== undefined) {
          console.log(`   ✅ Успешно: ${finalStatus.result.successCount}`);
        }
        if (finalStatus.result.failedCount !== undefined) {
          console.log(`   ❌ Ошибок: ${finalStatus.result.failedCount}`);
        }
        if (finalStatus.result.totalFiles !== undefined) {
          console.log(`   📚 Всего файлов: ${finalStatus.result.totalFiles}`);
        }
      }
      
      console.log('✅ Тест завершен успешно!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    await fullDownloadTest();
  })();
}