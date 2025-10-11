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

async function checkBookFile(bookTitle: string, bookAuthor: string) {
  try {
    console.log(`🔍 Поиск книги: "${bookTitle}" - ${bookAuthor}`);
    
    // Ищем книгу по названию и автору
    const { data: books, error: searchError } = await supabase
      .from('books')
      .select('*')
      .ilike('title', `%${bookTitle}%`)
      .ilike('author', `%${bookAuthor}%`);

    if (searchError) {
      throw new Error(`Ошибка поиска книги: ${searchError.message}`);
    }

    if (!books || books.length === 0) {
      console.log('❌ Книга не найдена');
      return;
    }

    if (books.length > 1) {
      console.log('⚠️ Найдено несколько книг:');
      books.forEach((book, index) => {
        console.log(`${index + 1}. "${book.title}" - ${book.author} (ID: ${book.id})`);
        console.log(`   file_url: ${book.file_url}`);
        console.log(`   storage_path: ${book.storage_path}`);
        console.log(`   file_size: ${book.file_size}`);
        console.log(`   file_format: ${book.file_format}`);
        console.log('---');
      });
      return;
    }

    const book = books[0];
    console.log(`✅ Найдена книга: "${book.title}" - ${book.author} (ID: ${book.id})`);
    console.log(`file_url: ${book.file_url}`);
    console.log(`storage_path: ${book.storage_path}`);
    console.log(`file_size: ${book.file_size}`);
    console.log(`file_format: ${book.file_format}`);
    console.log(`telegram_file_id: ${book.telegram_file_id}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

// Проверяем аргументы командной строки
if (process.argv.length < 4) {
  console.log('Использование: npx tsx check-book-file.ts "Название книги" "Автор книги"');
  console.log('Пример: npx tsx check-book-file.ts "цикл Ник" "Анджей Ясинский"');
  process.exit(1);
}

const bookTitle = process.argv[2];
const bookAuthor = process.argv[3];

checkBookFile(bookTitle, bookAuthor);