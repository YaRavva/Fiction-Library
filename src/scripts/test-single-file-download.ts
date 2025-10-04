/**
 * Тестовый скрипт для проверки загрузки одного файла из Telegram
 * Проверяет корректность имени файла и добавление URL в запись книги
 *
 * Использование:
 * npx tsx src/scripts/test-single-file-download.ts
 */

// Загружаем переменные окружения ПЕРВЫМ делом
import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Проверяем, что переменные загружены
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Ошибка: Переменные окружения не загружены из .env файла');
  console.error('Проверьте, что файл .env существует в корне проекта');
  process.exit(1);
}

import { TelegramSyncService } from '../lib/telegram/sync.js';
import { createClient } from '@supabase/supabase-js';

async function testSingleFileDownload() {
  console.log('🚀 Запускаем тест загрузки одного файла...\n');

  let syncService: TelegramSyncService | null = null;
  
  try {
    // Создаем клиент Supabase для проверки результатов
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Создаем экземпляр TelegramSyncService
    syncService = await TelegramSyncService.getInstance();
    
    console.log('✅ Telegram клиент инициализирован');
    
    // Тестируем загрузку одного файла
    console.log('📥 Начинаем загрузку одного файла...');
    const results = await syncService.downloadAndProcessFilesDirectly(1);
    
    console.log('\n📊 Результаты загрузки:');
    console.log(JSON.stringify(results, null, 2));
    
    if (results && results.length > 0) {
      const result = results[0];
      if (result.success) {
        console.log(`\n✅ Файл успешно загружен:`);
        console.log(`  Имя файла: ${result.filename}`);
        console.log(`  Размер: ${result.fileSize} байт`);
        console.log(`  URL: ${result.fileUrl}`);
        
        // Проверяем запись в базе данных
        console.log('\n🔍 Проверяем запись в базе данных...');
        
        const { data: book, error } = await supabase
          .from('books')
          .select('*')
          .eq('telegram_file_id', result.messageId.toString())
          .single();
          
        if (error) {
          console.warn('⚠️  Ошибка при получении записи книги:', error);
        } else if (book) {
          console.log('✅ Найдена запись книги в базе данных:');
          console.log(`  ID: ${book.id}`);
          console.log(`  Название: ${book.title}`);
          console.log(`  Автор: ${book.author}`);
          console.log(`  URL файла: ${book.file_url}`);
          console.log(`  Путь хранения: ${book.storage_path}`);
          console.log(`  Формат: ${book.file_format}`);
          console.log(`  Размер: ${book.file_size} байт`);
          console.log(`  Telegram ID: ${book.telegram_file_id}`);
          
          // Проверяем, что URL файла совпадает
          if (book.file_url === result.fileUrl) {
            console.log('✅ URL файла в базе данных совпадает с URL загрузки');
          } else {
            console.warn('⚠️  URL файла в базе данных НЕ совпадает с URL загрузки');
            console.log(`  URL в базе: ${book.file_url}`);
            console.log(`  URL загрузки: ${result.fileUrl}`);
          }
          
          // Проверяем, что путь хранения правильный (без вложенной папки)
          if (book.storage_path === result.filename) {
            console.log('✅ Путь хранения правильный (без вложенной папки)');
          } else {
            console.warn('⚠️  Путь хранения может быть неправильным');
            console.log(`  Путь в базе: ${book.storage_path}`);
            console.log(`  Ожидаемый путь: ${result.filename}`);
          }
        } else {
          console.warn('⚠️  Запись книги не найдена в базе данных');
        }
      } else {
        console.error('❌ Ошибка при загрузке файла:', result.error);
      }
    } else {
      console.log('ℹ️  Нет файлов для загрузки');
    }
    
    console.log('\n✅ Тест завершен успешно');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании загрузки файла:', error);
    process.exit(1);
  } finally {
    // Завершаем работу клиента
    if (syncService) {
      try {
        await syncService.shutdown();
        console.log('🔌 Telegram клиент отключен');
      } catch (shutdownError) {
        console.warn('⚠️  Ошибка при отключении Telegram клиента:', shutdownError);
      }
    }
  }
}

// Запускаем тест
testSingleFileDownload();