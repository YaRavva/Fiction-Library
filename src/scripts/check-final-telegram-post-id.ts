import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function checkFinalTelegramPostId() {
  const { getSupabaseAdmin } = await import('../lib/supabase');
  
  try {
    console.log('🚀 Проверяем финальное состояние поля telegram_post_id...');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем несколько случайных записей с непустым telegram_post_id
    const { data, error } = await supabase
      .from('books')
      .select('title, author, telegram_post_id')
      .not('telegram_post_id', 'is', null)
      .not('telegram_post_id', 'eq', '')
      .limit(10);
    
    if (error) {
      throw new Error(`Ошибка получения записей: ${error.message}`);
    }
    
    console.log('📊 Примеры записей с telegram_post_id:');
    data.forEach((book: any, index: number) => {
      console.log(`${index + 1}. ${book.author} - ${book.title}: ${book.telegram_post_id}`);
    });
    
    // Проверяем общую статистику
    const { count: totalCount, error: countError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw new Error(`Ошибка получения общего количества: ${countError.message}`);
    }
    
    const { count: filledCount, error: filledError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('telegram_post_id', 'is', null)
      .not('telegram_post_id', 'eq', '');
    
    if (filledError) {
      throw new Error(`Ошибка получения количества заполненных: ${filledError.message}`);
    }
    
    const { count: emptyCount, error: emptyError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .or('telegram_post_id.is.null,telegram_post_id.eq.');
    
    if (emptyError) {
      throw new Error(`Ошибка получения количества пустых: ${emptyError.message}`);
    }
    
    console.log(`\n📊 Финальная статистика:`);
    console.log(`  Всего записей: ${totalCount}`);
    console.log(`  С заполненным telegram_post_id: ${filledCount}`);
    console.log(`  С пустым telegram_post_id: ${emptyCount}`);
    console.log(`  Процент заполнения: ${totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0}%`);
    
  } catch (error) {
    console.error('❌ Ошибка проверки:', error);
  } finally {
    // Принудительно завершаем процесс через 1 секунду
    setTimeout(() => {
      console.log('🔒 Скрипт принудительно завершен');
      process.exit(0);
    }, 1000);
  }
}

checkFinalTelegramPostId();