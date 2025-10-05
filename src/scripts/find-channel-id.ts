/**
 * Script to find Telegram channel ID by channel name
 * This script searches for channels accessible to the user
 */

import { config } from 'dotenv';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

// Load environment variables FIRST
config({ path: '.env' });

async function findChannelId() {
  console.log('🔍 Searching for Telegram channel ID...\n');
  
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
    
    // Search for channels with name "Архив для фантастики"
    console.log('🔎 Searching for channels named "Архив для фантастики"...\n');
    
    try {
      // Get dialogs (chats/channels the user is in)
      const dialogs = await client.getDialogs();
      console.log(`📊 Found ${dialogs.length} dialogs\n`);
      
      let found = false;
      
      for (const dialog of dialogs) {
        // @ts-ignore
        if (dialog.entity && dialog.entity.title) {
          // @ts-ignore
          const title = dialog.entity.title;
          // @ts-ignore
          const id = dialog.entity.id ? dialog.entity.id.toString() : 'unknown';
          
          if (title.includes('Архив') && title.includes('фантастики')) {
            console.log(`✅ Found matching channel:`);
            console.log(`   Name: ${title}`);
            console.log(`   ID: ${id}`);
            console.log(`   Type: ${(dialog.entity as any).className || 'unknown'}`);
            found = true;
          }
        }
      }
      
      if (!found) {
        console.log('❌ No channel named "Архив для фантастики" found in your dialogs');
        console.log('\n📋 Checking if channel is accessible by invite link...');
        
        // Try to get channel info from environment variables
        const filesChannelHash = process.env.TELEGRAM_FILES_CHANNEL_HASH;
        if (filesChannelHash) {
          console.log(`🔗 Invite hash found: ${filesChannelHash}`);
          console.log('💡 You may need to join the channel first using this hash');
        }
      }
      
    } catch (searchError) {
      console.error('❌ Error searching for channels:', searchError);
    }
    
    console.log('\n✅ Channel search completed!');
    
  } catch (error) {
    console.error('❌ Error during search:', error);
  } finally {
    // Принудительно завершаем скрипт через 1 секунду из-за известной проблемы с GramJS
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Run the script
findChannelId().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});