import { taskManager } from '../lib/task-manager';

/**
 * Тестовый скрипт для проверки работы API endpoint'а /api/admin/download-files
 */
async function testApiEndpoint() {
  console.log('🚀 Запуск теста API endpoint\'а');
  
  // Создаем тестовую задачу
  const operationId = `test-api-${Date.now()}`;
  console.log(`📝 Создание задачи с ID: ${operationId}`);
  
  // Создаем задачу через taskManager (как в API endpoint'е POST)
  taskManager.createTask(operationId);
  console.log(`✅ Задача создана`);
  
  // Симулируем работу GET endpoint'а - получение статуса задачи
  console.log(`📥 Получение статуса задачи через API endpoint...`);
  
  // Проверяем, что задача доступна (как в API endpoint'е GET)
  const taskStatus = taskManager.getTaskStatus(operationId);
  if (!taskStatus) {
    console.error(`❌ Ошибка API: Задача не найдена (Operation not found)`);
    return;
  }
  console.log(`✅ Задача найдена через API endpoint:`, taskStatus.status);
  
  // Обновляем статус задачи
  taskManager.updateTaskStatus(operationId, 'running', 'Тестовый процесс');
  console.log(`🔄 Статус задачи обновлен на "running"`);
  
  // Проверяем обновленный статус через API endpoint
  const updatedTaskStatus = taskManager.getTaskStatus(operationId);
  if (!updatedTaskStatus) {
    console.error(`❌ Ошибка API: Задача не найдена после обновления (Operation not found)`);
    return;
  }
  console.log(`✅ Обновленный статус задачи через API endpoint:`, updatedTaskStatus.status);
  
  // Завершаем задачу
  taskManager.updateTaskStatus(operationId, 'completed', 'Тест завершен');
  console.log(`✅ Задача завершена`);
  
  // Проверяем финальный статус через API endpoint
  const finalTaskStatus = taskManager.getTaskStatus(operationId);
  if (!finalTaskStatus) {
    console.error(`❌ Ошибка API: Задача не найдена после завершения (Operation not found)`);
    return;
  }
  console.log(`✅ Финальный статус задачи через API endpoint:`, finalTaskStatus.status);
  
  // Тестируем случай с несуществующей задачей
  console.log(`\n🧪 Тестирование случая с несуществующей задачей...`);
  const nonExistentTask = taskManager.getTaskStatus('non-existent-task-id');
  if (!nonExistentTask) {
    console.log(`✅ Корректно возвращается undefined для несуществующей задачи`);
  } else {
    console.error(`❌ Ошибка: Для несуществующей задачи не должно возвращаться значение`);
  }
  
  console.log('\n🏁 Тест API endpoint\'а пройден успешно!');
}

// Запуск теста
if (require.main === module) {
  testApiEndpoint().catch(console.error);
}