import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

interface SeriesBook {
  title: string;
  year: number;
}

async function createSeriesForBook(bookId: string, seriesBooks: SeriesBook[]) {
  try {
    console.log(`🔍 Создание серии для книги с ID: ${bookId}`);
    
    // Получаем информацию о книге
    const { data: book, error: bookError } = await (serverSupabase as any)
      .from('books')
      .select('id, title, author, description, genres, tags, cover_url')
      .eq('id', bookId)
      .single();
    
    if (bookError) {
      console.error('❌ Ошибка при получении информации о книге:', bookError);
      return;
    }
    
    if (!book) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    console.log(`📚 Книга: ${book.title} (${book.author})`);
    
    // Создаем новую серию
    const seriesData: any = {
      title: book.title,
      author: book.author,
      description: book.description,
      genres: book.genres,
      tags: book.tags,
      cover_url: book.cover_url,
      series_composition: seriesBooks
    };
    
    console.log('➕ Создание новой серии...');
    const { data: series, error: seriesError } = await (serverSupabase as any)
      .from('series')
      .insert(seriesData)
      .select()
      .single();
    
    if (seriesError) {
      console.error('❌ Ошибка при создании серии:', seriesError);
      return;
    }
    
    console.log(`✅ Серия создана: ${series.title} (${series.author})`);
    console.log(`  ID серии: ${series.id}`);
    
    // Обновляем книгу, чтобы она ссылалась на новую серию
    console.log('🔄 Обновление книги...');
    const { data: updatedBook, error: updateError } = await (serverSupabase as any)
      .from('books')
      .update({ series_id: series.id })
      .eq('id', bookId)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Ошибка при обновлении книги:', updateError);
      return;
    }
    
    console.log('✅ Книга успешно обновлена и привязана к серии');
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Получаем ID книги из аргументов командной строки
const bookId = process.argv[2];

if (!bookId) {
  console.error('❌ Пожалуйста, укажите ID книги');
  console.log('Использование: npx tsx src/scripts/create-series-for-book.ts <bookId>');
  process.exit(1);
}

// Создаем массив книг в серии "Дримеры"
const seriesBooks: SeriesBook[] = [
  { title: "По ту сторону реальности", year: 2019 },
  { title: "Наследие падших", year: 2019 },
  { title: "Сон падших", year: 2019 },
  { title: "Дрожь времени", year: 2019 },
  { title: "Власть", year: 2020 }
];

createSeriesForBook(bookId, seriesBooks);