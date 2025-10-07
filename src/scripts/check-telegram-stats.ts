import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function checkTelegramStats() {
  try {
    console.log('🔍 Проверка текущей статистики Telegram\n');
    
    // Получаем последние сохраненные статистические данные
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('telegram_stats')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (statsError) {
      console.log('❌ Статистика еще не сохранена в базе данных');
      console.log('Попробуйте запустить скрипт обновления статистики:');
      console.log('npx tsx src/scripts/update-telegram-stats.ts');
      return;
    }

    // Выводим статистику
    console.log('📊 ТЕКУЩАЯ СТАТИСТИКА TELEGRAM:');
    console.log(`   ========================================`);
    console.log(`   Книг в Telegram: ${stats.books_in_telegram}`);
    console.log(`   Книг в базе данных: ${stats.books_in_database}`);
    console.log(`   Отсутствующих книг: ${stats.missing_books}`);
    console.log(`   Книг без файлов: ${stats.books_without_files}`);
    console.log(`   Последнее обновление: ${new Date(stats.updated_at).toLocaleString('ru-RU')}`);
    
    console.log('\n✅ Проверка завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка при проверке статистики Telegram:', error);
    process.exit(1);
  }
}

checkTelegramStats();