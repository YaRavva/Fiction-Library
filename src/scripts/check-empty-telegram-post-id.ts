import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function checkEmptyTelegramPostId() {
  const { getSupabaseAdmin } = await import('../lib/supabase');
  
  try {
    console.log('🚀 Проверяем записи с пустым полем telegram_post_id...');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем количество записей с пустым telegram_post_id
    const { count, error } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .is('telegram_post_id', null);
    
    if (error) {
      throw new Error(`Ошибка получения записей: ${error.message}`);
    }
    
    console.log(`📊 Записей с пустым telegram_post_id: ${count}`);
  } catch (error) {
    console.error('❌ Ошибка проверки:', error);
  }
}

checkEmptyTelegramPostId();