/**
 * Test script to access Telegram channel using existing TelegramService
 * This script uses the existing service with modified channel access logic
 */

import { config } from 'dotenv';

// Load environment variables FIRST
config({ path: '.env'});

async function testAccessChannelWithService() {
  console.log('🚀 Testing channel access using TelegramService...\n');
  
  try {
    // Dynamically import TelegramService after dotenv is loaded
    const { TelegramService } = await import('../lib/telegram/client');
    
    // Initialize Telegram client
    console.log('🔧 Initializing TelegramService...');
    const telegramService = await TelegramService.getInstance();
    console.log('✅ TelegramService initialized\n');
    
    // Try to access the files channel using existing method
    console.log('📂 Accessing files channel...');
    
    try {
      const filesChannel = await telegramService.getFilesChannel();
      // @ts-ignore
      console.log(`✅ Files channel accessed: ${filesChannel.title}`);
      // @ts-ignore
      console.log(`   Channel ID: ${filesChannel.id}`);
      
      // Get messages from the channel
      console.log('\n📥 Getting messages from channel...');
      // @ts-ignore
      const messages: any[] = await telegramService.getMessages(filesChannel.id, 10) as any[];
      console.log(`📊 Found ${messages.length} messages`);
      
      // Extract file information
      console.log('\n📁 Files found:');
      let fileCount = 0;
      
      for (const msg of messages) {
        // @ts-ignore
        if (msg.media && msg.media.className === 'MessageMediaDocument') {
          // @ts-ignore
          const document = msg.media.document;
          if (document) {
            // @ts-ignore
            const filenameAttr = document.attributes?.find((attr) => attr.className === 'DocumentAttributeFilename');
            const filename = filenameAttr?.fileName || `book_${msg.id}`;
            
            console.log(`  ${fileCount + 1}. ${filename} (${document.size} bytes)`);
            console.log(`     Message ID: ${msg.id}`);
            fileCount++;
            
            if (fileCount >= 5) break; // Limit output
          }
        }
      }
      
      console.log(`\n✅ Found ${fileCount} files in channel`);
      
    } catch (channelError) {
      console.error('❌ Error accessing files channel:', channelError);
      
      // Try alternative approach with known channel ID
      console.log('\n🔄 Trying alternative approach with known channel ID...');
      
      try {
        // Use the known channel ID directly
        const channelId = 1515159552;
        console.log(`🆔 Using channel ID: ${channelId}`);
        
        // @ts-ignore
        const messages: any[] = await telegramService.getMessages(channelId, 10) as any[];
        console.log(`📊 Found ${messages.length} messages with direct ID access`);
        
      } catch (directError) {
        console.error('❌ Error with direct ID access:', directError);
      }
    }
    
    console.log('\n✅ Channel access test completed!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Run the script
testAccessChannelWithService().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});