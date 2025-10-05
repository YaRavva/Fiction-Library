import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

interface SeriesBook {
  title: string;
  year: number;
}

async function updateBookSeries(bookId: string, seriesBooks: SeriesBook[]) {
  try {
    console.log(`🔍 Обновление информации о книгах в серии для книги с ID: ${bookId}`);
    
    // Обновляем информацию о книгах в серии
    const updateData: any = { books: seriesBooks };
    const { data, error } = await (serverSupabase as any)
      .from('books')
      .update(updateData)
      .eq('id', bookId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Ошибка при обновлении информации о книгах в серии:', error);
      return;
    }
    
    if (!data) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    // Преобразуем данные в нужный формат
    const book: any = data;
    
    console.log('✅ Информация о книгах в серии успешно обновлена:');
    console.log(`  ID: ${book.id}`);
    console.log(`  Название: ${book.title}`);
    console.log(`  Автор: ${book.author}`);
    console.log(`  Книги в серии: ${book.books ? book.books.length : 0}`);
    
    if (book.books) {
      for (const seriesBook of book.books) {
        console.log(`    - ${seriesBook.title} (${seriesBook.year})`);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Получаем ID книги и информацию о книгах в серии из аргументов командной строки
const bookId = process.argv[2];

if (!bookId) {
  console.error('❌ Пожалуйста, укажите ID книги');
  console.log('Использование: npx tsx src/scripts/update-book-series.ts <bookId>');
  process.exit(1);
}

// Создаем массив книг в серии
const seriesBooks: SeriesBook[] = [
  { title: "По ту сторону реальности", year: 2019 },
  { title: "Наследие падших", year: 2019 },
  { title: "Сон падших", year: 2019 },
  { title: "Дрожь времени", year: 2019 },
  { title: "Власть", year: 2020 }
];

updateBookSeries(bookId, seriesBooks);