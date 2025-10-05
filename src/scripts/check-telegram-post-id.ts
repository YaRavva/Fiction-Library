import { config } from 'dotenv';
import { resolve } from 'path';
import { getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function checkTelegramPostId() {
  try {
    console.log('🚀 Проверяем поле telegram_post_id у случайных книг...');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем 5 случайных книг
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id')
      .limit(5);
    
    if (error) {
      throw new Error(`Ошибка получения записей: ${error.message}`);
    }
    
    console.log(`📊 Проверяем ${books.length} книг:`);
    
    for (const book of books) {
      console.log(`\nКнига: ${book.author} - ${book.title}`);
      console.log(`  telegram_post_id: ${book.telegram_post_id === null ? 'пусто' : book.telegram_post_id}`);
    }
  } catch (error) {
    console.error('❌ Ошибка проверки поля telegram_post_id:', error);
  }
}

checkTelegramPostId();