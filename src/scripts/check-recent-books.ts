import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function checkRecentBooks() {
  const { getSupabaseAdmin } = await import('../lib/supabase');
  
  try {
    console.log('🔍 Проверяем последние добавленные книги...');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем последние 10 добавленных книг
    const { data: books, error } = await supabase
      .from('books')
      .select('title, author, telegram_post_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      throw new Error(`Ошибка получения записей: ${error.message}`);
    }
    
    console.log('📊 Последние добавленные книги:');
    books.forEach((book: any, index: number) => {
      const createdAt = new Date(book.created_at);
      console.log(`${index + 1}. ${book.author} - ${book.title}`);
      console.log(`   Telegram ID: ${book.telegram_post_id}`);
      console.log(`   Добавлена: ${createdAt.toLocaleString()}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки последних книг:', error);
  } finally {
    // Принудительно завершаем процесс через 1 секунду
    setTimeout(() => {
      console.log('🔒 Скрипт принудительно завершен');
      process.exit(0);
    }, 1000);
  }
}

checkRecentBooks();