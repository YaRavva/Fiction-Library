import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function findBooksByTitle(partialTitle: string) {
  try {
    console.log(`🔍 Поиск книг по части названия: "${partialTitle}"`);
    
    // Получаем информацию о книгах из базы данных
    const { data, error } = await serverSupabase
      .from('books')
      .select('*')
      .ilike('title', `%${partialTitle}%`)
      .limit(10);
    
    if (error) {
      console.error('❌ Ошибка при поиске книг:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('❌ Книги не найдены');
      return;
    }
    
    console.log(`📚 Найдено книг: ${data.length}`);
    
    // Преобразуем данные в нужный формат
    const books: any[] = data;
    
    for (const book of books) {
      console.log('\n---');
      console.log(`  ID: ${book.id}`);
      console.log(`  Название: ${book.title}`);
      console.log(`  Автор: ${book.author}`);
      console.log(`  Описание: ${book.description ? `${book.description.substring(0, 100)}...` : 'отсутствует'}`);
      console.log(`  Telegram post ID: ${book.telegram_post_id || 'отсутствует'}`);
      console.log(`  Telegram file ID: ${book.telegram_file_id || 'отсутствует'}`);
      console.log(`  Cover URL: ${book.cover_url || 'отсутствует'}`);
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Получаем часть названия из аргументов командной строки
const partialTitle = process.argv[2];
if (!partialTitle) {
  console.error('❌ Пожалуйста, укажите часть названия книги');
  process.exit(1);
}

findBooksByTitle(partialTitle);