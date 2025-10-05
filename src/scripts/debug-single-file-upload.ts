/**
 * Script to debug the mechanism for uploading a single file to the books bucket
 * and establishing a connection with it in the books table.
 * 
 * Requirements:
 * 1. File types can only be fb2 and zip
 * 2. File name must be in the format <MessageID>.zip
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { TelegramSyncService } from '../lib/telegram/sync';
import { Api } from 'telegram';
import bigInt from 'big-integer';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });

// Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugSingleFileUpload() {
  console.log('🔍 Debugging single file upload mechanism...\n');
  
  let syncService: TelegramSyncService | null = null;
  
  try {
    // Get the Telegram sync service instance
    syncService = await TelegramSyncService.getInstance();
    console.log('✅ Telegram client initialized');
    
    // Use the direct channel ID we found previously as string
    const channelId = '1515159552'; // ID for "Архив для фантастики"
    console.log(`✅ Using files channel ID: ${channelId}`);
    
    if (!syncService['telegramClient']) {
      throw new Error('Telegram client not initialized');
    }
    
    // Get a single message from the channel for testing
    console.log('\n📥 Getting a message from the files channel...');
    const messages = await syncService['telegramClient'].getMessages(channelId, 1) as unknown as { [key: string]: unknown }[];
    
    if (!messages || messages.length === 0) {
      console.log('⚠️  No messages found in the channel');
      return;
    }
    
    const message = messages[0];
    const messageId = message.id as string;
    console.log(`✅ Found message with ID: ${messageId}`);
    
    // Check if the message contains media
    if (!message.media) {
      console.log('⚠️  Message does not contain media');
      return;
    }
    
    console.log('\n📥 Processing file upload...');
    
    // Process the file directly
    const result = await syncService['downloadAndProcessSingleFile'](message);
    
    console.log('\n📊 Upload result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check the uploaded file in storage
    if (result.success && result.filename) {
      const filename = result.filename as string;
      const ext = path.extname(filename);
      const storageKey = `${messageId}${ext}`;
      
      console.log(`\n🔍 Checking file in storage: ${storageKey}`);
      
      try {
        // Try to download the file to verify it exists
        const { data: fileData, error: fileError } = await supabase
          .storage
          .from('books')
          .download(storageKey);
        
        if (fileError) {
          console.error('❌ Error downloading file from storage:', fileError);
        } else if (fileData) {
          console.log(`✅ File successfully uploaded to storage (${fileData.size} bytes)`);
          console.log(`✅ File name in storage: ${storageKey}`);
          
          // Check file extension
          if (ext === '.fb2' || ext === '.zip') {
            console.log(`✅ File extension is valid: ${ext}`);
          } else {
            console.warn(`⚠️  File extension is not valid: ${ext}`);
          }
        }
      } catch (downloadError) {
        console.error('❌ Error downloading file from storage:', downloadError);
      }
      
      // Check the book record in the database
      console.log('\n🔍 Checking book record in database...');
      const { data: bookRecords, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('telegram_file_id', String(messageId));
      
      if (bookError) {
        console.error('❌ Error fetching book records:', bookError);
      } else if (bookRecords && bookRecords.length > 0) {
        const book = bookRecords[0];
        console.log('✅ Found book record in database:');
        console.log(`  ID: ${book.id}`);
        console.log(`  Title: ${book.title}`);
        console.log(`  Author: ${book.author}`);
        console.log(`  File URL: ${book.file_url}`);
        console.log(`  File size: ${book.file_size}`);
        console.log(`  File format: ${book.file_format}`);
        console.log(`  Storage path: ${book.storage_path}`);
        console.log(`  Telegram file ID: ${book.telegram_file_id}`);
        
        // Verify storage path format
        if (book.storage_path === storageKey) {
          console.log('✅ Storage path format is correct');
        } else {
          console.warn(`⚠️  Storage path format is incorrect. Expected: ${storageKey}, Actual: ${book.storage_path}`);
        }
        
        // Verify file format
        const expectedFormat = ext.replace('.', '');
        if (book.file_format === expectedFormat) {
          console.log('✅ File format is correct');
        } else {
          console.warn(`⚠️  File format is incorrect. Expected: ${expectedFormat}, Actual: ${book.file_format}`);
        }
      } else {
        console.log('⚠️  No book records found with the specified telegram_file_id');
      }
    }
    
    console.log('\n✅ Single file upload debug completed');
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
    process.exit(1);
  } finally {
    // Shutdown the Telegram client
    if (syncService) {
      try {
        await syncService.shutdown();
        console.log('🔌 Telegram client disconnected');
      } catch (shutdownError) {
        console.warn('⚠️  Error disconnecting Telegram client:', shutdownError);
      }
    }
  }
}

// Run the script
debugSingleFileUpload().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});