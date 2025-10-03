/**
 * Script to check the status of a task in the download queue
 */

import { config } from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

async function checkTaskStatus() {
  console.log('🔍 Checking task status in download queue...\n');
  
  try {
    // Get task ID from command line arguments or environment
    const taskId = process.argv[2] || process.env.TEST_TASK_ID;
    
    if (!taskId) {
      console.log('⚠️  Please provide a task ID as a command line argument or set TEST_TASK_ID in environment');
      console.log('Usage: npx tsx src/scripts/check-task-status.ts <task_id>');
      return;
    }
    
    console.log(`Checking status for task ID: ${taskId}`);
    
    // Check the task status
    console.log('\nFetching task status...');
    const { data: task, error: taskError } = await supabase
      .from('telegram_download_queue')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (taskError) {
      console.error('❌ Error fetching task status:', taskError);
      return;
    }
    
    if (!task) {
      console.log('⚠️  Task not found');
      return;
    }
    
    console.log(`Task status: ${task.status}`);
    console.log(`Message ID: ${task.message_id}`);
    console.log(`Channel ID: ${task.channel_id}`);
    console.log(`Created at: ${task.created_at}`);
    console.log(`Updated at: ${task.updated_at}`);
    
    if (task.error_message) {
      console.log(`Error message: ${task.error_message}`);
    }
    
    if (task.storage_path) {
      console.log(`Storage path: ${task.storage_path}`);
    }
    
    // If task completed successfully, check the book record
    if (task.status === 'completed') {
      console.log('\n✅ Task completed successfully!');
      
      // Check if book record was created
      console.log('Checking for book record...');
      const { data: bookRecords, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('telegram_file_id', task.message_id);
      
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
            }
          } catch (downloadError) {
            console.error('❌ Error downloading file from storage:', downloadError);
          }
        }
      } else {
        console.log('⚠️  No book records found with the specified telegram_file_id');
      }
    } else {
      console.log(`\nTask status: ${task.status}`);
    }
    
    console.log('\n✅ Task status check completed');
    
  } catch (error) {
    console.error('❌ Error checking task status:', error);
    process.exit(1);
  }
}

// Run the script
checkTaskStatus().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});