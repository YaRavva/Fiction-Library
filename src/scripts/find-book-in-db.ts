import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function findBookInDb(author: string, title: string) {
  try {
    console.log(`🔍 Поиск книги в базе данных: "${title}" автора ${author}`);
    
    // Ищем книгу в базе данных
    const { data, error } = await (serverSupabase as any)
      .from('books')
      .select('*')
      .ilike('title', `%${title}%`)
      .ilike('author', `%${author}%`);
    
    if (error) {
      console.error('❌ Ошибка при поиске книги:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('❌ Книга не найдена в базе данных');
      return;
    }
    
    console.log(`✅ Найдено книг: ${data.length}`);
    
    for (const book of data) {
      console.log('\n--- Книга ---');
      console.log(`ID: ${book.id}`);
      console.log(`Название: ${book.title}`);
      console.log(`Автор: ${book.author}`);
      console.log(`Series ID: ${book.series_id || 'отсутствует'}`);
      console.log(`Telegram post ID: ${book.telegram_post_id || 'отсутствует'}`);
      
      // Если у книги есть series_id, получаем информацию о серии
      if (book.series_id) {
        const { data: series, error: seriesError } = await (serverSupabase as any)
          .from('series')
          .select('*')
          .eq('id', book.series_id)
          .single();
        
        if (series && !seriesError) {
          console.log('\n--- Серия ---');
          console.log(`Название: ${series.title}`);
          console.log(`Автор: ${series.author}`);
          
          if (series.series_composition && series.series_composition.length > 0) {
            console.log('Состав серии:');
            for (const [index, serieBook] of series.series_composition.entries()) {
              console.log(`  ${index + 1}. ${serieBook.title} (${serieBook.year})`);
            }
          } else {
            console.log('Состав серии: отсутствует');
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Получаем автора и название из аргументов командной строки
const author = process.argv[2];
const title = process.argv[3];

if (!author || !title) {
  console.error('❌ Пожалуйста, укажите автора и название книги');
  console.log('Использование: npx tsx src/scripts/find-book-in-db.ts "<author>" "<title>"');
  process.exit(1);
}

findBookInDb(author, title);