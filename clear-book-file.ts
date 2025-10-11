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

async function clearBookFileLink(bookTitle: string, bookAuthor: string) {
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
      });
      console.log('Пожалуйста, уточните запрос');
      return;
    }

    const book = books[0];
    console.log(`✅ Найдена книга: "${book.title}" - ${book.author} (ID: ${book.id})`);

    // Проверяем, есть ли привязанный файл
    if (!book.file_url) {
      console.log('ℹ️ У книги нет привязанного файла');
      return;
    }

    console.log(`📁 Текущий файл: ${book.file_url}`);
    
    // Подтверждение очистки
    console.log('\n⚠️ ВНИМАНИЕ: Будет очищена привязка файла к книге');
    console.log('Продолжить? (y/N)');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('', async (answer: string) => {
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❌ Очистка отменена');
        rl.close();
        return;
      }

      try {
        // Очищаем привязку файла к книге
        const { data, error } = await supabase
          .from('books')
          .update({
            file_url: null,
            storage_path: null,
            file_size: null,
            file_format: null,
            telegram_file_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', book.id)
          .select()
          .single();

        if (error) {
          throw new Error(`Ошибка обновления книги: ${error.message}`);
        }

        console.log(`✅ Привязка файла успешно очищена для книги "${book.title}"`);
        rl.close();
      } catch (updateError) {
        console.error('❌ Ошибка при очистке привязки файла:', updateError);
        rl.close();
      }
    });
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

// Проверяем аргументы командной строки
if (process.argv.length < 4) {
  console.log('Использование: npx tsx clear-book-file.ts "Название книги" "Автор книги"');
  console.log('Пример: npx tsx clear-book-file.ts "цикл Ник" "Анджей Ясинский"');
  process.exit(1);
}

const bookTitle = process.argv[2];
const bookAuthor = process.argv[3];

clearBookFileLink(bookTitle, bookAuthor);