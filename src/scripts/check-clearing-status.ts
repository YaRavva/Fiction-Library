import { config } from 'dotenv';
import { resolve } from 'path';
import { getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function checkClearingStatus() {
  try {
    console.log('🚀 Проверяем статус очистки полей...');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем общее количество книг
    const { count: totalCount, error: countError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw new Error(`Ошибка получения общего количества записей: ${countError.message}`);
    }
    
    // Получаем количество книг с непустыми полями
    const { count: unclearedCount, error: unclearedError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('file_format', 'is', null);
    
    if (unclearedError) {
      throw new Error(`Ошибка получения количества непустых записей: ${unclearedError.message}`);
    }
    
    // Получаем количество книг с пустыми полями
    const { count: clearedCount, error: clearedError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .is('file_format', null);
    
    if (clearedError) {
      throw new Error(`Ошибка получения количества пустых записей: ${clearedError.message}`);
    }
    
    console.log(`📊 Статус очистки:`);
    console.log(`  Всего книг: ${totalCount}`);
    console.log(`  Очищено: ${clearedCount}`);
    console.log(`  Не очищено: ${unclearedCount}`);
    console.log(`  Прогресс: ${totalCount > 0 ? Math.round((clearedCount / totalCount) * 100) : 0}%`);
  } catch (error) {
    console.error('❌ Ошибка проверки статуса:', error);
  }
}

checkClearingStatus();