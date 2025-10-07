/**
 * Скрипт для проверки информации о конкретном файле по ID сообщения
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем .env из корня проекта
config({ path: path.resolve(process.cwd(), '.env') });

async function checkFileInfo(messageId: number) {
  console.log(`🚀 Проверка информации о файле с Message ID: ${messageId}`);
  
  try {
    // Создаем клиент Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Проверяем запись в таблице telegram_processed_messages
    const { data: processedRecord, error: processedError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .eq('message_id', messageId.toString())
      .single();
      
    if (processedError) {
      console.log('❌ Ошибка при получении записи из telegram_processed_messages:', processedError.message);
      return;
    }
    
    if (!processedRecord) {
      console.log('❌ Запись в telegram_processed_messages не найдена');
      return;
    }
    
    console.log('📋 Запись в telegram_processed_messages:');
    console.log(`   ID: ${processedRecord.id}`);
    console.log(`   Book ID: ${processedRecord.book_id}`);
    console.log(`   Message ID: ${processedRecord.message_id}`);
    console.log(`   Telegram File ID: ${processedRecord.telegram_file_id || 'Не загружен'}`);
    console.log(`   Processed At: ${processedRecord.processed_at}`);
    
    // Получаем информацию о книге
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', processedRecord.book_id)
      .single();
      
    if (bookError) {
      console.log('❌ Ошибка при получении информации о книге:', bookError.message);
      return;
    }
    
    console.log('\n📖 Информация о книге:');
    console.log(`   ID: ${book.id}`);
    console.log(`   Название: ${book.title}`);
    console.log(`   Автор: ${book.author}`);
    console.log(`   URL файла: ${book.file_url || 'Не загружен'}`);
    console.log(`   Путь хранения: ${book.storage_path || 'Не загружен'}`);
    console.log(`   Формат: ${book.file_format || 'Не указан'}`);
    
    // Форматируем размер файла
    if (book.file_size) {
      const fileSize = typeof book.file_size === 'number' ? 
        `${Math.round(book.file_size / 1024)} КБ` : 
        book.file_size;
      console.log(`   Размер: ${fileSize}`);
    }
    
    console.log(`   Telegram File ID: ${book.telegram_file_id || 'Не загружен'}`);
    
    // Если файл загружен, проверим его в Storage
    if (book.storage_path) {
      console.log('\n☁️ Информация о файле в Storage:');
      console.log(`   Путь: ${book.storage_path}`);
      console.log(`   Формат: ${book.file_format}`);
      
      // Проверим расширение файла
      const ext = path.extname(book.storage_path).toLowerCase();
      if (ext === '.fb2') {
        console.log(`   Тип: FB2 (FictionBook 2.0)`);
      } else if (ext === '.zip') {
        console.log(`   Тип: ZIP архив`);
      } else {
        console.log(`   Тип: ${ext.substring(1).toUpperCase()} (нестандартный формат)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка проверки информации о файле:', error);
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  // Проверяем аргументы командной строки
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('❌ Необходимо указать ID сообщения');
    console.error('Использование: npx tsx src/scripts/check-file-info.ts <messageId>');
    console.error('Пример: npx tsx src/scripts/check-file-info.ts 4434');
    process.exit(1);
  }
  
  const messageId = parseInt(args[0], 10);
  if (isNaN(messageId)) {
    console.error('❌ Неверный формат ID сообщения');
    console.error('ID должен быть числом');
    process.exit(1);
  }
  
  // Запускаем проверку
  checkFileInfo(messageId);
}