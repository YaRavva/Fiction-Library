/**
 * Скрипт для поиска файлов, которые еще не были загружены из Telegram
 * и могут быть обработаны с помощью download-single-file.ts
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем .env из корня проекта
config({ path: path.resolve(process.cwd(), '.env') });

async function findUnprocessedFiles() {
  console.log('🚀 Поиск файлов, которые еще не были загружены...');
  
  try {
    // Создаем клиент Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Получаем список всех записей из telegram_processed_messages с book_id, но без telegram_file_id
    // Это книги, которые были импортированы из публичного канала, но для которых еще не загружен файл
    const { data: records, error } = await supabase
      .from('telegram_processed_messages')
      .select('id, book_id, message_id, processed_at')
      .is('telegram_file_id', null)
      .order('processed_at', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error('❌ Ошибка при получении записей:', error.message);
      return;
    }
    
    if (!records || records.length === 0) {
      console.log('✅ Все книги из telegram_processed_messages уже имеют загруженные файлы');
      return;
    }
    
    console.log(`⚠️ Найдено ${records.length} записей без загруженных файлов:`);
    console.log('ID  | Book ID                            | Message ID | Processed At');
    console.log('----|------------------------------------|------------|-------------------');
    
    records.forEach((record, index) => {
      console.log(`${(index + 1).toString().padStart(3)} | ${record.book_id} | ${record.message_id}       | ${record.processed_at || 'N/A'}`);
    });
    
    // Для каждой записи попробуем найти соответствующую книгу
    console.log('\n📚 Поиск информации о книгах:');
    
    for (const record of records) {
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('title, author')
        .eq('id', record.book_id)
        .single();
        
      if (bookError) {
        console.log(`❌ Ошибка при получении книги ${record.book_id}: ${bookError.message}`);
      } else if (book) {
        console.log(`📖 ${book.author} - ${book.title} (Book ID: ${record.book_id})`);
      } else {
        console.log(`❓ Книга не найдена (Book ID: ${record.book_id})`);
      }
    }
    
    console.log('\n💡 Чтобы загрузить файл для конкретной книги, используйте:');
    console.log('npx tsx src/scripts/download-single-file.ts <messageId>');
    console.log('где <messageId> - это ID сообщения из приватного канала Telegram');
    
  } catch (error) {
    console.error('❌ Ошибка поиска файлов:', error);
  }
}

// Запуск скрипта
findUnprocessedFiles().catch(console.error);