/**
 * Test script to access Telegram files channel by ID directly
 * This script bypasses the invite link and uses channel ID directly
 */

import { config } from 'dotenv';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

// Load environment variables FIRST
config({ path: '.env' });

async function testChannelAccessById() {
  console.log('🚀 Testing Telegram channel access by ID...\n');
  
  try {
    // Get environment variables
    const apiId = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;
    const sessionString = process.env.TELEGRAM_SESSION;
    const filesChannelHash = process.env.TELEGRAM_FILES_CHANNEL_HASH;
    
    if (!apiId || !apiHash || !sessionString || !filesChannelHash) {
      throw new Error('Missing required environment variables');
    }
    
    // Initialize Telegram client
    console.log('🔧 Initializing Telegram client...');
    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });
    
    await client.connect();
    console.log('✅ Telegram client connected');
    
    try {
      // Try to join the channel using the invite hash first
      console.log(`\n🔗 Trying to join channel using invite hash: ${filesChannelHash}`);
      const result = await client.invoke(new Api.messages.ImportChatInvite({
        hash: filesChannelHash
      }));
      
      console.log('✅ Successfully joined channel');
      
      if (result && 'chats' in result && result.chats.length > 0) {
        const channelId = result.chats[0].id.toString();
        console.log(`🆔 Channel ID: ${channelId}`);
        console.log(`🏷️ Channel title: ${(result.chats[0] as any).title}`);
        
        // Now try to get messages from the channel
        console.log('\n📥 Getting messages from channel...');
        const messages = await client.getMessages(channelId, { limit: 10 });
        console.log(`📊 Found ${messages.length} messages`);
        
        // Extract file information
        console.log('\n📁 Files found:');
        let fileCount = 0;
        
        for (const msg of messages) {
          if ((msg as any).media && (msg as any).media.className === 'MessageMediaDocument') {
            const document = (msg as any).media.document;
            if (document) {
              const filenameAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename');
              const filename = filenameAttr?.fileName || `book_${msg.id}`;
              
              console.log(`  ${fileCount + 1}. ${filename} (${document.size} bytes)`);
              fileCount++;
              
              if (fileCount >= 5) break; // Limit output
            }
          }
        }
        
        console.log(`\n✅ Found ${fileCount} files in channel`);
      }
    } catch (joinError: any) {
      // If user is already participant, try to access directly
      if (joinError && joinError.errorMessage === 'USER_ALREADY_PARTICIPANT') {
        console.log('ℹ️ User already participant, trying direct access...');
        
        try {
          // Try to access the channel directly using the hash
          const channel = await client.getEntity(filesChannelHash);
          console.log(`✅ Channel accessed: ${(channel as any).title}`);
          console.log(`🆔 Channel ID: ${(channel as any).id}`);
          
          // Get messages
          console.log('\n📥 Getting messages from channel...');
          const messages = await client.getMessages(channel, { limit: 10 });
          console.log(`📊 Found ${messages.length} messages`);
          
        } catch (directError) {
          console.error('❌ Error accessing channel directly:', directError);
        }
      } else {
        console.error('❌ Error joining channel:', joinError);
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
testChannelAccessById().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});