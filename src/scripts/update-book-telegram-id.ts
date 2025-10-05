import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function updateBookTelegramId(bookId: string, telegramPostId: string) {
  try {
    console.log(`🔍 Обновление Telegram post ID для книги с ID: ${bookId}`);
    
    // Обновляем Telegram post ID книги в базе данных
    const updateData: any = { telegram_post_id: telegramPostId };
    const { data, error } = await (serverSupabase as any)
      .from('books')
      .update(updateData)
      .eq('id', bookId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Ошибка при обновлении Telegram post ID книги:', error);
      return;
    }
    
    if (!data) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    // Преобразуем данные в нужный формат
    const book: any = data;
    
    console.log('✅ Telegram post ID книги успешно обновлен:');
    console.log(`  ID: ${book.id}`);
    console.log(`  Название: ${book.title}`);
    console.log(`  Автор: ${book.author}`);
    console.log(`  Telegram post ID: ${book.telegram_post_id}`);
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Получаем ID книги и Telegram post ID из аргументов командной строки
const bookId = process.argv[2];
const telegramPostId = process.argv[3];

if (!bookId || !telegramPostId) {
  console.error('❌ Пожалуйста, укажите ID книги и Telegram post ID');
  console.log('Использование: npx tsx src/scripts/update-book-telegram-id.ts <bookId> <telegramPostId>');
  process.exit(1);
}

updateBookTelegramId(bookId, telegramPostId);