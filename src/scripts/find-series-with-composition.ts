import { serverSupabase } from '../lib/serverSupabase';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function findSeriesWithComposition() {
  try {
    console.log('🔍 Поиск серий с информацией о составе...');
    
    // Получаем серии с информацией о составе
    const { data: series, error } = await (serverSupabase as any)
      .from('series')
      .select('*')
      .not('series_composition', 'is', null)
      .limit(5);
    
    if (error) {
      console.error('❌ Ошибка при получении серий:', error);
      return;
    }
    
    if (!series || series.length === 0) {
      console.log('❌ Серии с информацией о составе не найдены');
      return;
    }
    
    console.log(`Найдено серий с информацией о составе: ${series.length}`);
    
    for (const s of series) {
      console.log(`\n--- Серия: ${s.title} (${s.author}) ---`);
      console.log(`ID: ${s.id}`);
      
      if (s.series_composition && s.series_composition.length > 0) {
        console.log('Состав:');
        for (const [index, book] of s.series_composition.entries()) {
          console.log(`  ${index + 1}. ${book.title} (${book.year})`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

findSeriesWithComposition();