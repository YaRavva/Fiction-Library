/**
 * Тестовый скрипт для проверки загрузки файлов из Telegram
 *
 * Использование:
 * npx tsx src/scripts/test-file-download.ts
 */

// Загружаем переменные окружения ПЕРВЫМ делом
import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env из корна проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Проверяем, что переменные загружены
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Ошибка: Переменные окружения не загружены из .env файла');
  console.error('Проверьте, что файл .env существует в корне проекта');
  process.exit(1);
}

import { TelegramSyncService } from '../lib/telegram/sync.js';

async function testFileDownload() {
  console.log('🚀 Запускаем тест загрузки файлов...\n');

  try {
    // Создаем экземпляр TelegramSyncService
    const syncService = await TelegramSyncService.getInstance();
    
    console.log('✅ Telegram клиент инициализирован');
    
    // Тестируем загрузку файлов (ограничиваем до 3 файлов для теста)
    console.log('📥 Начинаем загрузку файлов (максимум 3 файла)...');
    const results = await syncService.downloadAndProcessFilesDirectly(3);
    
    console.log('\n📊 Результаты загрузки:');
    console.log(JSON.stringify(results, null, 2));
    
    console.log('\n✅ Тест завершен успешно');
    
    // Завершаем работу клиента
    await syncService.shutdown();
    console.log('🔌 Telegram клиент отключен');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании загрузки файлов:', error);
    process.exit(1);
  }
}

// Запускаем тест
testFileDownload();