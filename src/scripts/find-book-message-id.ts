import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из .env файла
config();

async function findBookMessageId() {
  console.log('🔍 Поиск ID сообщения для книги "цикл Хроники Опустошенных земель"');
  
  try {
    // Получаем настройки Supabase из переменных окружения
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Не найдены настройки Supabase в переменных окружения');
      process.exit(1);
    }
    
    // Создаем клиент Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Ищем книгу по названию и автору
    const title = 'цикл Хроники Опустошенных земель';
    const author = 'Антон Карелин';
    
    console.log(`🔎 Поиск книги: "${title}" автора ${author}`);
    
    // Выполняем поиск в таблице books
    const { data: book, error } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id')
      .eq('title', title)
      .eq('author', author)
      .single();
    
    if (error) {
      console.error('❌ Ошибка при поиске книги:', error);
      process.exit(1);
    }
    
    if (book) {
      console.log(`✅ Найдена книга:`);
      console.log(`  Название: ${book.title}`);
      console.log(`  Автор: ${book.author}`);
      console.log(`  ID: ${book.id}`);
      console.log(`  Telegram post ID: ${book.telegram_post_id || 'не задан'}`);
      
      // Проверяем, есть ли запись в telegram_processed_messages с этим telegram_post_id
      if (book.telegram_post_id) {
        console.log(`\n🔍 Поиск записи в telegram_processed_messages с telegram_post_id=${book.telegram_post_id}...`);
        
        const { data: messageRecord, error: messageError } = await supabase
          .from('telegram_processed_messages')
          .select('*')
          .eq('message_id', book.telegram_post_id)
          .single();
        
        if (messageError) {
          console.error('❌ Ошибка при поиске записи в telegram_processed_messages:', messageError);
        } else if (messageRecord) {
          console.log(`✅ Найдена запись в telegram_processed_messages:`);
          console.log(`  Message ID: ${messageRecord.message_id}`);
          console.log(`  Book ID: ${messageRecord.book_id}`);
          console.log(`  Telegram file ID: ${messageRecord.telegram_file_id || 'не задан'}`);
          console.log(`  Processed at: ${messageRecord.processed_at}`);
        } else {
          console.log('❌ Запись в telegram_processed_messages не найдена');
        }
      } else {
        console.log('⚠️  У книги не задан telegram_post_id');
      }
    } else {
      console.log('❌ Книга не найдена');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при поиске ID сообщения:', error);
    process.exit(1);
  }
}

findBookMessageId();