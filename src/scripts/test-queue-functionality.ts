import { config } from 'dotenv';
import { serverSupabase } from '@/lib/serverSupabase';
import { DownloadWorker } from '@/lib/telegram/download-worker';

// Загружаем переменные окружения
config({ path: '.env' });

/**
 * Тестовый скрипт для проверки функциональности очереди
 * 
 * Использование:
 * npx tsx src/scripts/test-queue-functionality.ts
 */

async function testQueueFunctionality() {
  try {
    console.log('🚀 Тестирование функциональности очереди...\n');

    // 1. Проверим текущее состояние очереди
    console.log('1. Проверка текущего состояния очереди...');
    const { data: currentTasks, error: currentTasksError } = await serverSupabase
      .from('telegram_download_queue')
      .select('*')
      .limit(5);

    if (currentTasksError) {
      console.error('❌ Ошибка при получении текущих задач:', currentTasksError);
      process.exit(1);
    }

    console.log(`  Найдено ${currentTasks?.length || 0} задач в очереди`);

    // 2. Добавим тестовую задачу
    console.log('\n2. Добавление тестовой задачи...');
    const worker = await DownloadWorker.getInstance();
    await worker.addTask('test_message_123', 'test_channel_456', 1);
    console.log('  ✅ Тестовая задача добавлена');

    // 3. Проверим, что задача добавлена
    console.log('\n3. Проверка добавления задачи...');
    const { data: newTasks, error: newTasksError } = await serverSupabase
      .from('telegram_download_queue')
      .select('*')
      .eq('message_id', 'test_message_123')
      .eq('channel_id', 'test_channel_456');

    if (newTasksError) {
      console.error('❌ Ошибка при проверке добавленной задачи:', newTasksError);
      process.exit(1);
    }

    if (newTasks && newTasks.length > 0) {
      const task: any = newTasks[0];
      console.log('  ✅ Задача успешно добавлена в очередь');
      console.log(`    ID: ${task.id}`);
      console.log(`    Status: ${task.status}`);
    } else {
      console.log('  ❌ Задача не найдена в очереди');
    }

    // 4. Проверим статус воркера
    console.log('\n4. Проверка статуса воркера...');
    // Поскольку у нас нет прямого способа проверить статус воркера без запуска,
    // просто покажем, что экземпляр можно получить
    const workerInstance = await DownloadWorker.getInstance();
    console.log('  ✅ Экземпляр воркера успешно получен');

    console.log('\n✅ Тестирование функциональности очереди завершено успешно!');
    console.log('\n💡 Следующие шаги:');
    console.log('   - Запустите воркер: npm run start-download-worker');
    console.log('   - Проверьте очередь: npm run check-download-queue');
    console.log('   - Добавьте задачу: npm run add-to-download-queue <messageId> <channelId> [priority]');

  } catch (error) {
    console.error('❌ Ошибка при тестировании функциональности очереди:', error);
    process.exit(1);
  }
}

// Выполняем тестирование
testQueueFunctionality();