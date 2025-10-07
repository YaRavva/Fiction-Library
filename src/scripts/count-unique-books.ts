/**
 * Script to count unique books in the database and compare with Telegram messages
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Load environment variables FIRST
config({ path: '.env.local' });
config({ path: '.env' });

async function countUniqueBooks() {
  try {
    console.log('🔍 Анализ уникальных книг в базе данных\n');
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // 1. Подсчет общего количества книг
    console.log('1. Подсчет общего количества книг...');
    const { count: totalBooks, error: totalBooksError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
    
    if (totalBooksError) {
      throw new Error(`Error counting total books: ${totalBooksError.message}`);
    }
    
    console.log(`   Всего книг в базе данных: ${totalBooks}`);
    
    // 2. Подсчет уникальных книг по title + author
    console.log('\n2. Подсчет уникальных книг по названию и автору...');
    const { data: uniqueBooksByTitleAuthor, error: uniqueBooksError } = await supabase
      .from('books')
      .select('title, author')
      .order('title', { ascending: true })
      .order('author', { ascending: true });
    
    if (uniqueBooksError) {
      throw new Error(`Error fetching books for unique count: ${uniqueBooksError.message}`);
    }
    
    // Удаление дубликатов по title + author
    const uniqueBookSet = new Set();
    uniqueBooksByTitleAuthor?.forEach(book => {
      uniqueBookSet.add(`${book.title}|${book.author}`);
    });
    
    console.log(`   Уникальных книг (по названию + автору): ${uniqueBookSet.size}`);
    
    // 3. Подсчет книг с telegram_post_id
    console.log('\n3. Подсчет книг с telegram_post_id...');
    const { count: booksWithTelegramId, error: telegramIdError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('telegram_post_id', 'is', null);
    
    if (telegramIdError) {
      throw new Error(`Error counting books with telegram_post_id: ${telegramIdError.message}`);
    }
    
    console.log(`   Книг с telegram_post_id: ${booksWithTelegramId}`);
    
    // 4. Подсчет книг с file_url (загруженных)
    console.log('\n4. Подсчет загруженных книг (с file_url)...');
    const { count: booksWithFile, error: fileError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('file_url', 'is', null);
    
    if (fileError) {
      throw new Error(`Error counting books with file_url: ${fileError.message}`);
    }
    
    console.log(`   Загруженных книг: ${booksWithFile}`);
    
    // 5. Подсчет обработанных сообщений Telegram
    console.log('\n5. Подсчет обработанных сообщений Telegram...');
    const { count: processedMessages, error: messagesError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true });
    
    if (messagesError) {
      throw new Error(`Error counting processed messages: ${messagesError.message}`);
    }
    
    console.log(`   Обработанных сообщений Telegram: ${processedMessages}`);
    
    // 6. Подсчет сообщений с book_id
    console.log('\n6. Подсчет сообщений Telegram, связанных с книгами...');
    const { count: messagesWithBooks, error: messagesWithBooksError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true })
      .not('book_id', 'is', null);
    
    if (messagesWithBooksError) {
      throw new Error(`Error counting messages with book_id: ${messagesWithBooksError.message}`);
    }
    
    console.log(`   Сообщений Telegram, связанных с книгами: ${messagesWithBooks}`);
    
    // 7. Подсчет сообщений с telegram_file_id (файлы)
    console.log('\n7. Подсчет сообщений Telegram с файлами...');
    const { count: messagesWithFiles, error: messagesWithFilesError } = await supabase
      .from('telegram_processed_messages')
      .select('*', { count: 'exact', head: true })
      .not('telegram_file_id', 'is', null);
    
    if (messagesWithFilesError) {
      throw new Error(`Error counting messages with telegram_file_id: ${messagesWithFilesError.message}`);
    }
    
    console.log(`   Сообщений Telegram с файлами: ${messagesWithFiles}`);
    
    // 8. Анализ дубликатов
    console.log('\n8. Анализ потенциальных дубликатов...');
    
    // Получаем все книги с одинаковыми title + author
    const { data: allBooks, error: allBooksError } = await supabase
      .from('books')
      .select('id, title, author, created_at')
      .order('title', { ascending: true })
      .order('author', { ascending: true })
      .order('created_at', { ascending: true });
    
    if (allBooksError) {
      throw new Error(`Error fetching all books: ${allBooksError.message}`);
    }
    
    // Группируем книги по title + author
    const booksByTitleAuthor = new Map<string, any[]>();
    allBooks?.forEach(book => {
      const key = `${book.title}|${book.author}`;
      if (!booksByTitleAuthor.has(key)) {
        booksByTitleAuthor.set(key, []);
      }
      booksByTitleAuthor.get(key)?.push(book);
    });
    
    // Подсчитываем дубликаты
    let duplicateGroups = 0;
    let totalDuplicates = 0;
    booksByTitleAuthor.forEach((books, key) => {
      if (books.length > 1) {
        duplicateGroups++;
        totalDuplicates += books.length - 1; // Количество дубликатов (оставляем 1 оригинал)
      }
    });
    
    console.log(`   Групп дубликатов: ${duplicateGroups}`);
    console.log(`   Общее количество дубликатов: ${totalDuplicates}`);
    
    // 9. Сводка
    console.log('\n📊 СВОДКА:');
    console.log(`   ========================================`);
    console.log(`   Всего книг в базе данных: ${totalBooks}`);
    console.log(`   Уникальных книг (по названию + автору): ${uniqueBookSet.size}`);
    console.log(`   Книг с telegram_post_id: ${booksWithTelegramId}`);
    console.log(`   Загруженных книг: ${booksWithFile}`);
    console.log(`   Обработанных сообщений Telegram: ${processedMessages}`);
    console.log(`   Сообщений Telegram, связанных с книгами: ${messagesWithBooks}`);
    console.log(`   Сообщений Telegram с файлами: ${messagesWithFiles}`);
    console.log(`   Групп дубликатов: ${duplicateGroups}`);
    console.log(`   Общее количество дубликатов: ${totalDuplicates}`);
    
    console.log('\n✅ Анализ завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при анализе уникальных книг:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  countUniqueBooks();
}