/**
 * Script to list all files in the Telegram files channel
 */

import { config } from 'dotenv';

// Load environment variables FIRST
config({ path: '.env' });

async function listTelegramFiles() {
  // Dynamically import TelegramService after dotenv is loaded
  const { TelegramService } = await import('../lib/telegram/client');
  
  let telegramClient: any = null;
  
  try {
    console.log('🔍 Listing files in Telegram channel...\n');
    
    // Initialize Telegram client
    console.log('Initializing Telegram client...');
    telegramClient = await TelegramService.getInstance();
    console.log('✅ Telegram client initialized');
    
    // Access the files channel
    console.log('Accessing files channel...');
    const channel = await telegramClient.getFilesChannel();
    // @ts-ignore
    console.log(`✅ Channel: ${channel.title}\n`);
    
    // Get messages (files) from the channel
    console.log('Getting files from channel...');
    const messages = await telegramClient.getMessages(channel, 200); // Get more files
    console.log(`Found ${messages.length} messages\n`);
    
    // Extract file information
    const files: any[] = [];
    for (const msg of messages) {
      // @ts-ignore
      if (msg.media && msg.media.className === 'MessageMediaDocument') {
        // @ts-ignore
        const document = msg.media.document;
        if (document) {
          // @ts-ignore
          const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
          const filename = filenameAttr?.fileName || `book_${msg.id}`;
          
          files.push({
            // @ts-ignore
            id: msg.id,
            filename: filename,
            // @ts-ignore
            mimeType: document.mimeType,
            // @ts-ignore
            size: document.size,
            // @ts-ignore
            message: msg
          });
        }
      }
    }
    
    console.log(`Found ${files.length} files with documents:\n`);
    
    // Sort files by filename
    files.sort((a, b) => a.filename.localeCompare(b.filename));
    
    // Display files
    for (const file of files) {
      console.log(`${file.filename} (${file.size} bytes)`);
    }
    
    console.log(`\n✅ Listed ${files.length} files.`);
    
  } catch (error) {
    console.error('❌ Error listing files:', error);
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
listTelegramFiles().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});