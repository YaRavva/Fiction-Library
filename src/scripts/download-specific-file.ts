/**
 * Скрипт для загрузки конкретного файла из Telegram по его ID
 * Использует метод downloadBook для загрузки файла и проверки результата
 *
 * Использование:
 * npx tsx src/scripts/download-specific-file.ts <messageId>
 * Пример: npx tsx src/scripts/download-specific-file.ts 4379
 */

// Загружаем переменные окружения
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

async function downloadSpecificFile(messageId: number) {
  console.log(`🚀 Загружаем файл с ID сообщения: ${messageId}\n`);

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
    
    // Загружаем конкретный файл
    console.log(`📥 Начинаем загрузку файла с ID ${messageId}...`);
    const buffer = await syncService.downloadBook(messageId);
    
    console.log(`\n✅ Файл успешно загружен:`);
    console.log(`  Размер: ${buffer.length} байт`);
    
    // Проверяем запись в базе данных
    console.log('\n🔍 Проверяем запись в базе данных...');
    
    const { data: book, error } = await supabase
      .from('books')
      .select('*')
      .eq('telegram_file_id', messageId.toString())
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
    } else {
      console.warn('⚠️  Запись книги не найдена в базе данных');
    }
    
    console.log('\n✅ Загрузка файла завершена успешно');
    
  } catch (error) {
    console.error('❌ Ошибка при загрузке файла:', error);
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

// Проверяем аргументы командной строки
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Необходимо указать ID сообщения');
  console.error('Использование: npx tsx src/scripts/download-specific-file.ts <messageId>');
  console.error('Пример: npx tsx src/scripts/download-specific-file.ts 4379');
  process.exit(1);
}

const messageId = parseInt(args[0], 10);
if (isNaN(messageId)) {
  console.error('❌ Неверный формат ID сообщения');
  console.error('ID должен быть числом');
  process.exit(1);
}

// Запускаем загрузку файла
downloadSpecificFile(messageId);