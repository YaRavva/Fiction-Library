/**
 * Скрипт для тестирования синхронизации с Telegram
 *
 * Использование:
 * npx tsx src/scripts/test-sync.ts
 */

// Загружаем переменные окружения ПЕРВЫМ делом
import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Проверяем, что переменные загружены
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ Ошибка: Переменные окружения не загружены из .env файла');
  console.error('Проверьте, что файл .env существует в корне проекта');
  process.exit(1);
}

import { TelegramSyncService } from '../lib/telegram/sync.js';
import { MetadataParser } from '../lib/telegram/parser.js';

async function testSync() {
  console.log('🚀 Начинаем тестирование синхронизации с Telegram...\n');

  try {
    // Инициализируем сервис синхронизации
    console.log('📡 Подключаемся к Telegram...');
    const syncService = await TelegramSyncService.getInstance();
    console.log('✅ Подключение установлено\n');

    // Получаем метаданные из канала
    console.log('📚 Получаем метаданные из канала...');
    const limit = 5; // Тестируем на 5 сообщениях
    const metadata = await syncService.syncMetadata(limit);
    
    console.log(`✅ Получено ${metadata.length} записей\n`);

    // Выводим информацию о каждой книге
    metadata.forEach((book, index) => {
      console.log(`📖 Книга ${index + 1}:`);
      console.log(`   Название: ${book.title}`);
      console.log(`   Автор: ${book.author}`);
      if (book.series) {
        console.log(`   Серия: ${book.series}`);
      }
      if (book.rating) {
        console.log(`   Рейтинг: ${book.rating}`);
      }
      if (book.genres.length > 0) {
        console.log(`   Жанры: ${book.genres.join(', ')}`);
      }
      if (book.tags.length > 0) {
        console.log(`   Теги: ${book.tags.join(', ')}`);
      }
      if (book.description) {
        console.log(`   Описание: ${book.description.substring(0, 100)}...`);
      }
      console.log('');
    });

    console.log('✅ Тестирование завершено успешно!');
    
    // Закрываем соединение
    await syncService.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
    process.exit(1);
  }
}

// Запускаем тест
testSync();

