/**
 * Improved test script for file matching with enhanced logic
 * This script demonstrates better file-to-book matching algorithms
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Load environment variables FIRST
config({ path: '.env' });

// Function to normalize text for comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\sа-яё]/gi, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

// Function to extract author and title from filename
function extractAuthorAndTitle(filename: string): { author: string; title: string } {
  // Remove file extension
  const cleanFilename = filename.replace(/\.[^/.]+$/, '');
  
  // Try to split by " - " pattern (author - title)
  const parts = cleanFilename.split(' - ');
  if (parts.length >= 2) {
    return {
      author: parts[0].trim(),
      title: parts.slice(1).join(' - ').trim() // In case title contains " - "
    };
  }
  
  // If no " - " pattern, return as is
  return {
    author: '',
    title: cleanFilename
  };
}

// Function to calculate similarity between two strings
function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeText(str1);
  const normalized2 = normalizeText(str2);
  
  // Exact match
  if (normalized1 === normalized2) return 1;
  
  // One contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return 0.9;
  
  // Split into words and check for significant overlap
  const words1 = normalized1.split(' ').filter(word => word.length > 2); // Filter short words
  const words2 = normalized2.split(' ').filter(word => word.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  let matchCount = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      // Better matching: longer words need to match more completely
      const minLength = Math.min(word1.length, word2.length);
      if (minLength >= 4) {
        // For longer words, require more similarity
        if (word1 === word2 || 
            (word1.includes(word2) && word2.length >= Math.floor(word1.length * 0.7)) ||
            (word2.includes(word1) && word1.length >= Math.floor(word2.length * 0.7))) {
          matchCount++;
          break;
        }
      } else if (word1 === word2) {
        // For shorter words, require exact match
        matchCount++;
        break;
      }
    }
  }
  
  // Return a score based on matching words, but require a minimum threshold
  const maxWords = Math.max(words1.length, words2.length);
  const score = maxWords > 0 ? matchCount / maxWords : 0;
  
  // Require at least 50% of significant words to match for a good match
  return score >= 0.5 ? score : 0;
}

// Enhanced matching function that considers both author and title
function findBestMatch(filename: string, books: any[]): { book: any; score: number } | null {
  console.log(`  🔍 Looking for matches for file: "${filename}"`);
  
  const extracted = extractAuthorAndTitle(filename);
  let bestMatch: any | null = null;
  let bestScore = 0;
  
  for (const book of books) {
    const bookTitle = book.title || '';
    const bookAuthor = book.author || '';
    
    // Calculate author similarity
    let authorScore = 0;
    if (extracted.author) {
      authorScore = calculateSimilarity(bookAuthor, extracted.author);
    } else {
      // If no author in filename, check if author appears in filename
      authorScore = calculateSimilarity(bookAuthor, filename);
    }
    
    // Calculate title similarity
    const titleScore = calculateSimilarity(bookTitle, extracted.title);
    
    // Combined score (both author and title match are important)
    const score = authorScore * 0.5 + titleScore * 0.5;
    
    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = book;
      console.log(`    📚 Potential match: "${bookTitle}" by ${bookAuthor} (score: ${score.toFixed(2)})`);
    }
  }
  
  if (bestMatch && bestScore > 0.4) {
    console.log(`    ✅ Best match: "${bestMatch.title}" by ${bestMatch.author} (score: ${bestScore.toFixed(2)})`);
    return { book: bestMatch, score: bestScore };
  }
  
  return null;
}

async function testImprovedFileMatching() {
  console.log('🚀 Testing improved file matching process...\n');
  
  // Create Supabase client directly with environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
  
  // Simulated files from Telegram channel
  const simulatedFiles = [
    { id: 1001, filename: "Владимир Савченко - Вселяне.fb2", size: 1234567 },
    { id: 1002, filename: "Йен Макдональд - Индия.zip", size: 2345678 },
    { id: 1003, filename: "Елизавета Дворецкая - Корабль во фьорде.epub", size: 3456789 },
    { id: 1004, filename: "Андрей Валерьев - Форпост.rar", size: 4567890 },
    { id: 1005, filename: "Марко Клоос - Линия фронта.pdf", size: 5678901 },
    { id: 1006, filename: "Саба Тахир - Уголёк в пепле.mobi", size: 5678901 },
    { id: 1007, filename: "Маркус Сэйки - Одаренные.epub", size: 5678901 }
  ];
  
  console.log('📚 Simulated files from Telegram channel:');
  simulatedFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file.filename} (${file.size} bytes)`);
  });
  
  // Fetch a sample of books from database for matching
  console.log('\n📖 Fetching sample books from database...');
  const { data: books, error: booksError } = await supabase
    .from('books')
    .select('id, title, author')
    .limit(50); // Get more books for better matching
  
  if (booksError) {
    throw new Error(`Error fetching books: ${booksError.message}`);
  }
  
  console.log(`Found ${books?.length || 0} books in database`);
  
  // Test matching for each file
  console.log('\n🔍 Testing improved file-to-book matching...\n');
  
  let matchCount = 0;
  
  for (const file of simulatedFiles) {
    console.log(`📁 Testing file: ${file.filename}`);
    
    const match = findBestMatch(file.filename, books || []);
    
    if (match) {
      console.log(`  ✅ Match found: "${match.book.title}" by ${match.book.author} (score: ${match.score.toFixed(2)})`);
      matchCount++;
    } else {
      console.log(`  ❌ No good match found`);
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log(`✅ File matching test completed! Found ${matchCount} matches out of ${simulatedFiles.length} files.`);
  
  // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

// Run the script
testImprovedFileMatching().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});