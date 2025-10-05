import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function updateBookGenres(bookId: string, genres: string[]) {
  try {
    console.log(`🔍 Обновление жанров книги с ID: ${bookId}`);
    
    // Обновляем жанры книги в базе данных
    const updateData: any = { genres: genres };
    const { data, error } = await (serverSupabase as any)
      .from('books')
      .update(updateData)
      .eq('id', bookId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Ошибка при обновлении жанров книги:', error);
      return;
    }
    
    if (!data) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    // Преобразуем данные в нужный формат
    const book: any = data;
    
    console.log('✅ Жанры книги успешно обновлены:');
    console.log(`  ID: ${book.id}`);
    console.log(`  Название: ${book.title}`);
    console.log(`  Автор: ${book.author}`);
    console.log(`  Жанры: ${book.genres ? book.genres.join(', ') : 'отсутствуют'}`);
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Получаем ID книги и жанры из аргументов командной строки
const bookId = process.argv[2];
const genresStr = process.argv.slice(3).join(' ');

if (!bookId || !genresStr) {
  console.error('❌ Пожалуйста, укажите ID книги и жанры');
  console.log('Использование: npx tsx src/scripts/update-book-genres.ts <bookId> <жанр1> <жанр2> ...');
  process.exit(1);
}

// Разбиваем строку жанров на массив
const genres = genresStr.split(',').map(genre => genre.trim());

updateBookGenres(bookId, genres);