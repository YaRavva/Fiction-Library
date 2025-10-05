import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function findSeriesInDb(author: string, title: string) {
  try {
    console.log(`🔍 Поиск серии в базе данных: "${title}" автора ${author}`);
    
    // Ищем серию в базе данных
    const { data, error } = await (serverSupabase as any)
      .from('series')
      .select('*')
      .ilike('title', `%${title}%`)
      .ilike('author', `%${author}%`);
    
    if (error) {
      console.error('❌ Ошибка при поиске серии:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('❌ Серия не найдена в базе данных');
      return;
    }
    
    console.log(`✅ Найдено серий: ${data.length}`);
    
    for (const series of data) {
      console.log('\n--- Серия ---');
      console.log(`ID: ${series.id}`);
      console.log(`Название: ${series.title}`);
      console.log(`Автор: ${series.author}`);
      console.log(`Telegram post ID: ${series.telegram_post_id || 'отсутствует'}`);
      
      if (series.series_composition && series.series_composition.length > 0) {
        console.log('Состав серии:');
        for (const [index, serieBook] of series.series_composition.entries()) {
          console.log(`  ${index + 1}. ${serieBook.title} (${serieBook.year})`);
        }
      } else {
        console.log('Состав серии: отсутствует');
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
  console.error('❌ Пожалуйста, укажите автора и название серии');
  console.log('Использование: npx tsx src/scripts/find-series-in-db.ts "<author>" "<title>"');
  process.exit(1);
}

findSeriesInDb(author, title);