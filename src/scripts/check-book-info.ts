import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function checkBookInfo(bookId: string) {
  try {
    console.log(`🔍 Проверка информации о книге с ID: ${bookId}`);
    
    // Получаем информацию о книге из базы данных
    const { data, error } = await serverSupabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();
    
    if (error) {
      console.error('❌ Ошибка при получении информации о книге:', error);
      return;
    }
    
    if (!data) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    // Преобразуем данные в нужный формат
    const book: any = data;
    
    console.log('📚 Информация о книге:');
    console.log(`  ID: ${book.id}`);
    console.log(`  Название: ${book.title}`);
    console.log(`  Автор: ${book.author}`);
    console.log(`  Описание: ${book.description || 'отсутствует'}`);
    console.log(`  Telegram post ID: ${book.telegram_post_id || 'отсутствует'}`);
    console.log(`  Telegram file ID: ${book.telegram_file_id || 'отсутствует'}`);
    console.log(`  Cover URL: ${book.cover_url || 'отсутствует'}`);
    
    // Проверяем, есть ли связанное сообщение в telegram_processed_messages
    if (book.telegram_post_id) {
      console.log(`\n🔍 Проверка связанного сообщения в Telegram...`);
      const { data: processedData, error: processedError } = await serverSupabase
        .from('telegram_processed_messages')
        .select('*')
        .eq('message_id', book.telegram_post_id)
        .single();
      
      if (processedError) {
        console.error('❌ Ошибка при получении информации о сообщении:', processedError);
      } else if (processedData) {
        const processedMessage: any = processedData;
        console.log('📨 Связанное сообщение найдено:');
        console.log(`  Message ID: ${processedMessage.message_id}`);
        console.log(`  Channel: ${processedMessage.channel}`);
        console.log(`  Book ID: ${processedMessage.book_id}`);
        console.log(`  Processed at: ${processedMessage.processed_at}`);
      } else {
        console.log('❌ Связанное сообщение не найдено');
      }
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Получаем ID книги из аргументов командной строки
const bookId = process.argv[2];
if (!bookId) {
  console.error('❌ Пожалуйста, укажите ID книги');
  process.exit(1);
}

checkBookInfo(bookId);