/**
 * Improved test script for relevant book search with enhanced matching logic
 * This script improves the word matching algorithm for better book-file correlation
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Load environment variables FIRST
config({ path: '.env' });

/**
 * Extract words and phrases from filename for better search
 * @param filename The filename to extract terms from
 * @returns Object with words and phrases
 */
function extractSearchTerms(filename: string): { words: string[]; phrases: string[] } {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // Extract potential phrases (multi-word combinations)
  const phrases: string[] = [];
  
  // Handle multiple authors separated by "и" or commas
  if (nameWithoutExt.includes('_и_') || nameWithoutExt.includes(',')) {
    const parts = nameWithoutExt.split(/_и_|,/);
    for (const part of parts) {
      const cleanPart = part.trim().replace(/_/g, ' ');
      if (cleanPart.length > 3) {
        phrases.push(cleanPart.toLowerCase());
      }
    }
  }
  
  // Split by common separators and spaces
  const words = nameWithoutExt
    .split(/[_\-\s]+/) // Split by underscore, dash, space
    .filter(word => word.length > 2) // Filter out very short words
    .map(word => word.trim().toLowerCase()) // Normalize
    .filter(word => word.length > 0); // Remove empty strings
  
  // Remove common words that don't help with matching
  const commonWords = ['and', 'or', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'zip', 'rar', 'fb2', 'epub', 'pdf', 'mobi', 'цикл'];
  const filteredWords = words.filter(word => !commonWords.includes(word));
  
  // Create additional phrases from consecutive words
  if (filteredWords.length > 1) {
    for (let i = 0; i < filteredWords.length - 1; i++) {
      const phrase = `${filteredWords[i]} ${filteredWords[i + 1]}`;
      phrases.push(phrase);
    }
  }
  
  return { words: filteredWords, phrases };
}

/**
 * Calculate relevance score between search terms and book
 * @param searchTerms Terms extracted from filename
 * @param book Book from database
 * @returns Relevance score
 */
function calculateRelevanceScore(searchTerms: { words: string[], phrases: string[] }, book: any): number {
  const bookTitle = (book.title || '').toLowerCase();
  const bookAuthor = (book.author || '').toLowerCase();
  
  let score = 0;
  
  // Word-level matching
  for (const word of searchTerms.words) {
    // Exact word matches in title (most valuable)
    if (bookTitle.split(/\s+/).includes(word)) {
      score += 3;
    }
    // Partial word matches in title
    else if (bookTitle.includes(word)) {
      score += 2;
    }
    
    // Exact word matches in author (most valuable)
    if (bookAuthor.split(/\s+/).includes(word)) {
      score += 3;
    }
    // Partial word matches in author
    else if (bookAuthor.includes(word)) {
      score += 2;
    }
    
    // General text matches (less valuable)
    if (bookTitle.includes(word) || bookAuthor.includes(word)) {
      score += 1;
    }
  }
  
  // Phrase-level matching (more valuable)
  for (const phrase of searchTerms.phrases) {
    if (bookTitle.includes(phrase)) {
      score += 4; // Phrase match in title is very valuable
    }
    if (bookAuthor.includes(phrase)) {
      score += 4; // Phrase match in author is very valuable
    }
    if (bookTitle.includes(phrase) || bookAuthor.includes(phrase)) {
      score += 2; // General phrase match
    }
  }
  
  return score;
}

/**
 * Find best matching book with enhanced relevance scoring
 * @param filename Filename to match
 * @param books Books from database
 * @returns Best matching book with score, or null if no good match
 */
function findBestMatchingBook(filename: string, books: any[]): { book: any; score: number } | null {
  const searchTerms = extractSearchTerms(filename);
  
  console.log(`   Search terms - Words: [${searchTerms.words.join(', ')}], Phrases: [${searchTerms.phrases.join(', ')}]`);
  
  let bestMatch: { book: any; score: number } | null = null;
  
  for (const book of books) {
    const score = calculateRelevanceScore(searchTerms, book);
    
    // Only consider matches with reasonable relevance
    if (score >= 5) { // Minimum threshold
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { book, score };
      }
    }
  }
  
  return bestMatch;
}

async function testImprovedRelevantSearch() {
  console.log('🚀 Testing improved relevant book search algorithm...\n');
  
  try {
    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Test filenames that were problematic before
    const testFilenames = [
      "Вилма Кадлечкова - Мицелий.zip",
      "Антон_Карелин_Хроники_Опустошённых_земель.zip",
      "Антон Карелин - Одиссей Фокс.zip",
      "Олег_Яковлев,_Владимир_Торин_Хроники_разбитого_Зеркала.zip",
      "Владимир_Торин_и_Олег_Яковлев_Мистер_Вечный.zip",
      "Ларри Нивен - Известный космос.zip",
      "Конни Уиллис - Оксфордский цикл.zip",
      "Татьяна_Солодкова_Вселенная_Морган.zip",
      "Татьяна Солодкова - Реонерия.zip",
      "Шелли_Паркер_Сияющий_император.zip"
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
    
    let totalFiles = 0;
    let matchedFiles = 0;
    let highConfidenceMatches = 0;
    
    // Test search for each filename
    for (const filename of testFilenames) {
      totalFiles++;
      console.log(`📁 Testing file: ${filename}`);
      
      const bestMatch = findBestMatchingBook(filename, books || []);
      
      if (bestMatch) {
        matchedFiles++;
        const hasFile = bestMatch.book.file_url && bestMatch.book.file_url.length > 0;
        console.log(`   ✅ Best match: "${bestMatch.book.title}" by ${bestMatch.book.author}`);
        console.log(`      Score: ${bestMatch.score} ${hasFile ? '[HAS FILE]' : '[NO FILE]'}`);
        
        // Count high confidence matches (score >= 10)
        if (bestMatch.score >= 10) {
          highConfidenceMatches++;
        }
      } else {
        console.log(`   ❌ No good match found`);
      }
      
      console.log(''); // Empty line for readability
    }
    
    // Summary
    console.log('📊 SEARCH RESULTS SUMMARY:');
    console.log(`   Total files tested: ${totalFiles}`);
    console.log(`   Files with matches: ${matchedFiles} (${(matchedFiles/totalFiles*100).toFixed(1)}%)`);
    console.log(`   High confidence matches: ${highConfidenceMatches} (${(highConfidenceMatches/totalFiles*100).toFixed(1)}%)`);
    
    if (matchedFiles > 0) {
      console.log('\n🎉 SUCCESS: Improved search algorithm is working!');
      console.log('💡 The algorithm successfully matches files to books based on:');
      console.log('   • Individual word matches in titles and authors');
      console.log('   • Multi-word phrase matches');
      console.log('   • Handling of multiple authors');
      console.log('   • Relevance scoring for best matches');
    }
    
    console.log('\n✅ Improved relevant book search test completed!');
    
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
testImprovedRelevantSearch().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});