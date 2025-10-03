/**
 * Скрипт для запуска worker'а загрузки файлов из очереди
 *
 * Использование:
 * npx tsx src/scripts/start-download-worker.ts
 */

// Загружаем переменные окружения ПЕРВЫМ делом
import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env из корна проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Проверяем, что переменные загружены
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ Ошибка: Переменные окружения не загружены из .env файла');
  console.error('Проверьте, что файл .env существует в корне проекта');
  process.exit(1);
}

import { DownloadWorker } from '../lib/telegram/worker.js';

async function startDownloadWorker() {
  console.log('🚀 Запускаем worker загрузки файлов...\n');

  try {
    // Создаем и запускаем worker
    const worker = new DownloadWorker();
    
    // Обработчик сигналов для корректного завершения
    const shutdown = async () => {
      console.log('\n🛑 Получен сигнал завершения, останавливаем worker...');
      worker.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    console.log('✅ Worker запущен и готов обрабатывать очередь загрузок');
    console.log('ℹ️  Для остановки нажмите Ctrl+C\n');
    
    // Запускаем worker
    await worker.start();
    
  } catch (error) {
    console.error('❌ Ошибка при запуске worker\'а:', error);
    process.exit(1);
  }
}

// Запускаем worker
startDownloadWorker();