/**
 * Script to download specific books from Telegram and link them to database records
 */

import { config } from 'dotenv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Load environment variables FIRST
config({ path: '.env' });

// Define the book-file mappings we found
const BOOK_FILE_MAPPINGS = [
  {
    bookTitle: "цикл Эвернесс",
    bookAuthor: "Йен Макдональд",
    fileId: 2908,
    filename: "Йен Макдональд - Эвернесс.zip"
  },
  {
    bookTitle: "цикл Индия",
    bookAuthor: "Йен Макдональд",
    fileId: 2909,
    filename: "Йен Макдональд - Индия.zip"
  },
  {
    bookTitle: "цикл Луна",
    bookAuthor: "Йен Макдональд",
    fileId: 2907,
    filename: "Йен Макдональд - Луна.zip"
  },
  {
    bookTitle: "цикл Уголёк в пепле",
    bookAuthor: "Саба Тахир",
    fileId: 2906,
    filename: "Саба Тахир - Уголек в пепле.zip"
  },
  {
    bookTitle: "цикл Линия фронта",
    bookAuthor: "Марко Клоос",
    fileId: 2904,
    filename: "Марко_Клоос_Линия_фронта_Сроки_службы.fb2"
  }
];

// Function to sleep for a specified number of milliseconds
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to handle Telegram flood wait errors
async function handleFloodWait(error: any, defaultWait: number = 30000): Promise<void> {
  if (error.message && error.message.includes('flood wait')) {
    // Extract wait time from error message
    const match = error.message.match(/Sleeping for (\d+)s/);
    if (match && match[1]) {
      const waitSeconds = parseInt(match[1], 10);
      const waitMs = waitSeconds * 1000;
      console.log(`    ⏳ Flood wait detected. Waiting ${waitSeconds} seconds...`);
      await sleep(waitMs + 5000); // Add extra 5 seconds buffer
      return;
    }
  }
  
  // Default wait time
  console.log(`    ⏳ Waiting ${defaultWait/1000} seconds before retry...`);
  await sleep(defaultWait);
}

async function downloadSpecificBooks() {
  // Dynamically import TelegramService after dotenv is loaded
  const { TelegramService } = await import('../lib/telegram/client');
  
  let telegramClient: any = null;
  
  try {
    console.log('🔍 Downloading specific books from Telegram...\n');
    
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
    
    // Access the files channel
    console.log('Accessing files channel...');
    const channel = await telegramClient.getFilesChannel();
    // @ts-ignore
    console.log(`✅ Channel: ${channel.title}\n`);
    
    let downloadCount = 0;
    
    // Process each book-file mapping with longer delays
    for (let i = 0; i < BOOK_FILE_MAPPINGS.length; i++) {
      const mapping = BOOK_FILE_MAPPINGS[i];
      console.log(`Processing (${i+1}/${BOOK_FILE_MAPPINGS.length}): "${mapping.bookTitle}" by ${mapping.bookAuthor}`);
      console.log(`  File: ${mapping.filename} (ID: ${mapping.fileId})`);
      
      try {
        // Find the book in the database
        const { data: books, error: booksError } = await supabase
          .from('books')
          .select('*')
          .eq('title', mapping.bookTitle)
          .eq('author', mapping.bookAuthor);
        
        if (booksError) {
          console.error(`  ❌ Error finding book: ${booksError.message}`);
          continue;
        }
        
        if (!books || books.length === 0) {
          console.log(`  ℹ️  Book not found in database, skipping`);
          continue;
        }
        
        const book = books[0];
        console.log(`  📚 Found book in database: ${book.id}`);
        
        // Check if book already has a file
        if (book.file_url) {
          console.log(`  ℹ️  Book already has a file, skipping`);
          continue;
        }
        
        // Wait before getting message to avoid rate limiting
        console.log(`  ⏳ Waiting 10 seconds before getting message...`);
        await sleep(10000);
        
        // Get the specific message with the file
        console.log(`  🔍 Getting message ${mapping.fileId}...`);
        // @ts-ignore
        const messages = await telegramClient.getMessages(channel, { ids: [mapping.fileId] });
        
        if (!messages || messages.length === 0) {
          console.error(`  ❌ Message not found`);
          continue;
        }
        
        const message = messages[0];
        console.log(`  ✅ Message found`);
        
        // Wait before downloading to avoid rate limiting
        console.log(`  ⏳ Waiting 15 seconds before downloading...`);
        await sleep(15000);
        
        // Download the file with retry logic
        console.log(`  ⬇️  Downloading file...`);
        let buffer: Buffer | null = null;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries && !buffer) {
          try {
            buffer = await telegramClient.downloadMedia(message);
            
            if (!(buffer instanceof Buffer)) {
              throw new Error('Downloaded content is not a Buffer');
            }
          } catch (error: any) {
            retryCount++;
            console.log(`    ⚠️  Download attempt ${retryCount} failed: ${error.message}`);
            
            if (retryCount < maxRetries) {
              // Handle flood wait errors specifically
              await handleFloodWait(error, Math.pow(2, retryCount) * 10000); // 20s, 40s, 80s
            }
          }
        }
        
        if (!buffer) {
          console.error(`  ❌ Failed to download file after ${maxRetries} attempts`);
          continue;
        }
        
        console.log(`  ✅ Downloaded ${buffer.length} bytes`);
        
        // Wait before uploading to avoid rate limiting
        console.log(`  ⏳ Waiting 10 seconds before uploading...`);
        await sleep(10000);
        
        // Upload to Supabase Storage
        const ext = mapping.filename.includes('.') 
          ? mapping.filename.split('.').pop() 
          : 'fb2';
        const key = `books/${book.id}.${ext}`;
        const mime = ext === 'zip' ? 'application/zip' : 'application/octet-stream';
        
        console.log(`  ☁️  Uploading to Supabase Storage...`);
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
        
        // Wait before updating database to avoid rate limiting
        console.log(`  ⏳ Waiting 5 seconds before updating database...`);
        await sleep(5000);
        
        // Update book record
        const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${key}`;
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
          continue;
        }
        
        console.log(`  ✅ Successfully linked book with file`);
        downloadCount++;
        
        // Wait longer between books to avoid rate limiting
        if (i < BOOK_FILE_MAPPINGS.length - 1) {
          console.log(`  ⏳ Waiting 60 seconds before next book...`);
          await sleep(60000);
        }
      } catch (error: any) {
        console.error(`  ❌ Error processing book:`, error.message);
        
        // If it's a flood wait error, wait longer
        if (error.message && error.message.includes('flood wait')) {
          await handleFloodWait(error, 60000);
        }
      }
      
      console.log('');
    }
    
    console.log(`\n✅ Completed. Downloaded and linked ${downloadCount} books.`);
    
  } catch (error) {
    console.error('❌ Error downloading books:', error);
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

// Run the script
downloadSpecificBooks().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});