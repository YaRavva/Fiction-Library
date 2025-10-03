/**
 * Script to add a test task to the download queue
 */

import { config } from 'dotenv';
import path from 'path';
import { DownloadQueue } from '../lib/telegram/queue';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });

async function addTestTask() {
  console.log('🔍 Adding test task to download queue...\n');
  
  try {
    // You'll need to provide a valid message ID from your files channel
    // Run the test-book-download.ts script to find message IDs
    const testMessageId = process.env.TEST_TELEGRAM_MESSAGE_ID;
    const testChannelId = process.env.TELEGRAM_FILES_CHANNEL_HASH || 'files_channel';
    
    if (!testMessageId) {
      console.log('⚠️  TEST_TELEGRAM_MESSAGE_ID not set in environment');
      console.log('Please set TEST_TELEGRAM_MESSAGE_ID to a valid message ID from your files channel');
      console.log('You can find message IDs by running: npx tsx src/scripts/test-book-download.ts');
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
    console.log('   Run in another terminal: npm run worker');
    
    console.log('\n✅ Test task added successfully');
    
  } catch (error) {
    console.error('❌ Error adding test task:', error);
    process.exit(1);
  }
}

// Run the script
addTestTask().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});