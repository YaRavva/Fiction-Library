/**
 * Script to check the status of books in the database
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Load environment variables FIRST
config({ path: '.env' });

// Define the books we're looking for
const TARGET_BOOKS = [
  {
    bookTitle: "цикл Эвернесс",
    bookAuthor: "Йен Макдональд"
  },
  {
    bookTitle: "цикл Индия",
    bookAuthor: "Йен Макдональд"
  },
  {
    bookTitle: "цикл Луна",
    bookAuthor: "Йен Макдональд"
  },
  {
    bookTitle: "цикл Уголёк в пепле",
    bookAuthor: "Саба Тахир"
  },
  {
    bookTitle: "цикл Линия фронта",
    bookAuthor: "Марко Клоос"
  }
];

async function checkBookStatus() {
  try {
    console.log('🔍 Checking book status in database...\n');
    
    // Create Supabase client directly with environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
    
    console.log('Book Status Report:');
    console.log('==================');
    
    // Check each target book
    for (const target of TARGET_BOOKS) {
      console.log(`\n"${target.bookTitle}" by ${target.bookAuthor}:`);
      
      const { data: books, error: booksError } = await supabase
        .from('books')
        .select('*')
        .eq('title', target.bookTitle)
        .eq('author', target.bookAuthor);
      
      if (booksError) {
        console.error(`  ❌ Error: ${booksError.message}`);
        continue;
      }
      
      if (!books || books.length === 0) {
        console.log(`  ℹ️  Not found in database`);
        continue;
      }
      
      const book = books[0];
      console.log(`  📚 ID: ${book.id}`);
      console.log(`  📄 File URL: ${book.file_url ? '✅ Yes' : '❌ No'}`);
      if (book.file_url) {
        console.log(`      URL: ${book.file_url}`);
        console.log(`      Size: ${book.file_size} bytes`);
        console.log(`      Format: ${book.file_format}`);
      }
    }
    
    console.log('\n✅ Status check completed.');
    
  } catch (error) {
    console.error('❌ Error checking book status:', error);
    process.exit(1);
  }
}

// Run the script
checkBookStatus().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});