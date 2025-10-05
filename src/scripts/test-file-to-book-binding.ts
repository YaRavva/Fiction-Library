/**
 * Script to test binding a file from Telegram to a book in the database
 * and check/create series binding if composition is present
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

// Function to find the best match for a book among file titles
function findBestMatch(fileTitle: string, books: any[]): any | null {
  let bestMatch: any | null = null;
  let bestScore = 0;
  
  console.log(`🔍 Looking for matches for file: "${fileTitle}"`);
  
  for (const book of books) {
    // Try to extract title and author from filename
    const bookTitle = book.title || '';
    const bookAuthor = book.author || '';
    
    // Try different matching strategies
    const titleMatch = calculateSimilarity(bookTitle, fileTitle);
    const authorMatch = calculateSimilarity(bookAuthor, fileTitle);
    
    // Combined score (title match is more important)
    const score = titleMatch * 0.8 + authorMatch * 0.2;
    
    if (score > bestScore && score > 0.3) { // Higher threshold for matching
      bestScore = score;
      bestMatch = book;
      console.log(`  📚 Potential match: "${bookTitle}" by ${bookAuthor} (score: ${score.toFixed(2)})`);
    }
  }
  
  // Only return match if score is high enough
  if (bestMatch && bestScore > 0.4) {
    console.log(`  ✅ Best match: "${bestMatch.title}" by ${bestMatch.author} (score: ${bestScore.toFixed(2)})`);
    return bestMatch;
  }
  
  return null;
}

async function testFileToBookBinding() {
  // Dynamically import TelegramService after dotenv is loaded
  const { TelegramService } = await import('../lib/telegram/client');
  const { MetadataParser } = await import('../lib/telegram/parser');
  
  let telegramClient: any = null;
  
  try {
    console.log('🚀 Testing file to book binding...\n');
    
    // Initialize Telegram client
    console.log('Initializing Telegram client...');
    telegramClient = await TelegramService.getInstance();
    console.log('✅ Telegram client initialized');
    
    // Create Supabase client directly with environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Access the files channel
    console.log('Accessing files channel...');
    const filesChannel = await telegramClient.getFilesChannel();
    // @ts-ignore
    console.log(`✅ Files channel: ${filesChannel.title}`);
    
    // Access the metadata channel
    console.log('Accessing metadata channel...');
    const metadataChannel = await telegramClient.getMetadataChannel();
    // @ts-ignore
    console.log(`✅ Metadata channel: ${metadataChannel.title}`);
    
    // Get a few files from the files channel
    console.log('Getting files from files channel...');
    const fileMessages = await telegramClient.getMessages(filesChannel, 5); // Get just a few files for testing
    console.log(`Found ${fileMessages.length} file messages`);
    
    // Extract file information
    const files: any[] = [];
    for (const msg of fileMessages) {
      // @ts-ignore
      if (msg.media && msg.media.className === 'MessageMediaDocument') {
        // @ts-ignore
        const document = msg.media.document;
        if (document) {
          // @ts-ignore
          const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
          files.push({
            // @ts-ignore
            id: msg.id,
            filename: filenameAttr?.fileName || `book_${msg.id}`,
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
    
    console.log(`Found ${files.length} files with documents`);
    
    if (files.length === 0) {
      console.log('❌ No files found in the channel');
      return;
    }
    
    // Take the first file for testing
    const testFile = files[0];
    console.log(`\n🧪 Testing with file: ${testFile.filename} (ID: ${testFile.id})`);
    
    // Fetch all books from database for matching
    console.log('Fetching books from database...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id, title, author, telegram_post_id, series_id')
      .limit(100); // Limit for performance
    
    if (booksError) {
      throw new Error(`Error fetching books: ${booksError.message}`);
    }
    
    console.log(`Found ${books?.length || 0} books in database`);
    
    // Try to find matching book
    const matchedBook = findBestMatch(testFile.filename, books || []);
    
    if (!matchedBook) {
      console.log('❌ No matching book found for this file');
      return;
    }
    
    console.log(`\n📚 Matched book: "${matchedBook.title}" by ${matchedBook.author}`);
    console.log(`  Book ID: ${matchedBook.id}`);
    console.log(`  Telegram Post ID: ${matchedBook.telegram_post_id}`);
    console.log(`  Series ID: ${matchedBook.series_id || 'Not bound'}`);
    
    // If book has telegram_post_id, check for series composition
    if (matchedBook.telegram_post_id) {
      console.log(`\n🔍 Checking for series composition in Telegram message...`);
      
      // Get the metadata message
      const messageId = parseInt(matchedBook.telegram_post_id);
      const targetMessageId = messageId + 1; // Add offset
      
      console.log(`📥 Getting metadata message with offsetId: ${targetMessageId}...`);
      const metadataMessages = await telegramClient.getMessages(metadataChannel, 5, targetMessageId) as unknown as { id?: number; text?: string }[];
      
      if (!metadataMessages || metadataMessages.length === 0) {
        console.log('❌ No metadata messages found');
        return;
      }
      
      console.log(`✅ Found ${metadataMessages.length} metadata messages`);
      
      // Find the exact message
      const targetMessage = metadataMessages.find(msg => msg.id === messageId);
      if (!targetMessage) {
        console.log(`ℹ️  Exact message with ID ${messageId} not found in results`);
        return;
      }
      
      console.log(`✅ Found target message: ${targetMessage.id}`);
      
      if (!targetMessage.text) {
        console.log('❌ Message contains no text');
        return;
      }
      
      // Parse the message
      const metadata = MetadataParser.parseMessage(targetMessage.text);
      
      console.log(`📝 Parsed metadata:`);
      console.log(`  Title: ${metadata.title}`);
      console.log(`  Author: ${metadata.author}`);
      console.log(`  Series: ${metadata.series || 'None'}`);
      console.log(`  Books in composition: ${metadata.books?.length || 0}`);
      
      // Check if there's a composition
      if (metadata.books && metadata.books.length > 0) {
        console.log(`\n📚 Found composition with ${metadata.books.length} books:`);
        metadata.books.forEach((book, index) => {
          console.log(`  ${index + 1}. ${book.title} (${book.year})`);
        });
        
        // Check if book is already bound to a series
        if (matchedBook.series_id) {
          console.log(`\nℹ️  Book is already bound to series ${matchedBook.series_id}`);
          
          // Get series info
          const { data: series, error: seriesError } = await supabase
            .from('series')
            .select('series_composition')
            .eq('id', matchedBook.series_id)
            .single();
          
          if (seriesError) {
            console.error('❌ Error fetching series info:', seriesError);
            return;
          }
          
          // Compare compositions
          const currentComposition = series.series_composition || [];
          console.log(`📊 Current series composition: ${currentComposition.length} books`);
          
          // Check if compositions match
          let compositionsMatch = true;
          if (currentComposition.length !== metadata.books.length) {
            compositionsMatch = false;
          } else {
            for (let j = 0; j < metadata.books.length; j++) {
              const bookFromMessage = metadata.books[j];
              const bookFromSeries = currentComposition[j];
              if (bookFromMessage.title !== bookFromSeries.title || bookFromMessage.year !== bookFromSeries.year) {
                compositionsMatch = false;
                break;
              }
            }
          }
          
          if (!compositionsMatch) {
            console.log('⚠️  Compositions do not match, would update series');
          } else {
            console.log('✅ Compositions match, no update needed');
          }
        } else {
          console.log(`\n➕ Book is not bound to any series, would create new series`);
          console.log(`  Series title: ${metadata.series || metadata.title || matchedBook.title}`);
          console.log(`  Author: ${matchedBook.author}`);
          console.log(`  Would bind book to new series`);
        }
      } else {
        console.log(`\nℹ️  No composition found in message`);
        
        // Check if message contains "Состав:"
        if (targetMessage.text.includes('Состав:')) {
          console.log('✅ Message contains "Состав:" but parser did not extract books');
          console.log('📝 Message text (first 500 chars):');
          console.log(targetMessage.text.substring(0, 500) + (targetMessage.text.length > 500 ? '...' : ''));
        }
      }
    } else {
      console.log(`\nℹ️  Book has no telegram_post_id, cannot check for composition`);
    }
    
    console.log(`\n✅ File to book binding test completed!`);
    
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
testFileToBookBinding().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});