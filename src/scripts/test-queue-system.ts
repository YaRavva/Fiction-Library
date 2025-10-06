import { config } from 'dotenv';
import { DownloadWorker } from '@/lib/telegram/download-worker';
import { DownloadQueue } from '@/lib/telegram/queue';
import { serverSupabase } from '@/lib/serverSupabase';

// Загружаем переменные окружения
config({ path: '.env' });

/**
 * Тестовый скрипт для проверки работы системы очередей
 * 
 * Использование:
 * npx tsx src/scripts/test-queue-system.ts [command]
 * 
 * Команды:
 * - add-tasks [count] - добавить тестовые задачи
 * - start-worker - запустить воркер
 * - check-queue - проверить статус очереди
 * - clear-queue - очистить очередь
 */

async function testQueueSystem() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  try {
    switch (command) {
      case 'add-tasks':
        const count = args[1] ? parseInt(args[1]) : 5;
        await addTestTasks(count);
        break;
        
      case 'start-worker':
        await startWorker();
        break;
        
      case 'check-queue':
        await checkQueue();
        break;
        
      case 'clear-queue':
        await clearQueue();
        break;
        
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

async function addTestTasks(count: number) {
  console.log(`🚀 Добавление ${count} тестовых задач в очередь...\n`);
  
  const worker = await DownloadWorker.getInstance();
  
  for (let i = 1; i <= count; i++) {
    try {
      const messageId = `test_message_${Date.now()}_${i}`;
      const channelId = 'test_channel';
      
      await worker.addTask(messageId, channelId, 0);
      console.log(`✅ Задача ${i} добавлена: ${messageId}`);
    } catch (error) {
      console.error(`❌ Ошибка добавления задачи ${i}:`, error);
    }
  }
  
  console.log(`\n✅ Добавлено ${count} тестовых задач`);
}

async function startWorker() {
  // Отключаем запуск воркера
  console.log('⚠️  Воркер загрузки файлов отключен');
  console.log('ℹ️  Используется старый метод с file-service.ts');
  process.exit(0);
  
  /*
  console.log('🚀 Запуск воркера обработки очереди...\n');
  
  const worker = await DownloadWorker.getInstance();
  
  // Запускаем воркер с интервалом 10 секунд для тестирования
  await worker.start(10000);
  
  console.log('✅ Воркер запущен. Нажмите Ctrl+C для остановки.');
  
  // Обработчик сигналов для корректного завершения
  const shutdown = async () => {
    console.log('\n🛑 Остановка воркера...');
    await worker.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  // Держим процесс активным
  await new Promise(() => {});
  */
}

async function checkQueue() {
  console.log('🔍 Проверка статуса очереди...\n');
  
  // Получаем статистику очереди напрямую через Supabase
  const { data: allTasks, error: allTasksError } = await serverSupabase
    .from('telegram_download_queue')
    .select('status');

  if (allTasksError) {
    console.error('❌ Ошибка получения статистики:', allTasksError);
    return;
  }

  // Группируем задачи по статусам
  const statusStats: Record<string, number> = {};
  if (allTasks) {
    allTasks.forEach((task: any) => {
      statusStats[task.status] = (statusStats[task.status] || 0) + 1;
    });
  }

  console.log('📊 Статистика очереди:');
  for (const [status, count] of Object.entries(statusStats)) {
    console.log(`  ${status}: ${count}`);
  }
  
  // Получаем активные задачи
  const queue = new DownloadQueue();
  const activeTasks = await queue.getActiveTasks(10);
  
  if (activeTasks.length > 0) {
    console.log(`\n📥 Активные задачи (${activeTasks.length}):`);
    activeTasks.forEach((task, index) => {
      console.log(`  ${index + 1}. ID: ${task.id.slice(0, 8)}...`);
      console.log(`     Сообщение: ${task.message_id}`);
      console.log(`     Статус: ${task.status}`);
      console.log(`     Создан: ${new Date(task.created_at).toLocaleString()}`);
      console.log('');
    });
  } else {
    console.log('\n📭 Нет активных задач');
  }
}

async function clearQueue() {
  console.log('🗑️ Очистка очереди...\n');
  
  const { error } = await serverSupabase
    .from('telegram_download_queue')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Условие, которое всегда истинно
  
  if (error) {
    console.error('❌ Ошибка очистки очереди:', error);
    return;
  }
  
  console.log('✅ Очередь очищена');
}

function showHelp() {
  console.log(`
📚 Тестовая система очередей Telegram

Использование:
  npx tsx src/scripts/test-queue-system.ts [command]

Команды:
  add-tasks [count]    Добавить тестовые задачи (по умолчанию 5)
  start-worker         Запустить воркер обработки очереди
  check-queue          Проверить статус очереди
  clear-queue          Очистить очередь
  help                 Показать эту справку

Примеры:
  npx tsx src/scripts/test-queue-system.ts add-tasks 10
  npx tsx src/scripts/test-queue-system.ts start-worker
  npx tsx src/scripts/test-queue-system.ts check-queue
`);
}

// Выполняем тест
testQueueSystem();