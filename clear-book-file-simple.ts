import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log('Использование: npx tsx clear-book-file-simple.ts "название книги" "имя автора"');
  process.exit(1);
}

const [bookTitle, authorName] = args;
clearBookFile(bookTitle, authorName);