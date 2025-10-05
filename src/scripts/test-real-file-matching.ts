/**
 * Real test script to match actual files from Telegram files channel with books in database
 * This script uses the actual Telegram connection and files from the private channel
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
    }
  }
  
  if (bestMatch && bestScore > 0.4) {
    return { book: bestMatch, score: bestScore };
  }
  
  return null;
}

async function testRealFileMatching() {
  // Dynamically import TelegramService after dotenv is loaded
  const { TelegramService } = await import('../lib/telegram/client');
  
  let telegramClient: any = null;
  
  try {
    console.log('🚀 Testing real file matching from Telegram files channel...\n');
    
    // Initialize Telegram client using session from .env
    console.log('🔐 Initializing Telegram client with session from .env...');
    telegramClient = await TelegramService.getInstance();
    console.log('✅ Telegram client initialized');
    
    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Access the files channel (Архив для фантастики)
    console.log('\n📂 Accessing Telegram files channel "Архив для фантастики"...');
    const filesChannel = await telegramClient.getFilesChannel();
    // @ts-ignore
    console.log(`✅ Connected to channel: ${filesChannel.title}`);
    
    // Get recent files from the channel
    console.log('📥 Getting recent files from channel...');
    const fileMessages = await telegramClient.getMessages(filesChannel, 15); // Get recent files
    console.log(`📊 Found ${fileMessages.length} messages in channel`);
    
    // Extract actual file information
    const files: any[] = [];
    for (const msg of fileMessages) {
      // @ts-ignore
      if (msg.media && msg.media.className === 'MessageMediaDocument') {
        // @ts-ignore
        const document = msg.media.document;
        if (document) {
          // @ts-ignore
          const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
          const filename = filenameAttr?.fileName || `book_${msg.id}`;
          
          files.push({
            // @ts-ignore
            id: msg.id,
            filename: filename,
            // @ts-ignore
            mimeType: document.mimeType,
            // @ts-ignore
            size: document.size,
            // @ts-ignore
            message: msg
          });
        }
      }
    }
    
    console.log(`📁 Found ${files.length} actual files with documents`);
    
    if (files.length === 0) {
      console.log('❌ No files found in the channel');
      return;
    }
    
    // Sort files by filename
    files.sort((a, b) => a.filename.localeCompare(b.filename));
    
    // Display first 10 files
    console.log('\n📚 First 10 files from Telegram channel:');
    files.slice(0, 10).forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.filename} (${file.size} bytes)`);
    });
    
    // Fetch books from database
    console.log('\n📖 Fetching books from database...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, file_url, telegram_file_id')
      .limit(100); // Get enough books for matching
    
    if (booksError) {
      throw new Error(`Error fetching books: ${booksError.message}`);
    }
    
    console.log(`✅ Retrieved ${books?.length || 0} books from database`);
    
    // Test matching for first 5 files
    console.log('\n🔍 Testing file-to-book matching for first 5 files...\n');
    
    let matchCount = 0;
    let filesWithAttachments = 0;
    
    for (const file of files.slice(0, 5)) {
      console.log(`📁 Processing file: ${file.filename}`);
      
      // Find matching book
      const match = findBestMatch(file.filename, books || []);
      
      if (match) {
        console.log(`  ✅ Match found: "${match.book.title}" by ${match.book.author}`);
        console.log(`     Match confidence: ${(match.score * 100).toFixed(1)}%`);
        
        // Check if book already has a file attached
        const hasFile = match.book.file_url && match.book.file_url.length > 0;
        if (hasFile) {
          console.log(`     📎 Book already has file attached`);
          filesWithAttachments++;
        } else {
          console.log(`     📭 Book needs file attachment`);
        }
        
        matchCount++;
      } else {
        console.log(`  ❌ No match found for this file`);
      }
      
      console.log(''); // Empty line for readability
    }
    
    console.log('📊 SUMMARY:');
    console.log(`   Files processed: 5`);
    console.log(`   Files with matches: ${matchCount}`);
    console.log(`   Files with existing attachments: ${filesWithAttachments}`);
    console.log(`   Files needing attachment: ${matchCount - filesWithAttachments}`);
    
    console.log('\n✅ Real file matching test completed!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    // Ensure proper cleanup
    if (telegramClient) {
      try {
        // @ts-ignore
        await telegramClient.disconnect();
        console.log('\n🧹 Telegram client disconnected');
      } catch (error) {
        console.error('⚠️ Error during shutdown:', error);
      }
    }
    
    // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run the script
testRealFileMatching().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});