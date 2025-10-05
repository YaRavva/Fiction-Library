/**
 * Test script for relevant book search by words from filename
 * This script implements the algorithm for matching files with books based on word relevance
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Load environment variables FIRST
config({ path: '.env' });

/**
 * Extract words from filename for search
 * @param filename The filename to extract words from
 * @returns Array of words
 */
function extractWordsFromFilename(filename: string): string[] {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // Split by common separators and spaces
  const words = nameWithoutExt
    .split(/[_\-\s,]+/) // Split by underscore, dash, space, comma
    .filter(word => word.length > 2) // Filter out very short words
    .map(word => word.trim().toLowerCase()) // Normalize
    .filter(word => word.length > 0); // Remove empty strings
  
  // Remove common words that don't help with matching
  const commonWords = ['and', 'or', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'zip', 'rar', 'fb2', 'epub', 'pdf', 'mobi'];
  return words.filter(word => !commonWords.includes(word));
}

/**
 * Find relevant books by words with relevance scoring
 * @param words Words extracted from filename
 * @param books Books from database
 * @returns Array of matched books with relevance scores
 */
function findRelevantBooks(words: string[], books: any[]): { book: any; score: number }[] {
  const matches: { book: any; score: number }[] = [];
  
  for (const book of books) {
    const bookTitle = (book.title || '').toLowerCase();
    const bookAuthor = (book.author || '').toLowerCase();
    
    // Combine title and author for searching
    const bookText = `${bookTitle} ${bookAuthor}`;
    
    let score = 0;
    
    // Check each word for matches
    for (const word of words) {
      // Check if word appears in book title or author
      if (bookTitle.includes(word)) {
        score += 2; // Title match is more important
      }
      if (bookAuthor.includes(word)) {
        score += 2; // Author match is also important
      }
      
      // Check if word appears anywhere in the combined text
      if (bookText.includes(word)) {
        score += 1; // General match
      }
    }
    
    // Only include books with some relevance
    if (score > 0) {
      matches.push({ book, score });
    }
  }
  
  // Sort by relevance score (highest first)
  matches.sort((a, b) => b.score - a.score);
  
  return matches;
}

async function testRelevantBookSearch() {
  console.log('🚀 Testing relevant book search algorithm...\n');
  
  try {
    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Test filenames
    const testFilenames = [
      "Вилма Кадлечкова - Мицелий.zip",
      "Антон_Карелин_Хроники_Опустошённых_земель.zip",
      "Антон Карелин - Одиссей Фокс.zip",
      "Ларри Нивен - Известный космос.zip",
      "Конни Уиллис - Оксфордский цикл.zip",
      "Татьяна Солодкова - Реонерия.zip"
    ];
    
    // Fetch books from database
    console.log('📖 Fetching books from database...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, file_url')
      .limit(100); // Get enough books for testing
    
    if (booksError) {
      throw new Error(`Error fetching books: ${booksError.message}`);
    }
    
    console.log(`✅ Retrieved ${books?.length || 0} books from database\n`);
    
    // Test search for each filename
    for (const filename of testFilenames) {
      console.log(`📁 Testing file: ${filename}`);
      
      // Extract words from filename
      const words = extractWordsFromFilename(filename);
      console.log(`   Words extracted: [${words.join(', ')}]`);
      
      // Find relevant books
      const matches = findRelevantBooks(words, books || []);
      
      if (matches.length > 0) {
        console.log(`   ✅ Found ${matches.length} matches:`);
        
        // Show top 5 matches
        const topMatches = matches.slice(0, 5);
        for (const match of topMatches) {
          const hasFile = match.book.file_url && match.book.file_url.length > 0;
          console.log(`      "${match.book.title}" by ${match.book.author} (score: ${match.score}) ${hasFile ? '[HAS FILE]' : '[NO FILE]'}`);
        }
      } else {
        console.log(`   ❌ No matches found`);
      }
      
      console.log(''); // Empty line for readability
    }
    
    // Test with a specific example to show detailed scoring
    console.log('🔍 Detailed scoring example:');
    const exampleFilename = "Антон Карелин - Одиссей Фокс.zip";
    console.log(`   File: ${exampleFilename}`);
    
    const exampleWords = extractWordsFromFilename(exampleFilename);
    console.log(`   Words: [${exampleWords.join(', ')}]`);
    
    // Find matches and show scoring details
    for (const book of books || []) {
      const bookTitle = (book.title || '').toLowerCase();
      const bookAuthor = (book.author || '').toLowerCase();
      const bookText = `${bookTitle} ${bookAuthor}`;
      
      let score = 0;
      const scoreDetails: string[] = [];
      
      for (const word of exampleWords) {
        if (bookTitle.includes(word)) {
          score += 2;
          scoreDetails.push(`title(+2):${word}`);
        }
        if (bookAuthor.includes(word)) {
          score += 2;
          scoreDetails.push(`author(+2):${word}`);
        }
        if (bookText.includes(word)) {
          score += 1;
          scoreDetails.push(`text(+1):${word}`);
        }
      }
      
      if (score > 0) {
        console.log(`   "${book.title}" by ${book.author}`);
        console.log(`      Score: ${score} [${scoreDetails.join(', ')}]`);
      }
    }
    
    console.log('\n✅ Relevant book search test completed!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Run the script
testRelevantBookSearch().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});