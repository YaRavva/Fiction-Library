import { taskManager } from '../lib/task-manager';

/**
 * Тестовый скрипт для проверки исправления ошибки "Operation not found"
 */
async function testDownloadFix() {
  console.log('🚀 Запуск теста исправления ошибки "Operation not found"');
  
  // Создаем тестовую задачу
  const testOperationId = `test-download-${Date.now()}`;
  console.log(`📝 Создание тестовой задачи с ID: ${testOperationId}`);
  
  const task = taskManager.createTask(testOperationId);
  console.log(`✅ Задача создана:`, task);
  
  // Проверяем, что задача доступна
  const retrievedTask = taskManager.getTaskStatus(testOperationId);
  if (retrievedTask) {
    console.log(`✅ Задача успешно найдена:`, retrievedTask);
  } else {
    console.error(`❌ Задача не найдена после создания`);
    return;
  }
  
  // Обновляем статус задачи
  taskManager.updateTaskStatus(testOperationId, 'running', 'Тестовый процесс загрузки');
  console.log(`🔄 Статус задачи обновлен на "running"`);
  
  // Проверяем обновленный статус
  const updatedTask = taskManager.getTaskStatus(testOperationId);
  if (updatedTask && updatedTask.status === 'running') {
    console.log(`✅ Статус задачи успешно обновлен: ${updatedTask.status}`);
  } else {
    console.error(`❌ Ошибка обновления статуса задачи`);
    return;
  }
  
  // Обновляем прогресс задачи
  taskManager.updateTaskProgress(testOperationId, 50, 'Половина загрузки завершена');
  console.log(`📊 Прогресс задачи обновлен до 50%`);
  
  // Проверяем обновленный прогресс
  const progressTask = taskManager.getTaskStatus(testOperationId);
  if (progressTask && progressTask.progress === 50) {
    console.log(`✅ Прогресс задачи успешно обновлен: ${progressTask.progress}%`);
  } else {
    console.error(`❌ Ошибка обновления прогресса задачи`);
    return;
  }
  
  // Завершаем задачу
  taskManager.updateTaskStatus(testOperationId, 'completed', 'Тест завершен успешно');
  console.log(`✅ Задача завершена`);
  
  // Проверяем финальный статус
  const finalTask = taskManager.getTaskStatus(testOperationId);
  if (finalTask && finalTask.status === 'completed') {
    console.log(`✅ Тест пройден успешно!`);
  } else {
    console.error(`❌ Ошибка завершения задачи`);
    return;
  }
  
  console.log('\n🏁 Все тесты пройдены успешно!');
}

// Запуск теста
if (require.main === module) {
  testDownloadFix().catch(console.error);
}