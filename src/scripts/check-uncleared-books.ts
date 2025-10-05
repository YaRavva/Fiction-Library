import { config } from 'dotenv';
import { resolve } from 'path';
import { getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function checkUnclearedBooks() {
  try {
    console.log('🚀 Проверяем книги с непустыми полями...');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем книги с непустыми полями
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, author, file_url, file_size, file_format, telegram_file_id')
      .not('file_format', 'is', null)
      .limit(10);
    
    if (error) {
      throw new Error(`Ошибка получения записей: ${error.message}`);
    }
    
    console.log(`📊 Найдено ${books.length} книг с непустыми полями file_format:`);
    
    for (const book of books) {
      console.log(`\nКнига: ${book.author} - ${book.title}`);
      console.log(`  file_format: ${book.file_format}`);
      console.log(`  telegram_file_id: ${book.telegram_file_id}`);
    }
  } catch (error) {
    console.error('❌ Ошибка проверки полей:', error);
  }
}

checkUnclearedBooks();