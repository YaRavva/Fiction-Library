/**
 * Test script to access Telegram files channel using the found channel ID
 * This script uses the actual channel ID to retrieve files
 */

import { config } from 'dotenv';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

// Load environment variables FIRST
config({ path: '.env' });

async function testAccessFilesById() {
  console.log('🚀 Testing access to Telegram files channel by ID...\n');
  
  try {
    // Get environment variables
    const apiId = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;
    const sessionString = process.env.TELEGRAM_SESSION;
    
    if (!apiId || !apiHash || !sessionString) {
      throw new Error('Missing required environment variables');
    }
    
    // Initialize Telegram client
    console.log('🔧 Initializing Telegram client...');
    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });
    
    await client.connect();
    console.log('✅ Telegram client connected\n');
    
    // Use the found channel ID
    const channelId = 1515159552;
    console.log(`🆔 Accessing channel with ID: ${channelId}\n`);
    
    try {
      // Get the channel entity
      // Try to get channel by ID directly
      const channel = await client.getEntity(channelId);
      console.log(`✅ Channel accessed: ${(channel as any).title}`);
      console.log(`   Channel ID: ${(channel as any).id}`);
      console.log(`   Channel type: ${(channel as any).className}`);
      
      // Get recent messages from the channel
      console.log('\n📥 Getting recent messages from channel...');
      const messages = await client.getMessages(channelId, { limit: 15 });
      console.log(`📊 Found ${messages.length} messages\n`);
      
      // Extract file information
      console.log('📁 Files found in channel:');
      let fileCount = 0;
      
      for (const msg of messages) {
        if ((msg as any).media && (msg as any).media.className === 'MessageMediaDocument') {
          const document = (msg as any).media.document;
          if (document) {
            const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
            const filename = filenameAttr?.fileName || `book_${msg.id}`;
            
            console.log(`  ${fileCount + 1}. ${filename} (${document.size} bytes)`);
            console.log(`     Message ID: ${msg.id}`);
            fileCount++;
            
            if (fileCount >= 10) break; // Limit output to first 10 files
          }
        }
      }
      
      console.log(`\n✅ Found ${fileCount} files in channel`);
      
      if (fileCount > 0) {
        console.log('\n🎉 Successfully accessed files channel!');
        console.log('💡 Next steps:');
        console.log('   1. Match files with books in database');
        console.log('   2. Download and process selected files');
        console.log('   3. Upload to Supabase storage');
        console.log('   4. Link files to book records');
      }
      
    } catch (channelError) {
      console.error('❌ Error accessing channel:', channelError);
    }
    
    console.log('\n✅ Channel access test completed!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    // Disconnect client
    try {
      // @ts-ignore
      await client.disconnect();
      console.log('\n🧹 Telegram client disconnected');
    } catch (disconnectError) {
      console.error('⚠️ Error disconnecting client:', disconnectError);
    }
    
    // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Run the script
testAccessFilesById().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});