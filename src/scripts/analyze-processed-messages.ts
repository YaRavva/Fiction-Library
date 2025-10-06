import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из .env файла
config();

async function analyzeProcessedMessages() {
  console.log('🔍 Анализ таблицы telegram_processed_messages...');
  
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
    
    // Получаем общее количество записей
    const { count, error: countError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Ошибка при подсчете записей:', countError);
    } else {
      console.log(`📊 Всего записей в telegram_processed_messages: ${count}`);
    }
    
    // Получаем последние 10 записей
    console.log('\n📅 Последние 10 записей:');
    const { data: recentMessages, error: recentError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .order('processed_at', { ascending: false })
      .limit(10);
    
    if (recentError) {
      console.error('❌ Ошибка при получении последних записей:', recentError);
    } else if (recentMessages && recentMessages.length > 0) {
      recentMessages.forEach((message, index) => {
        console.log(`  ${index + 1}. Message ID: ${message.message_id}`);
        console.log(`     Channel: ${message.channel}`);
        console.log(`     Book ID: ${message.book_id || 'не задан'}`);
        console.log(`     Telegram file ID: ${message.telegram_file_id || 'не задан'}`);
        console.log(`     Processed at: ${message.processed_at}`);
        console.log('---');
      });
    }
    
    // Проверим, есть ли записи с book_id, соответствующим найденным книгам
    console.log('\n🔍 Проверка записей для найденных книг...');
    
    // ID книг, найденных ранее
    const bookIds = [
      '352391c7-0d07-494c-a0ad-2c286320b146', // "цикл Одиссей Фокс"
      '1eac5ef4-0bfa-4ab7-9375-084cdec175f7'  // "цикл Хроники Опустошенных земель"
    ];
    
    for (const bookId of bookIds) {
      const { data: bookMessages, error: bookError } = await supabase
        .from('telegram_processed_messages')
        .select('*')
        .eq('book_id', bookId);
      
      if (bookError) {
        console.error(`❌ Ошибка при поиске записей для книги ${bookId}:`, bookError);
      } else if (bookMessages && bookMessages.length > 0) {
        console.log(`✅ Найдено ${bookMessages.length} записей для книги ${bookId}:`);
        bookMessages.forEach((message, index) => {
          console.log(`  ${index + 1}. Message ID: ${message.message_id}`);
          console.log(`     Channel: ${message.channel}`);
          console.log(`     Telegram file ID: ${message.telegram_file_id || 'не задан'}`);
          console.log(`     Processed at: ${message.processed_at}`);
          console.log('---');
        });
      } else {
        console.log(`❌ Записи для книги ${bookId} не найдены`);
      }
    }
    
    // Проверим записи с telegram_file_id
    console.log('\n📁 Записи с telegram_file_id:');
    const { data: fileMessages, error: fileError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .not('telegram_file_id', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(5);
    
    if (fileError) {
      console.error('❌ Ошибка при поиске записей с telegram_file_id:', fileError);
    } else if (fileMessages && fileMessages.length > 0) {
      console.log(`✅ Найдено ${fileMessages.length} записей с telegram_file_id:`);
      fileMessages.forEach((message, index) => {
        console.log(`  ${index + 1}. Message ID: ${message.message_id}`);
        console.log(`     Book ID: ${message.book_id || 'не задан'}`);
        console.log(`     Telegram file ID: ${message.telegram_file_id}`);
        console.log(`     Processed at: ${message.processed_at}`);
        console.log('---');
      });
    } else {
      console.log('❌ Записи с telegram_file_id не найдены');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при анализе таблицы telegram_processed_messages:', error);
    process.exit(1);
  }
}

analyzeProcessedMessages();