/**
 * Script to match books in the database with files from Telegram and link them
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

// Function to find matching files for a book (same algorithm as in the component)
function findMatchingFiles(bookTitle: string, bookAuthor: string, files: any[]): any[] {
  // Normalize strings in NFC form for correct comparison
  const normalizeString = (str: string) => str.normalize('NFC').toLowerCase();

  const bookTitleNormalized = normalizeString(bookTitle);
  const bookAuthorNormalized = normalizeString(bookAuthor);

  console.log(`🔍 Поиск файлов для книги: "${bookTitle}" автора: "${bookAuthor}"`);
  console.log(`📝 Нормализованное название: "${bookTitleNormalized}"`);
  console.log(`👤 Нормализованный автор: "${bookAuthorNormalized}"`);

  const matchingFiles = files
    .map(file => {
      const filename = normalizeString(file.filename || file.file_name || '');

      // Check for minimum one word match
      const titleWords = bookTitleNormalized.split(/\s+/).filter(word => word.length > 2);
      const authorWords = bookAuthorNormalized.split(/\s+/).filter(word => word.length > 2);

      let hasTitleMatch = false;
      let hasAuthorMatch = false;
      const matchedTitleWords: string[] = [];
      const matchedAuthorWords: string[] = [];

      for (const word of titleWords) {
        if (filename.includes(word)) {
          hasTitleMatch = true;
          matchedTitleWords.push(word);
          break; // Enough one match
        }
      }

      for (const word of authorWords) {
        if (filename.includes(word)) {
          hasAuthorMatch = true;
          matchedAuthorWords.push(word);
          break; // Enough one match
        }
      }

      // Only files with minimum one match
      if (!hasTitleMatch && !hasAuthorMatch) {
        return null;
      }

      return { ...file, relevance_score: 10 };
    })
    .filter((file): file is any => file !== null)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 20); // Limit to 20 best matches

  console.log(`📊 Всего найдено подходящих файлов: ${matchingFiles.length}`);

  return matchingFiles;
}

// Function to find the best match for a book among file titles (legacy function for compatibility)
function findBestMatch(bookTitle: string, bookAuthor: string, files: any[]): any | null {
  const matchingFiles = findMatchingFiles(bookTitle, bookAuthor, files);
  return matchingFiles.length > 0 ? matchingFiles[0] : null;
}

async function matchBooksWithFiles() {
  // Dynamically import TelegramService after dotenv is loaded
  const { TelegramService } = await import('../lib/telegram/client');
  
  let telegramClient: any = null;
  
  try {
    console.log('🔍 Matching books with files...\n');
    
    // Initialize Telegram client
    console.log('Initializing Telegram client...');
    telegramClient = await TelegramService.getInstance();
    console.log('✅ Telegram client initialized');
    
    // Create Supabase client directly with environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Fetch books without file_url
    console.log('Fetching books without files...');
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('*')
      .is('file_url', null);
    
    if (booksError) {
      throw new Error(`Error fetching books: ${booksError.message}`);
    }
    
    console.log(`Found ${books?.length || 0} books without files`);
    
    // Access the files channel
    console.log('Accessing files channel...');
    const channel = await telegramClient.getFilesChannel();
    // @ts-ignore
    console.log(`✅ Channel: ${channel.title}`);
    
    // Get messages (files) from the channel using new method with pagination
    console.log('Getting files from channel...');
    const channelId = typeof channel.id === 'object' && channel.id !== null ?
      (channel.id as { toString: () => string }).toString() :
      String(channel.id);
    const messages = await telegramClient.getAllMessages(channelId, 1000); // Get files by 1000 with 1 second pause
    console.log(`Found ${messages.length} messages`);
    
    // Extract file information (same format as API endpoint)
    const files: any[] = [];
    for (const msg of messages) {
      // @ts-ignore
      if (msg.media && (msg.media.document || msg.media.photo)) {
        // @ts-ignore
        const media = msg.media.document || msg.media.photo;
        if (media) {
          // @ts-ignore
          const rawFileName = media.fileName || media.filename || `file_${msg.id}`;

          // Normalize filename in NFC form for consistency
          const normalizedFileName = rawFileName.normalize('NFC');

          files.push({
            message_id: msg.id,
            file_name: normalizedFileName,
            file_size: media.size || 0,
            mime_type: media.mimeType || media.mime_type,
            caption: msg.message || '',
            date: msg.date || Date.now() / 1000,
            // Keep original message for downloading
            message: msg
          });
        }
      }
    }
    
    console.log(`Found ${files.length} files with documents`);
    
    // Match books with files
    let matchCount = 0;
    // @ts-ignore
    for (const book of books || []) {
      // @ts-ignore
      console.log(`\nChecking book: "${book.title}" by ${book.author}`);
      
      // @ts-ignore
      const matchingFiles = findMatchingFiles(book.title, book.author, files);

      if (matchingFiles.length > 0) {
        const bestMatch = matchingFiles[0];
        console.log(`  📎 Found match: ${bestMatch.file_name}`);

        // Download the file
        console.log('  ⬇️  Downloading file...');
        const buffer = await telegramClient.downloadMedia(bestMatch.message);

        if (buffer instanceof Buffer) {
          // Upload to Supabase Storage
          const ext = bestMatch.file_name.includes('.')
            ? bestMatch.file_name.split('.').pop()
            : 'fb2';
          // @ts-ignore
          const key = `books/${book.id}.${ext}`;
          const mime = bestMatch.mime_type || 'application/octet-stream';

          console.log('  ☁️  Uploading to Supabase Storage...');
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('books')
            .upload(key, buffer, {
              contentType: mime,
              upsert: true
            });

          if (uploadError) {
            console.error(`  ❌ Error uploading file: ${uploadError.message}`);
            continue;
          }

          // Update book record
          const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${key}`;
          console.log('  📝 Updating book record...');

          // @ts-ignore
          const { data: updatedBook, error: updateError } = await supabase
            .from('books')
            // @ts-ignore
            .update({
              file_url: fileUrl,
              file_size: buffer.length,
              file_format: ext,
              telegram_file_id: String(bestMatch.message_id)
            })
            // @ts-ignore
            .eq('id', book.id)
            .select()
            .single();

          if (updateError) {
            console.error(`  ❌ Error updating book: ${updateError.message}`);
            continue;
          }

          console.log(`  ✅ Successfully linked book with file`);
          matchCount++;
        } else {
          console.log('  ❌ Failed to download file');
        }
      } else {
        console.log('  ❌ No matching file found');
      }
    }
    
    console.log(`\n✅ Matching completed. Linked ${matchCount} books with files.`);
    
  } catch (error) {
    console.error('❌ Error during matching:', error);
    process.exit(1);
  } finally {
    // Ensure proper cleanup
    if (telegramClient) {
      try {
        // @ts-ignore
        await telegramClient.disconnect();
        console.log('🧹 Telegram client disconnected');
      } catch (error) {
        console.error('⚠️ Error during shutdown:', error);
      }
    }
    process.exit(0);
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
matchBooksWithFiles().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});