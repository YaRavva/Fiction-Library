/**
 * Script to directly download a file from Telegram using message ID
 * Usage: npx tsx src/scripts/direct-download.ts "book title" "author" messageId
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Load environment variables FIRST
config({ path: '.env' });

// Define the book-file mappings we found
const BOOK_FILE_MAPPINGS: Record<string, any> = {
  "цикл Эвернесс_Йен Макдональд": {
    bookTitle: "цикл Эвернесс",
    bookAuthor: "Йен Макдональд",
    fileId: 2908,
    filename: "Йен Макдональд - Эвернесс.zip"
  },
  "цикл Индия_Йен Макдональд": {
    bookTitle: "цикл Индия",
    bookAuthor: "Йен Макдональд",
    fileId: 2909,
    filename: "Йен Макдональд - Индия.zip"
  },
  "цикл Луна_Йен Макдональд": {
    bookTitle: "цикл Луна",
    bookAuthor: "Йен Макдональд",
    fileId: 2907,
    filename: "Йен Макдональд - Луна.zip"
  },
  "цикл Уголёк в пепле_Саба Тахир": {
    bookTitle: "цикл Уголёк в пепле",
    bookAuthor: "Саба Тахир",
    fileId: 2906,
    filename: "Саба Тахир - Уголек в пепле.zip"
  },
  "цикл Линия фронта_Марко Клоос": {
    bookTitle: "цикл Линия фронта",
    bookAuthor: "Марко Клоос",
    fileId: 2904,
    filename: "Марко_Клоос_Линия_фронта_Сроки_службы.fb2"
  }
};

// Function to sleep for a specified number of milliseconds
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function directDownload(bookTitle: string, bookAuthor: string) {
  // Dynamically import TelegramService after dotenv is loaded
  const { TelegramService } = await import('../lib/telegram/client');
  
  let telegramClient: any = null;
  
  try {
    // Create a key to look up the mapping
    const bookKey = `${bookTitle}_${bookAuthor}`;
    const mapping = BOOK_FILE_MAPPINGS[bookKey];
    
    if (!mapping) {
      console.error(`❌ Book mapping not found for "${bookTitle}" by ${bookAuthor}`);
      process.exit(1);
    }
    
    console.log(`🔍 Direct download of "${mapping.bookTitle}" by ${mapping.bookAuthor}...\n`);
    
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
    
    // Find the book in the database
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('*')
      .eq('title', mapping.bookTitle)
      .eq('author', mapping.bookAuthor);
    
    if (booksError) {
      console.error(`  ❌ Error finding book: ${booksError.message}`);
      process.exit(1);
    }
    
    if (!books || books.length === 0) {
      console.log(`  ℹ️  Book not found in database`);
      process.exit(1);
    }
    
    const book = books[0];
    console.log(`  📚 Found book in database: ${book.id}`);
    
    // Check if book already has a file
    if (book.file_url) {
      console.log(`  ℹ️  Book already has a file:`);
      console.log(`      URL: ${book.file_url}`);
      console.log(`      Size: ${book.file_size} bytes`);
      console.log(`      Format: ${book.file_format}`);
      process.exit(0);
    }
    
    // Try to get the channel entity directly
    console.log('Accessing files channel directly...');
    const channel = await telegramClient.getFilesChannel();
    // @ts-ignore
    console.log(`✅ Channel: ${channel.title}`);
    
    // Wait a bit to avoid immediate rate limiting
    console.log('⏳ Waiting 30 seconds before download...');
    await sleep(30000);
    
    // Try to get the message directly using the message ID
    console.log(`🔍 Getting message ${mapping.fileId} directly...`);
    
    try {
      // @ts-ignore
      const messages = await telegramClient.getMessages(channel, { ids: [mapping.fileId] });
      
      if (!messages || messages.length === 0) {
        console.error(`  ❌ Message ${mapping.fileId} not found`);
        process.exit(1);
      }
      
      const message = messages[0];
      console.log(`  ✅ Message found`);
      
      // Wait before downloading
      console.log('⏳ Waiting 30 seconds before download...');
      await sleep(30000);
      
      // Download the file
      console.log(`  ⬇️  Downloading file...`);
      const buffer = await telegramClient.downloadMedia(message);
      
      if (!(buffer instanceof Buffer)) {
        console.error(`  ❌ Failed to download file`);
        process.exit(1);
      }
      
      console.log(`  ✅ Downloaded ${buffer.length} bytes`);
      
      // Wait before uploading
      console.log('⏳ Waiting 15 seconds before upload...');
      await sleep(15000);
      
      // Upload to Supabase Storage
      const ext = mapping.filename.includes('.') 
        ? mapping.filename.split('.').pop() 
        : 'fb2';
      const storageKey = `books/${book.id}.${ext}`;
      const mime = ext === 'zip' ? 'application/zip' : 'application/octet-stream';
      
      console.log(`  ☁️  Uploading to Supabase Storage...`);
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('books')
        .upload(storageKey, buffer, {
          contentType: mime,
          upsert: true
        });
      
      if (uploadError) {
        console.error(`  ❌ Error uploading file: ${uploadError.message}`);
        process.exit(1);
      }
      
      // Wait before updating database
      console.log('⏳ Waiting 10 seconds before database update...');
      await sleep(10000);
      
      // Update book record
      const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${storageKey}`;
      console.log(`  📝 Updating book record...`);
      
      const { data: updatedBook, error: updateError } = await supabase
        .from('books')
        .update({
          file_url: fileUrl,
          file_size: buffer.length,
          file_format: ext,
          telegram_file_id: String(mapping.fileId)
        })
        .eq('id', book.id)
        .select()
        .single();
      
      if (updateError) {
        console.error(`  ❌ Error updating book: ${updateError.message}`);
        process.exit(1);
      }
      
      console.log(`  ✅ Successfully linked book with file`);
      console.log(`      URL: ${fileUrl}`);
      console.log(`      Size: ${buffer.length} bytes`);
      console.log(`      Format: ${ext}`);
      
      console.log(`\n✅ Completed. Downloaded and linked "${mapping.bookTitle}" by ${mapping.bookAuthor}.`);
    } catch (error: any) {
      console.error(`  ❌ Error getting/downloading message:`, error.message);
      
      // If it's a flood wait error, extract the wait time and wait
      if (error.message && error.message.includes('flood wait')) {
        const match = error.message.match(/Sleeping for (\d+)s/);
        if (match && match[1]) {
          const waitSeconds = parseInt(match[1], 10);
          console.log(`    ⏳ Flood wait detected. Waiting ${waitSeconds + 10} seconds...`);
          await sleep((waitSeconds + 10) * 1000);
        }
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error downloading book:', error);
    process.exit(1);
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

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: npx tsx src/scripts/direct-download.ts "book title" "author"');
  console.log('Example: npx tsx src/scripts/direct-download.ts "цикл Эвернесс" "Йен Макдональд"');
  process.exit(1);
}

const bookTitle = args[0];
const bookAuthor = args[1];

// Run the script
directDownload(bookTitle, bookAuthor).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});