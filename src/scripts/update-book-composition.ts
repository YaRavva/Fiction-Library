import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

interface BookInfo {
  title: string;
  year: number;
}

async function updateBookComposition(bookId: string, books: BookInfo[]) {
  try {
    console.log(`🔍 Обновление состава книг в цикле для книги с ID: ${bookId}`);
    
    // Обновляем информацию о книгах в цикле
    const updateData: any = { books: books };
    const { data, error } = await (serverSupabase as any)
      .from('books')
      .update(updateData)
      .eq('id', bookId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Ошибка при обновлении состава книг:', error);
      return;
    }
    
    if (!data) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    // Преобразуем данные в нужный формат
    const book: any = data;
    
    console.log('✅ Состав книг в цикле успешно обновлен:');
    console.log(`  ID: ${book.id}`);
    console.log(`  Название: ${book.title}`);
    console.log(`  Автор: ${book.author}`);
    
    if (book.books && book.books.length > 0) {
      console.log('  Состав:');
      for (const [index, seriesBook] of book.books.entries()) {
        console.log(`    ${index + 1}. ${seriesBook.title} (${seriesBook.year})`);
      }
    } else {
      console.log('  Состав: отсутствует');
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Получаем ID книги из аргументов командной строки
const bookId = process.argv[2];

if (!bookId) {
  console.error('❌ Пожалуйста, укажите ID книги');
  console.log('Использование: npx tsx src/scripts/update-book-composition.ts <bookId>');
  process.exit(1);
}

// Создаем массив книг в цикле "Дримеры"
const books: BookInfo[] = [
  { title: "По ту сторону реальности", year: 2019 },
  { title: "Наследие падших", year: 2019 },
  { title: "Сон падших", year: 2019 },
  { title: "Дрожь времени", year: 2019 },
  { title: "Власть", year: 2020 }
];

updateBookComposition(bookId, books);