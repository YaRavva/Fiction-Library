import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем переменные окружения из .env файла
config({ path: resolve(__dirname, '../../.env') });

async function supabaseExample() {
  console.log('Пример использования Supabase в проекте Fiction Library');
  
  try {
    // Проверяем наличие необходимых переменных окружения
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Отсутствуют необходимые переменные окружения Supabase');
      return;
    }
    
    console.log('✅ Переменные окружения найдены');
    
    // Импортируем Supabase клиент
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Пример 1: Получение количества книг в базе
    console.log('\n🔍 Пример 1: Получение количества книг в базе...');
    const { count, error: countError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Ошибка при подсчете книг:', countError.message);
    } else {
      console.log(`✅ Найдено книг в базе: ${count}`);
    }
    
    // Пример 2: Получение первых 5 книг с названиями и авторами
    console.log('\n📚 Пример 2: Получение первых 5 книг...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author')
      .limit(5);
    
    if (booksError) {
      console.error('❌ Ошибка при получении книг:', booksError.message);
    } else {
      console.log(`✅ Получено ${books.length} книг:`);
      books.forEach((book, index) => {
        console.log(`  ${index + 1}. "${book.title}" - ${book.author}`);
      });
    }
    
    // Пример 3: Поиск книг по автору
    console.log('\n🔍 Пример 3: Поиск книг по автору...');
    const authorSearch = 'Толстой'; // Пример поиска
    const { data: tolkienBooks, error: searchError } = await supabase
      .from('books')
      .select('id, title, author')
      .ilike('author', `%${authorSearch}%`)
      .limit(5);
    
    if (searchError) {
      console.error('❌ Ошибка при поиске книг:', searchError.message);
    } else {
      console.log(`✅ Найдено ${tolkienBooks.length} книг автора "${authorSearch}":`);
      if (tolkienBooks.length > 0) {
        tolkienBooks.forEach((book, index) => {
          console.log(`  ${index + 1}. "${book.title}"`);
        });
      } else {
        console.log('  Книги не найдены');
      }
    }
    
    console.log('\n✅ Все примеры выполнены успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка в примере использования Supabase:', error);
  }
}

supabaseExample().catch(console.error);