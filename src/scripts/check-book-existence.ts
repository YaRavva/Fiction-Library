import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из .env файла
config();

async function checkBookExistence() {
  console.log('🔍 Проверка наличия книги в базе данных...');
  
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
    const title = 'Хроники Опустошённых земель';
    const author = 'Антон Карелин';
    
    console.log(`🔎 Поиск книги: "${title}" автора ${author}`);
    
    // Выполняем поиск в таблице books
    const { data: books, error } = await supabase
      .from('books')
      .select('*')
      .ilike('title', `%${title}%`)
      .ilike('author', `%${author}%`);
    
    if (error) {
      console.error('❌ Ошибка при поиске книги:', error);
      process.exit(1);
    }
    
    if (books && books.length > 0) {
      console.log(`✅ Найдено ${books.length} книг(а):`);
      books.forEach((book, index) => {
        console.log(`  ${index + 1}. "${book.title}" автора ${book.author}`);
        console.log(`     ID: ${book.id}`);
        console.log(`     Telegram post ID: ${book.telegram_post_id || 'не задан'}`);
        console.log(`     File URL: ${book.file_url || 'не задан'}`);
        console.log(`     File format: ${book.file_format || 'не задан'}`);
        console.log('---');
      });
    } else {
      console.log('❌ Книга не найдена в базе данных');
      
      // Попробуем более общий поиск
      console.log('🔍 Попробуем более общий поиск...');
      
      const { data: generalBooks, error: generalError } = await supabase
        .from('books')
        .select('*')
        .or(`title.ilike.%${title}%,author.ilike.%${author}%`);
      
      if (generalError) {
        console.error('❌ Ошибка при общем поиске:', generalError);
      } else if (generalBooks && generalBooks.length > 0) {
        console.log(`✅ Найдено ${generalBooks.length} книг(а) по общему поиску:`);
        generalBooks.forEach((book, index) => {
          console.log(`  ${index + 1}. "${book.title}" автора ${book.author}`);
          console.log(`     ID: ${book.id}`);
          console.log('---');
        });
      } else {
        console.log('❌ Книги не найдены даже при общем поиске');
      }
    }
    
    // Проверим также таблицу telegram_processed_messages
    console.log('\n🔍 Проверка в таблице telegram_processed_messages...');
    
    const { data: messages, error: messagesError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .eq('message_id', '4378');
    
    if (messagesError) {
      console.error('❌ Ошибка при поиске в telegram_processed_messages:', messagesError);
    } else if (messages && messages.length > 0) {
      console.log(`✅ Найдено ${messages.length} записей в telegram_processed_messages:`);
      messages.forEach((message, index) => {
        console.log(`  ${index + 1}. Message ID: ${message.message_id}`);
        console.log(`     Channel: ${message.channel}`);
        console.log(`     Book ID: ${message.book_id || 'не задан'}`);
        console.log(`     Telegram file ID: ${message.telegram_file_id || 'не задан'}`);
        console.log(`     Processed at: ${message.processed_at}`);
        console.log('---');
      });
    } else {
      console.log('❌ Запись с message_id 4378 не найдена в telegram_processed_messages');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при проверке наличия книги:', error);
    process.exit(1);
  }
}

checkBookExistence();