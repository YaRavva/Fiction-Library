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

async function clearBookFile(bookTitle: string, authorName: string) {
  try {
    console.log(`🔍 Поиск книги: "${bookTitle}" by "${authorName}"`);

    // First, find the author by name
    const { data: authorData, error: authorError } = await supabase
      .from('authors')
      .select('id')
      .ilike('name', authorName)
      .single();

    if (authorError || !authorData) {
      console.error(`❌ Автор "${authorName}" не найден`);
      return;
    }

    const authorId = authorData.id;
    console.log(`✅ Автор найден: ${authorName} (ID: ${authorId})`);

    // Find the book by title and author
    const { data: bookData, error: bookError } = await supabase
      .from('books')
      .select('id, file_path')
      .eq('author_id', authorId)
      .ilike('title', bookTitle)
      .single();

    if (bookError || !bookData) {
      console.error(`❌ Книга "${bookTitle}" не найдена для автора "${authorName}"`);
      return;
    }

    const bookId = bookData.id;
    const currentFilePath = bookData.file_path;
    
    if (!currentFilePath) {
      console.log(`⚠️ У книги "${bookTitle}" уже нет привязанного файла`);
      return;
    }

    console.log(`📚 Найдена книга: "${bookTitle}" (ID: ${bookId})`);
    console.log(`📁 Текущий путь к файлу: ${currentFilePath}`);

    // Clear the file_path field for the book
    const { error: updateError } = await supabase
      .from('books')
      .update({ file_path: null })
      .eq('id', bookId);

    if (updateError) {
      console.error(`❌ Ошибка при очистке файла книги: ${updateError.message}`);
      return;
    }

    console.log(`✅ Файл книги "${bookTitle}" успешно очищен!`);
  } catch (error) {
    console.error(`❌ Неожиданная ошибка: ${(error as Error).message}`);
  }
}

async function clearBookFileById(bookId: string) {
  try {
    console.log(`🔍 Поиск книги по ID: ${bookId}`);

    // Find the book by ID
    const { data: bookData, error: bookError } = await supabase
      .from('books')
      .select('id, title, author, file_url, storage_path')
      .eq('id', bookId)
      .single();

    if (bookError || !bookData) {
      console.error(`❌ Книга с ID "${bookId}" не найдена`);
      return;
    }

    console.log(`✅ Найдена книга: "${bookData.title}" - ${bookData.author} (ID: ${bookData.id})`);

    // Check if there's a file linked
    if (!bookData.file_url && !bookData.storage_path) {
      console.log(`⚠️ У книги уже нет привязанного файла`);
      return;
    }

    console.log(`📁 Текущий файл: ${bookData.file_url || bookData.storage_path}`);

    // Clear the file fields for the book without confirmation
    const { error: updateError } = await supabase
      .from('books')
      .update({
        file_url: null,
        storage_path: null,
        file_size: null,
        file_format: null,
        telegram_file_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookId);

    if (updateError) {
      console.error(`❌ Ошибка при очистке файла книги: ${updateError.message}`);
      return;
    }

    console.log(`✅ Файл книги "${bookData.title}" успешно очищен!`);
  } catch (error) {
    console.error(`❌ Неожиданная ошибка: ${(error as Error).message}`);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Использование:');
  console.log('  По названию и автору: npx tsx clear-book-file-simple.ts "название книги" "имя автора"');
  console.log('  По ID книги: npx tsx clear-book-file-simple.ts --id "ID книги"');
  process.exit(1);
}

if (args[0] === '--id' && args.length === 2) {
  const bookId = args[1];
  clearBookFileById(bookId);
} else if (args.length === 2) {
  const [bookTitle, authorName] = args;
  clearBookFile(bookTitle, authorName);
} else {
  console.log('Неверные аргументы.');
  console.log('Использование:');
  console.log('  По названию и автору: npx tsx clear-book-file-simple.ts "название книги" "имя автора"');
  console.log('  По ID книги: npx tsx clear-book-file-simple.ts --id "ID книги"');
  process.exit(1);
}