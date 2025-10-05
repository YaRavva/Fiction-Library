// Загружаем переменные окружения из .env файла
import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения из файла .env в корне проекта
const envPath = join(process.cwd(), '.env');
config({ path: envPath });

// Используем те же переменные окружения, что и в основном приложении
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют необходимые переменные окружения:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || 'не задан');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseKey || 'не задан');
  console.error('\nПожалуйста, убедитесь, что переменные окружения установлены.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBookComposition() {
  try {
    console.log('🔍 Проверяем состав книги "Елизавета Дворецкая - цикл Корабль во фьорде"');
    
    // Получаем книгу
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('title', 'цикл Корабль во фьорде')
      .eq('author', 'Елизавета Дворецкая')
      .single();
    
    if (bookError) {
      console.error('❌ Ошибка при получении книги:', bookError);
      return;
    }
    
    if (!book) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    console.log(`📚 Найдена книга:`);
    console.log(`- ID: ${book.id}`);
    console.log(`- Название: ${book.title}`);
    console.log(`- Автор: ${book.author}`);
    console.log(`- Telegram Post ID: ${book.telegram_post_id}`);
    console.log(`- Series ID: ${book.series_id || 'не привязана'}`);
    
    // Если книга привязана к серии, проверяем состав
    if (book.series_id) {
      console.log(`\n🔍 Проверяем состав серии...`);
      
      // Получаем информацию о серии
      const { data: series, error: seriesError } = await supabase
        .from('series')
        .select('*')
        .eq('id', book.series_id)
        .single();
      
      if (seriesError) {
        console.error('❌ Ошибка при получении информации о серии:', seriesError);
        return;
      }
      
      console.log(`\n📚 Информация о серии:`);
      console.log(`- ID: ${series.id}`);
      console.log(`- Название: ${series.title}`);
      console.log(`- Автор: ${series.author}`);
      
      const composition = series.series_composition || [];
      console.log(`- Состав: ${composition.length} книг`);
      
      if (composition.length > 0) {
        console.log(`\n📋 Состав серии:`);
        composition.forEach((book: any, index: number) => {
          console.log(`  ${index + 1}. ${book.title} (${book.year})`);
        });
      } else {
        console.log(`\n⚠️  Состав серии пуст`);
      }
    } else {
      console.log(`\nℹ️  Книга не привязана к серии`);
    }
    
    console.log('\n✅ Проверка завершена!');
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
}

// Запускаем скрипт
checkBookComposition();