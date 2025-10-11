import { createClient } from '@supabase/supabase-js';

// Загружаем переменные окружения
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testFileUpdate() {
  try {
    console.log('🔍 Тест обновления файлов для книг без файлов...');
    
    // Получаем книги без файлов
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, publication_year')
      .is('file_url', null)
      .order('author', { ascending: true })
      .order('title', { ascending: true })
      .limit(3); // Ограничиваем до 3 книг для теста

    if (booksError) {
      throw new Error(`Ошибка получения книг: ${booksError.message}`);
    }

    if (!books || books.length === 0) {
      console.log('❌ Нет книг без файлов');
      return;
    }

    console.log(`✅ Найдено ${books.length} книг без файлов:`);
    books.forEach((book, index) => {
      console.log(`${index + 1}. "${book.title}" - ${book.author}`);
    });

    // Имитируем процесс обновления файлов для каждой книги
    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      console.log(`\n📚 Обработка книги ${i + 1}/${books.length}: "${book.title}" - ${book.author}`);
      
      // Получаем случайные файлы из telegram_files (для имитации)
      const { data: files, error: filesError } = await supabase
        .from('telegram_files')
        .select('message_id, file_name, file_size, mime_type, caption, date')
        .limit(5); // Получаем 5 случайных файлов

      if (filesError) {
        console.error(`❌ Ошибка получения файлов: ${filesError.message}`);
        continue;
      }

      if (!files || files.length === 0) {
        console.log('❌ Нет доступных файлов');
        continue;
      }

      console.log(`📁 Найдено ${files.length} файлов для книги:`);
      files.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.file_name || `Файл ${file.message_id}`} (${file.file_size || 'размер неизвестен'})`);
      });

      // Имитируем задержку между обработкой книг
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ Тест обновления файлов завершен');
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

testFileUpdate();