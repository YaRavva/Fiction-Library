import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Инициализация Supabase клиента
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function showTelegramStatsStructure() {
  console.log('🔍 Получение структуры таблицы telegram_stats...');
  
  try {
    // Получаем информацию о структуре таблицы через информацию о колонках
    console.log('\n📋 Структура таблицы telegram_stats:');
    
    // Получаем все записи из таблицы
    console.log('\n📊 Содержимое таблицы:');
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('telegram_stats')
      .select('*');

    if (statsError) {
      console.error('❌ Ошибка при получении данных:', statsError);
      return;
    }

    if (!stats || stats.length === 0) {
      console.log('⚠️  Таблица пуста');
    } else {
      console.log(`✅ Найдено ${stats.length} записей:`);
      stats.forEach((record: any, index) => {
        console.log(`\n--- Запись ${index + 1} ---`);
        console.log(`ID: ${record.id}`);
        console.log(`Дата: ${record.date}`);
        console.log(`Обработано сообщений: ${record.messages_processed}`);
        console.log(`Загружено файлов: ${record.files_downloaded}`);
        console.log(`Ошибок: ${record.errors_count}`);
        console.log(`Создано: ${new Date(record.created_at).toLocaleString()}`);
        console.log(`Обновлено: ${new Date(record.updated_at).toLocaleString()}`);
      });
    }
    
    // Получаем количество записей
    console.log('\n🔢 Количество записей в таблице:');
    const { count, error: countError } = await supabaseAdmin
      .from('telegram_stats')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Ошибка при подсчете записей:', countError);
    } else {
      console.log(`Всего записей: ${count || 0}`);
    }
    
    console.log('\n✅ Получение структуры таблицы завершено');
    
  } catch (error) {
    console.error('❌ Ошибка при получении структуры таблицы:', error);
  }
}

// Run the script
showTelegramStatsStructure().catch(console.error);