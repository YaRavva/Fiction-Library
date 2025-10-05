/**
 * Детальная проверка файла и связанных записей
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function detailedFileCheck() {
  console.log('🔍 Детальная проверка файла 4379.zip\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Проверяем файл в Storage
    console.log('📁 Проверка файла в Storage...');
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('books')
      .download('4379.zip');
      
    if (fileError) {
      console.log('❌ Файл не найден в Storage:', fileError.message);
    } else {
      console.log(`✅ Файл найден в Storage (${fileData.size} байт)`);
    }
    
    // Ищем книгу по telegram_file_id
    console.log('\n📚 Поиск книги по telegram_file_id = 4379...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('*')
      .eq('telegram_file_id', '4379');
      
    if (booksError) {
      console.log('❌ Ошибка при поиске книг:', booksError.message);
    } else if (books && books.length > 0) {
      console.log(`✅ Найдено ${books.length} книг с telegram_file_id = 4379:`);
      for (const book of books) {
        console.log(`   Название: "${book.title}"`);
        console.log(`   Автор: ${book.author}`);
        console.log(`   ID: ${book.id}`);
        console.log(`   File URL: ${book.file_url}`);
        console.log('');
      }
    } else {
      console.log('❌ Книги с telegram_file_id = 4379 не найдены');
    }
    
    // Ищем книгу по автору и названию
    console.log('📖 Поиск книги по автору "Вилма Кадлечкова" и названию "цикл Мицелий"...');
    const { data: bookByAuthor, error: bookByAuthorError } = await supabase
      .from('books')
      .select('*')
      .ilike('author', '%Вилма Кадлечкова%')
      .ilike('title', '%цикл Мицелий%')
      .single();
      
    if (bookByAuthorError && bookByAuthorError.code !== 'PGRST116') {
      console.log('❌ Ошибка при поиске книги:', bookByAuthorError.message);
    } else if (bookByAuthor) {
      console.log('✅ Найдена книга по автору и названию:');
      console.log(`   Название: "${bookByAuthor.title}"`);
      console.log(`   Автор: ${bookByAuthor.author}`);
      console.log(`   ID: ${bookByAuthor.id}`);
      console.log(`   Telegram File ID: ${bookByAuthor.telegram_file_id}`);
      console.log(`   File URL: ${bookByAuthor.file_url}`);
    } else {
      console.log('❌ Книга по автору и названию не найдена');
    }
    
    // Проверяем запись в telegram_processed_messages
    console.log('\n📝 Проверка записи в telegram_processed_messages для message_id = 4379...');
    const { data: processedMessages, error: processedMessagesError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .eq('message_id', '4379');
      
    if (processedMessagesError) {
      console.log('❌ Ошибка при поиске записей:', processedMessagesError.message);
    } else if (processedMessages && processedMessages.length > 0) {
      console.log(`✅ Найдено ${processedMessages.length} записей для message_id = 4379:`);
      for (const msg of processedMessages) {
        console.log(`   ID записи: ${msg.id}`);
        console.log(`   Book ID: ${msg.book_id}`);
        console.log(`   Telegram File ID: ${msg.telegram_file_id}`);
        console.log(`   Processed At: ${msg.processed_at}`);
        
        // Получаем информацию о книге
        if (msg.book_id) {
          const { data: book, error: bookError } = await supabase
            .from('books')
            .select('title, author')
            .eq('id', msg.book_id)
            .single();
            
          if (!bookError && book) {
            console.log(`   Связанная книга: "${book.title}" автора ${book.author}`);
          }
        }
        console.log('');
      }
    } else {
      console.log('❌ Записи для message_id = 4379 не найдены');
    }
    
    console.log('✅ Детальная проверка завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
detailedFileCheck().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});