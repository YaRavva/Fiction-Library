import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkTelegramStats() {
  try {
    console.log('🔍 Проверка структуры таблицы telegram_stats...');
    
    // Получаем информацию о таблице
    const { data, error } = await supabase
      .from('telegram_stats')
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ Ошибка: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      console.log('❌ Нет данных в таблице telegram_stats');
      return;
    }

    const stats = data[0];
    console.log('✅ Структура таблицы telegram_stats:');
    console.log(JSON.stringify(stats, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

checkTelegramStats();