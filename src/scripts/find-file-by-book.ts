/**
 * Скрипт для поиска файла по названию книги в базе данных
 * и получения ID сообщения для загрузки
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем .env из корня проекта
config({ path: path.resolve(process.cwd(), '.env') });

async function findFileByBook(searchTerm: string) {
  console.log(`🚀 Поиск книги по запросу: "${searchTerm}"`);
  
  try {
    // Создаем клиент Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Ищем книги по названию или автору
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id')
      .or(`title.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`)
      .limit(10);
      
    if (error) {
      console.error('❌ Ошибка при поиске книг:', error.message);
      return;
    }
    
    if (!books || books.length === 0) {
      console.log('❌ Книги не найдены');
      return;
    }
    
    console.log(`✅ Найдено ${books.length} книг:`);
    
    for (const book of books) {
      console.log(`\n📖 ${book.author} - ${book.title}`);
      console.log(`   Book ID: ${book.id}`);
      console.log(`   Telegram Post ID: ${book.telegram_post_id || 'N/A'}`);
      
      // Проверяем, есть ли запись в telegram_processed_messages
      const { data: processedRecords, error: processedError } = await supabase
        .from('telegram_processed_messages')
        .select('message_id, telegram_file_id, processed_at')
        .eq('book_id', book.id);
        
      if (processedError) {
        console.log(`   ⚠️ Ошибка при проверке записи: ${processedError.message}`);
      } else if (processedRecords && processedRecords.length > 0) {
        const processedRecord = processedRecords[0];
        console.log(`   📋 Запись в telegram_processed_messages:`);
        console.log(`      Message ID: ${processedRecord.message_id}`);
        console.log(`      File ID: ${processedRecord.telegram_file_id || 'Не загружен'}`);
        console.log(`      Processed At: ${processedRecord.processed_at || 'N/A'}`);
        
        if (processedRecord.telegram_file_id) {
          console.log(`   💡 Файл уже загружен (ID: ${processedRecord.telegram_file_id})`);
        } else {
          console.log(`   💡 Чтобы загрузить файл, используйте:`);
          console.log(`      npx tsx src/scripts/download-single-file.ts ${processedRecord.message_id}`);
        }
      } else {
        console.log(`   ❌ Нет записи в telegram_processed_messages`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка поиска книги:', error);
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  // Проверяем аргументы командной строки
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('❌ Необходимо указать поисковый запрос');
    console.error('Использование: npx tsx src/scripts/find-file-by-book.ts "название или автор книги"');
    console.error('Пример: npx tsx src/scripts/find-file-by-book.ts "Тайниковский"');
    process.exit(1);
  }
  
  const searchTerm = args.join(' ');
  
  // Запускаем поиск
  findFileByBook(searchTerm);
}