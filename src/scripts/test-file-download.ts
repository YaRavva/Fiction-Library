/**
 * Script to test downloading a specific file from Telegram
 */

import { config } from 'dotenv';
import { TelegramService } from '../lib/telegram/client';

// Load environment variables
config({ path: '.env' });

async function testFileDownload() {
  let telegramClient: TelegramService | null = null;
  
  try {
    console.log('🔍 Testing Telegram file download...\n');
    
    // Initialize Telegram client
    console.log('Initializing Telegram client...');
    telegramClient = await TelegramService.getInstance();
    console.log('✅ Telegram client initialized');
    
    // Access the files channel
    console.log('Accessing files channel...');
    const channel = await telegramClient.getFilesChannel();
    // @ts-ignore
    console.log(`✅ Channel: ${channel.title}`);
    
    // Get messages
    console.log('Getting messages...');
    const messages = await telegramClient.getMessages(channel, 5);
    console.log(`✅ Found ${messages.length} messages`);
    
    // Find a message with a document
    let targetMessage = null;
    for (const msg of messages) {
      // @ts-ignore
      if (msg.media && msg.media.className === 'MessageMediaDocument') {
        targetMessage = msg;
        // @ts-ignore
        console.log(`Found message with document: ${msg.id}`);
        break;
      }
    }
    
    if (!targetMessage) {
      console.log('No message with document found');
      return;
    }
    
    // Try to download the media with a timeout
    console.log('Downloading media...');
    const buffer = await Promise.race([
      telegramClient.downloadMedia(targetMessage),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Media download took too long')), 30000)
      )
    ]);
    
    if (buffer instanceof Buffer) {
      console.log(`✅ Successfully downloaded file (${buffer.length} bytes)`);
    } else {
      console.log('❌ Downloaded content is not a Buffer');
    }
    
    console.log('\n✅ File download test completed');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

// Run the script
testFileDownload().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});