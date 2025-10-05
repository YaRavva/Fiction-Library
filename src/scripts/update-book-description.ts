import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function updateBookDescription(bookId: string, description: string) {
  try {
    console.log(`🔍 Обновление описания книги с ID: ${bookId}`);
    
    // Обновляем описание книги в базе данных
    const updateData: any = { description: description };
    const { data, error } = await (serverSupabase as any)
      .from('books')
      .update(updateData)
      .eq('id', bookId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Ошибка при обновлении описания книги:', error);
      return;
    }
    
    if (!data) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    // Преобразуем данные в нужный формат
    const book: any = data;
    
    console.log('✅ Описание книги успешно обновлено:');
    console.log(`  ID: ${book.id}`);
    console.log(`  Название: ${book.title}`);
    console.log(`  Автор: ${book.author}`);
    console.log(`  Описание: ${book.description ? `${book.description.substring(0, 100)}...` : 'отсутствует'}`);
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Получаем ID книги и описание из аргументов командной строки
const bookId = process.argv[2];
const description = process.argv.slice(3).join(' ');

if (!bookId || !description) {
  console.error('❌ Пожалуйста, укажите ID книги и описание');
  console.log('Использование: npx tsx src/scripts/update-book-description.ts <bookId> <description>');
  process.exit(1);
}

updateBookDescription(bookId, description);