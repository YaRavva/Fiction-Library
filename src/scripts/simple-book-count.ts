import { config } from 'dotenv';
import { resolve } from 'path';
import { getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function checkBookCount() {
  try {
    console.log('🚀 Проверяем количество записей книг...');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем количество записей
    const { count, error } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      throw new Error(`Ошибка получения записей: ${error.message}`);
    }
    
    console.log(`📊 Количество записей: ${count}`);
  } catch (error) {
    console.error('❌ Ошибка проверки записей:', error);
  }
}

checkBookCount();