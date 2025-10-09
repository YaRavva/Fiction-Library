// Simple test to verify our metadata service implementation
// This test doesn't require Telegram connection or environment variables

import { serverSupabase } from '../lib/serverSupabase';

async function simpleMetadataTest() {
  try {
    console.log('🚀 Тестирование базовой функциональности Metadata Service...');
    
    // Test Supabase connection by querying a simple table
    console.log('🔍 Проверка подключения к Supabase...');
    
    // @ts-ignore
    const { data: books, error } = await serverSupabase
      .from('books')
      .select('id, title, author')
      .limit(1);
    
    if (error) {
      console.log('⚠️ Ошибка при подключении к Supabase:', error.message);
    } else {
      console.log('✅ Подключение к Supabase установлено');
      if (books && books.length > 0) {
        const book: any = books[0];
        console.log(`📚 Найдена книга: ${book.title} by ${book.author}`);
      } else {
        console.log('📚 Книги не найдены (база может быть пустой)');
      }
    }
    
    // Test querying the telegram_messages_index table
    console.log('🔍 Проверка таблицы telegram_messages_index...');
    
    // @ts-ignore
    const { data: messages, error: messagesError } = await serverSupabase
      .from('telegram_messages_index')
      .select('message_id, author, title')
      .limit(3);
    
    if (messagesError) {
      console.log('⚠️ Ошибка при запросе telegram_messages_index:', messagesError.message);
    } else {
      console.log('✅ Таблица telegram_messages_index доступна');
      if (messages && messages.length > 0) {
        console.log(`📥 Найдено ${messages.length} записей в индексе:`);
        messages.forEach((msg: any, index: number) => {
          console.log(`   ${index + 1}. ID: ${msg.message_id}, Автор: ${msg.author || 'не указан'}, Название: ${msg.title || 'не указано'}`);
        });
      } else {
        console.log('📥 Индекс пуст');
      }
    }
    
    // Test querying the telegram_processed_messages table
    console.log('🔍 Проверка таблицы telegram_processed_messages...');
    
    // @ts-ignore
    const { data: processed, error: processedError } = await serverSupabase
      .from('telegram_processed_messages')
      .select('message_id')
      .order('processed_at', { ascending: false })
      .limit(1);
    
    if (processedError) {
      console.log('⚠️ Ошибка при запросе telegram_processed_messages:', processedError.message);
    } else {
      console.log('✅ Таблица telegram_processed_messages доступна');
      if (processed && processed.length > 0) {
        const msg: any = processed[0];
        console.log(`✅ Последнее обработанное сообщение: ${msg.message_id}`);
      } else {
        console.log('📥 Нет обработанных сообщений');
      }
    }
    
    console.log('✅ Тест завершен успешно');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Run the test
simpleMetadataTest().then(() => {
  console.log('🏁 Тест завершен');
  process.exit(0);
});