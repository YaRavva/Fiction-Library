import { config } from 'dotenv';
// Отключаем импорт DownloadWorker
// import { DownloadWorker } from '@/lib/telegram/download-worker';

// Загружаем переменные окружения
config({ path: '.env' });

/**
 * Скрипт для добавления задач в очередь загрузки файлов
 * 
 * Использование:
 * npx tsx src/scripts/add-to-download-queue.ts <messageId> <channelId> [priority]
 * 
 * Пример:
 * npx tsx src/scripts/add-to-download-queue.ts 123456789 987654321 10
 */

async function addToDownloadQueue() {
  // Отключаем добавление задач в очередь
  console.log('⚠️  Добавление задач в очередь загрузки файлов отключено');
  console.log('ℹ️  Используется старый метод с file-service.ts');
  process.exit(0);
  
  /*
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('❌ Ошибка: Необходимо указать messageId и channelId');
    console.log('Использование: npx tsx src/scripts/add-to-download-queue.ts <messageId> <channelId> [priority]');
    process.exit(1);
  }

  const messageId = args[0];
  const channelId = args[1];
  const priority = args[2] ? parseInt(args[2]) : 0;

  try {
    console.log(`🚀 Добавление задачи в очередь загрузки...`);
    console.log(`  Message ID: ${messageId}`);
    console.log(`  Channel ID: ${channelId}`);
    console.log(`  Priority: ${priority}`);

    // Получаем экземпляр воркера
    const worker = await DownloadWorker.getInstance();
    
    // Добавляем задачу в очередь
    await worker.addTask(messageId, channelId, priority);
    
    console.log('✅ Задача успешно добавлена в очередь');
  } catch (error) {
    console.error('❌ Ошибка при добавлении задачи в очередь:', error);
    process.exit(1);
  }
  */
}

// Выполняем добавление в очередь
addToDownloadQueue();