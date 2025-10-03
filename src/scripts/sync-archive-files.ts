/**
 * Скрипт для синхронизации файлов из канала "Архив для фантастики"
 *
 * Использование:
 * npx tsx src/scripts/sync-archive-files.ts [--limit=N] [--no-queue]
 */

import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Проверяем, что переменные загружены
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Ошибка: Переменные окружения не загружены из .env файла');
  console.error('Проверьте, что файл .env существует в корне проекта');
  process.exit(1);
}

import { TelegramSyncService } from '../lib/telegram/sync.js';

async function syncArchiveFiles() {
  // Парсим аргументы командной строки
  const args = process.argv.slice(2);
  let limit = 10;
  let addToQueue = true;
  
  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1]) || 10;
    } else if (arg === '--no-queue') {
      addToQueue = false;
    }
  }
  
  console.log('🚀 Начинаем синхронизацию файлов из канала "Архив для фантастики"...\n');
  console.log(`   Лимит сообщений: ${limit}`);
  console.log(`   Добавлять в очередь: ${addToQueue ? 'Да' : 'Нет'}\n`);

  try {
    // Инициализируем сервис синхронизации
    console.log('📡 Подключаемся к Telegram...');
    const syncService = await TelegramSyncService.getInstance();
    console.log('✅ Подключение установлено\n');

    // Сканируем канал и добавляем файлы в очередь
    console.log('📚 Сканируем канал "Архив для фантастики"...');
    const results = await syncService.downloadFilesFromArchiveChannel(limit, addToQueue);
    
    console.log(`\n✅ Обработано файлов: ${results.length}`);
    
    // Выводим информацию о каждом файле
    results.forEach((file, index) => {
      console.log(`\n📁 Файл ${index + 1}:`);
      console.log(`   ID сообщения: ${file.messageId}`);
      console.log(`   Имя файла: ${file.filename}`);
      console.log(`   Добавлен в очередь: ${file.addedToQueue ? 'Да' : 'Нет'}`);
    });

    console.log('\n✅ Синхронизация завершена успешно!');
    
    // Закрываем соединение
    await syncService.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при синхронизации:', error);
    process.exit(1);
  }
}

// Запускаем синхронизацию
syncArchiveFiles();