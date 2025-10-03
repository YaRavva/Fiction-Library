/**
 * Script to test the full download process including:
 * 1. Adding a task to the download queue
 * 2. Processing the task with the download worker
 * 3. Verifying the file is uploaded to Supabase Storage
 * 4. Verifying the book record is created in the database
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

async function testFullDownloadProcess() {
  console.log('🔍 Testing full download process...\n');
  
  try {
    // First, let's check if we have any messages in the files channel
    console.log('Getting files channel messages...');
    
    // We'll need to get a real message ID from the files channel
    // For this test, you'll need to provide a valid message ID
    const testMessageId = process.env.TEST_TELEGRAM_MESSAGE_ID;
    const testChannelId = process.env.TEST_TELEGRAM_CHANNEL_ID || 'files_channel';
    
    if (!testMessageId) {
      console.log('⚠️  TEST_TELEGRAM_MESSAGE_ID not set in .env file');
      console.log('Please set TEST_TELEGRAM_MESSAGE_ID to a valid message ID from your files channel');
      console.log('You can find message IDs by running the test-book-download.ts script');
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
    
    // Wait a moment for the worker to process the task
    console.log('\n⏳ Waiting for worker to process the task...');
    console.log('💡 Make sure the download worker is running (npm run worker)');
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
        console.log(JSON.stringify(bookRecords[0], null, 2));
        
        // Check if file was uploaded to storage
        if (bookRecords[0].storage_path) {
          console.log('\nChecking if file was uploaded to storage...');
          const { data: fileData, error: fileError } = await supabase
            .storage
            .from('books')
            .download(bookRecords[0].storage_path);
          
          if (fileError) {
            console.error('❌ Error downloading file from storage:', fileError);
          } else if (fileData) {
            console.log(`✅ File successfully uploaded to storage (${fileData.size} bytes)`);
          }
        }
      } else {
        console.log('⚠️  No book records found with the specified telegram_file_id');
      }
    } else {
      console.log(`⚠️  Task did not complete successfully. Status: ${updatedTask.status}`);
    }
    
    console.log('\n✅ Full download process test completed');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
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
testFullDownloadProcess().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});