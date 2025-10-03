/**
 * Script to test accessing the Telegram files channel
 */

import { config } from 'dotenv';
import { TelegramService } from '../lib/telegram/client';

// Load environment variables
config({ path: '.env' });

async function testChannelAccess() {
  let telegramClient: TelegramService | null = null;
  
  try {
    console.log('🔍 Testing Telegram channel access...\n');
    
    // Initialize Telegram client
    console.log('Initializing Telegram client...');
    telegramClient = await TelegramService.getInstance();
    console.log('✅ Telegram client initialized');
    
    // Try to access the files channel
    console.log('Attempting to access files channel...');
    const channel = await telegramClient.getFilesChannel();
    
    // @ts-ignore
    console.log(`✅ Successfully accessed channel: ${channel.title} (ID: ${channel.id})`);
    
    // Try to get some messages
    console.log('Getting messages from channel...');
    const messages = await telegramClient.getMessages(channel, 3);
    console.log(`✅ Found ${messages.length} messages`);
    
    // Show details of first message
    if (messages.length > 0) {
      // @ts-ignore
      console.log(`First message ID: ${messages[0].id}`);
      // @ts-ignore
      console.log(`First message type: ${messages[0].className}`);
      
      // Check if it has media
      // @ts-ignore
      if (messages[0].media) {
        // @ts-ignore
        console.log(`First message has media: ${messages[0].media.className}`);
      } else {
        console.log('First message has no media');
      }
    }
    
    console.log('\n✅ Channel access test completed');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

// Run the script
testChannelAccess().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});