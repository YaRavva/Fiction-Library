/**
 * Script to inspect specific Telegram messages that should contain multiple covers
 */

import dotenv from 'dotenv';
import path from 'path';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { inspect } from 'util';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function inspectSpecificMessages() {
  console.log('🔍 Inspecting specific messages that should contain multiple covers...\n');

  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_SESSION;
  const metadataChannel = process.env.TELEGRAM_METADATA_CHANNEL;

  if (!apiId || !apiHash || !sessionString || !metadataChannel) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  try {
    // Create client
    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => await Promise.reject('Interactive login not supported'),
      phoneCode: async () => await Promise.reject('Interactive login not supported'),
      password: async () => await Promise.reject('Interactive login not supported'),
      onError: (err) => console.error('Telegram client error:', err),
    });

    console.log('✅ Connected to Telegram\n');

    // Get channel
    const username = metadataChannel.split('/').pop() || metadataChannel;
    const channel = await client.getEntity(username);
    
    // Get specific messages by ID
    const messageIds = [4917, 4912]; // "цикл Луна" and "цикл Одаренные"
    
    console.log('📖 Getting specific messages...\n');
    const messages = await client.getMessages(channel, { ids: messageIds });
    
    for (const msg of messages) {
      if (!msg) continue;
      
      console.log(`📝 Message ID: ${msg.id}`);
      console.log(`   Date: ${msg.date}`);
      
      if (msg.message) {
        console.log('   Text preview:');
        console.log('   ' + msg.message.substring(0, 100) + '...');
        console.log('');
      }

      // Detailed media structure
      const anyMsg: any = msg;
      
      if (anyMsg.media) {
        console.log('🖼️ Media structure:');
        console.log(`   Type: ${anyMsg.media.className}`);
        
        if (anyMsg.media.className === 'MessageMediaWebPage') {
          console.log('   This is a web page preview (MessageMediaWebPage)');
          
          if (anyMsg.media.webpage) {
            console.log(`   Webpage type: ${anyMsg.media.webpage.className}`);
            console.log(`   URL: ${anyMsg.media.webpage.url}`);
            
            if (anyMsg.media.webpage.photo) {
              console.log('   ✅ Webpage contains a photo!');
              console.log(`   Photo type: ${anyMsg.media.webpage.photo.className}`);
              console.log('   Photo structure:');
              console.log(inspect(anyMsg.media.webpage.photo, { depth: 3, colors: true }));
            } else {
              console.log('   ⚠️ Webpage does not contain a photo');
            }
          }
        } else {
          console.log('   Full media structure:');
          console.log(inspect(anyMsg.media, { depth: 5, colors: true }));
        }
      } else {
        console.log('⚠️ Message contains no media');
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
    }

    await client.disconnect();
    console.log('✅ Inspection completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
inspectSpecificMessages();