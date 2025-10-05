// Загружаем переменные окружения из .env файла
import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из файла .env в корне проекта
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

// Используем те же переменные окружения, что и в основном приложении
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют необходимые переменные окружения:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || 'не задан');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseKey || 'не задан');
  console.error('\nПожалуйста, убедитесь, что переменные окружения установлены.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findUnboundBooksWithTelegramId() {
  try {
    console.log('🔍 Поиск книг с telegram_post_id, но без series_id...');
    
    // Получаем книги с telegram_post_id, но без series_id
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id, series_id')
      .not('telegram_post_id', 'is', null)
      .is('series_id', null)
      .limit(5);
    
    if (error) {
      console.error('❌ Ошибка при получении книг:', error);
      return;
    }
    
    if (!books || books.length === 0) {
      console.log('✅ Все книги с telegram_post_id привязаны к сериям');
      return;
    }
    
    console.log(`📚 Найдено ${books.length} книг без привязки к серии:`);
    books.forEach((book, index) => {
      console.log(`${index + 1}. ${book.author} - ${book.title}`);
      console.log(`   ID: ${book.id}`);
      console.log(`   Telegram Post ID: ${book.telegram_post_id}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  } finally {
    // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Запускаем скрипт
findUnboundBooksWithTelegramId();