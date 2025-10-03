/**
 * Script to test uploading a single file to the books bucket
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { DownloadQueue } from '../lib/telegram/queue';

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

async function testSingleFileUpload() {
  console.log('🔍 Testing single file upload...\n');
  
  try {
    // You'll need to provide a valid message ID from your files channel
    // Run the test-book-download.ts script to find message IDs
    const testMessageId = process.env.TEST_TELEGRAM_MESSAGE_ID;
    const testChannelId = process.env.TELEGRAM_FILES_CHANNEL_HASH || 'files_channel';
    
    if (!testMessageId) {
      console.log('⚠️  TEST_TELEGRAM_MESSAGE_ID not set in environment');
      console.log('Please set TEST_TELEGRAM_MESSAGE_ID to a valid message ID from your files channel');
      console.log('You can find message IDs by running: pnpm test:download');
      return;
    }
    
    console.log(`Using message ID: ${testMessageId}`);
    console.log(`Using channel ID: ${testChannelId}`);
    
    // Add task to download queue
    console.log('\nAdding task to download queue...');
    const queue = new DownloadQueue();
    const task = await queue.addTask({
      message_id: testMessageId,
      channel_id: testChannelId,
      priority: 10, // High priority for testing
    });
    
    if (!task) {
      console.error('❌ Failed to add task to queue');
      return;
    }
    
    console.log(`✅ Task added to queue with ID: ${task.id}`);
    console.log(`Task details:`, task);
    
    console.log('\n💡 Now make sure the download worker is running:');
    console.log('   Run in another terminal: pnpm worker');
    
    console.log('\n⏳ Waiting for worker to process the task...');
    console.log('⏳ Waiting for 30 seconds...');
    
    // Wait for 30 seconds to allow the worker to process the task
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Check the task status
    console.log('\nChecking task status...');
    const { data: updatedTask, error: taskError } = await supabase
      .from('telegram_download_queue')
      .select('*')
      .eq('id', task.id)
      .single();
    
    if (taskError) {
      console.error('❌ Error fetching task status:', taskError);
      return;
    }
    
    console.log(`Task status: ${updatedTask.status}`);
    if (updatedTask.error_message) {
      console.log(`Error message: ${updatedTask.error_message}`);
    }
    
    // If task completed successfully, check the book record
    if (updatedTask.status === 'completed') {
      console.log('\n✅ Task completed successfully!');
      
      // Check if book record was created
      console.log('Checking for book record...');
      const { data: bookRecords, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('telegram_file_id', testMessageId);
      
      if (bookError) {
        console.error('❌ Error fetching book records:', bookError);
        return;
      }
      
      if (bookRecords && bookRecords.length > 0) {
        console.log(`✅ Found ${bookRecords.length} book record(s) created`);
        console.log('Book record details:');
        console.log(`  Title: ${bookRecords[0].title}`);
        console.log(`  File URL: ${bookRecords[0].file_url}`);
        console.log(`  File size: ${bookRecords[0].file_size}`);
        console.log(`  File format: ${bookRecords[0].file_format}`);
        console.log(`  Storage path: ${bookRecords[0].storage_path}`);
        
        // Check if file was uploaded to storage
        if (bookRecords[0].storage_path) {
          console.log('\nChecking if file was uploaded to storage...');
          try {
            const { data: fileData, error: fileError } = await supabase
              .storage
              .from('books')
              .download(bookRecords[0].storage_path);
            
            if (fileError) {
              console.error('❌ Error downloading file from storage:', fileError);
            } else if (fileData) {
              console.log(`✅ File successfully uploaded to storage (${fileData.size} bytes)`);
              console.log(`✅ File name in storage: ${bookRecords[0].storage_path}`);
            }
          } catch (downloadError) {
            console.error('❌ Error downloading file from storage:', downloadError);
          }
        }
      } else {
        console.log('⚠️  No book records found with the specified telegram_file_id');
      }
    } else {
      console.log(`\nTask status: ${updatedTask.status}`);
    }
    
    console.log('\n✅ Single file upload test completed');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

// Run the script
testSingleFileUpload().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});