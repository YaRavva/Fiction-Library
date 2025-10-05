/**
 * Test script to correctly access Telegram channel by ID
 * This script uses the proper method to access a channel by its ID
 */

import { config } from 'dotenv';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import bigInt from 'big-integer';

// Load environment variables FIRST
config({ path: '.env' });

async function testChannelAccessCorrect() {
  console.log('🚀 Testing correct channel access by ID...\n');
  
  let client: TelegramClient | null = null;
  
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
    client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });
    
    await client.connect();
    console.log('✅ Telegram client connected\n');
    
    // Use the found channel ID with proper formatting
    const channelId = 1515159552;
    console.log(`🆔 Accessing channel with ID: ${channelId}\n`);
    
    try {
      // Create proper channel input using bigInt
      const inputChannel = new Api.InputChannel({
        channelId: bigInt(channelId),
        accessHash: bigInt(0) // We don't know the access hash, so we use 0
      });
      
      console.log('🔄 Trying to get channel info with InputChannel...');
      
      // Try to get channel info
      const channelInfo = await client.invoke(new Api.channels.GetChannels({
        id: [inputChannel]
      }));
      
      if (channelInfo && 'chats' in channelInfo && channelInfo.chats.length > 0) {
        const channel = channelInfo.chats[0];
        console.log(`✅ Channel accessed: ${(channel as any).title}`);
        console.log(`   Channel ID: ${(channel as any).id.toString()}`);
        
        // Now try to get messages
        console.log('\n📥 Getting messages from channel...');
        const messages = await client.getMessages(inputChannel, { limit: 10 });
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
              console.log(`     Message ID: ${msg.id}`);
              fileCount++;
              
              if (fileCount >= 5) break; // Limit output
            }
          }
        }
        
        console.log(`\n✅ Found ${fileCount} files in channel`);
      } else {
        console.log('❌ No channel info returned');
      }
      
    } catch (channelError) {
      console.error('❌ Error accessing channel with InputChannel:', channelError);
      
      // Try another approach - use the channel ID directly but with proper entity format
      console.log('\n🔄 Trying alternative approach...');
      
      try {
        // First, try to get the channel entity using the ID
        console.log('   Getting channel entity...');
        const channelEntity = await client.getEntity(new Api.PeerChannel({ channelId: bigInt(channelId) }));
        console.log(`✅ Channel entity obtained: ${(channelEntity as any).title}`);
        
        // Then get messages
        console.log('\n📥 Getting messages from channel entity...');
        const messages = await client.getMessages(channelEntity, { limit: 10 });
        console.log(`📊 Found ${messages.length} messages`);
        
      } catch (entityError) {
        console.error('❌ Error with entity approach:', entityError);
      }
    }
    
    console.log('\n✅ Channel access test completed!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    // Disconnect client
    if (client) {
      try {
        await client.disconnect();
        console.log('\n🧹 Telegram client disconnected');
      } catch (disconnectError) {
        console.error('⚠️ Error disconnecting client:', disconnectError);
      }
    }
    
    // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Run the script
testChannelAccessCorrect().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});