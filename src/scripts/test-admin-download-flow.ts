import { taskManager } from '../lib/task-manager';
import { BackgroundDownloadHandler } from '../lib/background-download';

/**
 * Тестовый скрипт для проверки полного цикла загрузки файлов как в админке
 */
async function testAdminDownloadFlow() {
  console.log('🚀 Запуск теста полного цикла загрузки файлов');
  
  // Создаем тестовую задачу
  const operationId = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`📝 Создание задачи с ID: ${operationId}`);
  
  // Создаем задачу через taskManager (как в API endpoint'е)
  taskManager.createTask(operationId);
  console.log(`✅ Задача создана`);
  
  // Проверяем, что задача доступна (как в админке при polling'е)
  const taskStatus = taskManager.getTaskStatus(operationId);
  if (!taskStatus) {
    console.error(`❌ Ошибка: Задача не найдена (Operation not found)`);
    return;
  }
  console.log(`✅ Задача найдена:`, taskStatus);
  
  // Обновляем статус задачи на "running"
  taskManager.updateTaskStatus(operationId, 'running', '📥 Получение списка файлов для загрузки...');
  console.log(`🔄 Статус задачи обновлен на "running"`);
  
  // Симулируем фоновую загрузку (как в BackgroundDownloadHandler)
  console.log(`📥 Запуск фоновой загрузки...`);
  
  // Обновляем прогресс
  taskManager.updateTaskProgress(operationId, 0, '📥 Найдено 3 файлов для загрузки. Начинаем загрузку...');
  console.log(`📊 Прогресс обновлен до 0%`);
  
  // Симулируем загрузку файлов
  for (let i = 1; i <= 3; i++) {
    const progress = Math.round((i / 3) * 100);
    const message = `📥 Загрузка файла ${i}/3: test-file-${i}.fb2 (ID: ${1000 + i})`;
    taskManager.updateTaskProgress(operationId, progress, message);
    console.log(`📊 Прогресс обновлен до ${progress}%: ${message}`);
    
    // Добавляем небольшую задержку для реалистичности
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Завершаем задачу
  const finalMessage = `🏁 Завершено: Успешно: 3 | Ошибки: 0 | Пропущено: 0 | Всего: 3`;
  taskManager.updateTaskStatus(operationId, 'completed', finalMessage);
  taskManager.updateTaskProgress(operationId, 100, finalMessage, {
    successCount: 3,
    failedCount: 0,
    skippedCount: 0,
    totalFiles: 3,
    results: [
      { filename: 'test-file-1.fb2', success: true },
      { filename: 'test-file-2.fb2', success: true },
      { filename: 'test-file-3.fb2', success: true }
    ]
  });
  console.log(`✅ Задача завершена`);
  
  // Проверяем финальный статус (как в админке при polling'е)
  const finalTaskStatus = taskManager.getTaskStatus(operationId);
  if (!finalTaskStatus) {
    console.error(`❌ Ошибка: Задача не найдена после завершения (Operation not found)`);
    return;
  }
  console.log(`✅ Финальный статус задачи:`, finalTaskStatus);
  
  console.log('\n🏁 Тест полного цикла загрузки файлов пройден успешно!');
}

// Запуск теста
if (require.main === module) {
  testAdminDownloadFlow().catch(console.error);
}