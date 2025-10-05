import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function updateBookTags(bookId: string, tags: string[]) {
  try {
    console.log(`🔍 Обновление тегов книги с ID: ${bookId}`);
    
    // Обновляем теги книги в базе данных
    const updateData: any = { tags: tags };
    const { data, error } = await (serverSupabase as any)
      .from('books')
      .update(updateData)
      .eq('id', bookId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Ошибка при обновлении тегов книги:', error);
      return;
    }
    
    if (!data) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    // Преобразуем данные в нужный формат
    const book: any = data;
    
    console.log('✅ Теги книги успешно обновлены:');
    console.log(`  ID: ${book.id}`);
    console.log(`  Название: ${book.title}`);
    console.log(`  Автор: ${book.author}`);
    console.log(`  Теги: ${book.tags ? book.tags.join(', ') : 'отсутствуют'}`);
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Получаем ID книги и теги из аргументов командной строки
const bookId = process.argv[2];
const tagsStr = process.argv.slice(3).join(' ');

if (!bookId || !tagsStr) {
  console.error('❌ Пожалуйста, укажите ID книги и теги');
  console.log('Использование: npx tsx src/scripts/update-book-tags.ts <bookId> <тег1> <тег2> ...');
  process.exit(1);
}

// Разбиваем строку тегов на массив
const tags = tagsStr.split(',').map(tag => tag.trim());

updateBookTags(bookId, tags);