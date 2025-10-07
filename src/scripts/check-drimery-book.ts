import { config } from 'dotenv';
import { resolve } from 'path';
import { getSupabaseAdmin } from '../lib/supabase';

// Загружаем переменные окружения из .env файла
const envPath = resolve(__dirname, '../../.env');
config({ path: envPath });

/**
 * Скрипт для проверки книги "цикл Дримеры" автора Сергей Ткачев
 */
export async function checkDrimeryBook() {
  try {
    console.log('🔍 Проверяем книгу "цикл Дримеры" автора Сергей Ткачев');
    
    // Получаем клиент Supabase
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Не удалось создать клиент Supabase');
    }
    
    // Ищем книгу по названию и автору
    const { data: books, error } = await supabase
      .from('books')
      .select('*')
      .eq('title', 'цикл Дримеры')
      .eq('author', 'Сергей Ткачев');
    
    if (error) {
      throw new Error(`Ошибка поиска книги: ${error.message}`);
    }
    
    if (!books || books.length === 0) {
      console.log('❌ Книга не найдена');
      return;
    }
    
    console.log(`✅ Найдено ${books.length} книг`);
    
    // Выводим информацию о найденных книгах
    for (const book of books) {
      const typedBook: any = book;
      console.log('\n📄 Информация о книге:');
      console.log(`  ID: ${typedBook.id}`);
      console.log(`  Название: ${typedBook.title}`);
      console.log(`  Автор: ${typedBook.author}`);
      console.log(`  Описание: ${typedBook.description || 'отсутствует'}`);
      console.log(`  Telegram ID: ${typedBook.telegram_file_id || 'отсутствует'}`);
      console.log(`  URL файла: ${typedBook.file_url || 'отсутствует'}`);
    }
  } catch (error) {
    console.error('❌ Ошибка проверки книги:', error);
  }
}

// Если скрипт запущен напрямую, выполняем проверку
if (require.main === module) {
  checkDrimeryBook()
    .then(() => {
      console.log('🔒 Скрипт завершен');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Ошибка при выполнении скрипта:', error);
      process.exit(1);
    });
}
