import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function analyzeTelegramPostId() {
  const { getSupabaseAdmin } = await import('../lib/supabase');
  
  try {
    console.log('🚀 Анализируем состояние поля telegram_post_id...');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем общее количество записей
    const { count: totalCount, error: countError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw new Error(`Ошибка получения общего количества записей: ${countError.message}`);
    }
    
    // Получаем количество записей с null в telegram_post_id
    const { count: nullCount, error: nullError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .is('telegram_post_id', null);
    
    if (nullError) {
      throw new Error(`Ошибка получения количества записей с null: ${nullError.message}`);
    }
    
    // Получаем количество записей с пустой строкой в telegram_post_id
    const { count: emptyCount, error: emptyError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_post_id', '');
    
    if (emptyError) {
      throw new Error(`Ошибка получения количества записей с пустой строкой: ${emptyError.message}`);
    }
    
    // Получаем количество записей с непустым telegram_post_id
    const { count: filledCount, error: filledError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('telegram_post_id', 'is', null)
      .neq('telegram_post_id', '');
    
    if (filledError) {
      throw new Error(`Ошибка получения количества записей с непустым значением: ${filledError.message}`);
    }
    
    console.log(`📊 Статистика поля telegram_post_id:`);
    console.log(`  Всего записей: ${totalCount}`);
    console.log(`  С null: ${nullCount}`);
    console.log(`  С пустой строкой: ${emptyCount}`);
    console.log(`  С непустым значением: ${filledCount}`);
    
    // Показываем несколько примеров каждого типа
    console.log(`\n🔍 Примеры записей с непустым telegram_post_id:`);
    const { data: filledData, error: filledDataError } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id')
      .not('telegram_post_id', 'is', null)
      .neq('telegram_post_id', '')
      .limit(5);
    
    if (!filledDataError && filledData) {
      for (const book of filledData) {
        console.log(`  ${book.author} - ${book.title}: ${book.telegram_post_id}`);
      }
    }
    
    console.log(`\n🔍 Примеры записей с пустой строкой в telegram_post_id:`);
    const { data: emptyData, error: emptyDataError } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id')
      .eq('telegram_post_id', '')
      .limit(5);
    
    if (!emptyDataError && emptyData) {
      for (const book of emptyData) {
        console.log(`  ${book.author} - ${book.title}: '${book.telegram_post_id}'`);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка анализа поля telegram_post_id:', error);
  } finally {
    // Принудительно завершаем процесс через 1 секунду
    setTimeout(() => {
      console.log('🔒 Скрипт принудительно завершен');
      process.exit(0);
    }, 1000);
  }
}

analyzeTelegramPostId();