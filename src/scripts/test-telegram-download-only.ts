/**
 * Script to test downloading a book file from Telegram only (without Supabase upload)
 */

import { config } from 'dotenv';
import { TelegramService } from '../lib/telegram/client';

// Load environment variables
config({ path: '.env' });

async function testTelegramDownloadOnly() {
  let telegramClient: TelegramService | null = null;
  
  try {
    console.log('🔍 Testing Telegram file download only...\n');
    
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
        setTimeout(() => reject(new Error('Timeout: Media download took too long')), 60000)
      )
    ]);
    
    if (buffer instanceof Buffer) {
      console.log(`✅ Successfully downloaded file (${buffer.length} bytes)`);
      
      // Save to local file for verification
      const fs = require('fs');
      const path = require('path');
      const filename = `downloaded_book_${Date.now()}.bin`;
      fs.writeFileSync(path.join(__dirname, filename), buffer);
      console.log(`💾 File saved locally as: ${filename}`);
    } else {
      console.log('❌ Downloaded content is not a Buffer');
    }
    
    console.log('\n✅ Telegram download test completed');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
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
testTelegramDownloadOnly().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});