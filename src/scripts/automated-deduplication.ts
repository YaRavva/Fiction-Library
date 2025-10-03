/**
 * Automated deduplication script
 * This script can be run periodically to automatically deduplicate books
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
config({ path: '.env.local' });
config({ path: '.env' });

// Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

interface Book {
  id: string;
  title: string;
  author: string;
  publication_year?: number;
  file_url?: string;
  file_size?: number;
  file_format?: string;
  telegram_file_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Enhanced duplicate checking function
 * Checks for duplicates based on multiple criteria
 */
async function checkForDuplicates(
  title: string, 
  author: string, 
  publicationYear?: number
): Promise<{ exists: boolean; book?: Book }> {
  try {
    let query = supabaseAdmin
      .from('books')
      .select('id, title, author, publication_year, file_url, created_at, updated_at')
      .eq('title', title)
      .eq('author', author);
    
    // If publication year is provided, use it for more precise matching
    if (publicationYear) {
      query = query.eq('publication_year', publicationYear);
    }
    
    const { data, error } = await query.limit(1).single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "single row expected" which is expected when no rows found
      console.error('Error checking for duplicates:', error);
      return { exists: false };
    }
    
    return { 
      exists: !!data, 
      book: data || undefined 
    };
  } catch (error) {
    console.error('Error in duplicate check:', error);
    return { exists: false };
  }
}

async function runDeduplication() {
  console.log('🔍 Starting automated deduplication process...\n');
  
  try {
    // Получаем все книги для проверки
    const { data: books, error: booksError } = await supabaseAdmin
      .from('books')
      .select('id, title, author, publication_year, file_url, file_size, file_format, telegram_file_id, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (booksError) {
      throw booksError;
    }

    if (!books || books.length === 0) {
      console.log('📚 No books found for deduplication');
      return;
    }

    console.log(`📚 Processing ${books.length} books for deduplication...\n`);

    const results = {
      processed: books.length,
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      details: [] as string[],
    };

    // Для каждой книги проверяем наличие дубликатов
    for (const book of books) {
      try {
        // Проверяем наличие дубликатов
        const duplicateCheck = await checkForDuplicates(
          book.title,
          book.author,
          book.publication_year
        );

        if (duplicateCheck.exists && duplicateCheck.book) {
          results.duplicatesFound++;
          const existingBook = duplicateCheck.book;
          
          // Проверяем, есть ли у существующей книги файл
          // Если у существующей книги нет файла, но у текущей есть
          if (!existingBook.file_url && book.file_url) {
            // Обновляем существующую книгу с файлом
            const { error: updateError } = await supabaseAdmin
              .from('books')
              .update({
                file_url: book.file_url,
                file_size: book.file_size,
                file_format: book.file_format,
                telegram_file_id: book.telegram_file_id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingBook.id);

            if (updateError) {
              results.details.push(`Failed to update book ${existingBook.id} with file: ${updateError.message}`);
            } else {
              results.details.push(`Updated book ${existingBook.id} with file from duplicate ${book.id}`);
              
              // Удаляем дубликат
              const { error: deleteError } = await supabaseAdmin
                .from('books')
                .delete()
                .eq('id', book.id);

              if (deleteError) {
                results.details.push(`Failed to delete duplicate book ${book.id}: ${deleteError.message}`);
              } else {
                results.duplicatesRemoved++;
                results.details.push(`Deleted duplicate book ${book.id}`);
              }
            }
          } 
          // Если у обеих книг есть файлы, оставляем существующую и удаляем дубликат
          else if (existingBook.file_url && book.file_url) {
            const { error: deleteError } = await supabaseAdmin
              .from('books')
              .delete()
              .eq('id', book.id);

            if (deleteError) {
              results.details.push(`Failed to delete duplicate book ${book.id}: ${deleteError.message}`);
            } else {
              results.duplicatesRemoved++;
              results.details.push(`Deleted duplicate book ${book.id} (both had files)`);
            }
          }
          // Если ни у одной книги нет файла, удаляем дубликат
          else {
            const { error: deleteError } = await supabaseAdmin
              .from('books')
              .delete()
              .eq('id', book.id);

            if (deleteError) {
              results.details.push(`Failed to delete duplicate book ${book.id}: ${deleteError.message}`);
            } else {
              results.duplicatesRemoved++;
              results.details.push(`Deleted duplicate book ${book.id} (no files)`);
            }
          }
        }
      } catch (error) {
        results.details.push(`Error processing book ${book.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Выводим результаты
    console.log(`\n✅ Deduplication completed:`);
    console.log(`   Processed: ${results.processed} books`);
    console.log(`   Duplicates found: ${results.duplicatesFound}`);
    console.log(`   Duplicates removed: ${results.duplicatesRemoved}`);
    
    if (results.details.length > 0) {
      console.log(`\n📝 Details:`);
      results.details.forEach(detail => console.log(`   • ${detail}`));
    }
    
    // Обновляем время последнего запуска в настройках таймера
    const now = new Date().toISOString();
    const nextRun = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1 hour default
    
    await supabaseAdmin
      .from('timer_settings')
      .update({
        last_run: now,
        next_run: nextRun,
        updated_at: now,
      })
      .eq('process_name', 'deduplication');
      
    console.log(`\n⏰ Timer settings updated`);
    
  } catch (error) {
    console.error('❌ Error during deduplication:', error);
    process.exit(1);
  }
}

// Run the deduplication process
runDeduplication();