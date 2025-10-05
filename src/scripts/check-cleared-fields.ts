import { config } from 'dotenv';
import { resolve } from 'path';
import { getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

async function checkClearedFields() {
  try {
    console.log('🚀 Проверяем очистку полей у случайных книг...');
    
    // Получаем клиент Supabase
    const supabase: any = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Получаем 5 случайных книг
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, author, file_url, file_size, file_format, telegram_file_id')
      .limit(5);
    
    if (error) {
      throw new Error(`Ошибка получения записей: ${error.message}`);
    }
    
    console.log(`📊 Проверяем ${books.length} книг:`);
    
    for (const book of books) {
      console.log(`\nКнига: ${book.author} - ${book.title}`);
      console.log(`  file_url: ${book.file_url === null ? 'очищено' : 'осталось значение'}`);
      console.log(`  file_size: ${book.file_size === null ? 'очищено' : 'осталось значение'}`);
      console.log(`  file_format: ${book.file_format === null ? 'очищено' : 'осталось значение'}`);
      console.log(`  telegram_file_id: ${book.telegram_file_id === null ? 'очищено' : 'осталось значение'}`);
    }
  } catch (error) {
    console.error('❌ Ошибка проверки полей:', error);
  }
}

checkClearedFields();