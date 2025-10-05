/**
 * Скрипт для исправления связи между записью в telegram_processed_messages и книгой
 * Исправляет ситуацию, когда message_id 4379 связан с неправильной книгой
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
config({ path: path.resolve(process.cwd(), '.env') });

async function fixProcessedMessageAssociation() {
  console.log('🔧 Исправление связи между записью в telegram_processed_messages и книгой\n');
  
  try {
    // Получаем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Отсутствуют переменные окружения Supabase');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Ищем книгу "цикл Мицелий" автора Вилма Кадлечкова
    console.log('🔍 Поиск книги "цикл Мицелий" автора Вилма Кадлечкова...');
    const { data: correctBook, error: bookError } = await supabase
      .from('books')
      .select('id, title, author')
      .ilike('author', '%Вилма Кадлечкова%')
      .ilike('title', '%цикл Мицелий%')
      .single();
      
    if (bookError) {
      console.log('❌ Ошибка при поиске книги:', bookError.message);
      return;
    }
    
    if (!correctBook) {
      console.log('❌ Книга "цикл Мицелий" автора Вилма Кадлечкова не найдена');
      return;
    }
    
    console.log(`✅ Найдена книга: "${correctBook.title}" автора ${correctBook.author}`);
    console.log(`   ID: ${correctBook.id}\n`);
    
    // Ищем запись в telegram_processed_messages для message_id 4379
    console.log('🔍 Поиск записи в telegram_processed_messages для message_id = 4379...');
    const { data: processedMessage, error: processedMessageError } = await supabase
      .from('telegram_processed_messages')
      .select('*')
      .eq('message_id', '4379')
      .single();
      
    if (processedMessageError) {
      console.log('❌ Ошибка при поиске записи:', processedMessageError.message);
      return;
    }
    
    if (!processedMessage) {
      console.log('❌ Запись для message_id = 4379 не найдена');
      return;
    }
    
    console.log(`✅ Найдена запись:`);
    console.log(`   ID записи: ${processedMessage.id}`);
    console.log(`   Текущий Book ID: ${processedMessage.book_id}`);
    console.log(`   Telegram File ID: ${processedMessage.telegram_file_id}`);
    console.log(`   Processed At: ${processedMessage.processed_at}\n`);
    
    // Проверяем, правильно ли связана запись
    if (processedMessage.book_id === correctBook.id) {
      console.log('✅ Запись уже правильно связана с книгой');
      return;
    }
    
    // Получаем информацию о текущей связанной книге
    if (processedMessage.book_id) {
      const { data: currentBook, error: currentBookError } = await supabase
        .from('books')
        .select('title, author')
        .eq('id', processedMessage.book_id)
        .single();
        
      if (!currentBookError && currentBook) {
        console.log(`⚠️  Текущая связанная книга: "${currentBook.title}" автора ${currentBook.author}`);
      }
    }
    
    // Исправляем связь
    console.log('\n✏️  Исправление связи записи с правильной книгой...');
    const { error: updateError } = await supabase
      .from('telegram_processed_messages')
      .update({
        book_id: correctBook.id,
        processed_at: new Date().toISOString()
      })
      .eq('id', processedMessage.id);
      
    if (updateError) {
      console.log('❌ Ошибка при обновлении записи:', updateError.message);
      return;
    }
    
    console.log('✅ Связь успешно исправлена!');
    console.log(`   Запись теперь связана с книгой: "${correctBook.title}" автора ${correctBook.author}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
fixProcessedMessageAssociation().catch(error => {
  console.error('Необработанная ошибка:', error);
  process.exit(1);
});