import { config } from 'dotenv';
import { resolve } from 'path';
import { getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function checkRealBooks() {
  try {
    console.log('🔍 Проверяем реальные книги в базе данных...');
    const supabase = getSupabaseAdmin();
    
    if (!supabase) {
      console.error('❌ Не удалось создать клиент Supabase');
      return;
    }
    
    // Получаем несколько книг для проверки
    // @ts-ignore
    const { data: books, error } = await supabase
      .from('books')
      .select('author, title, cover_url, telegram_post_id')
      .limit(5);
    
    if (error) {
      console.error('❌ Ошибка получения книг:', error.message);
      return;
    }
    
    console.log(`📚 Найдено ${books?.length || 0} книг:`);
    // @ts-ignore
    books?.forEach((book: any, index: number) => {
      console.log(`${index + 1}. ${book.author} - ${book.title}`);
      // @ts-ignore
      console.log(`   Обложка: ${book.cover_url ? 'Есть' : 'Нет'}`);
      // @ts-ignore
      console.log(`   Telegram ID: ${book.telegram_post_id || 'Нет'}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запускаем проверку
checkRealBooks();