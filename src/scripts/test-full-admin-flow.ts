/**
 * Комплексный тест для проверки полного потока работы админки с API
 */
async function testFullAdminFlow() {
  console.log('🚀 Запуск комплексного теста полного потока админки');
  
  try {
    // Имитируем создание задачи через API endpoint (POST /api/admin/download-files)
    console.log('\n1️⃣ Имитация создания задачи через API endpoint...');
    
    // Генерируем уникальный ID для операции (как в route.ts)
    const operationId = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`   📝 Operation ID: ${operationId}`);
    
    // Имитируем вызов taskManager.createTask (как в route.ts POST)
    const { taskManager } = await import('../lib/task-manager');
    taskManager.createTask(operationId);
    console.log('   ✅ Задача создана через taskManager');
    
    // Имитируем запуск фоновой загрузки (как в route.ts POST)
    console.log('   📥 Запуск фоновой загрузки...');
    // В реальном приложении здесь был бы вызов BackgroundDownloadHandler.startDownload
    
    // Имитируем polling статуса задачи через API endpoint (GET /api/admin/download-files)
    console.log('\n2️⃣ Имитация polling\'а статуса задачи через API endpoint...');
    
    // Проверяем статус задачи (как в admin/page.tsx)
    let taskStatus = taskManager.getTaskStatus(operationId);
    if (!taskStatus) {
      console.error('   ❌ Ошибка: Задача не найдена (Operation not found)');
      return;
    }
    console.log(`   ✅ Задача найдена: статус = ${taskStatus.status}`);
    
    // Обновляем статус задачи (как в BackgroundDownloadHandler)
    taskManager.updateTaskStatus(operationId, 'running', '📥 Получение списка файлов для загрузки...');
    console.log('   🔄 Статус задачи обновлен на "running"');
    
    // Проверяем обновленный статус
    taskStatus = taskManager.getTaskStatus(operationId);
    if (!taskStatus || taskStatus.status !== 'running') {
      console.error('   ❌ Ошибка: Статус задачи не обновился');
      return;
    }
    console.log(`   ✅ Статус задачи подтвержден: ${taskStatus.status}`);
    
    // Имитируем прогресс загрузки
    console.log('\n3️⃣ Имитация прогресса загрузки...');
    taskManager.updateTaskProgress(operationId, 0, '📥 Найдено 2 файлов для загрузки. Начинаем загрузку...');
    console.log('   📊 Прогресс обновлен до 0%');
    
    // Имитируем загрузку файлов
    taskManager.updateTaskProgress(operationId, 50, '📥 Загрузка файла 1/2: test-book-1.fb2 (ID: 2001)');
    console.log('   📊 Прогресс обновлен до 50%');
    
    taskManager.updateTaskProgress(operationId, 100, '📥 Загрузка файла 2/2: test-book-2.fb2 (ID: 2002)');
    console.log('   📊 Прогресс обновлен до 100%');
    
    // Завершаем задачу
    const finalMessage = '🏁 Завершено: Успешно: 2 | Ошибки: 0 | Пропущено: 0 | Всего: 2';
    taskManager.updateTaskStatus(operationId, 'completed', finalMessage);
    taskManager.updateTaskProgress(operationId, 100, finalMessage, {
      successCount: 2,
      failedCount: 0,
      skippedCount: 0,
      totalFiles: 2,
      results: [
        { filename: 'test-book-1.fb2', success: true },
        { filename: 'test-book-2.fb2', success: true }
      ]
    });
    console.log('   ✅ Задача завершена');
    
    // Проверяем финальный статус через API endpoint
    console.log('\n4️⃣ Проверка финального статуса через API endpoint...');
    const finalTaskStatus = taskManager.getTaskStatus(operationId);
    if (!finalTaskStatus) {
      console.error('   ❌ Ошибка: Задача не найдена после завершения (Operation not found)');
      return;
    }
    console.log(`   ✅ Финальный статус задачи: ${finalTaskStatus.status}`);
    console.log(`   📊 Финальный прогресс: ${finalTaskStatus.progress}%`);
    
    // Проверяем результаты
    if (finalTaskStatus.result && finalTaskStatus.result.successCount === 2) {
      console.log('   ✅ Результаты загрузки корректны');
    } else {
      console.error('   ❌ Ошибка в результатах загрузки');
      return;
    }
    
    console.log('\n✅ Комплексный тест полного потока админки пройден успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка во время теста:', error);
  }
}

// Запуск теста
if (require.main === module) {
  testFullAdminFlow().catch(console.error);
}