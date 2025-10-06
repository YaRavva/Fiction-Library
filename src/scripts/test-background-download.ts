import { taskManager } from '../lib/task-manager';
import { BackgroundDownloadHandler } from '../lib/background-download';
import { monitorDownloadTask } from './monitor-download-task';

async function testBackgroundDownload() {
  try {
    console.log('🚀 Тестирование фоновой загрузки файлов...');
    
    // Создаем ID задачи
    const taskId = `test-download-${Date.now()}`;
    
    // Создаем задачу
    taskManager.createTask(taskId);
    console.log(`✅ Создана задача ${taskId}`);
    
    // Регистрируем callback для прогресса
    taskManager.registerProgressCallback(taskId, (progress) => {
      console.log(`[${progress.progress}%] ${progress.message}`);
    });
    
    // Запускаем фоновую загрузку в отдельном потоке
    setImmediate(() => {
      BackgroundDownloadHandler.startDownload(taskId, 3); // Тестируем с 3 файлами
    });
    
    console.log('📥 Запущена фоновая загрузка файлов...');
    
    // Мониторим прогресс задачи
    await monitorDownloadTask(taskId, 1000);
    
    console.log('✅ Тестирование завершено!');
    
    // Получаем финальный статус задачи
    const finalStatus = taskManager.getTaskStatus(taskId);
    if (finalStatus) {
      console.log(`📊 Финальный статус: ${finalStatus.status}`);
      console.log(`📊 Сообщение: ${finalStatus.message}`);
      console.log(`📊 Прогресс: ${finalStatus.progress}%`);
    }
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    await testBackgroundDownload();
  })();
}